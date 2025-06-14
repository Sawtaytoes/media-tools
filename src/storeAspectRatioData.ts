import { access, constants, readFile, writeFile } from "node:fs/promises"
import { cpus } from "node:os"
import { join, sep } from "node:path"
import {
  catchError,
  concatMap,
  filter,
  from,
  map,
  mergeAll,
  of,
  reduce,
  tap,
  toArray,
} from "rxjs"

import { catchNamedError } from "./catchNamedError.js"
import { filterIsVideoFile } from "./filterIsVideoFile.js"
import {
  getAspectRatioData,
  getRelativeAspectRatio,
  type AspectRatioCalculation,
} from "./getAspectRatioData.js"
import {
  getMediaInfo,
  type VideoTrack,
} from "./getMediaInfo.js"
import { logInfo } from "./logMessage.js"
import { readFilesAtDepth } from "./readFilesAtDepth.js"

export type AspectRatioData = (
  Record<
    string,
    {
      aspectRatioCalculation: AspectRatioCalculation
      filename: string
      fullPath: string
    }
  >
)

export const replaceRootPath = ({
  filePath,
  fileSeparator = sep,
  newSourcePath,
  oldSourcePath,
}: {
  filePath: string
  fileSeparator?: (
    | "/"
    | "\\"
  )
  newSourcePath: string
  oldSourcePath: string
}) => (
  filePath
  .replace(
    (
      oldSourcePath
      .replace(
        /[\\\/]$/,
        "",
      )
      .concat(
        fileSeparator
      )
    ),
    (
      newSourcePath
      .replace(
        /[\\\/]$/,
        "",
      )
      .concat(
        fileSeparator
      )
    )
  )
  .split(
    fileSeparator
  )
  .join(
    (
      newSourcePath
      .includes(
        "/"
      )
    )
    ? "/"
    : "\\"
  )
)

export const storeAspectRatioData = ({
  folderNames,
  isRecursive,
  mode = "append",
  outputPath,
  recursiveDepth,
  rootPath,
  sourcePath,
  threadCount = (
      cpus()
      .length
  ),
}: {
  folderNames: string[]
  isRecursive: boolean
  mode?: (
    | "append"
    | "overwrite"
  )
  outputPath?: string
  recursiveDepth: number
  rootPath?: string
  sourcePath: string
  threadCount?: number
}) => (
  of(
    join(
      (
        outputPath
        || sourcePath
      ),
      "aspectRatioCalculations.json",
    )
  )
  .pipe(
    concatMap((
      jsonFilePath,
    ) => (
      mode === "append"
      ? (
        from(
          access(
            jsonFilePath,
            (
              constants
              .F_OK
            ),
          )
        )
        .pipe(
          concatMap(() => (
            readFile(
              jsonFilePath
            )
          )),
          map((
            jsonFileData,
          ) => (
            JSON
            .parse(
              jsonFileData
              .toString()
            ) as (
              AspectRatioData
            )
          )),
          catchError(() => (
            of(
              {}
            )
          )),
          map((
            jsonFileData,
          ) => ({
            jsonFileData,
            jsonFilePath,
          })),
        )
      )
      : (
        of({
          jsonFileData: {},
          jsonFilePath,
        })
      )
    )),
    concatMap(({
      jsonFileData,
      jsonFilePath,
    }) => (
      (
        (
          folderNames
          .length
        )
        ? (
          from(
            folderNames
          )
          .pipe(
            concatMap((
              folderName,
            ) => (
              readFilesAtDepth({
                depth: (
                  isRecursive
                  ? (
                    recursiveDepth - 1
                    || 0
                  )
                  : 0
                ),
                sourcePath: (
                  join(
                    sourcePath,
                    folderName,
                  )
                ),
              })
            )),
          )
        )
        : (
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
        )
      )
      .pipe(
        filterIsVideoFile(),
        map((
          fileInfo,
        ) => ({
          localMediaFilePath: (
            fileInfo
            .fullPath
          ),
          plexMediaFilePath: (
            rootPath
            ? (
              replaceRootPath({
                filePath: (
                  fileInfo
                  .fullPath
                ),
                newSourcePath: rootPath,
                oldSourcePath: sourcePath,
              })
            )
            : (
              fileInfo
              .fullPath
            )
          ),
        })),
        map(({
          localMediaFilePath,
          plexMediaFilePath,
        }) => (
          of(
            plexMediaFilePath
          )
          .pipe(
            filter(() => (
              mode === "append"
              ? (
                !(
                  plexMediaFilePath
                  in jsonFileData
                )
              )
              : true
            )),
            map(() => ({
              localMediaFilePath,
              plexMediaFilePath,
            }))
          )
        )),
        mergeAll(
          threadCount
        ),
        toArray(),
        map((
          filePaths,
        ) => ({
          filePaths,
          jsonFileData,
          jsonFilePath,
        })),
      )
    )),
    concatMap(({
      filePaths,
      jsonFileData,
      jsonFilePath,
    }) => (
      from(
        filePaths
      )
      .pipe(
        map(({
          localMediaFilePath,
          plexMediaFilePath,
        }) => (
          from(
            getMediaInfo(
              localMediaFilePath
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
            }) => ({
              displayAspectRatio: (
                Number(
                  displayAspectRatio
                )
              ),
              duration: (
                Math
                .floor(
                  Number(
                    duration
                  )
                )
              ),
              height,
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
              ),
              videoAspectRatio: (
                Number(width)
                / Number(height)
              ),
            })),
            concatMap(({
              duration,
              displayAspectRatio,
              isAnamorphic,
              isHdr,
              videoAspectRatio,
            }) => (
              getAspectRatioData({
                anamorphicCorrectionMultiplier: (
                  isAnamorphic
                  ? (
                    displayAspectRatio
                    / videoAspectRatio
                  )
                  : 1
                ),
                duration,
                filePath: (
                  localMediaFilePath
                ),
                isHdr,
              })
            )),
            filter(
              Boolean
            ),
            map((
              aspectRatioCalculation,
            ) => ({
              aspectRatioCalculation,
              localMediaFilePath,
              plexMediaFilePath,
            })),
            tap(() => {
              logInfo(
                "CALCULATED ASPECT RATIOS",
                localMediaFilePath,
              )
            }),
          )
        )),
        mergeAll(
          threadCount
        ),
        reduce(
          (
            aspectRatioCalculationData,
            {
              aspectRatioCalculation,
              plexMediaFilePath,
            }
          ) => ({
            ...aspectRatioCalculationData,
            [plexMediaFilePath]: (
              aspectRatioCalculation
            ),
          }),
          jsonFileData,
        ),
        map((
          aspectRatioCalculationData,
        ) => ({
          aspectRatioCalculationData,
          jsonFilePath,
        }))
      )
    )),
    concatMap(({
      aspectRatioCalculationData,
      jsonFilePath,
    }) => (
      writeFile(
        jsonFilePath,
        (
          JSON
          .stringify(
            aspectRatioCalculationData
          )
        ),
      )
    )),
    catchNamedError(
      storeAspectRatioData
    ),
  )
)
