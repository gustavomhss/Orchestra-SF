import { expect, test } from "@playwright/test"
import { expandAdvanced } from "./compact-navigation.fixture"
import {
  captureSharedState,
  setupSharedVisual,
  sharedBoardTitle,
  sharedInboxItems,
  sharedRagSources,
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
    await expect(inbox.locator(".inbox-idle")).toHaveCount(0)
    await expect(inbox.locator(".inbox-workspace")).toHaveAttribute("data-has-items", "false")
    await captureSharedState(page, info, variant, state, "inbox", "empty",
      "Explicit empty read response, not an unavailable account represented as empty.")

    state.inbox = "error"
    await inbox.getByRole("button", { name: "Refresh inbox", exact: true }).click()
    await expect(inbox.getByRole("alert")).toContainText("Your inbox couldn't be loaded.")
    await expect(inbox.getByRole("button", { name: "Try again", exact: true })).toBeEnabled()
    await expect(inbox.getByRole("heading", { name: "A little breathing room.", exact: true })).toHaveCount(0)
    await expect(inbox.locator(".inbox-idle")).toHaveCount(0)
    await expect(inbox.locator(".inbox-workspace")).toHaveAttribute("data-has-items", "false")
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
    await expect(flight.getByRole("link", { name: "Back to Home", exact: true })).toHaveAttribute("href", "/")
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

    const guidance = integrations.locator("details.integrations-guidance")
    const providers = guidance.locator("summary")
    await expect(guidance).toHaveCount(1)
    await expect(providers).toHaveText("Available providers")
    await expect(guidance).toHaveJSProperty("open", false)
    if (variant.name === "dark-narrow") {
      const bounds = await providers.boundingBox()
      expect(bounds).not.toBeNull()
      expect(bounds!.height).toBeGreaterThanOrEqual(44)
    }
    await providers.click()
    await expect(guidance).toHaveJSProperty("open", true)
    await expect(guidance.locator("p")).toHaveText("Key setup is available for Slack, Discord, Cloudflare, Supabase, Neon, Linear, Stripe, OpenAI, Runway and Globalping. Providers that need browser sign-in are not available yet.")
    await expect(guidance.locator("p")).toBeVisible()
    await captureSharedState(page, info, variant, state, "integrations", "available-providers-guidance",
      "Original native disclosure opened through its summary. Listed key setup and unavailable browser sign-in remain visible guidance, not account connection or live provider qualification.")
    await providers.click()
    await expect(guidance).toHaveJSProperty("open", false)
    await expect(guidance.locator("p")).toBeHidden()

    await connect.click()
    const dialog = page.getByRole("dialog", { name: "Connect account", exact: true })
    if (variant.name === "dark-narrow") {
      const close = dialog.getByRole("button", { name: "Close", exact: true })
      await expect(close).toBeVisible()
      const bounds = await close.boundingBox()
      expect(bounds).not.toBeNull()
      expect(bounds!.width).toBeGreaterThanOrEqual(44)
      expect(bounds!.height).toBeGreaterThanOrEqual(44)
    }
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
    const pipeline = studio.getByRole("heading", { name: "Pipeline", exact: true })
    await pipeline.evaluate((element) => element.scrollIntoView({ block: "start", inline: "nearest" }))
    await expect(pipeline).toBeInViewport()
    await captureSharedState(page, info, variant, state, "rag-studio", "pipeline-controls",
      "Original pipeline starts at the viewport edge so its parser, boundary, tokenizer and word controls can be reviewed. No field change or mutation.")

    const model = studio.getByRole("textbox", { name: "OpenRouter model", exact: true })
    // has is evaluated inside each row; do not include the studio ancestor again.
    const modelRow = maintain.locator(".rag-stage").filter({
      has: page.getByRole("textbox", { name: "OpenRouter model", exact: true }),
    })
    await expect(modelRow).toHaveCount(1)
    await expect(model).toHaveValue("")
    await expect(studio.getByRole("textbox", { name: "Pieces in the block", exact: true })).toHaveValue("4")
    await expect(studio.getByRole("textbox", { name: "Dimension", exact: true })).toHaveValue("0")
    await modelRow.evaluate((element) => element.scrollIntoView({ block: "start", inline: "nearest" }))
    await expect(model).toBeInViewport()
    await captureSharedState(page, info, variant, state, "rag-studio", "pipeline-model-and-metric-controls",
      "Original empty model inputs, zero dimension, number type and metric controls. No model is selected and no pipeline update is sent.")

    const numeric = studio.getByRole("group", { name: "Number type", exact: true })
    const metric = studio.getByRole("group", { name: "Metric", exact: true })
    await expect(numeric.getByRole("button", { name: "Float", exact: true })).toHaveAttribute("aria-pressed", "true")
    await expect(metric.getByRole("button", { name: "Cosine", exact: true })).toHaveAttribute("aria-pressed", "true")
    await numeric.evaluate((element) => element.scrollIntoView({ block: "start", inline: "nearest" }))
    await expect(metric).toBeInViewport()
    await expect(studio.getByText("Off until a model is named", { exact: true })).toBeInViewport()
    await captureSharedState(page, info, variant, state, "rag-studio", "pipeline-numeric-metric-and-fusion",
      "Original Float and Cosine selections and explicit fusion-off condition are visible together. No number type, metric or model is changed.")

    const passes = studio.getByRole("heading", { name: "Passes", exact: true })
    await expect(studio.getByRole("button", { name: "Read again", exact: true })).toBeDisabled()
    await expect(studio.getByRole("button", { name: "Cut again", exact: true })).toBeDisabled()
    await expect(studio.getByRole("button", { name: "Redo numbers", exact: true })).toBeDisabled()
    await expect(studio.getByRole("button", { name: "Compare saved questions", exact: true })).toBeDisabled()
    await passes.evaluate((element) => element.scrollIntoView({ block: "start", inline: "nearest" }))
    await expect(passes).toBeInViewport()
    await captureSharedState(page, info, variant, state, "rag-studio", "maintenance-passes-and-comparison",
      "Original maintenance and comparison controls with an empty corpus; file-dependent passes and comparison remain disabled. No pass or revision command is invoked.")

    const comparison = studio.getByRole("heading", { name: "Compare", exact: true })
    await comparison.evaluate((element) => element.scrollIntoView({ block: "start", inline: "nearest" }))
    await expect(studio.getByRole("button", { name: "Remember this revision", exact: true })).toBeInViewport()
    await expect(studio.getByRole("button", { name: "Compare saved questions", exact: true })).toBeInViewport()
    await expect(studio.getByRole("button", { name: "Compare saved questions", exact: true })).toBeDisabled()
    await captureSharedState(page, info, variant, state, "rag-studio", "revision-comparison-controls",
      "Original comparison instructions and both revision controls are visible. No revision is remembered or compared and no source result is invented.")

    state.rag = "error"
    await page.reload()
    await expect(studio.getByRole("alert")).toHaveCount(1)
    await expect(studio.getByRole("alert")).toContainText("Could not load Rag Studio.")
    await expect(studio.getByRole("button", { name: "Try again", exact: true })).toBeEnabled()
    await expect(studio.getByText("Embedding is off.", { exact: true })).toHaveCount(0)
    await expect(studio.getByRole("heading", { name: "Pipeline", exact: true })).toHaveCount(0)
    await captureSharedState(page, info, variant, state, "rag-studio", "source-and-pipeline-unavailable",
      "Both reads return HTTP 503. One persistent recovery panel names the failed reads; unknown pipeline state never becomes an embedding-off claim.")

    const path = studio.getByRole("textbox", { name: "Path outside the project", exact: true })
    const question = studio.getByRole("textbox", { name: "Sentence", exact: true })
    await path.fill("/work/unsent-document.txt")
    await question.fill("Keep this question while retrying")
    const readsBefore = state.reads.length
    state.rag = "ready"
    const sourceRead = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/rag-studio/sources")
    const pipelineRead = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/rag-studio/pipeline")
    await studio.getByRole("button", { name: "Try again", exact: true }).click()
    await Promise.all([sourceRead, pipelineRead])
    await expect(studio.getByRole("alert")).toHaveCount(0)
    await expect(files.getByRole("heading", { name: "Files", exact: true })).toBeFocused()
    await expect(studio.getByRole("heading", { name: "Pipeline", exact: true })).toBeVisible()
    await expect(studio.getByText("Embedding is off.", { exact: true })).toBeVisible()
    await expect(path).toHaveValue("/work/unsent-document.txt")
    await expect(question).toHaveValue("Keep this question while retrying")
    expect(state.reads.slice(readsBefore).filter((read) => read.startsWith("/api/rag-studio/")).sort()).toEqual([
      "/api/rag-studio/pipeline", "/api/rag-studio/sources",
    ])
    expect(state.writes).toEqual([])
    await captureSharedState(page, info, variant, state, "rag-studio", "local-read-recovery",
      "One click repeats exactly the two failed GETs, preserves both unsent inputs, and restores focus without admission, question execution or pipeline mutation.")
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

}

for (const variant of [
  ...sharedVisualVariants,
  { name: "light-narrow", scheme: "light", width: 390, height: 844 },
  { name: "dark-small", scheme: "dark", width: 320, height: 844 },
  { name: "light-small-short", scheme: "light", width: 320, height: 844 },
] as const) {
  test(variant.name + ": Server connection form preserves a linked recovery error", async ({ page }, info) => {
    const state = await setupSharedVisual(page, variant)
    await page.route("https://unreachable.test/**", (route) =>
      route.fulfill({ json: { healthy: false }, headers: { "access-control-allow-origin": "*" } }))
    await page.goto("/orchestra/settings?section=servers")
    const opener = page.getByRole("button", { name: "Add server", exact: true })
    await opener.click()
    const dialog = page.getByRole("dialog", { name: "Add server", exact: true })
    const address = dialog.getByLabel("Server address", { exact: true })
    await expect(address).toBeEditable()
    await expect(address).toBeFocused()
    await expect(dialog.getByLabel("Username (optional)", { exact: true })).toBeEditable()
    await expect(dialog.getByLabel("Password (optional)", { exact: true })).toBeEditable()

    const assertFrame = async (checkpoint: string) => {
      const geometry = await dialog.evaluate((element) => {
        const container = element.closest<HTMLElement>('[data-slot="dialog-container"]')!
        const box = container.getBoundingClientRect()
        const heading = element.querySelector<HTMLElement>('[data-slot="dialog-header-title"]')!
        return {
          frame: { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width },
          radius: getComputedStyle(container).borderTopLeftRadius,
          warning: getComputedStyle(document.body).getPropertyValue("--orchestra-warning").trim(),
          warm: getComputedStyle(document.body).getPropertyValue("--orchestra-warm").trim(),
          headingSize: getComputedStyle(heading).fontSize,
          clientWidth: element.clientWidth, scrollWidth: element.scrollWidth,
          controls: [...element.querySelectorAll<HTMLElement>("input, button")].map((control) => {
            const rect = control.getBoundingClientRect()
            return { tag: control.tagName, name: control.getAttribute("id") ?? control.textContent,
              left: rect.left, right: rect.right, height: rect.height }
          }),
        }
      })
      await info.attach("server-" + checkpoint + "-" + variant.name + "-geometry", {
        contentType: "application/json", body: JSON.stringify({ variant, geometry }, null, 2),
      })
      expect(Math.abs(geometry.frame.width - Math.min(480, variant.width - 32))).toBeLessThanOrEqual(1)
      expect(geometry.frame.left).toBeGreaterThanOrEqual(15)
      expect(geometry.frame.right).toBeLessThanOrEqual(variant.width - 15)
      expect(geometry.frame.top).toBeGreaterThanOrEqual(15)
      expect(geometry.frame.bottom).toBeLessThanOrEqual(variant.height - 15)
      expect(geometry.radius).toBe("16px")
      expect(geometry.headingSize).toBe("20px")
      expect(geometry.warning).not.toBe("")
      expect(geometry.warning).toBe(geometry.warm)
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1)
      expect(geometry.controls).toHaveLength(6)
      for (const control of geometry.controls) {
        expect(control.left).toBeGreaterThanOrEqual(geometry.frame.left)
        expect(control.right).toBeLessThanOrEqual(geometry.frame.right)
        if (variant.width < 640) expect(control.height).toBeGreaterThanOrEqual(44)
      }
    }

    await expect(address).toBeFocused()
    const geometry = await dialog.evaluate((element) => {
      const frame = element.closest<HTMLElement>('[data-slot="dialog-container"]')!
      const box = frame.getBoundingClientRect()
      const heading = element.querySelector<HTMLElement>('[data-slot="dialog-header-title"]')!
      return {
        left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width,
        radius: getComputedStyle(frame).borderRadius,
        titleSize: Number.parseFloat(getComputedStyle(heading).fontSize),
        buttons: [...element.querySelectorAll<HTMLButtonElement>('[data-slot="dialog-footer"] button')].map((button) => ({
          name: button.textContent, height: button.getBoundingClientRect().height,
        })),
      }
    })
    expect(geometry.width).toBeLessThanOrEqual(480)
    expect(geometry.left).toBeGreaterThanOrEqual(15.5)
    expect(geometry.right).toBeLessThanOrEqual(variant.width - 15.5)
    expect(geometry.top).toBeGreaterThanOrEqual(15.5)
    expect(geometry.bottom).toBeLessThanOrEqual(variant.height - 15.5)
    expect(geometry.titleSize).toBeGreaterThanOrEqual(18)
    expect(geometry.buttons).toHaveLength(2)
    for (const button of geometry.buttons) expect(button.height, button.name ?? "dialog button").toBeGreaterThanOrEqual(44)
    await info.attach("server-dialog-native-geometry", { body: JSON.stringify(geometry, null, 2), contentType: "application/json" })
    await captureSharedState(page, info, variant, state, "error-recovery", "server-connection-form",
      "Original Settings server dialog from desktop-connection-recovery.spec.ts. The global fatal ErrorPage and desktop restart/export-logs remain uncaptured.")
    await assertFrame("ready")
    await address.fill("https://unreachable.test")
    await dialog.getByLabel("Server name (optional)", { exact: true }).fill("Unreachable")
    await dialog.getByRole("button", { name: "Add server", exact: true }).click()
    await expect(dialog.getByRole("alert")).toHaveText("Could not connect to server")
    await expect(address).toHaveAttribute("aria-invalid", "true")
    await expect(address).toHaveAccessibleDescription("Could not connect to server")
    await captureSharedState(page, info, variant, state, "error-recovery", "server-health-failure",
      "Explicit unreachable health reply, original validation and recovery dialog. No authenticated server was added and no global fatal-boundary coverage is claimed.")
    await assertFrame("error")
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
  })
}

test("Rag Studio keeps the latest file when an earlier read completes later", async ({ page }, info) => {
  const variant = sharedVisualVariants[0]
  const state = await setupSharedVisual(page, variant)
  state.ragSources = sharedRagSources
  let releaseFirst = () => {}
  const firstHeld = new Promise<void>((resolve) => { releaseFirst = resolve })
  const firstPath = "/api/rag-studio/sources/visual-cut-a"
  state.ragReadWait = (path) => path === firstPath ? firstHeld : Promise.resolve()
  await page.goto("/orchestra/rag-studio")
  const studio = page.locator('[data-mx-page="rag-studio"]')
  const files = studio.locator("section").filter({ has: page.getByRole("heading", { name: "Files", exact: true }) })
  const first = files.locator(".mx-row").filter({ has: page.getByText("first.txt", { exact: true }) })
  const second = files.locator(".mx-row").filter({ has: page.getByText("second.txt", { exact: true }) })
  await expect(first).toHaveCount(1)
  await expect(second).toHaveCount(1)
  const firstRequest = page.waitForRequest((request) => new URL(request.url()).pathname === firstPath)
  await first.getByRole("button", { name: "Show the cut", exact: true }).click()
  await firstRequest
  await second.getByRole("button", { name: "Show the cut", exact: true }).click()
  await expect(second.getByRole("button", { name: "Show the cut", exact: true })).toHaveAttribute("aria-pressed", "true")
  await expect(files.locator(".rag-follow")).toContainText("Second source original text.")
  const lateResponse = page.waitForResponse((response) => new URL(response.url()).pathname === firstPath)
  releaseFirst()
  await (await lateResponse).finished()
  await expect(files.locator(".rag-follow")).toContainText("Second source original text.")
  await expect(files.locator(".rag-follow")).not.toContainText("First source original text.")
  await expect(second.getByRole("button", { name: "Show the cut", exact: true })).toHaveAttribute("aria-pressed", "true")
  await expect(first.getByRole("button", { name: "Show the cut", exact: true })).toHaveAttribute("aria-pressed", "false")
  expect(state.writes).toEqual([])
  await captureSharedState(page, info, variant, state, "rag-studio", "late-source-keeps-latest-selection",
    "The first synthetic source GET is released only after the second source is rendered. Its later completion cannot replace the selected file or source text. No source mutation.")
})

test("Rag Studio ignores reads from an unmounted page instance", async ({ page }, info) => {
  const variant = sharedVisualVariants[0]
  const state = await setupSharedVisual(page, variant)
  state.rag = "error"
  let releaseOld = () => {}
  const oldHeld = new Promise<void>((resolve) => { releaseOld = resolve })
  state.ragReadWait = () => oldHeld
  const sourceRequest = page.waitForRequest((request) => new URL(request.url()).pathname === "/api/rag-studio/sources")
  const pipelineRequest = page.waitForRequest((request) => new URL(request.url()).pathname === "/api/rag-studio/pipeline")
  await page.goto("/orchestra/rag-studio")
  await Promise.all([sourceRequest, pipelineRequest])
  const studio = page.locator('[data-mx-page="rag-studio"]')
  await expect(studio.getByRole("heading", { name: "Rag Studio", exact: true })).toBeVisible()
  await expandAdvanced(page)
  const sidebar = page.locator('[data-component="orchestra-sidebar"]')
  await sidebar.getByRole("button", { name: "Inbox", exact: true }).click()
  await expect(studio).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Inbox", exact: true })).toBeVisible()
  state.rag = "ready"
  state.ragReadWait = undefined
  await expandAdvanced(page)
  await sidebar.getByRole("button", { name: "Rag Studio", exact: true }).click()
  const files = studio.locator("section").filter({ has: page.getByRole("heading", { name: "Files", exact: true }) })
  await expect(files.getByText("No admitted files.", { exact: true })).toBeVisible()
  await expect(studio.getByRole("heading", { name: "Pipeline", exact: true })).toBeVisible()
  await expect(studio.getByText("Embedding is off.", { exact: true })).toBeVisible()
  const lateSources = page.waitForResponse((response) => response.status() === 503 &&
    new URL(response.url()).pathname === "/api/rag-studio/sources")
  const latePipeline = page.waitForResponse((response) => response.status() === 503 &&
    new URL(response.url()).pathname === "/api/rag-studio/pipeline")
  releaseOld()
  await Promise.all([lateSources, latePipeline].map(async (read) => (await read).finished()))
  await expect(files.getByText("No admitted files.", { exact: true })).toBeVisible()
  await expect(studio.getByRole("heading", { name: "Pipeline", exact: true })).toBeVisible()
  await expect(studio.getByRole("alert")).toHaveCount(0)
  expect(state.writes).toEqual([])
  await captureSharedState(page, info, variant, state, "rag-studio", "late-reads-ignore-unmounted-page",
    "Original SPA navigation unmounts the first page while its two synthetic GETs are held. A new instance reads successfully before both old 503 responses are released; those failures cannot replace its ready state.")
})
