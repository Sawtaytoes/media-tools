import {
  mergeAll,
  mergeMap,
} from "rxjs"

import { catchNamedError } from "./catchNamedError.js"
import { getDemoName } from "./getDemoName.js"
import { getMediaInfo } from "./getMediaInfo.js"
import { getFilesAtDepth } from "./getFilesAtDepth.js"

export const renameDemos = ({
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
    mergeMap((
      fileInfo,
    ) => (
      getMediaInfo(
        fileInfo
        .fullPath
      )
      .pipe(
        mergeMap((
          mediaInfo,
        ) => (
          getDemoName({
            filename: (
              fileInfo
              .filename
            ),
            mediaInfo,
          })
        )),
        mergeMap((
          renamedFilename,
        ) => (
          fileInfo
          .renameFile(
            renamedFilename
          )
        )),
      )
    )),
    catchNamedError(
      renameDemos
    )
  )
)
