import { readdir, stat } from "node:fs/promises"
import { dirname } from "node:path"
import {
  from,
  type Observable,
} from "rxjs"

export type DirectoryEntry = {
  isDirectory: boolean
  name: string
}

// One-shot directory listing for the path-field typeahead.
//
// If `path` is a file, lists its parent directory instead — the typeahead
// flow expects siblings of a partially-typed file path to surface.
// Errors (path missing, permission denied, etc.) propagate so the calling
// route can package them into the response's optional `error` field.
export const listDirectoryEntries = (
  path: string,
): Observable<DirectoryEntry[]> => (
  from((async () => {
    let lookupPath = path
    try {
      const stats = await stat(path)
      if (!stats.isDirectory()) {
        lookupPath = dirname(path)
      }
    } catch {
      // Path doesn't exist as-is; let readdir below decide whether the
      // parent works (and surface the actual error message if not).
      lookupPath = dirname(path)
    }

    const entries = await readdir(lookupPath, { withFileTypes: true })
    return entries.map((entry) => ({
      isDirectory: entry.isDirectory(),
      name: entry.name,
    }))
  })())
)
