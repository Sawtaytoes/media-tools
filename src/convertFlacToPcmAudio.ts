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
import { runFfmpeg } from "./runFfmpeg.js";

export const convertedPath = "AUDIO-CONVERTED" as const

export type AudioTrackInfo = {
  audioTrackIndex: number
  bitDepth: string
}

export const convertFlacToPcmAudio = ({
  audioTrackInfos,
  filePath,
}: {
  audioTrackInfos: AudioTrackInfo[],
  filePath: string
}) => (
  of(
    addFolderNameBeforeFilename({
      filePath,
      folderName: convertedPath,
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
