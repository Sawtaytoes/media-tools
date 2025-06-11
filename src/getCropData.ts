import {
  concatAll,
  filter,
  map,
  reduce,
  tap,
  toArray,
} from "rxjs";

import { runFfmpegNullOutput } from "./runFfmpegNullOutput.js";
import { formatResolutionName } from "./resolutionHelpers.js";

export const ffmpegCropdetectRegex = /crop=(\d+):(\d+):(\d+):(\d+)/

export const getCropData = ({
  filePath,
  isHdr,
}: {
  filePath: string
  isHdr: boolean
}) => (
  runFfmpegNullOutput({
    args: [
      // "-hwaccel",
      // "none", // Do we need this? If so, it has to happen before the input filename.

      "-ss",
      "00:01:00",

      "-t",
      "10",

      "-vf",
      (
        isHdr
        ? "zscale=transfer=bt709,format=yuv420p,cropdetect=limit=5:round=2:reset=0"
        : "format=yuv420p,cropdetect=limit=5:round=2:reset=0"
      ),

      "-f",
      "null",
      "-",
    ],
    inputFilePaths: [
      filePath
    ],
  })
  .pipe(
    map((
      line,
    ) => (
      line
      .match(ffmpegCropdetectRegex)
    )),
    filter(
      Boolean
    ),
    map(([
      // Order matters
      _,
      width,
      height,
      // x,
      // y,
    ]) => ({
      height: (
        Number(
          height
        )
      ),
      width: (
        Number(
          width
        )
      ),
      // height,
      // width,
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
    tap(t => console.log(t)),
    map((
      cropData,
    ) => {
      const cropDataValues = (
        Object
        .values(
          cropData
        )
      )

      const maxHeightCrop = (
        cropDataValues
        .sort((
          a,
          b,
        ) => (
          b.height
          - a.height
        ))
        .at(0)!
      )

      const medianCrop = (
        cropDataValues
        .sort((
          a,
          b,
        ) => (
          b.count
          - a.count
        ))
        .at(0)!
      )

      return {
        maxHeightAspectRatio: (
          formatResolutionName({
            height: (
              String(
                maxHeightCrop
                .height
              )
            ),
            width: (
              String(
                maxHeightCrop
                .width
              )
            ),
          })
        ),
        medianAspectRadio: (
          formatResolutionName({
            height: (
              String(
                medianCrop
                .height
              )
            ),
            width: (
              String(
                medianCrop
                .width
              )
            ),
          })
        ),
      }
    }),
  )
)
