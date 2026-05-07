import { getPaths, getSteps } from '../state.js'

// Helpers still living in the inline <script> in index.html during the
// migration. buildParams reaches into per-step links/defaults, which is
// step-card territory — when step-card is extracted in a later stage,
// this dependency moves with it and the bridge entry goes away.
const bridge = () => window.mediaTools

// ─── YAML serialization ──────────────────────────────────────────────────────

export function toYamlStr() {
  const filledSteps = getSteps().filter((step) => step.command !== null)
  const hasContent = filledSteps.length || getPaths().some((p) => p.value)
  if (!hasContent) return '# No steps yet'
  const pathsObj = {}
  for (const pv of getPaths()) pathsObj[pv.id] = { label: pv.label, value: pv.value }
  const data = {
    paths: pathsObj,
    // Each step ships its stable string ID so { linkedTo: stepN, output: ... }
    // links remain valid across save/load cycles. `alias` is purely cosmetic
    // (builder UI label) — only emitted when the user has set one, so default
    // YAML stays uncluttered.
    steps: filledSteps.map((s) => ({
      id: s.id,
      ...(s.alias ? { alias: s.alias } : {}),
      command: s.command,
      params: bridge().buildParams(s),
    })),
  }
  return window.jsyaml.dump(data, { lineWidth: -1, flowLevel: 3, indent: 2 })
}

// ─── Modal lifecycle ─────────────────────────────────────────────────────────

export function updateYaml() {
  const modal = document.getElementById('yaml-modal')
  if (!modal.classList.contains('hidden')) {
    document.getElementById('yaml-out').textContent = toYamlStr()
  }
}

export function openYamlModal() {
  document.getElementById('yaml-out').textContent = toYamlStr()
  document.getElementById('yaml-modal').classList.remove('hidden')
}

// Closes when called programmatically (event omitted) or when the user
// clicks the modal backdrop. Clicks bubbling up from the inner panel
// won't match the backdrop element so the modal stays open.
export function closeYamlModal(event) {
  if (!event || event.target === document.getElementById('yaml-modal')) {
    document.getElementById('yaml-modal').classList.add('hidden')
  }
}

// ─── Clipboard ───────────────────────────────────────────────────────────────

// Copies the current YAML and flashes both the header icon button (with
// a brief emerald ring) and the modal's "Copy" button (label swap to
// "Copied!"). Either button may be absent depending on which one the
// user clicked from.
export function copyYaml() {
  navigator.clipboard.writeText(toYamlStr()).then(() => {
    const headerBtn = document.getElementById('copy-btn')
    if (headerBtn) {
      headerBtn.classList.add('!text-emerald-400', '!border-emerald-500')
      setTimeout(() => {
        headerBtn.classList.remove('!text-emerald-400', '!border-emerald-500')
      }, 2000)
    }
    const modalBtn = document.getElementById('modal-copy-btn')
    if (modalBtn) {
      const original = modalBtn.textContent
      modalBtn.textContent = 'Copied!'
      setTimeout(() => {
        modalBtn.textContent = original
      }, 2000)
    }
  })
}
