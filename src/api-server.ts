import { serve } from "@hono/node-server"

import { app } from "./api/index.js"
import { installLogCapture } from "./api/logCapture.js"
import { logInfo } from "./logMessage.js"

installLogCapture()

const PORT = Number(process.env.PORT ?? 3000)

serve(
  {
    fetch: app.fetch,
    port: PORT,
  },
  () => {
    logInfo(
      "API Server listening on port:",
      PORT,
    )
  },
)
