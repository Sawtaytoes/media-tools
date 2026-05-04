import { Hono } from "hono"

import { getAllJobs, getJob } from "../jobStore.js"

export const jobRoutes = new Hono()

jobRoutes.get(
  "/jobs",
  (c) => {
    const list = (
      getAllJobs()
      .map(({
        logs: _logs,
        ...rest
      }) => rest)
    )

    return c.json(list)
  },
)

jobRoutes.get(
  "/jobs/:id",
  (c) => {
    const job = getJob(c.req.param("id"))

    if (!job) return c.json({ error: "Job not found" }, 404)

    return c.json(job)
  },
)
