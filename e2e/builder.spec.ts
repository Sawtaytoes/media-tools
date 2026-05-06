import { expect, test } from "@playwright/test"

test.describe("Sequence Builder", () => {
  test.beforeEach(async ({ page }) => {
    // Bare URL — no ?seq= param so we always start with a fresh, empty
    // builder regardless of what the previous test left behind.
    await page.goto("/builder/")
  })

  test("renders the header and the empty-state hint", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Sequence Builder" })).toBeVisible()
    // Header actions (button name = the title attr or text content)
    await expect(page.getByRole("button", { name: "Add Step" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Add Path" })).toBeVisible()
    await expect(page.getByRole("button", { name: "▶ Run Sequence" })).toBeVisible()
    // Empty-state copy
    await expect(page.getByText(/No steps yet/)).toBeVisible()
  })

  test("Add Step inserts an empty step card with the command picker", async ({ page }) => {
    await page.getByRole("button", { name: "Add Step" }).click()
    // Empty step's trigger button shows the placeholder label.
    await expect(page.getByText("— pick a command —")).toBeVisible()
    // The hint disappears once a step exists.
    await expect(page.getByText(/No steps yet/)).toBeHidden()
  })

  test("command picker filters by name and selects on click", async ({ page }) => {
    await page.getByRole("button", { name: "Add Step" }).click()
    await page.getByText("— pick a command —").click()

    // Picker appears with focused search input.
    const search = page.getByPlaceholder("Search commands…")
    await expect(search).toBeFocused()

    // Filtering by "copy" should show copyFiles + copyOutSubtitles + flattenOutput's tag... actually only commands whose name OR tag matches "copy".
    await search.fill("copy")
    await expect(page.getByRole("button", { name: /^copyFiles\s/ })).toBeVisible()

    // Click the copyFiles entry → picker closes, step shows the command name.
    await page.getByRole("button", { name: /^copyFiles\s/ }).click()
    await expect(search).toBeHidden()
    // The trigger now shows copyFiles instead of the placeholder.
    await expect(page.getByText("— pick a command —")).toBeHidden()
  })

  test("View YAML icon opens the modal showing the current sequence", async ({ page }) => {
    // Add a step so the YAML has content.
    await page.getByRole("button", { name: "Add Step" }).click()
    await page.getByText("— pick a command —").click()
    await page.getByPlaceholder("Search commands…").fill("copyFiles")
    await page.getByRole("button", { name: /^copyFiles\s/ }).click()

    await page.getByRole("button", { name: "View YAML" }).click()

    const modal = page.locator("#yaml-modal")
    await expect(modal).toBeVisible()
    await expect(modal.locator("#yaml-out")).toContainText("command: copyFiles")
  })

  test("path typeahead pulls from /queries/listDirectoryEntries and completes on click", async ({ page }) => {
    // Stub the directory listing so the test doesn't depend on the host's filesystem.
    await page.route("**/queries/listDirectoryEntries", async (route) => {
      const request = route.request()
      const body = JSON.parse(request.postData() ?? "{}")
      // Server reports its native separator regardless of input; use forward
      // slash so the test is host-agnostic.
      const entries = body.path === "/"
        ? [
            { name: "mnt", isDirectory: true },
            { name: "var", isDirectory: true },
            { name: "tmp", isDirectory: true },
          ]
        : body.path === "/mnt" || body.path === "/mnt/"
        ? [
            { name: "media", isDirectory: true },
            { name: "data", isDirectory: true },
          ]
        : []
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ entries, separator: "/", error: null }),
      })
    })

    // Use the Base Path's value input — a path-variable card always renders
    // a writable input (no auto-link to a step output, no readonly state).
    // Step path fields end up read-only when they auto-link to a path
    // variable on creation, so the manual-input is hidden by default.
    const basePathInput = page.locator('[data-path-var]:first-of-type input[type="text"]:last-of-type')

    await basePathInput.fill("/")
    await expect(page.locator("#path-picker-popover")).toBeVisible()
    await expect(page.getByRole("button", { name: /^📁 mnt$/ })).toBeVisible()

    // Click "mnt" → drill into mnt/, picker reopens for /mnt.
    await page.getByRole("button", { name: /^📁 mnt$/ }).click()
    await expect(basePathInput).toHaveValue("/mnt/")
    await expect(page.getByRole("button", { name: /^📁 media$/ })).toBeVisible()

    // Esc commits the parent directory by stripping the trailing slash.
    await basePathInput.press("Escape")
    await expect(page.locator("#path-picker-popover")).toBeHidden()
    await expect(basePathInput).toHaveValue("/mnt")
  })
})
