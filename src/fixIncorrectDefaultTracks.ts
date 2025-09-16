import {
  concatAll,
  map,
  tap,
  toArray,
} from "rxjs"

import { catchNamedError } from "./catchNamedError.js"
import { filterIsVideoFile } from "./filterIsVideoFile.js"
import { getFilesAtDepth } from "./getFilesAtDepth.js"
import { setOnlyFirstTracksAsDefault } from "./setOnlyFirstTracksAsDefault.js"

export const fixIncorrectDefaultTracks = ({
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
      setOnlyFirstTracksAsDefault({
        filePath: (
          fileInfo
          .fullPath
        )
      })
    )),
    concatAll(),
    toArray(),
    tap(() => {
      process
      .exit()
    }),
    catchNamedError(
      fixIncorrectDefaultTracks
    ),
  )
)
