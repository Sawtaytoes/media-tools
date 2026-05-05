import { vol } from "memfs"
import { firstValueFrom } from "rxjs"
import { beforeEach, describe, expect, test, vitest } from "vitest"

import { makeDirectory } from "./makeDirectory.js"

describe(makeDirectory.name, () => {
  beforeEach(() => {
    vol
    .fromJSON({
      "G:\\Movies\\Star Wars (1977)\\Star Wars (1977).mkv": "",
    })
  })

  test("creates a directory given a file path", async () => {
    const folderPath = "G:\\Movies\\Super Mario Bros (1993)"
    const readdirCallback = vitest.fn()

    await expect(
      firstValueFrom(
        makeDirectory(
          folderPath
        )
      )
    )
    .resolves
    .toBe(undefined)

    await expect(
      new Promise((
        resolve,
        reject,
      ) => {
        vol
        .readdir(
          "G:\\Movies",
          (error, data) => {
            if (error) {
              reject(error)
            }
            else {
              resolve(data)
            }
          },
        )
      })
    )
    .resolves
    .toEqual([
      "Star Wars (1977)",
    ])
  })
})
