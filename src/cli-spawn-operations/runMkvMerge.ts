import colors from "ansi-colors"
import cliProgress from "cli-progress"
import {
  spawn,
} from "node:child_process";
import {
  unlink,
} from "node:fs/promises"
import {
  Observable,
} from "rxjs"

import { mkvMergePath } from "../tools/appPaths.js";
import { catchNamedError } from "../tools/catchNamedError.js"
import { logWarning } from "../tools/logMessage.js";

const cliProgressBar = (
  new cliProgress
  .SingleBar({
    format: (
      "Progress |"
      .concat(
        (
          colors
          .cyan(
            "{bar}"
          )
        ),
        "| {percentage}%",
      )
    ),
    barCompleteChar: "\u2588",
    barIncompleteChar: "\u2591",
    hideCursor: true,
  })
)

const progressRegex = (
  /Progress: (\d+)%/
)

export const runMkvMerge = ({
  args,
  outputFilePath,
}: {
  args: string[]
  outputFilePath: string
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
    const commandArgs = [
      "--output",
      outputFilePath,

      ...args
    ]

    console
    .info(
      (
        [mkvMergePath]
        .concat(
          commandArgs
        )
      ),
      "\n",
    )

    const childProcess = (
      spawn(
        mkvMergePath,
        commandArgs,
      )
    )

    let hasStarted = false

    childProcess
    .stdout
    .on(
      'data',
      (
        data
      ) => {
        if (
          data
          .toString()
          .startsWith(
            "Progress:"
          )
        ) {
          if (
            !hasStarted
          ) {
            hasStarted = true

            cliProgressBar
            .start(
              100,
              Number(
                data
                .toString()
                .replace(
                  progressRegex,
                  "$1",
                )
              ),
              {},
            )
          }
          else {
            cliProgressBar
            .update(
              Number(
                data
                .toString()
                .replace(
                  progressRegex,
                  "$1",
                )
              )
            )
          }
        }
        else {
          console
          .info(
            data
            .toString()
          )
        }
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
        (
          (
            code
            === null
          )
          ? (
            unlink(
              outputFilePath
            )
            .then(() => {
              logWarning(
                "mkvmerge",
                "Process canceled by user.",
              )

              setTimeout(
                () => {
                  process
                  .exit()
                },
                500,
              )
            })
          )
          : (
            Promise
            .resolve()
          )
        )
      },
    )

    childProcess
    .on(
      'exit',
      (
        code,
      ) => {
        if (
          code
          === 0
        ) {
          observer
          .next(
            outputFilePath
          )
        }

        observer
        .complete()

        cliProgressBar
        .stop()

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
        else {
          process
          .stdout
          .write(
            key
            .toString()
          )
        }
      }
    )
  })
  .pipe(
    catchNamedError(
      runMkvMerge
    ),
  )
)
