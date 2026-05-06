import { extname, join } from "node:path"
import {
  combineLatest,
  concatMap,
  defer,
  EMPTY,
  from,
  map,
  mergeMap,
  of,
  toArray,
  type Observable,
} from "rxjs"

import { setMkvSegmentTitleMkvPropEdit } from "../cli-spawn-operations/setMkvSegmentTitleMkvPropEdit.js"
import { catchNamedError } from "../tools/catchNamedError.js"
import { filterIsVideoFile } from "../tools/filterIsVideoFile.js"
import { getFilesAtDepth } from "../tools/getFilesAtDepth.js"
import { logInfo } from "../tools/logMessage.js"
import { lookupDvdCompareRelease } from "../tools/searchDvdCompare.js"
import { lookupMovieDbById } from "../tools/searchMovieDb.js"

// Pulls a movie's title + year from TMDB and an optional edition label
// from a DVDCompare release, then renames every video file in sourcePath
// to Plex's expected form:
//
//   Title (Year) {edition-Edition Name}.<ext>
//
// Edition resolution priority:
//   1. `editionLabel` (explicit override) — used as-is.
//   2. `dvdCompareId` + `dvdCompareReleaseHash` — fetch the release label
//      and take the third+ ' - '-delimited segment (drops format & studio).
//   3. Neither set — emits `Title (Year).<ext>` with no edition suffix.
//
// Multi-file behavior: if sourcePath contains >1 video file, every file
// gets the same base name with a `-pt1`, `-pt2`, ... suffix appended
// (Plex's convention for split releases). Files are sorted by name first
// so the suffixes are deterministic.

export type NameMoviesProps = {
  sourcePath: string
  movieDbId: number
  dvdCompareId?: number
  dvdCompareReleaseHash?: string
  editionLabel?: string
  // When true, also write the resolved title into the MKV file's
  // segment-level "title" property via mkvpropedit so Plex/Emby surface
  // it in the file's metadata view. Off by default — opt in per run.
  isMkvTitleSet?: boolean
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

// DVDCompare release labels follow the pattern
//   "<Format> <Region> - <Studio> - <Edition...>"
// e.g. "Blu-ray ALL America - Arrow Films - Director's Cut Limited Edition".
// The edition is everything from the third segment onward (joined back
// with ' - ' so multi-part editions survive).
export const extractEditionFromReleaseLabel = (
  label: string | null | undefined,
): string => {
  if (!label) return ""
  const segments = label.split(/\s+-\s+/u)
  if (segments.length < 3) return ""
  return segments.slice(2).join(" - ").trim()
}

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
  dvdCompareId,
  dvdCompareReleaseHash,
  editionLabel,
  isMkvTitleSet = false,
  movieDbId,
  sourcePath,
}: NameMoviesProps): Observable<string> => {
  if (!movieDbId || movieDbId <= 0) {
    logInfo("NAME MOVIES", "movieDbId is required and must be > 0; skipping (no-op).")
    return EMPTY
  }

  const movieLookup$ = lookupMovieDbById(movieDbId)

  // The release lookup feeds the edition heuristic. When the user supplies
  // an explicit `editionLabel`, we skip the network call entirely.
  const editionResolution$: Observable<string> = (
    editionLabel
    ? of(editionLabel.trim())
    : (
      dvdCompareId && dvdCompareReleaseHash
      ? lookupDvdCompareRelease(dvdCompareId, dvdCompareReleaseHash).pipe(
          map((release) => extractEditionFromReleaseLabel(release?.label ?? null)),
        )
      : of("")
    )
  )

  return (
    combineLatest([movieLookup$, editionResolution$])
    .pipe(
      concatMap(([movie, edition]) => {
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
        const segmentTitle = year ? `${title} (${year})` : title
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
              const renamedFullPath = join(sourcePath, `${renamedBase}${extname(fileInfo.fullPath)}`)

              const renamed$ = fileInfo.renameFile(renamedBase).pipe(map(() => renamedBase))

              if (!isMkvTitleSet) return renamed$

              // After the rename lands, write the MKV segment-level title.
              // Only meaningful for .mkv containers — mkvpropedit refuses
              // anything else, so skip non-MKV files quietly.
              const isMkvFile = extname(fileInfo.fullPath).toLowerCase() === ".mkv"
              if (!isMkvFile) return renamed$

              return renamed$.pipe(
                concatMap((emitted) => (
                  defer(() => of(emitted))
                  .pipe(
                    concatMap(() => setMkvSegmentTitleMkvPropEdit({
                      filePath: renamedFullPath,
                      title: segmentTitle,
                    })),
                    map(() => emitted),
                  )
                )),
              )
            }),
          )
        )
      }),
      catchNamedError(nameMovies),
    )
  )
}
