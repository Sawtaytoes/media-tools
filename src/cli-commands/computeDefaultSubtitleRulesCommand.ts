import type { Argv, CommandBuilder, CommandModule } from "yargs"

import { computeDefaultSubtitleRules } from "../app-commands/computeDefaultSubtitleRules.js"
import { subscribeCli } from "../tools/subscribeCli.js"

type InferArgvOptions<T> = T extends Argv<infer U> ? U : never

const builder = (yargs: Argv) => (
  yargs
  .example(
    "$0 computeDefaultSubtitleRules \"/path/to/series\"",
    "Read every .ass file in the directory and print the default rule set the modifySubtitleMetadata heuristic would apply.",
  )
  .positional(
    "sourcePath",
    {
      demandOption: true,
      describe: "Directory containing .ass subtitle files.",
      type: "string",
    },
  )
  .option(
    "isRecursive",
    {
      alias: "r",
      boolean: true,
      default: false,
      describe: "Recursively scan subdirectories.",
      nargs: 0,
      type: "boolean",
    },
  )
  .option(
    "recursiveDepth",
    {
      default: 0,
      describe: "Maximum recursion depth when --isRecursive is set (0 = default depth of 2).",
      type: "number",
    },
  )
)

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const computeDefaultSubtitleRulesCommand: CommandModule<{}, Args> = {
  command: "computeDefaultSubtitleRules <sourcePath>",
  describe: "Compute the default ASS modification rule set from .ass file metadata. Used as an upstream step that feeds modifySubtitleMetadata.",

  builder: builder as CommandBuilder<{}, Args>,

  handler: (argv) => {
    computeDefaultSubtitleRules({
      isRecursive: argv.isRecursive,
      recursiveDepth: argv.recursiveDepth,
      sourcePath: argv.sourcePath,
    })
    .subscribe(subscribeCli())
  },
}
