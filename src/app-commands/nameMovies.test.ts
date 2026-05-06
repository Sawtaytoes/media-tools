import { stat } from "node:fs/promises"
import { vol } from "memfs"
import { firstValueFrom, of, toArray } from "rxjs"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { captureConsoleMessage } from "../tools/captureConsoleMessage.js"
import {
  buildPlexBaseName,
  extractEditionFromReleaseLabel,
  nameMovies,
} from "./nameMovies.js"

// ── Pure helpers ────────────────────────────────────────────────────────────

describe(extractEditionFromReleaseLabel.name, () => {
  test("returns the third+ ' - '-delimited segment from a typical DVDCompare label", () => {
    expect(extractEditionFromReleaseLabel(
      "Blu-ray ALL America - Arrow Films - Director's Cut Limited Edition",
    )).toBe("Director's Cut Limited Edition")
  })

  test("joins multi-segment editions back with ' - '", () => {
    expect(extractEditionFromReleaseLabel(
      "Blu-ray ALL America - Arrow - Director's Cut - 50th Anniversary - Steelbook",
    )).toBe("Director's Cut - 50th Anniversary - Steelbook")
  })

  test("returns blank for labels with fewer than three segments", () => {
    expect(extractEditionFromReleaseLabel("Blu-ray ALL America")).toBe("")
    expect(extractEditionFromReleaseLabel("Blu-ray - Arrow Films")).toBe("")
  })

  test("handles null / undefined gracefully", () => {
    expect(extractEditionFromReleaseLabel(null)).toBe("")
    expect(extractEditionFromReleaseLabel(undefined)).toBe("")
  })
})

describe(buildPlexBaseName.name, () => {
  test("builds 'Title (Year) {edition-Edition Name}' when all three are set", () => {
    expect(buildPlexBaseName({
      title: "Soldier",
      year: "1998",
      edition: "Director's Cut",
    })).toBe("Soldier (1998) {edition-Director's Cut}")
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

// ── Pipeline (mocked TMDB / DVDCompare lookups) ─────────────────────────────

vi.mock("../tools/searchMovieDb.js", () => ({
  lookupMovieDbById: vi.fn(),
}))

vi.mock("../tools/searchDvdCompare.js", () => ({
  lookupDvdCompareRelease: vi.fn(),
}))

const { lookupMovieDbById } = await import("../tools/searchMovieDb.js")
const { lookupDvdCompareRelease } = await import("../tools/searchDvdCompare.js")

const mockMovie = (movie: { name: string } | null) => {
  vi.mocked(lookupMovieDbById).mockReturnValue(of(movie))
}
const mockRelease = (release: { label: string } | null) => {
  vi.mocked(lookupDvdCompareRelease).mockReturnValue(of(release))
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

  test("uses an explicit editionLabel and skips the DVDCompare lookup entirely", async () => {
    mockMovie({ name: "Soldier (1998)" })

    await firstValueFrom(
      nameMovies({
        sourcePath: "G:\\Movies\\Some Folder",
        movieDbId: 9504,
        editionLabel: "Director's Cut",
      })
      .pipe(toArray()),
    )

    await expect(stat("G:\\Movies\\Some Folder\\Soldier (1998) {edition-Director's Cut}.mkv")).resolves.toBeDefined()
    expect(vi.mocked(lookupDvdCompareRelease)).not.toHaveBeenCalled()
  })

  test("derives the edition from a DVDCompare release label when no explicit override is given", async () => {
    mockMovie({ name: "Soldier (1998)" })
    mockRelease({ label: "Blu-ray ALL America - Arrow Films - Director's Cut" })

    await firstValueFrom(
      nameMovies({
        sourcePath: "G:\\Movies\\Some Folder",
        movieDbId: 9504,
        dvdCompareId: 12345,
        dvdCompareReleaseHash: "1",
      })
      .pipe(toArray()),
    )

    await expect(stat("G:\\Movies\\Some Folder\\Soldier (1998) {edition-Director's Cut}.mkv")).resolves.toBeDefined()
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
