import type { LogRecord } from "./logger.js"

const RESERVED_KEYS = new Set(["level", "msg"])

const pad = (value: number, width: number): string =>
  String(value).padStart(width, "0")

const formatTimestamp = (date: Date): string =>
  `[${pad(date.getHours(), 2)}:${pad(date.getMinutes(), 2)}:${pad(
    date.getSeconds(),
    2,
  )}.${pad(date.getMilliseconds(), 3)}]`

const formatValue = (value: unknown): string => {
  if (value === null) {
    return "null"
  }
  if (typeof value === "string") {
    return /\s/.test(value) ? `"${value}"` : value
  }
  if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value)
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export const formatLogLine = (
  record: LogRecord,
  now: Date = new Date(),
): string => {
  const fields: string[] = []
  for (const [key, value] of Object.entries(record)) {
    if (RESERVED_KEYS.has(key) || value === undefined) {
      continue
    }
    fields.push(`${key}=${formatValue(value)}`)
  }
  const fieldPart =
    fields.length > 0 ? ` ${fields.join(" ")}` : ""
  return `${formatTimestamp(now)} ${record.level}${fieldPart} ${record.msg}`
}
