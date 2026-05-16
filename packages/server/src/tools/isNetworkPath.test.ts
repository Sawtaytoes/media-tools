import { describe, expect, test } from "vitest"

import { classifyNetworkPath } from "./isNetworkPath.js"

// Pure core for the network-path detector. `isNetworkPath` (the wrapper)
// is platform-gated and reads a PowerShell-enumerated cache; this pure
// function takes those inputs explicitly so the classification logic can
// be exercised on any OS without spawning anything.
describe(classifyNetworkPath.name, () => {
  test("returns false on non-Windows regardless of UNC prefix", () => {
    expect(
      classifyNetworkPath({
        filePath: "\\\\server\\share\\foo",
        isWindows: false,
        networkDriveLetters: new Set(["G:"]),
      }),
    ).toBe(false)
  })

  test("returns true on Windows for any \\\\-prefixed UNC path", () => {
    expect(
      classifyNetworkPath({
        filePath: "\\\\server\\share\\movie.mkv",
        isWindows: true,
        networkDriveLetters: new Set(),
      }),
    ).toBe(true)
  })

  test("returns true on Windows when the root drive is in the network-drive set", () => {
    expect(
      classifyNetworkPath({
        filePath: "G:\\media\\movie.mkv",
        isWindows: true,
        networkDriveLetters: new Set(["G:"]),
      }),
    ).toBe(true)
  })

  test("returns false on Windows when the root drive is not a network drive", () => {
    expect(
      classifyNetworkPath({
        filePath: "C:\\Users\\me\\movie.mkv",
        isWindows: true,
        networkDriveLetters: new Set(["G:"]),
      }),
    ).toBe(false)
  })

  test("compares drive letters case-insensitively (normalizes to upper-case)", () => {
    expect(
      classifyNetworkPath({
        filePath: "g:\\media\\movie.mkv",
        isWindows: true,
        networkDriveLetters: new Set(["G:"]),
      }),
    ).toBe(true)
  })

  test("returns false on Windows for a relative path with no drive root", () => {
    expect(
      classifyNetworkPath({
        filePath: "media\\movie.mkv",
        isWindows: true,
        networkDriveLetters: new Set(["G:"]),
      }),
    ).toBe(false)
  })
})
