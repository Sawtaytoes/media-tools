import {
  concatAll,
  concatMap,
  filter,
  map,
  tap,
  toArray,
} from "rxjs"

import { catchNamedError } from "../tools/catchNamedError.js"
import { filterIsVideoFile } from "../tools/filterIsVideoFile.js"
import { getTrackLanguages } from "../tools/getTrackLanguages.js"
import { type Iso6392LanguageCode } from "../tools/iso6392LanguageCodes.js"
import { keepSpecifiedLanguageTracks, keepSpecifiedLanguageTracksDefaultProps } from "../cli-spawn-operations/keepSpecifiedLanguageTracks.js"
import { logInfo } from "../tools/logMessage.js"
import { getFilesAtDepth } from "../tools/getFilesAtDepth.js"

type KeepLanguagesRequiredProps = {
  audioLanguages: Iso6392LanguageCode[]
  hasFirstAudioLanguage: boolean
  hasFirstSubtitlesLanguage: boolean
  isRecursive: boolean
  sourcePath: string
  subtitlesLanguages: Iso6392LanguageCode[]
}

type KeepLanguagesOptionalProps = {
  outputFolderName?: string
}

export type KeepLanguagesProps = KeepLanguagesRequiredProps & KeepLanguagesOptionalProps

export const keepLanguagesDefaultProps = {
  outputFolderName: keepSpecifiedLanguageTracksDefaultProps.outputFolderName,
} satisfies KeepLanguagesOptionalProps

export const keepLanguages = ({
  audioLanguages: selectedAudioLanguages,
  isRecursive,
  hasFirstAudioLanguage,
  hasFirstSubtitlesLanguage,
  outputFolderName = keepLanguagesDefaultProps.outputFolderName,
  sourcePath,
  subtitlesLanguages: selectedSubtitlesLanguages,
}: KeepLanguagesProps) => (
  getFilesAtDepth({
    depth: (
      isRecursive
      ? 1
      : 0
    ),
    sourcePath,
  })
  .pipe(
    filterIsVideoFile(),
    map((
      fileInfo,
    ) => (
      getTrackLanguages(
        fileInfo
        .fullPath
      )
      .pipe(
        map(({
          audioLanguages,
          ...otherProps
        }) => ({
          ...otherProps,
          audioLanguages,
          hasMatchingAudioLanguage: (
            selectedAudioLanguages
            .some((
              selectedAudioLanguage,
            ) => (
              audioLanguages
              .includes(
                selectedAudioLanguage
              )
            ))
          ),
        })),
        map(({
          audioLanguages,
          hasMatchingAudioLanguage,
          subtitlesLanguages,
        }) => ({
          audioLanguages,
          audioLanguagesToKeep: [
            ...selectedAudioLanguages,
            ...(
              (
                hasFirstAudioLanguage
                && (
                  (
                    audioLanguages
                    .length
                  )
                  > 0
                )
              )
              ? [
                audioLanguages
                .at(0)
              ]
              : (
                hasMatchingAudioLanguage
                ? []
                : audioLanguages
              )
            ),
          ],
          subtitlesLanguages,
          subtitlesLanguagesToKeep: [
            ...selectedSubtitlesLanguages,
            ...(
              (
                hasFirstSubtitlesLanguage
                && (
                  (
                    subtitlesLanguages
                    .length
                  )
                  > 0
                )
              )
              ? [
                subtitlesLanguages
                .at(0)
              ]
              : []
            ),
          ],
        })),
        filter(({
          audioLanguages,
          audioLanguagesToKeep,
          subtitlesLanguages,
          subtitlesLanguagesToKeep,
        }) => (
          // Only continue if keeping these languages results in a different file output.
          (
            audioLanguages
            .some((
              audioLanguage,
            ) => (
              !(
                audioLanguagesToKeep
                .includes(
                  audioLanguage
                )
              )
            ))
          )
          || (
            subtitlesLanguages
            .some((
              subtitlesLanguage,
            ) => (
              !(
                subtitlesLanguagesToKeep
                .includes(
                  subtitlesLanguage
                )
              )
            ))
          )
        )),
        concatMap(({
          audioLanguagesToKeep,
          subtitlesLanguagesToKeep,
        }) => (
          keepSpecifiedLanguageTracks({
            audioLanguages: (
              audioLanguagesToKeep
              .filter(
                Boolean
              )
            ),
            filePath: (
              fileInfo
              .fullPath
            ),
            outputFolderName,
            subtitlesLanguages: (
              subtitlesLanguagesToKeep
              .filter(
                Boolean
              )
            ),
          })
          .pipe(
            tap(() => {
              logInfo(
                "CREATED TRIMMED FILE",
                (
                  fileInfo
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
    concatAll(),
    toArray(),
    catchNamedError(
      keepLanguages
    ),
  )
)
