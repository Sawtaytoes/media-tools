import { defineConfig } from "vitest/config"

// Shared base config. Project-specific concerns (setupFiles, browser
// config) live in vitest.workspace.ts so the browser project doesn't
// inherit the node-only memfs setup.
export default defineConfig({
  test: {
    // e2e/ holds Playwright Test specs; they have their own runner (`yarn e2e`)
    // and break under vitest because @playwright/test's describe/test globals
    // aren't compatible.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  }
})
