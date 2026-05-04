export type JobStatus = "pending" | "running" | "completed" | "failed"

export type Job = {
  command: string
  completedAt: Date | null
  error: string | null
  id: string
  logs: string[]
  params: unknown
  results: unknown[]
  startedAt: Date | null
  status: JobStatus
}
