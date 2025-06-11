import {
  concatAll,
  concatMap,
  filter,
  from,
  map,
  mergeAll,
  reduce,
  tap,
} from "rxjs"

import { catchNamedError } from "./catchNamedError.js"
import { filterIsVideoFile } from "./filterIsVideoFile.js"
import { readFilesAtDepth } from "./readFilesAtDepth.js"
import { runFfmpeg } from "./runFfmpeg.js"
import { getCropData } from "./getCropData.js"
import { getMediaInfo, VideoTrack } from "./getMediaInfo.js"

export const storeCropData = ({
  isRecursive,
  recursiveDepth,
  sourcePath,
}: {
  isRecursive: boolean
  recursiveDepth: number
  sourcePath: string
}) => (
  readFilesAtDepth({
    depth: (
      isRecursive
      ? (
        recursiveDepth
        || 1
      )
      : 0
    ),
    sourcePath,
  })
  .pipe(
    filterIsVideoFile(),
    map((
      fileInfo,
    ) => (
      from(
        getMediaInfo(
          fileInfo
          .fullPath
        ),
      )
      .pipe(
        filter(
          Boolean
        ),
        map(({
          media,
        }) => (
          media
        )),
        filter(
          Boolean
        ),
        concatMap(({
          track,
        }) => (
          track
        )),
        filter((
          track,
        ): track is VideoTrack => (
          (
            track
            ["@type"]
          )
          === "Video"
        )),
        map(({
          "HDR_Format_Compatibility": hdrFormatCompatibility,
          // "HDR_Format": hdrFormat,
          "transfer_characteristics": transferCharacteristics,
        }) => (
          Boolean(
            (
              transferCharacteristics
              === "PQ"
            )
            || (
              transferCharacteristics
              ?.includes('HLG')
            )
            || (
              hdrFormatCompatibility
              === 'HDR10'
            )
            || (
              hdrFormatCompatibility
              ?.endsWith('HDR10')
            )
          )
        )),
        concatMap((
          isHdr,
        ) => (
          getCropData({
            filePath: (
              fileInfo
              .fullPath
            ),
            isHdr,
          })
        )),
        filter(
          Boolean
        ),
        tap((
          cropData,
        ) => {
          console
          .info(
            (
              fileInfo
              .fullPath
            ),
            cropData,
          )
        }),
      )
    )),
    concatAll(),
    catchNamedError(
      storeCropData
    ),
  )
)
