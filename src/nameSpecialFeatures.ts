import {
  concatAll,
  concatMap,
  ignoreElements,
  map,
  mergeAll,
  mergeMap,
  Observable,
  scan,
  tap,
  toArray,
} from "rxjs"

import { catchNamedError } from "./catchNamedError.js"
import { getSpecialFeatureFromTimecode, TimecodeDeviation } from "./getSpecialFeatureFromTimecode.js"
import {
  convertDurationToDvdCompareTimecode,
  getFileDuration,
} from "./getFileDuration.js"
import { getMediaInfo } from "./getMediaInfo.js"
import { parseSpecialFeatures } from "./parseSpecialFeatures.js"
import { readFilesAtDepth } from "./readFilesAtDepth.js"
import { searchDvdCompare } from "./searchDvdCompare.js"

const getNextFilenameCount = (
  previousCount?: number,
) => (
  (
    previousCount
    || 0
  )
  + 1
)

export const nameSpecialFeatures = ({
  fixedOffset,
  sourcePath,
  timecodePaddingAmount,
  url,
}: (
  {
    sourcePath: string,
    url: string,
  }
  & TimecodeDeviation
)) => (
  searchDvdCompare({
    url,
  })
  .pipe(
    concatMap((
      specialFeatureText,
    ) => (
      parseSpecialFeatures(
        specialFeatureText
      )
    )),
    concatMap((
      specialFeatures,
    ) => (
      readFilesAtDepth({
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
