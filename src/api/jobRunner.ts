import { EMPTY, type Observable } from "rxjs"
import { catchError } from "rxjs"

import {
  completeSubject,
  createSubject,
  getJob,
  registerJobSubscription,
  unregisterJobSubscription,
  updateJob,
} from "./jobStore.js"
import { withJobContext } from "./logCapture.js"

export const runJob = (
  jobId: string,
  observable: Observable<unknown>,
  options: {
    // Optional projector that turns the collected emission stream into a
    // named-outputs object once the observable completes successfully.
    // The result is stored on the job's `outputs` field and surfaced in
    // the SSE done event so downstream sequence steps can reference it.
    extractOutputs?: (results: unknown[]) => Record<string, unknown>,
  } = {},
): void => {
  createSubject(jobId)

  updateJob(jobId, {
    startedAt: new Date(),
    status: "running",
  })

  // Run the observable inside the job's async context so all console.*
  // calls from the pipeline are routed to this job's log stream.
  withJobContext(jobId, () => {
    const subscription = (
      observable
      .pipe(
        catchError((err) => {
          // Don't clobber a "cancelled" status — cancelJob already wrote
          // the terminal state and the upstream error here is just
          // fallout from unsubscribe tearing the chain down.
          if (getJob(jobId)?.status === "cancelled") return EMPTY

          updateJob(jobId, {
            completedAt: new Date(),
            error: String(err),
            status: "failed",
          })

          return EMPTY
        }),
      )
      .subscribe({
        next: (value) => {
          const job = getJob(jobId)

          if (!job) return

          updateJob(jobId, {
            results: (
              job
              .results
              .concat(value)
            ),
          })
        },
        complete: () => {
          const job = getJob(jobId)

          // Same guard as above — preserve the terminal status set by
          // cancelJob even if the inner pipeline races to complete first.
          if (job?.status === "cancelled") {
            unregisterJobSubscription(jobId)
            return
          }

          if (job?.status !== "failed") {
            const outputs = (
              options.extractOutputs && job
              ? options.extractOutputs(job.results)
              : null
            )

            updateJob(jobId, {
              completedAt: new Date(),
              outputs,
              status: "completed",
            })
          }

          completeSubject(jobId)
          unregisterJobSubscription(jobId)
        },
        error: (err) => {
          if (getJob(jobId)?.status === "cancelled") {
            unregisterJobSubscription(jobId)
            return
          }

          updateJob(jobId, {
            completedAt: new Date(),
            error: String(err),
            status: "failed",
          })

          completeSubject(jobId)
          unregisterJobSubscription(jobId)
        },
      })
    )

    registerJobSubscription(jobId, subscription)
  })
}
