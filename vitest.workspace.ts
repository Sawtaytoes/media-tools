import { defineWorkspace } from "vitest/config"

// Two-project workspace:
//
//   - "node":    existing server-side / pure-logic tests under src/.
//                Inherits the memfs setup from vitest.config.ts so any
//                fs-touching code keeps a clean in-memory volume.
//
//   - "browser": ES module component tests under public/api/builder/js/.
//                Runs in a real Chromium via @vitest/browser + Playwright
//                provider — gives us actual DOM/event semantics with no
//                jsdom in the dep tree. Skips the node-only memfs setup.
export default defineWorkspace([
  {
    extends: "./vitest.config.ts",
    test: {
      name: "node",
      include: ["src/**/*.test.ts"],
      setupFiles: ["./vitest.setup.ts"],
    },
  },
  {
    extends: "./vitest.config.ts",
    test: {
      name: "browser",
      include: ["public/**/*.test.{js,ts}"],
      browser: {
        enabled: true,
        provider: "playwright",
        name: "chromium",
        headless: true,
      },
    },
  },
])
