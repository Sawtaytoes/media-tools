import {
  spawn,
} from "node:child_process";
import {
  Observable,
} from "rxjs"

import { mkvPropEditPath } from "../tools/appPaths.js";
import { catchNamedError } from "../tools/catchNamedError.js"
import { logWarning } from "../tools/logMessage.js";

export const runMkvPropEdit = ({
  args,
  filePath,
}: {
  args: string[]
  filePath: string
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
      filePath,
      ...args
    ]

    console
    .info(
      (
        [mkvPropEditPath]
        .concat(
          commandArgs
        )
      ),
      "\n",
    )

    const childProcess = (
      spawn(
        mkvPropEditPath,
        commandArgs,
      )
    )

    // Same shape of bug we fixed in runMkvExtract / getMkvInfo: buffer
    // stderr instead of erroring on the first byte; surface only on a
    // real non-zero exit.
    const stderrChunks: string[] = []

    childProcess
    .stdout
    .on(
      'data',
      (
        data
      ) => {
        console
        .info(
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
            Promise
            .resolve()
            .then(() => {
              logWarning(
                "mkvpropedit",
                "Process canceled by user.",
              )

              return (
                Promise
                .reject()
                .finally(() => {
                  setTimeout(
                    () => {
                      process
                      .exit()
                    },
                    500,
                  )
                })
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
        process.stdin.setRawMode(false)

        if (code === 0) {
          observer.next(filePath)
          observer.complete()
          return
        }
        // code === null is the user-cancel path the 'close' handler resolves.
        // Any other non-zero exit is a real failure — attach the captured
        // stderr so consumers see what mkvpropedit complained about.
        if (code !== null) {
          observer.error(new Error(
            `mkvpropedit exited with code ${code}`
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

        process
        .stdout
        .write(
          key
        )
      }
    )
  })
  .pipe(
    catchNamedError(
      runMkvPropEdit
    ),
  )
)
