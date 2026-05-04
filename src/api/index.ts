import { Hono } from "hono"

import { commandRoutes } from "./routes/commands.js"
import { jobRoutes } from "./routes/jobs.js"
import { logsRoutes } from "./routes/logs.js"

export const app = new Hono()

app.route("/", jobRoutes)
app.route("/", logsRoutes)
app.route("/", commandRoutes)
