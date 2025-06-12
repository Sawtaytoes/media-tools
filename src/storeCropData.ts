import { writeFile } from "node:fs/promises"
import { cpus } from "node:os"
import { join } from "node:path"
import {
  concatAll,
  concatMap,
  filter,
  from,
  map,
  mergeAll,
  of,
  reduce,
  take,
  tap,
} from "rxjs"

import { catchNamedError } from "./catchNamedError.js"
import { filterIsVideoFile } from "./filterIsVideoFile.js"
import { readFilesAtDepth } from "./readFilesAtDepth.js"
import { AspectRatioCalculation, getCropData } from "./getCropData.js"
import { getMediaInfo, VideoTrack } from "./getMediaInfo.js"

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
    take(20),
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
              relativeMaxHeightAspectRatio: displayAspectRatio,
              relativeMedianAspectRadio: displayAspectRatio,
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
          console
          .info(
            (
              fileInfo
              .fullPath
            ),
            "\n",
            cropData,
            "\n",
            "\n",
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
          .filename
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
