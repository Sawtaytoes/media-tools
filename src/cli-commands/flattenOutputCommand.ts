import type { Argv, CommandBuilder, CommandModule } from "yargs"

import { flattenOutput } from "../app-commands/flattenOutput.js"
import { subscribeCli } from "../tools/subscribeCli.js"

type InferArgvOptions<T> = T extends Argv<infer U> ? U : never

const builder = (yargs: Argv) => (
  yargs
  .example(
    "$0 flattenOutput \"/work/SUBTITLED\"",
    "Copies every file in /work/SUBTITLED back into /work, overwriting originals, then removes the SUBTITLED folder.",
  )
  .positional(
    "sourcePath",
    {
      demandOption: true,
      describe: "Output folder produced by a previous step (e.g. /work/SUBTITLED). Its contents are copied up one level into its parent and then the folder is deleted.",
      type: "string",
    },
  )
)

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const flattenOutputCommand: CommandModule<{}, Args> = {
  command: "flattenOutput <sourcePath>",
  describe: "Flatten a chained operation's output: copy files from sourcePath up one level (overwriting originals) and remove sourcePath. Prevents folder nesting from accumulating across chained steps that each have an outputFolderName.",

  builder: builder as CommandBuilder<{}, Args>,

  handler: (argv) => {
    flattenOutput({
      sourcePath: argv.sourcePath,
    })
    .subscribe(subscribeCli())
  },
}
