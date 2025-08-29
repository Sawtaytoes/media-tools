import {
  spawn,
} from "node:child_process";
import {
  Observable,
} from "rxjs"

import { mkvExtractPath } from "./appPaths.js";
import { catchNamedError } from "./catchNamedError.js"
import { logWarning } from "./logMessage.js";

export const runMkvExtractStdOut = ({
  args,
}: {
  args: string[]
}): (
  Observable<
    string
  >
) => (
  new Observable<
    string
  >((
    observer,
  ) => {
    const commandArgs = (
      args
    )

    console
    .info(
      (
        [mkvExtractPath]
        .concat(
          commandArgs
        )
      ),
      "\n",
    )

    const childProcess = (
      spawn(
        mkvExtractPath,
        commandArgs,
      )
    )

    childProcess
    .stdout
    .on(
      'data',
      (
        data
      ) => {
        observer
        .next(
          data
          .toString()
        )
      },
    )

    childProcess
    .stderr
    .on(
      'data',
      (
        error,
      ) => {
        console
        .error(
          error
          .toString()
        )

        observer
        .error(
          error
        )
      },
    )

    childProcess
    .on(
      'close',
      (
        code,
      ) => {
        if (
          code
          === null
        ) {
          logWarning(
            "mkvextract",
            "Process canceled by user.",
          )

          setTimeout(
            () => {
              process
              .exit()
            },
            500,
          )
        }
      },
    )

    childProcess
    .on(
      'exit',
      () => {
        observer
        .complete()

        process
        .stdin
        .setRawMode(
          false
        )
      },
    )

    process
    .stdin
    .setRawMode(
      true
    )

    process
    .stdin
    .resume()

    process
    .stdin
    .setEncoding(
      'utf8'
    )

    process
    .stdin
    .on(
      'data',
      (
        key,
      ) => {
        // [CTRL][C]
        if (
          (
            key
            .toString()
          )
          === "\u0003"
        ) {
          childProcess
          .kill()
        }

        process
        .stdout
        .write(
          key
          .toString()
        )
      }
    )
  })
  .pipe(
    catchNamedError(
      runMkvExtractStdOut
    ),
  )
)
