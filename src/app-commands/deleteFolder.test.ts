import { stat } from "node:fs/promises"
import { vol } from "memfs"
import { firstValueFrom, lastValueFrom, toArray } from "rxjs"
import { beforeEach, describe, expect, test } from "vitest"

import { captureConsoleMessage } from "../tools/captureConsoleMessage.js"
import { deleteFolder } from "./deleteFolder.js"

describe(deleteFolder.name, () => {
  beforeEach(() => {
    vol.fromJSON({
      "G:\\Work\\TEMP\\AUDIO-OFFSETS\\offsets.json": "{}",
      "G:\\Work\\TEMP\\AUDIO-OFFSETS\\nested\\file.bin": "data",
      "G:\\Work\\episode-01.mkv": "keep-me",
    })
  })

  test("recursively removes the folder when confirm is true", async () => {
    const result = await lastValueFrom(
      deleteFolder({ confirm: true, folderPath: "G:\\Work\\TEMP\\AUDIO-OFFSETS" }),
    )

    expect(result).toBe("G:\\Work\\TEMP\\AUDIO-OFFSETS")
    await expect(stat("G:\\Work\\TEMP\\AUDIO-OFFSETS")).rejects.toThrow()
    await expect(stat("G:\\Work\\TEMP\\AUDIO-OFFSETS\\nested\\file.bin")).rejects.toThrow()
    // Sibling files outside the deleted folder survive.
    await expect(stat("G:\\Work\\episode-01.mkv")).resolves.toBeDefined()
  })

  test("refuses to run and emits no values when confirm is false", async () => (
    captureConsoleMessage("error", async () => {
      // logAndSwallow swallows the thrown error into EMPTY, so the observable
      // completes with no emitted values. firstValueFrom-on-EMPTY rejects with
      // a NoElementsError; toArray() resolves to [] which is the cleaner check.
      const emissions = await firstValueFrom(
        deleteFolder({ confirm: false, folderPath: "G:\\Work\\TEMP\\AUDIO-OFFSETS" })
        .pipe(toArray()),
      )
      expect(emissions).toEqual([])

      // Folder must still be intact — confirm: false is a hard stop.
      await expect(stat("G:\\Work\\TEMP\\AUDIO-OFFSETS")).resolves.toBeDefined()
      await expect(stat("G:\\Work\\TEMP\\AUDIO-OFFSETS\\offsets.json")).resolves.toBeDefined()
    })
  ))

  test("logs the refusal reason when confirm is omitted from the call", async () => (
    captureConsoleMessage("error", async (consoleSpy) => {
      await firstValueFrom(
        // @ts-expect-error — deliberately calling without confirm to exercise
        // the runtime guard that protects CLI / direct callers.
        deleteFolder({ folderPath: "G:\\Work\\TEMP\\AUDIO-OFFSETS" })
        .pipe(toArray()),
      )

      const errorOutput = consoleSpy.mock.calls.flat().join(" ")
      expect(errorOutput).toMatch(/confirm: true/i)
      // Folder remains.
      await expect(stat("G:\\Work\\TEMP\\AUDIO-OFFSETS")).resolves.toBeDefined()
    })
  ))
})
