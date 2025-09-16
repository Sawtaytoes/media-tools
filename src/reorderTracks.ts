import {
  concatAll,
  concatMap,
  filter,
  map,
  mergeAll,
  tap,
  toArray,
} from "rxjs"

import { catchNamedError } from "./catchNamedError.js"
import { filterIsVideoFile } from "./filterIsVideoFile.js"
import { getFilesAtDepth } from "./getFilesAtDepth.js"
import { reorderTracksFfmpeg } from "./reorderTracksFfmpeg.js"
import { setOnlyFirstTracksAsDefault } from "./setOnlyFirstTracksAsDefault.js"

export const reorderTracks = ({
  audioTrackIndexes,
  isRecursive,
  sourcePath,
  subtitlesTrackIndexes,
  videoTrackIndexes,
}: {
  audioTrackIndexes: number[]
  isRecursive: boolean
  sourcePath: string
  subtitlesTrackIndexes: number[]
  videoTrackIndexes: number[]
}) => (
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
    tap(() => {
      process
      .exit()
    }),
    catchNamedError(
      reorderTracks
    ),
  )
)
