import { serve } from "@hono/node-server"

import { hono } from "./api/hono-routes.js"
import { installLogCapture } from "./api/logCapture.js"
import { logInfo } from "./logMessage.js"

installLogCapture()

const PORT = Number(process.env.PORT ?? 3000)

serve(
  {
    fetch: hono.fetch,
    port: PORT,
  },
  () => {
    logInfo(
      "API Server listening on port:",
      PORT,
    )
  },
)
