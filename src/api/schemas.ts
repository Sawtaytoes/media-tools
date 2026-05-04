import { z } from "@hono/zod-openapi"

import { iso6392LanguageCodes } from "../iso6392LanguageCodes.js"

// Shared response schemas
export const createJobResponseSchema = () => (
  z.object({
    jobId: z.string().openapi({ example: "123e4567-e89b-12d3-a456-426614174000" }).describe("Unique job identifier"),
    logsUrl: z.string().openapi({ example: "/jobs/123e4567-e89b-12d3-a456-426614174000/logs" }).describe("URL to stream job logs via SSE"),
    outputFolderName: z.string().nullable().describe("Output folder name where files are written, or null for in-place operations"),
  }).openapi("JobResponse")
)

export const validationErrorSchema = z.object({
  error: z.string().describe("Error message"),
}).openapi("ValidationError")

export const JOB_NOT_FOUND = "Job not found" as const
export const jobNotFoundSchema = z.object({
  error: z.literal(JOB_NOT_FOUND).describe("Job not found error"),
}).openapi("JobNotFound")

// Command request schemas
export const copyFilesRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  destinationPath: z.string().describe("Destination directory path"),
})

export const moveFilesRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  destinationPath: z.string().describe("Destination directory path"),
})

export const copyOutSubtitlesRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
  subtitlesLanguage: z.enum(iso6392LanguageCodes).optional().describe("Filter subtitles by language"),
})

export const getAudioOffsetsRequestSchema = z.object({
  sourceFilesPath: z.string().describe("Path to source audio files"),
  destinationFilesPath: z.string().describe("Path to destination audio files"),
})

export const changeTrackLanguagesRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
  audioLanguage: z.enum(iso6392LanguageCodes).optional().describe("Audio track language code"),
  subtitlesLanguage: z.enum(iso6392LanguageCodes).optional().describe("Subtitle track language code"),
  videoLanguage: z.enum(iso6392LanguageCodes).optional().describe("Video track language code"),
})

export const fixIncorrectDefaultTracksRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
})

export const hasBetterAudioRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
  recursiveDepth: z.number().default(0).describe("Maximum recursion depth"),
})

export const hasBetterVersionRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
  recursiveDepth: z.number().default(0).describe("Maximum recursion depth"),
})

export const hasDuplicateMusicFilesRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
  recursiveDepth: z.number().default(0).describe("Maximum recursion depth"),
})

export const hasImaxEnhancedAudioRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
})

export const hasManyAudioTracksRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
})

export const hasSurroundSoundRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
  recursiveDepth: z.number().default(0).describe("Maximum recursion depth"),
})

export const hasWrongDefaultTrackRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
})

export const isMissingSubtitlesRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
})

export const keepLanguagesRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
  audioLanguages: z.array(z.enum(iso6392LanguageCodes)).default([]).describe("Audio languages to keep"),
  subtitlesLanguages: z.array(z.enum(iso6392LanguageCodes)).default([]).describe("Subtitle languages to keep"),
  useFirstAudioLanguage: z.boolean().default(false).describe("Keep first audio language only"),
  useFirstSubtitlesLanguage: z.boolean().default(false).describe("Keep first subtitle language only"),
})

export const mergeTracksRequestSchema = z.object({
  mediaFilesPath: z.string().describe("Path to media files"),
  subtitlesPath: z.string().describe("Path to subtitle files"),
  automaticOffset: z.boolean().default(false).describe("Automatically detect synchronization offset"),
  globalOffset: z.number().default(0).describe("Global audio offset in milliseconds"),
  includeChapters: z.boolean().default(false).describe("Include chapter markers"),
  offsets: z.array(z.number()).default([]).describe("Per-file audio offsets in milliseconds"),
})

export const nameAnimeEpisodesRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  searchTerm: z.string().describe("Anime title to search for"),
  seasonNumber: z.number().default(1).describe("Season number"),
})

export const nameSpecialFeaturesRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  url: z.string().describe("URL containing special features information"),
  fixedOffset: z.number().default(0).describe("Fixed timecode offset in milliseconds"),
  timecodePadding: z.number().default(0).describe("Timecode padding amount"),
})

export const nameTvShowEpisodesRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  searchTerm: z.string().describe("TV show title to search for"),
  seasonNumber: z.number().describe("Season number"),
})

export const renameDemosRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
})

export const renameMovieClipDownloadsRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
})

export const reorderTracksRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
  videoTrackIndexes: z.array(z.number()).default([]).describe("Video track order indices"),
  audioTrackIndexes: z.array(z.number()).default([]).describe("Audio track order indices"),
  subtitlesTrackIndexes: z.array(z.number()).default([]).describe("Subtitle track order indices"),
})

export const replaceAttachmentsRequestSchema = z.object({
  sourceFilesPath: z.string().describe("Path to source files with attachments"),
  destinationFilesPath: z.string().describe("Path to destination files"),
})

export const replaceFlacWithPcmAudioRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
})

export const replaceTracksRequestSchema = z.object({
  sourceFilesPath: z.string().describe("Path to source files"),
  destinationFilesPath: z.string().describe("Path to destination files"),
  automaticOffset: z.boolean().default(false).describe("Automatically detect synchronization offset"),
  globalOffset: z.number().default(0).describe("Global audio offset in milliseconds"),
  includeChapters: z.boolean().default(false).describe("Include chapter markers"),
  audioLanguages: z.array(z.enum(iso6392LanguageCodes)).default([]).describe("Audio languages to include"),
  subtitlesLanguages: z.array(z.enum(iso6392LanguageCodes)).default([]).describe("Subtitle languages to include"),
  videoLanguages: z.array(z.enum(iso6392LanguageCodes)).default([]).describe("Video languages to include"),
  offsets: z.array(z.number()).default([]).describe("Per-file audio offsets in milliseconds"),
})

export const setDisplayWidthRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
  recursiveDepth: z.number().default(0).describe("Maximum recursion depth"),
  displayWidth: z.number().default(853).describe("Display width in pixels"),
})

export const splitChaptersRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  chapterSplits: z.array(z.string()).describe("Chapter split definitions"),
})

export const storeAspectRatioDataRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
  recursiveDepth: z.number().default(0).describe("Maximum recursion depth"),
  outputPath: z.string().optional().describe("Output path for aspect ratio data"),
  rootPath: z.string().optional().describe("Root path for relative paths"),
  folders: z.array(z.string()).default([]).describe("Specific folders to process"),
  force: z.boolean().default(false).describe("Force overwrite existing data"),
  threads: z.number().optional().describe("Number of threads to use"),
})
