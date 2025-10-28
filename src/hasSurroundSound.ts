import { dirname } from "node:path"
import {
  concatAll,
  concatMap,
  filter,
  groupBy,
  map,
  mergeMap,
  reduce,
  take,
  tap,
} from "rxjs"

import { catchNamedError } from "./catchNamedError.js"
import { filterIsVideoFile } from "./filterIsVideoFile.js"
import {
  getMediaInfo,
  type AudioTrack,
} from "./getMediaInfo.js"
import { getFilesAtDepth } from "./getFilesAtDepth.js"
import { logInfo } from "./logMessage.js"

export const hasSurroundSound = ({
  isRecursive,
  recursiveDepth,
  sourcePath,
}: {
  isRecursive: boolean
  recursiveDepth: number
  sourcePath: string
}) => (
  getFilesAtDepth({
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
    groupBy((
      fileInfo,
    ) => (
      dirname(
        fileInfo
        .fullPath
      )
    )),
    mergeMap((
      groupObservable,
    ) => (
      groupObservable
      .pipe(
        filterIsVideoFile(),
        map((
          fileInfo,
        ) => (
          getMediaInfo(
            fileInfo
            .fullPath
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
            ): track is AudioTrack => (
              (
                track
                ["@type"]
              )
              === "Audio"
            )),
            map((
              track,
            ) => {
              const audioFormat = (
                (
                  track
                  .Format_Commercial_IfAny
                )
                || (
                  track
                  .Format_Commercial
                )
                || (
                  track
                  .Format
                )
              )

              const channelLayout = (
                (
                  track
                  .ChannelLayout_Original
                )
                || (
                  track
                  .ChannelLayout
                )
              )

              const formatAdditionalFeatures = (
                track
                .Format_AdditionalFeatures
              )

              const numberOfChannels = (
                Number(
                  (
                    track
                    .Channels_Original
                  )
                  || (
                    track
                    .Channels
                  )
                  || 2
                )
              )

              if (
                (
                  audioFormat
                  ?.includes('Atmos')
                )
                || (
                  formatAdditionalFeatures
                  === 'XLL X'
                )
                || (
                  formatAdditionalFeatures
                  === 'XLL X IMAX'
                )
              ) {
                return {
                  channelCount: 16,
                  track,
                }
              }

              // This might not work correctly.

              const formatSettingsMode = (
                track
                .Format_Settings_Mode
              )

              if (
                formatSettingsMode
                === 'Dolby Surround EX'
              ) {
                return {
                  channelCount: 8,
                  track,
                }
              }

              // This might not work correctly.

              if (
                formatSettingsMode
                === 'Dolby Surround'
              ) {
                return {
                  channelCount: 4,
                  track,
                }
              }

              if (
                channelLayout
              ) {
                return {
                  channelCount: (
                    channelLayout
                    .split(' ')
                    .length
                  ),
                  track,
                }
              }

              return {
                channelCount: (
                  numberOfChannels
                ),
                track,
              }
            }),
            reduce(
              (
                selectedValue,
                value,
                index,
              ) => (
                (
                  (
                    selectedValue
                    .channelCount
                  )
                  >= (
                    value
                    .channelCount
                  )
                )
                ? selectedValue
                : {
                  ...value,
                  index,
                }
              ),
              {
                channelCount: 0,
                index: -1,
                track: {}
              } as {
                channelCount: number
                index: number,
                track: AudioTrack
              }
            ),
            filter(({
              channelCount
            }) => (
              channelCount
              > 2
            )),
            map((
              props,
            ) => ({
              ...props,
              fileInfo
            })),
          )
        )),
        concatAll(),
        take(1),
        tap(({
          channelCount,
          fileInfo,
          track,
        }) => {
          logInfo(
            (
              dirname(
                fileInfo
                .fullPath
              )
            ),
            (
              (
                (
                  track
                  .Format_Commercial_IfAny
                )
                || (
                  track
                  .Format_Commercial
                )
                || (
                  track
                  .Format
                )
              )
              .concat(
                " ",
                (
                  track
                  .Format_AdditionalFeatures
                )
                || ""
              )
            ),
            (
              channelCount
              .toString()
            ),
          )
        }),
      )
    )),
    catchNamedError(
      hasSurroundSound
    ),
  )
)
