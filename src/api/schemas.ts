import { z } from "@hono/zod-openapi"

import { iso6392LanguageCodes } from "../tools/iso6392LanguageCodes.js"

// Shared response schemas
export const createJobResponseSchema = (
  outputFolderNameSchema: z.ZodTypeAny = z.null(),
) => (
  z.object({
    jobId: z.string().openapi({ example: "123e4567-e89b-12d3-a456-426614174000" }).describe("Unique job identifier"),
    logsUrl: z.string().openapi({ example: "/jobs/123e4567-e89b-12d3-a456-426614174000/logs" }).describe("URL to stream job logs via SSE"),
    outputFolderName: outputFolderNameSchema.describe("Output folder name where files are written, or null for in-place operations"),
  })
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

const setScriptInfoRuleSchema = z.object({
  type: z.literal("setScriptInfo"),
  key: z.string()
    .describe("Key name in the [Script Info] section of the ASS file (e.g. 'YCbCr Matrix', 'ScriptType', 'PlayResX'). The key is matched case-sensitively. If the key does not already exist it is appended after the last existing property."),
  value: z.string()
    .describe("New value to assign to the key (e.g. 'TV.709', 'v4.00+', '1920')."),
}).openapi({
  description: "Sets or adds a single key-value pair in the [Script Info] section of an ASS subtitle file. Use this to correct metadata fields such as YCbCr Matrix, ScriptType, or resolution values.",
})

const scaleResolutionRuleSchema = z.object({
  type: z.literal("scaleResolution"),
  from: z.object({
    width: z.number().describe("Expected current PlayResX value in the file. The rule is skipped if the file does not match this width."),
    height: z.number().describe("Expected current PlayResY value in the file. The rule is skipped if the file does not match this height."),
  }).optional().describe("Optional guard: if provided and the file's current PlayResX/Y do not match, the rule is skipped entirely. Omit to apply unconditionally regardless of current resolution."),
  to: z.object({
    width: z.number().describe("Target PlayResX value to write (e.g. 1920)."),
    height: z.number().describe("Target PlayResY value to write (e.g. 1080)."),
  }).describe("The resolution to scale the file to."),
  syncLayoutRes: z.boolean().default(true).describe("When true, updates LayoutResX and LayoutResY if they already exist in the file. Keys that are absent are left alone unless addLayoutRes is also true. Defaults to true."),
  addLayoutRes: z.boolean().default(false).describe("When true, creates LayoutResX and LayoutResY even if they are not already present. Only takes effect when syncLayoutRes is also true. Defaults to false."),
  ensureScaledBorderAndShadow: z.boolean().default(true).describe("When true, sets 'ScaledBorderAndShadow: yes' in [Script Info] after scaling, which ensures borders and shadows scale proportionally at the new resolution. Defaults to true."),
}).openapi({
  description: "Updates PlayResX/PlayResY in the [Script Info] section to rescale the subtitle canvas. 'from' is an optional guard — if provided and the file's current resolution does not match, the rule is skipped; omit it to apply unconditionally. syncLayoutRes updates LayoutResX/Y only if they already exist; pair it with addLayoutRes:true to also create them when absent.",
})

const setStyleFieldsRuleSchema = z.object({
  type: z.literal("setStyleFields"),
  skipNamePattern: z.string().optional()
    .describe("Optional case-insensitive regular expression matched against each style's Name field. Styles whose name matches are left unchanged. Use this to protect sign/song styles from being overwritten — e.g. 'signs?|op|ed|opening|ending'."),
  fields: z.record(z.string(), z.string())
    .describe("Map of ASS style field names to their new string values. Field names must use the exact ASS column names from the Format line (e.g. 'MarginL', 'MarginR', 'MarginV', 'Fontsize', 'PrimaryColour'). Only the listed fields are changed; all other style fields are left untouched."),
}).openapi({
  description: "Overwrites specific fields on every style entry in the [V4+ Styles] section of an ASS file. Optionally skips styles whose Name matches a regex (e.g. sign or song styles). Use this to bulk-update margins, font sizes, or colors across all dialogue styles.",
})

export const assModificationRuleSchema = z.discriminatedUnion("type", [
  setScriptInfoRuleSchema,
  scaleResolutionRuleSchema,
  setStyleFieldsRuleSchema,
])

export const modifySubtitleMetadataRequestSchema = z.object({
  sourcePath: z.string().describe("Source directory path containing .ass files"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
  recursiveDepth: z.number().default(0).describe("Maximum recursion depth (0 = default depth of 2)"),
  rules: z.array(assModificationRuleSchema).describe("Ordered list of DSL modification rules to apply to each .ass file"),
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

export const getSubtitleMetadataRequestSchema = z.object({
  sourcePath: z.string().describe("Directory containing .ass subtitle files to inspect"),
  isRecursive: z.boolean().default(false).describe("Search recursively in subdirectories"),
  recursiveDepth: z.number().default(0).describe("Maximum recursion depth (0 = default depth of 2)"),
})

export const subtitleFileMetadataSchema = z.object({
  filePath: z.string().describe("Absolute path to the .ass file"),
  scriptInfo: z.record(z.string(), z.string()).describe("Key-value properties from the [Script Info] section (e.g. PlayResX, PlayResY, YCbCr Matrix, ScriptType, LayoutResX, LayoutResY)"),
  styles: z.array(z.record(z.string(), z.string())).describe("Style entries from [V4+ Styles], each as a map of ASS field name to value (e.g. Name, Alignment, MarginL, MarginR, MarginV, Fontsize). Events are excluded."),
})

export const getSubtitleMetadataResponseSchema = z.object({
  files: z.array(subtitleFileMetadataSchema).describe("Metadata for each .ass file found"),
})
