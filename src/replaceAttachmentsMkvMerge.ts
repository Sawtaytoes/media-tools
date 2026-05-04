import {
  dirname,
  join,
} from "node:path"
import {
  concatMap,
  endWith,
  filter,
  of,
} from "rxjs";

import { getIsVideoFile } from "./filterIsVideoFile.js";
import { REPLACED_ATTACHMENTS_FOLDER_NAME } from "./outputFolderNames.js"
import { runMkvMerge } from "./runMkvMerge.js";

export const replacedAttachmentsFolderName = REPLACED_ATTACHMENTS_FOLDER_NAME

export const replaceAttachmentsMkvMerge = ({
  destinationFilePath,
  outputFolderName = replacedAttachmentsFolderName,
  sourceFilePath,
}: {
  destinationFilePath: string
  outputFolderName?: string
  sourceFilePath: string
}) => (
  of(
    getIsVideoFile(
      sourceFilePath,
    )
  )
  .pipe(
    filter(
      Boolean
    ),
    // This would normally go to the next step in the pipeline, but there are sometimes no "und" language tracks, so we need to utilize this `endWith` to continue in the event the `filter` stopped us.
    endWith(
      null
    ),
    concatMap(() => (
      runMkvMerge({
        args: [
          "--no-audio",
          "--no-buttons",
          "--no-chapters",
          "--no-global-tags",
          "--no-subtitles",
          "--no-track-tags",
          "--no-video",

          sourceFilePath,

          destinationFilePath,
        ],
        outputFilePath: (
          destinationFilePath
          .replace(
            (
              dirname(
                destinationFilePath
              )
            ),
            (
              join(
                (
                  dirname(
                    destinationFilePath
                  )
                ),
                outputFolderName,
              )
            ),
          )
        )
      })
    )),
  )
)
