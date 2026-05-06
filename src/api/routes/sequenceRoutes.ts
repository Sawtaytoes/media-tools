import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi"
import yaml from "js-yaml"

import { createJob } from "../jobStore.js"
import { runSequenceJob, type SequenceBody } from "../sequenceRunner.js"

const sequenceStepSchema = z.object({
  id: z.string().optional()
    .describe("Stable identifier for this step. Optional on input — auto-assigned (`step1`, `step2`, ...) when omitted. Used as the target of { linkedTo, output } references from later steps."),
  command: z.string()
    .describe("Name of the registered command to run (e.g. 'keepLanguages', 'computeDefaultSubtitleRules')."),
  params: z.record(z.string(), z.unknown()).optional()
    .describe("Command params. Values may be literals, '@pathId' path-variable references, or { linkedTo, output } step-output references."),
}).openapi({
  description: "A single step inside a sequence.",
})

const sequencePathSchema = z.object({
  label: z.string().optional()
    .describe("Display label for the path variable (used by the builder UI; ignored at runtime)."),
  value: z.string()
    .describe("The actual path string this variable resolves to."),
}).openapi({
  description: "A path-variable definition. Path variables are referenced from step params via the '@pathId' string form.",
})

const parsedSequenceSchema = z.object({
  paths: z.record(z.string(), sequencePathSchema).optional()
    .describe("Top-level path-variable map keyed by path id."),
  steps: z.array(sequenceStepSchema)
    .describe("Sequence of steps to run in order. Stops on the first failure."),
}).openapi({
  description: "Pre-parsed sequence body. Use this shape if you have the sequence as JSON; otherwise post a YAML string under `yaml`.",
})

const yamlSequenceSchema = z.object({
  yaml: z.string()
    .describe("YAML source matching the same shape as the parsed body (paths + steps). Parsed server-side via js-yaml; failures return 400."),
}).openapi({
  description: "YAML-string sequence body. The server parses it and validates against the parsed-body schema.",
})

const sequenceRequestSchema = z.union([
  yamlSequenceSchema,
  parsedSequenceSchema,
])

const sequenceResponseSchema = z.object({
  jobId: z.string().describe("Umbrella job id. Subscribe to /jobs/:id/logs for the unified log stream of every step."),
  logsUrl: z.string().describe("Convenience URL for the log stream — same as `/jobs/<jobId>/logs`."),
})

export const sequenceRoutes = new OpenAPIHono()

sequenceRoutes.openapi(
  createRoute({
    method: "post",
    path: "/sequences/run",
    summary: "Run a sequence of steps as a single umbrella job.",
    description: "Accepts either a YAML string (under `yaml`) or the pre-parsed { paths, steps } shape directly. Resolves '@pathId' references and { linkedTo, output } step-output references at runtime; stops on the first failed step. The response returns immediately with a job id whose SSE log stream carries every step's output.",
    tags: ["Sequence Runner"],
    request: {
      body: {
        content: {
          "application/json": { schema: sequenceRequestSchema },
        },
      },
    },
    responses: {
      202: {
        description: "Sequence job started. Subscribe to /jobs/:id/logs for the log stream.",
        content: {
          "application/json": { schema: sequenceResponseSchema },
        },
      },
      400: {
        description: "Invalid YAML or sequence shape.",
        content: {
          "application/json": {
            schema: z.object({ error: z.string() }),
          },
        },
      },
    },
  }),
  async (context) => {
    const body = context.req.valid("json")

    let parsed: SequenceBody
    if ("yaml" in body) {
      let loaded: unknown
      try {
        loaded = yaml.load(body.yaml)
      } catch (error) {
        return context.json({ error: `Invalid YAML: ${String(error)}` }, 400)
      }
      const validation = parsedSequenceSchema.safeParse(loaded)
      if (!validation.success) {
        return context.json({ error: `YAML body did not match expected shape: ${validation.error.message}` }, 400)
      }
      parsed = validation.data
    } else {
      parsed = body
    }

    const job = createJob({
      commandName: "__sequence__",
      params: parsed,
    })

    runSequenceJob(job.id, parsed)

    return context.json({
      jobId: job.id,
      logsUrl: `/jobs/${job.id}/logs`,
    }, 202)
  },
)
