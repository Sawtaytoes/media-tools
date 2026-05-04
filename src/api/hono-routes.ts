import { Hono } from "hono"

import { commandRoutes } from "./routes/commands.js"
import { jobRoutes } from "./routes/jobs.js"
import { logsRoutes } from "./routes/logs.js"

export const hono = new Hono()

hono.route("/", jobRoutes)
hono.route("/", logsRoutes)
hono.route("/", commandRoutes)
