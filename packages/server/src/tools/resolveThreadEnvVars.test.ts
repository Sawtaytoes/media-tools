import { cpus } from "node:os"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest"

import {
  pickDefaultThreadCount,
  pickMaxThreads,
  resolveDefaultThreadCount,
  resolveMaxThreads,
} from "./resolveThreadEnvVars.js"

// Pure cores. The wrappers above read process.env + cpus() and delegate
// to these. Decoupling lets us test the policy without env-var games.
describe(pickMaxThreads.name, () => {
  test("returns Number(raw) for a positive integer string", () => {
    expect(
      pickMaxThreads({ cpuCount: 16, raw: "6" }),
    ).toBe(6)
  })

  test("falls back to cpuCount when raw is undefined", () => {
    expect(
      pickMaxThreads({ cpuCount: 16, raw: undefined }),
    ).toBe(16)
  })

  test("falls back to cpuCount when raw is '0'", () => {
    expect(
      pickMaxThreads({ cpuCount: 16, raw: "0" }),
    ).toBe(16)
  })

  test("falls back to cpuCount when raw is non-numeric", () => {
    expect(
      pickMaxThreads({ cpuCount: 16, raw: "abc" }),
    ).toBe(16)
  })
})

describe(pickDefaultThreadCount.name, () => {
  test("defaults to 2 when raw is undefined", () => {
    expect(
      pickDefaultThreadCount({
        maxThreads: 8,
        raw: undefined,
      }),
    ).toBe(2)
  })

  test("clamps to maxThreads when raw exceeds maxThreads", () => {
    expect(
      pickDefaultThreadCount({
        maxThreads: 4,
        raw: "16",
      }),
    ).toBe(4)
  })

  test("returns maxThreads when raw is '0'", () => {
    expect(
      pickDefaultThreadCount({
        maxThreads: 8,
        raw: "0",
      }),
    ).toBe(8)
  })

  test("returns maxThreads when raw is negative", () => {
    expect(
      pickDefaultThreadCount({
        maxThreads: 8,
        raw: "-3",
      }),
    ).toBe(8)
  })

  test("returns raw when raw is positive and within maxThreads", () => {
    expect(
      pickDefaultThreadCount({
        maxThreads: 8,
        raw: "4",
      }),
    ).toBe(4)
  })
})

// Snapshot env vars before each test and restore after, so tests
// are fully isolated from the real environment.
let savedMaxThreads: string | undefined
let savedDefaultThreadCount: string | undefined

beforeEach(() => {
  savedMaxThreads = process.env.MAX_THREADS
  savedDefaultThreadCount = process.env.DEFAULT_THREAD_COUNT
  delete process.env.MAX_THREADS
  delete process.env.DEFAULT_THREAD_COUNT
})

afterEach(() => {
  if (savedMaxThreads === undefined) {
    delete process.env.MAX_THREADS
  } else {
    process.env.MAX_THREADS = savedMaxThreads
  }
  if (savedDefaultThreadCount === undefined) {
    delete process.env.DEFAULT_THREAD_COUNT
  } else {
    process.env.DEFAULT_THREAD_COUNT =
      savedDefaultThreadCount
  }
})

describe("resolveMaxThreads", () => {
  test("returns Number(MAX_THREADS) when set to a positive integer", () => {
    process.env.MAX_THREADS = "6"
    expect(resolveMaxThreads()).toBe(6)
  })

  test("falls back to os.cpus().length when MAX_THREADS is unset", () => {
    expect(resolveMaxThreads()).toBe(cpus().length)
  })

  test("falls back to os.cpus().length when MAX_THREADS is 0", () => {
    process.env.MAX_THREADS = "0"
    expect(resolveMaxThreads()).toBe(cpus().length)
  })
})

describe("resolveDefaultThreadCount", () => {
  test("returns 2 when DEFAULT_THREAD_COUNT is unset", () => {
    process.env.MAX_THREADS = "8"
    expect(resolveDefaultThreadCount()).toBe(2)
  })

  test("returns min(raw, maxThreads) for a normal positive value", () => {
    process.env.MAX_THREADS = "8"
    process.env.DEFAULT_THREAD_COUNT = "4"
    expect(resolveDefaultThreadCount()).toBe(4)
  })

  test("clamps to maxThreads when DEFAULT_THREAD_COUNT exceeds MAX_THREADS", () => {
    process.env.MAX_THREADS = "4"
    process.env.DEFAULT_THREAD_COUNT = "16"
    expect(resolveDefaultThreadCount()).toBe(4)
  })

  test("returns resolveMaxThreads() when DEFAULT_THREAD_COUNT is 0", () => {
    process.env.MAX_THREADS = "8"
    process.env.DEFAULT_THREAD_COUNT = "0"
    expect(resolveDefaultThreadCount()).toBe(8)
  })

  test("returns resolveMaxThreads() when DEFAULT_THREAD_COUNT is negative", () => {
    process.env.MAX_THREADS = "8"
    process.env.DEFAULT_THREAD_COUNT = "-1"
    expect(resolveDefaultThreadCount()).toBe(8)
  })
})
