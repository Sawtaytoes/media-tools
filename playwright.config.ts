import { defineConfig, devices } from "@playwright/test"

// E2E tests against the builder UI. The api-server boots an HTTP server
// on PORT 3000 (or whatever PORT env says), serves /api/builder/index.html
// from public/, and exposes /commands/* + /queries/*. Playwright drives
// it through Chromium.
//
// To run interactively: `yarn e2e:ui`. CI / one-shot: `yarn e2e`.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Boots the api-server before tests run; reuses an existing server in
  // dev so re-running locally is fast (no cold-start penalty).
  webServer: {
    command: "yarn api-server",
    url: "http://localhost:3000/builder/",
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "pipe",
    timeout: 30 * 1000,
  },
})
