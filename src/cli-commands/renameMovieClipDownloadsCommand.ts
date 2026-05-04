import type { Argv, CommandBuilder, CommandModule } from "yargs"

import { renameMovieClipDownloads } from "../renameMovieClipDownloads.js"

type InferArgvOptions<T> = T extends Argv<infer U> ? U : never

const builder = (yargs: Argv) => (
  yargs
  .example(
    "$0 renameMovieClipDownloads \"~/movie-demos\"",
    "Renames all video files in '~/movie-demos' based the demo format for renaming with other commands.",
  )
  .positional(
    "sourcePath",
    {
      demandOption: true,
      describe: "Directory where downloaded movie demos are located.",
      type: "string",
    },
  )
)

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const renameMovieClipDownloadsCommand: CommandModule<{}, Args> = {
  command: "renameMovieClipDownloads <sourcePath>",
  describe: "Rename TomSawyer's movie rips from the AVSForums to follow the demo format.",

  builder: builder as CommandBuilder<{}, Args>,

  handler: (argv) => {
    renameMovieClipDownloads({
      sourcePath: (
        argv
        .sourcePath
      ),
    })
    .subscribe(() => {
      console
      .timeEnd(
        "Command Runtime"
      )
    })
  },
}
