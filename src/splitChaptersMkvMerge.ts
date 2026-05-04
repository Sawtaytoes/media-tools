import {
  dirname,
  join,
} from "node:path"

import { SPLITS_FOLDER_NAME } from "./outputFolderNames.js"
import { runMkvMerge } from "./runMkvMerge.js";

export const splitsFolderName = SPLITS_FOLDER_NAME

export const splitChaptersMkvMerge = ({
  chapterSplits,
  filePath,
  outputFolderName = splitsFolderName,
}: {
  chapterSplits: string,
  filePath: string,
  outputFolderName?: string,
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
            outputFolderName,
          )
        ),
      )
    )
  })
)
