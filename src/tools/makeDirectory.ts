import {
  mkdir,
} from "node:fs/promises"
import {
  dirname,
} from "node:path"
import {
  defer,
} from "rxjs";

export const makeDirectory = (
  filePath: string,
) => (
  defer(() => (
    mkdir(
      (
        dirname(
          filePath
        )
      ),
      { recursive: true },
    )
  ))
)
