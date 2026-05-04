import { serve } from "@hono/node-server"

import { app } from "./api/index.js"
import { installLogCapture, originalConsole } from "./api/logCapture.js"

installLogCapture()

const PORT = Number(process.env.PORT ?? 3000)

serve(
  {
    fetch: app.fetch,
    port: PORT,
  },
  () => {
    originalConsole.log(`Media tools API listening on :${PORT}`)
  },
)
