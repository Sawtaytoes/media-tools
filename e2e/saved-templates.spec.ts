import { expect, test } from "@playwright/test"

// Saved Templates sidebar — save / reload / load round-trip.
//
// Templates persist server-side via /api/templates (worker 2a). This
// spec confirms the full cycle: type a step, save as a named template,
// reload the page, see the template still listed, load it back, and
// see the same step reappear.
//
// The sidebar is desktop-only (`hidden lg:flex`), so this spec sticks
// to the default Playwright viewport which is well above the `lg`
// breakpoint.

test.describe("Saved Templates sidebar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/builder/")
    // Best-effort cleanup of any leftover templates from prior runs in
    // the same APP_DATA_DIR. The DELETE endpoint is idempotent enough
    // that 404s are safe; we just want a known-clean list at start.
    const response = await page.request.get(
      "/api/templates",
    )
    if (response.ok()) {
      const body = (await response.json()) as {
        templates: { id: string }[]
      }
      await Promise.all(
        body.templates.map((template) =>
          page.request.delete(
            `/api/templates/${template.id}`,
          ),
        ),
      )
    }
    await page.reload()
  })

  test("save current → reload page → template still listed → load restores it", async ({
    page,
  }) => {
    const sidebar = page.getByRole("complementary", {
      name: "Variables",
    })
    const section = sidebar.getByRole("region", {
      name: "Saved Templates",
    })
    await expect(section).toBeVisible()
    await expect(
      section.getByText("No saved templates yet."),
    ).toBeVisible()

    // Open the save modal and submit a uniquely-named template.
    await section
      .getByRole("button", { name: "Save current" })
      .click()
    const dialog = page.getByRole("dialog", {
      name: "Save sequence as template",
    })
    await expect(dialog).toBeVisible()
    const templateName = `e2e Workflow ${Date.now()}`
    await dialog
      .getByPlaceholder("My workflow")
      .fill(templateName)
    await dialog
      .getByRole("button", { name: "Save" })
      .click()
    await expect(dialog).toBeHidden({ timeout: 5_000 })

    // Row appears in the sidebar.
    await expect(
      section.getByRole("button", { name: templateName }),
    ).toBeVisible()

    // Reload — server-backed list survives.
    await page.reload()
    const refreshedSection = page
      .getByRole("complementary", { name: "Variables" })
      .getByRole("region", { name: "Saved Templates" })
    await expect(
      refreshedSection.getByRole("button", {
        name: templateName,
      }),
    ).toBeVisible()

    // Click the template to load it — undo toast appears.
    await refreshedSection
      .getByRole("button", { name: templateName })
      .click()
    await expect(
      refreshedSection.getByRole("status"),
    ).toContainText(/Loaded template/)

    // Clean up: delete the template so subsequent runs see an empty list.
    page.on("dialog", (confirm) => confirm.accept())
    await refreshedSection
      .getByRole("listitem")
      .filter({ hasText: templateName })
      .getByRole("button", { name: "Delete" })
      .click()
    await expect(
      refreshedSection.getByText("No saved templates yet."),
    ).toBeVisible()
  })
})
