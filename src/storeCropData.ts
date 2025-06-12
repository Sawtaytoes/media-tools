import { writeFile } from "node:fs/promises"
import { cpus } from "node:os"
import { join } from "node:path"
import {
  concatMap,
  filter,
  from,
  map,
  mergeAll,
  of,
  reduce,
  tap,
} from "rxjs"

import { catchNamedError } from "./catchNamedError.js"
import { filterIsVideoFile } from "./filterIsVideoFile.js"
import {
  getCropData,
  getRelativeAspectRatio,
  type AspectRatioCalculation,
} from "./getCropData.js"
import {
  getMediaInfo,
  type VideoTrack,
} from "./getMediaInfo.js"
import { logInfo } from "./logMessage.js"
import { readFilesAtDepth } from "./readFilesAtDepth.js"

export const storeCropData = ({
  isRecursive,
  recursiveDepth,
  sourcePath,
}: {
  isRecursive: boolean
  recursiveDepth: number
  sourcePath: string
}) => (
  readFilesAtDepth({
    depth: (
      isRecursive
      ? (
        recursiveDepth
        || 1
      )
      : 0
    ),
    sourcePath,
  })
  .pipe(
    filterIsVideoFile(),
    map((
      fileInfo,
    ) => (
      from(
        getMediaInfo(
          fileInfo
          .fullPath
        ),
      )
      .pipe(
        filter(
          Boolean
        ),
        map(({
          media,
        }) => (
          media
        )),
        filter(
          Boolean
        ),
        concatMap(({
          track,
        }) => (
          track
        )),
        filter((
          track,
        ): track is VideoTrack => (
          (
            track
            ["@type"]
          )
          === "Video"
        )),
      )
      .pipe(
        map(({
          DisplayAspectRatio: displayAspectRatio,
          Duration: duration,
          HDR_Format_Compatibility: hdrFormatCompatibility,
          Height: height,
          transfer_characteristics: transferCharacteristics,
          Width: width,
        }) => (
          {
          displayAspectRatio: (
            Number(
              displayAspectRatio
            )
            .toFixed(2)
          ),
          duration: (
            Math
            .floor(
              Number(
                duration
              )
            )
          ),
          isAnamorphic: (
            displayAspectRatio
            !== (
              (
                Number(width)
                / Number(height)
              )
              .toFixed(3)
            )
          ),
          isHdr: (
            Boolean(
              (
                transferCharacteristics
                === "PQ"
              )
              || (
                transferCharacteristics
                ?.includes('HLG')
              )
              || (
                hdrFormatCompatibility
                === 'HDR10'
              )
              || (
                hdrFormatCompatibility
                ?.endsWith('HDR10')
              )
            )
          )
        })),
        concatMap(({
          duration,
          displayAspectRatio,
          isAnamorphic,
          isHdr,
        }) => (
          isAnamorphic
          ? (
            of({
              exactMaxHeightAspectRatio: displayAspectRatio,
              exactMedianAspectRadio: displayAspectRatio,
              relativeMaxHeightAspectRatio: getRelativeAspectRatio(
                  displayAspectRatio
                ),
              relativeMedianAspectRadio: getRelativeAspectRatio(
                  displayAspectRatio
                ),
            } satisfies (
              AspectRatioCalculation
            ))
          )
          : (
            getCropData({
              duration,
              filePath: (
                fileInfo
                .fullPath
              ),
              isHdr,
            })
          )
        )),
        filter(
          Boolean
        ),
        map((
          aspectRatioCalculation,
        ) => ({
          aspectRatioCalculation,
          fileInfo,
        })),
        tap((
          cropData,
        ) => {
          logInfo(
            "CALCULATED ASPECT RATIOS",
            (
              fileInfo
              .fullPath
            ),
            // cropData,
          )
        }),
      )
    )),
    mergeAll(
      cpus()
      .length
    ),
    reduce(
      (
        aspectRatioCalculationData,
        {
          aspectRatioCalculation,
          fileInfo,
        }
      ) => ({
        ...aspectRatioCalculationData,
        [
          fileInfo
          .fullPath
        ]: {
          ...aspectRatioCalculation,
          filename: (
            fileInfo
            .filename
          ),
          filePath: (
            fileInfo
            .fullPath
          ),
        }
      }),
      {} satisfies (
        Record<
          string,
          AspectRatioCalculation
        >
      )
    ),
    concatMap((
      aspectRatioCalculationData,
    ) => (
      writeFile(
        (
          join(
            sourcePath,
            "aspectRatioCalculations.json",
          )
        ),
        (
          JSON
          .stringify(
            aspectRatioCalculationData,
          )
        ),
      )
    )),
    catchNamedError(
      storeCropData
    ),
  )
)
