import {
  concatAll,
  concatMap,
  filter,
  map,
  tap,
  toArray,
} from "rxjs"

import { catchNamedError } from "./catchNamedError.js"
import { getAudioOffset } from "./getAudioOffset.js"
import { getFiles } from "./getFiles.js"
import { logInfo } from "./logMessage.js"

export const getAudioOffsets = ({
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
      sourceFileInfos,
    ) => (
      getFiles({
        sourcePath: (
          destinationFilesPath
        ),
      })
      .pipe(
        map((
          destinationFileInfo,
        ) => ({
          destinationFilePath: (
            destinationFileInfo
            .fullPath
          ),
          sourceFilePath: (
            (
              sourceFileInfos
              .find((
                sourceFileInfo,
              ) => (
                (
                  sourceFileInfo
                  .filename
                )
                === (
                  destinationFileInfo
                  .filename
                )
              ))
              ?.fullPath
            )
            || ""
          ),
        })),
        filter(({
          sourceFilePath,
        }) => (
          Boolean(
            sourceFilePath
          )
        )),
        concatMap((
          {
            destinationFilePath,
            sourceFilePath,
          },
        ) => (
          getAudioOffset({
            destinationFilePath,
            sourceFilePath,
          })
          .pipe(
            map((
              offsetInMilliseconds,
            ) => ({
              destinationFilePath,
              offsetInMilliseconds,
              sourceFilePath,
            })),
          )
        )),
        toArray(),
        concatAll(),
        tap(({
          destinationFilePath,
          offsetInMilliseconds,
          sourceFilePath,
        }) => {
          logInfo(
            "OFFSET IN MILLISECONDS",
            offsetInMilliseconds,
            sourceFilePath,
            destinationFilePath,
          )
        }),
        toArray(),
        tap(() => {
          process
          .exit()
        })
      )
    )),
    catchNamedError(
      getAudioOffsets
    ),
  )
)
