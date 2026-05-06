import { describe, expect, test } from "vitest"

import type { Cut } from "../tools/parseSpecialFeatures.js"
import type { FileInfo } from "../tools/getFiles.js"
import type { MovieIdentity } from "../tools/canonicalizeMovieTitle.js"

import {
  buildMovieBaseName,
  buildMovieFeatureName,
  findMatchingCut,
  postProcessMatches,
  type FileMatch,
} from "./nameSpecialFeatures.js"

const makeFileInfo = (filename: string): FileInfo => ({
  filename,
  fullPath: `/work/${filename}`,
  // The post-processor never invokes renameFile in tests; stub returns
  // an Observable<void> so the type matches.
  renameFile: () => ({} as ReturnType<FileInfo["renameFile"]>),
})

describe(buildMovieBaseName.name, () => {
  test("formats 'Title (Year)' for a normal entry", () => {
    expect(buildMovieBaseName({ title: "Inception", year: "2010" }))
    .toBe("Inception (2010)")
  })

  test("drops the year parenthetical when missing", () => {
    expect(buildMovieBaseName({ title: "Untitled", year: "" }))
    .toBe("Untitled")
  })

  test("strips filename-illegal characters from the title", () => {
    expect(buildMovieBaseName({ title: "Soldier: Reloaded?", year: "1998" }))
    .toBe("Soldier - Reloaded (1998)")
  })
})

describe(buildMovieFeatureName.name, () => {
  test("appends '{edition-…}' when a cut name is provided", () => {
    expect(buildMovieFeatureName({ title: "Dragon Lord", year: "1982" }, "Hong Kong Version"))
    .toBe("Dragon Lord (1982) {edition-Hong Kong Version}")
  })

  test("omits the edition suffix for an empty cut name", () => {
    expect(buildMovieFeatureName({ title: "Dragon Lord", year: "1982" }, ""))
    .toBe("Dragon Lord (1982)")
  })
})

describe(findMatchingCut.name, () => {
  test("returns null when no cut has a timecode close to the file's", () => {
    const cuts: Cut[] = [{ name: "Hong Kong", timecode: "1:36:06" }]
    expect(findMatchingCut(cuts, "0:45:12", {})).toBeNull()
  })

  test("finds a cut whose timecode matches within the configured deviation window", () => {
    const cuts: Cut[] = [{ name: "Hybrid", timecode: "1:48:44" }]
    expect(findMatchingCut(cuts, "1:48:44", {})).toEqual({ name: "Hybrid", timecode: "1:48:44" })
  })

  test("ignores cuts that have no timecode (can't match by timecode if there isn't one)", () => {
    const cuts: Cut[] = [{ name: "Director's Cut", timecode: undefined }]
    expect(findMatchingCut(cuts, "1:54:42", {})).toBeNull()
  })
})

describe(postProcessMatches.name, () => {
  const movie: MovieIdentity = { title: "Dragon Lord", year: "1982" }

  test("renames cut-matched files as 'Title (Year) {edition-…}'", () => {
    const matches: FileMatch[] = [
      { kind: "cut", fileInfo: makeFileInfo("disc1.mkv"), cut: { name: "Hong Kong Version", timecode: "1:36:06" } },
    ]
    expect(postProcessMatches(matches, [], movie)).toEqual([
      { fileInfo: matches[0].fileInfo, renamedFilename: "Dragon Lord (1982) {edition-Hong Kong Version}" },
    ])
  })

  test("passes 'extra' renames through unchanged", () => {
    const matches: FileMatch[] = [
      { kind: "extra", fileInfo: makeFileInfo("clip.mkv"), renamedFilename: "Behind the Scenes -behindthescenes" },
    ]
    expect(postProcessMatches(matches, [], movie)).toEqual([
      { fileInfo: matches[0].fileInfo, renamedFilename: "Behind the Scenes -behindthescenes" },
    ])
  })

  test("leaves unmatched files alone when at least one cut matched (extras list is likely incomplete)", () => {
    const matches: FileMatch[] = [
      { kind: "cut", fileInfo: makeFileInfo("a.mkv"), cut: { name: "Director's Cut", timecode: "1:54:42" } },
      { kind: "unmatched", fileInfo: makeFileInfo("b.mkv") },
    ]
    expect(postProcessMatches(matches, [{ name: "Director's Cut", timecode: "1:54:42" }], movie)).toEqual([
      { fileInfo: matches[0].fileInfo, renamedFilename: "Dragon Lord (1982) {edition-Director's Cut}" },
    ])
  })

  test("renames a single unmatched file as 'Title (Year)' when no cuts matched", () => {
    const matches: FileMatch[] = [
      { kind: "unmatched", fileInfo: makeFileInfo("rip.mkv") },
    ]
    expect(postProcessMatches(matches, [], movie)).toEqual([
      { fileInfo: matches[0].fileInfo, renamedFilename: "Dragon Lord (1982)" },
    ])
  })

  test("uses the sole-named-cut's edition when there's exactly one cut and one unmatched file", () => {
    const matches: FileMatch[] = [
      { kind: "unmatched", fileInfo: makeFileInfo("rip.mkv") },
    ]
    const cuts: Cut[] = [{ name: "Director's Cut", timecode: undefined }]
    expect(postProcessMatches(matches, cuts, movie)).toEqual([
      { fileInfo: matches[0].fileInfo, renamedFilename: "Dragon Lord (1982) {edition-Director's Cut}" },
    ])
  })

  test("falls back to '(1)/(2)' counter prefixes for multiple unmatched files", () => {
    const matches: FileMatch[] = [
      { kind: "unmatched", fileInfo: makeFileInfo("disc1.mkv") },
      { kind: "unmatched", fileInfo: makeFileInfo("disc2.mkv") },
      { kind: "unmatched", fileInfo: makeFileInfo("disc3.mkv") },
    ]
    expect(postProcessMatches(matches, [], movie)).toEqual([
      { fileInfo: matches[0].fileInfo, renamedFilename: "(1) Dragon Lord (1982)" },
      { fileInfo: matches[1].fileInfo, renamedFilename: "(2) Dragon Lord (1982)" },
      { fileInfo: matches[2].fileInfo, renamedFilename: "(3) Dragon Lord (1982)" },
    ])
  })

  test("sorts unmatched files by filename so '(1)/(2)' assignment is deterministic", () => {
    const matches: FileMatch[] = [
      { kind: "unmatched", fileInfo: makeFileInfo("z-disc.mkv") },
      { kind: "unmatched", fileInfo: makeFileInfo("a-disc.mkv") },
    ]
    const result = postProcessMatches(matches, [], movie)
    expect(result.map((rename) => rename.renamedFilename)).toEqual([
      "(1) Dragon Lord (1982)",
      "(2) Dragon Lord (1982)",
    ])
    expect(result[0].fileInfo.filename).toBe("a-disc.mkv")
    expect(result[1].fileInfo.filename).toBe("z-disc.mkv")
  })

  test("leaves unmatched files alone when there's no movie title to apply", () => {
    const matches: FileMatch[] = [
      { kind: "unmatched", fileInfo: makeFileInfo("rip.mkv") },
    ]
    expect(postProcessMatches(matches, [], { title: "", year: "" })).toEqual([])
  })

  test("does NOT pick up the sole-named-cut's edition when multiple unmatched files would all need it (ambiguous)", () => {
    const matches: FileMatch[] = [
      { kind: "unmatched", fileInfo: makeFileInfo("disc1.mkv") },
      { kind: "unmatched", fileInfo: makeFileInfo("disc2.mkv") },
    ]
    const cuts: Cut[] = [{ name: "Director's Cut", timecode: undefined }]
    // Two files claiming the same edition would be wrong — fall back to
    // counter prefixes without an edition tag.
    expect(postProcessMatches(matches, cuts, movie).map((r) => r.renamedFilename)).toEqual([
      "(1) Dragon Lord (1982)",
      "(2) Dragon Lord (1982)",
    ])
  })
})
