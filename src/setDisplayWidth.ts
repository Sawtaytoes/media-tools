import {
  concatAll,
  concatMap,
  tap,
  toArray,
} from "rxjs"

import { catchNamedError } from "./catchNamedError.js"
import { getFilesAtDepth } from "./getFilesAtDepth.js"
import { setDisplayWidthMkvPropEdit } from "./setDisplayWidthMkvPropEdit.js"
import { logInfo } from "./logMessage.js"

export const setDisplayWidth = ({
  displayWidth,
  isRecursive,
  recursiveDepth,
  sourcePath,
}: {
  displayWidth: number
  isRecursive: boolean
  recursiveDepth: number
  sourcePath: string
}) => (
  getFilesAtDepth({
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
    toArray(),
    concatAll(),
    concatMap((
      fileInfo,
    ) => (
      setDisplayWidthMkvPropEdit({
        displayWidth,
        filePath: (
          fileInfo
          .fullPath
        ),
      })
      .pipe(
        tap((
          outputFilePath,
        ) => {
          logInfo(
            "SET DISPLAY WIDTH IN FILE",
            outputFilePath,
          )
        }),
      )
    )),
    toArray(),
    tap(() => {
      process
      .exit()
    }),
    catchNamedError(
      setDisplayWidth
    ),
  )
)
