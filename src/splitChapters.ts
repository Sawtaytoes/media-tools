import {
  concatAll,
  concatMap,
  filter,
  from,
  map,
  take,
  tap,
  toArray,
} from "rxjs"

import { catchNamedError } from "./catchNamedError.js"
import { filterIsVideoFile } from "./filterIsVideoFile.js"
import { naturalSort } from "./naturalSort.js"
import { getFiles } from "./getFiles.js"
import { splitChaptersMkvMerge } from "./splitChaptersMkvMerge.js"
import { logInfo } from "./logMessage.js"

export const splitChapters = ({
  chapterSplitsList,
  sourcePath,
}: {
  chapterSplitsList: string[]
  sourcePath: string
}) => (
  getFiles({
    sourcePath,
  })
  .pipe(
    toArray(),
    concatMap((
      fileInfos,
    ) => (
      from(
        naturalSort(
          fileInfos
        )
        .by({
          asc: (
            fileInfo,
          ) => (
            fileInfo
            .filename
          ),
        })
      )
      .pipe(
        filterIsVideoFile(),
        take(
          chapterSplitsList
          .length
        ),
        map((
          fileInfo,
          index,
        ) => (
          splitChaptersMkvMerge({
            chapterSplits: (
              chapterSplitsList
              [index]
              .split(" ")
              .join(",")
            ),
            filePath: (
              fileInfo
              .fullPath
            ),
          })
          .pipe(
            tap(() => {
              logInfo(
                "CREATED SUBTITLED FILE",
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
        concatAll(),
        toArray(),
        tap(() => {
          process
          .exit()
        })
      )
    )),
    catchNamedError(
      splitChapters
    ),
  )
)
