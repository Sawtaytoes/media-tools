import { map, type Observable } from "rxjs"

import {
  buildDefaultSubtitleModificationRules,
  type SubtitleModificationRule,
} from "../tools/buildDefaultSubtitleModificationRules.js"
import { logAndRethrow } from "../tools/logAndRethrow.js"
import { getSubtitleMetadata } from "./getSubtitleMetadata.js"

// Reads every .ass file's [Script Info] / [V4+ Styles] metadata via
// getSubtitleMetadata, then runs the default-rules heuristic over the
// aggregate. Emits a single rules array; runJob's results-concat lifts it
// into job.results, and the route's extractOutputs pins it as
// `outputs.rules` for downstream sequence steps to consume.
export const computeDefaultSubtitleRules = ({
  isRecursive,
  recursiveDepth,
  sourcePath,
}: {
  isRecursive: boolean,
  recursiveDepth?: number,
  sourcePath: string,
}): Observable<SubtitleModificationRule[]> => (
  getSubtitleMetadata({
    isRecursive,
    recursiveDepth,
    sourcePath,
  })
  .pipe(
    map((metadata) => buildDefaultSubtitleModificationRules(metadata)),
    logAndRethrow(computeDefaultSubtitleRules),
  )
)
