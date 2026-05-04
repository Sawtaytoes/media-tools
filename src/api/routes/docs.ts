import { OpenAPIHono } from "@hono/zod-openapi"
import { Scalar } from "@scalar/hono-api-reference"
import { createMarkdownFromOpenApi } from "@scalar/openapi-to-markdown"

import { PORT } from "../../port.js"

export const docRoutes = new OpenAPIHono()

docRoutes.get("/docs", Scalar({ url: "/openapi.json" }))

docRoutes.doc("/openapi.json", {
  openapi: "3.0.0",
  info: {
    title: "Media Tools API",
    version: "1.0.0",
    description: "API for media file processing and analysis",
  },
  servers: [
    (
      process.env.REMOTE_SERVER_DOMAIN
      ? {
        url: `${process.env.REMOTE_SERVER_DOMAIN}:${PORT}`,
        description: "Remote API server",
      }
      : {
        url: `http://localhost:${PORT}`,
        description: "Local API server",
      }
    ),
  ],
})

const content = docRoutes.getOpenAPI31Document({
  openapi: "3.1.0",
  info: { title: "Example", version: "v1" },
})

const markdown = await createMarkdownFromOpenApi(
  JSON.stringify(content)
)

docRoutes.get("/llms.txt", async (context) => {
  return context.text(markdown)
})
