import {
  concatMap,
  map,
  of,
} from "rxjs"

import { runAudioOffsetFinder } from "./runAudioOffsetFinder.js"
import { runFfmpeg } from "./runFfmpeg.js"
import { getOutputPath } from "./getOutputPath.js"
import { makeDirectory } from "./makeDirectory.js"

export const audioOffsetsFolderName = "AUDIO-OFFSETS" as const

export const getAudioOffset = ({
  destinationFilePath,
  sourceFilePath,
}: {
  destinationFilePath: string
  sourceFilePath: string
}): (
  ReturnType<typeof runAudioOffsetFinder>
) => (
  of({
    destinationFileOutputPath: (
      getOutputPath({
        fileExtension: ".destination.wav",
        filePath: destinationFilePath,
        folderName: audioOffsetsFolderName,
      })
    ),
    sourceFileOutputPath: (
      getOutputPath({
        fileExtension: ".source.wav",
        filePath: destinationFilePath,
        folderName: audioOffsetsFolderName,
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
