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
      describe: "Edition label appended as `{edition-<label>}` (e.g. \"Director's Cut\"). Omit for films with no edition.",
      type: "string",
    },
  )
)

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const nameMoviesCommand: CommandModule<{}, Args> = {
  command: "nameMovies <sourcePath>",
  describe: "Rename a movie folder's files to Plex's `Title (Year) {edition-...}.mkv` format using a TMDB ID for the title/year.",

  builder: builder as CommandBuilder<{}, Args>,

  handler: (argv) => {
    nameMovies({
      editionLabel: argv.editionLabel,
      movieDbId: argv.movieDbId,
      sourcePath: argv.sourcePath,
    })
    .subscribe(subscribeCli())
  },
}
