import {
  catchError,
  EMPTY,
  type Observable,
  Subscription,
} from "rxjs"

import { logError, logInfo } from "../tools/logMessage.js"
import { withJobContext } from "./logCapture.js"
import {
  completeSubject,
  createSubject,
  getJob,
  registerJobSubscription,
  unregisterJobSubscription,
  updateJob,
} from "./jobStore.js"
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
  // Parallel to body.steps[i]: holds whichever status was last recorded
  // for that step. Indices we never reached stay undefined and render as
  // "skipped" in the end-of-run summary.
  const stepStatusByIndex: Array<"completed" | "failed" | undefined> = []
  let assignedCounter = 0

  const ensureStepId = (step: SequenceStep): string => {
    if (typeof step.id === "string" && step.id.length > 0) return step.id
    assignedCounter += 1
    return `step${assignedCounter}`
  }

  const logRunSummary = (): void => {
    if (body.steps.length === 0) return
    logInfo("SEQUENCE", "Run summary:")
    body.steps.forEach((step, index) => {
      const stepId = ensureStepId(step)
      const recorded = stepStatusByIndex[index]
      const status = recorded ?? "skipped"
      logInfo("SEQUENCE", `  ${index + 1}. ${stepId} (${step.command}): ${status}`)
    })
  }

  const finalize = (status: "completed" | "failed"): void => {
    logRunSummary()
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
        stepStatusByIndex[stepIndex] = "failed"
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
        stepStatusByIndex[stepIndex] = "failed"
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
        stepStatusByIndex[stepIndex] = "failed"
        finalize("failed")
        return
      }

      const subscription: Subscription = stepObservable
      .pipe(
        catchError((err) => {
          // cancelJob already wrote the terminal state and tore down the
          // chain; the catchError reaching here is fallout — don't clobber.
          if (getJob(jobId)?.status === "cancelled") return EMPTY

          logError("SEQUENCE", `Step ${stepId}: ${String(err)}`)
          updateJob(jobId, { error: String(err) })
          stepStatusByIndex[stepIndex] = "failed"
          finalize("failed")
          return EMPTY
        }),
      )
      .subscribe({
        next: (value) => {
          // Match jobRunner's `results.concat(value)` flattening so a
          // command's extractOutputs projector sees the same shape under
          // both runners. Without this, an observable that emits a single
          // rules-array (e.g. computeDefaultSubtitleRules) would leave
          // collectedResults as [[rule1, rule2]] here, and downstream
          // `linkedTo: …, output: 'rules'` references would resolve to an
          // array-of-array — silently no-opping modifySubtitleMetadata's
          // type-switched reduce.
          if (Array.isArray(value)) {
            collectedResults.push(...value)
            return
          }
          collectedResults.push(value)
        },
        complete: () => {
          subscription.unsubscribe()
          unregisterJobSubscription(jobId)

          // If this step's catchError already finalized as failed, or the
          // umbrella was cancelled mid-step, bail without recording
          // outputs and without advancing the recursion.
          //
          // TODO: refactor this runner to compose with concatMap so a
          // single subscription cascades — then cancelJob unsubscribing
          // the parent would automatically tear down the in-flight step.
          // For now we track the current step's subscription on the
          // umbrella job and rely on cancelJob to unsubscribe it directly.
          const status = getJob(jobId)?.status
          if (status === "failed" || status === "cancelled") return

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

          stepStatusByIndex[stepIndex] = "completed"
          logInfo("SEQUENCE", `Step ${stepId} (${step.command}): completed.`)
          runStep(stepIndex + 1)
        },
      })

      // Register the current step's subscription on the umbrella job so
      // cancelJob(jobId) can tear it down. Each step overwrites the
      // previous step's slot — the umbrella's "live" subscription is
      // always the in-flight step.
      registerJobSubscription(jobId, subscription)
    }

    runStep(0)
  })
}
