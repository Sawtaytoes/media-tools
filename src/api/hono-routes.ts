import { serveStatic } from "@hono/node-server/serve-static"
import { OpenAPIHono } from "@hono/zod-openapi"

import { commandRoutes } from "./routes/commandRoutes.js"
import { addDocRoutes } from "./routes/docRoutes.js"
import { jobRoutes } from "./routes/jobRoutes.js"
import { logsRoutes } from "./routes/logRoutes.js"
import { queryRoutes } from "./routes/queryRoutes.js"

export const app = new OpenAPIHono()

app.use("/*", serveStatic({ root: "./public/api" }))

app.route("/", jobRoutes)
app.route("/", logsRoutes)
app.route("/", commandRoutes)
app.route("/", queryRoutes)

addDocRoutes(app)
