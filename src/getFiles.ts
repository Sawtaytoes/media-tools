import {
  readdir,
  stat,
} from "node:fs/promises"
import { join } from "node:path"
import {
  concatAll,
  concatMap,
  defer,
  filter,
  from,
  map,
  OperatorFunction,
  type Observable,
} from "rxjs"

import { createRenameFileOrFolderObservable, getLastItemInFilePath } from "./createRenameFileOrFolder.js"
import { logPipelineError } from "./logPipelineError.js"

export type FileInfo = {
  filename: (
    string
  ),
  fullPath: (
    string
  ),
  renameFile: (
    renamedFilename: string,
  ) => (
    Observable<
      void
    >
  )
}

export const filterFileAtPath = <
  PipelineValue
>(
  getFullPath: (
    pipelineValue: PipelineValue
  ) => string
): (
  OperatorFunction<
    PipelineValue,
    PipelineValue
  >
) => (
  concatMap((
    pipelineValue,
  ) => (
    from(
      stat(
        getFullPath(
          pipelineValue
        )
      )
    )
    .pipe(
      filter((
        stats
      ) => (
        stats
        .isFile()
      )),
      map(() => (
        pipelineValue
      )),
    )
  ))
)

export const getFiles = ({
  sourcePath,
}: {
  sourcePath: string,
}): (
  Observable<
    FileInfo
  >
) => (
  defer(() => (
    readdir(
      sourcePath
    )
  ))
  .pipe(
    concatAll(),
    map((
      filePath,
    ) => ({
      filename: (
        getLastItemInFilePath(
          filePath
        )
      ),
      fullPath: (
        join(
          sourcePath,
          filePath,
        )
      ),
    })),
    filterFileAtPath(({
      fullPath
    }) => (
      fullPath
    )),
    map(({
      filename,
      fullPath,
    }) => ({
      filename,
      fullPath,
      renameFile: (
        createRenameFileOrFolderObservable({
          fullPath,
          sourcePath,
        })
      ),
    } satisfies (
      FileInfo
    ) as (
      FileInfo
    ))),
    logPipelineError(
      getFiles
    ),
  )
)
