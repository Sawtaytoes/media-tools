import {
  concatMap,
  defaultIfEmpty,
  map,
  mergeAll,
  mergeMap,
  Observable,
  of,
  scan,
  switchMap,
  tap,
  throwError,
  toArray,
} from "rxjs"

import { canonicalizeMovieTitle, type MovieIdentity } from "../tools/canonicalizeMovieTitle.js"
import { catchNamedError } from "../tools/catchNamedError.js"
import {
  getIsSimilarTimecode,
  getSpecialFeatureFromTimecode,
  type TimecodeDeviation,
} from "../tools/getSpecialFeatureFromTimecode.js"
import {
  convertDurationToDvdCompareTimecode,
  getFileDuration,
} from "../tools/getFileDuration.js"
import { getMediaInfo } from "../tools/getMediaInfo.js"
import {
  parseSpecialFeatures,
  type Cut,
} from "../tools/parseSpecialFeatures.js"
import { getFilesAtDepth } from "../tools/getFilesAtDepth.js"
import {
  displayDvdCompareVariant,
  findDvdCompareResults,
  searchDvdCompare,
} from "../tools/searchDvdCompare.js"
import { getUserSearchInput } from "../tools/getUserSearchInput.js"
import type { FileInfo } from "../tools/getFiles.js"

const getNextFilenameCount = (
  previousCount?: number,
) => (
  (
    previousCount
    || 0
  )
  + 1
)

const DVDCOMPARE_FILM_BASE = "https://www.dvdcompare.net/comparisons/film.php?fid="

// Plex (and most filesystems) reject these characters; replace with safe
// ASCII fallbacks so the resulting names stay readable rather than just
// stripping characters and leaving awkward gaps.
const sanitizeFilenameSegment = (name: string): string => (
  name
  .replace(/:/gu, " -")
  .replace(/\?/gu, "")
  .replace(/"/gu, "'")
  .replace(/[\\/|*<>]/gu, "")
  .replace(/[\x00-\x1f]/gu, "")
  .trim()
)

export const buildMovieBaseName = (movie: MovieIdentity): string => {
  const title = sanitizeFilenameSegment(movie.title)
  const yearPart = movie.year ? ` (${movie.year})` : ""
  return `${title}${yearPart}`
}

export const buildMovieFeatureName = (movie: MovieIdentity, cutName: string): string => {
  const editionPart = cutName ? ` {edition-${sanitizeFilenameSegment(cutName)}}` : ""
  return `${buildMovieBaseName(movie)}${editionPart}`
}

const resolveUrl = ({
  dvdCompareId,
  dvdCompareReleaseHash,
  searchTerm,
  url,
}: {
  dvdCompareId?: number,
  dvdCompareReleaseHash?: number,
  searchTerm?: string,
  url?: string,
}): Observable<string> => {
  if (url) return of(url)

  const hash = dvdCompareReleaseHash ?? 1

  if (dvdCompareId != null) return of(`${DVDCOMPARE_FILM_BASE}${dvdCompareId}#${hash}`)

  if (searchTerm) {
    return (
      findDvdCompareResults(searchTerm)
      .pipe(
        switchMap((results) => {
          if (results.length === 0) {
            throw new Error(`No DVDCompare results found for: ${searchTerm}`)
          }

          return (
            getUserSearchInput({
              message: `Search results for "${searchTerm}":`,
              options: [
                ...results
                .map((result, index) => ({
                  index,
                  label: `${result.baseTitle}${result.variant !== "DVD" ? ` (${displayDvdCompareVariant(result.variant)})` : ""}${result.year ? ` (${result.year})` : ""}`,
                })),
                {
                  index: -1,
                  label: "Cancel / skip",
                },
              ],
            })
            .pipe(
              map((selectedIndex) => {
                if (selectedIndex === -1) return undefined

                return results.at(selectedIndex)
              }),
              tap((result) => {
                if (!result) throw new Error("No result selected.")
              }),
              map((result) => `${DVDCOMPARE_FILM_BASE}${result!.id}#${hash}`),
            )
          )
        }),
      )
    )
  }

  return throwError(() => new Error("Provide url, dvdCompareId, or searchTerm."))
}

// Per-file match outcome. The post-processor walks the buffered list of
// these and assigns final renamedFilenames, including the (1)/(2) prefix
// fallback for unmatched files when no cut matched anything.
export type FileMatch =
  | { fileInfo: FileInfo, kind: "cut", cut: Cut }
  | { fileInfo: FileInfo, kind: "extra", renamedFilename: string }
  | { fileInfo: FileInfo, kind: "unmatched" }

export const findMatchingCut = (
  cuts: Cut[],
  fileTimecode: string,
  deviation: TimecodeDeviation,
): Cut | null => (
  cuts.find((cut) => (
    cut.timecode != null
    && getIsSimilarTimecode(fileTimecode, cut.timecode, deviation)
  )) ?? null
)

// Produces the final {fileInfo, renamedFilename} pairs, applying movie
// naming to unmatched files when (and only when) no cut matched anything
// by timecode. The user's rule: if some cuts matched, the remaining
// unmatched files are likely unrelated extras DVDCompare didn't list, and
// renaming them as the main feature would be wrong.
export const postProcessMatches = (
  matches: FileMatch[],
  cuts: Cut[],
  movie: MovieIdentity,
): { fileInfo: FileInfo, renamedFilename: string }[] => {
  const renames: { fileInfo: FileInfo, renamedFilename: string }[] = []
  const unmatched: FileMatch[] = []
  let anyCutMatched = false

  matches.forEach((match) => {
    if (match.kind === "cut") {
      anyCutMatched = true
      renames.push({
        fileInfo: match.fileInfo,
        renamedFilename: buildMovieFeatureName(movie, match.cut.name),
      })
      return
    }
    if (match.kind === "extra") {
      renames.push({
        fileInfo: match.fileInfo,
        renamedFilename: match.renamedFilename,
      })
      return
    }
    unmatched.push(match)
  })

  // Some cuts matched by timecode → the unmatched files probably aren't
  // main-feature candidates (DVDCompare's extras list might just be
  // incomplete). Leave them alone, same as today's behavior.
  if (anyCutMatched) return renames

  // No cuts matched. Movie name not derivable means we can't rename
  // unmatched files as main features; leave them alone.
  if (!movie.title) return renames

  // Sort unmatched files by filename so the (1)/(2) suffixes are stable
  // across runs.
  unmatched.sort((a, b) => a.fileInfo.filename.localeCompare(b.fileInfo.filename))

  if (unmatched.length === 0) return renames

  if (unmatched.length === 1) {
    // Single unmatched file → it's the movie. Use the sole-named-cut's
    // edition when DVDCompare published one (e.g. "Director's Cut"
    // without a timecode), else just `Title (Year)`.
    const soleNamedCut = cuts.length === 1 && cuts[0]?.name ? cuts[0] : null
    renames.push({
      fileInfo: unmatched[0].fileInfo,
      renamedFilename: buildMovieFeatureName(movie, soleNamedCut?.name ?? ""),
    })
    return renames
  }

  // Multiple unmatched files, no timecode-driven disambiguation → label
  // each as "(1) Title (Year)", "(2) Title (Year)", … so the user can
  // tell at a glance they're the movie even if which-is-which is
  // ambiguous.
  const baseName = buildMovieBaseName(movie)
  unmatched.forEach((match, index) => {
    renames.push({
      fileInfo: match.fileInfo,
      renamedFilename: `(${index + 1}) ${baseName}`,
    })
  })
  return renames
}

export const nameSpecialFeatures = ({
  dvdCompareId,
  dvdCompareReleaseHash,
  fixedOffset,
  searchTerm,
  sourcePath,
  timecodePaddingAmount,
  url,
}: (
  {
    dvdCompareId?: number,
    dvdCompareReleaseHash?: number,
    searchTerm?: string,
    sourcePath: string,
    url?: string,
  }
  & TimecodeDeviation
)) => {
  const deviation: TimecodeDeviation = { fixedOffset, timecodePaddingAmount }

  return (
    resolveUrl({ dvdCompareId, dvdCompareReleaseHash, searchTerm, url })
    .pipe(
      concatMap((resolvedUrl) => searchDvdCompare({ url: resolvedUrl })),
      // Resolve everything that depends on the scrape result (parsed
      // extras+cuts, canonical movie identity) before walking files.
      concatMap((scrape) => (
        parseSpecialFeatures(scrape.extras)
        .pipe(
          mergeMap(({ extras, cuts }) => (
            (
              scrape.filmTitle
              ? canonicalizeMovieTitle({
                  dvdCompareBaseTitle: scrape.filmTitle.baseTitle,
                  dvdCompareYear: scrape.filmTitle.year,
                })
              : of<MovieIdentity>({ title: "", year: "" })
            )
            .pipe(
              map((movie) => ({ extras, cuts, movie })),
            )
          )),
        )
      )),
      concatMap(({ extras: specialFeatures, cuts, movie }) => (
        getFilesAtDepth({ depth: 0, sourcePath })
        .pipe(
          mergeMap((fileInfo) => (
            getMediaInfo(fileInfo.fullPath)
            .pipe(
              mergeMap((mediaInfo) => getFileDuration({ mediaInfo })),
              map((duration) => ({
                fileInfo,
                timecode: convertDurationToDvdCompareTimecode(duration),
              })),
            )
          )),
          // Per-file match: cut first (timecode-deterministic), then
          // extras (existing matcher with user prompts on ambiguity),
          // else 'unmatched' for the post-processor to decide on.
          concatMap(({ fileInfo, timecode }): Observable<FileMatch> => {
            const matchedCut = findMatchingCut(cuts, timecode, deviation)
            if (matchedCut) {
              return of({ fileInfo, kind: "cut", cut: matchedCut })
            }
            const unmatchedFallback: FileMatch = { fileInfo, kind: "unmatched" }
            return (
              getSpecialFeatureFromTimecode({
                filename: fileInfo.filename,
                fixedOffset,
                specialFeatures,
                timecode,
                timecodePaddingAmount,
              })
              .pipe(
                map((renamedFilename): FileMatch => ({
                  fileInfo,
                  kind: "extra",
                  renamedFilename,
                })),
                defaultIfEmpty(unmatchedFallback),
              )
            )
          }),
          // Buffer every per-file match so the post-processor can apply
          // the (1)/(2) main-feature fallback after seeing the full set.
          toArray(),
          concatMap((matches: FileMatch[]) => (
            of(...postProcessMatches(matches, cuts, movie))
          )),
          // Existing duplicate-counter logic — handles same-name
          // collisions across renames (e.g. multiple "Trailer" extras).
          scan(
            (
              { previousFilenameCount },
              { fileInfo, renamedFilename },
            ) => ({
              previousFilenameCount: {
                ...previousFilenameCount,
                [renamedFilename]: getNextFilenameCount(
                  previousFilenameCount[renamedFilename],
                ),
              },
              renameFileObservable: (
                fileInfo.renameFile(
                  renamedFilename in previousFilenameCount
                  ? `(${getNextFilenameCount(previousFilenameCount[renamedFilename])}) ${renamedFilename}`
                  : renamedFilename,
                )
              ),
            }),
            {
              previousFilenameCount: {} as Record<string, number>,
              renameFileObservable: new Observable() as Observable<void>,
            },
          ),
          map(({ renameFileObservable }) => renameFileObservable),
        )
      )),
      // Wait till all renames are figured out before doing any renaming.
      toArray(),
      // Unfold the array.
      mergeAll(),
      // Rename everything by calling the mapped function.
      mergeAll(),
      catchNamedError(nameSpecialFeatures),
    )
  )
}
