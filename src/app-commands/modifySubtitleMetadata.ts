import { readFile, writeFile } from "node:fs/promises"
import { extname } from "node:path"
import {
  concatAll,
  concatMap,
  defer,
  EMPTY,
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
}: ModifySubtitleMetadataProps) => {
  // No-op fast path so the YAML pipeline can always include a
  // modifySubtitleMetadata step. The conditional 'do we have rules to
  // apply?' decision lives in whatever produces the rules array (e.g.
  // computeDefaultSubtitleRules) — not in branching encoded in the
  // sequence YAML.
  if (!rules || rules.length === 0) {
    logInfo("MODIFY SUBTITLE METADATA", "No rules provided — skipping (no-op).")
    return EMPTY
  }

  return (
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
}
