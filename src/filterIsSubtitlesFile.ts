import { extname } from "node:path"
import { filter } from "rxjs"

import { type FileInfo } from "./getFiles.js"

export const subtitlesFileExtensions = (
  new Set([
    ".ass",
    ".srt",
  ])
)

export const getIsSubtitlesFile = (
  sourceFilePath: string
) => (
  subtitlesFileExtensions
  .has(
    extname(
      sourceFilePath
    )
  )
)

export const filterIsSubtitlesFile = () => (
  filter((
    fileInfo: FileInfo
  ) => (
    getIsSubtitlesFile(
      fileInfo
      .fullPath
    )
  ))
)
