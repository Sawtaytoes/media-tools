import {
  catchError,
  EMPTY,
  type Observable,
  Subscription,
} from "rxjs"

import { logError, logInfo } from "../tools/logMessage.js"
import { withJobContext } from "./logCapture.js"
import { completeSubject, createSubject, getJob, updateJob } from "./jobStore.js"
import {
  resolveSequenceParams,
  type SequencePath,
  type StepRuntimeRecord,
} from "./resolveSequenceParams.js"
import {
  commandConfigs,
  type CommandConfig,
  type CommandName,
} from "./routes/commandRoutes.js"

export type SequenceStep = {
  id?: string
  command: string
  params?: Record<string, unknown>
}

export type SequenceBody = {
  paths?: Record<string, SequencePath>
  steps: SequenceStep[]
}

const isKnownCommand = (name: string): name is CommandName => (
  Object.prototype.hasOwnProperty.call(commandConfigs, name)
)

// Drives a sequence under a single umbrella job: resolves each step's
// params against accumulated runtime state, dispatches the matching app-
// command observable, captures its emissions to compute named outputs, and
// stops on the first failure. Every step's logs route through the umbrella
// job's SSE stream (withJobContext keeps them in the same async context).
export const runSequenceJob = (
  jobId: string,
  body: SequenceBody,
): void => {
  createSubject(jobId)
  updateJob(jobId, {
    startedAt: new Date(),
    status: "running",
  })

  const pathsById: Record<string, SequencePath> = body.paths ?? {}
  const stepsById: Record<string, StepRuntimeRecord> = {}
  let assignedCounter = 0

  const ensureStepId = (step: SequenceStep): string => {
    if (typeof step.id === "string" && step.id.length > 0) return step.id
    assignedCounter += 1
    return `step${assignedCounter}`
  }

  const finalize = (status: "completed" | "failed"): void => {
    updateJob(jobId, {
      completedAt: new Date(),
      status,
    })
    completeSubject(jobId)
  }

  withJobContext(jobId, () => {
    const runStep = (
      stepIndex: number,
    ): void => {
      if (stepIndex >= body.steps.length) {
        logInfo("SEQUENCE", `Completed all ${body.steps.length} step(s).`)
        finalize("completed")
        return
      }

      const step = body.steps[stepIndex]
      const stepId = ensureStepId(step)

      if (!isKnownCommand(step.command)) {
        logError("SEQUENCE", `Step ${stepId}: unknown command "${step.command}".`)
        updateJob(jobId, { error: `Unknown command "${step.command}"` })
        finalize("failed")
        return
      }

      const config: CommandConfig = commandConfigs[step.command]

      const { resolved, errors } = resolveSequenceParams({
        rawParams: step.params ?? {},
        pathsById,
        stepsById,
        commandConfigsByName: commandConfigs,
      })

      if (errors.length > 0) {
        errors.forEach((error) => logError("SEQUENCE", `Step ${stepId}: ${error}`))
        updateJob(jobId, { error: errors.join("; ") })
        finalize("failed")
        return
      }

      logInfo("SEQUENCE", `Step ${stepId} (${step.command}): starting.`)

      const collectedResults: unknown[] = []
      let stepObservable: Observable<unknown>
      try {
        stepObservable = config.getObservable(resolved)
      } catch (error) {
        logError("SEQUENCE", `Step ${stepId}: ${String(error)}`)
        updateJob(jobId, { error: String(error) })
        finalize("failed")
        return
      }

      const subscription: Subscription = stepObservable
      .pipe(
        catchError((err) => {
          logError("SEQUENCE", `Step ${stepId}: ${String(err)}`)
          updateJob(jobId, { error: String(err) })
          finalize("failed")
          return EMPTY
        }),
      )
      .subscribe({
        next: (value) => {
          collectedResults.push(value)
        },
        complete: () => {
          subscription.unsubscribe()
          // If this step's catchError already finalized as failed, the job
          // status will be 'failed' — bail without recording outputs and
          // without advancing.
          if (getJob(jobId)?.status === "failed") return

          const outputs = (
            config.extractOutputs
            ? config.extractOutputs(collectedResults)
            : null
          )

          stepsById[stepId] = {
            command: step.command,
            outputs,
            resolvedParams: resolved,
          }

          logInfo("SEQUENCE", `Step ${stepId} (${step.command}): completed.`)
          runStep(stepIndex + 1)
        },
      })
    }

    runStep(0)
  })
}
