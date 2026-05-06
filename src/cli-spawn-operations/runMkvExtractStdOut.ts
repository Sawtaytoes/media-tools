import {
  spawn,
} from "node:child_process";
import {
  Observable,
} from "rxjs"

import { mkvExtractPath } from "../tools/appPaths.js";
import { catchNamedError } from "../tools/catchNamedError.js"
import { logWarning } from "../tools/logMessage.js";

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

    // Same shape of bug we fixed in runMkvExtract / getMkvInfo: buffer
    // stderr (mkvextract's "Extracting track …" banners and benign
    // warnings land here) instead of erroring on the first byte;
    // surface only on a real non-zero exit.
    const stderrChunks: string[] = []

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
      (
        code,
      ) => {
        process.stdin.setRawMode(false)

        if (code === 0 || code === null) {
          // code === null is the user-cancel path the 'close' handler resolves;
          // we still want the observable to finish cleanly here.
          observer.complete()
          return
        }
        observer.error(new Error(
          `mkvextract exited with code ${code}`
          + (stderrChunks.length ? `: ${stderrChunks.join('').trim()}` : '')
        ))
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
