import {
  concatAll,
  concatMap,
  map,
  tap,
  toArray,
} from "rxjs"

import { catchNamedError } from "./catchNamedError.js"
import { filterIsVideoFile } from "./filterIsVideoFile.js"
import { getFilesAtDepth } from "./getFilesAtDepth.js"
import { reorderTracksFfmpeg, reorderTracksFfmpegDefaultProps } from "./reorderTracksFfmpeg.js"
import { setOnlyFirstTracksAsDefault } from "./setOnlyFirstTracksAsDefault.js"

type ReorderTracksRequiredProps = {
  audioTrackIndexes: number[]
  isRecursive: boolean
  sourcePath: string
  subtitlesTrackIndexes: number[]
  videoTrackIndexes: number[]
}

type ReorderTracksOptionalProps = {
  outputFolderName?: string
}

export type ReorderTracksProps = ReorderTracksRequiredProps & ReorderTracksOptionalProps

export const reorderTracksDefaultProps = {
  outputFolderName: reorderTracksFfmpegDefaultProps.outputFolderName,
} satisfies ReorderTracksOptionalProps

export const reorderTracks = ({
  audioTrackIndexes,
  isRecursive,
  outputFolderName = reorderTracksDefaultProps.outputFolderName,
  sourcePath,
  subtitlesTrackIndexes,
  videoTrackIndexes,
}: ReorderTracksProps) => (
  getFilesAtDepth({
    depth: (
      isRecursive
      ? 1
      : 0
    ),
    sourcePath,
  })
  .pipe(
    filterIsVideoFile(),
    map((
      fileInfo,
    ) => (
      (
        reorderTracksFfmpeg({
          audioTrackIndexes,
          filePath: (
            fileInfo
            .fullPath
          ),
          outputFolderName,
          subtitlesTrackIndexes,
          videoTrackIndexes,
        })

        // To do this with `mkvmerge`, tracks need to be numbered sequentially from video to audio to subtitles. It's more complicated and not as easy to replicate.
        // Only use this if something is botched with `ffmpeg`.
        // reorderTracksMkvMerge({
        //   audioTrackIndexes,
        //   filePath: (
        //     fileInfo
        //     .fullPath
        //   ),
        //   subtitlesTrackIndexes,
        //   videoTrackIndexes,
        // })
      )
      .pipe(
        concatMap((
          filePath
        ) => (
          setOnlyFirstTracksAsDefault({
            filePath,
          })
        )),
      )
    )),
    concatAll(),
    toArray(),
    catchNamedError(
      reorderTracks
    ),
  )
)
