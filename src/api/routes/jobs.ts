import { Hono } from "hono"

import { getAllJobs, getJob } from "../jobStore.js"

export const jobRoutes = new Hono()

jobRoutes.get(
  "/jobs",
  (context) => {
    const list = (
      getAllJobs()
      .map(({
        logs: _logs,
        ...rest
      }) => rest)
    )

    return context.json(list)
  },
)

jobRoutes.get(
  "/jobs/:id",
  (context) => {
    const job = getJob(context.req.param("id"))

    if (!job) return context.json({ error: "Job not found" }, 404)

    return context.json(job)
  },
)
