import { readFile } from "node:fs/promises"
import { vol } from "memfs"
import { firstValueFrom, toArray } from "rxjs"
import { beforeEach, describe, expect, test } from "vitest"

import { captureConsoleMessage } from "../tools/captureConsoleMessage.js"
import { modifySubtitleMetadata } from "./modifySubtitleMetadata.js"

const MINIMAL_ASS = `[Script Info]
ScriptType: v4.00
Title: Test
`

describe(modifySubtitleMetadata.name, () => {
  beforeEach(() => {
    vol.fromJSON({
      "G:\\Work\\episode-01.ass": MINIMAL_ASS,
    })
  })

  test("returns EMPTY without touching files when rules is an empty array", async () => (
    captureConsoleMessage("info", async () => {
      const emissions = await firstValueFrom(
        modifySubtitleMetadata({
          isRecursive: false,
          rules: [],
          sourcePath: "G:\\Work",
        })
        .pipe(toArray()),
      )
      expect(emissions).toEqual([])

      // The .ass file content stays exactly as seeded — no parse/serialize
      // round-trip, no formatting drift.
      const after = await readFile("G:\\Work\\episode-01.ass", "utf8")
      expect(after).toBe(MINIMAL_ASS)
    })
  ))

  test("returns EMPTY when rules is nullish (defensive guard)", async () => (
    captureConsoleMessage("info", async () => {
      const emissions = await firstValueFrom(
        modifySubtitleMetadata({
          isRecursive: false,
          // @ts-expect-error — defensive: external callers might omit it.
          rules: undefined,
          sourcePath: "G:\\Work",
        })
        .pipe(toArray()),
      )
      expect(emissions).toEqual([])
    })
  ))
})
