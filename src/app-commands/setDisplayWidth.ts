import {
  concatAll,
  concatMap,
  tap,
  toArray,
} from "rxjs"

import { logAndSwallow } from "../tools/logAndSwallow.js"
import { getFilesAtDepth } from "../tools/getFilesAtDepth.js"
import { setDisplayWidthMkvPropEdit } from "../cli-spawn-operations/setDisplayWidthMkvPropEdit.js"
import { logInfo } from "../tools/logMessage.js"

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
    logAndSwallow(
      setDisplayWidth
    ),
  )
)
