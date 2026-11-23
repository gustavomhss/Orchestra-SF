import { expect, test } from "@playwright/test"
import {
  captureSharedState,
  setupSharedVisual,
  sharedBoardTitle,
  sharedInboxItems,
  sharedVisualVariants,
} from "./shared-visual.fixture"

test.use({ serviceWorkers: "block" })
test.describe.configure({ retries: 0 })

// These are production component visuals, with explicitly intercepted read APIs.
// They complement the native installed journeys and do not qualify provider auth,
// Maestro execution, retrieval accuracy, desktop capture, or destructive writes.
for (const variant of sharedVisualVariants) {
  test(variant.name + ": Inbox list, detail, preferences, empty and failed read", async ({ page }, info) => {
    const state = await setupSharedVisual(page, variant)
    await page.goto("/orchestra/inbox")
    const inbox = page.locator('[data-mx-page="inbox"]')
    await expect(inbox.getByRole("heading", { name: "Inbox", exact: true })).toBeVisible()
    await expect(inbox.locator(".inbox-workspace")).toHaveAttribute("aria-busy", "false")
    await expect(inbox.locator("button.inbox-row")).toHaveCount(sharedInboxItems.length)
    await expect(inbox.locator(".inbox-preview-note")).toHaveCount(0)
    await captureSharedState(page, info, variant, state, "inbox", "synthetic-source-list",
      "Existing fixture messages entered through the GET wire schema. No real account, acquisition, send or handoff.")

    const row = inbox.locator("button.inbox-row").filter({ hasText: "Maya Chen" })
    await expect(row).toHaveCount(1)
    await row.click()
    const detail = inbox.getByRole("region", { name: "Maya Chen", exact: true })
    await expect(detail.getByRole("heading", { name: "Maya Chen", exact: true })).toBeVisible()
    await expect(detail.locator(".inbox-message")).toHaveText(sharedInboxItems.find((item) => item.actor === "Maya Chen")!.snippet)
    await captureSharedState(page, info, variant, state, "inbox", "selected-source-detail",
      "Read-only selection of the existing synthetic Teams example. No Microsoft identity or live Teams qualification.")

    await inbox.getByRole("button", { name: "Customize", exact: true }).click()
    const preferences = page.getByRole("dialog", { name: "Customize", exact: true })
    await expect(preferences.getByRole("switch", { name: "Compact rows", exact: true })).toHaveAttribute("aria-checked", "false")
    await expect(preferences.getByRole("switch", { name: "Show message previews", exact: true })).toHaveAttribute("aria-checked", "true")
    await expect(preferences.getByRole("combobox", { name: "Preferred next move", exact: true })).toBeEnabled()
    await captureSharedState(page, info, variant, state, "inbox", "preferences",
      "Original presentation preferences dialog; no setting was changed and no account was connected.")
    await preferences.getByRole("button", { name: "Done", exact: true }).click()
    await expect(preferences).toHaveCount(0)

    state.inbox = "empty"
    await page.reload()
    await expect(inbox.locator(".inbox-workspace")).toHaveAttribute("aria-busy", "false")
    await expect(inbox.getByRole("heading", { name: "A little breathing room.", exact: true })).toBeVisible()
    await expect(inbox.locator("button.inbox-row")).toHaveCount(0)
    await captureSharedState(page, info, variant, state, "inbox", "empty",
      "Explicit empty read response, not an unavailable account represented as empty.")

    state.inbox = "error"
    await inbox.getByRole("button", { name: "Refresh inbox", exact: true }).click()
    await expect(inbox.getByRole("alert")).toContainText("Your inbox couldn't be loaded.")
    await expect(inbox.getByRole("button", { name: "Try again", exact: true })).toBeEnabled()
    await expect(inbox.getByRole("heading", { name: "A little breathing room.", exact: true })).toHaveCount(0)
    await captureSharedState(page, info, variant, state, "inbox", "read-unavailable",
      "HTTP 503 negative control. Acquisition and provider authentication remain outside this visual fixture.")
  })

  test(variant.name + ": Flight Engineer reports the real web platform limit", async ({ page }, info) => {
    const state = await setupSharedVisual(page, variant)
    await page.goto("/orchestra/flight-engineer")
    const flight = page.locator('[data-mx-page="flight-engineer"]')
    await expect(flight.getByRole("heading", { name: "Flight Engineer", exact: true })).toBeVisible()
    await expect(flight.getByText("Flight Engineer runs in the desktop app.", { exact: true })).toBeVisible()
    await expect(flight.getByRole("navigation", { name: "Flight Engineer", exact: true })).toHaveCount(0)
    await captureSharedState(page, info, variant, state, "flight-engineer", "web-unavailable",
      "No liveSeat or development bridge is injected. Meeting, consent, recordings and settings require an actual desktop seat and are not captured here.")
  })

  test(variant.name + ": Integrations empty accounts, connect dialog and denied read", async ({ page }, info) => {
    const state = await setupSharedVisual(page, variant)
    await page.goto("/orchestra/integrations")
    const integrations = page.locator('[data-mx-page="orchestra-integrations"]')
    await expect(integrations.getByRole("heading", { name: "Integrations", exact: true })).toBeVisible()
    await expect(integrations.getByText("No accounts are configured for this project.", { exact: true })).toBeVisible()
    const connect = integrations.getByRole("button", { name: "Connect account", exact: true })
    await expect(connect).toBeEnabled()
    await captureSharedState(page, info, variant, state, "integrations", "empty-accounts",
      "Mocked ConnectionPage with the required coverage wire literal; this is not a live-provider or authorization receipt.")

    await connect.click()
    const dialog = page.getByRole("dialog", { name: "Connect account", exact: true })
    await expect(dialog.getByRole("combobox", { name: "Provider", exact: true })).toBeEnabled()
    await expect(dialog.getByLabel("Access token", { exact: true })).toHaveValue("")
    await expect(dialog.getByLabel("Access token", { exact: true })).toHaveAttribute("type", "password")
    await expect(dialog.getByLabel("Account label", { exact: true })).toHaveValue("")
    await expect(dialog.locator("select[name=provider] option:disabled")).toHaveCount(6)
    await captureSharedState(page, info, variant, state, "integrations", "connect-account-dialog",
      "Empty original account form and its unavailable OAuth providers. No token was entered or submitted.")
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click()
    await expect(dialog).toHaveCount(0)

    state.connections = "denied"
    await integrations.getByRole("button", { name: "Refresh", exact: true }).click()
    await expect(integrations.getByRole("alert")).toContainText("Host authorization is required or no longer permits this request.")
    await expect(integrations.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled()
    await captureSharedState(page, info, variant, state, "integrations", "denied-read",
      "HTTP 403 authorization negative control at the read boundary. No grant or bearer was fabricated.")
  })

  test(variant.name + ": Rag Studio empty files, declared pipeline and unavailable read", async ({ page }, info) => {
    const state = await setupSharedVisual(page, variant)
    await page.goto("/orchestra/rag-studio")
    const studio = page.locator('[data-mx-page="rag-studio"]')
    await expect(studio.getByRole("heading", { name: "Rag Studio", exact: true })).toBeVisible()
    const files = studio.locator("section").filter({ has: page.getByRole("heading", { name: "Files", exact: true }) })
    const maintain = studio.locator("section").filter({ has: page.getByRole("heading", { name: "Maintain", exact: true }) })
    await expect(files).toHaveCount(1)
    await expect(maintain).toHaveCount(1)
    await expect(files.getByText("No admitted files.", { exact: true })).toBeVisible()
    await expect(maintain.getByText("No admitted files.", { exact: true })).toBeVisible()
    await expect(studio.getByRole("heading", { name: "Pipeline", exact: true })).toBeVisible()
    await expect(studio.getByRole("button", { name: "Whole document", exact: true })).toHaveAttribute("aria-pressed", "true")
    await expect(studio.getByRole("button", { name: "Admit", exact: true })).toBeDisabled()
    await expect(studio.getByRole("button", { name: "Ask", exact: true })).toBeDisabled()
    await expect(studio.getByText("Embedding is off.", { exact: true })).toBeVisible()
    await captureSharedState(page, info, variant, state, "rag-studio", "empty-files-declared-pipeline",
      "Schema-decoded synthetic pipeline matches the component's initial values. No file admission, model, retrieval, vectors or question execution is claimed.")
    await studio.getByRole("heading", { name: "Pipeline", exact: true }).scrollIntoViewIfNeeded()
    await captureSharedState(page, info, variant, state, "rag-studio", "pipeline-controls",
      "Original lower-page pipeline controls after scrolling. No field change or pipeline mutation.")

    state.rag = "error"
    await page.reload()
    await expect(studio.getByRole("alert").filter({ hasText: "Could not load Rag Studio." })).toHaveCount(2)
    await expect(studio.getByText("Embedding is off.", { exact: true })).toHaveCount(0)
    await expect(studio.getByRole("heading", { name: "Pipeline", exact: true })).toHaveCount(0)
    await captureSharedState(page, info, variant, state, "rag-studio", "source-and-pipeline-unavailable",
      "Both reads return HTTP 503. The UI must not turn unknown pipeline state into a known embedding-off claim.")
  })

  test(variant.name + ": Project Board overview, board, issue panel, empty and read failure", async ({ page }, info) => {
    const state = await setupSharedVisual(page, variant)
    await page.goto("/orchestra/board")
    const board = page.locator(".board-root")
    await expect(board.getByRole("heading", { name: "Project Board", exact: true })).toBeVisible()
    const project = board.locator('.board-overview-row[data-key="LCH"]')
    await expect(project).toHaveCount(1)
    await expect(project).toContainText("Ship the first public build")
    await captureSharedState(page, info, variant, state, "project-board", "synthetic-project-overview",
      "Schema-decoded Launch example from board.test.ts. Forecast explicitly has insufficient observations; no live work or delivery is claimed.")

    await project.locator("button.board-overview-title").click()
    await expect(board.getByRole("heading", { name: "Launch", exact: true })).toBeVisible()
    const columns = board.getByRole("group", { name: "Board columns", exact: true })
    const card = columns.getByRole("region", { name: "Backlog", exact: true }).locator('button[data-ref="LCH-1"]')
    await expect(card).toHaveCount(1)
    await expect(card).toHaveAttribute("data-stage", "backlog")
    await expect(card).toContainText(sharedBoardTitle)
    await expect(columns.getByRole("region", { name: "Building", exact: true }).locator('button[data-ref="LCH-3"]')).toContainText("wiring the routes")
    await columns.scrollIntoViewIfNeeded()
    await captureSharedState(page, info, variant, state, "project-board", "synthetic-stage-board",
      "Original production board with existing synthetic cards. Spend and proof reads are explicitly unavailable, never replaced with invented dollars or CI evidence.")

    await card.click()
    const detail = board.getByRole("dialog", { name: sharedBoardTitle, exact: true })
    await expect(detail.getByRole("heading", { name: sharedBoardTitle, exact: true })).toBeVisible()
    await expect(detail.getByText("GitHub not synced", { exact: true })).toBeVisible()
    await expect(detail.getByRole("button", { name: "Open full page", exact: true })).toBeEnabled()
    await captureSharedState(page, info, variant, state, "project-board", "issue-detail-panel",
      "Original issue peek for the exact LCH-1 fixture card, with signed-out git provenance. No note, secret, attachment, pause or hold write.")
    await detail.getByRole("button", { name: "Close", exact: true }).click()
    await expect(detail).toHaveCount(0)

    state.board = "empty"
    await page.reload()
    await expect(board.getByText("No projects yet", { exact: true })).toBeVisible()
    await expect(board.locator(".board-overview-row")).toHaveCount(0)
    await captureSharedState(page, info, variant, state, "project-board", "empty",
      "Explicit empty project list. The empty state is not used for a failed read.")
    state.board = "error"
    await page.reload()
    await expect(board.getByText("Could not load projects.", { exact: true })).toBeVisible()
    await expect(board.getByRole("button", { name: "Retry", exact: true })).toBeEnabled()
    await expect(board.getByText("No projects yet", { exact: true })).toHaveCount(0)
    await captureSharedState(page, info, variant, state, "project-board", "read-unavailable",
      "HTTP 503 project-list failure. Stage transitions, decisions and execution are outside this component visual.")
  })

  test(variant.name + ": Search command results and empty overlay", async ({ page }, info) => {
    const state = await setupSharedVisual(page, variant)
    state.inbox = "empty"
    await page.goto("/orchestra/inbox")
    await expect(page.getByRole("heading", { name: "A little breathing room.", exact: true })).toBeVisible()
    await page.keyboard.press("ControlOrMeta+k")
    const palette = page.locator(".command-palette-v2")
    const input = palette.getByRole("combobox", { name: "Search commands and sessions", exact: true })
    await expect(input).toBeFocused()
    const results = palette.getByRole("listbox")
    await expect(results).toBeVisible()
    await expect(input).toHaveAttribute("aria-expanded", "true")
    await expect(input).toHaveAttribute("aria-controls", (await results.getAttribute("id"))!)
    expect(await results.getByRole("option").count()).toBeGreaterThan(0)
    await captureSharedState(page, info, variant, state, "search", "command-results-overlay",
      "Actual registered production command results; the fixture has no sessions. Session search and execution are not claimed.")

    await input.fill("zzzz-no-such-command")
    await expect(palette.getByRole("status")).toHaveText("No results found")
    await expect(palette.getByRole("listbox")).toHaveCount(0)
    await expect(input).toHaveAttribute("aria-expanded", "false")
    await captureSharedState(page, info, variant, state, "search", "no-results-overlay",
      "Original empty-search live region and combobox state. No command was executed.")
  })

  test(variant.name + ": Server connection form preserves a linked recovery error", async ({ page }, info) => {
    const state = await setupSharedVisual(page, variant)
    await page.route("https://unreachable.test/**", (route) =>
      route.fulfill({ json: { healthy: false }, headers: { "access-control-allow-origin": "*" } }))
    await page.goto("/orchestra/settings?section=servers")
    await page.getByRole("button", { name: "Add server", exact: true }).click()
    const dialog = page.getByRole("dialog", { name: "Add server", exact: true })
    const address = dialog.getByLabel("Server address", { exact: true })
    await expect(address).toBeEditable()
    await expect(dialog.getByLabel("Username (optional)", { exact: true })).toBeEditable()
    await expect(dialog.getByLabel("Password (optional)", { exact: true })).toBeEditable()
    await captureSharedState(page, info, variant, state, "error-recovery", "server-connection-form",
      "Original Settings server dialog from desktop-connection-recovery.spec.ts. The global fatal ErrorPage and desktop restart/export-logs remain uncaptured.")

    await address.fill("https://unreachable.test")
    await dialog.getByLabel("Server name (optional)", { exact: true }).fill("Unreachable")
    await dialog.getByRole("button", { name: "Add server", exact: true }).click()
    await expect(dialog.getByRole("alert")).toHaveText("Could not connect to server")
    await expect(address).toHaveAttribute("aria-invalid", "true")
    await expect(address).toHaveAccessibleDescription("Could not connect to server")
    await captureSharedState(page, info, variant, state, "error-recovery", "server-health-failure",
      "Explicit unreachable health reply, original validation and recovery dialog. No authenticated server was added and no global fatal-boundary coverage is claimed.")
  })
}
