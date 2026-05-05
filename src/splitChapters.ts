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
import { logInfo } from "./logMessage.js"
import { splitChaptersMkvMerge, splitChaptersMkvMergeDefaultProps } from "./splitChaptersMkvMerge.js"

type SplitChaptersRequiredProps = {
  chapterSplitsList: string[]
  sourcePath: string
}

type SplitChaptersOptionalProps = {
  outputFolderName?: string
}

export type SplitChaptersProps = SplitChaptersRequiredProps & SplitChaptersOptionalProps

export const splitChaptersDefaultProps = {
  outputFolderName: splitChaptersMkvMergeDefaultProps.outputFolderName,
} satisfies SplitChaptersOptionalProps

export const splitChapters = ({
  chapterSplitsList,
  outputFolderName = splitChaptersDefaultProps.outputFolderName,
  sourcePath,
}: SplitChaptersProps) => (
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
            outputFolderName,
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
      )
    )),
    catchNamedError(
      splitChapters
    ),
  )
)
