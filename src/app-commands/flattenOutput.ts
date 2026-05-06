import { copyFile, rm } from "node:fs/promises"
import { basename, dirname, join } from "node:path"
import {
  concatMap,
  defer,
  map,
  tap,
  toArray,
  type Observable,
} from "rxjs"

import { catchNamedError } from "../tools/catchNamedError.js"
import { getFiles } from "../tools/getFiles.js"
import { logInfo } from "../tools/logMessage.js"

// Copies every file in `sourcePath` up one level into its parent directory,
// overwriting any same-named originals, and then deletes `sourcePath`.
//
// Use case: chained operations like mergeTracks output to <work>/SUBTITLED.
// Without this command, chaining another step that also has an outputFolderName
// produces <work>/SUBTITLED/REORDERED, and so on — folder nesting accumulates.
// Running flattenOutput between steps flattens the structure: <work> always
// holds the latest cumulative result.
export const flattenOutput = ({
  sourcePath,
}: {
  sourcePath: string,
}): Observable<string> => {
  const targetParentPath = dirname(sourcePath)

  return (
    getFiles({ sourcePath })
    .pipe(
      concatMap((fileInfo) => {
        const targetPath = join(targetParentPath, basename(fileInfo.fullPath))
        return (
          defer(() => copyFile(fileInfo.fullPath, targetPath))
          .pipe(
            tap(() => {
              logInfo("COPIED BACK", fileInfo.fullPath, targetPath)
            }),
            map(() => targetPath),
          )
        )
      }),
      toArray(),
      concatMap(() => (
        defer(() => rm(sourcePath, { recursive: true }))
        .pipe(
          tap(() => {
            logInfo("REMOVED OUTPUT FOLDER", sourcePath)
          }),
          map(() => sourcePath),
        )
      )),
      catchNamedError(flattenOutput),
    )
  )
}
