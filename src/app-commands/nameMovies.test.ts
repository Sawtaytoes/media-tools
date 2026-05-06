import { stat } from "node:fs/promises"
import { vol } from "memfs"
import { firstValueFrom, of, toArray } from "rxjs"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { captureConsoleMessage } from "../tools/captureConsoleMessage.js"
import { buildPlexBaseName, nameMovies } from "./nameMovies.js"

// ── Pure helpers ────────────────────────────────────────────────────────────

describe(buildPlexBaseName.name, () => {
  test("builds 'Title (Year) {edition-Edition Name}' when all three are set", () => {
    expect(buildPlexBaseName({
      title: "Dragon Lord",
      year: "1982",
      edition: "Hybrid Cut",
    })).toBe("Dragon Lord (1982) {edition-Hybrid Cut}")
  })

  test("drops the edition suffix when no edition is provided", () => {
    expect(buildPlexBaseName({
      title: "Inception",
      year: "2010",
      edition: "",
    })).toBe("Inception (2010)")
  })

  test("drops the year when missing (year-less re-releases / archive prints)", () => {
    expect(buildPlexBaseName({
      title: "Untitled",
      year: "",
      edition: "",
    })).toBe("Untitled")
  })

  test("strips filename-illegal characters from title and edition", () => {
    expect(buildPlexBaseName({
      title: "Wall-E:?*<>|",
      year: "2008",
      edition: 'Director\'s "Final" Cut',
    })).toBe("Wall-E - (2008) {edition-Director's 'Final' Cut}")
  })
})

// ── Pipeline (mocked TMDB lookup) ───────────────────────────────────────────

vi.mock("../tools/searchMovieDb.js", () => ({
  lookupMovieDbById: vi.fn(),
}))

const { lookupMovieDbById } = await import("../tools/searchMovieDb.js")

const mockMovie = (movie: { name: string } | null) => {
  vi.mocked(lookupMovieDbById).mockReturnValue(of(movie))
}

// memfs reads files via stat() to verify the rename actually moved the
// file. The real fs is mocked in vitest.setup.ts; our test file shows up
// in vol with whatever path we seed.
describe(nameMovies.name, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vol.fromJSON({
      "G:\\Movies\\Some Folder\\rip.mkv": "video-bytes",
    })
  })

  afterEach(() => {
    vol.reset()
  })

  test("renames the single .mkv to 'Title (Year).mkv' when no edition is provided", async () => {
    mockMovie({ name: "Inception (2010)" })

    const emissions = await firstValueFrom(
      nameMovies({
        sourcePath: "G:\\Movies\\Some Folder",
        movieDbId: 27205,
      })
      .pipe(toArray()),
    )

    expect(emissions).toEqual(["Inception (2010)"])
    await expect(stat("G:\\Movies\\Some Folder\\Inception (2010).mkv")).resolves.toBeDefined()
    await expect(stat("G:\\Movies\\Some Folder\\rip.mkv")).rejects.toThrow()
  })

  test("appends the editionLabel literally as {edition-<label>}", async () => {
    mockMovie({ name: "Dragon Lord (1982)" })

    await firstValueFrom(
      nameMovies({
        sourcePath: "G:\\Movies\\Some Folder",
        movieDbId: 9504,
        editionLabel: "Hybrid Cut",
      })
      .pipe(toArray()),
    )

    await expect(stat("G:\\Movies\\Some Folder\\Dragon Lord (1982) {edition-Hybrid Cut}.mkv")).resolves.toBeDefined()
  })

  test("appends -pt1 / -pt2 suffixes when sourcePath contains multiple video files", async () => {
    vol.reset()
    vol.fromJSON({
      "G:\\Movies\\Some Folder\\disc1.mkv": "v1",
      "G:\\Movies\\Some Folder\\disc2.mkv": "v2",
    })
    mockMovie({ name: "Cleopatra (1963)" })

    await firstValueFrom(
      nameMovies({
        sourcePath: "G:\\Movies\\Some Folder",
        movieDbId: 100,
      })
      .pipe(toArray()),
    )

    // Sorted by original filename: disc1 → pt1, disc2 → pt2.
    await expect(stat("G:\\Movies\\Some Folder\\Cleopatra (1963) - pt1.mkv")).resolves.toBeDefined()
    await expect(stat("G:\\Movies\\Some Folder\\Cleopatra (1963) - pt2.mkv")).resolves.toBeDefined()
    await expect(stat("G:\\Movies\\Some Folder\\disc1.mkv")).rejects.toThrow()
    await expect(stat("G:\\Movies\\Some Folder\\disc2.mkv")).rejects.toThrow()
  })

  test("returns EMPTY when movieDbId is missing or invalid (defensive guard)", async () => (
    captureConsoleMessage("info", async () => {
      const emissions = await firstValueFrom(
        nameMovies({
          sourcePath: "G:\\Movies\\Some Folder",
          // 0 isn't an `expect-error` from a type standpoint — number accepts
          // it — but the runtime guard rejects non-positive ids so external
          // callers can't accidentally rename based on a stub TMDB id.
          movieDbId: 0,
        })
        .pipe(toArray()),
      )
      expect(emissions).toEqual([])
      // The .mkv was untouched.
      await expect(stat("G:\\Movies\\Some Folder\\rip.mkv")).resolves.toBeDefined()
    })
  ))

  test("logs and surfaces an error when TMDB returns null for the given id", async () => (
    captureConsoleMessage("error", async () => {
      mockMovie(null)
      const emissions = await firstValueFrom(
        nameMovies({
          sourcePath: "G:\\Movies\\Some Folder",
          movieDbId: 999999,
        })
        .pipe(toArray()),
      )
      // catchNamedError swallows into EMPTY but the .mkv survives.
      expect(emissions).toEqual([])
      await expect(stat("G:\\Movies\\Some Folder\\rip.mkv")).resolves.toBeDefined()
    })
  ))

  test("emits nothing and leaves the directory alone when no video files are present", async () => (
    captureConsoleMessage("info", async () => {
      vol.reset()
      vol.fromJSON({ "G:\\Movies\\Some Folder\\readme.txt": "ignore me" })
      mockMovie({ name: "Some Movie (2020)" })

      const emissions = await firstValueFrom(
        nameMovies({
          sourcePath: "G:\\Movies\\Some Folder",
          movieDbId: 1,
        })
        .pipe(toArray()),
      )
      expect(emissions).toEqual([])
      await expect(stat("G:\\Movies\\Some Folder\\readme.txt")).resolves.toBeDefined()
    })
  ))
})
