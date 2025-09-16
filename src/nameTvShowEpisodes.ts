import readline from "node:readline"
import {
  concatMap,
  filter,
  from,
  map,
  mergeAll,
  mergeMap,
  Observable,
  tap,
  toArray,
} from "rxjs"

import { catchNamedError } from "./catchNamedError.js"
import { cleanupFilename } from "./cleanupFilename.js"
import { filterIsVideoFile } from "./filterIsVideoFile.js"
import { getRandomString } from "./getRandomString.js"
import { getTvdbFetchClient } from "./tvdbApi.js"
import { naturalSort } from "./naturalSort.js"
import { getFiles } from "./getFiles.js"

export const nameTvShowEpisodes = ({
  searchTerm,
  seasonNumber,
  sourcePath,
}: {
  searchTerm: string,
  seasonNumber: number,
  sourcePath: string,
}) => (
  getFiles({
    sourcePath,
  })
  .pipe(
    toArray(),
    concatMap((
      fileInfos,
    ) => (
      from(
        getTvdbFetchClient()
      )
      .pipe(
        concatMap((
          tvdbFetchClient,
        ) => (
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
          .pipe(
            map(({
              data,
            }) => (
              (
                data
                ?.data
              )
              || []
            )),
            concatMap((
              searchResults,
            ) => (
              new Observable<
                typeof searchResults[0]
              >((
                observer,
              ) => {
                console
                .info(
                  searchResults
                  .filter(
                    Boolean
                  )
                  .map((
                    item,
                    index,
                  ) => ({
                    index,
                    title: (
                      (
                        item
                        .name
                      )
                      || ""
                    ),
                  }))
                )

                const readlineInterface = (
                  readline
                  .createInterface({
                    input: (
                      process
                      .stdin
                    ),
                    output: (
                      process
                      .stdout
                    ),
                    terminal: false,
                  })
                )

                readlineInterface
                .on(
                  'line',
                  (
                    index,
                  ) => {
                    observer
                    .next(
                      searchResults
                      .at(
                        Number(
                          index
                        )
                      )
                    )

                    readlineInterface
                    .close()

                    observer
                    .complete()
                  },
                )
              })
            )),
            filter(
              Boolean
            ),
            concatMap((
              selectedSearchResult,
            ) => (
              tvdbFetchClient
              .GET(
                "/series/{id}/episodes/{season-type}",
                {
                  params: {
                    path: {
                      id: (
                        Number(
                          (
                            selectedSearchResult
                            ?.tvdb_id
                          )
                        )
                      ),
                      "season-type": "official",
                    },
                    query: {
                      page: 0,
                      season: (
                        seasonNumber
                      ),
                    }
                  },
                },
              )
            )),
          )
        )),
        concatMap(({
          data,
        }) => (
          from(
            (
              data
              ?.data
              ?.episodes
            )
            || []
          )
          .pipe(
            filter(
              Boolean
            ),
            map((
              episode,
            ) => ({
              airedYear: (
                String(
                  new Date(
                    (
                      episode
                      .aired
                    )
                    || ""
                  )
                  .getFullYear()
                )
              ),
              episodeName: (
                (
                  episode
                  .name
                )
                || ""
              ),
              episodeNumber: (
                (
                  episode
                  ?.number
                )
                ? (
                  String(
                    episode
                    ?.number
                  )
                )
                : ""
              ),
              seriesName: (
                (
                  data
                  ?.data
                  ?.series
                  ?.name
                )
                || ""
              ),
              seasonNumber: (
                (
                  String(
                    episode
                    ?.seasonNumber
                  )
                )
                || "1"
              ),
            })),
          )
        )),
        toArray(),
        concatMap((
          episodes,
        ) => (
          from(
            naturalSort(
              fileInfos
            )
            .by({
              asc: (
                fileInfo,
              ) => (
                fileInfo
                .filename
              ),
            })
          )
          .pipe(
            filterIsVideoFile(),
            map((
              fileInfo,
              index,
            ) => ({
              episode: (
                episodes
                .at(
                  index
                )
              ),
              fileInfo,
            })),
            filter(({
              episode,
            }) => (
              Boolean(
                episode
              )
            )),
            map(({
              episode,
              fileInfo,
            }) => ({
              fileInfo,
              renamedFilename: (
                cleanupFilename(
                  (
                    episode!
                    .seriesName
                  )
                  .concat(
                    " (",
                    (
                      episode!
                      .airedYear
                    ),
                    ") - ",
                    "s",
                    (
                      episode!
                      .seasonNumber
                      .padStart(
                        2,
                        '0',
                      )
                    ),
                    "e",
                    (
                      episode!
                      .episodeNumber
                      .padStart(
                        2,
                        '0',
                      )
                    ),
                    " - ",
                    (
                      (
                        episode!
                        .episodeName
                      )
                      || (
                        getRandomString()
                      )
                    ),
                  )
                )
              )
            })),
          )
        )),
      )
    )),
    toArray(),
    mergeAll(),
    mergeMap(({
      fileInfo,
      renamedFilename,
    }) => (
      fileInfo
      .renameFile(
        renamedFilename
      )
    )),
    catchNamedError(
      nameTvShowEpisodes
    )
  )
)
