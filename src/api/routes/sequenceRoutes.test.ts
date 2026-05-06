import { afterEach, beforeAll, afterAll, describe, expect, test } from "vitest"

import { getJob, resetStore } from "../jobStore.js"
import { installLogCapture, uninstallLogCapture } from "../logCapture.js"
import { sequenceRoutes } from "./sequenceRoutes.js"

// Hono in-process testing: sequenceRoutes is just a Hono sub-app, so
// sequenceRoutes.request(url, init) drives it without spinning up a real
// server. The actual command observables inside each step run for real
// against memfs (vitest.setup.ts mocks node:fs globally), so a sequence of
// `makeDirectory` calls is a clean way to exercise the runner end-to-end:
// it produces an outputFolderName, the second step can link to it via
// { linkedTo, output: 'folder' }, and we can stat the result.

const post = (path: string, body: unknown) => (
  sequenceRoutes.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
)

const flushAfter = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// Install log capture once for the whole file so the SEQUENCE log lines
// emitted from runSequenceJob via console.info actually land on each
// job's logs array (the production server installs this once at startup;
// vitest doesn't, so we mirror the install here).
beforeAll(() => {
  installLogCapture()
})

afterAll(() => {
  uninstallLogCapture()
})

afterEach(() => {
  resetStore()
})

describe("POST /sequences/run", () => {
  test("returns 202 with a jobId + logsUrl for a valid pre-parsed body", async () => {
    const response = await post("/sequences/run", {
      paths: { workDir: { value: "/work" } },
      steps: [{ command: "makeDirectory", params: { filePath: "@workDir" } }],
    })

    expect(response.status).toBe(202)
    const body = await response.json() as { jobId: string, logsUrl: string }
    expect(typeof body.jobId).toBe("string")
    expect(body.logsUrl).toBe(`/jobs/${body.jobId}/logs`)
  })

  test("rejects malformed YAML with a 400", async () => {
    const response = await post("/sequences/run", {
      yaml: "this is: : : invalid yaml",
    })
    expect(response.status).toBe(400)
  })

  test("rejects YAML whose parsed shape doesn't match the schema with a 400", async () => {
    const response = await post("/sequences/run", {
      yaml: "steps: not-an-array",
    })
    expect(response.status).toBe(400)
  })

  test("accepts a YAML string body and parses it server-side", async () => {
    const response = await post("/sequences/run", {
      yaml: [
        "paths:",
        "  workDir:",
        "    value: /work",
        "steps:",
        "  - command: makeDirectory",
        "    params:",
        "      filePath: '@workDir'",
      ].join("\n"),
    })
    expect(response.status).toBe(202)
  })

  test("runs every step, marks the umbrella job completed, and accumulates logs", async () => {
    const response = await post("/sequences/run", {
      paths: { root: { value: "/seq-root" } },
      steps: [
        { id: "first", command: "makeDirectory", params: { filePath: "@root" } },
        { id: "second", command: "makeDirectory", params: { filePath: "@root" } },
      ],
    })
    const { jobId } = await response.json() as { jobId: string }

    // The runner spins synchronously into rxjs subscribe callbacks; one tick
    // is enough for both makeDirectory observables to complete since memfs
    // is sync under the hood.
    await flushAfter(50)

    const completedJob = getJob(jobId)
    expect(completedJob?.status).toBe("completed")
    expect(completedJob?.error).toBeNull()

    // Both steps logged their start + end markers via the SEQUENCE prefix.
    const logsBlob = (completedJob?.logs ?? []).join("\n")
    expect(logsBlob).toContain("Step first")
    expect(logsBlob).toContain("Step second")
  })

  test("fails the umbrella job and surfaces the error when a step references an unknown path variable", async () => {
    const response = await post("/sequences/run", {
      steps: [{ command: "makeDirectory", params: { filePath: "@missing" } }],
    })
    const { jobId } = await response.json() as { jobId: string }

    await flushAfter(20)

    const job = getJob(jobId)
    expect(job?.status).toBe("failed")
    expect(job?.error).toMatch(/missing/i)
  })

  test("fails the umbrella job and stops further steps when a step references an unknown command", async () => {
    const response = await post("/sequences/run", {
      steps: [
        { command: "doesNotExist", params: {} },
        { command: "makeDirectory", params: { filePath: "/should-not-run" } },
      ],
    })
    const { jobId } = await response.json() as { jobId: string }

    await flushAfter(20)

    const job = getJob(jobId)
    expect(job?.status).toBe("failed")
    expect(job?.error).toMatch(/doesNotExist/)
  })
})
