import {
  dirname,
  join,
} from "node:path"

import { runMkvMerge } from "./runMkvMerge.js";

export const splitsFolderName = "SPLITS" as const

export const splitChaptersMkvMerge = ({
  chapterSplits,
  filePath,
}: {
  chapterSplits: string,
  filePath: string,
}) => (
  runMkvMerge({
    args: [
      "--split",
      `chapters:${chapterSplits}`,

      filePath,
    ],
    outputFilePath: (
      filePath
      .replace(
        (
          dirname(
            filePath
          )
        ),
        (
          join(
            (
              dirname(
                filePath
              )
            ),
            splitsFolderName,
          )
        ),
      )
    )
  })
)
