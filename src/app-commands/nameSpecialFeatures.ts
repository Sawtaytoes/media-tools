import {
  concatMap,
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

import { catchNamedError } from "../tools/catchNamedError.js"
import { getSpecialFeatureFromTimecode, TimecodeDeviation } from "../tools/getSpecialFeatureFromTimecode.js"
import {
  convertDurationToDvdCompareTimecode,
  getFileDuration,
} from "../tools/getFileDuration.js"
import { getMediaInfo } from "../tools/getMediaInfo.js"
import { parseSpecialFeatures } from "../tools/parseSpecialFeatures.js"
import { getFilesAtDepth } from "../tools/getFilesAtDepth.js"
import { displayDvdCompareVariant, findDvdCompareResults, searchDvdCompare } from "../tools/searchDvdCompare.js"
import { getUserSearchInput } from "../tools/getUserSearchInput.js"

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
)) => (
  resolveUrl({ dvdCompareId, dvdCompareReleaseHash, searchTerm, url })
  .pipe(
    concatMap((resolvedUrl) => (
      searchDvdCompare({ url: resolvedUrl })
    )),
    // The scraper now returns { extras, filmTitle }. Until the cuts/movie-
    // naming branches land (E.2/E.4), we still only consume the extras
    // text the same way the old single-string return drove this pipeline.
    concatMap(({ extras }) => (
      parseSpecialFeatures(extras)
    )),
    concatMap((
      specialFeatures,
    ) => (
      getFilesAtDepth({
        depth: 0,
        sourcePath,
      })
      .pipe(
        mergeMap((
          fileInfo,
        ) => (
          getMediaInfo(
            fileInfo
            .fullPath
          )
          .pipe(
            mergeMap((
              mediaInfo,
            ) => (
              getFileDuration({
                mediaInfo,
              })
            )),
            map((
              duration,
            ) => ({
              fileInfo,
              timecode: (
                convertDurationToDvdCompareTimecode(
                  duration
                )
              ),
            })),
          )
        )),
        concatMap(({
          fileInfo,
          timecode,
        }) => (
          getSpecialFeatureFromTimecode({
            filename: (
              fileInfo
              .filename
            ),
            fixedOffset,
            specialFeatures,
            timecode,
            timecodePaddingAmount,
          })
          .pipe(
            map((
              renamedFilename,
            ) => ({
              fileInfo,
              renamedFilename,
            }))
          )
        )),
        scan(
          (
            {
              previousFilenameCount,
            },
            {
              fileInfo,
              renamedFilename,
            },
          ) => ({
            previousFilenameCount: {
              ...previousFilenameCount,
              [renamedFilename]: (
                getNextFilenameCount(
                  previousFilenameCount
                  [renamedFilename]
                )
              )
            },
            renameFileObservable: (
              fileInfo
              .renameFile(
                (
                  renamedFilename in (
                    previousFilenameCount
                  )
                )
                ? (
                  "("
                  .concat(
                    (
                      String(
                        getNextFilenameCount(
                          previousFilenameCount
                          [renamedFilename]
                        )
                      )
                    ),
                    ") ",
                    renamedFilename
                  )
                )
                : renamedFilename
              )
            ),
          }),
          {
            previousFilenameCount: {} as (
              Record<
                string,
                number
              >
            ),
            renameFileObservable: (
              new Observable()
            ) as (
              Observable<
                void
              >
            ),
          },
        ),
        map(({
          renameFileObservable
        }) => (
          renameFileObservable
        )),
      )
    )),

    // Wait till all renames are figured out before doing any renaming.
    toArray(),

    // Unfold the array.
    mergeAll(),

    // Rename everything by calling the mapped function.
    mergeAll(),

    catchNamedError(
      nameSpecialFeatures
    )
  )
)
