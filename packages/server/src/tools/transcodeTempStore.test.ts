import { describe, expect, test } from "vitest"

import { parseTranscodeCacheMaxBytes } from "./transcodeTempStore.js"

// Pure parser for the TRANSCODE_CACHE_MAX_BYTES env var. Worker 2c
// extracted this from the module-internal parseMaxBytes so the policy
// can be exercised without flipping process.env (which is awkward when
// transcodeTempStore captures the value at module-load).
const FOUR_GB = 4 * 1024 * 1024 * 1024

describe(parseTranscodeCacheMaxBytes.name, () => {
  test("returns 4 GiB default when raw is undefined", () => {
    expect(parseTranscodeCacheMaxBytes(undefined)).toBe(
      FOUR_GB,
    )
  })

  test("returns 4 GiB default when raw is the empty string", () => {
    expect(parseTranscodeCacheMaxBytes("")).toBe(FOUR_GB)
  })

  test("returns 4 GiB default when raw is non-numeric", () => {
    expect(parseTranscodeCacheMaxBytes("not-a-number")).toBe(
      FOUR_GB,
    )
  })

  test("returns 4 GiB default when raw is zero or negative", () => {
    expect(parseTranscodeCacheMaxBytes("0")).toBe(FOUR_GB)
    expect(parseTranscodeCacheMaxBytes("-100")).toBe(
      FOUR_GB,
    )
  })

  test("returns Number(raw) for a positive numeric string", () => {
    expect(parseTranscodeCacheMaxBytes("1000000")).toBe(
      1_000_000,
    )
  })
})
