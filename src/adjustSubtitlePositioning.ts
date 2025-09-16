import { readFile, writeFile } from "node:fs/promises"
import {
  concatAll,
  concatMap,
  defer,
  map,
  tap,
  toArray,
} from "rxjs"

import { catchNamedError } from "./catchNamedError.js"
import { filterIsSubtitlesFile } from "./filterIsSubtitlesFile.js"
import { getFilesAtDepth } from "./getFilesAtDepth.js"
import { logInfo } from "./logMessage.js"

export const adjustPositionString = (
  positionString: string,
  adjustmentAmount: number,
) => (
  (
    Number(
      positionString
    )
    + adjustmentAmount
  )
  .toFixed(3)
)

export const adjustSubtitlePositions = ({
  adjustmentAmountX = 0,
  adjustmentAmountY = 0,
  isRecursive,
  recursiveDepth,
  sourcePath,
}: {
  adjustmentAmountX?: number
  adjustmentAmountY?: number
  isRecursive: boolean
  recursiveDepth: number
  sourcePath: string
}) => (
  getFilesAtDepth({
    depth: (
      isRecursive
      ? (
        recursiveDepth
        || 2
      )
      : 0
    ),
    sourcePath,
  })
  .pipe(
    filterIsSubtitlesFile(),
    map((
      fileInfo,
    ) => (
      defer(() => (
        readFile(
          (
            fileInfo
            .fullPath
          ),
          "utf-8",
        )
      ))
      .pipe(
        map((
          fileContents
        ) => (
          fileContents
          .toString()
          .split("\n")
          .map((
            lineString
          ) => {
            const matches = (
              lineString
              .match(
                /^(?<beginningString>.*\\pos\()(?<positionX>[\d.]+?),(?<positionY>[\d.]+?)(?<endingString>\).*)$/
              )
            )

            return (
              (
                matches?.groups?.beginningString
                && matches?.groups?.endingString
                && matches?.groups?.positionX
                && matches?.groups?.positionY
              )
              ? (
                matches.groups.beginningString
                .concat(
                  (
                    adjustPositionString(
                      matches.groups.positionX,
                      adjustmentAmountX,
                    )
                  ),
                  ",",
                  (
                    adjustPositionString(
                      matches.groups.positionY,
                      adjustmentAmountY,
                    )
                  ),
                  matches.groups.endingString,
                )
              )
              : lineString
            )
          })
          .join("\n")
        )),
        concatMap((
          updatedFileContents,
        ) => (
          writeFile(
            (
              fileInfo
              .fullPath
            ),
            updatedFileContents,
            "utf-8",
          )
        )),
        tap(() => {
          logInfo(
            "UPDATED SUBTITLE POSITIONS",
            (
              fileInfo
              .fullPath
            ),
          )
        }),
      )
    )),
    concatAll(),
    toArray(),
    catchNamedError(
      adjustSubtitlePositions
    ),
  )
)

adjustSubtitlePositions({
  adjustmentAmountX: 240,
  isRecursive: true,
  recursiveDepth: 2,
  sourcePath: "G:\\Downloads\\~ANIME\\GaoGaiGar - King of Braves\\work\\EXTRACTED-SUBTITLES",
})
.subscribe()
