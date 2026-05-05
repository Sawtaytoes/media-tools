import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi"
import { type Context } from "hono"
import { type Observable } from "rxjs"

import { changeTrackLanguages } from "../../changeTrackLanguages.js"
import { copyFiles } from "../../copyFiles.js"
import { copyOutSubtitles, copyOutSubtitlesDefaultProps } from "../../copyOutSubtitles.js"
import { fixIncorrectDefaultTracks } from "../../fixIncorrectDefaultTracks.js"
import { getAudioOffsets, getAudioOffsetsDefaultProps } from "../../getAudioOffsets.js"
import { hasBetterAudio } from "../../hasBetterAudio.js"
import { hasBetterVersion } from "../../hasBetterVersion.js"
import { hasDuplicateMusicFiles } from "../../hasDuplicateMusicFiles.js"
import { hasImaxEnhancedAudio } from "../../hasImaxEnhancedAudio.js"
import { hasManyAudioTracks } from "../../hasManyAudioTracks.js"
import { hasSurroundSound } from "../../hasSurroundSound.js"
import { hasWrongDefaultTrack } from "../../hasWrongDefaultTrack.js"
import { isMissingSubtitles } from "../../isMissingSubtitles.js"
import { keepLanguages, keepLanguagesDefaultProps } from "../../keepLanguages.js"
import { mergeTracks, mergeTracksDefaultProps } from "../../mergeTracks.js"
import { moveFiles } from "../../moveFiles.js"
import { nameAnimeEpisodes } from "../../nameAnimeEpisodes.js"
import { nameSpecialFeatures } from "../../nameSpecialFeatures.js"
import { nameTvShowEpisodes } from "../../nameTvShowEpisodes.js"
import { renameDemos } from "../../renameDemos.js"
import { renameMovieClipDownloads } from "../../renameMovieClipDownloads.js"
import { reorderTracks, reorderTracksDefaultProps } from "../../reorderTracks.js"
import { replaceAttachments, replaceAttachmentsDefaultProps } from "../../replaceAttachments.js"
import { replaceFlacWithPcmAudio, replaceFlacWithPcmAudioDefaultProps } from "../../replaceFlacWithPcmAudio.js"
import { replaceTracks, replaceTracksDefaultProps } from "../../replaceTracks.js"
import { setDisplayWidth } from "../../setDisplayWidth.js"
import { splitChapters, splitChaptersDefaultProps } from "../../splitChapters.js"
import { storeAspectRatioData } from "../../storeAspectRatioData.js"
import { createJob } from "../jobStore.js"
import { runJob } from "../jobRunner.js"
import * as schemas from "../schemas.js"

const startCommandJob = ({
  command,
  commandObservable,
  context,
  outputFolderName = null,
  params,
}: {
  command: string,
  commandObservable: Observable<unknown>,
  context: Context,
  outputFolderName?: string | null,
  params: unknown,
}) => {
  const job = createJob({
    commandName: command,
    params,
    outputFolderName,
  })

  runJob(job.id, commandObservable)

  return context.json(
    {
      jobId: job.id,
      logsUrl: `/jobs/${job.id}/logs`,
      outputFolderName,
    },
    202,
  )
}

const commandNames = [
  "changeTrackLanguages",
  "copyFiles",
  "copyOutSubtitles",
  "fixIncorrectDefaultTracks",
  "getAudioOffsets",
  "hasBetterAudio",
  "hasBetterVersion",
  "hasDuplicateMusicFiles",
  "hasImaxEnhancedAudio",
  "hasManyAudioTracks",
  "hasSurroundSound",
  "hasWrongDefaultTrack",
  "isMissingSubtitles",
  "keepLanguages",
  "mergeTracks",
  "moveFiles",
  "nameAnimeEpisodes",
  "nameSpecialFeatures",
  "nameTvShowEpisodes",
  "renameDemos",
  "renameMovieClipDownloads",
  "reorderTracks",
  "replaceAttachments",
  "replaceFlacWithPcmAudio",
  "replaceTracks",
  "setDisplayWidth",
  "splitChapters",
  "storeAspectRatioData",
] as const

export type CommandName = typeof commandNames[number]

type CommandConfig = {
  getObservable: (body: any) => Observable<unknown>
  outputFolderName?: string
  schema: z.ZodTypeAny
  summary: string
  tags: string[]
}

const commandConfigs: Record<CommandName, CommandConfig> = {
  changeTrackLanguages: {
    getObservable: (body) => changeTrackLanguages({ audioLanguage: body.audioLanguage, isRecursive: body.isRecursive, sourcePath: body.sourcePath, subtitlesLanguage: body.subtitlesLanguage, videoLanguage: body.videoLanguage }),
    schema: schemas.changeTrackLanguagesRequestSchema,
    summary: "Change language tags for media tracks",
    tags: ["Track Operations"],
  },
  copyFiles: {
    getObservable: (body) => copyFiles({ destinationPath: body.destinationPath, sourcePath: body.sourcePath }),
    schema: schemas.copyFilesRequestSchema,
    summary: "Copy files from source to destination",
    tags: ["File Operations"],
  },
  copyOutSubtitles: {
    getObservable: (body) => copyOutSubtitles({ isRecursive: body.isRecursive, sourcePath: body.sourcePath, subtitlesLanguage: body.subtitlesLanguage }),
    outputFolderName: copyOutSubtitlesDefaultProps.outputFolderName,
    schema: schemas.copyOutSubtitlesRequestSchema,
    summary: "Extract subtitle files from media files",
    tags: ["Subtitle Operations"],
  },
  fixIncorrectDefaultTracks: {
    getObservable: (body) => fixIncorrectDefaultTracks({ isRecursive: body.isRecursive, sourcePath: body.sourcePath }),
    schema: schemas.fixIncorrectDefaultTracksRequestSchema,
    summary: "Fix incorrect default track designations",
    tags: ["Track Operations"],
  },
  getAudioOffsets: {
    getObservable: (body) => getAudioOffsets({ destinationFilesPath: body.destinationFilesPath, sourceFilesPath: body.sourceFilesPath }),
    outputFolderName: getAudioOffsetsDefaultProps.outputFolderName,
    schema: schemas.getAudioOffsetsRequestSchema,
    summary: "Calculate audio synchronization offsets between files",
    tags: ["Audio Operations"],
  },
  hasBetterAudio: {
    getObservable: (body) => hasBetterAudio({ isRecursive: body.isRecursive, recursiveDepth: body.recursiveDepth, sourcePath: body.sourcePath }),
    schema: schemas.hasBetterAudioRequestSchema,
    summary: "Analyze and compare audio quality across files",
    tags: ["Analysis"],
  },
  hasBetterVersion: {
    getObservable: (body) => hasBetterVersion({ isRecursive: body.isRecursive, recursiveDepth: body.recursiveDepth, sourcePath: body.sourcePath }),
    schema: schemas.hasBetterVersionRequestSchema,
    summary: "Check if better version of media exists",
    tags: ["Analysis"],
  },
  hasDuplicateMusicFiles: {
    getObservable: (body) => hasDuplicateMusicFiles({ isRecursive: body.isRecursive, recursiveDepth: body.recursiveDepth, sourcePath: body.sourcePath }),
    schema: schemas.hasDuplicateMusicFilesRequestSchema,
    summary: "Identify duplicate music files",
    tags: ["Analysis"],
  },
  hasImaxEnhancedAudio: {
    getObservable: (body) => hasImaxEnhancedAudio({ isRecursive: body.isRecursive, sourcePath: body.sourcePath }),
    schema: schemas.hasImaxEnhancedAudioRequestSchema,
    summary: "Check for IMAX enhanced audio tracks",
    tags: ["Analysis"],
  },
  hasManyAudioTracks: {
    getObservable: (body) => hasManyAudioTracks({ isRecursive: body.isRecursive, sourcePath: body.sourcePath }),
    schema: schemas.hasManyAudioTracksRequestSchema,
    summary: "Identify files with many audio tracks",
    tags: ["Analysis"],
  },
  hasSurroundSound: {
    getObservable: (body) => hasSurroundSound({ isRecursive: body.isRecursive, recursiveDepth: body.recursiveDepth, sourcePath: body.sourcePath }),
    schema: schemas.hasSurroundSoundRequestSchema,
    summary: "Check for surround sound audio tracks",
    tags: ["Analysis"],
  },
  hasWrongDefaultTrack: {
    getObservable: (body) => hasWrongDefaultTrack({ isRecursive: body.isRecursive, sourcePath: body.sourcePath }),
    schema: schemas.hasWrongDefaultTrackRequestSchema,
    summary: "Find files with incorrect default track selection",
    tags: ["Analysis"],
  },
  isMissingSubtitles: {
    getObservable: (body) => isMissingSubtitles({ isRecursive: body.isRecursive, sourcePath: body.sourcePath }),
    schema: schemas.isMissingSubtitlesRequestSchema,
    summary: "Identify media files missing subtitle tracks",
    tags: ["Subtitle Operations"],
  },
  keepLanguages: {
    getObservable: (body) => keepLanguages({ audioLanguages: body.audioLanguages, hasFirstAudioLanguage: body.useFirstAudioLanguage, hasFirstSubtitlesLanguage: body.useFirstSubtitlesLanguage, isRecursive: body.isRecursive, sourcePath: body.sourcePath, subtitlesLanguages: body.subtitlesLanguages }),
    outputFolderName: keepLanguagesDefaultProps.outputFolderName,
    schema: schemas.keepLanguagesRequestSchema,
    summary: "Filter media tracks by language",
    tags: ["Track Operations"],
  },
  mergeTracks: {
    getObservable: (body) => mergeTracks({ globalOffsetInMilliseconds: body.globalOffset, hasAutomaticOffset: body.automaticOffset, hasChapters: body.includeChapters, mediaFilesPath: body.mediaFilesPath, offsetsInMilliseconds: body.offsets, subtitlesPath: body.subtitlesPath }),
    outputFolderName: mergeTracksDefaultProps.outputFolderName,
    schema: schemas.mergeTracksRequestSchema,
    summary: "Merge subtitle tracks into media files",
    tags: ["Track Operations"],
  },
  moveFiles: {
    getObservable: (body) => moveFiles({ destinationPath: body.destinationPath, sourcePath: body.sourcePath }),
    schema: schemas.moveFilesRequestSchema,
    summary: "Move files from source to destination",
    tags: ["File Operations"],
  },
  nameAnimeEpisodes: {
    getObservable: (body) => nameAnimeEpisodes({ searchTerm: body.searchTerm, seasonNumber: body.seasonNumber, sourcePath: body.sourcePath }),
    schema: schemas.nameAnimeEpisodesRequestSchema,
    summary: "Rename anime episode files based on metadata",
    tags: ["Naming Operations"],
  },
  nameSpecialFeatures: {
    getObservable: (body) => nameSpecialFeatures({ fixedOffset: body.fixedOffset, sourcePath: body.sourcePath, timecodePaddingAmount: body.timecodePadding, url: body.url }),
    schema: schemas.nameSpecialFeaturesRequestSchema,
    summary: "Rename special features based on timecode data",
    tags: ["Naming Operations"],
  },
  nameTvShowEpisodes: {
    getObservable: (body) => nameTvShowEpisodes({ searchTerm: body.searchTerm, seasonNumber: body.seasonNumber, sourcePath: body.sourcePath }),
    schema: schemas.nameTvShowEpisodesRequestSchema,
    summary: "Rename TV show episode files based on metadata",
    tags: ["Naming Operations"],
  },
  renameDemos: {
    getObservable: (body) => renameDemos({ isRecursive: body.isRecursive, sourcePath: body.sourcePath }),
    schema: schemas.renameDemosRequestSchema,
    summary: "Rename demo files based on content analysis",
    tags: ["Naming Operations"],
  },
  renameMovieClipDownloads: {
    getObservable: (body) => renameMovieClipDownloads({ sourcePath: body.sourcePath }),
    schema: schemas.renameMovieClipDownloadsRequestSchema,
    summary: "Rename downloaded movie clip files",
    tags: ["Naming Operations"],
  },
  reorderTracks: {
    getObservable: (body) => reorderTracks({ audioTrackIndexes: body.audioTrackIndexes, isRecursive: body.isRecursive, sourcePath: body.sourcePath, subtitlesTrackIndexes: body.subtitlesTrackIndexes, videoTrackIndexes: body.videoTrackIndexes }),
    outputFolderName: reorderTracksDefaultProps.outputFolderName,
    schema: schemas.reorderTracksRequestSchema,
    summary: "Reorder media tracks",
    tags: ["Track Operations"],
  },
  replaceAttachments: {
    getObservable: (body) => replaceAttachments({ destinationFilesPath: body.destinationFilesPath, sourceFilesPath: body.sourceFilesPath }),
    outputFolderName: replaceAttachmentsDefaultProps.outputFolderName,
    schema: schemas.replaceAttachmentsRequestSchema,
    summary: "Replace attachments in media files",
    tags: ["File Operations"],
  },
  replaceFlacWithPcmAudio: {
    getObservable: (body) => replaceFlacWithPcmAudio({ isRecursive: body.isRecursive, sourcePath: body.sourcePath }),
    outputFolderName: replaceFlacWithPcmAudioDefaultProps.outputFolderName,
    schema: schemas.replaceFlacWithPcmAudioRequestSchema,
    summary: "Replace FLAC audio with PCM audio",
    tags: ["Audio Operations"],
  },
  replaceTracks: {
    getObservable: (body) => replaceTracks({ audioLanguages: body.audioLanguages, destinationFilesPath: body.destinationFilesPath, globalOffsetInMilliseconds: body.globalOffset, hasAutomaticOffset: body.automaticOffset, hasChapters: body.includeChapters, offsets: body.offsets, sourceFilesPath: body.sourceFilesPath, subtitlesLanguages: body.subtitlesLanguages, videoLanguages: body.videoLanguages }),
    outputFolderName: replaceTracksDefaultProps.outputFolderName,
    schema: schemas.replaceTracksRequestSchema,
    summary: "Replace media tracks in destination files",
    tags: ["Track Operations"],
  },
  setDisplayWidth: {
    getObservable: (body) => setDisplayWidth({ displayWidth: body.displayWidth, isRecursive: body.isRecursive, recursiveDepth: body.recursiveDepth, sourcePath: body.sourcePath }),
    schema: schemas.setDisplayWidthRequestSchema,
    summary: "Set display width for video tracks",
    tags: ["Video Operations"],
  },
  splitChapters: {
    getObservable: (body) => splitChapters({ chapterSplitsList: body.chapterSplits, sourcePath: body.sourcePath }),
    outputFolderName: splitChaptersDefaultProps.outputFolderName,
    schema: schemas.splitChaptersRequestSchema,
    summary: "Split media files by chapter markers",
    tags: ["File Operations"],
  },
  storeAspectRatioData: {
    getObservable: (body) => storeAspectRatioData({ folderNames: body.folders, isRecursive: body.isRecursive, mode: body.force ? "overwrite" : "append", outputPath: body.outputPath, recursiveDepth: body.recursiveDepth, rootPath: body.rootPath, sourcePath: body.sourcePath, threadCount: body.threads }),
    schema: schemas.storeAspectRatioDataRequestSchema,
    summary: "Analyze and store aspect ratio metadata",
    tags: ["Metadata Operations"],
  },
}

export const commandRoutes = new OpenAPIHono()

// commandRoutes.openapi(
//   createRoute({
//     method: "get",
//     path: "/commands",
//     summary: "List all available command names.",
//     tags: ["Commands"],
//     responses: {
//       200: {
//         description: "List of available command names",
//         content: {
//           "application/json": {
//             schema: z.object({ commandNames: z.array(z.enum(commandNames)) }),
//           },
//         },
//       },
//     },
//   }),
//   (context) => context.json({ commandNames: [...commandNames] }, 200),
// )

commandRoutes.openapi(
  createRoute({
    method: "get",
    path: "/commands",
    summary: "List all available command names.",
    tags: ["Commands"],
    responses: {
      200: {
        description: "List of available command names",
        content: {
          "application/json": {
            schema: z.object({ commandNames: z.array(z.enum(commandNames)) }),
          },
        },
      },
    },
  }),
  (context) => context.json({ commandNames: [...commandNames] }, 200),
)

commandNames.forEach((commandName) => {
  const { getObservable, outputFolderName, schema, summary, tags } = commandConfigs[commandName]

  commandRoutes.openapi(
    createRoute({
      method: "post",
      path: `/commands/${commandName}`,
      summary,
      tags,
      request: {
        body: {
          content: {
            "application/json": { schema },
          },
        },
      },
      responses: {
        202: {
          description: "Job started successfully",
          content: {
            "application/json": {
              schema: schemas.createJobResponseSchema(
                outputFolderName != null ? z.literal(outputFolderName) : undefined
              ),
            },
          },
        },
      },
    }),
    async (context) => {
      const body = context.req.valid("json")
      return startCommandJob({
        command: commandName,
        commandObservable: getObservable(body),
        context,
        outputFolderName,
        params: body,
      })
    },
  )
})
