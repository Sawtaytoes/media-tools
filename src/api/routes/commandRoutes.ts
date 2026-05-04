import { OpenAPIHono, createRoute } from "@hono/zod-openapi"
import { type Context } from "hono"
import { type Observable } from "rxjs"

import { changeTrackLanguages } from "../../changeTrackLanguages.js"
import { convertedPath as audioConvertedFolderName } from "../../convertFlacToPcmAudio.js"
import { copyFiles } from "../../copyFiles.js"
import { extractedSubtitlesPath as extractedSubtitlesFolderName } from "../../extractSubtitles.js"
import { fixIncorrectDefaultTracks } from "../../fixIncorrectDefaultTracks.js"
import { audioOffsetsFolderName } from "../../getAudioOffset.js"
import { hasBetterAudio } from "../../hasBetterAudio.js"
import { hasBetterVersion } from "../../hasBetterVersion.js"
import { hasDuplicateMusicFiles } from "../../hasDuplicateMusicFiles.js"
import { hasImaxEnhancedAudio } from "../../hasImaxEnhancedAudio.js"
import { hasManyAudioTracks } from "../../hasManyAudioTracks.js"
import { hasSurroundSound } from "../../hasSurroundSound.js"
import { hasWrongDefaultTrack } from "../../hasWrongDefaultTrack.js"
import { isMissingSubtitles } from "../../isMissingSubtitles.js"
import { keepLanguages } from "../../keepLanguages.js"
import { languageTrimmedFolderName } from "../../keepSpecifiedLanguageTracks.js"
import { mergeTracks } from "../../mergeTracks.js"
import { subtitledFolderName } from "../../mergeSubtitlesMkvMerge.js"
import { moveFiles } from "../../moveFiles.js"
import { copyOutSubtitles } from "../../copyOutSubtitles.js"
import { getAudioOffsets } from "../../getAudioOffsets.js"
import { nameAnimeEpisodes } from "../../nameAnimeEpisodes.js"
import { nameSpecialFeatures } from "../../nameSpecialFeatures.js"
import { nameTvShowEpisodes } from "../../nameTvShowEpisodes.js"
import { renameDemos } from "../../renameDemos.js"
import { renameMovieClipDownloads } from "../../renameMovieClipDownloads.js"
import { reorderTracks } from "../../reorderTracks.js"
import { reorderTracksFolderName } from "../../reorderTracksMkvMerge.js"
import { replaceAttachments } from "../../replaceAttachments.js"
import { replacedAttachmentsFolderName } from "../../replaceAttachmentsMkvMerge.js"
import { replaceFlacWithPcmAudio } from "../../replaceFlacWithPcmAudio.js"
import { replaceTracks } from "../../replaceTracks.js"
import { replacedTracksFolderName } from "../../replaceTracksMkvMerge.js"
import { setDisplayWidth } from "../../setDisplayWidth.js"
import { splitChapters } from "../../splitChapters.js"
import { splitsFolderName } from "../../splitChaptersMkvMerge.js"
import { storeAspectRatioData } from "../../storeAspectRatioData.js"
import { createJob } from "../jobStore.js"
import { runJob } from "../jobRunner.js"
import * as schemas from "../schemas.js"

const startJob = (
  context: Context,
  command: string,
  params: unknown,
  observable: Observable<unknown>,
  outputFolderName: string | null = null,
) => {
  const job = createJob(command, params, outputFolderName)

  runJob(job.id, observable)

  return context.json(
    {
      jobId: job.id,
      logsUrl: `/jobs/${job.id}/logs`,
      outputFolderName,
    },
    202,
  )
}

export const commandRoutes = new OpenAPIHono()

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/jobs/copyFiles",
    summary: "Copy files from source to destination",
    tags: ["File Operations"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: schemas.copyFilesRequestSchema,
          },
        },
      },
    },
    responses: {
      202: {
        description: "Job started successfully",
        content: {
          "application/json": {
            schema: schemas.createJobResponseSchema(),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    return startJob(context, "copyFiles", body,
      copyFiles({ destinationPath: body.destinationPath, sourcePath: body.sourcePath }))
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/jobs/moveFiles",
    summary: "Move files from source to destination",
    tags: ["File Operations"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: schemas.moveFilesRequestSchema,
          },
        },
      },
    },
    responses: {
      202: {
        description: "Job started successfully",
        content: {
          "application/json": {
            schema: schemas.createJobResponseSchema(),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    return startJob(context, "moveFiles", body,
      moveFiles({ destinationPath: body.destinationPath, sourcePath: body.sourcePath }))
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/jobs/copyOutSubtitles",
    summary: "Extract subtitle files from media files",
    tags: ["Subtitle Operations"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: schemas.copyOutSubtitlesRequestSchema,
          },
        },
      },
    },
    responses: {
      202: {
        description: "Job started successfully",
        content: {
          "application/json": {
            schema: schemas.createJobResponseSchema(),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    return startJob(context, "copyOutSubtitles", body,
      copyOutSubtitles({ isRecursive: body.isRecursive, sourcePath: body.sourcePath, subtitlesLanguage: body.subtitlesLanguage }),
      extractedSubtitlesFolderName)
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/jobs/getAudioOffsets",
    summary: "Calculate audio synchronization offsets between files",
    tags: ["Audio Operations"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: schemas.getAudioOffsetsRequestSchema,
          },
        },
      },
    },
    responses: {
      202: {
        description: "Job started successfully",
        content: {
          "application/json": {
            schema: schemas.createJobResponseSchema(),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    return startJob(context, "getAudioOffsets", body,
      getAudioOffsets({ destinationFilesPath: body.destinationFilesPath, sourceFilesPath: body.sourceFilesPath }),
      audioOffsetsFolderName)
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/jobs/changeTrackLanguages",
    summary: "Change language tags for media tracks",
    tags: ["Track Operations"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: schemas.changeTrackLanguagesRequestSchema,
          },
        },
      },
    },
    responses: {
      202: {
        description: "Job started successfully",
        content: {
          "application/json": {
            schema: schemas.createJobResponseSchema(),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    return startJob(context, "changeTrackLanguages", body,
      changeTrackLanguages({ audioLanguage: body.audioLanguage, isRecursive: body.isRecursive, sourcePath: body.sourcePath, subtitlesLanguage: body.subtitlesLanguage, videoLanguage: body.videoLanguage }))
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/jobs/fixIncorrectDefaultTracks",
    summary: "Fix incorrect default track designations",
    tags: ["Track Operations"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: schemas.fixIncorrectDefaultTracksRequestSchema,
          },
        },
      },
    },
    responses: {
      202: {
        description: "Job started successfully",
        content: {
          "application/json": {
            schema: schemas.createJobResponseSchema(),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    return startJob(context, "fixIncorrectDefaultTracks", body,
      fixIncorrectDefaultTracks({ isRecursive: body.isRecursive, sourcePath: body.sourcePath }))
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/jobs/hasBetterAudio",
    summary: "Analyze and compare audio quality across files",
    tags: ["Analysis"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: schemas.hasBetterAudioRequestSchema,
          },
        },
      },
    },
    responses: {
      202: {
        description: "Job started successfully",
        content: {
          "application/json": {
            schema: schemas.createJobResponseSchema(),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    return startJob(context, "hasBetterAudio", body,
      hasBetterAudio({ isRecursive: body.isRecursive, recursiveDepth: body.recursiveDepth, sourcePath: body.sourcePath }))
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/jobs/hasBetterVersion",
    summary: "Check if better version of media exists",
    tags: ["Analysis"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: schemas.hasBetterVersionRequestSchema,
          },
        },
      },
    },
    responses: {
      202: {
        description: "Job started successfully",
        content: {
          "application/json": {
            schema: schemas.createJobResponseSchema(),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    return startJob(context, "hasBetterVersion", body,
      hasBetterVersion({ isRecursive: body.isRecursive, recursiveDepth: body.recursiveDepth, sourcePath: body.sourcePath }))
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/jobs/hasDuplicateMusicFiles",
    summary: "Identify duplicate music files",
    tags: ["Analysis"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: schemas.hasDuplicateMusicFilesRequestSchema,
          },
        },
      },
    },
    responses: {
      202: {
        description: "Job started successfully",
        content: {
          "application/json": {
            schema: schemas.createJobResponseSchema(),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    return startJob(context, "hasDuplicateMusicFiles", body,
      hasDuplicateMusicFiles({ isRecursive: body.isRecursive, recursiveDepth: body.recursiveDepth, sourcePath: body.sourcePath }))
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/jobs/hasImaxEnhancedAudio",
    summary: "Check for IMAX enhanced audio tracks",
    tags: ["Analysis"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: schemas.hasImaxEnhancedAudioRequestSchema,
          },
        },
      },
    },
    responses: {
      202: {
        description: "Job started successfully",
        content: {
          "application/json": {
            schema: schemas.createJobResponseSchema(),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    return startJob(context, "hasImaxEnhancedAudio", body,
      hasImaxEnhancedAudio({ isRecursive: body.isRecursive, sourcePath: body.sourcePath }))
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/jobs/hasManyAudioTracks",
    summary: "Identify files with many audio tracks",
    tags: ["Analysis"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: schemas.hasManyAudioTracksRequestSchema,
          },
        },
      },
    },
    responses: {
      202: {
        description: "Job started successfully",
        content: {
          "application/json": {
            schema: schemas.createJobResponseSchema(),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    return startJob(context, "hasManyAudioTracks", body,
      hasManyAudioTracks({ isRecursive: body.isRecursive, sourcePath: body.sourcePath }))
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/jobs/hasSurroundSound",
    summary: "Check for surround sound audio tracks",
    tags: ["Analysis"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: schemas.hasSurroundSoundRequestSchema,
          },
        },
      },
    },
    responses: {
      202: {
        description: "Job started successfully",
        content: {
          "application/json": {
            schema: schemas.createJobResponseSchema(),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    return startJob(context, "hasSurroundSound", body,
      hasSurroundSound({ isRecursive: body.isRecursive, recursiveDepth: body.recursiveDepth, sourcePath: body.sourcePath }))
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/jobs/hasWrongDefaultTrack",
    summary: "Find files with incorrect default track selection",
    tags: ["Analysis"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: schemas.hasWrongDefaultTrackRequestSchema,
          },
        },
      },
    },
    responses: {
      202: {
        description: "Job started successfully",
        content: {
          "application/json": {
            schema: schemas.createJobResponseSchema(),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    return startJob(context, "hasWrongDefaultTrack", body,
      hasWrongDefaultTrack({ isRecursive: body.isRecursive, sourcePath: body.sourcePath }))
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/jobs/isMissingSubtitles",
    summary: "Identify media files missing subtitle tracks",
    tags: ["Subtitle Operations"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: schemas.isMissingSubtitlesRequestSchema,
          },
        },
      },
    },
    responses: {
      202: {
        description: "Job started successfully",
        content: {
          "application/json": {
            schema: schemas.createJobResponseSchema(),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    return startJob(context, "isMissingSubtitles", body,
      isMissingSubtitles({ isRecursive: body.isRecursive, sourcePath: body.sourcePath }))
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/jobs/keepLanguages",
    summary: "Filter media tracks by language",
    tags: ["Track Operations"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: schemas.keepLanguagesRequestSchema,
          },
        },
      },
    },
    responses: {
      202: {
        description: "Job started successfully",
        content: {
          "application/json": {
            schema: schemas.createJobResponseSchema(),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    return startJob(context, "keepLanguages", body,
      keepLanguages({ audioLanguages: body.audioLanguages, hasFirstAudioLanguage: body.useFirstAudioLanguage, hasFirstSubtitlesLanguage: body.useFirstSubtitlesLanguage, isRecursive: body.isRecursive, sourcePath: body.sourcePath, subtitlesLanguages: body.subtitlesLanguages }),
      languageTrimmedFolderName)
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/jobs/mergeTracks",
    summary: "Merge subtitle tracks into media files",
    tags: ["Track Operations"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: schemas.mergeTracksRequestSchema,
          },
        },
      },
    },
    responses: {
      202: {
        description: "Job started successfully",
        content: {
          "application/json": {
            schema: schemas.createJobResponseSchema(),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    return startJob(context, "mergeTracks", body,
      mergeTracks({ globalOffsetInMilliseconds: body.globalOffset, hasAutomaticOffset: body.automaticOffset, hasChapters: body.includeChapters, mediaFilesPath: body.mediaFilesPath, offsetsInMilliseconds: body.offsets, subtitlesPath: body.subtitlesPath }),
      subtitledFolderName)
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/jobs/nameAnimeEpisodes",
    summary: "Rename anime episode files based on metadata",
    tags: ["Naming Operations"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: schemas.nameAnimeEpisodesRequestSchema,
          },
        },
      },
    },
    responses: {
      202: {
        description: "Job started successfully",
        content: {
          "application/json": {
            schema: schemas.createJobResponseSchema(),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    return startJob(context, "nameAnimeEpisodes", body,
      nameAnimeEpisodes({ searchTerm: body.searchTerm, seasonNumber: body.seasonNumber, sourcePath: body.sourcePath }))
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/jobs/nameSpecialFeatures",
    summary: "Rename special features based on timecode data",
    tags: ["Naming Operations"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: schemas.nameSpecialFeaturesRequestSchema,
          },
        },
      },
    },
    responses: {
      202: {
        description: "Job started successfully",
        content: {
          "application/json": {
            schema: schemas.createJobResponseSchema(),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    return startJob(context, "nameSpecialFeatures", body,
      nameSpecialFeatures({ fixedOffset: body.fixedOffset, sourcePath: body.sourcePath, timecodePaddingAmount: body.timecodePadding, url: body.url }))
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/jobs/nameTvShowEpisodes",
    summary: "Rename TV show episode files based on metadata",
    tags: ["Naming Operations"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: schemas.nameTvShowEpisodesRequestSchema,
          },
        },
      },
    },
    responses: {
      202: {
        description: "Job started successfully",
        content: {
          "application/json": {
            schema: schemas.createJobResponseSchema(),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    return startJob(context, "nameTvShowEpisodes", body,
      nameTvShowEpisodes({ searchTerm: body.searchTerm, seasonNumber: body.seasonNumber, sourcePath: body.sourcePath }))
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/jobs/renameDemos",
    summary: "Rename demo files based on content analysis",
    tags: ["Naming Operations"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: schemas.renameDemosRequestSchema,
          },
        },
      },
    },
    responses: {
      202: {
        description: "Job started successfully",
        content: {
          "application/json": {
            schema: schemas.createJobResponseSchema(),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    return startJob(context, "renameDemos", body,
      renameDemos({ isRecursive: body.isRecursive, sourcePath: body.sourcePath }))
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/jobs/renameMovieClipDownloads",
    summary: "Rename downloaded movie clip files",
    tags: ["Naming Operations"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: schemas.renameMovieClipDownloadsRequestSchema,
          },
        },
      },
    },
    responses: {
      202: {
        description: "Job started successfully",
        content: {
          "application/json": {
            schema: schemas.createJobResponseSchema(),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    return startJob(context, "renameMovieClipDownloads", body,
      renameMovieClipDownloads({ sourcePath: body.sourcePath }))
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/jobs/reorderTracks",
    summary: "Reorder media tracks",
    tags: ["Track Operations"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: schemas.reorderTracksRequestSchema,
          },
        },
      },
    },
    responses: {
      202: {
        description: "Job started successfully",
        content: {
          "application/json": {
            schema: schemas.createJobResponseSchema(),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    return startJob(context, "reorderTracks", body,
      reorderTracks({ audioTrackIndexes: body.audioTrackIndexes, isRecursive: body.isRecursive, sourcePath: body.sourcePath, subtitlesTrackIndexes: body.subtitlesTrackIndexes, videoTrackIndexes: body.videoTrackIndexes }),
      reorderTracksFolderName)
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/jobs/replaceAttachments",
    summary: "Replace attachments in media files",
    tags: ["File Operations"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: schemas.replaceAttachmentsRequestSchema,
          },
        },
      },
    },
    responses: {
      202: {
        description: "Job started successfully",
        content: {
          "application/json": {
            schema: schemas.createJobResponseSchema(),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    return startJob(context, "replaceAttachments", body,
      replaceAttachments({ destinationFilesPath: body.destinationFilesPath, sourceFilesPath: body.sourceFilesPath }),
      replacedAttachmentsFolderName)
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/jobs/replaceFlacWithPcmAudio",
    summary: "Replace FLAC audio with PCM audio",
    tags: ["Audio Operations"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: schemas.replaceFlacWithPcmAudioRequestSchema,
          },
        },
      },
    },
    responses: {
      202: {
        description: "Job started successfully",
        content: {
          "application/json": {
            schema: schemas.createJobResponseSchema(),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    return startJob(context, "replaceFlacWithPcmAudio", body,
      replaceFlacWithPcmAudio({ isRecursive: body.isRecursive, sourcePath: body.sourcePath }),
      audioConvertedFolderName)
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/jobs/replaceTracks",
    summary: "Replace media tracks in destination files",
    tags: ["Track Operations"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: schemas.replaceTracksRequestSchema,
          },
        },
      },
    },
    responses: {
      202: {
        description: "Job started successfully",
        content: {
          "application/json": {
            schema: schemas.createJobResponseSchema(),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    return startJob(context, "replaceTracks", body,
      replaceTracks({
        audioLanguages: body.audioLanguages,
        destinationFilesPath: body.destinationFilesPath,
        globalOffsetInMilliseconds: body.globalOffset,
        hasAutomaticOffset: body.automaticOffset,
        hasChapters: body.includeChapters,
        offsets: body.offsets,
        sourceFilesPath: body.sourceFilesPath,
        subtitlesLanguages: body.subtitlesLanguages,
        videoLanguages: body.videoLanguages,
      }),
      replacedTracksFolderName)
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/jobs/setDisplayWidth",
    summary: "Set display width for video tracks",
    tags: ["Video Operations"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: schemas.setDisplayWidthRequestSchema,
          },
        },
      },
    },
    responses: {
      202: {
        description: "Job started successfully",
        content: {
          "application/json": {
            schema: schemas.createJobResponseSchema(),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    return startJob(context, "setDisplayWidth", body,
      setDisplayWidth({ displayWidth: body.displayWidth, isRecursive: body.isRecursive, recursiveDepth: body.recursiveDepth, sourcePath: body.sourcePath }))
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/jobs/splitChapters",
    summary: "Split media files by chapter markers",
    tags: ["File Operations"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: schemas.splitChaptersRequestSchema,
          },
        },
      },
    },
    responses: {
      202: {
        description: "Job started successfully",
        content: {
          "application/json": {
            schema: schemas.createJobResponseSchema(),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    return startJob(context, "splitChapters", body,
      splitChapters({ chapterSplitsList: body.chapterSplits, sourcePath: body.sourcePath }),
      splitsFolderName)
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/jobs/storeAspectRatioData",
    summary: "Analyze and store aspect ratio metadata",
    tags: ["Metadata Operations"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: schemas.storeAspectRatioDataRequestSchema,
          },
        },
      },
    },
    responses: {
      202: {
        description: "Job started successfully",
        content: {
          "application/json": {
            schema: schemas.createJobResponseSchema(),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    return startJob(context, "storeAspectRatioData", body,
      storeAspectRatioData({
        folderNames: body.folders,
        isRecursive: body.isRecursive,
        mode: (
          body.force
          ? "overwrite"
          : "append"
        ),
        outputPath: body.outputPath,
        recursiveDepth: body.recursiveDepth,
        rootPath: body.rootPath,
        sourcePath: body.sourcePath,
        threadCount: body.threads,
      }))
  },
)
