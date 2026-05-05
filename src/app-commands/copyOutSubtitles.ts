import {
  concatAll,
  concatMap,
  filter,
  from,
  map,
  tap,
  toArray,
} from "rxjs"

import { catchNamedError } from "../tools/catchNamedError.js"
import { extractSubtitles, extractSubtitlesDefaultProps } from "../cli-spawn-operations/extractSubtitles.js"
import { filterIsVideoFile } from "../tools/filterIsVideoFile.js"
import { getMkvInfo } from "../tools/getMkvInfo.js"
import { type Iso6392LanguageCode } from "../tools/iso6392LanguageCodes.js"
import { getFilesAtDepth } from "../tools/getFilesAtDepth.js"

type CopyOutSubtitlesRequiredProps = {
  isRecursive: boolean
  sourcePath: string
  subtitlesLanguage?: Iso6392LanguageCode
}

type CopyOutSubtitlesOptionalProps = {
  outputFolderName?: string
}

export type CopyOutSubtitlesProps = CopyOutSubtitlesRequiredProps & CopyOutSubtitlesOptionalProps

export const copyOutSubtitlesDefaultProps = {
  outputFolderName: extractSubtitlesDefaultProps.outputFolderName,
} satisfies CopyOutSubtitlesOptionalProps

export const copyOutSubtitles = ({
  isRecursive,
  outputFolderName = copyOutSubtitlesDefaultProps.outputFolderName,
  sourcePath,
  subtitlesLanguage,
}: CopyOutSubtitlesProps) => (
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
              (
                (
                  track
                  .type
                )
                === "subtitles"
              )
              && (
                subtitlesLanguage
                ? (
                  (
                    track
                    .properties
                    .language
                  )
                  === subtitlesLanguage
                )
                : true
              )
            )),
            concatMap((
              track,
            ) => (
              extractSubtitles({
                codec_id: (
                  (
                    track
                    .properties
                    .codec_id
                  ) as (
                    Parameters<
                      typeof extractSubtitles
                    >[0]["codec_id"]
                  )
                ),
                filePath: (
                  fileInfo
                  .fullPath
                ),
                languageCode: (
                  track
                  .properties
                  .language
                ),
                outputFolderName,
                trackId: (
                  (
                    track
                    .properties
                    .number
                  )
                  - 1
                ),
              })
            )),
          )
        )),
      )
    )),
    concatAll(),
    toArray(),
    catchNamedError(
      copyOutSubtitles
    ),
  )
)
