import { spawn } from "node:child_process";
import { EOL } from "node:os";
import {
  Observable,
} from "rxjs"

import { audioOffsetFinderPath } from "../tools/appPaths.js";
import { catchNamedError } from "../tools/catchNamedError.js"
import { logWarning } from "../tools/logMessage.js";

export const getOffsetFromAudioOffsetOutput = (
  audioOffsetOutputData: string
) => (
  Math
  .floor(
    Number(
      audioOffsetOutputData
      .replace(
        /Offset: ([-\d\.]+) \(seconds\)/,
        "$1",
      )
      .split(EOL)
      .at(0)!
      .trim()
    )
    * 1000
  )
)

export const runAudioOffsetFinder = ({
  destinationFilePath,
  sourceFilePath,
}: {
  destinationFilePath: string
  sourceFilePath: string
}): (
  Observable<
    number
  >
) => (
  new Observable<
    number
  >((
    observer,
  ) => {
    const commandArgs = [
      "--find-offset-of",
      sourceFilePath,
      "--within",
      destinationFilePath,
    ]

    console
    .info(
      (
        [audioOffsetFinderPath]
        .concat(
          commandArgs
        )
      ),
      "\n",
    )

    const childProcess = (
      spawn(
        audioOffsetFinderPath,
        commandArgs,
      )
    )

    let outputData: string = ""

    const appendOutputData = (
      moreOutputData: string
    ) => {
      outputData = (
        outputData
        .concat(
          moreOutputData
        )
      )
    }

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

        appendOutputData(
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
                "audio-offset-finder",
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

        childProcess.stderr.unpipe()
        childProcess.stderr.destroy()
        childProcess.stdout.unpipe()
        childProcess.stdout.destroy()
        childProcess.stdin.end()
        childProcess.stdin.destroy()

        if (code === 0) {
          observer.next(getOffsetFromAudioOffsetOutput(outputData))
          observer.complete()
          return
        }
        // code === null is the user-cancel path the 'close' handler resolves.
        // Any other non-zero exit is a real failure — attach the captured
        // stderr so consumers see what audio-offset-finder complained about.
        if (code !== null) {
          observer.error(new Error(
            `audio-offset-finder exited with code ${code}`
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
      runAudioOffsetFinder
    ),
  )
)
