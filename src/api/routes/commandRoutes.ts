import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi"
import { type Context } from "hono"
import { type Observable } from "rxjs"

import { changeTrackLanguages } from "../../changeTrackLanguages.js"
import { copyFiles } from "../../copyFiles.js"
import { fixIncorrectDefaultTracks } from "../../fixIncorrectDefaultTracks.js"
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
import { copyOutSubtitles, copyOutSubtitlesDefaultProps } from "../../copyOutSubtitles.js"
import { getAudioOffsets, getAudioOffsetsDefaultProps } from "../../getAudioOffsets.js"
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
  context,
  jobObservable,
  outputFolderName = null,
  params,
}: {
  command: string,
  context: Context,
  jobObservable: Observable<unknown>,
  outputFolderName?: string | null,
  params: unknown,
}) => {
  const job = createJob({
    commandName: command,
    params,
    outputFolderName,
  })

  runJob(job.id, jobObservable)

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

export const commandRoutes = new OpenAPIHono()

commandRoutes.openapi(
  createRoute({
    method: "get",
    path: "/commands",
    summary: "List all available commands",
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
  (context) => context.json({ commandNames }, 200),
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/commands/copyFiles",
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
    return startCommandJob({
      command: copyFiles.name,
      context,
      jobObservable: copyFiles({ destinationPath: body.destinationPath, sourcePath: body.sourcePath }),
      params: body,
    })
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/commands/moveFiles",
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
    return startCommandJob({
      command: moveFiles.name,
      context,
      jobObservable: moveFiles({ destinationPath: body.destinationPath, sourcePath: body.sourcePath }),
      params: body,
    })
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/commands/copyOutSubtitles",
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
            schema: schemas.createJobResponseSchema(z.literal(copyOutSubtitlesDefaultProps.outputFolderName)),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    return startCommandJob({
      command: copyOutSubtitles.name,
      context,
      jobObservable: copyOutSubtitles({ isRecursive: body.isRecursive, sourcePath: body.sourcePath, subtitlesLanguage: body.subtitlesLanguage }),
      params: body,
      outputFolderName: copyOutSubtitlesDefaultProps.outputFolderName
    })
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/commands/getAudioOffsets",
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
            schema: schemas.createJobResponseSchema(z.literal(getAudioOffsetsDefaultProps.outputFolderName)),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    return startCommandJob({
      command: getAudioOffsets.name,
      context,
      jobObservable: getAudioOffsets({ destinationFilesPath: body.destinationFilesPath, sourceFilesPath: body.sourceFilesPath }),
      params: body,
      outputFolderName: getAudioOffsetsDefaultProps.outputFolderName
    })
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/commands/changeTrackLanguages",
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
    return startCommandJob({
      command: changeTrackLanguages.name,
      context,
      jobObservable: changeTrackLanguages({ audioLanguage: body.audioLanguage, isRecursive: body.isRecursive, sourcePath: body.sourcePath, subtitlesLanguage: body.subtitlesLanguage, videoLanguage: body.videoLanguage }),
      params: body,
    })
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/commands/fixIncorrectDefaultTracks",
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
    return startCommandJob({
      command: fixIncorrectDefaultTracks.name,
      context,
      jobObservable: fixIncorrectDefaultTracks({ isRecursive: body.isRecursive, sourcePath: body.sourcePath }),
      params: body,
    })
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/commands/hasBetterAudio",
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
    return startCommandJob({
      command: hasBetterAudio.name,
      context,
      jobObservable: hasBetterAudio({ isRecursive: body.isRecursive, recursiveDepth: body.recursiveDepth, sourcePath: body.sourcePath }),
      params: body,
    })
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/commands/hasBetterVersion",
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
    return startCommandJob({
      command: hasBetterVersion.name,
      context,
      jobObservable: hasBetterVersion({ isRecursive: body.isRecursive, recursiveDepth: body.recursiveDepth, sourcePath: body.sourcePath }),
      params: body,
    })
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/commands/hasDuplicateMusicFiles",
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
    return startCommandJob({
      command: hasDuplicateMusicFiles.name,
      context,
      jobObservable: hasDuplicateMusicFiles({ isRecursive: body.isRecursive, recursiveDepth: body.recursiveDepth, sourcePath: body.sourcePath }),
      params: body,
    })
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/commands/hasImaxEnhancedAudio",
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
    return startCommandJob({
      command: hasImaxEnhancedAudio.name,
      context,
      jobObservable: hasImaxEnhancedAudio({ isRecursive: body.isRecursive, sourcePath: body.sourcePath }),
      params: body,
    })
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/commands/hasManyAudioTracks",
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
    return startCommandJob({
      command: hasManyAudioTracks.name,
      context,
      jobObservable: hasManyAudioTracks({ isRecursive: body.isRecursive, sourcePath: body.sourcePath }),
      params: body,
    })
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/commands/hasSurroundSound",
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
    return startCommandJob({
      command: hasSurroundSound.name,
      context,
      jobObservable: hasSurroundSound({ isRecursive: body.isRecursive, recursiveDepth: body.recursiveDepth, sourcePath: body.sourcePath }),
      params: body,
    })
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/commands/hasWrongDefaultTrack",
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
    return startCommandJob({
      command: hasWrongDefaultTrack.name,
      context,
      jobObservable: hasWrongDefaultTrack({ isRecursive: body.isRecursive, sourcePath: body.sourcePath }),
      params: body,
    })
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/commands/isMissingSubtitles",
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
    return startCommandJob({
      command: isMissingSubtitles.name,
      context,
      jobObservable: isMissingSubtitles({ isRecursive: body.isRecursive, sourcePath: body.sourcePath }),
      params: body,
    })
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/commands/keepLanguages",
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
            schema: schemas.createJobResponseSchema(z.literal(keepLanguagesDefaultProps.outputFolderName)),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    return startCommandJob({
      command: keepLanguages.name,
      context,
      jobObservable: keepLanguages({ audioLanguages: body.audioLanguages, hasFirstAudioLanguage: body.useFirstAudioLanguage, hasFirstSubtitlesLanguage: body.useFirstSubtitlesLanguage, isRecursive: body.isRecursive, sourcePath: body.sourcePath, subtitlesLanguages: body.subtitlesLanguages }),
      params: body,
      outputFolderName: keepLanguagesDefaultProps.outputFolderName
      })
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/commands/mergeTracks",
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
            schema: schemas.createJobResponseSchema(z.literal(mergeTracksDefaultProps.outputFolderName)),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    return startCommandJob({
      command: mergeTracks.name,
      context,
      jobObservable: mergeTracks({ globalOffsetInMilliseconds: body.globalOffset, hasAutomaticOffset: body.automaticOffset, hasChapters: body.includeChapters, mediaFilesPath: body.mediaFilesPath, offsetsInMilliseconds: body.offsets, subtitlesPath: body.subtitlesPath }),
      params: body,
      outputFolderName: mergeTracksDefaultProps.outputFolderName
      })
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/commands/nameAnimeEpisodes",
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
    return startCommandJob({
      command: nameAnimeEpisodes.name,
      context,
      jobObservable: nameAnimeEpisodes({ searchTerm: body.searchTerm, seasonNumber: body.seasonNumber, sourcePath: body.sourcePath }),
      params: body,
    })
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/commands/nameSpecialFeatures",
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
    return startCommandJob({
      command: nameSpecialFeatures.name,
      context,
      jobObservable: nameSpecialFeatures({ fixedOffset: body.fixedOffset, sourcePath: body.sourcePath, timecodePaddingAmount: body.timecodePadding, url: body.url }),
      params: body,
    })
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/commands/nameTvShowEpisodes",
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
    return startCommandJob({
      command: nameTvShowEpisodes.name,
      context,
      jobObservable: nameTvShowEpisodes({ searchTerm: body.searchTerm, seasonNumber: body.seasonNumber, sourcePath: body.sourcePath }),
      params: body,
    })
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/commands/renameDemos",
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
    return startCommandJob({
      command: renameDemos.name,
      context,
      jobObservable: renameDemos({ isRecursive: body.isRecursive, sourcePath: body.sourcePath }),
      params: body,
    })
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/commands/renameMovieClipDownloads",
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
    return startCommandJob({
      command: renameMovieClipDownloads.name,
      context,
      jobObservable: renameMovieClipDownloads({ sourcePath: body.sourcePath }),
      params: body,
    })
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/commands/reorderTracks",
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
            schema: schemas.createJobResponseSchema(z.literal(reorderTracksDefaultProps.outputFolderName)),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    return startCommandJob({
      command: reorderTracks.name,
      context,
      jobObservable: reorderTracks({ audioTrackIndexes: body.audioTrackIndexes, isRecursive: body.isRecursive, sourcePath: body.sourcePath, subtitlesTrackIndexes: body.subtitlesTrackIndexes, videoTrackIndexes: body.videoTrackIndexes }),
      params: body,
      outputFolderName: reorderTracksDefaultProps.outputFolderName
      })
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/commands/replaceAttachments",
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
            schema: schemas.createJobResponseSchema(z.literal(replaceAttachmentsDefaultProps.outputFolderName)),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    return startCommandJob({
      command: replaceAttachments.name,
      context,
      jobObservable: replaceAttachments({ destinationFilesPath: body.destinationFilesPath, sourceFilesPath: body.sourceFilesPath }),
      params: body,
      outputFolderName: replaceAttachmentsDefaultProps.outputFolderName
      })
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/commands/replaceFlacWithPcmAudio",
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
            schema: schemas.createJobResponseSchema(z.literal(replaceFlacWithPcmAudioDefaultProps.outputFolderName)),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    return startCommandJob({
      command: replaceFlacWithPcmAudio.name,
      context,
      jobObservable: replaceFlacWithPcmAudio({ isRecursive: body.isRecursive, sourcePath: body.sourcePath }),
      params: body,
      outputFolderName: replaceFlacWithPcmAudioDefaultProps.outputFolderName
      })
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/commands/replaceTracks",
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
            schema: schemas.createJobResponseSchema(z.literal(replaceTracksDefaultProps.outputFolderName)),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    return startCommandJob({
      command: replaceTracks.name,
      context,
      jobObservable: replaceTracks({
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
      params: body,
      outputFolderName: replaceTracksDefaultProps.outputFolderName
      })
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/commands/setDisplayWidth",
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
    return startCommandJob({
      command: setDisplayWidth.name,
      context,
      jobObservable: setDisplayWidth({ displayWidth: body.displayWidth, isRecursive: body.isRecursive, recursiveDepth: body.recursiveDepth, sourcePath: body.sourcePath }),
      params: body,
    })
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/commands/splitChapters",
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
            schema: schemas.createJobResponseSchema(z.literal(splitChaptersDefaultProps.outputFolderName)),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    return startCommandJob({
      command: splitChapters.name,
      context,
      jobObservable: splitChapters({ chapterSplitsList: body.chapterSplits, sourcePath: body.sourcePath }),
      params: body,
      outputFolderName: splitChaptersDefaultProps.outputFolderName
      })
  },
)

commandRoutes.openapi(
  createRoute({
    method: "post",
    path: "/commands/storeAspectRatioData",
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
    return startCommandJob({
      command: storeAspectRatioData.name,
      context,
      jobObservable: storeAspectRatioData({
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
      }),
      params: body,
    })
  },
)
