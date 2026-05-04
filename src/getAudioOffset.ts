import {
  concatMap,
  map,
  of,
} from "rxjs"

import { AUDIO_OFFSETS_FOLDER_NAME } from "./outputFolderNames.js"
import { runAudioOffsetFinder } from "./runAudioOffsetFinder.js"
import { runFfmpeg } from "./runFfmpeg.js"
import { getOutputPath } from "./getOutputPath.js"
import { makeDirectory } from "./makeDirectory.js"

export const audioOffsetsFolderName = AUDIO_OFFSETS_FOLDER_NAME

export const getAudioOffset = ({
  destinationFilePath,
  outputFolderName = audioOffsetsFolderName,
  sourceFilePath,
}: {
  destinationFilePath: string
  outputFolderName?: string
  sourceFilePath: string
}): (
  ReturnType<typeof runAudioOffsetFinder>
) => (
  of({
    destinationFileOutputPath: (
      getOutputPath({
        fileExtension: ".destination.wav",
        filePath: destinationFilePath,
        folderName: outputFolderName,
      })
    ),
    sourceFileOutputPath: (
      getOutputPath({
        fileExtension: ".source.wav",
        filePath: destinationFilePath,
        folderName: outputFolderName,
      })
    ),
  })
  .pipe(
    concatMap(({
      destinationFileOutputPath,
      sourceFileOutputPath,
    }) => (
      makeDirectory(
        destinationFileOutputPath
      )
      .pipe(
        map(() => ({
          destinationFileOutputPath,
          sourceFileOutputPath,
        })),
      )
    )),
    concatMap(({
      destinationFileOutputPath,
      sourceFileOutputPath,
    }) => (
      runFfmpeg({
        args: [
          "-c:a:0",
          "pcm_s16le",
        ],
        inputFilePaths: [
          sourceFilePath
        ],
        outputFilePath: sourceFileOutputPath,
      })
      .pipe(
        concatMap(() => (
          runFfmpeg({
            args: [
              "-c:a:0",
              "pcm_s16le",
            ],
            inputFilePaths: [
              destinationFilePath
            ],
            outputFilePath: destinationFileOutputPath,
          })
        )),
        map(() => ({
          destinationFileOutputPath,
          sourceFileOutputPath,
        }))
      )
    )),
    concatMap(({
      destinationFileOutputPath,
      sourceFileOutputPath,
    }) => (
      runAudioOffsetFinder({
        destinationFilePath: destinationFileOutputPath,
        sourceFilePath: sourceFileOutputPath,
      })
    )),
  )
)
