import { OpenAPIHono } from "@hono/zod-openapi"

import { commandRoutes } from "./routes/commands.js"
import { jobRoutes } from "./routes/jobs.js"
import { logsRoutes } from "./routes/logs.js"

export const hono = new OpenAPIHono()

hono.route("/", jobRoutes)
hono.route("/", logsRoutes)
hono.route("/", commandRoutes)
