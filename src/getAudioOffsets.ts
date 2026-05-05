import {
  concatAll,
  concatMap,
  filter,
  map,
  tap,
  toArray,
} from "rxjs"

import { catchNamedError } from "./catchNamedError.js"
import { getAudioOffset, getAudioOffsetDefaultProps } from "./getAudioOffset.js"
import { getFiles } from "./getFiles.js"
import { logInfo } from "./logMessage.js"

type GetAudioOffsetsRequiredProps = {
  destinationFilesPath: string
  sourceFilesPath: string
}

type GetAudioOffsetsOptionalProps = {
  outputFolderName?: string
}

export type GetAudioOffsetsProps = GetAudioOffsetsRequiredProps & GetAudioOffsetsOptionalProps

export const getAudioOffsetsDefaultProps = {
  outputFolderName: getAudioOffsetDefaultProps.outputFolderName,
} satisfies GetAudioOffsetsOptionalProps

export const getAudioOffsets = ({
  destinationFilesPath,
  outputFolderName = getAudioOffsetsDefaultProps.outputFolderName,
  sourceFilesPath,
}: GetAudioOffsetsProps) => (
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
            outputFolderName,
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
      )
    )),
    catchNamedError(
      getAudioOffsets
    ),
  )
)
