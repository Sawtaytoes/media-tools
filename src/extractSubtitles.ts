import { sep } from "node:path";
import {
  concatMap,
  map,
  of,
} from "rxjs";

import { addFolderNameBeforeFilename } from "./addFolderNameBeforeFilename.js";
import { type Iso6392LanguageCode } from "./iso6392LanguageCodes.js";
import { EXTRACTED_SUBTITLES_FOLDER_NAME } from "./outputFolderNames.js";
import { replaceFileExtension } from "./replaceFileExtension.js";
import { runMkvExtract } from "./runMkvExtract.js";
import { subtitlesFileExtensions } from "./filterIsSubtitlesFile.js";

export const extractedSubtitlesPath = EXTRACTED_SUBTITLES_FOLDER_NAME

export const subtitleCodecExtension = {
  "S_HDMV/PGS": ".sup",
  "S_TEXT/ASS": ".ass",
  "S_TEXT/UTF8": ".srt",
} as const satisfies Record<string, typeof subtitlesFileExtensions[number]>

export const extractSubtitles = ({
  codec_id,
  filePath,
  languageCode,
  outputFolderName = extractedSubtitlesPath,
  trackId,
}: {
  codec_id: keyof typeof subtitleCodecExtension
  filePath: string
  languageCode: Iso6392LanguageCode | "und",
  outputFolderName?: string,
  trackId: number,
}) => (
  of(
    addFolderNameBeforeFilename({
      filePath,
      folderName: outputFolderName,
    })
  )
  .pipe(
    map((
      outputFilePath,
    ) => (
      replaceFileExtension({
        filePath: outputFilePath,
        fileExtension: (
          sep
          .concat(
            `track${trackId}`,
            ".",
            languageCode,
            (
              subtitleCodecExtension
              [codec_id]
            ),
          )
        ),
      })
    )),
    concatMap((
      outputFilePath,
    ) => (
      runMkvExtract({
        args: [
          "tracks",
          filePath,
          `${trackId}:${outputFilePath}`,
        ],
        outputFilePath,
      })
      .pipe(
        map(() => (
          outputFilePath
        )),
      )
    )),
  )
)
