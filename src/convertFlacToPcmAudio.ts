import {
  mkdir,
} from "node:fs/promises"
import {
  dirname,
} from "node:path"
import {
  concatMap,
  from,
  map,
  of,
} from "rxjs";

import { addFolderNameBeforeFilename } from "./addFolderNameBeforeFilename.js";
import { AUDIO_CONVERTED_FOLDER_NAME } from "./outputFolderNames.js"
import { runFfmpeg } from "./runFfmpeg.js";

export const convertedPath = AUDIO_CONVERTED_FOLDER_NAME

export type AudioTrackInfo = {
  audioTrackIndex: number
  bitDepth: string
}

export const convertFlacToPcmAudio = ({
  audioTrackInfos,
  filePath,
  outputFolderName = convertedPath,
}: {
  audioTrackInfos: AudioTrackInfo[],
  filePath: string
  outputFolderName?: string
}) => (
  of(
    addFolderNameBeforeFilename({
      filePath,
      folderName: outputFolderName,
    })
  )
  .pipe(
    concatMap((
      outputFilePath,
    ) => (
      from(
        mkdir(
          (
            dirname(
              outputFilePath
            )
          ),
          { recursive: true },
        )
      )
      .pipe(
        map(() => (
          outputFilePath
        )),
      )
    )),
    concatMap((
      outputFilePath,
    ) => (
      runFfmpeg({
        args: [
          "-c",
          "copy",

          "-map",
          "0",

          ...(
            audioTrackInfos
            .flatMap(({
              audioTrackIndex,
              bitDepth,
            }) => ([
              `-c:a:${audioTrackIndex}`,
              `pcm_s${bitDepth}le`,
            ]))
          ),
        ],
        inputFilePaths: [
          filePath
        ],
        outputFilePath,
      })
      .pipe(
        map(() => (
          outputFilePath
        )),
      )
    )),
  )
)
