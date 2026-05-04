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
      complete: () => {
        const job = getJob(jobId)

        if (
          (
            job
            ?.status
          )
          !== "failed"
        ) {
          updateJob(jobId, {
            completedAt: new Date(),
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
