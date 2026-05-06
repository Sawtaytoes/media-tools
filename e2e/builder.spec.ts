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

  test("Add Path creates a new path-variable card whose value lands in the YAML", async ({ page }) => {
    await page.getByRole("button", { name: "Add Path" }).click()

    // Two path-var cards exist now: Base Path + Path 1.
    const pathVarCards = page.locator("[data-path-var]")
    await expect(pathVarCards).toHaveCount(2)

    // Fill the new card's value input — last input is the value (label is first).
    const newPathValueInput = pathVarCards.nth(1).locator('input').last()
    await newPathValueInput.fill("/data/anime")
    await newPathValueInput.blur()

    // YAML modal should reflect the new path's value.
    await page.getByRole("button", { name: "View YAML" }).click()
    await expect(page.locator("#yaml-out")).toContainText("/data/anime")
  })

  test("step reorder via the up arrow swaps adjacent steps", async ({ page }) => {
    // Two distinct steps so we can tell them apart by command name.
    await page.getByRole("button", { name: "Add Step" }).click()
    await page.getByText("— pick a command —").click()
    await page.getByPlaceholder("Search commands…").fill("copyFiles")
    await page.getByRole("button", { name: /^copyFiles\s/ }).click()

    await page.getByRole("button", { name: "Add Step" }).click()
    await page.getByText("— pick a command —").click()
    await page.getByPlaceholder("Search commands…").fill("moveFiles")
    await page.getByRole("button", { name: /^moveFiles\s/ }).click()

    // Order is now [copyFiles, moveFiles]. Move moveFiles up via its ↑.
    const stepCards = page.locator('[id^="step-"]')
    await expect(stepCards).toHaveCount(2)
    await stepCards.nth(1).getByRole("button", { name: "↑" }).click()

    // First card should now be moveFiles.
    await expect(stepCards.nth(0)).toContainText("moveFiles")
    await expect(stepCards.nth(1)).toContainText("copyFiles")
  })

  test("step delete via ✕ removes the card after the leave animation", async ({ page }) => {
    await page.getByRole("button", { name: "Add Step" }).click()
    const stepCards = page.locator('[id^="step-"]')
    await expect(stepCards).toHaveCount(1)

    await stepCards.first().getByRole("button", { name: "✕" }).click()

    // The fade-out runs for 200ms before the splice; the empty-state hint
    // returns once the card is gone. Default toBeVisible timeout (5s)
    // covers the animation comfortably.
    await expect(page.getByText(/No steps yet/)).toBeVisible()
    await expect(stepCards).toHaveCount(0)
  })

  test("(+) Add divider inserts an empty step at the chosen position", async ({ page }) => {
    // Two steps with distinct commands.
    await page.getByRole("button", { name: "Add Step" }).click()
    await page.getByText("— pick a command —").click()
    await page.getByPlaceholder("Search commands…").fill("copyFiles")
    await page.getByRole("button", { name: /^copyFiles\s/ }).click()

    await page.getByRole("button", { name: "Add Step" }).click()
    await page.getByText("— pick a command —").click()
    await page.getByPlaceholder("Search commands…").fill("moveFiles")
    await page.getByRole("button", { name: /^moveFiles\s/ }).click()

    // Click the FIRST inline (+) Add divider — the one between the two steps.
    await page.getByRole("button", { name: "➕ Add" }).first().click()

    // Three step cards now, middle one empty.
    const stepCards = page.locator('[id^="step-"]')
    await expect(stepCards).toHaveCount(3)
    await expect(stepCards.nth(0)).toContainText("copyFiles")
    await expect(stepCards.nth(1)).toContainText("— pick a command —")
    await expect(stepCards.nth(2)).toContainText("moveFiles")
  })

  test("typing a path into a step field auto-promotes it to a path variable on commit", async ({ page }) => {
    await page.getByRole("button", { name: "Add Step" }).click()
    await page.getByText("— pick a command —").click()
    await page.getByPlaceholder("Search commands…").fill("copyFiles")
    await page.getByRole("button", { name: /^copyFiles\s/ }).click()

    // destinationPath has no auto-link (only the main source field does), so
    // its manual input is visible and ready to take typed input.
    const destinationPathInput = page.locator('input[data-field="destinationPath"].manual-input').first()
    await destinationPathInput.fill("/data/output")
    // Blur fires onchange → promotePathToPathVar.
    await destinationPathInput.blur()

    // Two path-var cards now: the original Base Path + the auto-created one
    // holding "/data/output". The new card's input shows that value.
    const pathVarCards = page.locator("[data-path-var]")
    await expect(pathVarCards).toHaveCount(2)
    await expect(pathVarCards.nth(1).locator('input[type="text"]').last()).toHaveValue("/data/output")
  })

  test("the URL captures sequence state and is restored on reload", async ({ page }) => {
    await page.getByRole("button", { name: "Add Step" }).click()
    await page.getByText("— pick a command —").click()
    await page.getByPlaceholder("Search commands…").fill("copyFiles")
    await page.getByRole("button", { name: /^copyFiles\s/ }).click()

    // After picking a command, renderAll runs synchronously and updateUrl
    // writes the ?seq= param. Verify the param is present, then reload.
    await expect(page).toHaveURL(/\?seq=/)
    await page.reload()

    // Same step survives the round-trip via the URL state.
    await expect(page.locator('[id^="step-"]')).toHaveCount(1)
    await expect(page.locator('[id^="step-"]').first()).toContainText("copyFiles")
  })

  test("Run via API posts the YAML to /sequences/run, opens the modal, and reflects the umbrella job's status", async ({ page }) => {
    // Stub the POST so the test doesn't need a real subscriber filesystem.
    await page.route("**/sequences/run", async (route) => {
      const request = route.request()
      const body = JSON.parse(request.postData() ?? "{}")
      // Confirm the YAML actually shipped: we're testing that the button
      // wires the current builder state into the request body.
      expect(typeof body.yaml).toBe("string")
      expect(body.yaml).toContain("command: copyFiles")
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({ jobId: "test-umbrella-id", logsUrl: "/jobs/test-umbrella-id/logs" }),
      })
    })

    // Stub the SSE stream — emit one log line, then a done event.
    await page.route("**/jobs/test-umbrella-id/logs", async (route) => {
      const sseBody = [
        `data: ${JSON.stringify({ line: "[SEQUENCE] Step copy: starting." })}\n\n`,
        `data: ${JSON.stringify({ line: "[SEQUENCE] Step copy: completed." })}\n\n`,
        `data: ${JSON.stringify({ done: true, status: "completed", results: [], outputs: null })}\n\n`,
      ].join("")
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: { "Cache-Control": "no-cache", "Connection": "keep-alive" },
        body: sseBody,
      })
    })

    // Build a one-step sequence so the YAML body has content to ship.
    await page.getByRole("button", { name: "Add Step" }).click()
    await page.getByText("— pick a command —").click()
    await page.getByPlaceholder("Search commands…").fill("copyFiles")
    await page.getByRole("button", { name: /^copyFiles\s/ }).click()

    await page.getByRole("button", { name: "▶ Run via API" }).click()

    // Modal opens with the umbrella job id surfaced.
    const modal = page.locator("#api-run-modal")
    await expect(modal).toBeVisible()
    await expect(page.locator("#api-run-jobid")).toContainText("test-umbrella-id")

    // Logs land in the panel as the SSE stream replays.
    await expect(page.locator("#api-run-logs")).toContainText("Step copy: starting.")
    await expect(page.locator("#api-run-logs")).toContainText("Step copy: completed.")

    // Status badge flips to completed once the done event arrives.
    await expect(page.locator("#api-run-status")).toHaveText("completed")
  })

  test("auto-linked step-output renders as { linkedTo, output: folder } in the YAML and survives reload", async ({ page }) => {
    // Two consecutive steps — when the second is given a command, its
    // main source field auto-links to the previous step's folder output.
    await page.getByRole("button", { name: "Add Step" }).click()
    await page.getByText("— pick a command —").click()
    await page.getByPlaceholder("Search commands…").fill("copyFiles")
    await page.getByRole("button", { name: /^copyFiles\s/ }).click()

    await page.getByRole("button", { name: "Add Step" }).click()
    await page.getByText("— pick a command —").last().click()
    await page.getByPlaceholder("Search commands…").fill("moveFiles")
    await page.getByRole("button", { name: /^moveFiles\s/ }).click()

    await page.getByRole("button", { name: "View YAML" }).click()

    const modal = page.locator("#yaml-modal")
    await expect(modal).toBeVisible()

    // YAML must include the new object form for the auto-linked second step.
    // Single-line form is what jsyaml.dump produces at flowLevel: 3.
    const yamlText = await modal.locator("#yaml-out").innerText()
    expect(yamlText).toMatch(/linkedTo:\s*step\d+/)
    expect(yamlText).toMatch(/output:\s*folder/)

    // Close the modal and reload — the link must round-trip through the URL.
    await page.keyboard.press("Escape")
    await page.reload()
    await page.getByRole("button", { name: "View YAML" }).click()

    const reloadedYaml = await page.locator("#yaml-modal #yaml-out").innerText()
    expect(reloadedYaml).toMatch(/linkedTo:\s*step\d+/)
    expect(reloadedYaml).toMatch(/output:\s*folder/)
  })
})
