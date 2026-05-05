import {
  concatAll,
  concatMap,
  filter,
  from,
  map,
  mergeAll,
  tap,
  toArray,
} from "rxjs"

import { catchNamedError } from "../tools/catchNamedError.js"
import { filterIsVideoFile } from "../tools/filterIsVideoFile.js"
import {
  getMkvInfo,
  type MkvTookNixTrackType,
} from "../tools/getMkvInfo.js"
import { type Iso6392LanguageCode } from "../tools/iso6392LanguageCodes.js"
import { getFilesAtDepth } from "../tools/getFilesAtDepth.js"
import { updateTrackLanguage } from "../cli-spawn-operations/updateTrackLanguage.js"

export const changeTrackLanguages = ({
  audioLanguage: selectedAudioLanguage,
  isRecursive,
  sourcePath,
  subtitlesLanguage: selectedSubtitlesLanguage,
  videoLanguage: selectedVideoLanguage,
}: {
  audioLanguage?: Iso6392LanguageCode
  isRecursive: boolean
  sourcePath: string
  subtitlesLanguage?: Iso6392LanguageCode
  videoLanguage?: Iso6392LanguageCode
}) => {
  const trackTypeLanguageCode: (
    Record<
      MkvTookNixTrackType,
      (
        | Iso6392LanguageCode
        | undefined
      )
    >
  ) = {
    audio: selectedAudioLanguage,
    subtitles: selectedSubtitlesLanguage,
    video: selectedVideoLanguage,
  }

  return (
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
        getMkvInfo(
          fileInfo
          .fullPath
        )
        .pipe(
          concatMap(({
            tracks
          }) => (
            from(
              tracks
            )
            .pipe(
              filter((
                track,
              ) => (
                Boolean(
                  trackTypeLanguageCode
                  [
                    track
                    .type
                  ]
                )
              )),
              concatMap((
                track,
              ) => (
                updateTrackLanguage({
                  filePath: (
                    fileInfo
                    .fullPath
                  ),
                  languageCode: (
                    trackTypeLanguageCode
                    [
                      track
                      .type
                    ]!
                  ),
                  trackId: (
                    track
                    .properties
                    .number
                  ),
                })
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
        changeTrackLanguages
      ),
    )
  )
}
