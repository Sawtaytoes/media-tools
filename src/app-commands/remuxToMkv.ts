import { stat, unlink } from "node:fs/promises"
import { basename, dirname, extname, join } from "node:path"
import {
  concatMap,
  defer,
  filter,
  from,
  map,
  tap,
  type Observable,
} from "rxjs"

import { remuxMkvMerge } from "../cli-spawn-operations/remuxMkvMerge.js"
import { logAndSwallow } from "../tools/logAndSwallow.js"
import { getFilesAtDepth } from "../tools/getFilesAtDepth.js"
import { logInfo } from "../tools/logMessage.js"

// Pass-through container remux for every file in `sourcePath` whose
// extension matches `extensions`. Each match is fed to mkvmerge with no
// track filtering, producing a sibling .mkv. When isSourceDeletedOnSuccess
// is true, the original is removed only after the per-file remux exits 0.
//
// Refuses to clobber a pre-existing same-named .mkv: bails on that file
// (the rest of the directory still processes) so a previous run's output
// can't be silently overwritten.
export const remuxToMkv = ({
  extensions,
  isRecursive,
  isSourceDeletedOnSuccess,
  recursiveDepth,
  sourcePath,
}: {
  extensions: string[],
  isRecursive: boolean,
  isSourceDeletedOnSuccess: boolean,
  recursiveDepth?: number,
  sourcePath: string,
}): Observable<string> => {
  const normalizedExtensions = (
    extensions
    .map((extension) => extension.toLowerCase().replace(/^\./u, ""))
    .filter(Boolean)
  )

  return (
    getFilesAtDepth({
      depth: isRecursive ? (recursiveDepth || 2) : 0,
      sourcePath,
    })
    .pipe(
      filter((fileInfo) => {
        const fileExtension = (
          extname(fileInfo.fullPath)
          .toLowerCase()
          .replace(/^\./u, "")
        )
        return normalizedExtensions.includes(fileExtension)
      }),
      concatMap((fileInfo) => {
        const outputFilePath = join(
          dirname(fileInfo.fullPath),
          `${basename(fileInfo.fullPath, extname(fileInfo.fullPath))}.mkv`,
        )

        return (
          defer(() => (
            stat(outputFilePath)
            .then(
              () => {
                throw new Error(
                  `Refusing to remux ${fileInfo.fullPath}: ${outputFilePath} already exists. Remove it and re-run.`
                )
              },
              (error) => {
                if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
                  throw error
                }
              },
            )
          ))
          .pipe(
            concatMap(() => remuxMkvMerge({ inputFilePath: fileInfo.fullPath })),
            concatMap(({ inputFilePath, outputFilePath: remuxedFilePath }) => {
              if (!isSourceDeletedOnSuccess) {
                return from([remuxedFilePath])
              }
              return (
                defer(() => unlink(inputFilePath))
                .pipe(
                  tap(() => {
                    logInfo("DELETED SOURCE", inputFilePath)
                  }),
                  map(() => remuxedFilePath),
                )
              )
            }),
            logAndSwallow(remuxToMkv),
          )
        )
      }),
    )
  )
}
