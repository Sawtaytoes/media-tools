import type { Argv, CommandBuilder, CommandModule } from "yargs"

import { mergeTracks } from "../mergeTracks.js"

type InferArgvOptions<T> = T extends Argv<infer U> ? U : never

const builder = (yargs: Argv) => (
  yargs
  .example(
    "$0 mergeTracks \"G:\\Anime\\Code Geass Subs\" \"G:\\Anime\\Code Geass\"",
    "Adds subtitles to all media files with a corresponding folder in the subs folder that shares the exact same name (minus the extension).",
  )
  .positional(
    "subtitlesPath",
    {
      demandOption: true,
      describe: "Directory containing subdirectories with subtitle files and `attachments/` that match the name of the media files in `mediaFilesPath`.",
      type: "string",
    },
  )
  .positional(
    "mediaFilesPath",
    {
      demandOption: true,
      describe: "Directory with media files that need subtitles.",
      type: "string",
    },
  )
  .positional(
    "offsets",
    {
      array: true,
      default: [] satisfies number[],
      demandOption: false,
      describe: "Space-separated list of time-alignment offsets to set for each individual file in milliseconds.",
      type: "number",
    },
  )
  .option(
    "automaticOffset",
    {
      alias: "a",
      default: false,
      describe: "Calculate subtitle offsets for each file using differences in chapter markers.",
      nargs: 0,
      type: "boolean",
    },
  )
  .option(
    "globalOffset",
    {
      alias: "o",
      default: 0,
      describe: "The offset in milliseconds to apply to all audio being transferred.",
      nargs: 1,
      number: true,
      type: "number",
    },
  )
  .option(
    "includeChapters",
    {
      alias: "c",
      default: false,
      describe: "Adds chapters along with other tracks.",
      nargs: 0,
      type: "boolean",
    },
  )
)

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const mergeTracksCommand: CommandModule<{}, Args> = {
  command: "mergeTracks <subtitlesPath> <mediaFilesPath> [offsets...]",
  describe: "Merge subtitles files with media files and only keep specified languages.",

  builder: builder as CommandBuilder<{}, Args>,

  handler: (argv) => {
    mergeTracks({
      globalOffsetInMilliseconds: (
        argv
        .globalOffset
      ),
      hasAutomaticOffset: (
        argv
        .automaticOffset
      ),
      hasChapters: (
        argv
        .includeChapters
      ),
      mediaFilesPath: (
        argv
        .mediaFilesPath
      ),
      offsetsInMilliseconds: (
        argv
        .offsets
      ),
      subtitlesPath: (
        argv
        .subtitlesPath
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
