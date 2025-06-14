import {
  cpus,
} from "node:os"
import {
  bufferCount,
  filter,
  from,
  map,
  mergeAll,
  Observable,
  reduce,
  tap,
} from "rxjs";

import { runCustomFfmpeg } from "./runCustomFfmpeg.js";

export type AspectRatioCalculation = {
  exactMaxHeightAspectRatio: string
  exactMedianAspectRadio: string
  relativeMaxHeightAspectRatio: string
  relativeMedianAspectRadio: string
}

export const ffmpegCropdetectRegex = /lavfi\.cropdetect\.(?<measurementType>\w)=(?<measurementValue>.+)/

export const minimumAspectRatios = [
  1.33,
  1.37,
  1.78,
  1.85,
  1.90,
  2.10,
  2.39,
] as const

export const getAspectRatio = ({
  anamorphicCorrectionMultiplier = 1,
  height,
  width,
}: {
  anamorphicCorrectionMultiplier?: number
  height: number
  width: number
}) => (
  (
    (
      width
      / height
    )
    * anamorphicCorrectionMultiplier
  )
  .toFixed(2)
)

export const getRelativeAspectRatio = (
  aspectRatio: (
    | string
    | number
  )
) => {
  const exactAspectRatio = (
    Number(
      aspectRatio
    )
  )

  const relativeAspectRatio = (
    minimumAspectRatios
    .find((
      minimumAspectRatio,
    ) => (
      Math
      .min(
        Number(
          minimumAspectRatio
        )
        + 0.02,
        exactAspectRatio,
      )
      === (
        exactAspectRatio
      )
    ))
  )

  return (
    relativeAspectRatio
    ? (
      relativeAspectRatio
      .toFixed(2)
    )
    : "OUT_OF_RANGE"
  )
}

export const getArgsForSeconds = ({
  filePath,
  isHdr,
  seconds,
}: {
  filePath: string
  isHdr: boolean
  seconds: number,
}) => ([
  "-hide_banner",

  "-loglevel",
  "info",

  "-skip_frame",
  "nokey",

  "-ss",
  (
    String(
      seconds
    )
  ),

  "-i",
  filePath,

  "-threads",
  "1",

  "-map",
  "0:v",

  "-frames:v",
  "1",

  "-vf",
  (
    (
      isHdr
      ? "zscale=transfer=bt709,format=yuv420p,"
      : ""
    )
    .concat(
      // Not available in ffmpeg v5 used in the Docker container
      // "cropdetect=mode=black:mv_threshold=0,"
      "cropdetect=skip=0:limit=16:round=4,metadata=mode=print:file='pipe\\:1'"
    )
  ),

  "-f",
  "null",
  "-",
])

export const getAspectRatioData = ({
  anamorphicCorrectionMultiplier = 1,
  duration,
  filePath,
  isHdr,
  threadCount = (
    cpus()
    .length
  ),
}: {
  /**
   * When anamorphic, pass this in to compute the aspect ratio relative to: `(displayAspectRatio / (videoWidth / videoHeight))`.
  */
  anamorphicCorrectionMultiplier?: number
  duration: number
  filePath: string
  isHdr: boolean
  threadCount?: number
}): (
  Observable<
    AspectRatioCalculation
  >
) => (
  from(
    Array(32)
    .fill(null)
    .map((
      _,
      index,
    ) => (
      (
        Math
        .floor(duration / 32)
      )
      * index
    ))
    .slice(1, -1)
  )
  .pipe(
    map((
      seconds,
    ) => (
      getArgsForSeconds({
        filePath,
        isHdr,
        seconds,
      })
    )),
    map((
      args,
    ) => (
      runCustomFfmpeg({
        args,
      })
    )),
    mergeAll(
      threadCount
    ),
    filter((
      output,
    ) => (
      output
      .startsWith(
        "lavfi.cropdetect.h"
      )
      || (
        output
        .startsWith(
          "lavfi.cropdetect.w"
        )
      )
    )),
    map((
      output,
    ) => (
      output
      .match(
        ffmpegCropdetectRegex
      )
    )),
    filter(
      Boolean
    ),
    map((
      match,
    ) => (
      match
      .groups!
    )),
    map(({
      measurementType,
      measurementValue,
    }) => ({
      [measurementType]: (
        Number(
          measurementValue
        )
      ),
    })),
    bufferCount(
      2
    ),
  )
  .pipe(
    map((
      measurementInfos
    ) => (
      measurementInfos
      .reduce(
        (
          measurements: {
            h: number,
            w: number,
          },
          measurement,
        ) => ({
          ...measurements,
          ...measurement,
        }),
        {} as {
          h: number,
          w: number,
        },
      )
    )),
    map(({
      h,
      w,
    }) => ({
      height: h,
      width: w,
    })),
    reduce(
      (
        cropData,
        {
          height,
          width,
        },
      ) => {
        const identifier = `${width}x${height}`

        if (identifier in cropData) {
          const {
            count,
          } = (
            cropData
            [identifier]
          )

          return {
            ...cropData,
            [identifier]: (
              cropData
              [identifier] = {
                ...(
                  cropData
                  [identifier]
                ),
                count: (
                  count
                  + 1
                ),
              }
            )
          }
        }
        else {
          return {
            ...cropData,
            [identifier]: {
              count: 1,
              height,
              width,
            }
          }
        }
      },
      {} as (
        Record<
          string,
          {
            count: number,
            height: number,
            width: number,
          }
        >
      ),
    ),
    map((
      cropData,
    ) => {
      const cropDataValues = (
        Object
        .values(
          cropData
        )
      )

      const maxHeightCrop = {
        ...(
          cropDataValues
          .sort((
            a,
            b,
          ) => (
            b.height
            - a.height
          ))
          .at(0)!
        ),
        anamorphicCorrectionMultiplier,
      }

      const medianCrop = {
        ...(
          cropDataValues
          .sort((
            a,
            b,
          ) => (
            b.count
            - a.count
          ))
          .at(0)!
        ),
        anamorphicCorrectionMultiplier,
      }

      return {
        exactMaxHeightAspectRatio: (
          getAspectRatio(
            maxHeightCrop
          )
        ),
        exactMedianAspectRadio: (
          getAspectRatio(
            medianCrop
          )
        ),
        relativeMaxHeightAspectRatio: (
          getRelativeAspectRatio(
            getAspectRatio(
              maxHeightCrop
            )
          )
        ),
        relativeMedianAspectRadio: (
          getRelativeAspectRatio(
            getAspectRatio(
              medianCrop
            )
          )
        ),
      }
    }),
  )
)
