import { stat } from "node:fs/promises"
import { vol } from "memfs"
import { firstValueFrom, toArray } from "rxjs"
import { beforeEach, describe, expect, test } from "vitest"

import { deleteFilesByExtension } from "./deleteFilesByExtension.js"

describe(deleteFilesByExtension.name, () => {
  beforeEach(() => {
    vol.fromJSON({
      "G:\\Movies\\movie.srt": "",
      "G:\\Movies\\movie.ass": "",
      "G:\\Movies\\episode.SRT": "",
      "G:\\Movies\\notes.txt": "",
      "G:\\Movies\\subtitles\\extra.srt": "",
    })
  })

  test("deletes all files matching the requested extensions", async () => {
    await expect(
      firstValueFrom(
        deleteFilesByExtension({
          sourcePath: "G:\\Movies",
          extensions: [".srt"],
          isRecursive: true,
          recursiveDepth: 2,
        })
        .pipe(
          toArray(),
        )
      )
    )
    .resolves
    .toEqual([
      "G:\\Movies\\movie.srt",
      "G:\\Movies\\episode.SRT",
      "G:\\Movies\\subtitles\\extra.srt",
    ])

    await expect(stat("G:\\Movies\\movie.srt")).rejects.toThrow()
    await expect(stat("G:\\Movies\\episode.SRT")).rejects.toThrow()
    await expect(stat("G:\\Movies\\subtitles\\extra.srt")).rejects.toThrow()
    await expect(stat("G:\\Movies\\movie.ass")).resolves.toBeDefined()
    await expect(stat("G:\\Movies\\notes.txt")).resolves.toBeDefined()
  })
})
