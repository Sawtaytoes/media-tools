import { Hono, type Context } from "hono"
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
import { keepLanguages } from "../../keepLanguages.js"
import { mergeTracks } from "../../mergeTracks.js"
import { moveFiles } from "../../moveFiles.js"
import { nameAnimeEpisodes } from "../../nameAnimeEpisodes.js"
import { nameSpecialFeatures } from "../../nameSpecialFeatures.js"
import { nameTvShowEpisodes } from "../../nameTvShowEpisodes.js"
import { renameDemos } from "../../renameDemos.js"
import { renameMovieClipDownloads } from "../../renameMovieClipDownloads.js"
import { reorderTracks } from "../../reorderTracks.js"
import { replaceAttachments } from "../../replaceAttachments.js"
import { replaceFlacWithPcmAudio } from "../../replaceFlacWithPcmAudio.js"
import { replaceTracks } from "../../replaceTracks.js"
import { setDisplayWidth } from "../../setDisplayWidth.js"
import { splitChapters } from "../../splitChapters.js"
import { storeAspectRatioData } from "../../storeAspectRatioData.js"
import { createJob } from "../jobStore.js"
import { runJob } from "../jobRunner.js"

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

const startJob = (
  context: Context,
  command: string,
  params: unknown,
  observable: Observable<unknown>,
) => {
  const job = createJob(command, params)

  runJob(job.id, observable)

  return context.json(
    {
      jobId: job.id,
      logsUrl: `/jobs/${job.id}/logs`,
    },
    202,
  )
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export const commandRoutes = new Hono()

commandRoutes.post(
  "/jobs/copyFiles",
  async (context) => {
    const body = await context.req.json()
    const { destinationPath, sourcePath } = body

    if (!sourcePath || !destinationPath) {
      return context.json({ error: "sourcePath and destinationPath are required" }, 400)
    }

    return startJob(context, "copyFiles", body,
      copyFiles({ destinationPath, sourcePath }))
  },
)

commandRoutes.post(
  "/jobs/moveFiles",
  async (context) => {
    const body = await context.req.json()
    const { destinationPath, sourcePath } = body

    if (!sourcePath || !destinationPath) {
      return context.json({ error: "sourcePath and destinationPath are required" }, 400)
    }

    return startJob(context, "moveFiles", body,
      moveFiles({ destinationPath, sourcePath }))
  },
)

commandRoutes.post(
  "/jobs/changeTrackLanguages",
  async (context) => {
    const body = await context.req.json()
    const { audioLanguage, isRecursive = false, sourcePath, subtitlesLanguage, videoLanguage } = body

    if (!sourcePath) return context.json({ error: "sourcePath is required" }, 400)

    return startJob(context, "changeTrackLanguages", body,
      changeTrackLanguages({ audioLanguage, isRecursive, sourcePath, subtitlesLanguage, videoLanguage }))
  },
)

commandRoutes.post(
  "/jobs/fixIncorrectDefaultTracks",
  async (context) => {
    const body = await context.req.json()
    const { isRecursive = false, sourcePath } = body

    if (!sourcePath) return context.json({ error: "sourcePath is required" }, 400)

    return startJob(context, "fixIncorrectDefaultTracks", body,
      fixIncorrectDefaultTracks({ isRecursive, sourcePath }))
  },
)

commandRoutes.post(
  "/jobs/hasBetterAudio",
  async (context) => {
    const body = await context.req.json()
    const { isRecursive = false, recursiveDepth = 0, sourcePath } = body

    if (!sourcePath) return context.json({ error: "sourcePath is required" }, 400)

    return startJob(context, "hasBetterAudio", body,
      hasBetterAudio({ isRecursive, recursiveDepth, sourcePath }))
  },
)

commandRoutes.post(
  "/jobs/hasBetterVersion",
  async (context) => {
    const body = await context.req.json()
    const { isRecursive = false, recursiveDepth = 0, sourcePath } = body

    if (!sourcePath) return context.json({ error: "sourcePath is required" }, 400)

    return startJob(context, "hasBetterVersion", body,
      hasBetterVersion({ isRecursive, recursiveDepth, sourcePath }))
  },
)

commandRoutes.post(
  "/jobs/hasDuplicateMusicFiles",
  async (context) => {
    const body = await context.req.json()
    const { isRecursive = false, recursiveDepth = 0, sourcePath } = body

    if (!sourcePath) return context.json({ error: "sourcePath is required" }, 400)

    return startJob(context, "hasDuplicateMusicFiles", body,
      hasDuplicateMusicFiles({ isRecursive, recursiveDepth, sourcePath }))
  },
)

commandRoutes.post(
  "/jobs/hasImaxEnhancedAudio",
  async (context) => {
    const body = await context.req.json()
    const { isRecursive = false, sourcePath } = body

    if (!sourcePath) return context.json({ error: "sourcePath is required" }, 400)

    return startJob(context, "hasImaxEnhancedAudio", body,
      hasImaxEnhancedAudio({ isRecursive, sourcePath }))
  },
)

commandRoutes.post(
  "/jobs/hasManyAudioTracks",
  async (context) => {
    const body = await context.req.json()
    const { isRecursive = false, sourcePath } = body

    if (!sourcePath) return context.json({ error: "sourcePath is required" }, 400)

    return startJob(context, "hasManyAudioTracks", body,
      hasManyAudioTracks({ isRecursive, sourcePath }))
  },
)

commandRoutes.post(
  "/jobs/hasSurroundSound",
  async (context) => {
    const body = await context.req.json()
    const { isRecursive = false, recursiveDepth = 0, sourcePath } = body

    if (!sourcePath) return context.json({ error: "sourcePath is required" }, 400)

    return startJob(context, "hasSurroundSound", body,
      hasSurroundSound({ isRecursive, recursiveDepth, sourcePath }))
  },
)

commandRoutes.post(
  "/jobs/hasWrongDefaultTrack",
  async (context) => {
    const body = await context.req.json()
    const { isRecursive = false, sourcePath } = body

    if (!sourcePath) return context.json({ error: "sourcePath is required" }, 400)

    return startJob(context, "hasWrongDefaultTrack", body,
      hasWrongDefaultTrack({ isRecursive, sourcePath }))
  },
)

commandRoutes.post(
  "/jobs/isMissingSubtitles",
  async (context) => {
    const body = await context.req.json()
    const { isRecursive = false, sourcePath } = body

    if (!sourcePath) return context.json({ error: "sourcePath is required" }, 400)

    return startJob(context, "isMissingSubtitles", body,
      isMissingSubtitles({ isRecursive, sourcePath }))
  },
)

commandRoutes.post(
  "/jobs/keepLanguages",
  async (context) => {
    const body = await context.req.json()
    const {
      audioLanguages = [],
      isRecursive = false,
      sourcePath,
      subtitlesLanguages = [],
      useFirstAudioLanguage: hasFirstAudioLanguage = false,
      useFirstSubtitlesLanguage: hasFirstSubtitlesLanguage = false,
    } = body

    if (!sourcePath) return context.json({ error: "sourcePath is required" }, 400)

    return startJob(context, "keepLanguages", body,
      keepLanguages({ audioLanguages, hasFirstAudioLanguage, hasFirstSubtitlesLanguage, isRecursive, sourcePath, subtitlesLanguages }))
  },
)

commandRoutes.post(
  "/jobs/mergeTracks",
  async (context) => {
    const body = await context.req.json()
    const {
      automaticOffset: hasAutomaticOffset = false,
      globalOffset: globalOffsetInMilliseconds = 0,
      includeChapters: hasChapters = false,
      mediaFilesPath,
      offsets: offsetsInMilliseconds = [],
      subtitlesPath,
    } = body

    if (!subtitlesPath || !mediaFilesPath) {
      return context.json({ error: "subtitlesPath and mediaFilesPath are required" }, 400)
    }

    return startJob(context, "mergeTracks", body,
      mergeTracks({ globalOffsetInMilliseconds, hasAutomaticOffset, hasChapters, mediaFilesPath, offsetsInMilliseconds, subtitlesPath }))
  },
)

commandRoutes.post(
  "/jobs/nameAnimeEpisodes",
  async (context) => {
    const body = await context.req.json()
    const { searchTerm, seasonNumber = 1, sourcePath } = body

    if (!sourcePath || !searchTerm) {
      return context.json({ error: "sourcePath and searchTerm are required" }, 400)
    }

    return startJob(context, "nameAnimeEpisodes", body,
      nameAnimeEpisodes({ searchTerm, seasonNumber, sourcePath }))
  },
)

commandRoutes.post(
  "/jobs/nameSpecialFeatures",
  async (context) => {
    const body = await context.req.json()
    const { fixedOffset = 0, sourcePath, timecodePadding: timecodePaddingAmount = 0, url } = body

    if (!sourcePath || !url) {
      return context.json({ error: "sourcePath and url are required" }, 400)
    }

    return startJob(context, "nameSpecialFeatures", body,
      nameSpecialFeatures({ fixedOffset, sourcePath, timecodePaddingAmount, url }))
  },
)

commandRoutes.post(
  "/jobs/nameTvShowEpisodes",
  async (context) => {
    const body = await context.req.json()
    const { searchTerm, seasonNumber, sourcePath } = body

    if (!sourcePath || !searchTerm || seasonNumber == null) {
      return context.json({ error: "sourcePath, searchTerm, and seasonNumber are required" }, 400)
    }

    return startJob(context, "nameTvShowEpisodes", body,
      nameTvShowEpisodes({ searchTerm, seasonNumber, sourcePath }))
  },
)

commandRoutes.post(
  "/jobs/renameDemos",
  async (context) => {
    const body = await context.req.json()
    const { isRecursive = false, sourcePath } = body

    if (!sourcePath) return context.json({ error: "sourcePath is required" }, 400)

    return startJob(context, "renameDemos", body,
      renameDemos({ isRecursive, sourcePath }))
  },
)

commandRoutes.post(
  "/jobs/renameMovieClipDownloads",
  async (context) => {
    const body = await context.req.json()
    const { sourcePath } = body

    if (!sourcePath) return context.json({ error: "sourcePath is required" }, 400)

    return startJob(context, "renameMovieClipDownloads", body,
      renameMovieClipDownloads({ sourcePath }))
  },
)

commandRoutes.post(
  "/jobs/reorderTracks",
  async (context) => {
    // NOTE: reorderTracks.ts has tap(() => process.exit()) after toArray().
    // Remove it before this endpoint can be used safely.
    const body = await context.req.json()
    const {
      audioTrackIndexes = [],
      isRecursive = false,
      sourcePath,
      subtitlesTrackIndexes = [],
      videoTrackIndexes = [],
    } = body

    if (!sourcePath) return context.json({ error: "sourcePath is required" }, 400)

    return startJob(context, "reorderTracks", body,
      reorderTracks({ audioTrackIndexes, isRecursive, sourcePath, subtitlesTrackIndexes, videoTrackIndexes }))
  },
)

commandRoutes.post(
  "/jobs/replaceAttachments",
  async (context) => {
    const body = await context.req.json()
    const { destinationFilesPath, sourceFilesPath } = body

    if (!sourceFilesPath || !destinationFilesPath) {
      return context.json({ error: "sourceFilesPath and destinationFilesPath are required" }, 400)
    }

    return startJob(context, "replaceAttachments", body,
      replaceAttachments({ destinationFilesPath, sourceFilesPath }))
  },
)

commandRoutes.post(
  "/jobs/replaceFlacWithPcmAudio",
  async (context) => {
    const body = await context.req.json()
    const { isRecursive = false, sourcePath } = body

    if (!sourcePath) return context.json({ error: "sourcePath is required" }, 400)

    return startJob(context, "replaceFlacWithPcmAudio", body,
      replaceFlacWithPcmAudio({ isRecursive, sourcePath }))
  },
)

commandRoutes.post(
  "/jobs/replaceTracks",
  async (context) => {
    const body = await context.req.json()
    const {
      audioLanguages = [],
      automaticOffset: hasAutomaticOffset = false,
      destinationFilesPath,
      globalOffset: globalOffsetInMilliseconds = 0,
      includeChapters: hasChapters = false,
      offsets = [],
      sourceFilesPath,
      subtitlesLanguages = [],
      videoLanguages = [],
    } = body

    if (!sourceFilesPath || !destinationFilesPath) {
      return context.json({ error: "sourceFilesPath and destinationFilesPath are required" }, 400)
    }

    return startJob(context, "replaceTracks", body,
      replaceTracks({
        audioLanguages,
        destinationFilesPath,
        globalOffsetInMilliseconds,
        hasAutomaticOffset,
        hasChapters,
        offsets,
        sourceFilesPath,
        subtitlesLanguages,
        videoLanguages,
      }))
  },
)

commandRoutes.post(
  "/jobs/setDisplayWidth",
  async (context) => {
    const body = await context.req.json()
    const { displayWidth = 853, isRecursive = false, recursiveDepth = 0, sourcePath } = body

    if (!sourcePath) return context.json({ error: "sourcePath is required" }, 400)

    return startJob(context, "setDisplayWidth", body,
      setDisplayWidth({ displayWidth, isRecursive, recursiveDepth, sourcePath }))
  },
)

commandRoutes.post(
  "/jobs/splitChapters",
  async (context) => {
    const body = await context.req.json()
    const { chapterSplits: chapterSplitsList, sourcePath } = body

    if (!sourcePath || !chapterSplitsList?.length) {
      return context.json({ error: "sourcePath and chapterSplits are required" }, 400)
    }

    return startJob(context, "splitChapters", body,
      splitChapters({ chapterSplitsList, sourcePath }))
  },
)

commandRoutes.post(
  "/jobs/storeAspectRatioData",
  async (context) => {
    const body = await context.req.json()
    const {
      folders: folderNames = [],
      force = false,
      isRecursive = false,
      outputPath,
      recursiveDepth = 0,
      rootPath,
      sourcePath,
      threads: threadCount,
    } = body

    if (!sourcePath) return context.json({ error: "sourcePath is required" }, 400)

    return startJob(context, "storeAspectRatioData", body,
      storeAspectRatioData({
        folderNames,
        isRecursive,
        mode: (
          force
          ? "overwrite"
          : "append"
        ),
        outputPath,
        recursiveDepth,
        rootPath,
        sourcePath,
        threadCount,
      }))
  },
)
