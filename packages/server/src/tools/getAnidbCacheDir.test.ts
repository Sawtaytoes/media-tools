import { join } from "node:path"
import { describe, expect, test } from "vitest"

import { pickAnidbCacheDirInput } from "./getAnidbCacheDir.js"

// Pure picker for the ANIDB_CACHE_FOLDER env value, BEFORE node:path's
// `resolve()` (which is cwd-sensitive) is applied. Splitting the env-pick
// from the resolve lets the policy be tested without process.env tricks
// or assertions about the host CWD.
describe(pickAnidbCacheDirInput.name, () => {
  test("returns the env value unchanged when set", () => {
    expect(
      pickAnidbCacheDirInput({
        fromEnv: "/data/anidb-cache",
      }),
    ).toBe("/data/anidb-cache")
  })

  test("falls back to .cache/anidb when env is undefined", () => {
    expect(
      pickAnidbCacheDirInput({ fromEnv: undefined }),
    ).toBe(join(".cache", "anidb"))
  })

  test("returns the env value verbatim even when empty string", () => {
    // Empty string is a misconfiguration that should surface as "no
    // cache dir" downstream rather than silently coercing to default —
    // matches the previous behavior of `?? join(...)` which only
    // applies on undefined/null, not "".
    expect(pickAnidbCacheDirInput({ fromEnv: "" })).toBe("")
  })
})
