import readline from "node:readline"
import { randomUUID } from "node:crypto"
import { Observable } from "rxjs"

import { getActiveJobId } from "../api/logCapture.js"
import { emitJobEvent } from "../api/jobStore.js"
import { registerPrompt } from "../api/promptStore.js"
import type { PromptOption } from "../api/types.js"

export const getUserSearchInput = (params: {
  message: string
  options: PromptOption[]
}) => (
  new Observable<number>((observer) => {
    const jobId = getActiveJobId()

    if (jobId) {
      const promptId = randomUUID()

      emitJobEvent(jobId, {
        message: params.message,
        options: params.options,
        promptId,
        type: "prompt",
      })

      registerPrompt(promptId)
        .then((index) => {
          observer.next(index)
          observer.complete()
        })
        .catch((error: unknown) => {
          observer.error(error)
        })

      return
    }

    process.stdout.write(`${params.message}\n`)

    params.options.forEach((option) => {
      process.stdout.write(`${option.index} | ${option.label}\n`)
    })

    const readlineInterface = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    })

    readlineInterface.on("line", (line) => {
      readlineInterface.close()
      observer.next(Number(line))
      observer.complete()
    })
  })
)
