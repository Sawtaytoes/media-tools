/**
 * REST API wrapping cli.ts commands.
 *
 * STREAMING: uses Server-Sent Events (SSE) via Hono's streamSSE.
 *   POST /jobs/<command>   → starts a job, returns { jobId, logsUrl }
 *   GET  /jobs             → list all jobs (without log arrays)
 *   GET  /jobs/:id         → get job status + full log buffer
 *   GET  /jobs/:id/logs    → SSE stream: { line } events, then { done, status }
 *
 * PROGRESS / OUTPUT: all module output goes through logMessage.ts → console.*
 *   This file captures that by monkey-patching console during each job.
 *   Limitation: concurrent jobs will mix log output. For true concurrency,
 *   logMessage.ts would need a per-job emitter threaded through every module.
 *
 * CRITICAL: any module that calls process.exit() (e.g. reorderTracks has a
 *   tap(() => process.exit()) after toArray()) will kill the server on completion.
 *   Remove those calls from module files — they belong only in cli.ts.
 *
 * ERROR VISIBILITY: catchNamedError swallows errors into EMPTY after logging them
 *   via console.error. The error appears in the SSE log stream but job.status
 *   will show "completed" not "failed". Modify catchNamedError to re-throw if
 *   you want accurate failure status from the API.
 */

import { serve } from "@hono/node-server"
import { Hono, type Context } from "hono"
import { streamSSE } from "hono/streaming"
import { randomUUID } from "node:crypto"
import { EMPTY, Subject, type Observable } from "rxjs"
import { catchError } from "rxjs"

import { changeTrackLanguages } from "./changeTrackLanguages.js"
import { copyFiles } from "./copyFiles.js"
import { moveFiles } from "./moveFiles.js"
import { fixIncorrectDefaultTracks } from "./fixIncorrectDefaultTracks.js"
import { hasBetterAudio } from "./hasBetterAudio.js"
import { hasBetterVersion } from "./hasBetterVersion.js"
import { hasDuplicateMusicFiles } from "./hasDuplicateMusicFiles.js"
import { hasImaxEnhancedAudio } from "./hasImaxEnhancedAudio.js"
import { hasManyAudioTracks } from "./hasManyAudioTracks.js"
import { hasSurroundSound } from "./hasSurroundSound.js"
import { hasWrongDefaultTrack } from "./hasWrongDefaultTrack.js"
import { isMissingSubtitles } from "./isMissingSubtitles.js"
import { keepLanguages } from "./keepLanguages.js"
import { mergeTracks } from "./mergeTracks.js"
import { nameAnimeEpisodes } from "./nameAnimeEpisodes.js"
import { nameSpecialFeatures } from "./nameSpecialFeatures.js"
import { nameTvShowEpisodes } from "./nameTvShowEpisodes.js"
import { renameDemos } from "./renameDemos.js"
import { renameMovieClipDownloads } from "./renameMovieClipDownloads.js"
import { reorderTracks } from "./reorderTracks.js"
import { replaceAttachments } from "./replaceAttachments.js"
import { replaceFlacWithPcmAudio } from "./replaceFlacWithPcmAudio.js"
import { replaceTracks } from "./replaceTracks.js"
import { setDisplayWidth } from "./setDisplayWidth.js"
import { splitChapters } from "./splitChapters.js"
import { storeAspectRatioData } from "./storeAspectRatioData.js"

// ---------------------------------------------------------------------------
// Job model
// ---------------------------------------------------------------------------

type JobStatus = "pending" | "running" | "completed" | "failed"

type Job = {
  id: string
  command: string
  params: unknown
  status: JobStatus
  startedAt: Date | null
  completedAt: Date | null
  logs: string[]
  error: string | null
}

const jobs = new Map<string, Job>()
const jobLogSubjects = new Map<string, Subject<string>>()

const createJob = (command: string, params: unknown): Job => {
  const job: Job = {
    id: randomUUID(),
    command,
    completedAt: null,
    error: null,
    logs: [],
    params,
    startedAt: null,
    status: "pending",
  }
  jobs.set(job.id, job)
  return job
}

// ---------------------------------------------------------------------------
// Console capture
// ---------------------------------------------------------------------------

const stripAnsi = (str: string) =>
  str.replace(/\x1B\[(?:[0-9]{1,3}(?:;[0-9]{1,2}(?:;[0-9]{1,3})?)?)?[mGKHFJsu]/g, "")

const original = {
  error: console.error.bind(console),
  info: console.info.bind(console),
  log: console.log.bind(console),
  warn: console.warn.bind(console),
}

let captureJobId: string | null = null

const emit = (args: unknown[]) => {
  if (!captureJobId) return
  const line = stripAnsi(
    args.map(a => (a instanceof Error ? a.stack ?? a.message : String(a))).join(" ")
  ).trim()
  if (!line) return
  jobs.get(captureJobId)?.logs.push(line)
  jobLogSubjects.get(captureJobId)?.next(line)
}

const patchConsole = (jobId: string) => {
  captureJobId = jobId
  for (const method of ["log", "info", "warn", "error"] as const) {
    console[method] = (...args: unknown[]) => {
      original[method](...args)
      emit(args)
    }
  }
}

const unpatchConsole = () => {
  captureJobId = null
  for (const method of ["log", "info", "warn", "error"] as const) {
    console[method] = original[method]
  }
}

// ---------------------------------------------------------------------------
// Job runner
// ---------------------------------------------------------------------------

const runJob = (job: Job, observable: Observable<unknown>) => {
  const subject = new Subject<string>()
  jobLogSubjects.set(job.id, subject)

  job.status = "running"
  job.startedAt = new Date()
  patchConsole(job.id)

  observable
    .pipe(
      catchError((err) => {
        job.status = "failed"
        job.error = String(err)
        return EMPTY
      }),
    )
    .subscribe({
      complete: () => {
        unpatchConsole()
        if (job.status !== "failed") job.status = "completed"
        job.completedAt = new Date()
        subject.complete()
        jobLogSubjects.delete(job.id)
      },
      error: (err) => {
        unpatchConsole()
        job.status = "failed"
        job.error = String(err)
        job.completedAt = new Date()
        subject.complete()
        jobLogSubjects.delete(job.id)
      },
    })
}

// ---------------------------------------------------------------------------
// Hono app
// ---------------------------------------------------------------------------

const app = new Hono()

// --- Job management ---

app.get("/jobs", (c) => {
  const list = Array.from(jobs.values()).map(({ logs: _logs, ...rest }) => rest)
  return c.json(list)
})

app.get("/jobs/:id", (c) => {
  const job = jobs.get(c.req.param("id"))
  if (!job) return c.json({ error: "Job not found" }, 404)
  return c.json(job)
})

// SSE log stream
// Connect via: const es = new EventSource("/jobs/<id>/logs")
// Each message: { line: string } | { done: true, status: JobStatus }
app.get("/jobs/:id/logs", (c) => {
  const job = jobs.get(c.req.param("id"))
  if (!job) return c.json({ error: "Job not found" }, 404)

  return streamSSE(c, async (stream) => {
    const send = (payload: object) =>
      stream.writeSSE({ data: JSON.stringify(payload) })

    for (const line of job.logs) await send({ line })

    if (job.status === "completed" || job.status === "failed") {
      await send({ done: true, status: job.status })
      return
    }

    const subject = jobLogSubjects.get(job.id)
    if (!subject) {
      await send({ done: true, status: job.status })
      return
    }

    await new Promise<void>((resolve) => {
      const sub = subject.subscribe({
        complete: async () => {
          await send({ done: true, status: job.status })
          resolve()
        },
        error: async () => {
          await send({ done: true, status: job.status })
          resolve()
        },
        next: (line) => { stream.writeSSE({ data: JSON.stringify({ line }) }) },
      })
      stream.onAbort(() => { sub.unsubscribe(); resolve() })
    })
  })
})

// --- Command helper ---

const startJob = (
  c: Context,
  command: string,
  params: unknown,
  observable: Observable<unknown>,
) => {
  const job = createJob(command, params)
  runJob(job, observable)
  return c.json({ jobId: job.id, logsUrl: `/jobs/${job.id}/logs` }, 202)
}

// --- Command endpoints ---

app.post("/jobs/copyFiles", async (c) => {
  const body = await c.req.json()
  const { sourcePath, destinationPath } = body
  if (!sourcePath || !destinationPath) return c.json({ error: "sourcePath and destinationPath are required" }, 400)
  return startJob(c, "copyFiles", body,
    copyFiles({ destinationPath, sourcePath }))
})

app.post("/jobs/moveFiles", async (c) => {
  const body = await c.req.json()
  const { sourcePath, destinationPath } = body
  if (!sourcePath || !destinationPath) return c.json({ error: "sourcePath and destinationPath are required" }, 400)
  return startJob(c, "moveFiles", body,
    moveFiles({ destinationPath, sourcePath }))
})

app.post("/jobs/changeTrackLanguages", async (c) => {
  const body = await c.req.json()
  const { sourcePath, audioLanguage, isRecursive = false, subtitlesLanguage, videoLanguage } = body
  if (!sourcePath) return c.json({ error: "sourcePath is required" }, 400)
  return startJob(c, "changeTrackLanguages", body,
    changeTrackLanguages({ audioLanguage, isRecursive, sourcePath, subtitlesLanguage, videoLanguage }))
})

app.post("/jobs/fixIncorrectDefaultTracks", async (c) => {
  const body = await c.req.json()
  const { sourcePath, isRecursive = false } = body
  if (!sourcePath) return c.json({ error: "sourcePath is required" }, 400)
  return startJob(c, "fixIncorrectDefaultTracks", body,
    fixIncorrectDefaultTracks({ isRecursive, sourcePath }))
})

app.post("/jobs/hasBetterAudio", async (c) => {
  const body = await c.req.json()
  const { sourcePath, isRecursive = false, recursiveDepth = 0 } = body
  if (!sourcePath) return c.json({ error: "sourcePath is required" }, 400)
  return startJob(c, "hasBetterAudio", body,
    hasBetterAudio({ isRecursive, recursiveDepth, sourcePath }))
})

app.post("/jobs/hasBetterVersion", async (c) => {
  const body = await c.req.json()
  const { sourcePath, isRecursive = false, recursiveDepth = 0 } = body
  if (!sourcePath) return c.json({ error: "sourcePath is required" }, 400)
  return startJob(c, "hasBetterVersion", body,
    hasBetterVersion({ isRecursive, recursiveDepth, sourcePath }))
})

app.post("/jobs/hasDuplicateMusicFiles", async (c) => {
  const body = await c.req.json()
  const { sourcePath, isRecursive = false, recursiveDepth = 0 } = body
  if (!sourcePath) return c.json({ error: "sourcePath is required" }, 400)
  return startJob(c, "hasDuplicateMusicFiles", body,
    hasDuplicateMusicFiles({ isRecursive, recursiveDepth, sourcePath }))
})

app.post("/jobs/hasImaxEnhancedAudio", async (c) => {
  const body = await c.req.json()
  const { sourcePath, isRecursive = false } = body
  if (!sourcePath) return c.json({ error: "sourcePath is required" }, 400)
  return startJob(c, "hasImaxEnhancedAudio", body,
    hasImaxEnhancedAudio({ isRecursive, sourcePath }))
})

app.post("/jobs/hasManyAudioTracks", async (c) => {
  const body = await c.req.json()
  const { sourcePath, isRecursive = false } = body
  if (!sourcePath) return c.json({ error: "sourcePath is required" }, 400)
  return startJob(c, "hasManyAudioTracks", body,
    hasManyAudioTracks({ isRecursive, sourcePath }))
})

app.post("/jobs/hasSurroundSound", async (c) => {
  const body = await c.req.json()
  const { sourcePath, isRecursive = false, recursiveDepth = 0 } = body
  if (!sourcePath) return c.json({ error: "sourcePath is required" }, 400)
  return startJob(c, "hasSurroundSound", body,
    hasSurroundSound({ isRecursive, recursiveDepth, sourcePath }))
})

app.post("/jobs/hasWrongDefaultTrack", async (c) => {
  const body = await c.req.json()
  const { sourcePath, isRecursive = false } = body
  if (!sourcePath) return c.json({ error: "sourcePath is required" }, 400)
  return startJob(c, "hasWrongDefaultTrack", body,
    hasWrongDefaultTrack({ isRecursive, sourcePath }))
})

app.post("/jobs/isMissingSubtitles", async (c) => {
  const body = await c.req.json()
  const { sourcePath, isRecursive = false } = body
  if (!sourcePath) return c.json({ error: "sourcePath is required" }, 400)
  return startJob(c, "isMissingSubtitles", body,
    isMissingSubtitles({ isRecursive, sourcePath }))
})

app.post("/jobs/keepLanguages", async (c) => {
  const body = await c.req.json()
  const {
    sourcePath,
    audioLanguages = [],
    isRecursive = false,
    subtitlesLanguages = [],
    useFirstAudioLanguage: hasFirstAudioLanguage = false,
    useFirstSubtitlesLanguage: hasFirstSubtitlesLanguage = false,
  } = body
  if (!sourcePath) return c.json({ error: "sourcePath is required" }, 400)
  return startJob(c, "keepLanguages", body,
    keepLanguages({ audioLanguages, hasFirstAudioLanguage, hasFirstSubtitlesLanguage, isRecursive, sourcePath, subtitlesLanguages }))
})

app.post("/jobs/mergeTracks", async (c) => {
  const body = await c.req.json()
  const {
    subtitlesPath,
    mediaFilesPath,
    offsets: offsetsInMilliseconds = [],
    automaticOffset: hasAutomaticOffset = false,
    includeChapters: hasChapters = false,
    globalOffset: globalOffsetInMilliseconds = 0,
  } = body
  if (!subtitlesPath || !mediaFilesPath) return c.json({ error: "subtitlesPath and mediaFilesPath are required" }, 400)
  return startJob(c, "mergeTracks", body,
    mergeTracks({ globalOffsetInMilliseconds, hasAutomaticOffset, hasChapters, mediaFilesPath, offsetsInMilliseconds, subtitlesPath }))
})

app.post("/jobs/nameAnimeEpisodes", async (c) => {
  const body = await c.req.json()
  const { sourcePath, searchTerm, seasonNumber = 1 } = body
  if (!sourcePath || !searchTerm) return c.json({ error: "sourcePath and searchTerm are required" }, 400)
  return startJob(c, "nameAnimeEpisodes", body,
    nameAnimeEpisodes({ searchTerm, seasonNumber, sourcePath }))
})

app.post("/jobs/nameSpecialFeatures", async (c) => {
  const body = await c.req.json()
  const { sourcePath, url, fixedOffset = 0, timecodePadding: timecodePaddingAmount = 0 } = body
  if (!sourcePath || !url) return c.json({ error: "sourcePath and url are required" }, 400)
  return startJob(c, "nameSpecialFeatures", body,
    nameSpecialFeatures({ fixedOffset, sourcePath, timecodePaddingAmount, url }))
})

app.post("/jobs/nameTvShowEpisodes", async (c) => {
  const body = await c.req.json()
  const { sourcePath, searchTerm, seasonNumber } = body
  if (!sourcePath || !searchTerm || seasonNumber == null) return c.json({ error: "sourcePath, searchTerm, and seasonNumber are required" }, 400)
  return startJob(c, "nameTvShowEpisodes", body,
    nameTvShowEpisodes({ searchTerm, seasonNumber, sourcePath }))
})

app.post("/jobs/renameDemos", async (c) => {
  const body = await c.req.json()
  const { sourcePath, isRecursive = false } = body
  if (!sourcePath) return c.json({ error: "sourcePath is required" }, 400)
  return startJob(c, "renameDemos", body,
    renameDemos({ isRecursive, sourcePath }))
})

app.post("/jobs/renameMovieClipDownloads", async (c) => {
  const body = await c.req.json()
  const { sourcePath } = body
  if (!sourcePath) return c.json({ error: "sourcePath is required" }, 400)
  return startJob(c, "renameMovieClipDownloads", body,
    renameMovieClipDownloads({ sourcePath }))
})

app.post("/jobs/reorderTracks", async (c) => {
  // WARNING: reorderTracks.ts calls process.exit() in a tap() after toArray().
  // Remove that tap before using this endpoint or the server will exit after the first job.
  const body = await c.req.json()
  const {
    sourcePath,
    isRecursive = false,
    audioTrackIndexes = [],
    subtitlesTrackIndexes = [],
    videoTrackIndexes = [],
  } = body
  if (!sourcePath) return c.json({ error: "sourcePath is required" }, 400)
  return startJob(c, "reorderTracks", body,
    reorderTracks({ audioTrackIndexes, isRecursive, sourcePath, subtitlesTrackIndexes, videoTrackIndexes }))
})

app.post("/jobs/replaceAttachments", async (c) => {
  const body = await c.req.json()
  const { sourceFilesPath, destinationFilesPath } = body
  if (!sourceFilesPath || !destinationFilesPath) return c.json({ error: "sourceFilesPath and destinationFilesPath are required" }, 400)
  return startJob(c, "replaceAttachments", body,
    replaceAttachments({ destinationFilesPath, sourceFilesPath }))
})

app.post("/jobs/replaceFlacWithPcmAudio", async (c) => {
  const body = await c.req.json()
  const { sourcePath, isRecursive = false } = body
  if (!sourcePath) return c.json({ error: "sourcePath is required" }, 400)
  return startJob(c, "replaceFlacWithPcmAudio", body,
    replaceFlacWithPcmAudio({ isRecursive, sourcePath }))
})

app.post("/jobs/replaceTracks", async (c) => {
  const body = await c.req.json()
  const {
    sourceFilesPath,
    destinationFilesPath,
    audioLanguages = [],
    automaticOffset: hasAutomaticOffset = false,
    globalOffset: globalOffsetInMilliseconds = 0,
    includeChapters: hasChapters = false,
    offsets = [],
    subtitlesLanguages = [],
    videoLanguages = [],
  } = body
  if (!sourceFilesPath || !destinationFilesPath) return c.json({ error: "sourceFilesPath and destinationFilesPath are required" }, 400)
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
})

app.post("/jobs/setDisplayWidth", async (c) => {
  const body = await c.req.json()
  const { sourcePath, displayWidth = 853, isRecursive = false, recursiveDepth = 0 } = body
  if (!sourcePath) return c.json({ error: "sourcePath is required" }, 400)
  return startJob(c, "setDisplayWidth", body,
    setDisplayWidth({ displayWidth, isRecursive, recursiveDepth, sourcePath }))
})

app.post("/jobs/splitChapters", async (c) => {
  const body = await c.req.json()
  const { sourcePath, chapterSplits: chapterSplitsList } = body
  if (!sourcePath || !chapterSplitsList?.length) return c.json({ error: "sourcePath and chapterSplits are required" }, 400)
  return startJob(c, "splitChapters", body,
    splitChapters({ chapterSplitsList, sourcePath }))
})

app.post("/jobs/storeAspectRatioData", async (c) => {
  const body = await c.req.json()
  const {
    sourcePath,
    folders: folderNames = [],
    force = false,
    isRecursive = false,
    outputPath,
    recursiveDepth = 0,
    rootPath,
    threads: threadCount,
  } = body
  if (!sourcePath) return c.json({ error: "sourcePath is required" }, 400)
  return startJob(c, "storeAspectRatioData", body,
    storeAspectRatioData({
      folderNames,
      isRecursive,
      mode: force ? "overwrite" : "append",
      outputPath,
      recursiveDepth,
      rootPath,
      sourcePath,
      threadCount,
    }))
})

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const PORT = Number(process.env.PORT ?? 3000)
serve({ fetch: app.fetch, port: PORT }, () =>
  original.log(`Media tools API listening on :${PORT}`)
)
