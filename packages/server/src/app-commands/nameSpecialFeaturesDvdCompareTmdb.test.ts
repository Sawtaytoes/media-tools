import type { FileInfo } from "@mux-magic/tools"
import { describe, expect, test } from "vitest"
import type { MovieIdentity } from "../tools/canonicalizeMovieTitle.js"
import type { Cut } from "../tools/parseSpecialFeatures.js"
import type { FileMatch } from "./nameSpecialFeaturesDvdCompareTmdb.fileMatch.js"
import {
  buildUnnamedFileCandidates,
  groupRenamesByTarget,
  postProcessMatches,
  promoteRenameToFront,
  reorderRenamesForOnDiskConflicts,
} from "./nameSpecialFeaturesDvdCompareTmdb.js"

const makeFileInfo = (filename: string): FileInfo => ({
  filename,
  fullPath: `/work/${filename}`,
  // The post-processor never invokes renameFile in tests; stub returns
  // an Observable<void> so the type matches.
  renameFile: () =>
    ({}) as ReturnType<FileInfo["renameFile"]>,
})

// Default to a movie-length timecode so unmatched-fallback tests
// reflect the "obviously the movie" case. Tests that exercise the
// under-threshold filter pass an explicit short timecode.
const MOVIE_LENGTH_TIMECODE = "1:30:00"

describe(postProcessMatches.name, () => {
  const movie: MovieIdentity = {
    title: "Dragon Lord",
    year: "1982",
  }

  test("renames cut-matched files as 'Title (Year) {edition-…}'", () => {
    const matches: FileMatch[] = [
      {
        kind: "cut",
        timecode: MOVIE_LENGTH_TIMECODE,
        fileInfo: makeFileInfo("disc1.mkv"),
        cut: {
          name: "Hong Kong Version",
          timecode: "1:36:06",
        },
      },
    ]
    expect(postProcessMatches(matches, [], movie)).toEqual([
      {
        fileInfo: matches[0].fileInfo,
        renamedFilename:
          "Dragon Lord (1982) {edition-Hong Kong Version}",
      },
    ])
  })

  test("passes 'extra' renames through unchanged", () => {
    const matches: FileMatch[] = [
      {
        kind: "extra",
        timecode: MOVIE_LENGTH_TIMECODE,
        fileInfo: makeFileInfo("clip.mkv"),
        renamedFilename:
          "Behind the Scenes -behindthescenes",
      },
    ]
    expect(postProcessMatches(matches, [], movie)).toEqual([
      {
        fileInfo: matches[0].fileInfo,
        renamedFilename:
          "Behind the Scenes -behindthescenes",
      },
    ])
  })

  test("leaves unmatched files alone when at least one cut matched (extras list is likely incomplete)", () => {
    const matches: FileMatch[] = [
      {
        kind: "cut",
        timecode: MOVIE_LENGTH_TIMECODE,
        fileInfo: makeFileInfo("a.mkv"),
        cut: {
          name: "Director's Cut",
          timecode: "1:54:42",
        },
      },
      {
        kind: "unmatched",
        timecode: MOVIE_LENGTH_TIMECODE,
        fileInfo: makeFileInfo("b.mkv"),
      },
    ]
    expect(
      postProcessMatches(
        matches,
        [{ name: "Director's Cut", timecode: "1:54:42" }],
        movie,
      ),
    ).toEqual([
      {
        fileInfo: matches[0].fileInfo,
        renamedFilename:
          "Dragon Lord (1982) {edition-Director's Cut}",
      },
    ])
  })

  test("renames a single unmatched file as 'Title (Year)' when no cuts matched", () => {
    const matches: FileMatch[] = [
      {
        kind: "unmatched",
        timecode: MOVIE_LENGTH_TIMECODE,
        fileInfo: makeFileInfo("rip.mkv"),
      },
    ]
    expect(postProcessMatches(matches, [], movie)).toEqual([
      {
        fileInfo: matches[0].fileInfo,
        renamedFilename: "Dragon Lord (1982)",
      },
    ])
  })

  test("uses the sole-named-cut's edition when there's exactly one cut and one unmatched file", () => {
    const matches: FileMatch[] = [
      {
        kind: "unmatched",
        timecode: MOVIE_LENGTH_TIMECODE,
        fileInfo: makeFileInfo("rip.mkv"),
      },
    ]
    const cuts: Cut[] = [
      { name: "Director's Cut", timecode: undefined },
    ]
    expect(
      postProcessMatches(matches, cuts, movie),
    ).toEqual([
      {
        fileInfo: matches[0].fileInfo,
        renamedFilename:
          "Dragon Lord (1982) {edition-Director's Cut}",
      },
    ])
  })

  test("falls back to '(1)/(2)' counter prefixes for multiple unmatched files", () => {
    const matches: FileMatch[] = [
      {
        kind: "unmatched",
        timecode: MOVIE_LENGTH_TIMECODE,
        fileInfo: makeFileInfo("disc1.mkv"),
      },
      {
        kind: "unmatched",
        timecode: MOVIE_LENGTH_TIMECODE,
        fileInfo: makeFileInfo("disc2.mkv"),
      },
      {
        kind: "unmatched",
        timecode: MOVIE_LENGTH_TIMECODE,
        fileInfo: makeFileInfo("disc3.mkv"),
      },
    ]
    expect(postProcessMatches(matches, [], movie)).toEqual([
      {
        fileInfo: matches[0].fileInfo,
        renamedFilename: "(1) Dragon Lord (1982)",
      },
      {
        fileInfo: matches[1].fileInfo,
        renamedFilename: "(2) Dragon Lord (1982)",
      },
      {
        fileInfo: matches[2].fileInfo,
        renamedFilename: "(3) Dragon Lord (1982)",
      },
    ])
  })

  test("sorts unmatched files by filename so '(1)/(2)' assignment is deterministic", () => {
    const matches: FileMatch[] = [
      {
        kind: "unmatched",
        timecode: MOVIE_LENGTH_TIMECODE,
        fileInfo: makeFileInfo("z-disc.mkv"),
      },
      {
        kind: "unmatched",
        timecode: MOVIE_LENGTH_TIMECODE,
        fileInfo: makeFileInfo("a-disc.mkv"),
      },
    ]
    const result = postProcessMatches(matches, [], movie)
    expect(
      result.map((rename) => rename.renamedFilename),
    ).toEqual([
      "(1) Dragon Lord (1982)",
      "(2) Dragon Lord (1982)",
    ])
    expect(result[0].fileInfo.filename).toBe("a-disc.mkv")
    expect(result[1].fileInfo.filename).toBe("z-disc.mkv")
  })

  test("leaves unmatched files alone when there's no movie title to apply", () => {
    const matches: FileMatch[] = [
      {
        kind: "unmatched",
        timecode: MOVIE_LENGTH_TIMECODE,
        fileInfo: makeFileInfo("rip.mkv"),
      },
    ]
    expect(
      postProcessMatches(matches, [], {
        title: "",
        year: "",
      }),
    ).toEqual([])
  })

  test("excludes short unmatched files (e.g. an image gallery) from the main-feature fallback", () => {
    // Reproduces the user's reported bug: a 3:31 image gallery was
    // getting renamed "(2) Soldier (1998)" alongside the actual movie
    // because both fell through to the unmatched-as-main-feature branch.
    const matches: FileMatch[] = [
      {
        kind: "unmatched",
        timecode: "1:42:00",
        fileInfo: makeFileInfo("movie.mkv"),
      },
      {
        kind: "unmatched",
        timecode: "3:31",
        fileInfo: makeFileInfo("image-gallery.mkv"),
      },
    ]
    const result = postProcessMatches(matches, [], movie)
    expect(
      result.map((rename) => rename.renamedFilename),
    ).toEqual([
      // Only the over-threshold file gets renamed; (1)/(2) pluralization
      // doesn't fire because there's now only one main-feature candidate.
      "Dragon Lord (1982)",
    ])
    expect(result[0].fileInfo.filename).toBe("movie.mkv")
  })

  test("falls through to the (1)/(2) prefix when multiple unmatched files all clear the duration threshold", () => {
    const matches: FileMatch[] = [
      {
        kind: "unmatched",
        timecode: "1:36:00",
        fileInfo: makeFileInfo("disc-a.mkv"),
      },
      {
        kind: "unmatched",
        timecode: "1:48:00",
        fileInfo: makeFileInfo("disc-b.mkv"),
      },
      {
        kind: "unmatched",
        timecode: "0:08:00",
        fileInfo: makeFileInfo("trailer.mkv"),
      },
    ]
    const result = postProcessMatches(matches, [], movie)
    // The trailer is below threshold and stays unrenamed; the two
    // movie-length files get the counter prefix.
    expect(
      result.map((rename) => ({
        filename: rename.fileInfo.filename,
        renamed: rename.renamedFilename,
      })),
    ).toEqual([
      {
        filename: "disc-a.mkv",
        renamed: "(1) Dragon Lord (1982)",
      },
      {
        filename: "disc-b.mkv",
        renamed: "(2) Dragon Lord (1982)",
      },
    ])
  })

  test("does NOT pick up the sole-named-cut's edition when multiple unmatched files would all need it (ambiguous)", () => {
    const matches: FileMatch[] = [
      {
        kind: "unmatched",
        timecode: MOVIE_LENGTH_TIMECODE,
        fileInfo: makeFileInfo("disc1.mkv"),
      },
      {
        kind: "unmatched",
        timecode: MOVIE_LENGTH_TIMECODE,
        fileInfo: makeFileInfo("disc2.mkv"),
      },
    ]
    const cuts: Cut[] = [
      { name: "Director's Cut", timecode: undefined },
    ]
    // Two files claiming the same edition would be wrong — fall back to
    // counter prefixes without an edition tag.
    expect(
      postProcessMatches(matches, cuts, movie).map(
        (rename) => rename.renamedFilename,
      ),
    ).toEqual([
      "(1) Dragon Lord (1982)",
      "(2) Dragon Lord (1982)",
    ])
  })
})

describe(reorderRenamesForOnDiskConflicts.name, () => {
  test("leaves the order untouched when no rename targets another file's current name", () => {
    const renames = [
      {
        fileInfo: makeFileInfo("MOVIE_t01.mkv"),
        renamedFilename: "Soldier (1998)",
      },
      {
        fileInfo: makeFileInfo("MOVIE_t02.mkv"),
        renamedFilename:
          "Behind the Scenes -behindthescenes",
      },
    ]
    expect(
      reorderRenamesForOnDiskConflicts(renames),
    ).toEqual(renames)
  })

  test("defers a rename whose target equals another rename's current filename (extension-stripped)", () => {
    // Reproduces the SOLDIER 4K race: a prior partial run left
    // "International Trailer without Narration -trailer.mkv" on disk;
    // this run renames that file to "with Narration" AND another file
    // to "without Narration". With concurrency >= 2 they raced; the
    // reorder ensures the file-renaming-away goes first.
    const renames = [
      // Conflicting rename — its target equals another rename's source
      {
        fileInfo: makeFileInfo("MOVIE_t12.mkv"),
        renamedFilename:
          "International Trailer without Narration -trailer",
      },
      // The file currently holding that name — needs to renaming first
      {
        fileInfo: makeFileInfo(
          "International Trailer without Narration -trailer.mkv",
        ),
        renamedFilename:
          "International Trailer with Narration -trailer",
      },
      {
        fileInfo: makeFileInfo("MOVIE_t05.mkv"),
        renamedFilename: "Featurette -featurette",
      },
    ]
    expect(
      reorderRenamesForOnDiskConflicts(renames).map(
        (rename) => rename.fileInfo.filename,
      ),
    ).toEqual([
      // Non-conflicting renames first
      "International Trailer without Narration -trailer.mkv",
      "MOVIE_t05.mkv",
      // Then the deferred conflicting rename
      "MOVIE_t12.mkv",
    ])
  })

  test("keeps an idempotent rename (target equals own current name) in the upfront group", () => {
    // A file whose target is its own name shouldn't be flagged as
    // conflicting with itself — the sourceStems set includes it, but
    // we explicitly skip the self-match.
    const renames = [
      {
        fileInfo: makeFileInfo("Already Named.mkv"),
        renamedFilename: "Already Named",
      },
    ]
    expect(
      reorderRenamesForOnDiskConflicts(renames),
    ).toEqual(renames)
  })
})

// ── N1: Edition-aware folder layout helpers ────────────────────────────────

// ── N4: Unnamed-file follow-up candidates ─────────────────────────────────

describe(buildUnnamedFileCandidates.name, () => {
  test("returns empty when there are no unnamed files", () => {
    expect(
      buildUnnamedFileCandidates({
        possibleNames: [
          { name: "Image Gallery", timecode: undefined },
        ],
        unrenamedFilenames: [],
      }),
    ).toEqual([])
  })

  test("returns empty when there are no possible-name suggestions", () => {
    expect(
      buildUnnamedFileCandidates({
        possibleNames: [],
        unrenamedFilenames: ["MOVIE_t23.mkv"],
      }),
    ).toEqual([])
  })

  test("returns a candidate list for each unnamed file when both lists are non-empty", () => {
    const result = buildUnnamedFileCandidates({
      possibleNames: [
        { name: "Image Gallery", timecode: undefined },
      ],
      unrenamedFilenames: ["MOVIE_t23.mkv"],
    })
    expect(result).toHaveLength(1)
    expect(result[0].filename).toBe("MOVIE_t23.mkv")
    expect(result[0].candidates).toEqual(["Image Gallery"])
  })

  test("ranks candidates that share more words with the filename first", () => {
    const result = buildUnnamedFileCandidates({
      possibleNames: [
        {
          name: "Promotional Featurette",
          timecode: undefined,
        },
        {
          name: "Image Gallery (1200 images)",
          timecode: undefined,
        },
        { name: "Deleted Scenes", timecode: undefined },
      ],
      unrenamedFilenames: ["image-gallery-extra.mkv"],
    })
    // "Image Gallery" shares 'image' and 'gallery' with the stem — should
    // rank above "Promotional Featurette" and "Deleted Scenes" (0 shared words).
    expect(result[0].candidates[0]).toBe(
      "Image Gallery (1200 images)",
    )
  })

  test("produces one entry per unnamed file, each with the full candidate list", () => {
    const result = buildUnnamedFileCandidates({
      possibleNames: [
        { name: "Deleted Scene", timecode: undefined },
        { name: "Featurette", timecode: undefined },
      ],
      unrenamedFilenames: [
        "MOVIE_t01.mkv",
        "MOVIE_t02.mkv",
      ],
    })
    expect(result).toHaveLength(2)
    expect(result[0].candidates).toHaveLength(2)
    expect(result[1].candidates).toHaveLength(2)
  })

  test("preserves the timecode slot on each PossibleName entry through the call (currently unused but reserved for the smart-suggestion modal)", () => {
    // The candidates list is just names today, but the input shape carries
    // timecode info forward so callers can pair the file with the original
    // PossibleName entry for duration-proximity scoring on the client.
    const result = buildUnnamedFileCandidates({
      possibleNames: [
        { name: "Trailer", timecode: "0:02:30" },
        { name: "Image Gallery", timecode: undefined },
      ],
      unrenamedFilenames: ["BONUS_1.mkv"],
    })
    // Sanity — both candidate names made it through; the helper still
    // returns just names (timecodes are consumed elsewhere).
    expect(result[0].candidates).toContain("Trailer")
    expect(result[0].candidates).toContain("Image Gallery")
  })
})

describe(groupRenamesByTarget.name, () => {
  test("groups multiple renames sharing the same target and preserves input order within each group", () => {
    const renameOne = {
      renamedFilename: "Behind the Scenes -behindthescenes",
    }
    const renameTwo = {
      renamedFilename: "Trailer -trailer",
    }
    const renameThree = {
      renamedFilename: "Behind the Scenes -behindthescenes",
    }
    const groups = groupRenamesByTarget([
      renameOne,
      renameTwo,
      renameThree,
    ])
    expect(
      groups.get("Behind the Scenes -behindthescenes"),
    ).toEqual([renameOne, renameThree])
    expect(groups.get("Trailer -trailer")).toEqual([
      renameTwo,
    ])
  })

  test("returns single-entry groups for non-duplicate targets", () => {
    const renameOne = { renamedFilename: "A" }
    const renameTwo = { renamedFilename: "B" }
    const groups = groupRenamesByTarget([
      renameOne,
      renameTwo,
    ])
    expect(groups.size).toBe(2)
  })
})

describe(promoteRenameToFront.name, () => {
  test("moves the chosen entry to the front while preserving the relative order of the rest", () => {
    const first = { id: 1 }
    const second = { id: 2 }
    const third = { id: 3 }
    expect(
      promoteRenameToFront([first, second, third], second),
    ).toEqual([second, first, third])
  })

  test("returns the array unchanged when the chosen entry is not present", () => {
    const first = { id: 1 }
    const stranger = { id: 99 }
    expect(promoteRenameToFront([first], stranger)).toEqual(
      [first],
    )
  })

  test("returns the array unchanged when the chosen entry is already at the front", () => {
    const first = { id: 1 }
    const second = { id: 2 }
    expect(
      promoteRenameToFront([first, second], first),
    ).toEqual([first, second])
  })
})
