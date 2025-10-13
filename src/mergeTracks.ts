import { XMLParser } from "fast-xml-parser"
import {
  access,
  readFile,
} from "node:fs/promises"
import {
  extname,
  join,
} from "node:path"
import {
  EMPTY,
  catchError,
  combineLatest,
  concatAll,
  concatMap,
  filter,
  from,
  map,
  of,
  skip,
  take,
  tap,
  toArray,
  zip,
} from "rxjs"

import { catchNamedError } from "./catchNamedError.js"
import { ChaptersXml } from "./ChaptersXml.js"
import { subtitlesFileExtensionSet } from "./filterIsSubtitlesFile.js"
import { getFiles } from "./getFiles.js"
import { getFolder } from "./getFolder.js"
import { getMediaInfo } from "./getMediaInfo.js"
import { logInfo } from "./logMessage.js"
import { mergeSubtitlesMkvMerge } from "./mergeSubtitlesMkvMerge.js"
import {
  parseMediaFileChapterTimestamp,
  convertTimecodeToMilliseconds,
} from "./parseTimestamps.js"

const xmlParser = (
  new XMLParser()
)

export const mergeTracks = ({
  globalOffsetInMilliseconds = 0,
  hasAutomaticOffset = false,
  hasChapters = false,
  mediaFilesPath,
  offsetsInMilliseconds,
  subtitlesPath,
}: {
  globalOffsetInMilliseconds?: number
  hasAutomaticOffset?: boolean,
  hasChapters?: boolean,
  mediaFilesPath: string
  offsetsInMilliseconds: number[],
  subtitlesPath: string
}) => (
  combineLatest([
    (
      getFolder({
        sourcePath: (
          subtitlesPath
        ),
      })
      .pipe(
        toArray(),
      )
    ),
    (
      getFiles({
        sourcePath: (
          mediaFilesPath
        ),
      })
      .pipe(
        toArray(),
      )
    ),
  ])
  .pipe(
    concatMap(([
      subtitlesFolder,
      mediaFiles,
    ]) => (
      from(
        mediaFiles
      )
      .pipe(
        map((
          mediaFileInfo,
        ) => (
          from(
            subtitlesFolder
          )
          .pipe(
            filter((
              subtitlesFolderInfo,
            ) => (
              (
                subtitlesFolderInfo
                .folderName
              )
              === (
                mediaFileInfo
                .filename
              )
            )),
            take(1),
            concatMap((
              subtitlesFolderInfo,
            ) => (
              combineLatest([
                (
                  subtitlesFolderInfo
                  .fullPath
                ),
                (
                  getFiles({
                    sourcePath: (
                      subtitlesFolderInfo
                      .fullPath
                    ),
                  })
                  .pipe(
                    filter((
                      subtitlesFileInfo,
                    ) => (
                      subtitlesFileExtensionSet
                      .has(
                        extname(
                          subtitlesFileInfo
                          .fullPath
                        )
                      )
                    )),
                    map((
                      subtitlesFileInfo,
                    ) => (
                      subtitlesFileInfo
                      .fullPath
                    )),
                    toArray(),
                  )
                ),
                (
                  from(
                    access(
                      join(
                        (
                          subtitlesFolderInfo
                          .fullPath
                        ),
                        "attachments",
                      )
                    )
                  )
                  .pipe(
                    concatMap(() => (
                      getFiles({
                        sourcePath: (
                          join(
                            (
                              subtitlesFolderInfo
                              .fullPath
                            ),
                            "attachments",
                          )
                        ),
                      })
                    )),
                    map((
                      attachmentsFileInfo,
                    ) => (
                      attachmentsFileInfo
                      .fullPath
                    )),
                    catchError(() => (
                      of(
                        null
                      )
                    )),
                    toArray(),
                    concatAll(),
                    filter(
                      Boolean
                    ),
                    toArray(),
                  )
                ),
                (
                  hasAutomaticOffset
                  ? (
                    getFiles({
                      sourcePath: (
                        subtitlesFolderInfo
                        .fullPath
                      ),
                    })
                    .pipe(
                      filter((
                        subtitlesFileInfo,
                      ) => (
                        subtitlesFileInfo
                        .fullPath
                        .endsWith(
                          "chapters.xml"
                        )
                      )),
                      take(1),
                      concatMap((
                        subtitlesFileInfo,
                      ) => (
                        zip([
                          (
                            from(
                              readFile(
                                subtitlesFileInfo
                                .fullPath
                              )
                            )
                            .pipe(
                              map((
                                chaptersXml,
                              ) => (
                                xmlParser
                                .parse(
                                  chaptersXml
                                ) as (
                                  ChaptersXml
                                )
                              )),
                              map((
                                chaptersJson,
                              ) => (
                                chaptersJson
                                .Chapters
                                .EditionEntry
                                .ChapterAtom
                              )),
                              concatAll(),
                              map((
                                chapterAtom,
                              ) => (
                                chapterAtom
                                .ChapterTimeStart
                              )),
                              map((
                                subtitlesChapterTimestamp
                              ) => (
                                convertTimecodeToMilliseconds(
                                  subtitlesChapterTimestamp
                                )
                              )),
                            )
                          ),
                          (
                            getMediaInfo(
                              mediaFileInfo
                              .fullPath
                            )
                            .pipe(
                              map((
                                mediaInfo,
                              ) => (
                                mediaInfo
                                ?.media
                                ?.track
                                .flatMap((
                                  track,
                                ) => (
                                  (
                                    track
                                    ["@type"]
                                  )
                                  === "Menu"
                                )
                                ? track
                                : []
                                )
                                .find(
                                  Boolean
                                )
                                ?.extra
                              )),
                              filter(
                                Boolean
                              ),
                              take(1),
                              map((
                                chapters,
                              ) => (
                                Object
                                .keys(
                                  chapters
                                )
                                .map((
                                  chapterTimestamp,
                                ) => (
                                  parseMediaFileChapterTimestamp(
                                    chapterTimestamp
                                  )
                                ))
                              )),
                              concatAll(),
                            )
                          ),
                        ])
                        .pipe(
                          skip(1),
                          concatMap(([
                            subtitlesChapterTimestamp,
                            mediaFileChapterTimestamp,
                          ]) => {
                            const offsetInMilliseconds = (
                              mediaFileChapterTimestamp
                              - subtitlesChapterTimestamp
                            )

                            console
                            .info({
                              mediaFileChapterTimestamp,
                              subtitlesChapterTimestamp,
                              offsetInMilliseconds,
                            })

                            return (
                              (
                                offsetInMilliseconds
                                === 0
                              )
                              ? EMPTY
                              : (
                                of(
                                  offsetInMilliseconds
                                )
                              )
                            )
                          }),
                          take(1),
                        )
                      )),
                    )
                  )
                  : (
                    of(
                      globalOffsetInMilliseconds
                    )
                  )
                ),
              ])
              .pipe(
                concatMap((
                  [
                    subtitlesFolderPath,
                    subtitlesFilesPaths,
                    attachmentFilePaths,
                    offsetInMilliseconds,
                  ],
                  index,
                ) => (
                  mergeSubtitlesMkvMerge({
                    attachmentFilePaths,
                    destinationFilePath: (
                      mediaFileInfo
                      .fullPath
                    ),
                    chaptersFilePath: (
                      hasChapters
                      ? (
                        join(
                          subtitlesFolderPath,
                          "chapters.xml",
                        )
                      )
                      : undefined
                    ),
                    offsetInMilliseconds: (
                      (
                        offsetsInMilliseconds
                        .length > 0
                      )
                      ? (
                        offsetsInMilliseconds
                        [index]
                      )
                      : offsetInMilliseconds
                    ),
                    subtitlesFilesPaths,
                    subtitlesLanguage: "eng",
                  })
                )),
                tap(() => {
                  logInfo(
                    "CREATED MERGED FILE",
                    (
                      mediaFileInfo
                      .fullPath
                    ),
                  )
                }),
                filter(
                  Boolean
                ),
              )
            )),
          )
        )),
      )
    )),
    concatAll(),
    toArray(),
    tap(() => {
      process
      .exit()
    }),
    catchNamedError(
      mergeTracks
    )
  )
)
