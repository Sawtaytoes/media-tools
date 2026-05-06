import { randomUUID } from "node:crypto"
import { Subject, type Subscription } from "rxjs"

import type { Job, PromptEvent } from "./types.js"

// ---------------------------------------------------------------------------
// Module-level state — only mutated through the exported functions below.
// ---------------------------------------------------------------------------

const jobs = new Map<string, Job>()
const subjects = new Map<string, Subject<string | PromptEvent>>()
// Live RxJS Subscriptions keyed by jobId. Populated by jobRunner /
// sequenceRunner when a job starts running, removed on natural completion
// or by cancelJob below. Not exposed — Subscription objects aren't
// serializable so we keep them out of the Job type.
const jobSubscriptions = new Map<string, Subscription>()
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
    outputs: null,
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
// Subscription registry — for cancellation.
// ---------------------------------------------------------------------------

// Called by jobRunner / sequenceRunner once a subscription is live. Skip
// when the subscription has already closed synchronously (e.g., the
// observable completed during subscribe()) — registering a closed sub
// would leak into the map with no way to remove it.
export const registerJobSubscription = (
  id: string,
  subscription: Subscription,
): void => {
  if (subscription.closed) return
  jobSubscriptions.set(id, subscription)
}

// Called by the runner's complete / error handlers (and cancelJob) to
// release the slot once the job is truly terminal.
export const unregisterJobSubscription = (
  id: string,
): void => {
  jobSubscriptions.delete(id)
}

// Cancellation entry point used by `DELETE /jobs/:id`. Returns true when
// a running job was cancelled, false when the job is missing or already
// in a terminal state (caller maps these to 404 / 204 respectively).
export const cancelJob = (
  id: string,
): boolean => {
  const job = jobs.get(id)
  if (!job) return false
  if (job.status !== "running") return false

  const subscription = jobSubscriptions.get(id)
  if (subscription) {
    subscription.unsubscribe()
    jobSubscriptions.delete(id)
  }

  updateJob(id, {
    completedAt: new Date(),
    status: "cancelled",
  })

  completeSubject(id)
  return true
}

// ---------------------------------------------------------------------------
// Test helper — clears all state between tests.
// ---------------------------------------------------------------------------

export const resetStore = (): void => {
  jobs.clear()
  subjects.clear()
  jobSubscriptions.clear()
}
