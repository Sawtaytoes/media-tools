import { Hono } from "hono"
import { streamSSE } from "hono/streaming"

import { getJob, getSubject } from "../jobStore.js"

export const logsRoutes = new Hono()

// SSE log stream.
// Each event data is JSON: { line: string } | { done: true, status: JobStatus }
// Replays buffered logs first, then streams live lines until the job finishes.
logsRoutes.get(
  "/jobs/:id/logs",
  (c) => {
    const job = getJob(c.req.param("id"))

    if (!job) return c.json({ error: "Job not found" }, 404)

    return streamSSE(c, async (stream) => {
      const send = (
        payload: object,
      ) => (
        stream.writeSSE({
          data: JSON.stringify(payload),
        })
      )

      for (const line of job.logs) {
        await send({ line })
      }

      if (
        job.status === "completed"
        || job.status === "failed"
      ) {
        await send({ done: true, status: job.status })

        return
      }

      const subject = getSubject(job.id)

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
          next: (line) => {
            stream.writeSSE({
              data: JSON.stringify({ line }),
            })
          },
        })

        stream.onAbort(() => {
          sub.unsubscribe()
          resolve()
        })
      })
    })
  },
)
