import {
  concatAll,
  concatMap,
  filter,
  map,
  tap,
  toArray,
} from "rxjs"

import { catchNamedError } from "./catchNamedError.js"
import { getFiles } from "./getFiles.js"
import { replaceAttachmentsMkvMerge } from "./replaceAttachmentsMkvMerge.js"
import { logInfo } from "./logMessage.js"

export const replaceAttachments = ({
  destinationFilesPath,
  sourceFilesPath,
}: {
  destinationFilesPath: string
  sourceFilesPath: string
}) => (
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
        tap(() => {
          process
          .exit()
        })
      )
    )),
    catchNamedError(
      replaceAttachments
    ),
  )
)
