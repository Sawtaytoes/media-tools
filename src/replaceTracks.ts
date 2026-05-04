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
import { logInfo } from "./logMessage.js"
import { REPLACED_TRACKS_FOLDER_NAME } from "./outputFolderNames.js"
import { replaceTracksMkvMerge } from "./replaceTracksMkvMerge.js"

type ReplaceTracksRequiredProps = {
  audioLanguages: Iso6392LanguageCode[]
  destinationFilesPath: string
  hasAutomaticOffset: boolean
  hasChapters: boolean
  offsets: number[]
  sourceFilesPath: string
  subtitlesLanguages: Iso6392LanguageCode[]
  videoLanguages: Iso6392LanguageCode[]
}

type ReplaceTracksOptionalProps = {
  globalOffsetInMilliseconds?: number
  outputFolderName?: string
}

export type ReplaceTracksProps = ReplaceTracksRequiredProps & ReplaceTracksOptionalProps

const replaceTracksDefaultProps = {
  outputFolderName: REPLACED_TRACKS_FOLDER_NAME,
} satisfies ReplaceTracksOptionalProps

export const replaceTracks = ({
  audioLanguages,
  destinationFilesPath,
  globalOffsetInMilliseconds,
  hasAutomaticOffset,
  hasChapters,
  offsets,
  outputFolderName = replaceTracksDefaultProps.outputFolderName,
  sourceFilesPath,
  subtitlesLanguages,
  videoLanguages,
}: ReplaceTracksProps) => (
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
                outputFolderName,
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
      )
    )),
    catchNamedError(
      replaceTracks
    ),
  )
)
