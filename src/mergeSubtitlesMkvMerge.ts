import path, {
  dirname,
  join,
} from "node:path"
import {
  concatMap,
  endWith,
} from "rxjs";

import { type Iso6392LanguageCode } from "./iso6392LanguageCodes.js"
import { SUBTITLED_FOLDER_NAME } from "./outputFolderNames.js"
import { runMkvMerge } from "./runMkvMerge.js";
import {
  defineLanguageForUndefinedTracks,
} from "./defineLanguageForUndefinedTracks.js";

export const subtitledFolderName = SUBTITLED_FOLDER_NAME

export const mergeSubtitlesMkvMerge = ({
  attachmentFilePaths,
  destinationFilePath,
  chaptersFilePath,
  offsetInMilliseconds,
  outputFolderName = subtitledFolderName,
  subtitlesFilesPaths,
  subtitlesLanguage,
}: {
  attachmentFilePaths: string[],
  destinationFilePath: string,
  chaptersFilePath?: string,
  offsetInMilliseconds?: number,
  outputFolderName?: string,
  subtitlesFilesPaths: string[],
  subtitlesLanguage: Iso6392LanguageCode,
}) => (
  runMkvMerge({
    args: [
      "--no-subtitles",

      destinationFilePath,

      "--no-video",
      "--no-audio",
      "--no-chapters",
      "--no-buttons",
      "--no-global-tags",

      ...(
        offsetInMilliseconds
        ? [
          "--sync",
          `-1:${offsetInMilliseconds}`,
        ]
        : []
      ),

      ...subtitlesFilesPaths,

      ...(
        chaptersFilePath
        ? [
          "--chapters",
          chaptersFilePath,
        ]
        : []
      ),

      ...(
        (
          attachmentFilePaths
          || []
        )
        .flatMap((
          attachmentFilePath,
        ) => ([
          "--attach-file",
          attachmentFilePath,
        ]))
      ),
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
            outputFolderName,
          )
        ),
      )
    )
  })
  .pipe(
    concatMap(() => (
      defineLanguageForUndefinedTracks({
        filePath: (
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
                outputFolderName,
              )
            ),
          )
        ),
        subtitleLanguage: subtitlesLanguage,
        trackType: "subtitles",
      })
      .pipe(
        // TODO: Remove this. It's causing 2 logs instead of 1.
        // This would normally go to the next step in the pipeline, but there are sometimes no "und" language tracks, so we need to utilize this `endWith` to continue in the event the `filter` stopped us.
        endWith(
          null
        ),
      )
    )),
  )
)
