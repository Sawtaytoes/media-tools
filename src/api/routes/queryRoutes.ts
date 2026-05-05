import { OpenAPIHono, createRoute } from "@hono/zod-openapi"
import { lastValueFrom } from "rxjs"

import { getSubtitleMetadata } from "../../app-commands/getSubtitleMetadata.js"
import * as schemas from "../schemas.js"

export const queryRoutes = new OpenAPIHono()

queryRoutes.openapi(
  createRoute({
    method: "post",
    path: "/queries/getSubtitleMetadata",
    summary: "Read .ass subtitle file metadata without making any changes",
    description: "Parses every .ass file in the given directory and returns their [Script Info] properties and [V4+ Styles] entries as JSON. Use this to inspect files before deciding which DSL rules to send to POST /commands/modifySubtitleMetadata.",
    tags: ["Subtitle Operations"],
    request: {
      body: {
        content: {
          "application/json": { schema: schemas.getSubtitleMetadataRequestSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Script Info and style metadata for each .ass file found",
        content: {
          "application/json": {
            schema: schemas.getSubtitleMetadataResponseSchema,
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    const subtitlesMetadata = await lastValueFrom(
      getSubtitleMetadata({
        isRecursive: body.isRecursive,
        recursiveDepth: body.recursiveDepth,
        sourcePath: body.sourcePath,
      })
    )
    return context.json({ subtitlesMetadata }, 200)
  },
)
