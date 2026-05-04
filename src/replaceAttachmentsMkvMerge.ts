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
import { runMkvMerge } from "./runMkvMerge.js";

export const replacedAttachmentsFolderName = "REPLACED-ATTACHMENTS" as const

export const replaceAttachmentsMkvMerge = ({
  destinationFilePath,
  sourceFilePath,
}: {
  destinationFilePath: string
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
                replacedAttachmentsFolderName,
              )
            ),
          )
        )
      })
    )),
  )
)
