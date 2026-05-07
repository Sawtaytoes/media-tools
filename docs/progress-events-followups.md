# Progress events — follow-up work

## Background

The job-progress feature shipped over five commits (most recent first):

- `f4a9053` feat(jobs UI): render progress bars from ProgressEvents on running cards + step rows
- `818a74f` feat(progress): wire 16 per-file iterator app-commands through withFileProgress
- `c5296a5` feat(progress): wire mkvmerge / mkvextract / ffmpeg spawn ops to the progress emitter
- `2acdf18` feat(progress): wire copy operations through the progress emitter
- `dbf7b52` feat(progress): infrastructure for progress events over the per-job SSE channel

`ProgressEvent` rides the existing per-job SSE channel alongside log lines and prompt events. Events are throttled at 1 Hz (deferred-first-emit so trivially-fast jobs stay silent). Per-job emitter API in [src/tools/progressEmitter.ts](../src/tools/progressEmitter.ts) — see `createProgressEmitter` and `withFileProgress`.

**Architectural decision worth knowing for the follow-ups:** spawn ops emit `currentFile` / `currentFileRatio` (per-file scope), the iterator emits `ratio` / `filesDone` / `filesTotal` (job scope). Both phases write to the same jobId's SSE channel. The Jobs UI merges incoming events field-by-field rather than replacing — see `mergeProgress` in [public/api/index.html](../public/api/index.html). Any new emitter caller should pick which scope it owns and stick to it.

---

## Follow-up 1 — migrate the remaining per-file iterator commands

Phase 4 covered the clean cases (16 of ~30 candidates). The rest fall into four buckets, each needing a different approach.

### 1a. Two-file-list joins

These walk a destination directory and look up matching files in a source directory by filename:

- [src/app-commands/replaceTracks.ts](../src/app-commands/replaceTracks.ts)
- [src/app-commands/replaceAttachments.ts](../src/app-commands/replaceAttachments.ts)
- [src/app-commands/getAudioOffsets.ts](../src/app-commands/getAudioOffsets.ts)

**Pattern**: `getFiles(source).pipe(toArray(), concatMap(sources => getFiles(destination).pipe(map(joined-tuples), filter(Boolean), concatMap(perFile))))`.

**Recommended approach**: wrap the inner `concatMap(perFile)` (after the join + filter) with `withFileProgress`. The "files" the progress bar tracks are the JOINED tuples — that's what the user actually cares about. Total files = matched-pair count (not all destination files, since unmatched ones are dropped by the filter).

Roughly:

```ts
.pipe(
  filter(({ sourceFilePath }) => Boolean(sourceFilePath)),
  withFileProgress(({ sourceFilePath, destinationFilePath }) => (
    // existing per-file work
  )),
)
```

Effort: 3 files × ~10 lines each. Should be straightforward.

### 1b. Index-based iteration

- [src/app-commands/splitChapters.ts](../src/app-commands/splitChapters.ts)

**Pattern**: `map((fileInfo, index) => splitChaptersMkvMerge({ chapterSplits: chapterSplitsList[index].split(' ').join(','), ... }))`.

The current `withFileProgress(perFile)` takes `(fileInfo) => Observable<U>` — no index parameter.

**Recommended approach**: extend `withFileProgress` to pass index as the second argument:

```ts
export const withFileProgress = <T, U>(
  perFile: (fileInfo: T, index: number) => Observable<U>,
  options: WithFileProgressOptions = {},
): OperatorFunction<T, U> => (source) => (
  source.pipe(
    toArray(),
    concatMap((files) => {
      const indexed = files.map((file, index) => ({ file, index }))
      // ... existing logic, but with mergeMap(({ file, index }) => perFile(file, index).pipe(...))
    }),
  )
)
```

Then migrate splitChapters to call `withFileProgress((fileInfo, index) => splitChaptersMkvMerge(...))`. Existing call sites are unaffected (TypeScript optional-arity inference).

Effort: small operator change + 1 command migration + a test for the index passthrough.

### 1c. Parallel "has*" query commands

These use `mergeMap(fileInfo => ...)` (unbounded parallelism) but with non-trivial inner shapes that don't cleanly factor:

- [src/app-commands/hasBetterVersion.ts](../src/app-commands/hasBetterVersion.ts) — outer `mergeMap` is `getUhdDiscForumPostData` (network call), with file iteration NESTED INSIDE the mergeMap callback. Not a per-file outer concatMap to swap.
- [src/app-commands/hasManyAudioTracks.ts](../src/app-commands/hasManyAudioTracks.ts) — outer is `mergeMap(fileInfo => ...)` returning emissions from a complex inner pipe.
- [src/app-commands/hasSurroundSound.ts](../src/app-commands/hasSurroundSound.ts) — same shape.
- [src/app-commands/hasWrongDefaultTrack.ts](../src/app-commands/hasWrongDefaultTrack.ts) — same.
- [src/app-commands/hasImaxEnhancedAudio.ts](../src/app-commands/hasImaxEnhancedAudio.ts) — same.
- [src/app-commands/hasDuplicateMusicFiles.ts](../src/app-commands/hasDuplicateMusicFiles.ts) — uses `mergeMap` after a different upstream shape.
- [src/app-commands/isMissingSubtitles.ts](../src/app-commands/isMissingSubtitles.ts) — `map(fileInfo => Observable) + mergeAll(N)` pattern.

**Recommended approach** for the simple ones (`hasManyAudioTracks`, `hasSurroundSound`, `hasWrongDefaultTrack`, `hasImaxEnhancedAudio`, `isMissingSubtitles`): swap `mergeMap(fileInfo => ...)` (or `map + mergeAll`) for `withFileProgress(fileInfo => ..., { concurrency: Infinity })` (or `{ concurrency: N }` to match the existing bound).

For `hasBetterVersion` and `hasDuplicateMusicFiles`: the iteration shape is more nested. Likely need to identify the per-file boundary and instrument just that, leaving the surrounding orchestration alone.

Effort: ~5 files mechanical + 2 needing case-by-case refactor.

### 1d. Complex orchestration

These need careful case-by-case work:

- [src/app-commands/storeAspectRatioData.ts](../src/app-commands/storeAspectRatioData.ts) — multi-stage `mergeAll(threadCount)` parallel processing with reduce. The "per-file" boundary is the inner ffprobe call.
- [src/app-commands/mergeTracks.ts](../src/app-commands/mergeTracks.ts) — deeply nested `concatMap` chain (several levels). Per-file boundary is at the outermost concatMap that destructures from a tuple — needs a careful read.
- [src/app-commands/nameAnimeEpisodes.ts](../src/app-commands/nameAnimeEpisodes.ts), [nameAnimeEpisodesAniDB.ts](../src/app-commands/nameAnimeEpisodesAniDB.ts), [nameSpecialFeatures.ts](../src/app-commands/nameSpecialFeatures.ts), [nameTvShowEpisodes.ts](../src/app-commands/nameTvShowEpisodes.ts) — interactive prompts (`getUserSearchInput`), API calls (TVDB, MAL, AniDB), and renames composed in one pipeline. Progress here needs to mark "renamed file 5 of 12" — the rename concatMap is the right wrap point, not the upstream search/lookup.
- [src/app-commands/renameMovieClipDownloads.ts](../src/app-commands/renameMovieClipDownloads.ts), [renameDemos.ts](../src/app-commands/renameDemos.ts) — renameDemos was migrated; renameMovieClipDownloads has a similar shape and should follow.

Effort: half a day. Suggest treating each as a small individual task rather than batching.

### Test strategy for 1a–1d

Existing app-command tests run against `memfs` with no active job context, so the emitter is null and behavior is unchanged. Migrations should pass existing tests as-is. No new tests required unless you change the emitter API (e.g. adding `index` for 1b).

---

## Follow-up 2 — builder api-run modal cross-child progress

The builder's "Run via API" modal ([public/api/builder/index.html](../public/api/builder/index.html), look for `tailApiRunLogs` and the `#api-run-modal` div) subscribes to the umbrella sequence job's SSE stream. The umbrella's logs subject carries the cross-step `[SEQUENCE]` markers — but it does NOT carry progress events. Progress events fire on each child step's subject, not the umbrella's, because:

- `withFileProgress` calls `getActiveJobId()`, which inside the sequence runner returns the CHILD's id (each step runs under `runJob`'s own `withJobContext`).
- `aclSafeCopyFile`'s `onProgress` flows into an emitter scoped to whichever id is active — same answer: child.
- Spawn ops (`runMkvMerge` etc.) likewise.

So the modal's current SSE handler will never see a `data.type === "progress"` event.

### Approaches

**A. Modal subscribes to `/jobs/stream` globally** and filters for events whose `parentJobId === umbrellaId`. This is what the `/jobs` page already does. Pros: zero server change, easy to implement (the modal becomes a mini /jobs page). Cons: more event traffic over the wire (the modal sees every job event in the system, not just children of the active umbrella); the modal is no longer a single-stream "tail one job" UI.

**B. Modal opens per-child SSE streams as children become known.** When the umbrella's SSE delivers a Step ID via the existing `[SEQUENCE]` lines (or the upcoming sequence-runner events), open `/jobs/<childId>/logs` for that step. Reuses the existing per-step infrastructure. Cons: requires knowing child ids — currently buried in the parent's log lines. Either parse from text (fragile) or extend the runner to emit a structured `{type: 'step-started', childId}` event on the umbrella subject (cleaner; small server change).

**C. Server-side aggregator** that re-emits the currently-running child's progress on the umbrella subject. Implementation: when a child of an umbrella job emits a progress event, also push it to the umbrella's subject (with maybe a `forChildJobId` field added to ProgressEvent). Pros: modal stays a simple single-stream consumer. Cons: server-side complexity; potential event-storm if multiple children run in parallel (shouldn't happen with sequential sequenceRunner, but the door is open).

**Recommendation**: **B with server help**. Add a structured event to the umbrella subject when a child transitions to running:

```ts
// in src/api/types.ts, alongside ProgressEvent:
export type StepEvent = {
  type: "step-started" | "step-finished"
  childJobId: string
  stepId: string | null
  status: JobStatus
}
```

Emit from `runSequenceJob` ([src/api/sequenceRunner.ts](../src/api/sequenceRunner.ts)) right where it currently logs `Step ${stepId} (${step.command}): starting.` — emit a structured event in addition. Then the modal:

1. Tracks `currentChildJobId` from the umbrella stream.
2. When it changes, closes any prior per-child SSE and opens a new one to `/jobs/${currentChildJobId}/logs`.
3. Renders the new ProgressEvent payload below the existing log pane (use the same paint logic from the `/jobs` page — there's reusable code in `paintProgressBar` / `mergeProgress`).

### UI considerations

- The modal already shows the umbrella's status badge + log pane. Add a thin progress bar above the log pane (between the header and the `<pre>`).
- Sub-line: `Step 12/50 — episode-13.mkv (42%) — overall 24%` if both rollup and per-file data are present.
- When no step is running (between steps or before/after the run), hide the bar.
- Match the bar styling from [public/api/index.html](../public/api/index.html) (`.progress-bar`, `.progress-fill`, `.progress-label`). Consider extracting those classes into a shared stylesheet if the builder doesn't already share styles with /jobs.

### Coordination note

The builder UI is undergoing a parallel refactor (split into modules under [public/api/builder/js/](../public/api/builder/js/)). Coordinate before touching `tailApiRunLogs` — it may have moved or been refactored further. The structured-event server change in `runSequenceJob` is independent and can land first without blocking on the UI work.

### Effort

- Server type + emit: 30 min.
- Modal wiring: ~2 hours, maybe more if the builder refactor is mid-flight.
- Tests: integration test for `runSequenceJob` emitting `step-started` events.

---

## Verification when picking up either follow-up

After each commit (per AGENTS.md "commit as you go"):

1. `yarn typecheck` clean.
2. `yarn test --run` green (currently 372 tests on vitest v4).
3. Manual: hit a known-multi-file command via `/builder` "Run via API"; watch `/jobs` to see per-step bars (Phase 5 already wired). For Follow-up 2, also watch the modal itself.

---

## Quick architectural recap (for cold-start context)

- `Subject<string | PromptEvent | ProgressEvent>` is the per-job SSE channel ([src/api/jobStore.ts](../src/api/jobStore.ts)).
- `logRoutes.ts` ([src/api/routes/logRoutes.ts](../src/api/routes/logRoutes.ts)) pass-through serializes any non-string event — no transport changes needed for new event types riding the same channel.
- `getActiveJobId()` from `AsyncLocalStorage` ([src/api/logCapture.ts](../src/api/logCapture.ts)) is how emitter callers find their job id without explicit threading.
- Throttle policy in `createProgressEmitter`: deferred-first-emit (skip if job <1s) + 1 Hz max + no final 100% (status flip is the natural "done" signal).
- Trivially-fast jobs emit nothing → no UI bar at all; that's by design.
