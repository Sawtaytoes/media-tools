import { readFile, writeFile } from "node:fs/promises"
import { extname } from "node:path"
import {
  concatAll,
  concatMap,
  defer,
  filter,
  map,
  tap,
  toArray,
} from "rxjs"

import { type AssModificationRule } from "../tools/assTypes.js"
import { applyAssRules } from "../tools/applyAssRules.js"
import { catchNamedError } from "../tools/catchNamedError.js"
import { getFilesAtDepth } from "../tools/getFilesAtDepth.js"
import { logInfo } from "../tools/logMessage.js"
import { parseAssFile, serializeAssFile } from "../tools/assFileTools.js"

type ModifySubtitleMetadataRequiredProps = {
  isRecursive: boolean
  rules: AssModificationRule[]
  sourcePath: string
}

type ModifySubtitleMetadataOptionalProps = {
  recursiveDepth?: number
}

export type ModifySubtitleMetadataProps = (
  ModifySubtitleMetadataRequiredProps
  & ModifySubtitleMetadataOptionalProps
)

export const modifySubtitleMetadata = ({
  isRecursive,
  recursiveDepth,
  rules,
  sourcePath,
}: ModifySubtitleMetadataProps) => (
  getFilesAtDepth({
    depth: (
      isRecursive
      ? (recursiveDepth || 2)
      : 0
    ),
    sourcePath,
  })
  .pipe(
    filter((fileInfo) => (
      extname(fileInfo.fullPath).toLowerCase() === ".ass"
    )),
    map((fileInfo) => (
      defer(() => (
        readFile(
          fileInfo.fullPath,
          "utf-8",
        )
      ))
      .pipe(
        map((content) => (
          serializeAssFile(
            applyAssRules(
              parseAssFile(content),
              rules,
            )
          )
        )),
        concatMap((updatedContent) => (
          writeFile(
            fileInfo.fullPath,
            updatedContent,
            "utf-8",
          )
        )),
        tap(() => {
          logInfo(
            "MODIFIED SUBTITLE METADATA",
            fileInfo.fullPath,
          )
        }),
      )
    )),
    concatAll(),
    toArray(),
    catchNamedError(modifySubtitleMetadata),
  )
)
