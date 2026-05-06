export type JobStatus = "pending" | "running" | "completed" | "failed"

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
  results: unknown[]
  startedAt: Date | null
  status: JobStatus
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
