import { createReadStream, createWriteStream } from "node:fs"
import { mkdir, readdir, stat } from "node:fs/promises"
import { join } from "node:path"
import { Transform } from "node:stream"
import { pipeline } from "node:stream/promises"

/**
 * Per-chunk progress notification fired while a single file is being
 * copied. `bytesWritten` accumulates monotonically up to `totalBytes`
 * across the lifetime of one file copy. For `aclSafeCopyFolders` the
 * same shape is reused per leaf file, with `source`/`destination`
 * identifying which file the event belongs to.
 */
export type CopyProgressEvent = {
  source: string
  destination: string
  bytesWritten: number
  totalBytes: number
}

/**
 * Optional behavior toggles for `aclSafeCopyFile` and
 * `aclSafeCopyFolders`. Pass `onProgress` to receive byte-level
 * updates as the copy streams through; omit the options object
 * entirely (the common case) to skip the progress instrumentation
 * and the upfront `stat` call it requires.
 */
export type CopyOptions = {
  onProgress?: (event: CopyProgressEvent) => void
}

/**
 * Copies a single file's bytes from `source` to `destination` via a
 * stream pipeline. Equivalent to GNU `cp` without flags: data only,
 * no mode preservation, no timestamp preservation, no ownership
 * preservation.
 *
 * Built to work around an EPERM that `node:fs.copyFile` and
 * `node:fs.cp` hit on TrueNAS ZFS datasets configured with
 * `aclmode=restricted`. libuv's internal copyfile path calls
 * `fchmod()` on the destination after the data copy to preserve the
 * source's mode bits, and that chmod fails against NFSv4 ACLs even
 * when the mode is unchanged. Streaming the bytes never invokes
 * chmod, so the copy goes through.
 *
 * Files only — does not handle directory copies (use
 * `aclSafeCopyFolders` for that). The destination's parent directory
 * must already exist; callers are expected to `mkdir`-recursive first
 * (the underlying `createWriteStream` rejects with ENOENT otherwise).
 *
 * Pass `options.onProgress` to receive per-chunk byte updates. When
 * omitted, the function takes a fast path that skips the upfront
 * `stat` call and the in-pipeline counting transform.
 */
export const aclSafeCopyFile = async (
  source: string,
  destination: string,
  options?: CopyOptions,
): Promise<void> => {
  if (
    !options?.onProgress
  ) {
    return (
      pipeline(
        createReadStream(
          source,
        ),
        createWriteStream(
          destination,
        ),
      )
    )
  }

  const onProgress = (
    options
    .onProgress
  )

  const { size: totalBytes } = (
    await (
      stat(
        source,
      )
    )
  )

  let bytesWritten = 0
  const progressTransform = (
    new Transform({
      transform(chunk, _encoding, callback) {
        bytesWritten += chunk.length
        onProgress({
          source,
          destination,
          bytesWritten,
          totalBytes,
        })
        callback(
          null,
          chunk,
        )
      },
    })
  )

  return (
    pipeline(
      createReadStream(
        source,
      ),
      progressTransform,
      createWriteStream(
        destination,
      ),
    )
  )
}

/**
 * Recursively copies the contents of `source` into `destination`,
 * delegating to `aclSafeCopyFile` for every leaf file. Equivalent to
 * GNU `cp -r` without flags: data only, no mode/timestamp/ownership
 * preservation.
 *
 * Builds on `aclSafeCopyFile` so the same chmod-skipping safety
 * applies to every file in the tree — see that function's JSDoc for
 * the underlying TrueNAS ZFS `aclmode=restricted` motivation.
 *
 * Creates `destination` (and any missing parents) if it doesn't
 * exist. Skips non-regular, non-directory entries (symlinks, sockets,
 * devices) — none of the current call sites need them, and following
 * symlinks would need cycle detection that should wait for a real use
 * case. Copies are sequential to match GNU `cp -r` behavior; callers
 * that want parallelism can compose at their own layer.
 *
 * `options.onProgress` is forwarded to each per-file copy, so the
 * callback fires per-chunk for each leaf file with `source` /
 * `destination` identifying which file the event belongs to.
 */
export const aclSafeCopyFolders = async (
  source: string,
  destination: string,
  options?: CopyOptions,
): Promise<void> => {
  await (
    mkdir(
      destination,
      { recursive: true },
    )
  )

  const entries = (
    await (
      readdir(
        source,
        { withFileTypes: true },
      )
    )
  )

  for (const entry of entries) {
    const sourcePath = (
      join(
        source,
        entry.name,
      )
    )
    const destinationPath = (
      join(
        destination,
        entry.name,
      )
    )

    if (
      entry
      .isDirectory()
    ) {
      await (
        aclSafeCopyFolders(
          sourcePath,
          destinationPath,
          options,
        )
      )
    }
    else if (
      entry
      .isFile()
    ) {
      await (
        aclSafeCopyFile(
          sourcePath,
          destinationPath,
          options,
        )
      )
    }
  }
}
