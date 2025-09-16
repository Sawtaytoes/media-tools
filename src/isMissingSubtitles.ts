import {
  cpus,
} from "node:os"
import {
  concatAll,
  concatMap,
  filter,
  map,
  mergeAll,
  tap,
} from "rxjs"

import { catchNamedError } from "./catchNamedError.js"
import { filterIsVideoFile } from "./filterIsVideoFile.js"
import {
  getMediaInfo,
  type TextTrack,
} from "./getMediaInfo.js"
import { getFilesAtDepth } from "./getFilesAtDepth.js"

export const isMissingSubtitles = ({
  isRecursive,
  sourcePath,
}: {
  isRecursive: boolean
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
    filterIsVideoFile(),
    map((
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
        concatMap(({
          track,
        }) => (
          track
        )),
        filter((
          track,
        ): track is TextTrack => (
          (
            track
            ["@type"]
          )
          === "Text"
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
    mergeAll(
      cpus()
      .length
    ),
    catchNamedError(
      isMissingSubtitles
    ),
  )
)
