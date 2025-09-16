import malScraper from "mal-scraper"
import {
  basename,
} from "node:path"
import readline from "node:readline"
import {
  concatMap,
  EMPTY,
  filter,
  from,
  map,
  mergeAll,
  mergeMap,
  Observable,
  of,
  toArray,
  zip,
} from "rxjs"

import { catchNamedError } from "./catchNamedError.js"
import { cleanupFilename } from "./cleanupFilename.js"
import { filterIsVideoFile } from "./filterIsVideoFile.js"
import { naturalSort } from "./naturalSort.js"
import { getFiles } from "./getFiles.js"
import { logInfo } from "./logMessage.js"

export const nameAnimeEpisodes = ({
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
    map((
      fileInfos,
    ) => (
      from(
        malScraper
        .getResultsFromSearch(
          (
            searchTerm
            || (
              basename(
                sourcePath
              )
            )
          ),
          "anime",
        )
      )
      .pipe(
        concatMap((
          animeList,
        ) => (
          new Observable<
            typeof animeList[0]
          >((
            observer,
          ) => {
            console
            .info(
              animeList
              .map((
                anime,
                index,
              ) => ({
                index,
                title: (
                  anime
                  .name
                ),
                airDate: (
                  anime
                  .payload
                  ?.aired
                ),
                type: (
                  anime
                  .payload
                  ?.media_type
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
                  animeList
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
        concatMap(({
          id,
          name,
          url,
        }) => (
          zip(
            (
              malScraper
              .getInfoFromURL(
                url
              )
            ),
            (
              malScraper
              .getEpisodesList({
                id: (
                  Number(
                    id
                  )
                ),
                name,
              })
            ),
          )
        )),
      )
      .pipe(
        map(([
          series,
          seriesEpisodes,
        ]) => ({
          seriesEpisodes,
          seriesName: (
            (
              series
              .englishTitle
            )
            || (
              series
              .title
            )
            || (
              series
              .synonyms
              .at(0)
            )
            || (
              series
              .japaneseTitle
            )
            || ""
          ),
        })),
        concatMap(({
          seriesName,
          seriesEpisodes,
        }) => (
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
                seriesEpisodes
                .at(
                  index
                )
              ),
              fileInfo,
            })),
            map(({
              episode,
              fileInfo,
            }) => ({
              episodeNumber: (
                (
                  episode
                  ?.epNumber
                )
                ? (
                  String(
                    episode
                    ?.epNumber
                  )
                )
                : ""
              ),
              fileInfo,
              seasonNumber: (
                String(
                  seasonNumber
                )
                || "1"
              ),
              title: (
                (
                  episode
                  ?.title
                )
                || (
                  episode
                  ?.japaneseTitle
                )
                || ""
              ),
            })),
            mergeMap((
              item,
            ) => {
              if (
                item
                .title
              ) {
                return (
                  of(
                    item
                  )
                )
              }
              else {
                logInfo(
                  "NO EPISODE NAME",
                  (
                    item
                    .fileInfo
                    .filename
                  ),
                )

                return EMPTY
              }
            }),
            map(({
              episodeNumber,
              fileInfo,
              seasonNumber,
              title,
            }) => ({
              fileInfo,
              renamedFilename: (
                cleanupFilename(
                  seriesName
                  .concat(
                    " - ",
                    "s",
                    (
                      seasonNumber
                      .padStart(
                        2,
                        '0',
                      )
                    ),
                    "e",
                    (
                      episodeNumber
                      .padStart(
                        2,
                        '0',
                      )
                    ),
                    " - ",
                    title,
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
      nameAnimeEpisodes
    )
  )
)
