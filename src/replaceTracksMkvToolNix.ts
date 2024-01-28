import {
  dirname,
  join,
} from "node:path"
import {
  concatMap,
  endWith,
  of,
} from "rxjs";

import { defineLanguageForUndefinedTracks } from "./defineLanguageForUndefinedTracks.js";
import { getIsVideoFile } from "./getIsVideoFile.js";
import { type Iso6392LanguageCode } from "./iso6392LanguageCodes.js"
import { runMkvMerge } from "./runMkvMerge.js";

export const replacedTracksFolderName = "REPLACED-TRACKS"

export const replaceTracksMkvToolNix = ({
  audioLanguages,
  destinationFilePath,
  hasChapters,
  offsetInMilliseconds,
  sourceFilePath,
  subtitlesLanguages,
}: {
  audioLanguages: Iso6392LanguageCode[]
  destinationFilePath: string
  hasChapters: boolean
  offsetInMilliseconds?: number
  sourceFilePath: string
  subtitlesLanguages: Iso6392LanguageCode[]
}) => {
  const hasAudioLanguages = (
    (
      audioLanguages
      .length
    )
    > 0
  )

  const hasSubtitlesLanguages = (
    (
      subtitlesLanguages
      .length
    )
    > 0
  )

  return (
    (
      getIsVideoFile(
        sourceFilePath,
      )
    )
    ? (
      defineLanguageForUndefinedTracks({
        filePath: sourceFilePath,
        subtitleLanguage: (
          (
            subtitlesLanguages
            [0]
          )
          || "eng"
        ),
        trackType: "subtitles",
      })
      .pipe(
        // This would normally go to the next step in the pipeline, but there are sometimes no "und" language tracks, so we need to utilize this `endWith` to continue in the event the `filter` stopped us.
        endWith(
          null
        ),
        concatMap(() => (
          runMkvMerge({
            args: [
              ...(
                hasAudioLanguages
                ? ["--no-audio"]
                : []
              ),

              ...(
                hasSubtitlesLanguages
                ? ["--no-subtitles"]
                : []
              ),

              destinationFilePath,

              "--no-buttons",
              "--no-global-tags",
              "--no-video",

              ...(
                hasChapters
                ? []
                : ["--no-chapters"]
              ),

              ...(
                offsetInMilliseconds
                ? [
                  "--sync",
                  `-1:${offsetInMilliseconds}`,
                ]
                : []
              ),

              ...(
                (
                  (
                    getIsVideoFile(
                      sourceFilePath
                    )
                  )
                  && hasAudioLanguages
                )
                ? [
                  "--audio-tracks",
                  (
                    audioLanguages
                    .join(",")
                  ),
                ]
                : ["--no-audio"]
              ),

              ...(
                (
                  (
                    getIsVideoFile(
                      sourceFilePath
                    )
                  )
                  && hasSubtitlesLanguages
                )
                ? [
                  "--subtitle-tracks",
                  (
                    subtitlesLanguages
                    .join(",")
                  ),
                ]
                : ["--no-subtitles"]
              ),

              sourceFilePath,
            ],
            outputFilePath: (
              destinationFilePath
              .replace(
                (
                  dirname(
                    destinationFilePath
                  )
                ),
                (
                  join(
                    (
                      dirname(
                        destinationFilePath
                      )
                    ),
                    replacedTracksFolderName,
                  )
                ),
              )
            )
          })
        )),
      )
    )
    : (
      of(
        null
      )
    )
  )
}
