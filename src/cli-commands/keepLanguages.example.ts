/**
 * Example: extracting a yargs command into its own file.
 *
 * The key is a `builder` function typed as `(yargs: Argv) => Argv<Args>`.
 * TypeScript infers the handler's `argv` type from `builder`'s return type,
 * so you get full type safety without manually duplicating the arg types.
 *
 * In cli.ts, replace the inline .command(...) block with:
 *
 *   import { keepLanguagesCommand } from "./cli-commands/keepLanguages.js"
 *   yargs(...).command(keepLanguagesCommand).command(...).strict().argv
 *
 * The chaining still type-checks because CommandModule is covariant —
 * adding commands does not change the inferred type of the chain.
 */

import type { Argv, CommandModule } from "yargs"

import {
  iso6392LanguageCodes,
  type Iso6392LanguageCode,
} from "../iso6392LanguageCodes.js"
import { keepLanguages } from "../keepLanguages.js"

// ---- builder (typed separately so the handler can derive argv's type) ------

const builder = (
  yargs: Argv,
) => (
  yargs
  .example(
    "$0 keepLanguages \"~/anime\" -r --audio-lang jpn --subs-lang eng",
    "Keeps Japanese audio and English subtitles, removing all other tracks.",
  )
  .positional(
    "sourcePath",
    {
      demandOption: true,
      describe: "Directory containing media files.",
      type: "string",
    },
  )
  .option(
    "audioLanguages",
    {
      alias: "audio-lang",
      array: true,
      choices: iso6392LanguageCodes,
      default: [] as Iso6392LanguageCode[],
      describe: "Audio languages to keep (ISO 639-2 codes).",
      type: "array",
    },
  )
  .option(
    "isRecursive",
    {
      alias: "r",
      boolean: true,
      default: false,
      describe: "Recursively search subdirectories.",
      nargs: 0,
      type: "boolean",
    },
  )
  .option(
    "subtitlesLanguages",
    {
      alias: "subs-lang",
      array: true,
      choices: iso6392LanguageCodes,
      default: [] as Iso6392LanguageCode[],
      describe: "Subtitle languages to keep (ISO 639-2 codes).",
      type: "array",
    },
  )
  .option(
    "useFirstAudioLanguage",
    {
      alias: "firstAudio",
      boolean: true,
      default: false,
      describe: "Also keep the language of the first audio track.",
      nargs: 0,
      type: "boolean",
    },
  )
  .option(
    "useFirstSubtitlesLanguage",
    {
      alias: "firstSubtitles",
      boolean: true,
      default: false,
      describe: "Also keep the language of the first subtitles track.",
      nargs: 0,
      type: "boolean",
    },
  )
)

type Args = Awaited<ReturnType<typeof builder>>["argv"]

// ---- command module ---------------------------------------------------------

export const keepLanguagesCommand: CommandModule<object, Args> = {
  command: "keepLanguages <sourcePath>",
  describe: "Keeps only the specified audio and subtitle languages.",

  builder,

  handler: (
    argv,
  ) => {
    keepLanguages({
      audioLanguages: (
        argv
        .audioLanguages
      ),
      hasFirstAudioLanguage: (
        argv
        .useFirstAudioLanguage
      ),
      hasFirstSubtitlesLanguage: (
        argv
        .useFirstSubtitlesLanguage
      ),
      isRecursive: (
        argv
        .isRecursive
      ),
      sourcePath: (
        argv
        .sourcePath
      ),
      subtitlesLanguages: (
        argv
        .subtitlesLanguages
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
