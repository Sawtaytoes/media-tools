import { copyFile, rm } from "node:fs/promises"
import { extname, join } from "node:path"
import {
  concatMap,
  defer,
  from,
  map,
  tap,
  toArray,
} from "rxjs"

import { catchNamedError } from "../tools/catchNamedError.js"
import { getFiles } from "../tools/getFiles.js"
import { logInfo } from "../tools/logMessage.js"
import { makeDirectory } from "../tools/makeDirectory.js"

// Copies every file in `sourcePath` into `destinationPath`, then removes
// the source directory once all copies succeed. Emits a per-file
// `{ source, destination }` record so the builder's Results panel can
// show a readable "old → new" summary instead of a string of nulls.
export const moveFiles = ({
  destinationPath,
  sourcePath,
}: {
  destinationPath: string
  sourcePath: string
}) => (
  getFiles({ sourcePath })
  .pipe(
    concatMap((fileInfo) => {
      const destinationFilePath = (
        join(
          destinationPath,
          fileInfo.filename.concat(extname(fileInfo.fullPath)),
        )
      )

      return (
        makeDirectory(destinationPath)
        .pipe(
          concatMap(() => copyFile(fileInfo.fullPath, destinationFilePath)),
          tap(() => {
            logInfo("COPIED", fileInfo.fullPath, destinationFilePath)
          }),
          map(() => ({
            source: fileInfo.fullPath,
            destination: destinationFilePath,
          })),
        )
      )
    }),
    // Buffer the per-file move records so the source-dir removal only
    // runs after every copy finished. Re-emit them downstream once rm
    // resolves so callers (and the API job runner) see the full set.
    toArray(),
    concatMap((moves) => (
      defer(() => rm(sourcePath, { recursive: true }))
      .pipe(
        tap(() => {
          logInfo("DELETED", sourcePath)
        }),
        concatMap(() => from(moves)),
      )
    )),
    catchNamedError(moveFiles),
  )
)
