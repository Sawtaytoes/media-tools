import { serve } from "@hono/node-server"

import { app } from "./api/hono-routes.js"
import { installLogCapture } from "./api/logCapture.js"
import { logInfo } from "./tools/logMessage.js"
import { PORT } from "./tools/port.js"

installLogCapture()

serve(
  {
    fetch: app.fetch,
    port: PORT,
  },
  () => {
    logInfo(
      "API SERVER LISTENING PORT",
      PORT,
    )
  },
)
