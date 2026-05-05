# AGENTS.md

Guidelines for AI agents working on this codebase.

## Project

A Node.js CLI and REST API for batch media file operations (MKV track manipulation,
file renaming, subtitle merging, etc.) using mkvtoolnix, ffmpeg, and mediainfo.

## Key conventions

### Observable-first
Every command module returns an `Observable`. Errors are handled via `catchNamedError`
(which logs via `console.error` and returns `EMPTY` — they do not surface as observable
errors to the subscriber).

### Pure functions / no direct mutation
State updates must go through store functions that return new objects (spread-based).
Do not mutate object properties directly (e.g. `job.status = "x"` is wrong;
use `updateJob(id, { status: "x" })` instead).

### No `process.exit()` in modules
`process.exit()` belongs only in `src/cli.ts` handlers. Any `tap(() => process.exit())`
in module files must be removed before those modules can be used in the API.

### Variable naming
- No single-letter variable names. Always use descriptive names that convey purpose.
- Hono route handler context: use `context` (not `c`). Example: `app.get("/", (context) => context.json({}))`.
- Spell out all abbreviations in variable names (e.g. `destination` not `dest`, `source` not `src`, `options` not `opts`).

### Coding style
- Functional style; prefer `concatMap` / `mergeMap` over imperative loops
- For iterating arrays, use functional methods (`forEach`, `map`, `filter`, `reduce`, etc.) instead of `for...of` loops
- Imports sorted alphabetically within each group
- Observable pipelines broken across lines (see existing modules for reference)

## Testing

- Framework: vitest
- `node:fs` and `node:fs/promises` are globally mocked with `memfs` (see `vitest.setup.ts`)
- Tests live next to their source file: `foo.ts` → `foo.test.ts`
- Use `captureConsoleMessage` / `captureLogMessage` helpers to silence and inspect console output
- Use `vol.fromJSON(...)` from memfs to seed the virtual filesystem

## API (`src/api/`)

Split into focused modules:

| File | Responsibility |
|------|---------------|
| `types.ts` | `Job` and `JobStatus` types |
| `jobStore.ts` | In-memory job state — all updates via exported functions |
| `logCapture.ts` | `AsyncLocalStorage`-based console routing; call `installLogCapture()` once at startup |
| `jobRunner.ts` | `runJob(jobId, observable)` — sets status, wires SSE subject |
| `routes/jobs.ts` | `GET /jobs`, `GET /jobs/:id` |
| `routes/logs.ts` | `GET /jobs/:id/logs` (SSE) |
| `routes/commands.ts` | `POST /jobs/<command>` endpoints |
| `index.ts` | Assembles the Hono app (no `serve()` call) |

`src/api.ts` is the entry point: imports the assembled app from `src/api/index.ts`
and calls `serve()`.

## Adding a new command

1. Create `src/<commandName>.ts` returning `Observable<unknown>`
2. Create `src/cli-commands/<commandName>.ts` using the `CommandModule` pattern (see below)
3. Import and `.command(...)` the module in `src/cli.ts`
4. Add a `app.post("/jobs/<commandName>", ...)` handler to `src/api/routes/commands.ts`

## CLI command modules (`src/cli-commands/`)

Each yargs command lives in its own file. The pattern uses `InferArgvOptions<T>` to
extract the plain options type from the builder, avoiding the `[key: string]: unknown`
index signature that `Awaited<ReturnType<typeof builder>>["argv"]` would produce:

```typescript
import type { Argv, CommandBuilder, CommandModule } from "yargs"
import { someCommand } from "../someCommand.js"

type InferArgvOptions<T> = T extends Argv<infer U> ? U : never

const builder = (yargs: Argv) => (
  yargs
  .positional("sourcePath", { demandOption: true, type: "string", describe: "..." })
  .option("isRecursive", { alias: "r", boolean: true, default: false, nargs: 0, type: "boolean", describe: "..." })
)

type Args = InferArgvOptions<ReturnType<typeof builder>>

export const someCommandCommand: CommandModule<{}, Args> = {
  command: "someCommand <sourcePath>",
  describe: "...",
  builder: builder as CommandBuilder<{}, Args>,
  handler: (argv) => {
    someCommand({ isRecursive: argv.isRecursive, sourcePath: argv.sourcePath })
    .subscribe(() => { console.timeEnd("Command Runtime") })
  },
}
```

In `cli.ts`, register it with `.command(someCommandCommand)`.
