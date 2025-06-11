import {
  spawn,
} from "node:child_process";
import { extname } from "node:path";
import {
  concatMap,
  from,
  mergeMap,
  reduce,
  Observable,
} from "rxjs"

import { ffmpegPath as defaultFfmpegPath } from "./appPaths.js";
import { catchNamedError } from "./catchNamedError.js"
import { getFileDuration } from "./getFileDuration.js";
import { getMediaInfo } from "./getMediaInfo.js";
import { logWarning } from "./logMessage.js";

export const runFfmpegNullOutput = ({
  args,
  envVars,
  ffmpegPath = defaultFfmpegPath,
  inputFilePaths,
}: {
  args: string[]
  envVars?: (
    Record<
      string,
      string
    >
  ),
  ffmpegPath?: string
  inputFilePaths: string[]
}): (
  Observable<
    string
  >
) => (
  from(
    inputFilePaths
  )
  .pipe(
    mergeMap((
      inputFilePath,
    ) => (
      getMediaInfo(
        inputFilePath
      )
      .pipe(
        mergeMap((
          mediaInfo,
        ) => (
          getFileDuration({
            mediaInfo,
          })
        )),
      )
    )),
    reduce(
      (
        longestDuration,
        duration,
      ) => (
        (
          duration
          > longestDuration
        )
        ? duration
        : longestDuration
      ),
      0,
    ),
    concatMap((
      duration,
    ) => (
      new Observable<
        string
      >((
        observer,
      ) => {
        const commandArgs = (
          [
            "-hide_banner",

            "-loglevel",
            "info",

            "-y",

            "-stats",

            // "-hwaccel",
            // "none", // Do we need this?

            ...(
              inputFilePaths
              .filter((
                inputFilePath,
              ) => (
                (
                  extname(
                    inputFilePath
                  )
                )
                !== ".xml"
              ))
              .flatMap((
                inputFilePath,
              ) => ([
                "-i",
                inputFilePath,
              ]))
            ),

            ...args,
          ]
          .filter(
            Boolean
          )
        )

        console
        .info(
          (
            [ffmpegPath]
            .concat(
              commandArgs
            )
          ),
          "\n",
        )

        const childProcess = (
          spawn(
            ffmpegPath,
            commandArgs,
            {
              env: {
              ...process.env,
              ...envVars,
              },
            },
          )
        )

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
            dataBuffer,
          ) => {
            const data = (
              dataBuffer
              .toString()
            )

            observer
            .next(
              data
            )

            // console
            // .info(
            //   data
            // )
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
                "ffmpeg",
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

            childProcess
            .stderr
            .unpipe()

            childProcess
            .stderr
            .destroy()

            childProcess
            .stdout
            .unpipe()

            childProcess
            .stdout
            .destroy()

            childProcess
            .stdin
            .end()

            childProcess
            .stdin
            .destroy()
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
            inputBuffer,
          ) => {
            const key = (
              inputBuffer
              .toString()
            )

            // [CTRL][C]
            if (
              key
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
              )
            }
          }
        )
      })
  )),
    catchNamedError(
      runFfmpegNullOutput
    ),
  )
)
