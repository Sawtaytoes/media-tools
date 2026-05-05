import { firstValueFrom } from "rxjs"
import { afterEach, describe, expect, test } from "vitest"

import {
  appendJobLog,
  completeSubject,
  createJob,
  createSubject,
  getAllJobs,
  getJob,
  getSubject,
  resetStore,
  updateJob,
} from "./jobStore.js"

afterEach(() => {
  resetStore()
})

describe(createJob.name, () => {
  test("returns a job with pending status and empty logs", () => {
    const job = (
      createJob({
        commandName: "hasBetterAudio",
        params: {
          sourcePath: "/media",
        }
      })
    )

    expect(job.status).toBe("pending")
    expect(job.commandName).toBe("hasBetterAudio")
    expect(job.logs).toEqual([])
    expect(job.startedAt).toBeNull()
    expect(job.completedAt).toBeNull()
    expect(job.error).toBeNull()
  })

  test("assigns a unique id", () => {
    const a = createJob({ commandName: "hasBetterAudio" })
    const b = createJob({ commandName: "hasBetterAudio" })

    expect(a.id).not.toBe(b.id)
  })

  test("stores job so getJob can retrieve it", () => {
    const job = createJob({ commandName: "hasBetterAudio" })

    expect(getJob(job.id)).toEqual(job)
  })
})

describe(getJob.name, () => {
  test("returns undefined for unknown id", () => {
    expect(getJob("does-not-exist")).toBeUndefined()
  })
})

describe(getAllJobs.name, () => {
  test("returns empty array when no jobs exist", () => {
    expect(getAllJobs()).toEqual([])
  })

  test("returns all created jobs", () => {
    const a = createJob({ commandName: "hasBetterAudio" })
    const b = createJob({ commandName: "reorderTracks" })

    expect(getAllJobs()).toHaveLength(2)
    expect(getAllJobs().map((jobs) => jobs.id)).toContain(a.id)
    expect(getAllJobs().map((jobs) => jobs.id)).toContain(b.id)
  })
})

describe(updateJob.name, () => {
  test("returns a new object with the applied changes", () => {
    const original = createJob({ commandName: "hasBetterAudio" })
    const updated = updateJob(original.id, { status: "running" })

    expect(updated).not.toBe(original)
    expect(updated?.status).toBe("running")
    expect(updated?.commandName).toBe(original.commandName)
  })

  test("does not mutate the previous object", () => {
    const job = createJob({ commandName: "hasBetterAudio" })
    const snapshot = { ...job }

    updateJob(job.id, { status: "running" })

    expect(job.status).toBe(snapshot.status)
  })

  test("returns undefined for unknown id", () => {
    expect(updateJob("does-not-exist", { status: "running" })).toBeUndefined()
  })
})

describe(appendJobLog.name, () => {
  test("appends line to job logs", () => {
    const job = createJob({ commandName: "hasBetterAudio" })

    appendJobLog(job.id, "line one")
    appendJobLog(job.id, "line two")

    expect(getJob(job.id)?.logs).toEqual(["line one", "line two"])
  })

  test("emits to subject if one exists", async () => {
    const job = createJob({ commandName: "hasBetterAudio" })
    const subject = createSubject(job.id)
    const received: string[] = []

    subject.subscribe((line) => received.push(line))

    appendJobLog(job.id, "hello")

    expect(received).toEqual(["hello"])
  })

  test("is a no-op for unknown id", () => {
    expect(() => appendJobLog("does-not-exist", "line")).not.toThrow()
  })
})

describe(createSubject.name, () => {
  test("returns a Subject that getSubject finds", () => {
    const job = createJob({ commandName: "hasBetterAudio" })
    const subject = createSubject(job.id)

    expect(getSubject(job.id)).toBe(subject)
  })
})

describe(completeSubject.name, () => {
  test("completes the subject and removes it from the store", async () => {
    const job = createJob({ commandName: "hasBetterAudio" })
    const subject = createSubject(job.id)

    let completed = false
    subject.subscribe({ complete: () => { completed = true } })

    completeSubject(job.id)

    expect(completed).toBe(true)
    expect(getSubject(job.id)).toBeUndefined()
  })
})
