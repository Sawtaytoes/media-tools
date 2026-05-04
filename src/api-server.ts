import { serve } from "@hono/node-server"

import { app } from "./api/hono-routes.js"
import { installLogCapture } from "./api/logCapture.js"
import { logInfo } from "./logMessage.js"
import { PORT } from "./port.js"

installLogCapture()

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
