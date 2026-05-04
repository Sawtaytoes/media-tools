import {
  Observable,
} from "rxjs"

import { catchNamedError } from "./catchNamedError.js"
import { type Iso6392LanguageCode } from "./iso6392LanguageCodes.js"
import { LANGUAGE_TRIMMED_FOLDER_NAME } from "./outputFolderNames.js"
import { runMkvMerge } from "./runMkvMerge.js";
import { dirname, join } from "node:path";

export const languageTrimmedFolderName = LANGUAGE_TRIMMED_FOLDER_NAME

export const keepSpecifiedLanguageTracks = ({
  audioLanguages,
  filePath,
  outputFolderName = languageTrimmedFolderName,
  subtitlesLanguages,
}: {
  audioLanguages: Iso6392LanguageCode[],
  filePath: string,
  outputFolderName?: string,
  subtitlesLanguages: Iso6392LanguageCode[],
}): (
  Observable<
    string
  >
) => {
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
    runMkvMerge({
      args: [
        ...(
          hasAudioLanguages
          ? [
            "--audio-tracks",
            (
              audioLanguages
              .join(",")
            ),
          ]
          : []
        ),

        ...(
          hasSubtitlesLanguages
          ? [
            "--subtitle-tracks",
            (
              subtitlesLanguages
              .join(",")
            ),
          ]
          : []
        ),

        filePath,
      ],
      outputFilePath: (
        filePath
        .replace(
          (
            dirname(
              filePath
            )
          ),
          (
            join(
              (
                dirname(
                  filePath
                )
              ),
              outputFolderName,
            )
          ),
        )
      )
    })
    .pipe(
      catchNamedError(
        keepSpecifiedLanguageTracks
      ),
    )
  )
}
