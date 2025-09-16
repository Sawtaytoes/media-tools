import {
  concatAll,
  concatMap,
  filter,
  map,
  tap,
  toArray,
} from "rxjs"

import { catchNamedError } from "./catchNamedError.js"
import { filterIsVideoFile } from "./filterIsVideoFile.js"
import { getTrackLanguages } from "./getTrackLanguages.js"
import { type Iso6392LanguageCode } from "./iso6392LanguageCodes.js"
import { keepSpecifiedLanguageTracks } from "./keepSpecifiedLanguageTracks.js"
import { logInfo } from "./logMessage.js"
import { getFilesAtDepth } from "./getFilesAtDepth.js"

export const keepLanguages = ({
  audioLanguages: selectedAudioLanguages,
  isRecursive,
  hasFirstAudioLanguage,
  hasFirstSubtitlesLanguage,
  sourcePath,
  subtitlesLanguages: selectedSubtitlesLanguages,
}: {
  audioLanguages: Iso6392LanguageCode[]
  hasFirstAudioLanguage: boolean
  hasFirstSubtitlesLanguage: boolean
  isRecursive: boolean
  sourcePath: string
  subtitlesLanguages: Iso6392LanguageCode[]
}) => (
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
    tap(() => {
      process
      .exit()
    }),
    catchNamedError(
      keepLanguages
    ),
  )
)
