import { vol } from "memfs"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest"

import {
  deleteFiles,
  getDeleteMode,
  parseDeleteMode,
  pickEffectiveDeleteMode,
} from "./deleteFiles.js"

// Mock the `trash` package so trash-mode tests don't shell out to
// Shell.Application / gio trash. The mock records calls so tests can
// assert which paths went through trash vs unlink, and removes the
// file from memfs so callers see consistent state after delete.
const trashCalls: string[][] = []
vi.mock("trash", () => ({
  default: vi.fn((paths: string[]) => {
    trashCalls.push([...paths])
    paths.forEach((path) => {
      try {
        vol.unlinkSync(path)
      } catch {
        /* already gone */
      }
    })
    return Promise.resolve()
  }),
}))

describe(getDeleteMode.name, () => {
  let original: string | undefined
  beforeEach(() => {
    original = process.env.DELETE_TO_TRASH
  })
  afterEach(() => {
    if (original === undefined)
      delete process.env.DELETE_TO_TRASH
    else process.env.DELETE_TO_TRASH = original
  })

  test("defaults to 'trash' when env is unset", () => {
    delete process.env.DELETE_TO_TRASH
    expect(getDeleteMode()).toBe("trash")
  })

  test("'permanent' when DELETE_TO_TRASH=false", () => {
    process.env.DELETE_TO_TRASH = "false"
    expect(getDeleteMode()).toBe("permanent")
  })

  test("'permanent' when DELETE_TO_TRASH=0", () => {
    process.env.DELETE_TO_TRASH = "0"
    expect(getDeleteMode()).toBe("permanent")
  })

  test("'trash' when DELETE_TO_TRASH=true", () => {
    process.env.DELETE_TO_TRASH = "true"
    expect(getDeleteMode()).toBe("trash")
  })
})

// Pure cores extracted for worker 2c: parseDeleteMode classifies the raw
// env-var string with no environment access of its own, and
// pickEffectiveDeleteMode applies the network-share downgrade rule given
// pre-resolved booleans.

describe(parseDeleteMode.name, () => {
  test("defaults to 'trash' on undefined", () => {
    expect(parseDeleteMode(undefined)).toBe("trash")
  })

  test("'permanent' on 'false' (any case, surrounding whitespace)", () => {
    expect(parseDeleteMode("false")).toBe("permanent")
    expect(parseDeleteMode("FALSE")).toBe("permanent")
    expect(parseDeleteMode("  false  ")).toBe("permanent")
  })

  test("'permanent' on '0'", () => {
    expect(parseDeleteMode("0")).toBe("permanent")
  })

  test("'permanent' on 'no'", () => {
    expect(parseDeleteMode("no")).toBe("permanent")
  })

  test("'trash' on 'true' or any other non-opt-out value", () => {
    expect(parseDeleteMode("true")).toBe("trash")
    expect(parseDeleteMode("anything-else")).toBe("trash")
    expect(parseDeleteMode("")).toBe("trash")
  })
})

describe(pickEffectiveDeleteMode.name, () => {
  test("'permanent' passes through unchanged regardless of network status", () => {
    expect(
      pickEffectiveDeleteMode({
        baseMode: "permanent",
        isNetwork: false,
      }),
    ).toBe("permanent")
    expect(
      pickEffectiveDeleteMode({
        baseMode: "permanent",
        isNetwork: true,
      }),
    ).toBe("permanent")
  })

  test("'trash' downgrades to 'permanent' for network paths", () => {
    expect(
      pickEffectiveDeleteMode({
        baseMode: "trash",
        isNetwork: true,
      }),
    ).toBe("permanent")
  })

  test("'trash' stays 'trash' for local paths", () => {
    expect(
      pickEffectiveDeleteMode({
        baseMode: "trash",
        isNetwork: false,
      }),
    ).toBe("trash")
  })
})

describe(deleteFiles.name, () => {
  beforeEach(() => {
    trashCalls.length = 0
    vol.fromJSON({
      "/disc-rips/SOLDIER/a.mkv": "a",
      "/disc-rips/SOLDIER/b.mkv": "b",
    })
  })

  afterEach(() => {
    delete process.env.DELETE_TO_TRASH
  })

  test("trash mode routes through the trash package and reports per-path success", async () => {
    process.env.DELETE_TO_TRASH = "true"
    const { results } = await deleteFiles([
      "/disc-rips/SOLDIER/a.mkv",
      "/disc-rips/SOLDIER/b.mkv",
    ])
    expect(results.every((res) => res.isOk)).toBe(true)
    // network-drive detection is no-op on non-Windows runners; on
    // Windows it consults a cached PowerShell call, which won't include
    // the memfs G: drive (it's a fake), so the call falls through to
    // trash mode either way.
    expect(
      results.every(
        (res) =>
          res.mode === "trash" || res.mode === "permanent",
      ),
    ).toBe(true)
  })

  test("permanent mode uses fs.unlink and removes the file from disk", async () => {
    process.env.DELETE_TO_TRASH = "false"
    const { results } = await deleteFiles([
      "/disc-rips/SOLDIER/a.mkv",
    ])
    expect(results[0].isOk).toBe(true)
    expect(results[0].mode).toBe("permanent")
    expect(trashCalls).toHaveLength(0)
    expect(() =>
      vol.statSync("/disc-rips/SOLDIER/a.mkv"),
    ).toThrow()
  })

  test("rejects relative paths without aborting the batch", async () => {
    process.env.DELETE_TO_TRASH = "false"
    const { results } = await deleteFiles([
      "/disc-rips/SOLDIER/a.mkv", // valid
      "relative/path.mkv", // relative — rejected
    ])
    expect(results[0].isOk).toBe(true)
    expect(results[1].isOk).toBe(false)
    expect(results[1].error).toMatch(/must be absolute/)
  })
})
