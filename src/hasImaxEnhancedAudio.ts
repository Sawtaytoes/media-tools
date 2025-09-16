import {
  EMPTY,
  filter,
  map,
  mergeAll,
  mergeMap,
  of,
  tap,
} from "rxjs"

import { catchNamedError } from "./catchNamedError.js"
import { getMediaInfo } from "./getMediaInfo.js"
import { getFilesAtDepth } from "./getFilesAtDepth.js"

export const hasImaxEnhancedAudio = ({
  isRecursive,
  sourcePath,
}: {
  isRecursive: boolean,
  sourcePath: string
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
    mergeMap((
      fileInfo,
    ) => (
      getMediaInfo(
        fileInfo
        .fullPath
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
        mergeMap(({
          track,
        }) => (
          track
        )),
        mergeMap((
          track,
        ) => (
          (
            (
              track
              ["@type"]
            )
            === "Audio"
          )
          ? (
            of(
              track
            )
          )
          : EMPTY
        )),
        filter(({
          "Format_AdditionalFeatures": additionalFeatures,
        }) => (
          additionalFeatures
          === "XLL X IMAX"
        )),
        tap(() => {
          console
          .info(
            fileInfo
            .filename
          )
        }),
      )
    )),
    catchNamedError(
      hasImaxEnhancedAudio
    ),
  )
)
