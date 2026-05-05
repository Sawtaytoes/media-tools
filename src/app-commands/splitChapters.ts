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

import { catchNamedError } from "../tools/catchNamedError.js"
import { filterIsVideoFile } from "../tools/filterIsVideoFile.js"
import { naturalSort } from "../tools/naturalSort.js"
import { getFiles } from "../tools/getFiles.js"
import { logInfo } from "../tools/logMessage.js"
import { splitChaptersMkvMerge, splitChaptersMkvMergeDefaultProps } from "../cli-spawn-operations/splitChaptersMkvMerge.js"

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
