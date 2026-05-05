import {
  concatAll,
  map,
  tap,
  toArray,
} from "rxjs"

import { catchNamedError } from "../tools/catchNamedError.js"
import { filterIsVideoFile } from "../tools/filterIsVideoFile.js"
import { getFilesAtDepth } from "../tools/getFilesAtDepth.js"
import { setOnlyFirstTracksAsDefault } from "../cli-spawn-operations/setOnlyFirstTracksAsDefault.js"

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
    catchNamedError(
      fixIncorrectDefaultTracks
    ),
  )
)
