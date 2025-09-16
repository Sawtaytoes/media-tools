import {
  concatAll,
  concatMap,
  filter,
  map,
  of,
  tap,
  toArray,
} from "rxjs"

import { catchNamedError } from "./catchNamedError.js"
import { getAudioOffset } from "./getAudioOffset.js"
import { type Iso6392LanguageCode } from "./iso6392LanguageCodes.js"
import { getFilesAtDepth } from "./getFilesAtDepth.js"
import { replaceTracksMkvMerge } from "./replaceTracksMkvMerge.js"
import { logInfo } from "./logMessage.js"

export const replaceTracks = ({
  audioLanguages,
  destinationFilesPath,
  globalOffsetInMilliseconds,
  hasAutomaticOffset,
  hasChapters,
  offsets,
  sourceFilesPath,
  subtitlesLanguages,
  videoLanguages,
}: {
  audioLanguages: Iso6392LanguageCode[]
  destinationFilesPath: string
  globalOffsetInMilliseconds?: number
  hasAutomaticOffset: boolean
  hasChapters: boolean
  offsets: number[]
  sourceFilesPath: string
  subtitlesLanguages: Iso6392LanguageCode[]
  videoLanguages: Iso6392LanguageCode[]
}) => (
  getFilesAtDepth({
    depth: 0,
    sourcePath: (
      sourceFilesPath
    ),
  })
  .pipe(
    toArray(),
    concatMap((
      sourceFileInfos,
    ) => (
      getFilesAtDepth({
        depth: 0,
        sourcePath: (
          destinationFilesPath
        ),
      })
      .pipe(
        map((
          destinationFileInfo,
        ) => ({
          destinationFilePath: (
            destinationFileInfo
            .fullPath
          ),
          sourceFilePath: (
            (
              sourceFileInfos
              .find((
                sourceFileInfo,
              ) => (
                (
                  sourceFileInfo
                  .filename
                )
                === (
                  destinationFileInfo
                  .filename
                )
              ))
              ?.fullPath
            )
            || ""
          ),
        })),
        filter(({
          sourceFilePath,
        }) => (
          Boolean(
            sourceFilePath
          )
        )),
        concatMap((
          {
            destinationFilePath,
            sourceFilePath,
          },
          index,
        ) => (
          (
            hasAutomaticOffset
            ? (
              getAudioOffset({
                destinationFilePath,
                sourceFilePath,
              })
            )
            : (
              of(
                globalOffsetInMilliseconds
              )
            )
          )
          .pipe(
            tap((
              offsetInMilliseconds,
            ) => {
              logInfo(
                "OFFSET IN MILLISECONDS",
                offsetInMilliseconds,
              )
            }),
            concatMap((
              offsetInMilliseconds,
            ) => (
              replaceTracksMkvMerge({
                audioLanguages,
                destinationFilePath,
                hasChapters,
                offsetInMilliseconds: (
                  (
                    offsets
                    [index]
                  )
                  ?? (
                    offsetInMilliseconds
                  )
                ),
                sourceFilePath,
                subtitlesLanguages,
                videoLanguages,
              })
            )),
            tap((
              outputFilePath,
            ) => {
              logInfo(
                "REPLACED TRACKS IN FILE",
                outputFilePath,
              )
            }),
            filter(
              Boolean
            ),
          )
        )),
        toArray(),
        tap(() => {
          process
          .exit()
        })
      )
    )),
    catchNamedError(
      replaceTracks
    ),
  )
)
