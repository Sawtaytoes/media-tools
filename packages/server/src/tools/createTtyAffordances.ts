import type { ChildProcess } from "node:child_process"

import { getActiveJobId } from "../api/logCapture.js"

// In API/job context the server runs as a long-lived daemon; the CLI
// affordances below (stdin raw mode, ctrl-c forwarding, process.exit on
// cancel) all break that environment — they leak stdin listeners with
// every job, hijack raw mode away from the dev terminal's natural SIGINT
// handling, and could crash the server. So gate them behind both an
// API-context check and an isTTY check, and hand callers a `detach`
// function so the listeners actually go away when the child exits.
//
// runFfmpeg already inlined this pattern; this helper is the same shape
// extracted so every spawn wrapper handles it consistently.
// Pure gating rule: TTY affordances attach only when the process is
// running interactively (stdin is a TTY) and NOT inside a server-job
// context where the per-job AsyncLocalStorage entry signals long-lived
// daemon mode.
export const shouldUseTtyAffordances = ({
  isInApiContext,
  isStdinTty,
}: {
  isInApiContext: boolean
  isStdinTty: boolean
}): boolean => !isInApiContext && isStdinTty

export const createTtyAffordances = (
  childProcess: ChildProcess,
): {
  isUsingTtyAffordances: boolean
  detach: () => void
} => {
  const isUsingTtyAffordances = shouldUseTtyAffordances({
    isInApiContext: Boolean(getActiveJobId()),
    isStdinTty: Boolean(process.stdin.isTTY),
  })

  if (!isUsingTtyAffordances) {
    return {
      isUsingTtyAffordances: false,
      detach: () => {},
    }
  }

  const onData = (inputBuffer: Buffer) => {
    const key = inputBuffer.toString()
    // [CTRL][C]
    if (key === "\u0003") {
      childProcess.kill()
      return
    }
    process.stdout.write(key)
  }

  process.stdin.setRawMode(true)
  process.stdin.resume()
  process.stdin.setEncoding("utf8")
  process.stdin.on("data", onData)

  return {
    isUsingTtyAffordances: true,
    detach: () => {
      process.stdin.setRawMode(false)
      process.stdin.removeListener("data", onData)
      process.stdin.pause()
    },
  }
}
