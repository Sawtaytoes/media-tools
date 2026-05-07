import { logError, logInfo } from "../tools/logMessage.js"
import { withJobContext } from "./logCapture.js"
import {
  completeSubject,
  createJob,
  createSubject,
  getJob,
  updateJob,
} from "./jobStore.js"
import { runJob } from "./jobRunner.js"
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

// Drives a sequence under a single umbrella job. Each step is a real,
// first-class child Job (parentJobId = umbrellaId) with its own status,
// log stream, results, and cancel affordance — the Jobs UI groups by
// parentJobId on the client. Steps are pre-created up front in `pending`
// so the UI can render the entire step list immediately; each one then
// transitions through running → completed | failed | cancelled | skipped
// as the runner advances. The umbrella's own logs carry the cross-step
// "Step X starting / Run summary" markers.
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

  // Pre-assign step ids so they're stable for both the child Job
  // creation pass below and any later resolveSequenceParams lookups.
  let assignedCounter = 0
  const stepIds: string[] = body.steps.map((step) => {
    if (typeof step.id === "string" && step.id.length > 0) return step.id
    assignedCounter += 1
    return `step${assignedCounter}`
  })

  // Pre-create one child job per step in `pending`. Carries the raw
  // (unresolved) params — the resolved snapshot lives on the running
  // child only after we kick its observable off via runJob. Surfacing
  // raw params keeps the UI honest about what the user wrote and stays
  // consistent with how params are shown for un-started steps.
  const childJobIds: string[] = body.steps.map((step, index) => {
    const child = createJob({
      commandName: step.command,
      params: step.params ?? {},
      parentJobId: jobId,
      stepId: stepIds[index],
    })
    return child.id
  })

  const markRemainingSkipped = (fromIndex: number): void => {
    for (let i = fromIndex; i < childJobIds.length; i += 1) {
      const childId = childJobIds[i]
      if (getJob(childId)?.status === "pending") {
        updateJob(childId, {
          completedAt: new Date(),
          status: "skipped",
        })
        completeSubject(childId)
      }
    }
  }

  const logRunSummary = (): void => {
    if (body.steps.length === 0) return
    logInfo("SEQUENCE", "Run summary:")
    body.steps.forEach((step, index) => {
      const stepId = stepIds[index]
      const childStatus = getJob(childJobIds[index])?.status ?? "pending"
      logInfo("SEQUENCE", `  ${index + 1}. ${stepId} (${step.command}): ${childStatus}`)
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

  // Kick the loop off without awaiting — the route handler treats this
  // as fire-and-forget. The loop awaits each child job's runJob promise
  // and finalizes the umbrella when it terminates.
  void withJobContext(jobId, async () => {
    for (let stepIndex = 0; stepIndex < body.steps.length; stepIndex += 1) {
      // Bail-out gates checked at the top of every iteration: cancelJob
      // on the umbrella runs a cascade that flips the currently-running
      // child to cancelled and any still-pending children to skipped, so
      // by the time we resume after `await runJob` the umbrella may have
      // already moved into a terminal state.
      const umbrella = getJob(jobId)
      if (!umbrella || umbrella.status !== "running") return

      const step = body.steps[stepIndex]
      const stepId = stepIds[stepIndex]
      const childId = childJobIds[stepIndex]

      if (!isKnownCommand(step.command)) {
        const error = `Unknown command "${step.command}"`
        logError("SEQUENCE", `Step ${stepId}: ${error}.`)
        updateJob(childId, {
          completedAt: new Date(),
          error,
          status: "failed",
        })
        completeSubject(childId)
        updateJob(jobId, { error })
        markRemainingSkipped(stepIndex + 1)
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
        const message = errors.join("; ")
        updateJob(childId, {
          completedAt: new Date(),
          error: message,
          status: "failed",
        })
        completeSubject(childId)
        updateJob(jobId, { error: message })
        markRemainingSkipped(stepIndex + 1)
        finalize("failed")
        return
      }

      logInfo("SEQUENCE", `Step ${stepId} (${step.command}): starting.`)

      let stepObservable
      try {
        stepObservable = config.getObservable(resolved)
      } catch (error) {
        const message = String(error)
        logError("SEQUENCE", `Step ${stepId}: ${message}`)
        updateJob(childId, {
          completedAt: new Date(),
          error: message,
          status: "failed",
        })
        completeSubject(childId)
        updateJob(jobId, { error: message })
        markRemainingSkipped(stepIndex + 1)
        finalize("failed")
        return
      }

      // runJob installs its own withJobContext(childId, ...) inside —
      // per-step command logs route to the child's log stream, while
      // SEQUENCE-prefixed lines around it (above/below this await) stay
      // on the umbrella's stream because we're inside withJobContext(jobId).
      const finalChild = await runJob(childId, stepObservable, {
        extractOutputs: config.extractOutputs,
      })

      const childStatus = finalChild?.status

      if (childStatus === "cancelled") {
        // cancelJob(jobId) already cascaded — the umbrella is cancelled
        // and any later children are skipped. Nothing for us to do but bail.
        return
      }

      if (childStatus === "failed") {
        const message = finalChild?.error ?? "Step failed"
        updateJob(jobId, { error: message })
        markRemainingSkipped(stepIndex + 1)
        finalize("failed")
        return
      }

      // Completed. Flatten single-array emissions into named outputs the
      // way the old in-line subscriber did, so a command that emits a
      // single rules-array (e.g. computeDefaultSubtitleRules) doesn't
      // leave downstream `linkedTo: ..., output: 'rules'` references
      // resolving to an array-of-array. jobRunner uses concat() which
      // already produces the flat shape — but extractOutputs is called
      // on `job.results`, which is whatever next-callbacks pushed. Since
      // jobRunner does `results.concat(value)` (which itself flattens
      // a single-level array via Array.prototype.concat), the outputs
      // here are already flat for the array-emission case.
      const outputs = finalChild?.outputs ?? null

      stepsById[stepId] = {
        command: step.command,
        outputs,
        resolvedParams: resolved,
      }

      logInfo("SEQUENCE", `Step ${stepId} (${step.command}): completed.`)
    }

    logInfo("SEQUENCE", `Completed all ${body.steps.length} step(s).`)
    finalize("completed")
  })
}
