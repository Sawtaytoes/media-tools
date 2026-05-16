import { cpus } from "node:os"

// Pure policy: parse the raw MAX_THREADS env value, falling back to the
// host CPU count when the value is missing, zero, or non-numeric.
export const pickMaxThreads = ({
  cpuCount,
  raw,
}: {
  cpuCount: number
  raw: string | undefined
}): number => Number(raw) || cpuCount

// Pure policy: clamp the raw DEFAULT_THREAD_COUNT into [1, maxThreads],
// defaulting to 2 on missing input and returning maxThreads when raw is
// 0 or negative (matches the historical "0 means use the cap" behavior).
export const pickDefaultThreadCount = ({
  maxThreads,
  raw,
}: {
  maxThreads: number
  raw: string | undefined
}): number => {
  const parsed = Number(raw ?? 2)
  if (parsed <= 0) return maxThreads
  return Math.min(parsed, maxThreads)
}

export const resolveMaxThreads = (): number =>
  pickMaxThreads({
    cpuCount: cpus().length,
    raw: process.env.MAX_THREADS,
  })

export const resolveDefaultThreadCount = (): number =>
  pickDefaultThreadCount({
    maxThreads: resolveMaxThreads(),
    raw: process.env.DEFAULT_THREAD_COUNT,
  })
