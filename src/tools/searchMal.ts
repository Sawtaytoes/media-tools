import malScraper from "mal-scraper"
import {
  from,
  map,
  type Observable,
} from "rxjs"

import { catchNamedError } from "./catchNamedError.js"

export type MalResult = {
  airDate?: string
  imageUrl?: string
  malId: number
  mediaType?: string
  name: string
}

export const searchMal = (
  searchTerm: string,
): Observable<MalResult[]> => (
  from(
    malScraper
    .getResultsFromSearch(
      searchTerm,
      "anime",
    )
  )
  .pipe(
    map((results) => (
      results
      .map((result) => ({
        airDate: result.payload?.aired,
        imageUrl: result.thumbnail_url ?? result.image_url,
        malId: Number(result.id),
        mediaType: result.payload?.media_type,
        name: result.name,
      }))
      .filter((result) => result.malId > 0)
    )),
    catchNamedError(searchMal),
  )
)
