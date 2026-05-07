// Shared state accessors. Stage 1 of the builder refactor still keeps
// the canonical `paths` array (and `steps`, etc.) inside the inline
// <script> in index.html — extracted modules read it through this
// module's getters, which delegate to the window.mediaTools bridge that
// the inline script populates.
//
// As more components migrate, the actual storage moves into this file
// (e.g., `let _paths = []` here, exposed via getPaths/setPaths) and the
// bridge collapses to two-way passthroughs that finally go away.

export function getPaths() {
  return window.mediaTools.paths
}

export function getSteps() {
  return window.mediaTools.steps
}
