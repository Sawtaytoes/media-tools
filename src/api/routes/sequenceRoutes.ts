import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi"
import yaml from "js-yaml"

import { createJob } from "../jobStore.js"
import { runSequenceJob, type SequenceBody } from "../sequenceRunner.js"
import { commandNames } from "./commandRoutes.js"

// ─── Param value forms ──────────────────────────────────────────────────────
//
// Each step's `params` value can take one of three shapes. They're declared
// here as referenceable schemas so the OpenAPI docs surface them in the
// schema panel rather than just "unknown".

const pathReferenceSchema = z.string()
  .regex(/^@[A-Za-z0-9_-]+$/u, "Path-variable references look like '@<pathId>' (the @ followed by a key from the top-level `paths` map).")
  .openapi("PathReference", {
    description: "Reference to a path variable defined in the top-level `paths` map. The string is `@` followed by the path id (e.g. `'@workDir'`). Resolved at runtime to the path's `value`.",
    example: "@workDir",
  })

const stepOutputReferenceSchema = z.object({
  linkedTo: z.string().describe("Stable id of the source step (matches that step's `id` field — auto-assigned `step1`, `step2`, … when omitted)."),
  output: z.string().optional().describe("Which named output to consume. `'folder'` (the default) resolves to the source step's synthesized output folder — `<sourcePath>/<outputFolderName>` for most commands, `dirname(sourcePath)` for `flattenOutput`. Other values name runtime outputs the source command publishes via its `extractOutputs` projector (e.g. `'rules'` for `computeDefaultSubtitleRules`)."),
}).openapi("StepOutputReference", {
  description: "Reference to a previous step's output. Resolved at runtime against that step's runtime `outputs` map (or the synthesized folder path when `output` is omitted or `'folder'`).",
  example: { linkedTo: "filterLangs", output: "folder" },
})

// ─── Sequence document shape ────────────────────────────────────────────────

const sequenceStepSchema = z.object({
  id: z.string().optional()
    .describe("Stable identifier for this step. Optional on input — auto-assigned (`step1`, `step2`, ...) when omitted. Used as the target of `{ linkedTo, output }` references from later steps."),
  command: z.enum(commandNames)
    .describe("Name of the registered command to run. Must be one of the names listed at `GET /commands` (or surfaced individually as `POST /commands/<name>` endpoints)."),
  params: z.record(z.string(), z.unknown()).optional()
    .describe("Command params. Each value can be a literal (string / number / boolean / array / object), a `'@pathId'` path-variable reference, or a `{ linkedTo, output }` step-output reference. Per-command param shapes are documented under `POST /commands/<command>` — the same schema each command exposes for direct invocation also applies here once references are resolved."),
}).openapi("SequenceStep", {
  description: "A single step inside a sequence.",
  example: {
    id: "filterLangs",
    command: "keepLanguages",
    params: {
      sourcePath: "@workDir",
      audioLanguages: ["jpn"],
      subtitlesLanguages: ["eng"],
    },
  },
})

const sequencePathSchema = z.object({
  label: z.string().optional()
    .describe("Display label for the path variable (used by the builder UI; ignored at runtime)."),
  value: z.string()
    .describe("The actual path string this variable resolves to."),
}).openapi("SequencePath", {
  description: "A path-variable definition. Path variables are referenced from step params via the `'@pathId'` string form.",
  example: { label: "Work Directory", value: "D:\\Anime\\Show\\__work" },
})

const parsedSequenceSchema = z.object({
  paths: z.record(z.string(), sequencePathSchema).optional()
    .describe("Top-level path-variable map keyed by path id. Each entry is referenced from step params via `'@<pathId>'`."),
  steps: z.array(sequenceStepSchema)
    .describe("Sequence of steps to run in order. Stops on the first failure; remaining steps don't run."),
}).openapi("ParsedSequenceBody", {
  description: "Pre-parsed sequence body. Use this shape if you have the sequence as JSON; otherwise post a YAML string under `yaml` (the server parses with js-yaml and validates against this same schema).",
  example: {
    paths: {
      workDir: { label: "Work Directory", value: "D:\\Anime\\Show\\__work" },
      parentDir: { label: "Parent Series Folder", value: "D:\\Anime\\Show" },
    },
    steps: [
      {
        id: "filterLangs",
        command: "keepLanguages",
        params: {
          sourcePath: "@workDir",
          audioLanguages: ["jpn"],
          subtitlesLanguages: ["eng"],
        },
      },
      {
        id: "copyBack",
        command: "copyFiles",
        params: {
          sourcePath: { linkedTo: "filterLangs", output: "folder" },
          destinationPath: "@workDir",
        },
      },
      {
        id: "computeRules",
        command: "computeDefaultSubtitleRules",
        params: { sourcePath: "@workDir" },
      },
      {
        id: "applyRules",
        command: "modifySubtitleMetadata",
        params: {
          sourcePath: "@workDir",
          rules: { linkedTo: "computeRules", output: "rules" },
        },
      },
    ],
  },
})

const yamlSequenceSchema = z.object({
  yaml: z.string()
    .describe("YAML source. The server parses with js-yaml and validates against the same schema as the parsed-JSON body — see the `ParsedSequenceBody` schema for the document shape. Parse failures and shape-mismatch validation errors return 400 with a descriptive message."),
}).openapi("YamlSequenceBody", {
  description: "YAML-string sequence body. The yaml field carries the raw text the builder UI's `View YAML` modal shows.",
  example: {
    yaml: [
      "paths:",
      "  workDir:",
      "    label: Work Directory",
      "    value: 'D:\\Anime\\Show\\__work'",
      "steps:",
      "  - id: filterLangs",
      "    command: keepLanguages",
      "    params:",
      "      sourcePath: '@workDir'",
      "      audioLanguages: [jpn]",
      "      subtitlesLanguages: [eng]",
      "  - id: copyBack",
      "    command: copyFiles",
      "    params:",
      "      sourcePath:",
      "        linkedTo: filterLangs",
      "        output: folder",
      "      destinationPath: '@workDir'",
    ].join("\n"),
  },
})

const sequenceRequestSchema = z.union([
  yamlSequenceSchema,
  parsedSequenceSchema,
])

const sequenceResponseSchema = z.object({
  jobId: z.string().describe("Umbrella job id. Subscribe to `GET /jobs/<jobId>/logs` (SSE) for the unified log stream of every step, or poll `GET /jobs/<jobId>` for status."),
  logsUrl: z.string().describe("Convenience URL for the SSE log stream — same as `/jobs/<jobId>/logs`."),
}).openapi("SequenceJobAccepted", {
  example: {
    jobId: "9d2f8c3e-4a1b-4c2d-9e7f-8a3b2c1d5e7f",
    logsUrl: "/jobs/9d2f8c3e-4a1b-4c2d-9e7f-8a3b2c1d5e7f/logs",
  },
})

// Reference the link-form schemas so OpenAPI surfaces them under
// "Schemas" in the generated docs — without an explicit reference,
// orphan zod-openapi types don't end up in components/schemas.
const _linkFormSchemaRefs = z.object({
  pathReference: pathReferenceSchema,
  stepOutputReference: stepOutputReferenceSchema,
}).optional()

// ─── Route ──────────────────────────────────────────────────────────────────

const ROUTE_DESCRIPTION = `
Run a list of commands in order under a single umbrella job. Used whenever you'd otherwise script multiple \`POST /commands/<name>\` calls in sequence — one job id, one SSE log stream, automatic teardown on first failure.

**Body shapes** (the route accepts either):

- \`{ "yaml": "<yaml string>" }\` — the same YAML the builder UI's *View YAML* modal shows. Parsed server-side.
- \`{ "paths": {...}, "steps": [...] }\` — pre-parsed JSON in the same document shape (\`ParsedSequenceBody\`).

**Param value forms.** Inside any \`steps[].params\` value, three shapes are recognized:

1. **Literal** — string, number, boolean, array, object. Passed through unchanged.
2. **\`'@pathId'\`** — string starting with \`@\`, names a key from the top-level \`paths\` map. Resolved to that path's \`value\` at runtime.
3. **\`{ linkedTo, output }\`** — references a previous step's output. \`output: 'folder'\` (or omitted) resolves to that step's synthesized output folder; any other value names a runtime output the source command publishes via its \`extractOutputs\` projector (e.g. \`computeDefaultSubtitleRules\` → \`'rules'\`).

**Resolution rules.** A step can only reference steps earlier in the array. References to a missing path/step/output fail the umbrella job with a clear error in the SSE log stream. Empty arrays / nullish values pass through; commands that should be conditional implement an empty-input no-op themselves (no \`if:\` predicate exists in the YAML).

**Per-command param schemas.** The shape of \`params\` for a given command matches the request body of \`POST /commands/<command>\` once any \`'@pathId'\` / \`{ linkedTo, output }\` references are resolved. Look up the per-command endpoint to see the exact required/optional fields and their types.

The full reference, including a worked anime-subtitle pipeline example, lives in [README.md](README.md) under "Sequence Runner — multi-step pipelines as YAML".
`.trim()

export const sequenceRoutes = new OpenAPIHono()

sequenceRoutes.openapi(
  createRoute({
    method: "post",
    path: "/sequences/run",
    summary: "Run a sequence of steps as a single umbrella job.",
    description: ROUTE_DESCRIPTION,
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
        description: "Sequence job started. Subscribe to `/jobs/:id/logs` for the log stream.",
        content: {
          "application/json": { schema: sequenceResponseSchema },
        },
      },
      400: {
        description: "Body did not match either accepted shape, or YAML failed to parse / validate.",
        content: {
          "application/json": {
            schema: z.object({
              error: z.string().describe("Human-readable description of what went wrong."),
            }).openapi({ example: { error: "Invalid YAML: YAMLException: …" } }),
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
