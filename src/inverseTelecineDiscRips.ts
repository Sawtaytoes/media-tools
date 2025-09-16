import {
  concatAll,
  concatMap,
  map,
  of,
  tap,
  toArray,
} from "rxjs"

import { catchNamedError } from "./catchNamedError.js"
import { convertVariableToConstantBitrate } from "./convertVariableToConstantBitrate.js"
import { filterIsVideoFile } from "./filterIsVideoFile.js"
import {
  inverseTelecineVideo,
  type Pulldown,
  type VideoEncoder,
} from "./inverseTelecineVideo.js"
import { getFilesAtDepth } from "./getFilesAtDepth.js"

/**
 * @experimental This doesn't work correctly and will probably be removed in the future unless something different than ffmpeg is used.
 */
export const inverseTelecineDiscRips = ({
  isConstantBitrate,
  isRecursive,
  sourcePath,
  pulldown,
  videoEncoder,
}: {
  isConstantBitrate: boolean
  isRecursive: boolean
  sourcePath: string
  pulldown: Pulldown,
  videoEncoder: VideoEncoder,
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
        isConstantBitrate
        ? (
          of(
            fileInfo
            .fullPath
          )
        )
        : (
          // DVDs have variable framerate, so you first need to set it to Constant in the video track before performing an inverse telecine.
          convertVariableToConstantBitrate({
            filePath: (
              fileInfo
              .fullPath
            ),
            framesPerSecond: "24000/1001",
          })
        )
      )
      .pipe(
        concatMap((
          filePath,
        ) => (
          inverseTelecineVideo({
            filePath,
            pulldown,
            videoEncoder,
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
      inverseTelecineDiscRips
    ),
  )
)
