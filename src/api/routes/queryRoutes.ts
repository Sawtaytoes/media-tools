import { OpenAPIHono, createRoute } from "@hono/zod-openapi"
import { lastValueFrom } from "rxjs"

import { getSubtitleMetadata } from "../../app-commands/getSubtitleMetadata.js"
import { listDvdCompareReleases, findDvdCompareResults } from "../../tools/searchDvdCompare.js"
import { searchMal } from "../../tools/searchMal.js"
import { searchTvdb } from "../../tools/searchTvdb.js"
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

queryRoutes.openapi(
  createRoute({
    method: "post",
    path: "/queries/searchMal",
    summary: "Search MyAnimeList for an anime title",
    description: "Returns up to 10 anime matching the search term. Use this from the builder UI to populate the malId field.",
    tags: ["Naming Operations"],
    request: {
      body: {
        content: {
          "application/json": { schema: schemas.searchTermRequestSchema },
        },
      },
    },
    responses: {
      200: {
        description: "MAL search results",
        content: {
          "application/json": { schema: schemas.searchMalResponseSchema },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    const results = await lastValueFrom(searchMal(body.searchTerm))
    return context.json({ results }, 200)
  },
)

queryRoutes.openapi(
  createRoute({
    method: "post",
    path: "/queries/searchTvdb",
    summary: "Search TheTVDB for a series",
    description: "Returns series matching the search term. Use this from the builder UI to populate the tvdbId field.",
    tags: ["Naming Operations"],
    request: {
      body: {
        content: {
          "application/json": { schema: schemas.searchTermRequestSchema },
        },
      },
    },
    responses: {
      200: {
        description: "TVDB search results",
        content: {
          "application/json": { schema: schemas.searchTvdbResponseSchema },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    const results = await lastValueFrom(searchTvdb(body.searchTerm))
    return context.json({ results }, 200)
  },
)

queryRoutes.openapi(
  createRoute({
    method: "post",
    path: "/queries/searchDvdCompare",
    summary: "Search DVDCompare.net for a film",
    description: "Returns film entries (DVD/Blu-ray/4K variants) matching the search term. Each result includes the variant so the builder UI can group by base title.",
    tags: ["Naming Operations"],
    request: {
      body: {
        content: {
          "application/json": { schema: schemas.searchTermRequestSchema },
        },
      },
    },
    responses: {
      200: {
        description: "DVDCompare search results",
        content: {
          "application/json": { schema: schemas.searchDvdCompareResponseSchema },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    const results = await lastValueFrom(findDvdCompareResults(body.searchTerm))
    return context.json({ results }, 200)
  },
)

queryRoutes.openapi(
  createRoute({
    method: "post",
    path: "/queries/listDvdCompareReleases",
    summary: "List release packages for a DVDCompare film",
    description: "Scrapes the film page to enumerate the release packages (e.g., 'Blu-ray ALL America - Arrow Films - Limited Edition'). Each release has a hash that becomes the URL fragment.",
    tags: ["Naming Operations"],
    request: {
      body: {
        content: {
          "application/json": { schema: schemas.listDvdCompareReleasesRequestSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Release packages for the film",
        content: {
          "application/json": { schema: schemas.listDvdCompareReleasesResponseSchema },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")
    const releases = await lastValueFrom(listDvdCompareReleases(body.dvdCompareId))
    return context.json({ releases }, 200)
  },
)
