import {
  dirname,
  join,
} from "node:path"
import {
  concatAll,
  concatMap,
  filter,
  ignoreElements,
  map,
  pairwise,
  scan,
  take,
  tap,
  toArray,
} from "rxjs"

import { catchNamedError } from "./catchNamedError.js"
import { filterIsVideoFile } from "./filterIsVideoFile.js"
import { FALLBACK_TIMECODE, getChapters } from "./getChapters.js"
import { insertIntoArray } from "./insertIntoArray.js"
import { logInfo } from "./logMessage.js"
import { mergeMediaFiles } from "./mergeMediaFiles.js"
import { readFiles } from "./readFiles.js"
import { segmentSplitsFolderName, splitSegmentFfmpeg } from "./splitChaptersFfmpeg.js"
import { getChaptersOld } from "./getChapters-old.js"

export const FALLBACK_INTRO_FILENAME = "merge-intro.mkv"
export const FALLBACK_OUTRO_FILENAME = "merge-outro.mkv"

export const mergeOrderedChapters = ({
  insertIntroAtIndex,
  insertOutroAtIndex,
  introFilename = FALLBACK_INTRO_FILENAME,
  outroFilename = FALLBACK_OUTRO_FILENAME,
  sourcePath,
}: {
  insertIntroAtIndex: number,
  insertOutroAtIndex: number,
  introFilename?: string
  outroFilename?: string
  sourcePath: string
}) => (
  readFiles({
    sourcePath,
  })
  .pipe(
    filterIsVideoFile(),
    filter((
      fileInfo,
    ) => (
      (
        (
          fileInfo
          .filename
        )
        !== introFilename
      )
      && (
        (
          fileInfo
          .filename
        )
        !== outroFilename
      )
    )),
    map((
      fileInfo,
    ) => (
      // ------------- OLD START
      // getChaptersOld(
      //   fileInfo
      //   .fullPath
      // )
      // ------------- OLD END
      // ------------- NEW START
      getChapters(
        fileInfo
        .fullPath
      )
      // ------------- NEW END
      .pipe(
        // ------------- OLD START
        // pairwise(),
        // map(([
        //   startChapter,
        //   endChapter,
        // ]) => ({
        //   endTimecode: (
        //     endChapter
        //     .timecode
        //   ),
        //   startTimecode: (
        //     startChapter
        //     .timecode
        //   ),
        // })),
        // ------------- OLD END

        // ------------- NORMAL START
        scan(
          (
            {
              hasInitialTimecode
            },
            {
              endTimecode,
              startTimecode,
            },
          ) => (
            (
              hasInitialTimecode
              && (
                startTimecode
                === FALLBACK_TIMECODE
              )
            )
            ? {
              endTimecode: FALLBACK_TIMECODE,
              hasInitialTimecode,
              startTimecode: FALLBACK_TIMECODE,
            }
            : {
              endTimecode,
              hasInitialTimecode: (
                hasInitialTimecode
                || (
                  startTimecode
                  === FALLBACK_TIMECODE
                )
              ),
              startTimecode,
            }
          ),
          {
            endTimecode: FALLBACK_TIMECODE,
            hasInitialTimecode: false,
            startTimecode: FALLBACK_TIMECODE,
          } as {
            endTimecode: string,
            hasInitialTimecode: boolean,
            startTimecode: string,
          },
        ),
        filter(({
          endTimecode,
        }) => (
          endTimecode
          !== FALLBACK_TIMECODE
        )),
        concatMap((
          {
            endTimecode,
            startTimecode,
          },
          index,
        ) => (
          splitSegmentFfmpeg({
            endTimecode,
            filePath: (
              fileInfo
              .fullPath
            ),
            segmentId: (
              String(
                index
              )
            ),
            startTimecode,
          })
          .pipe(
            tap(() => {
              logInfo(
                "CHAPTERS SPLIT",
                (
                  fileInfo
                  .fullPath
                ),
              )
            }),
            filter(
              Boolean
            ),
          )
        )),
        // ------------- NORMAL END

        // ------------- TEMP START
        // take(1),
        // concatMap(() => (
        //   readFiles({
        //     sourcePath: (
        //       join(
        //         (
        //           dirname(
        //             fileInfo
        //             .fullPath
        //           )
        //         ),
        //         segmentSplitsFolderName,
        //       )
        //     ),
        //   })
        //   .pipe(
        //     map((
        //       fileInfo
        //     ) => (
        //       fileInfo
        //       .fullPath
        //     )),
        //   )
        // )),
        // ------------- TEMP END

        toArray(),
        map((
          segmentFilePaths,
        ) => ({
          introOutroDirectory: (
            dirname(
              fileInfo
              .fullPath
            )
          ),
          segmentFilePaths,
        })),
        concatMap(({
          introOutroDirectory,
          segmentFilePaths,
        }) => (
          mergeMediaFiles({
            filePaths: (
              [
                {
                  chapterNumber: insertIntroAtIndex,
                  filename: introFilename,
                },
                {
                  chapterNumber: insertOutroAtIndex,
                  filename: outroFilename,
                },
              ]
              .reduce(
                (
                  filePaths,
                  {
                    chapterNumber,
                    filename,
                  },
                ) => (
                  insertIntoArray({
                    array: filePaths,
                    index: (
                      chapterNumber
                      - 1
                    ),
                    value: (
                      join(
                        introOutroDirectory,
                        filename,
                      )
                    ),
                  })
                ),
                segmentFilePaths,
              )
            ),
            originalFilePath: (
              fileInfo
              .fullPath
            ),
          })
        )),
        tap(t => { console.log(t) }),
      )
    )),
    concatAll(),
    toArray(),
    tap(() => {
      process
      .exit()
    }),
    catchNamedError(
      mergeOrderedChapters
    ),
  )
)
