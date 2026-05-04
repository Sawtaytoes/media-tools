import { OpenAPIHono, createRoute } from "@hono/zod-openapi"
import { z } from "zod"

import { getAllJobs, getJob } from "../jobStore.js"
import * as schemas from "../schemas.js"

const jobDetailSchema = z.object({
  id: z.string().describe("Job ID"),
  command: z.string().describe("Command name"),
  status: z.enum(["pending", "running", "completed", "failed"]).describe("Job status"),
  params: z.unknown().describe("Command parameters"),
  results: z.array(z.unknown()).optional().describe("Job results"),
  logs: z.array(z.string()).describe("Log lines"),
  error: z.string().nullable().describe("Error message if job failed"),
  startedAt: z.string().nullable().describe("Job start timestamp"),
  completedAt: z.string().nullable().describe("Job completion timestamp"),
})

const jobListSchema = z.array(
  jobDetailSchema.omit({ logs: true }).describe("Job list entry"),
)

export const jobRoutes = new OpenAPIHono()

jobRoutes.openapi(
  createRoute({
    method: "get",
    path: "/jobs",
    summary: "List all jobs",
    tags: ["Job Management"],
    responses: {
      200: {
        description: "List of all jobs",
        content: {
          "application/json": {
            schema: jobListSchema,
          },
        },
      },
    },
  }),
  (context) => {
    const list = (
      getAllJobs()
      .map(({
        logs: _logs,
        ...rest
      }) => (
        rest
      ))
    )

    return context.json(list)
  },
)

jobRoutes.openapi(
  createRoute({
    method: "get",
    path: "/jobs/:id",
    summary: "Get job details",
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
        description: "Job details",
        content: {
          "application/json": {
            schema: jobDetailSchema,
          },
        },
      },
      404: {
        description: schemas.JOB_NOT_FOUND,
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

    if (!job) {
      return context.json({ error: schemas.JOB_NOT_FOUND }, 404)
    }

    return context.json(job, 200)
  },
)
