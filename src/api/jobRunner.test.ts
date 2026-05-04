import { EMPTY, of, Subject, throwError } from "rxjs"
import { afterEach, describe, expect, test } from "vitest"

import {
  createJob,
  getJob,
  resetStore,
} from "./jobStore.js"
import { runJob } from "./jobRunner.js"

// runJob is async in effect (RxJS subscriptions resolve on the microtask queue).
const flushMicrotasks = () => new Promise<void>((r) => setTimeout(r, 0))

afterEach(() => {
  resetStore()
})

describe(runJob.name, () => {
  test("transitions job to running immediately", () => {
    const job = createJob("hasBetterAudio", {})
    // Use a Subject that never completes so we can inspect the "running" state.
    const pending = new Subject<never>()

    runJob(job.id, pending.asObservable())

    expect(getJob(job.id)?.status).toBe("running")
    expect(getJob(job.id)?.startedAt).toBeInstanceOf(Date)

    pending.complete()
  })

  test("transitions job to completed when observable completes", async () => {
    const job = createJob("hasBetterAudio", {})

    runJob(job.id, of("result"))

    await flushMicrotasks()

    expect(getJob(job.id)?.status).toBe("completed")
    expect(getJob(job.id)?.completedAt).toBeInstanceOf(Date)
    expect(getJob(job.id)?.results).toEqual(["result"])
  })

  test("captures emitted values into job.results", async () => {
    const job = createJob("hasBetterAudio", {})

    runJob(job.id, of("first", "second"))

    await flushMicrotasks()

    expect(getJob(job.id)?.results).toEqual(["first", "second"])
  })

  test("transitions job to failed when observable errors", async () => {
    const job = createJob("hasBetterAudio", {})

    runJob(job.id, throwError(() => new Error("boom")))

    await flushMicrotasks()

    expect(getJob(job.id)?.status).toBe("failed")
    expect(getJob(job.id)?.error).toBe("Error: boom")
    expect(getJob(job.id)?.completedAt).toBeInstanceOf(Date)
  })

  test("does not overwrite failed status when catchError completes the stream", async () => {
    const job = createJob("hasBetterAudio", {})

    // throwError → catchError marks the job "failed" and returns EMPTY
    // → complete fires. Verify complete does not reset status to "completed".
    runJob(job.id, throwError(() => new Error("inner")))

    await flushMicrotasks()

    expect(getJob(job.id)?.status).toBe("failed")
  })
})
