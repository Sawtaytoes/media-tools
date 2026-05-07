import { vol } from "memfs"
import { describe, expect, test, vi } from "vitest"

import { aclSafeCopyFile, aclSafeCopyFolders, type CopyProgressEvent } from "./aclSafeFileTools.js"

describe(aclSafeCopyFile.name, () => {
  test("copies file contents to a new destination", async () => {
    vol
    .fromJSON({
      "G:\\cache\\source.mkv": "anime episode bytes",
      "G:\\Anime": null,
    })

    await expect(
      aclSafeCopyFile(
        "G:\\cache\\source.mkv",
        "G:\\Anime\\target.mkv",
      )
    )
    .resolves
    .toBeUndefined()

    expect(
      vol
      .readFileSync(
        "G:\\Anime\\target.mkv",
        "utf8",
      )
    )
    .toBe(
      "anime episode bytes"
    )
  })

  test("overwrites an existing destination", async () => {
    vol
    .fromJSON({
      "G:\\cache\\source.mkv": "fresh bytes",
      "G:\\Anime\\target.mkv": "stale bytes",
    })

    await expect(
      aclSafeCopyFile(
        "G:\\cache\\source.mkv",
        "G:\\Anime\\target.mkv",
      )
    )
    .resolves
    .toBeUndefined()

    expect(
      vol
      .readFileSync(
        "G:\\Anime\\target.mkv",
        "utf8",
      )
    )
    .toBe(
      "fresh bytes"
    )
  })

  test("rejects when the source is missing", async () => {
    await expect(
      aclSafeCopyFile(
        "G:\\cache\\missing.mkv",
        "G:\\Anime\\target.mkv",
      )
    )
    .rejects
    .toThrow(
      "no such file or directory"
    )
  })

  test("leaves the source untouched", async () => {
    vol
    .fromJSON({
      "G:\\cache\\source.mkv": "original bytes",
      "G:\\Anime": null,
    })

    await (
      aclSafeCopyFile(
        "G:\\cache\\source.mkv",
        "G:\\Anime\\target.mkv",
      )
    )

    expect(
      vol
      .readFileSync(
        "G:\\cache\\source.mkv",
        "utf8",
      )
    )
    .toBe(
      "original bytes"
    )
  })

  test("reports progress when onProgress is supplied", async () => {
    vol
    .fromJSON({
      "G:\\cache\\source.mkv": "twelve bytes",
      "G:\\Anime": null,
    })

    const progressEvents: CopyProgressEvent[] = []

    await (
      aclSafeCopyFile(
        "G:\\cache\\source.mkv",
        "G:\\Anime\\target.mkv",
        {
          onProgress: (event) => {
            progressEvents.push(event)
          },
        },
      )
    )

    expect(
      progressEvents
      .length
    )
    .toBeGreaterThan(0)

    const finalEvent = (
      progressEvents
      .at(-1)!
    )

    expect(finalEvent.source).toBe("G:\\cache\\source.mkv")
    expect(finalEvent.destination).toBe("G:\\Anime\\target.mkv")
    expect(finalEvent.totalBytes).toBe(12)
    expect(finalEvent.bytesWritten).toBe(12)
  })

  test("does not call onProgress when options are omitted", async () => {
    vol
    .fromJSON({
      "G:\\cache\\source.mkv": "anything",
      "G:\\Anime": null,
    })

    const onProgress = vi.fn()

    await (
      aclSafeCopyFile(
        "G:\\cache\\source.mkv",
        "G:\\Anime\\target.mkv",
      )
    )

    expect(onProgress).not.toHaveBeenCalled()
  })
})

describe(aclSafeCopyFolders.name, () => {
  test("copies a flat folder of files", async () => {
    vol
    .fromJSON({
      "G:\\src\\one.mkv": "first",
      "G:\\src\\two.mkv": "second",
    })

    await (
      aclSafeCopyFolders(
        "G:\\src",
        "G:\\dst",
      )
    )

    expect(
      vol
      .readFileSync(
        "G:\\dst\\one.mkv",
        "utf8",
      )
    )
    .toBe(
      "first"
    )

    expect(
      vol
      .readFileSync(
        "G:\\dst\\two.mkv",
        "utf8",
      )
    )
    .toBe(
      "second"
    )
  })

  test("copies a nested folder structure", async () => {
    vol
    .fromJSON({
      "G:\\src\\top.txt": "top",
      "G:\\src\\sub\\inner.txt": "inner",
      "G:\\src\\sub\\deep\\bottom.txt": "bottom",
    })

    await (
      aclSafeCopyFolders(
        "G:\\src",
        "G:\\dst",
      )
    )

    expect(
      vol
      .readFileSync(
        "G:\\dst\\top.txt",
        "utf8",
      )
    )
    .toBe(
      "top"
    )

    expect(
      vol
      .readFileSync(
        "G:\\dst\\sub\\inner.txt",
        "utf8",
      )
    )
    .toBe(
      "inner"
    )

    expect(
      vol
      .readFileSync(
        "G:\\dst\\sub\\deep\\bottom.txt",
        "utf8",
      )
    )
    .toBe(
      "bottom"
    )
  })

  test("creates the destination if it doesn't exist", async () => {
    vol
    .fromJSON({
      "G:\\src\\file.txt": "hi",
    })

    await (
      aclSafeCopyFolders(
        "G:\\src",
        "G:\\new\\nested\\dst",
      )
    )

    expect(
      vol
      .readFileSync(
        "G:\\new\\nested\\dst\\file.txt",
        "utf8",
      )
    )
    .toBe(
      "hi"
    )
  })

  test("handles an empty source folder", async () => {
    vol
    .fromJSON({
      "G:\\src": null,
    })

    await expect(
      aclSafeCopyFolders(
        "G:\\src",
        "G:\\dst",
      )
    )
    .resolves
    .toBeUndefined()

    expect(
      vol
      .readdirSync(
        "G:\\dst",
      )
    )
    .toEqual([])
  })

  test("overwrites files at the destination", async () => {
    vol
    .fromJSON({
      "G:\\src\\file.txt": "fresh",
      "G:\\dst\\file.txt": "stale",
    })

    await (
      aclSafeCopyFolders(
        "G:\\src",
        "G:\\dst",
      )
    )

    expect(
      vol
      .readFileSync(
        "G:\\dst\\file.txt",
        "utf8",
      )
    )
    .toBe(
      "fresh"
    )
  })

  test("forwards progress events for each leaf file", async () => {
    vol
    .fromJSON({
      "G:\\src\\one.txt": "one",
      "G:\\src\\sub\\two.txt": "twothree",
    })

    const progressEvents: CopyProgressEvent[] = []

    await (
      aclSafeCopyFolders(
        "G:\\src",
        "G:\\dst",
        {
          onProgress: (event) => {
            progressEvents.push(event)
          },
        },
      )
    )

    const sourcesSeen = (
      new Set(
        progressEvents
        .map((event) => (
          event.source
        ))
      )
    )

    expect(sourcesSeen).toEqual(
      new Set([
        "G:\\src\\one.txt",
        "G:\\src\\sub\\two.txt",
      ])
    )

    const oneEvent = (
      progressEvents
      .find((event) => (
        event.source === "G:\\src\\one.txt"
      ))!
    )
    expect(oneEvent.totalBytes).toBe(3)
    expect(oneEvent.bytesWritten).toBe(3)

    const twoEvent = (
      progressEvents
      .find((event) => (
        event.source === "G:\\src\\sub\\two.txt"
      ))!
    )
    expect(twoEvent.totalBytes).toBe(8)
    expect(twoEvent.bytesWritten).toBe(8)
  })

  test("rejects when the source is missing", async () => {
    await expect(
      aclSafeCopyFolders(
        "G:\\missing",
        "G:\\dst",
      )
    )
    .rejects
    .toThrow(
      "no such file or directory"
    )
  })
})
