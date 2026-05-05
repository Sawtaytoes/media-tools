import {
  concatAll,
  concatMap,
  filter,
  map,
  tap,
  toArray,
} from "rxjs"

import { catchNamedError } from "../tools/catchNamedError.js"
import { getFiles } from "../tools/getFiles.js"
import { logInfo } from "../tools/logMessage.js"
import { replaceAttachmentsMkvMerge, replaceAttachmentsMkvMergeDefaultProps } from "../cli-spawn-operations/replaceAttachmentsMkvMerge.js"

type ReplaceAttachmentsRequiredProps = {
  destinationFilesPath: string
  sourceFilesPath: string
}

type ReplaceAttachmentsOptionalProps = {
  outputFolderName?: string
}

export type ReplaceAttachmentsProps = ReplaceAttachmentsRequiredProps & ReplaceAttachmentsOptionalProps

export const replaceAttachmentsDefaultProps = {
  outputFolderName: replaceAttachmentsMkvMergeDefaultProps.outputFolderName,
} satisfies ReplaceAttachmentsOptionalProps

export const replaceAttachments = ({
  destinationFilesPath,
  outputFolderName = replaceAttachmentsDefaultProps.outputFolderName,
  sourceFilesPath,
}: ReplaceAttachmentsProps) => (
  getFiles({
    sourcePath: (
      sourceFilesPath
    ),
  })
  .pipe(
    toArray(),
    concatMap((
      mediaFiles,
    ) => (
      getFiles({
        sourcePath: (
          destinationFilesPath
        ),
      })
      .pipe(
        map((
          mediaFileInfo,
        ) => ({
          destinationFilePath: (
            mediaFileInfo
            .fullPath
          ),
          mediaFileInfo,
          mediaFilePath: (
            (
              mediaFiles
              .find((
                subtitlesFileInfo,
              ) => (
                (
                  subtitlesFileInfo
                  .filename
                )
                === (
                  mediaFileInfo
                  .filename
                )
              ))
              ?.fullPath
            )
            || ""
          ),
        })),
        filter(({
          mediaFilePath,
        }) => (
          Boolean(
            mediaFilePath
          )
        )),
        map(({
          destinationFilePath,
          mediaFileInfo,
          mediaFilePath,
        }) => (
          replaceAttachmentsMkvMerge({
            destinationFilePath,
            outputFolderName,
            sourceFilePath: mediaFilePath,
          })
          .pipe(
            tap(() => {
              logInfo(
                "CREATED FILE WITH ATTACHMENTS",
                (
                  mediaFileInfo
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
      replaceAttachments
    ),
  )
)
