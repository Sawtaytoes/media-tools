import {
  mergeAll,
  mergeMap,
} from "rxjs"

import { logAndSwallow } from "../tools/logAndSwallow.js"
import { getDemoName } from "../tools/getDemoName.js"
import { getMediaInfo } from "../tools/getMediaInfo.js"
import { getFilesAtDepth } from "../tools/getFilesAtDepth.js"

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
    logAndSwallow(
      renameDemos
    )
  )
)
