import type { Argv, CommandBuilder, CommandModule } from "yargs"

import { nameMovies } from "../app-commands/nameMovies.js"
import { subscribeCli } from "../tools/subscribeCli.js"

type InferArgvOptions<T> = T extends Argv<infer U> ? U : never

const builder = (yargs: Argv) => (
  yargs
  .example(
    "$0 nameMovies \"/path/to/movie/folder\" --movieDbId 27205",
    "Rename every video file in the folder to Plex's `Title (Year).mkv` format using TMDB metadata.",
  )
  .example(
    "$0 nameMovies \"/path/to/movie/folder\" --movieDbId 9504 --editionLabel \"Director's Cut\"",
    "Same, with an explicit Plex edition suffix.",
  )
  .example(
    "$0 nameMovies \"/path/to/movie/folder\" --movieDbId 9504 --dvdCompareId 12345 --dvdCompareReleaseHash 1",
    "Same, deriving the edition from a DVDCompare release.",
  )
  .positional(
    "sourcePath",
    {
      demandOption: true,
      describe: "Directory containing the movie file(s).",
      type: "string",
    },
  )
  .option(
    "movieDbId",
    {
      demandOption: true,
      describe: "TMDB movie ID (the integer in the TMDB URL — e.g. 27205 for /movie/27205).",
      type: "number",
    },
  )
  .option(
    "editionLabel",
    {
      describe: "Explicit edition label (e.g. \"Director's Cut\"). Skips the DVDCompare lookup when set.",
      type: "string",
    },
  )
  .option(
    "dvdCompareId",
    {
      describe: "DVDCompare film ID. Combined with --dvdCompareReleaseHash to fetch the release label and derive the edition.",
      type: "number",
    },
  )
  .option(
    "dvdCompareReleaseHash",
    {
      describe: "DVDCompare release hash (the integer at the end of a release URL — e.g. 1, 2, 3).",
      type: "string",
    },
  )
)

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const nameMoviesCommand: CommandModule<{}, Args> = {
  command: "nameMovies <sourcePath>",
  describe: "Rename a movie folder's files to Plex's `Title (Year) {edition-...}.mkv` format using TMDB + DVDCompare metadata.",

  builder: builder as CommandBuilder<{}, Args>,

  handler: (argv) => {
    nameMovies({
      dvdCompareId: argv.dvdCompareId,
      dvdCompareReleaseHash: argv.dvdCompareReleaseHash,
      editionLabel: argv.editionLabel,
      movieDbId: argv.movieDbId,
      sourcePath: argv.sourcePath,
    })
    .subscribe(subscribeCli())
  },
}
