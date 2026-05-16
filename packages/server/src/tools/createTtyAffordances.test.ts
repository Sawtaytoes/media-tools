import { describe, expect, test } from "vitest"

import { shouldUseTtyAffordances } from "./createTtyAffordances.js"

// Pure gating rule for the TTY-affordance attach logic. The wrapper
// reads process.stdin.isTTY + the active-job AsyncLocalStorage; this
// pure helper accepts pre-resolved booleans so the rule is testable in
// isolation. Worker 2c.
describe(shouldUseTtyAffordances.name, () => {
  test("returns true only when NOT in API context AND stdin is a TTY", () => {
    expect(
      shouldUseTtyAffordances({
        isInApiContext: false,
        isStdinTty: true,
      }),
    ).toBe(true)
  })

  test("returns false when in API context regardless of TTY status", () => {
    expect(
      shouldUseTtyAffordances({
        isInApiContext: true,
        isStdinTty: true,
      }),
    ).toBe(false)
    expect(
      shouldUseTtyAffordances({
        isInApiContext: true,
        isStdinTty: false,
      }),
    ).toBe(false)
  })

  test("returns false when stdin is not a TTY (piped / non-interactive)", () => {
    expect(
      shouldUseTtyAffordances({
        isInApiContext: false,
        isStdinTty: false,
      }),
    ).toBe(false)
  })
})
