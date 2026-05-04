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
  c: Context,
  command: string,
  params: unknown,
  observable: Observable<unknown>,
) => {
  const job = createJob(command, params)

  runJob(job.id, observable)

  return c.json(
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
  async (c) => {
    const body = await c.req.json()
    const { destinationPath, sourcePath } = body

    if (!sourcePath || !destinationPath) {
      return c.json({ error: "sourcePath and destinationPath are required" }, 400)
    }

    return startJob(c, "copyFiles", body,
      copyFiles({ destinationPath, sourcePath }))
  },
)

commandRoutes.post(
  "/jobs/moveFiles",
  async (c) => {
    const body = await c.req.json()
    const { destinationPath, sourcePath } = body

    if (!sourcePath || !destinationPath) {
      return c.json({ error: "sourcePath and destinationPath are required" }, 400)
    }

    return startJob(c, "moveFiles", body,
      moveFiles({ destinationPath, sourcePath }))
  },
)

commandRoutes.post(
  "/jobs/changeTrackLanguages",
  async (c) => {
    const body = await c.req.json()
    const { audioLanguage, isRecursive = false, sourcePath, subtitlesLanguage, videoLanguage } = body

    if (!sourcePath) return c.json({ error: "sourcePath is required" }, 400)

    return startJob(c, "changeTrackLanguages", body,
      changeTrackLanguages({ audioLanguage, isRecursive, sourcePath, subtitlesLanguage, videoLanguage }))
  },
)

commandRoutes.post(
  "/jobs/fixIncorrectDefaultTracks",
  async (c) => {
    const body = await c.req.json()
    const { isRecursive = false, sourcePath } = body

    if (!sourcePath) return c.json({ error: "sourcePath is required" }, 400)

    return startJob(c, "fixIncorrectDefaultTracks", body,
      fixIncorrectDefaultTracks({ isRecursive, sourcePath }))
  },
)

commandRoutes.post(
  "/jobs/hasBetterAudio",
  async (c) => {
    const body = await c.req.json()
    const { isRecursive = false, recursiveDepth = 0, sourcePath } = body

    if (!sourcePath) return c.json({ error: "sourcePath is required" }, 400)

    return startJob(c, "hasBetterAudio", body,
      hasBetterAudio({ isRecursive, recursiveDepth, sourcePath }))
  },
)

commandRoutes.post(
  "/jobs/hasBetterVersion",
  async (c) => {
    const body = await c.req.json()
    const { isRecursive = false, recursiveDepth = 0, sourcePath } = body

    if (!sourcePath) return c.json({ error: "sourcePath is required" }, 400)

    return startJob(c, "hasBetterVersion", body,
      hasBetterVersion({ isRecursive, recursiveDepth, sourcePath }))
  },
)

commandRoutes.post(
  "/jobs/hasDuplicateMusicFiles",
  async (c) => {
    const body = await c.req.json()
    const { isRecursive = false, recursiveDepth = 0, sourcePath } = body

    if (!sourcePath) return c.json({ error: "sourcePath is required" }, 400)

    return startJob(c, "hasDuplicateMusicFiles", body,
      hasDuplicateMusicFiles({ isRecursive, recursiveDepth, sourcePath }))
  },
)

commandRoutes.post(
  "/jobs/hasImaxEnhancedAudio",
  async (c) => {
    const body = await c.req.json()
    const { isRecursive = false, sourcePath } = body

    if (!sourcePath) return c.json({ error: "sourcePath is required" }, 400)

    return startJob(c, "hasImaxEnhancedAudio", body,
      hasImaxEnhancedAudio({ isRecursive, sourcePath }))
  },
)

commandRoutes.post(
  "/jobs/hasManyAudioTracks",
  async (c) => {
    const body = await c.req.json()
    const { isRecursive = false, sourcePath } = body

    if (!sourcePath) return c.json({ error: "sourcePath is required" }, 400)

    return startJob(c, "hasManyAudioTracks", body,
      hasManyAudioTracks({ isRecursive, sourcePath }))
  },
)

commandRoutes.post(
  "/jobs/hasSurroundSound",
  async (c) => {
    const body = await c.req.json()
    const { isRecursive = false, recursiveDepth = 0, sourcePath } = body

    if (!sourcePath) return c.json({ error: "sourcePath is required" }, 400)

    return startJob(c, "hasSurroundSound", body,
      hasSurroundSound({ isRecursive, recursiveDepth, sourcePath }))
  },
)

commandRoutes.post(
  "/jobs/hasWrongDefaultTrack",
  async (c) => {
    const body = await c.req.json()
    const { isRecursive = false, sourcePath } = body

    if (!sourcePath) return c.json({ error: "sourcePath is required" }, 400)

    return startJob(c, "hasWrongDefaultTrack", body,
      hasWrongDefaultTrack({ isRecursive, sourcePath }))
  },
)

commandRoutes.post(
  "/jobs/isMissingSubtitles",
  async (c) => {
    const body = await c.req.json()
    const { isRecursive = false, sourcePath } = body

    if (!sourcePath) return c.json({ error: "sourcePath is required" }, 400)

    return startJob(c, "isMissingSubtitles", body,
      isMissingSubtitles({ isRecursive, sourcePath }))
  },
)

commandRoutes.post(
  "/jobs/keepLanguages",
  async (c) => {
    const body = await c.req.json()
    const {
      audioLanguages = [],
      isRecursive = false,
      sourcePath,
      subtitlesLanguages = [],
      useFirstAudioLanguage: hasFirstAudioLanguage = false,
      useFirstSubtitlesLanguage: hasFirstSubtitlesLanguage = false,
    } = body

    if (!sourcePath) return c.json({ error: "sourcePath is required" }, 400)

    return startJob(c, "keepLanguages", body,
      keepLanguages({ audioLanguages, hasFirstAudioLanguage, hasFirstSubtitlesLanguage, isRecursive, sourcePath, subtitlesLanguages }))
  },
)

commandRoutes.post(
  "/jobs/mergeTracks",
  async (c) => {
    const body = await c.req.json()
    const {
      automaticOffset: hasAutomaticOffset = false,
      globalOffset: globalOffsetInMilliseconds = 0,
      includeChapters: hasChapters = false,
      mediaFilesPath,
      offsets: offsetsInMilliseconds = [],
      subtitlesPath,
    } = body

    if (!subtitlesPath || !mediaFilesPath) {
      return c.json({ error: "subtitlesPath and mediaFilesPath are required" }, 400)
    }

    return startJob(c, "mergeTracks", body,
      mergeTracks({ globalOffsetInMilliseconds, hasAutomaticOffset, hasChapters, mediaFilesPath, offsetsInMilliseconds, subtitlesPath }))
  },
)

commandRoutes.post(
  "/jobs/nameAnimeEpisodes",
  async (c) => {
    const body = await c.req.json()
    const { searchTerm, seasonNumber = 1, sourcePath } = body

    if (!sourcePath || !searchTerm) {
      return c.json({ error: "sourcePath and searchTerm are required" }, 400)
    }

    return startJob(c, "nameAnimeEpisodes", body,
      nameAnimeEpisodes({ searchTerm, seasonNumber, sourcePath }))
  },
)

commandRoutes.post(
  "/jobs/nameSpecialFeatures",
  async (c) => {
    const body = await c.req.json()
    const { fixedOffset = 0, sourcePath, timecodePadding: timecodePaddingAmount = 0, url } = body

    if (!sourcePath || !url) {
      return c.json({ error: "sourcePath and url are required" }, 400)
    }

    return startJob(c, "nameSpecialFeatures", body,
      nameSpecialFeatures({ fixedOffset, sourcePath, timecodePaddingAmount, url }))
  },
)

commandRoutes.post(
  "/jobs/nameTvShowEpisodes",
  async (c) => {
    const body = await c.req.json()
    const { searchTerm, seasonNumber, sourcePath } = body

    if (!sourcePath || !searchTerm || seasonNumber == null) {
      return c.json({ error: "sourcePath, searchTerm, and seasonNumber are required" }, 400)
    }

    return startJob(c, "nameTvShowEpisodes", body,
      nameTvShowEpisodes({ searchTerm, seasonNumber, sourcePath }))
  },
)

commandRoutes.post(
  "/jobs/renameDemos",
  async (c) => {
    const body = await c.req.json()
    const { isRecursive = false, sourcePath } = body

    if (!sourcePath) return c.json({ error: "sourcePath is required" }, 400)

    return startJob(c, "renameDemos", body,
      renameDemos({ isRecursive, sourcePath }))
  },
)

commandRoutes.post(
  "/jobs/renameMovieClipDownloads",
  async (c) => {
    const body = await c.req.json()
    const { sourcePath } = body

    if (!sourcePath) return c.json({ error: "sourcePath is required" }, 400)

    return startJob(c, "renameMovieClipDownloads", body,
      renameMovieClipDownloads({ sourcePath }))
  },
)

commandRoutes.post(
  "/jobs/reorderTracks",
  async (c) => {
    // NOTE: reorderTracks.ts has tap(() => process.exit()) after toArray().
    // Remove it before this endpoint can be used safely.
    const body = await c.req.json()
    const {
      audioTrackIndexes = [],
      isRecursive = false,
      sourcePath,
      subtitlesTrackIndexes = [],
      videoTrackIndexes = [],
    } = body

    if (!sourcePath) return c.json({ error: "sourcePath is required" }, 400)

    return startJob(c, "reorderTracks", body,
      reorderTracks({ audioTrackIndexes, isRecursive, sourcePath, subtitlesTrackIndexes, videoTrackIndexes }))
  },
)

commandRoutes.post(
  "/jobs/replaceAttachments",
  async (c) => {
    const body = await c.req.json()
    const { destinationFilesPath, sourceFilesPath } = body

    if (!sourceFilesPath || !destinationFilesPath) {
      return c.json({ error: "sourceFilesPath and destinationFilesPath are required" }, 400)
    }

    return startJob(c, "replaceAttachments", body,
      replaceAttachments({ destinationFilesPath, sourceFilesPath }))
  },
)

commandRoutes.post(
  "/jobs/replaceFlacWithPcmAudio",
  async (c) => {
    const body = await c.req.json()
    const { isRecursive = false, sourcePath } = body

    if (!sourcePath) return c.json({ error: "sourcePath is required" }, 400)

    return startJob(c, "replaceFlacWithPcmAudio", body,
      replaceFlacWithPcmAudio({ isRecursive, sourcePath }))
  },
)

commandRoutes.post(
  "/jobs/replaceTracks",
  async (c) => {
    const body = await c.req.json()
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
      return c.json({ error: "sourceFilesPath and destinationFilesPath are required" }, 400)
    }

    return startJob(c, "replaceTracks", body,
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
  async (c) => {
    const body = await c.req.json()
    const { displayWidth = 853, isRecursive = false, recursiveDepth = 0, sourcePath } = body

    if (!sourcePath) return c.json({ error: "sourcePath is required" }, 400)

    return startJob(c, "setDisplayWidth", body,
      setDisplayWidth({ displayWidth, isRecursive, recursiveDepth, sourcePath }))
  },
)

commandRoutes.post(
  "/jobs/splitChapters",
  async (c) => {
    const body = await c.req.json()
    const { chapterSplits: chapterSplitsList, sourcePath } = body

    if (!sourcePath || !chapterSplitsList?.length) {
      return c.json({ error: "sourcePath and chapterSplits are required" }, 400)
    }

    return startJob(c, "splitChapters", body,
      splitChapters({ chapterSplitsList, sourcePath }))
  },
)

commandRoutes.post(
  "/jobs/storeAspectRatioData",
  async (c) => {
    const body = await c.req.json()
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

    if (!sourcePath) return c.json({ error: "sourcePath is required" }, 400)

    return startJob(c, "storeAspectRatioData", body,
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
