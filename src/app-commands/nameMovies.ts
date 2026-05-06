import {
  concatMap,
  EMPTY,
  from,
  map,
  mergeMap,
  toArray,
  type Observable,
} from "rxjs"

import { catchNamedError } from "../tools/catchNamedError.js"
import { filterIsVideoFile } from "../tools/filterIsVideoFile.js"
import { getFilesAtDepth } from "../tools/getFilesAtDepth.js"
import { logInfo } from "../tools/logMessage.js"
import { lookupMovieDbById } from "../tools/searchMovieDb.js"

// Pulls a movie's title + year from TMDB and renames every video file in
// sourcePath to Plex's expected form:
//
//   Title (Year) {edition-Edition Name}.<ext>
//
// `editionLabel` is taken literally — when set, it's appended as
// `{edition-<editionLabel>}`. Films with multiple editions in the same
// folder need to be processed one at a time with the right label per run;
// the command does not auto-detect editions.
//
// Multi-file behavior: if sourcePath contains >1 video file, every file
// gets the same base name with a `-pt1`, `-pt2`, ... suffix appended
// (Plex's convention for split releases). Files are sorted by name first
// so the suffixes are deterministic.

export type NameMoviesProps = {
  sourcePath: string
  movieDbId: number
  editionLabel?: string
}

const PLEX_INVALID_FILENAME_CHARS_REGEX = /[<>:"/\\|?*\x00-\x1f]/gu

// Plex (and most filesystems) reject these characters; replace with a
// safe ASCII fallback rather than dropping them so the resulting names
// stay readable.
const sanitizeFilename = (name: string): string => (
  name
  .replace(/:/gu, " -")
  .replace(/\?/gu, "")
  .replace(/"/gu, "'")
  .replace(/[\\/|*<>]/gu, "")
  .replace(PLEX_INVALID_FILENAME_CHARS_REGEX, "")
  .trim()
)

export const buildPlexBaseName = ({
  title,
  year,
  edition,
}: {
  title: string
  year: string
  edition: string
}): string => {
  const titlePart = sanitizeFilename(title)
  const yearPart = year ? ` (${year})` : ""
  const editionPart = edition ? ` {edition-${sanitizeFilename(edition)}}` : ""
  return `${titlePart}${yearPart}${editionPart}`
}

export const nameMovies = ({
  editionLabel,
  movieDbId,
  sourcePath,
}: NameMoviesProps): Observable<string> => {
  if (!movieDbId || movieDbId <= 0) {
    logInfo("NAME MOVIES", "movieDbId is required and must be > 0; skipping (no-op).")
    return EMPTY
  }

  const edition = editionLabel?.trim() ?? ""

  return (
    lookupMovieDbById(movieDbId)
    .pipe(
      concatMap((movie) => {
        if (!movie) {
          throw new Error(`TMDB returned no result for movieDbId=${movieDbId}`)
        }
        // movie.name is the "Title (Year)" companion form lookupMovieDbById
        // returns. Pull the constituent parts back out — we want them
        // separately for the Plex template.
        const yearMatch = movie.name.match(/^(.+?)\s*\((\d{4})\)\s*$/u)
        const title = yearMatch ? yearMatch[1].trim() : movie.name
        const year = yearMatch ? yearMatch[2] : ""
        const baseName = buildPlexBaseName({ title, year, edition })
        logInfo("NAME MOVIES", `Plex name: ${baseName}`)

        return (
          getFilesAtDepth({ depth: 0, sourcePath })
          .pipe(
            filterIsVideoFile(),
            toArray(),
            mergeMap((files) => {
              if (files.length === 0) {
                logInfo("NAME MOVIES", `No video files in ${sourcePath}; nothing to rename.`)
                return EMPTY
              }
              // Deterministic ordering for the -ptN suffixes.
              const sorted = files.slice().sort((a, b) => a.filename.localeCompare(b.filename))
              return from(sorted.map((fileInfo, index) => ({ fileInfo, index, total: sorted.length })))
            }),
            concatMap(({ fileInfo, index, total }) => {
              // renameFile re-appends the original extension on its own —
              // pass the bare base name (no .mkv) and let it stitch.
              const partSuffix = total > 1 ? ` - pt${index + 1}` : ""
              const renamedBase = `${baseName}${partSuffix}`
              return fileInfo.renameFile(renamedBase).pipe(map(() => renamedBase))
            }),
          )
        )
      }),
      catchNamedError(nameMovies),
    )
  )
}
