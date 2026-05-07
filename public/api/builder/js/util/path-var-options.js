import { getPaths } from '../state.js'

// Shared text formatter for path-variable <option> labels. The path
// value is the headline (so it matches what the linked Source Path
// resolves to); the user-friendly label rides as a parenthetical
// annotation only when it adds information. The same formula renders
// the path-link <select> in step cards.
export function pathVarOptionText(pv) {
  const display = pv.value || pv.label || '(unset)'
  const annotation = pv.value && pv.label ? ` (${pv.label})` : ''
  return `${display}${annotation}`
}

// Step cards bake their path-link <select> options into HTML at render
// time. Editing a path's label or value rewrites those option labels in
// place — re-rendering the whole UI would steal focus from the input
// the user is typing into.
export function refreshPathVarOptions() {
  const pvById = Object.fromEntries(getPaths().map((pv) => [pv.id, pv]))
  for (const select of document.querySelectorAll('select[data-path-link]')) {
    for (const option of select.querySelectorAll('option[data-pv-id]')) {
      const pv = pvById[option.dataset.pvId]
      if (pv) option.textContent = pathVarOptionText(pv)
    }
  }
}
