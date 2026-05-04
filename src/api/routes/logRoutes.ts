import { OpenAPIHono, createRoute } from "@hono/zod-openapi"
import { streamSSE } from "hono/streaming"

import { getJob, getSubject } from "../jobStore.js"
import * as schemas from "../schemas.js"

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
        await send({ done: true, status: job.status, results: job.results })

        return
      }

      const subject = getSubject(job.id)

      if (!subject) {
        await send({ done: true, status: job.status, results: job.results })

        return
      }

      await new Promise<void>((resolve) => {
        const sub = subject.subscribe({
          complete: async () => {
            await send({ done: true, status: job.status, results: job.results })
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
