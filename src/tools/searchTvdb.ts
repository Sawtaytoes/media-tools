import {
  from,
  map,
  mergeMap,
  type Observable,
} from "rxjs"

import { catchNamedError } from "./catchNamedError.js"
import { getTvdbFetchClient } from "./tvdbApi.js"

export type TvdbResult = {
  imageUrl?: string
  name: string
  status?: string
  tvdbId: number
  year?: string
}

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
    map(({ data }) => (
      (data?.data ?? [])
      .map((entry) => ({
        imageUrl: entry.image_url,
        name: entry.name ?? "",
        status: entry.status,
        tvdbId: Number(entry.tvdb_id),
        year: entry.year,
      }))
      .filter((result) => result.tvdbId > 0 && result.name)
    )),
    catchNamedError(searchTvdb),
  )
)
