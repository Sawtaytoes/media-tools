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
    // Same shape of bug we fixed in runMkvExtract / getMkvInfo: mkvmerge
    // can write informational lines to stderr (warnings on weird-but-valid
    // containers, codec advisories, etc.). Erroring on the first stderr
    // byte tore the SSE stream / sequence runner down mid-job — buffer
    // here, surface only on non-zero exit.
    const stderrChunks: string[] = []

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
        chunk,
      ) => {
        const text = chunk.toString()
        stderrChunks.push(text)
        console.info(text)
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
        cliProgressBar.stop()
        process.stdin.setRawMode(false)

        if (code === 0) {
          observer.next(outputFilePath)
          observer.complete()
          return
        }
        // code === null is the user-cancel path the 'close' handler resolves.
        // Any other non-zero exit is a real failure — attach the captured
        // stderr so consumers see what mkvmerge complained about.
        if (code !== null) {
          observer.error(new Error(
            `mkvmerge exited with code ${code}`
            + (stderrChunks.length ? `: ${stderrChunks.join('').trim()}` : '')
          ))
        }
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
