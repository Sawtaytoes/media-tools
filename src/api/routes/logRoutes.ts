import { OpenAPIHono, createRoute } from "@hono/zod-openapi"
import { streamSSE } from "hono/streaming"

import { getJob, getSubject } from "../jobStore.js"
import * as schemas from "../schemas.js"
import { startSseKeepalive } from "../sseKeepalive.js"

export const logsRoutes = new OpenAPIHono()

// SSE log stream.
// Each event data is JSON: { line: string } | { done: true, status: JobStatus }
// Replays buffered logs first, then streams live lines until the job finishes.
logsRoutes.openapi(
  createRoute({
    method: "get",
    path: "/jobs/:id/logs",
    summary: "Stream job logs via Server-Sent Events",
    tags: ["Job Management"],
    parameters: [
      {
        name: "id",
        in: "path",
        required: true,
        description: "Job ID",
        schema: { type: "string" },
      },
    ],
    responses: {
      200: {
        description: "Server-Sent Events stream of job logs",
        content: {
          "text/event-stream": {
            schema: {
              type: "string",
              description: "SSE formatted log lines",
            },
          },
        },
      },
      404: {
        description: "Job not found",
        content: {
          "application/json": {
            schema: schemas.jobNotFoundSchema,
          },
        },
      },
    },
  }),
  (context) => {
    const job = getJob(context.req.param("id"))

    if (!job) return context.json({ error: "Job not found" }, 404)

    return streamSSE(context, async (stream) => {
      const stopKeepalive = startSseKeepalive(stream)

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
        || job.status === "cancelled"
        || job.status === "skipped"
      ) {
        await send({ done: true, status: job.status, results: job.results, outputs: job.outputs })
        stopKeepalive()
        return
      }

      const subject = getSubject(job.id)

      if (!subject) {
        const finishedJob = getJob(job.id)
        await send({ done: true, status: finishedJob?.status ?? job.status, results: finishedJob?.results ?? job.results, outputs: finishedJob?.outputs ?? null })
        stopKeepalive()
        return
      }

      await new Promise<void>((resolve) => {
        const sub = subject.subscribe({
          complete: async () => {
            const completedJob = getJob(job.id)
            await send({ done: true, status: completedJob?.status ?? job.status, results: completedJob?.results ?? job.results, outputs: completedJob?.outputs ?? null })
            resolve()
          },
          error: async () => {
            const failedJob = getJob(job.id)
            await send({ done: true, status: failedJob?.status ?? job.status })
            resolve()
          },
          next: (event) => {
            if (typeof event === "string") {
              stream.writeSSE({ data: JSON.stringify({ line: event }) })
            } else {
              stream.writeSSE({ data: JSON.stringify(event) })
            }
          },
        })

        stream.onAbort(() => {
          stopKeepalive()
          sub.unsubscribe()
          resolve()
        })
      })

      stopKeepalive()
    })
  },
)
