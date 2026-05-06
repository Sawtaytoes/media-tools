import { EMPTY, type Observable } from "rxjs"
import { catchError } from "rxjs"

import {
  completeSubject,
  createSubject,
  getJob,
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
    observable
    .pipe(
      catchError((err) => {
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

        if (
          (
            job
            ?.status
          )
          !== "failed"
        ) {
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
      },
      error: (err) => {
        updateJob(jobId, {
          completedAt: new Date(),
          error: String(err),
          status: "failed",
        })

        completeSubject(jobId)
      },
    })
  })
}
