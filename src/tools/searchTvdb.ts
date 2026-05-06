import {
  from,
  map,
  mergeMap,
  type Observable,
} from "rxjs"

import { logAndSwallow } from "./logAndSwallow.js"
import { getTvdbFetchClient } from "./tvdbApi.js"

export type TvdbResult = {
  imageUrl?: string
  name: string
  status?: string
  tvdbId: number
  year?: string
}

// Subset of TVDB's SearchResult — only the fields we read. Defined locally
// so the mapping helper can be tested with synthetic inputs without
// importing the generated openapi types.
export type TvdbRawResult = {
  image_url?: string
  name?: string
  status?: string
  tvdb_id?: string
  year?: string
}

export const mapTvdbSearchResults = (
  rawData: TvdbRawResult[] | null | undefined,
): TvdbResult[] => (
  (rawData ?? [])
  .map((entry) => ({
    imageUrl: entry.image_url,
    name: entry.name ?? "",
    status: entry.status,
    tvdbId: Number(entry.tvdb_id),
    year: entry.year,
  }))
  .filter((result) => result.tvdbId > 0 && result.name)
)

export const searchTvdb = (
  searchTerm: string,
): Observable<TvdbResult[]> => (
  from(getTvdbFetchClient())
  .pipe(
    mergeMap((tvdbFetchClient) => (
      from(
        tvdbFetchClient
        .GET(
          "/search",
          {
            params: {
              query: {
                query: searchTerm,
                type: "series",
              },
            },
          },
        )
      )
    )),
    map(({ data }) => mapTvdbSearchResults(data?.data)),
  )
)

export const lookupTvdbById = (
  tvdbId: number,
): Observable<{ name: string } | null> => (
  from(getTvdbFetchClient())
  .pipe(
    mergeMap((tvdbFetchClient) => (
      from(
        tvdbFetchClient
        .GET(
          "/series/{id}",
          {
            params: {
              path: { id: tvdbId },
            },
          },
        )
      )
    )),
    map(({ data }) => {
      const name = data?.data?.name ?? ""
      return name ? { name } : null
    }),
    logAndSwallow(lookupTvdbById),
  )
)
