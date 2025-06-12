import {
  spawn,
} from "node:child_process";
import readline from "node:readline"
import {
  fromEvent,
  Observable,
  takeUntil,
} from "rxjs"

import { ffmpegPath as defaultFfmpegPath } from "./appPaths.js";

export const runCustomFfmpeg = ({
  args,
  envVars,
  ffmpegPath = defaultFfmpegPath,
}: {
  args: string[]
  envVars?: (
    Record<
      string,
      string
    >
  ),
  ffmpegPath?: string
}): (
  Observable<
    string
  >
) => {
  const commandArgs = (
    args
    .filter(
      Boolean
    )
  )

  // console
  // .info(
  //   (
  //     [ffmpegPath]
  //     .concat(
  //       commandArgs
  //     )
  //   ),
  //   "\n",
  // )

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

  // This needs to be here or it won't completely the child process.
  childProcess
  .stderr
  .on(
    "data",
    () => {
      // console.log(data.toString())
    }
  )

  childProcess
  .on(
    "close",
    (
      code,
    ) => {
      if (code !== 0) {
        console
        .error(
          `Child process exited with code ${code}`
        )
      }

    readlineInterface
    .close();
  })

  const readlineInterface = (
    readline
    .createInterface({
      input: (
        childProcess
        .stdout
      ),
      terminal: false,
    })
  )

  return (
    (
      fromEvent(
        readlineInterface,
        "line",
      ) as (
        Observable<
          string
        >
      )
    )
    .pipe(
      takeUntil(
        fromEvent(
          childProcess,
          "close"
        )
      ),
    )
  )
}
