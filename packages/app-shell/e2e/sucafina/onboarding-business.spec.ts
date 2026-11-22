import { expect, test } from "@playwright/test"
import { withDesignInstallation } from "./design-support/installation"
import { authenticateRecordingInstallation } from "./design-support/recording-installation"
import { createFilm, type Film } from "./design-support/film-support"
import { waveThreeData } from "./design-support/wave-three-data"
import { waveFourPlannerData } from "./design-support/wave-four-planner-data"
import { waveFourProcurementData } from "./design-support/wave-four-procurement-data"
import { seedWaveFourWork, type WaveFourWorkSeed } from "./design-support/wave-four-work-seed"

test.use({ trace: "off", video: "off", screenshot: "off" })
test.describe.configure({ retries: 0 })

test("record original Planner, same-request Procurement and native source chapters", async ({ browser }, info) => {
  test.setTimeout(1_800_000)
  expect(info.project.metadata.bundle).toBe("production")
  await withDesignInstallation(async (installed) => {
    const context = await browser.newContext({ locale: "en-US", viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1, colorScheme: "dark", reducedMotion: "no-preference",
      httpCredentials: { username: "orchestra", password: installed.serverPassword },
      recordVideo: { dir: info.outputPath("continuous-video"), size: { width: 1920, height: 1080 } } })
    try {
      const owner = await authenticateRecordingInstallation(context, installed, async (value) => {
        await info.attach("business-discovery-" + value.selector, { body: JSON.stringify(value), contentType: "application/json" })
      })
      // This existing seed uses only original authenticated local producers and
      // creates a real self-assigned handoff. It sends no external communication.
      const work = await seedWaveFourWork({ actorId: installed.actorId, request: async (pathname, init) => {
        const headers = new Headers(init?.headers)
        if (init?.method === "POST") headers.set("Origin", installed.origin)
        const response = await context.request.fetch(installed.origin + installed.mount + pathname, {
          method: init?.method ?? "GET", headers: Object.fromEntries(headers),
          ...(typeof init?.body === "string" ? { data: init.body } : {}), timeout: 40_000,
        })
        return new Response(new Uint8Array(await response.body()), { status: response.status(), headers: response.headers() })
      } }, installed.year).catch(async (error: unknown) => {
        await info.attach("business-work-seed-unavailable", { body: JSON.stringify({
          error: error instanceof Error ? error.message.replaceAll(installed.root, "[isolated-installation]").slice(0, 1000) : "unavailable",
        }), contentType: "application/json" })
        return undefined
      })
      const film = await createFilm(context, info, installed, owner, "B-planning-procurement")
      try { await businessChapters(film, work) } finally { await film.finish() }
      expect(film.missingCritical(), "the two actual source workflows must complete and reread their canonical records").toEqual([])
    } finally { await context.close() }
  }, "four")
})

async function businessChapters(film: Film, work: WaveFourWorkSeed | undefined) {
  const page = film.page
  const planner = waveFourPlannerData
  const procurement = waveFourProcurementData
  const review = page.locator('[data-component="sf-change-review"]')
  const state: { requestRef?: string; requestHref?: string; sourcingHref?: string; compareHref?: string; poHref?: string;
    selectedQuote?: string; savedPlanner?: boolean; savedSourcing?: boolean; approvedSourcing?: boolean } = {}
  const positionRow = () => page.locator(".sf-u08-positions tbody tr").filter({
    has: page.getByText(planner.headcount.position, { exact: true }),
  })
  const openPosition = async () => {
    await film.go("/orchestra/sf-planner/headcount?year=" + film.installed.year, "Headcount")
    const surface = page.locator('[data-sf-surface="CAP20"]')
    await film.select(surface.getByLabel("Version", { exact: true }), { label: waveThreeData.planner.version }, "Planning version / Operating plan")
    await film.nativeReady("Headcount")
    await expect(positionRow()).toHaveCount(1)
    await film.click(positionRow().getByRole("button", { name: "Show details", exact: true }), "Open Regional infrastructure engineer")
    const detail = surface.locator("[data-sf-headcount-position]")
    await expect(detail.getByLabel("Name", { exact: true })).toHaveValue(planner.headcount.position)
    return detail
  }
  const requestRow = () => page.locator(".sf-u11-list tr[data-sf-row]").filter({ hasText: procurement.requests.sourcing })
  const sourceStatus = async (expected: string) => {
    if (!state.requestRef) throw new Error("The request reference has not been observed")
    await film.go("/orchestra/sf-procurement/requests", "Requests")
    const row = requestRow()
    await expect(row).toHaveCount(1)
    await expect(row).toHaveAttribute("data-sf-row", state.requestRef)
    await expect(row).toContainText(expected)
    film.proof({ kind: "fresh-procurement-readback", requestRef: state.requestRef, title: procurement.requests.sourcing, status: expected })
    return row
  }

  await film.cue("21-planning-version", async () => {
    await film.go("/orchestra/sf-planner/overview?year=" + film.installed.year, "Overview")
    await dark(film)
    await film.focus(page.getByRole("heading", { level: 1, name: "Overview", exact: true }), "Planner / original operating-plan example")
    await film.pause(3000)
    await film.go("/orchestra/sf-planner/opex?year=" + film.installed.year, "OPEX")
    const version = page.getByLabel("Version", { exact: true })
    await film.select(version, { label: waveThreeData.planner.version }, "Select the original Operating plan")
    await film.nativeReady("OPEX")
    await expect(page.locator('[data-sf-frame="page"]')).toContainText(waveThreeData.planner.opex)
    await film.focus(version, "Version belongs to this original Planner installation")
    film.proof({ kind: "planning-source", version: waveThreeData.planner.version, year: film.installed.year,
      actualExpense: waveThreeData.planner.opex, installationExample: "B" })
  }, true)

  await film.cue("23-headcount-review", async () => {
    const detail = await openPosition()
    await expect(detail.getByLabel("FTE", { exact: true })).toHaveValue("1")
    await film.focus(detail.getByLabel("FTE", { exact: true }), "Original FTE / 1")
    await film.pause(2500)
    await film.input(detail.getByLabel("FTE", { exact: true }), "0.9", "Propose FTE / 0.9", true)
    await film.click(detail.getByRole("button", { name: "Review changes", exact: true }), "Review the proposed staffing change")
    await expect(review).toBeVisible()
    await expect(review).toContainText("0.9")
    await film.focus(review.getByRole("region", { name: "Proposed values", exact: true }), "Proposed staffing values")
    film.proof({ kind: "review-not-save", source: planner.headcount.position, version: waveThreeData.planner.version, originalFte: 1, proposedFte: 0.9 })
  }, true)

  await film.cue("24-headcount-saved", async () => {
    await originalConfirmation(film, "planner", "Review changes", "save")
    await film.go("/orchestra/sf-planner/overview?year=" + film.installed.year, "Overview")
    const detail = await openPosition()
    await expect(detail.getByLabel("FTE", { exact: true })).toHaveValue("0.9")
    await film.focus(detail.getByLabel("FTE", { exact: true }), "Fresh source readback / 0.9 FTE")
    state.savedPlanner = true
    film.proof({ kind: "fresh-planner-readback", source: planner.headcount.position, version: waveThreeData.planner.version,
      fte: 0.9, navigationAwayAndReopen: true })
  }, true)

  await film.cue("25-procurement-request", async () => {
    await film.go("/orchestra/sf-procurement/requests", "Requests")
    const row = requestRow()
    await expect(row).toHaveCount(1)
    const reference = await row.getAttribute("data-sf-row")
    if (!reference) throw new Error("The original request list omitted its reference")
    state.requestRef = reference
    await expect(row).toContainText("sourcing")
    await film.click(row.locator('[data-sf-action="select"]'), "Open the exact regional support request")
    const detail = page.locator(".sf-u11-detail")
    await expect(detail).toContainText(procurement.requests.sourcing)
    await expect(detail).toContainText(reference)
    state.requestHref = page.url()
    const sourcing = detail.getByRole("link", { name: "Sourcing", exact: true })
    const href = await sourcing.getAttribute("href")
    if (!href) throw new Error("The native request omitted its sourcing route")
    state.sourcingHref = new URL(href, film.installed.origin).href
    for (const link of await detail.locator("a[href]").all()) {
      const observed = await link.getAttribute("href")
      if (!observed) continue
      const url = new URL(observed, film.installed.origin)
      if (url.pathname.endsWith("/sourcing/compare")) state.compareHref = url.href
      if (url.pathname.endsWith("/po")) state.poHref = url.href
    }
    await film.focus(detail.getByRole("heading", { level: 2, name: procurement.requests.sourcing, exact: true }), "Request identity retained throughout this example")
    film.proof({ kind: "procurement-source-selected", requestRef: reference, title: procurement.requests.sourcing, status: "sourcing" })
  }, true)

  await film.cue("26-request-change", async () => {
    if (!state.sourcingHref) throw new Error("The request's original sourcing link was not observed")
    await film.go(state.sourcingHref, "Requests")
    const editor = page.locator(".sf-u12-editor")
    await expect(editor.locator(".sf-u12-quote")).toHaveCount(3)
    await expect(editor.locator(".sf-u12-quote").first().getByLabel("Description", { exact: true })).toHaveValue(procurement.description)
    await film.input(editor.getByLabel("Evaluator", { exact: true }), "Design test data · Regional technical assessment", "Record the technical evaluator")
    await film.click(editor.getByRole("button", { name: "Save sourcing", exact: true }), "Review sourcing changes before saving")
    await expect(review).toContainText("Design test data · Regional technical assessment")
    await expect(review).toContainText(state.requestRef!)
    await film.focus(review.getByRole("region", { name: "Proposed values", exact: true }), "Original, current and proposed sourcing values")
    film.proof({ kind: "sourcing-review-not-save", requestRef: state.requestRef, quotations: 3,
      proposedEvaluator: "Design test data · Regional technical assessment" })
  }, true)

  await film.cue("27-sourcing", async () => {
    await originalConfirmation(film, "procurement", "Confirm once", "save", state.requestRef)
    if (!state.sourcingHref) throw new Error("Original sourcing link missing")
    await film.go(state.sourcingHref, "Requests")
    await expect(page.locator(".sf-u12-editor").getByLabel("Evaluator", { exact: true }))
      .toHaveValue("Design test data · Regional technical assessment")
    state.savedSourcing = true
    film.proof({ kind: "fresh-sourcing-readback", requestRef: state.requestRef, evaluator: "Design test data · Regional technical assessment" })
    await film.click(page.locator(".sf-u12-switch").getByRole("button", { name: "Compare quotations", exact: true }), "Compare the same request's recorded quotations")
    const comparison = page.locator(".sf-u12-comparison")
    await expect(comparison.locator("tr[data-sf-row]")).toHaveCount(3)
    // The switch can stay on the sourcing URL. Replace the previously observed
    // native comparison link only if this real click actually changed the route.
    const current = new URL(page.url())
    if (current.origin === film.installed.origin && current.pathname.endsWith("/sourcing/compare"))
      state.compareHref = current.href
    state.selectedQuote = await comparison.locator(":scope > label").getByRole("combobox").inputValue()
    expect(state.selectedQuote).not.toBe("")
    await film.focus(comparison.getByRole("heading", { level: 3 }), "Original quotation comparison and current selection")
    film.proof({ kind: "original-quotation-comparison", requestRef: state.requestRef, selectedQuote: state.selectedQuote,
      displayedRows: await comparison.locator("tr[data-sf-row]").allTextContents() })
  }, true)

  await film.cue("28-purchase-approval", async () => {
    if (!state.savedSourcing || !state.sourcingHref || !state.requestRef) throw new Error("The same sourcing request has not been saved and verified")
    await film.go(state.sourcingHref, "Requests")
    await film.click(page.locator(".sf-u12-editor").getByRole("button", { name: "Submit sourcing", exact: true }), "Review submitting the same sourcing request")
    await expect(review).toContainText(state.requestRef)
    await film.pause(3000)
    await originalConfirmation(film, "procurement", "Confirm once", "submit_sourcing", state.requestRef)
    await sourceStatus("src_pending")
    await film.go("/orchestra/sf-procurement/approvals", "My approvals")
    const approval = page.locator(".sf-u13-remaining-list tr[data-sf-row]").filter({ hasText: procurement.requests.sourcing })
    await expect(approval).toHaveCount(1)
    await expect(approval).toHaveAttribute("data-sf-row", state.requestRef)
    await film.click(approval.locator('[data-sf-action="select"]'), "Open approval for the identical request")
    const detail = page.locator(".sf-u13-remaining-detail")
    await expect(detail).toContainText(procurement.requests.sourcing)
    await expect(detail).toContainText(procurement.suppliers.primary)
    await film.input(detail.getByLabel("Approval comment", { exact: true }), "Design test data · Recorded quotation and technical assessment reviewed.", "Enter the human sourcing review")
    await film.click(detail.getByRole("button", { name: "Approve current step", exact: true }), "Review the sourcing approval")
    await expect(review).toContainText(state.requestRef)
    await film.snap("28-source-bound-approval-review")
    await film.pause(4000)
    await originalConfirmation(film, "procurement", "Confirm once", "approve", state.requestRef)
    const row = await sourceStatus("po_draft")
    state.approvedSourcing = true
    await film.click(row.locator('[data-sf-action="select"]'), "Reopen the saved purchase-order draft source")
    await expect(page.locator(".sf-u11-detail")).toContainText("po_draft")
    // Re-read stage links from the same freshly verified record after the
    // transition; a draft-order link need not have existed before approval.
    for (const link of await page.locator(".sf-u11-detail a[href]").all()) {
      const href = await link.getAttribute("href")
      if (!href) continue
      const observed = new URL(href, film.installed.origin)
      if (observed.origin !== film.installed.origin) continue
      if (observed.pathname.endsWith("/sourcing/compare")) state.compareHref = observed.href
      if (observed.pathname.endsWith("/po")) state.poHref = observed.href
    }
    await film.focus(page.locator(".sf-u11-detail").getByRole("heading", { level: 2 }), "Sourcing approved / purchase order remains a draft")
    film.proof({ kind: "verified-procurement-transition", requestRef: state.requestRef,
      from: "sourcing", via: "src_pending", to: "po_draft", issuedPurchaseOrder: false })
  }, true)

  await film.cue("29-claw-location", async () => {
    await loadWork(film)
    await film.focus(page.getByRole("heading", { name: "My work", level: 1, exact: true }), "Native source for the external Claw gateway")
    film.proof({ kind: "claw-source-view", externalGatewayRecorded: false, nativeSource: "My work", noGatewayToolInvocation: true })
  })
  await film.cue("30-claw-team", async () => {
    const row = work ? page.locator('[data-sf-surface="UI30"]').getByRole("row").filter({ hasText: work.title }) :
      page.locator('[data-sf-surface="UI30"]').getByRole("row").filter({ hasText: procurement.requests.prApproval })
    await expect(row).toHaveCount(1)
    await film.click(row.getByRole("button", { name: "Work details", exact: true }), "Inspect an actual assigned source item")
    await expect(page.locator("[data-sf-work-detail]")).toBeVisible()
    film.proof({ kind: "external-claw-explanation-background", source: work?.title ?? procurement.requests.prApproval,
      externalProfilesAreNativeCards: false, delegationRecorded: false })
  })
  await film.cue("31-claw-read-tools", async () => {
    if (!state.compareHref) throw new Error("No original comparison link was observed")
    await film.go(state.compareHref, "Requests")
    await expect(page.locator(".sf-u12-comparison tr[data-sf-row]")).toHaveCount(3)
    await film.pause(4000)
    await film.go("/orchestra/sf-procurement/suppliers", "Suppliers")
    const supplier = page.locator(".sf-u14-list tr[data-sf-row]").filter({ hasText: procurement.suppliers.primary })
    await expect(supplier).toHaveCount(1)
    await film.click(supplier.locator('[data-sf-action="select"]'), "Inspect the supplier's original recorded details")
    await expect(page.locator(".sf-u14-detail")).toContainText(procurement.supplierNote)
    await film.snap("31-supplier-source")
    await film.pause(3000)
    await film.go("/orchestra/sf-procurement/contracts", "Vendor Contracts")
    await expect(page.locator('[data-sf-frame="page"]')).toContainText(waveThreeData.contracts.primary)
    film.proof({ kind: "claw-readable-source-examples", sameRequestRef: state.requestRef, supplier: procurement.suppliers.primary,
      separateContractExample: waveThreeData.contracts.primary, toolInvocationRecorded: false })
  })
  await film.cue("32-claw-action-boundary", async () => {
    if (!state.poHref || !state.approvedSourcing) throw new Error("The approved source has no verified draft-order link")
    await film.go(state.poHref, "Requests")
    await expect(page.locator(".sf-u11-detail")).toContainText("po_draft")
    await film.focus(page.locator(".sf-u11-detail").getByRole("button", { name: "Save purchase order draft", exact: true }), "Native human action boundary / draft order")
    film.proof({ kind: "human-boundary-inspection", requestRef: state.requestRef, status: "po_draft", commandSentInBeat: false })
  })
  await film.cue("33-my-work", async () => {
    await loadWork(film)
    if (work) {
      const row = page.locator('[data-sf-surface="UI30"]').getByRole("row").filter({ hasText: work.title })
      await film.click(row.getByRole("button", { name: "Work details", exact: true }), "Open the actual local handoff")
      const detail = page.locator("[data-sf-work-detail]")
      await expect(detail.getByRole("heading", { name: work.title, exact: true })).toBeVisible()
      await film.click(detail.getByRole("button", { name: "Check current destination", exact: true }), "Reauthorize the current source destination")
      await expect(detail.getByRole("button", { name: "Open current source", exact: true })).toBeVisible({ timeout: 45_000 })
      await film.focus(detail, "Freshly authorized assignment and source version")
      film.proof({ kind: "original-handoff-read", title: work.title, sourceVersion: work.sourceVersion, externalMessageSent: false })
    }
  })
  await film.cue("34-reviews", async () => {
    await film.go("/orchestra/sf-reviews/agenda", "Meeting agenda")
    await film.focus(page.getByRole("heading", { level: 1 }), "Meeting agenda / actual available state")
    await film.pause(4000)
    await film.go("/orchestra/sf-reviews/reviews")
    film.proof({ kind: "review-availability", visible: (await page.locator('[data-sf-frame="page"]').innerText()).slice(0, 1800), reportCreated: false })
  })
  await film.cue("35-documents", async () => {
    await film.go("/orchestra/sf-documents")
    await film.focus(page.getByRole("heading", { level: 1 }), "Documents / current source availability")
    film.proof({ kind: "document-availability", visible: (await page.locator('[data-sf-frame="page"]').innerText()).slice(0, 1800), documentFabricated: false })
  })
  await film.cue("36-import-export", async () => {
    await film.go("/orchestra/sf-imports")
    await film.pause(3000)
    await film.go("/orchestra/sf-imports/new", "Import file")
    await film.focus(page.getByRole("heading", { level: 1 }), "Import source and preview entry")
    await film.snap("36-import-source-entry")
    await film.pause(3000)
    await film.go("/orchestra/sf-imports/exports", "Exports")
    film.proof({ kind: "import-export-availability", visible: (await page.locator('[data-sf-frame="page"]').innerText()).slice(0, 1800), importApplied: false })
  })
  await film.cue("44-close", async () => {
    if (!state.savedPlanner) throw new Error("A completed Planner readback is required for the ending")
    const detail = await openPosition()
    await expect(detail.getByLabel("FTE", { exact: true })).toHaveValue("0.9")
    await film.focus(detail.getByLabel("FTE", { exact: true }), "Final original-source check / 0.9 FTE")
    film.proof({ kind: "closing-verified-results", planner: { version: waveThreeData.planner.version, position: planner.headcount.position, fte: 0.9 },
      procurement: { requestRef: state.requestRef, sourcingApproved: state.approvedSourcing === true, status: state.approvedSourcing ? "po_draft" : "not-confirmed", issuedPurchaseOrder: false } })
  }, true)
}

async function loadWork(film: Film) {
  await film.go("/orchestra/sf-work", "My work")
  const surface = film.page.locator('[data-sf-surface="UI30"]')
  await film.input(surface.locator("[data-sf-work-start]"), film.installed.year + "-01-01", "Work period / start")
  await film.input(surface.locator("[data-sf-work-end]"), film.installed.year + "-12-31", "Work period / end")
  await film.click(surface.getByRole("button", { name: "Load my work", exact: true }), "Load actual work for the authorized period")
  await expect(surface.getByRole("row").filter({ hasText: waveFourProcurementData.requests.prApproval })).toBeVisible({ timeout: 45_000 })
}

async function dark(film: Film) {
  const html = film.page.locator("html")
  await expect(html).toHaveAttribute("data-color-scheme", /^(dark|light)$/)
  if (await html.getAttribute("data-color-scheme") !== "dark")
    await film.click(film.page.locator('[data-slot="orchestra-theme-toggle"]'), "Select Dark appearance")
  await expect(html).toHaveAttribute("data-color-scheme", "dark")
}

async function originalConfirmation(film: Film, producer: "planner" | "procurement", label: string, action: string, expectedId?: string) {
  const page = film.page
  const target = film.installed.mount + "/" + producer
  const commands: { action: unknown; id: unknown }[] = []
  const observe = (request: import("@playwright/test").Request) => {
    if (request.method() !== "POST" || new URL(request.url()).pathname !== target) return
    const body = request.postDataJSON()
    commands.push({ action: body?.action, id: body?.id })
  }
  page.on("request", observe)
  const pending = page.waitForResponse((response) => response.request().method() === "POST" &&
    new URL(response.url()).pathname === target, { timeout: 60_000 }).then((response) => ({
      status: response.status(), contentType: response.headers()["content-type"],
    })).catch(() => undefined)
  try {
    await film.click(page.locator('[data-component="sf-change-review"]').getByRole("button", { name: label, exact: true }), "Confirm once / " + producer + " " + action)
    const response = await pending
    if (!response) throw new Error("No original producer acknowledgement was observed")
    expect(response.status).toBe(200)
    expect(response.contentType).toContain("application/json")
    expect(commands).toHaveLength(1)
    expect(commands[0]!.action).toBe(action)
    if (expectedId) expect(commands[0]!.id).toBe(expectedId)
    await expect(page.locator('[data-component="sf-change-review"]')).toHaveCount(0, { timeout: 60_000 })
    await film.nativeReady()
    film.proof({ kind: "original-command-acknowledgement", producer, action, recordRef: commands[0]!.id,
      httpStatus: response.status, commandCount: commands.length, canonicalReadbackRequired: true })
  } finally { page.off("request", observe) }
}
