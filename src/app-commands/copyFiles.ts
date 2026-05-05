import { copyFile } from "node:fs/promises"
import { join } from "node:path"
import {
  concatMap,
  defer,
  map,
  tap,
} from "rxjs"

import { catchNamedError } from "../tools/catchNamedError.js"
import { getFiles } from "../tools/getFiles.js"
import { logInfo } from "../tools/logMessage.js"
import { makeDirectory } from "../tools/makeDirectory.js"

export const copyFiles = ({
  destinationPath,
  sourcePath,
}: {
  destinationPath: string
  sourcePath: string
}) => (
  getFiles({
    sourcePath,
  })
  .pipe(
    concatMap((
      fileInfo,
    ) => {
      const targetPath = (
        join(
          destinationPath,
          (
            fileInfo
            .filename
          ),
        )
      )

      return (
        defer(() => (
          makeDirectory(
            destinationPath
          )
        ))
        .pipe(
          concatMap(() => (
            copyFile(
              fileInfo
              .fullPath,
              targetPath,
            )
          )),
          tap(() => {
            logInfo(
              "COPIED",
              fileInfo
              .fullPath,
              targetPath,
            )
          }),
          map(() => (
            targetPath
          )),
        )
      )
    }),
    catchNamedError(
      copyFiles
    ),
  )
)
