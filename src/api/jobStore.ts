import { randomUUID } from "node:crypto"
import { Subject } from "rxjs"

import type { Job, PromptEvent } from "./types.js"

// ---------------------------------------------------------------------------
// Module-level state — only mutated through the exported functions below.
// ---------------------------------------------------------------------------

const jobs = new Map<string, Job>()
const subjects = new Map<string, Subject<string | PromptEvent>>()
const jobSubject = new Subject<Omit<Job, "logs">>()

export const jobEvents$ = jobSubject.asObservable()

// ---------------------------------------------------------------------------
// Job CRUD
// ---------------------------------------------------------------------------

export const createJob = ({
  commandName,
  params,
  outputFolderName = null,
}: {
  commandName: string,
  params?: unknown,
  outputFolderName?: string | null,
}): Job => {
  const job: Job = {
    commandName,
    completedAt: null,
    error: null,
    id: randomUUID(),
    logs: [],
    outputFolderName,
    params,
    results: [],
    startedAt: null,
    status: "pending",
  }

  jobs.set(job.id, job)

  const { logs: _logs, ...rest } = job
  jobSubject.next(rest)

  return job
}

export const getJob = (
  id: string,
): Job | undefined => (
  jobs.get(id)
)

export const getAllJobs = (): Job[] => (
  Array.from(
    jobs.values()
  )
)

// Returns a new Job object (spread-based update, no direct property mutation).
export const updateJob = (
  id: string,
  changes: Partial<Omit<Job, "command" | "id" | "logs" | "params">>,
): Job | undefined => {
  const existing = jobs.get(id)

  if (!existing) return undefined

  const updated: Job = {
    ...existing,
    ...changes,
  }

  jobs.set(id, updated)

  const { logs: _logs, ...rest } = updated
  jobSubject.next(rest)

  return updated
}

// Appends a log line in place (append-only; avoids O(n) array spread per line).
export const appendJobLog = (
  id: string,
  line: string,
): void => {
  const job = jobs.get(id)

  if (!job) return

  job.logs.push(line)
  subjects.get(id)?.next(line)
}

// ---------------------------------------------------------------------------
// Per-job SSE subject
// ---------------------------------------------------------------------------

export const createSubject = (
  id: string,
): Subject<string | PromptEvent> => {
  const subject = new Subject<string | PromptEvent>()

  subjects.set(id, subject)

  return subject
}

export const getSubject = (
  id: string,
): Subject<string | PromptEvent> | undefined => (
  subjects.get(id)
)

export const emitJobEvent = (
  id: string,
  event: PromptEvent,
): void => {
  subjects.get(id)?.next(event)
}

export const completeSubject = (
  id: string,
): void => {
  subjects.get(id)?.complete()
  subjects.delete(id)
}

// ---------------------------------------------------------------------------
// Test helper — clears all state between tests.
// ---------------------------------------------------------------------------

export const resetStore = (): void => {
  jobs.clear()
  subjects.clear()
}
