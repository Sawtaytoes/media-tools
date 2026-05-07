export type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled" | "skipped"

export type Job = {
  commandName: string
  completedAt: Date | null
  error: string | null
  id: string
  logs: string[]
  outputFolderName: string | null
  // Named runtime outputs, populated when the job completes via the
  // command's `extractOutputs` config. Distinct from `outputFolderName`
  // (static metadata declared per command) and from `results` (the raw
  // emission stream). null while the job is in flight or when the
  // command does not declare any outputs.
  outputs: Record<string, unknown> | null
  params: unknown
  // Set on jobs created by sequenceRunner — links each step's job back
  // to the umbrella sequence job. null for top-level jobs (single-command
  // /commands/<name> calls and umbrella /sequences/run jobs themselves).
  // The Jobs UI groups by this on the client.
  parentJobId: string | null
  results: unknown[]
  startedAt: Date | null
  status: JobStatus
  // Sequence step identifier (the SequenceStep's `id` field, either
  // user-supplied or auto-assigned `step1`, `step2`, …). Only set for
  // child jobs spawned by the sequence runner; null for top-level jobs.
  // The Jobs UI shows this in the per-step row so the user can match a
  // child job to the corresponding step in the Sequence Builder.
  stepId: string | null
}

export type PromptOption = {
  index: number
  label: string
}

export type PromptEvent = {
  message: string
  options: PromptOption[]
  promptId: string
  type: "prompt"
}
