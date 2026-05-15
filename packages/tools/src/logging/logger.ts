import { getLoggingContext } from "./context.js"

export type LogLevel = "debug" | "info" | "warn" | "error"

export type LogRecord = {
  level: LogLevel
  msg: string
  jobId?: string
  stepIndex?: number
  fileId?: string
  traceId?: string
  spanId?: string
  [extraKey: string]: unknown
}

export type LogSink = (record: LogRecord) => void

export type Logger = {
  debug: (msg: string, extra?: Record<string, unknown>) => void
  info: (msg: string, extra?: Record<string, unknown>) => void
  warn: (msg: string, extra?: Record<string, unknown>) => void
  error: (msg: string, extra?: Record<string, unknown>) => void
  child: (bindings: Record<string, unknown>) => Logger
  startSpan: <T>(name: string, fn: () => Promise<T> | T) => Promise<T>
}

const sinks: Set<LogSink> = new Set()

export const registerLogSink = (sink: LogSink): (() => void) => {
  sinks.add(sink)
  return () => {
    sinks.delete(sink)
  }
}

export const __resetLogSinksForTests = (): void => {
  sinks.clear()
}

const emit = (record: LogRecord): void => {
  for (const sink of sinks) {
    sink(record)
  }
}

// Lazily bound by ./startSpan.ts to avoid a module cycle.
let startSpanImpl: <T>(
  logger: Logger,
  name: string,
  fn: () => Promise<T> | T,
) => Promise<T> = async () => {
  throw new Error(
    "startSpan implementation has not been registered. " +
      "Import './startSpan.js' to register it.",
  )
}

export const __registerStartSpanImpl = (
  impl: typeof startSpanImpl,
): void => {
  startSpanImpl = impl
}

const buildRecord = (
  bindings: Record<string, unknown>,
  level: LogLevel,
  msg: string,
  extra: Record<string, unknown> | undefined,
): LogRecord => ({
  ...getLoggingContext(),
  ...bindings,
  ...extra,
  level,
  msg,
})

const createLogger = (
  bindings: Record<string, unknown>,
): Logger => {
  const logger: Logger = {
    debug: (msg, extra) =>
      emit(buildRecord(bindings, "debug", msg, extra)),
    info: (msg, extra) =>
      emit(buildRecord(bindings, "info", msg, extra)),
    warn: (msg, extra) =>
      emit(buildRecord(bindings, "warn", msg, extra)),
    error: (msg, extra) =>
      emit(buildRecord(bindings, "error", msg, extra)),
    child: (childBindings) =>
      createLogger({ ...bindings, ...childBindings }),
    startSpan: (name, fn) => startSpanImpl(logger, name, fn),
  }
  return logger
}

export const getLogger = (): Logger => createLogger({})
