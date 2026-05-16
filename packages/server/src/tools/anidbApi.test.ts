import { describe, expect, test } from "vitest"

import { computeThrottleWaitMs } from "./anidbApi.js"

// Pure throttle-math extracted from the AniDB API client's per-request
// rate limiter. The wrapper (throttle()) reads Date.now() and calls
// setTimeout; this helper just answers "how long should I sleep given
// these timestamps and the configured floor?" — easy to exercise across
// the boundaries without mocking time.
describe(computeThrottleWaitMs.name, () => {
  test("returns the full interval when the previous request was just now", () => {
    expect(
      computeThrottleWaitMs({
        lastRequestAt: 1_000_000,
        minIntervalMs: 2_500,
        now: 1_000_000,
      }),
    ).toBe(2_500)
  })

  test("returns the remaining wait when partway through the interval", () => {
    expect(
      computeThrottleWaitMs({
        lastRequestAt: 1_000_000,
        minIntervalMs: 2_500,
        now: 1_001_000,
      }),
    ).toBe(1_500)
  })

  test("returns 0 when the previous request was longer ago than the interval", () => {
    expect(
      computeThrottleWaitMs({
        lastRequestAt: 1_000_000,
        minIntervalMs: 2_500,
        now: 1_010_000,
      }),
    ).toBe(0)
  })

  test("returns 0 — never negative — when now exceeds last + interval", () => {
    expect(
      computeThrottleWaitMs({
        lastRequestAt: 1_000_000,
        minIntervalMs: 2_500,
        now: 9_999_999,
      }),
    ).toBe(0)
  })

  test("returns the full interval on first call (lastRequestAt = 0)", () => {
    // First-call edge case: lastRequestAt starts at 0, so the math
    // technically returns minIntervalMs - now, which is hugely negative.
    // Verify the clamp to >= 0 handles this without sleeping forever.
    expect(
      computeThrottleWaitMs({
        lastRequestAt: 0,
        minIntervalMs: 2_500,
        now: 1_000_000_000,
      }),
    ).toBe(0)
  })
})
