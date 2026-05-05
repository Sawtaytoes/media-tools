import {
  mkdir,
} from "node:fs/promises"
import {
  dirname,
  extname,
} from "node:path"
import {
  defer,
} from "rxjs"

export const makeDirectory = (
  filePath: string,
) => (
  defer(() => (
    mkdir(
      extname(filePath) ? dirname(filePath) : filePath,
      { recursive: true },
    )
  ))
)
