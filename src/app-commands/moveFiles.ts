import { rm } from "node:fs/promises"
import {
  concatMap,
  defer,
  tap,
  toArray,
} from "rxjs"

import { catchNamedError } from "../tools/catchNamedError.js"
import { copyFiles } from "./copyFiles.js"
import { logInfo } from "../tools/logMessage.js"

export const moveFiles = ({
  destinationPath,
  sourcePath,
}: {
  destinationPath: string
  sourcePath: string
}) => (
  copyFiles({
    destinationPath,
    sourcePath,
  })
  .pipe(
    toArray(),
    concatMap(() => (
      defer(() => (
        rm(
          sourcePath,
          { recursive: true },
        )
      ))
      .pipe(
        tap(() => {
          logInfo(
            "DELETED",
            sourcePath,
          )
        }),
      )
    )),
    catchNamedError(
      moveFiles
    ),
  )
)
