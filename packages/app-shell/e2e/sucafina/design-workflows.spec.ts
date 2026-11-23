import { expect, type Page, type TestInfo } from "@playwright/test"
import { waveFourTest, enter, observePage } from "./design-support/wave-four"
import { captureWorkflowState } from "./design-support/workflow-polish-capture"
import { workflowPolishCoverage } from "./design-support/workflow-polish-coverage"
import { workflowCase, settledSurface, sourceObject, sourceText, sourceArray, type WorkflowOwner } from "./design-support/workflow-polish-source"
import { seedWorkflowCollab, workflowCollabData } from "./design-support/workflow-polish-collab-seed"
import { seedWorkflowProposal } from "./design-support/workflow-polish-proposal-seed"
import { forwardOnce } from "./operations-support/runtime"
import { encodeSfRouteRef } from "../../src/orchestra/chapters/sucafina/navigation-state"

waveFourTest.use({ designWave: "four-decisions", trace: "off", video: "off" })
waveFourTest.describe.configure({ retries: 0 })
waveFourTest.beforeEach(async ({}, info) => {
  expect(info.config.metadata.bundle).toBe("production")
  expect(info.config.workers).toBe(1)
  await info.attach("workflow-polish-intended-scope", { contentType: "application/json",
    body: JSON.stringify(workflowPolishCoverage, null, 2) })
})

async function open(page: Page, owner: WorkflowOwner, path: string, title: string, surface: string) {
  await enter(page, owner, owner.publicOrigin + path, title, 40_000)
  return settledSurface(page, surface)
}
async function record(page: Page, info: TestInfo, surface: string, state: string, evidence: string, focus?: string) {
  await settledSurface(page, surface)
  await captureWorkflowState(page, info, { surface, state, evidence, focus })
}

waveFourTest("workflow polish: original portfolio inputs and contextual analytics", async ({ page, installation, owner }, info) => {
  waveFourTest.setTimeout(660_000)
  const diagnostics = observePage(page)
  const selected = await workflowCase(page, owner)
  const encoded = encodeSfRouteRef(selected.ref)
  const scenarios = await open(page, owner, "/orchestra/sf-portfolio/scenarios/" + encoded, "Portfolio scenarios", "UI42")
  await expect(scenarios.getByRole("heading", { name: "Scenario universe", exact: true })).toBeVisible()
  const candidates = scenarios.getByRole("group", { name: "Candidate scenarios", exact: true }).getByRole("checkbox")
  expect(await candidates.count()).toBe(sourceArray(selected.selected.alternatives).length)
  expect(await candidates.count()).toBeGreaterThan(0)
  await record(page, info, "UI42", "original-case-inputs", "Exact case and candidate identities came from the original decision-controls producer. No evaluation or preview is claimed.")

  const results = await open(page, owner, "/orchestra/sf-portfolio/scenarios/" + encoded + "/results/" +
    encodeSfRouteRef("design-test-missing-portfolio-result"), "Portfolio results", "UI43")
  await expect(results.locator(".sf-u19-results")).toHaveCount(0)
  await expect(results.locator('[data-sf-state="not-found"], [data-sf-state="unavailable"], [data-sf-state="invalid"], [data-sf-state="denied"]')).toHaveCount(1)
  await record(page, info, "UI43", "missing-result-negative-control", "Deliberately nonexistent result under a real authorized case. This is absence handling, never a completed portfolio result.")

  const sensitivity = await open(page, owner, "/orchestra/sf-portfolio/sensitivity", "Sensitivity", "UI44")
  const chooseCase = sensitivity.getByRole("combobox", { name: "Authorized cases", exact: true })
  await expect(chooseCase.locator("option").filter({ hasText: sourceText(selected.selected.objective) })).toHaveCount(1)
  await chooseCase.selectOption(selected.ref)
  await expect(sensitivity.locator(".sf-u19-sensitivity-form")).toHaveCount(1)
  await record(page, info, "UI44", "original-case-parameters", "Original authorized scenario, baseline and parameter choices. No sensitivity result or admitted evaluation is fabricated.")

  const catalog = await open(page, owner, "/orchestra/sf-bi", "Analytics", "UI45")
  await expect(catalog.getByRole("combobox", { name: "Analysis view", exact: true })).toBeEnabled()
  await expect(catalog.getByRole("button", { name: "Choose context", exact: true })).toBeDisabled()
  await record(page, info, "UI45", "initial-context", "Native analysis catalog requires an explicit authorized view and period.")

  const detail = await open(page, owner, "/orchestra/sf-bi/" + encodeSfRouteRef("BI01"), "Analysis details", "UI46")
  await expect(detail.getByRole("combobox", { name: "Analysis view", exact: true })).toHaveValue("BI01")
  await detail.getByLabel("Start date", { exact: true }).fill(installation.year + "-01-01")
  await detail.getByLabel("End date", { exact: true }).fill(installation.year + "-12-31")
  const options = await forwardOnce(page, (url) => url.origin === installation.origin &&
    url.pathname === installation.mount + "/dashboard" && url.searchParams.get("sf") === "bi-options", "GET")
  const [{ response: optionsResponse }] = await Promise.all([
    options.completed, detail.getByRole("button", { name: "Choose context", exact: true }).click(),
  ]).finally(options.close)
  expect(optionsResponse.status()).toBe(200)
  const optionsBody = sourceObject(await optionsResponse.json())
  expect(optionsBody.status).toBe("ok")
  const choices = sourceArray(sourceObject(optionsBody.value).choices).map(sourceObject)
  expect(choices.length).toBeGreaterThan(0)
  // The first producer-ordered option is explicitly selected, then qualified by its exact reference and label.
  const choice = choices[0]!
  const selector = detail.getByRole("combobox", { name: "Selection", exact: true })
  await expect(selector.getByRole("option", { name: sourceText(choice.label), exact: true })).toHaveCount(1)
  await selector.selectOption(sourceText(choice.selectionRef))
  const original = await forwardOnce(page, (url) => url.origin === installation.origin &&
    url.pathname === installation.mount + "/dashboard" && url.searchParams.get("sf") === "bi-data", "GET")
  const [{ response: dataResponse }] = await Promise.all([
    original.completed, detail.getByRole("button", { name: "View data", exact: true }).click(),
  ]).finally(original.close)
  expect(dataResponse.status()).toBe(200)
  const data = sourceObject(await dataResponse.json())
  expect(sourceObject(data.request)).toMatchObject({ viewId: "BI01", selectionRef: choice.selectionRef,
    period: { start: installation.year + "-01-01", end: installation.year + "-12-31" } })
  expect(sourceArray(sourceObject(data.projection).values).length).toBeGreaterThan(0)
  await expect(detail.locator('[data-sf-bi-view="BI01"]')).toBeVisible()
  await record(page, info, "UI46", "original-financial-values", "Original contextual BI response, exact selection and period verified before capture.")
  expect(diagnostics.pageErrors).toEqual([])
  await info.attach("portfolio-qualification-limit", { contentType: "text/plain",
    body: "UI42 inputs and UI44 parameters are visual coverage only. UI43 is a missing-result negative control. Portfolio/sensitivity evaluation remains outside this visual waveFourTest." })
})

waveFourTest("workflow polish: original agenda, preserved review, comparison and report selection", async ({ page, installation, owner }, info) => {
  waveFourTest.setTimeout(720_000)
  const diagnostics = observePage(page)
  const agendaPath = "/orchestra/sf-reviews/agenda?year=" + installation.year
  const agenda = await open(page, owner, agendaPath, "Meeting agenda", "UI47")
  await expect(agenda.getByLabel("Source dashboard page", { exact: true })).toHaveValue("")
  await expect(page.getByRole("button", { name: "Review selected sections", exact: true })).toBeDisabled()
  await record(page, info, "UI47", "initial-selection", "No agenda section has been selected or preserved.")

  const prepare = async () => {
    const current = await open(page, owner, agendaPath, "Meeting agenda", "UI47")
    await current.getByLabel("Source dashboard page", { exact: true }).fill("Budget Overview")
    await current.getByRole("button", { name: "Find authorized sections", exact: true }).click()
    const available = current.getByRole("region", { name: "Available sections", exact: true })
    await expect(available.getByRole("listitem")).toHaveCount(1, { timeout: 40_000 })
    await available.getByRole("button", { name: "Add to agenda", exact: true }).click()
    await expect(current.locator("[data-sf-agenda-order] > li")).toHaveCount(1)
    await page.getByRole("button", { name: "Review selected sections", exact: true }).click()
    const preview = current.locator("[data-sf-agenda-preview]")
    await expect(preview).toBeVisible({ timeout: 40_000 })
    await expect(preview.locator("ol > li")).toHaveCount(1)
    return preview
  }
  const preserve = async () => {
    const preview = page.locator("[data-sf-agenda-preview]")
    await preview.getByRole("button", { name: "Confirm preservation", exact: true }).click()
    const confirmed = page.locator("[data-sf-preserved-confirmed]")
    await expect(confirmed).toBeVisible({ timeout: 40_000 })
    const reference = sourceText(await confirmed.locator("dl > dt:first-of-type + dd").innerText())
    const original = await page.request.get(owner.publicOrigin + owner.mount + "/dashboard", {
      params: { sf: "dashboard-review", id: reference }, maxRetries: 0,
    })
    expect(original.status()).toBe(200)
    const body = sourceObject(await original.json())
    expect(body.status).toBe("ok")
    expect(sourceArray(sourceObject(body.value).sections)).toHaveLength(1)
    return reference
  }
  await prepare()
  await record(page, info, "UI47", "source-preservation-review", "One original Budget Overview section and its producer period are selected; preservation has not been sent.", "[data-sf-agenda-preview]")
  const previous = await preserve()
  await expect(page.locator("[data-sf-preserved-confirmed]")).toContainText(previous)
  await record(page, info, "UI47", "original-preservation-confirmed", "The original preserve response was confirmed by a separate authenticated review read.", "[data-sf-preserved-confirmed]")
  await prepare()
  const current = await preserve()
  expect(current).not.toBe(previous)

  const review = await open(page, owner, "/orchestra/sf-reviews/reviews/" + encodeSfRouteRef(previous), "Preserved review", "UI48")
  await expect(review.getByRole("region", { name: "Preserved section sequence", exact: true })).toBeVisible()
  await expect(review).toContainText(previous)
  await record(page, info, "UI48", "original-preserved-review", "Original review re-read after its producer confirmed preservation; no client snapshot substituted.")
  await page.getByRole("button", { name: "Present review", exact: true }).click()
  await expect(review).toHaveAttribute("data-sf-presentation", "true")
  await record(page, info, "UI48", "presentation", "Presentation mode of the same authorized preserved review, with original source provenance.", '[aria-label="Preserved review meeting"]')

  const compare = await open(page, owner, "/orchestra/sf-reviews/compare?" +
    new URLSearchParams({ previousReview: previous, currentReview: current }), "Compare reviews", "UI49")
  await compare.getByRole("button", { name: "Read and compare authorized reviews", exact: true }).click()
  await expect(compare.locator("[data-sf-comparison-compatibility]")).toHaveAttribute("data-sf-comparison-compatibility", "compatible", { timeout: 40_000 })
  await expect(compare.locator('[data-change-numeric="true"]')).toHaveCount(0)
  await record(page, info, "UI49", "compatible-original-revisions", "Two separately preserved original reviews of the same material; compatibility is verified and no numeric change is invented.")

  const report = await open(page, owner, "/orchestra/sf-reviews/reports/" + encodeSfRouteRef(previous), "Report", "UI50")
  const selectedSections = report.locator("[data-section-id] input[type=checkbox]")
  await expect(selectedSections).toHaveCount(1)
  await expect(selectedSections).toBeChecked()
  await expect(report.getByLabel("Office format", { exact: true })).toBeVisible()
  await record(page, info, "UI50", "authorized-report-selection", "Original preserved content and one selected section; no DOCX/PPTX artifact or download is claimed.")
  await selectedSections.uncheck()
  await expect(page.getByRole("button", { name: "Generate report", exact: true })).toBeDisabled()
  await record(page, info, "UI50", "empty-report-selection", "The explicit empty section selection keeps report generation disabled.")
  expect(diagnostics.pageErrors).toEqual([])
})

waveFourTest("workflow polish: original relationships, discussion, confirmation and follow-up draft", async ({ page, installation, owner }, info) => {
  waveFourTest.setTimeout(720_000)
  const diagnostics = observePage(page)
  const sourceRequest = async (pathname: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    if (init?.method === "POST") headers.set("Origin", installation.origin)
    const response = await page.request.fetch(installation.origin + installation.mount + pathname, {
      method: init?.method ?? "GET", headers: Object.fromEntries(headers),
      ...(typeof init?.body === "string" ? { data: init.body } : {}), timeout: 40_000, maxRetries: 0,
    })
    return new Response(new Uint8Array(await response.body()), { status: response.status(), headers: response.headers() })
  }
  const seeded = await seedWorkflowCollab({ actorId: installation.actorId, request: sourceRequest }, installation.year)
  const relation = await open(page, owner, "/orchestra/sf-work/relations/" + encodeSfRouteRef(seeded.relation.id),
    "Record relationships", "UI51")
  await expect(relation.locator("[data-sf-relations-source]")).toHaveValue(seeded.relation.fromRef)
  await expect(relation).toContainText(seeded.relation.toRef)
  await record(page, info, "UI51", "original-relationship", "Original handoff relationship, source and target identities; no relationship mutation is submitted.")
  await relation.getByRole("button", { name: "Remove relationship", exact: true }).click()
  const removal = relation.locator("[data-sf-relation-remove-review]")
  await expect(removal).toContainText(seeded.relation.id)
  await record(page, info, "UI51", "removal-review", "Review of the existing exact relationship before any removal; the review is then cancelled.", "[data-sf-relation-remove-review]")
  await removal.getByRole("button", { name: "Keep editing", exact: true }).click()
  await expect(removal).toHaveCount(0)

  const thread = await open(page, owner, "/orchestra/sf-work/threads/" + encodeSfRouteRef(seeded.thread.id),
    "Discussion", "UI52")
  await expect(thread.getByText(workflowCollabData.comment, { exact: true })).toBeVisible()
  await thread.getByRole("textbox", { name: "Comment", exact: true }).fill(workflowCollabData.draft)
  await thread.getByRole("button", { name: "Open originating record", exact: true }).click()
  await expect(thread.locator("[data-sf-thread-origin]")).toContainText(seeded.thread.sourceRef)
  await expect(thread.getByRole("textbox", { name: "Comment", exact: true })).toHaveValue(workflowCollabData.draft)
  await record(page, info, "UI52", "origin-and-unsent-draft", "Original unaddressed local test comment and source provenance; the new composer text remains unsent.")

  const prepared = sourceObject(sourceObject(await seeded.post("collaboration-confirmation-prepare", { scope: seeded.scope })).value)
  const confirmation = await open(page, owner, "/orchestra/sf-work/confirmations/" + encodeSfRouteRef(sourceText(prepared.selectionRef)),
    "Confirm no change", "UI53")
  await expect(confirmation.locator("[data-sf-confirm-material]")).toBeVisible()
  await expect(confirmation.locator("[data-sf-confirm-fingerprint]")).toHaveText(sourceText(prepared.scopeFingerprint))
  await expect(confirmation.locator("[data-sf-confirm-receipt]")).toHaveCount(0)
  await record(page, info, "UI53", "original-material-review", "Current material and exact fingerprint were prepared by the original producer; no no-change confirmation is submitted.")

  const workbench = await forwardOnce(page, installation.origin + installation.mount + "/dashboard?sf=dashboard-workbench", "POST")
  const [{ response }] = await Promise.all([
    workbench.completed,
    open(page, owner, "/orchestra/sf-dashboard/hot-topics/proposals/" +
      encodeSfRouteRef("design-test-before-proposal-source"), "Follow-up proposal", "UI54"),
  ]).finally(workbench.close)
  expect(response.status()).toBe(200)
  const originalWorkbench = sourceObject(await response.json())
  expect(originalWorkbench.status).toBe("ok")
  const draft = await seedWorkflowProposal(page.request, installation, owner, originalWorkbench)
  const proposal = await open(page, owner, "/orchestra/sf-dashboard/hot-topics/proposals/" + encodeSfRouteRef(draft.draftRef),
    "Follow-up proposal", "UI54")
  await expect(proposal).toContainText(draft.action)
  await expect(proposal.locator('[data-component="sf-change-review"]')).toHaveCount(0)
  await record(page, info, "UI54", "original-follow-up-draft", "Original authenticated draft and source evidence; no preparation, application or receipt is manufactured.")
  expect(diagnostics.pageErrors).toEqual([])
})

waveFourTest("workflow polish: original memory inputs and explicit missing observations", async ({ page, owner }, info) => {
  waveFourTest.setTimeout(480_000)
  const diagnostics = observePage(page)
  const selected = await workflowCase(page, owner)
  for (const screen of [
    { id: "UI61", path: "/orchestra/sf-memory/signals", title: "Signals" },
    { id: "UI63", path: "/orchestra/sf-memory/outcomes", title: "Expected and observed" },
  ]) {
    const memory = await open(page, owner, screen.path, screen.title, screen.id)
    const read = memory.getByRole("button", { name: "Read authorized case", exact: true })
    await expect(read).toBeDisabled()
    await memory.getByLabel("Case ID", { exact: true }).fill(selected.id)
    await memory.getByLabel("Case incarnation", { exact: true }).fill(selected.incarnation)
    await memory.getByLabel("Case version", { exact: true }).fill(String(selected.version))
    await expect(read).toBeEnabled()
    const observed = ["memory-conditions", "memory-signals"].map((mode) =>
      page.waitForResponse((response) => {
        const url = new URL(response.url())
        return url.origin === owner.publicOrigin && url.pathname === owner.mount + "/dashboard" &&
          url.searchParams.get("sf") === mode
      }, { timeout: 40_000 }).then(async (response) => {
        expect(response.status()).toBe(200)
        const body = sourceObject(await response.json())
        expect(body.status).toBe("ok")
        return { mode, body }
      }))
    const [readings] = await Promise.all([Promise.all(observed), read.click()])
    const conditions = sourceArray(readings.find((entry) => entry.mode === "memory-conditions")!.body.value)
    const signals = sourceArray(readings.find((entry) => entry.mode === "memory-signals")!.body.signals)
    await expect(memory.locator(".sf-state-panel")).toHaveAttribute("data-sf-state",
      conditions.length || signals.length ? "ready" : "empty")
    await expect(memory.locator("[data-sf-condition-id]")).toHaveCount(conditions.length)
    await record(page, info, screen.id, "original-case-observations",
      "Exact identity and version came from original decision-controls; the native memory read determines the recorded conditions or explicit absence. No signal, outcome or causal attribution is created.")
  }
  const similar = await open(page, owner, "/orchestra/sf-memory/cases", "Similar cases", "UI62")
  const selector = similar.locator(".sf-memory-similarity-form").getByRole("combobox")
  await expect(selector).toHaveCount(1)
  const option = selector.getByRole("option").filter({ hasText: sourceText(selected.selected.objective) })
  await expect(option).toHaveCount(1)
  const optionRef = sourceText(await option.getAttribute("value"))
  await selector.selectOption(optionRef)
  await expect(similar.locator(".sf-memory-candidates")).toBeVisible({ timeout: 40_000 })
  await record(page, info, "UI62", "authorized-source-and-candidates", "Original authorized case and candidate choices; no similarity search result is inferred from another screen.")
  expect(diagnostics.pageErrors).toEqual([])
})

waveFourTest("workflow polish: routines, schedules, exports and local context", async ({ page, installation, owner }, info) => {
  waveFourTest.setTimeout(660_000)
  const diagnostics = observePage(page)
  await open(page, owner, "/orchestra/sf-routines", "Routines", "UI64")
  await expect(page.getByRole("button", { name: "Prepare routine", exact: true })).toBeDisabled()
  await record(page, info, "UI64", "original-admission-prerequisites",
    "Native case/recipe admission state. No routine is prepared or run and a missing producer is recorded as missing.")
  const runs = await open(page, owner, "/orchestra/sf-routines/runs", "Routine result", "UI65")
  await expect(runs.getByText("Select an authorized routine run.", { exact: true })).toBeVisible()
  await expect(runs.locator("[data-sf-native-execution]")).toHaveCount(0)
  await record(page, info, "UI65", "no-selected-run", "No run reference was selected; no execution or verified result is claimed.")

  const schedules = await open(page, owner, "/orchestra/sf-routines/schedules", "Schedule", "UI66")
  await expect(schedules.getByRole("heading", { name: "Schedules", exact: true })).toBeVisible()
  await expect(schedules.getByRole("heading", { name: "Occurrences", exact: true })).toBeVisible()
  await record(page, info, "UI66", "original-schedule-list", "Original installed schedule list or its explicit unavailable state; no recurrence is synthesized.")
  const newSchedule = await open(page, owner, "/orchestra/sf-routines/schedules/new", "Schedule", "UI66")
  await expect(newSchedule.getByLabel("Condition reference", { exact: true })).toHaveValue("")
  await expect(newSchedule.getByRole("button", { name: "Review proposed changes", exact: true })).toBeDisabled()
  await record(page, info, "UI66", "new-recurrence-prerequisites", "Empty original condition, recipe, recurrence and timezone fields keep review disabled; no schedule is created.")

  const residents = await open(page, owner, "/orchestra/sf-routines/residents", "Contributions", "UI70")
  await expect(residents).toHaveAttribute("data-state", /^(ready|empty|unavailable|denied)$/)
  await record(page, info, "UI70", "original-resident-inventory",
    "Installed original resident inventory and its actual access state. Listing is not evidence of execution, contribution or a loaded skill pack.")

  const profileTitles = await residents.locator(".sf-n29-resident-list article > h2").allTextContents()
  if (profileTitles.length) {
    // Choose the first source-ordered profile by its observed unique identity, never by a guessed resident name.
    const profile = sourceText(profileTitles[0]).trim()
    const card = residents.locator(".sf-n29-resident-list article")
      .filter({ has: page.getByRole("heading", { name: profile, exact: true }) })
    await expect(card).toHaveCount(1)
    await card.getByRole("button", { name: "Open resident details", exact: true }).click()
    await expect(residents.locator(".sf-n29-resident-detail")).toContainText(profile)
    await record(page, info, "UI70", "original-resident-detail",
      "Selected original profile, skills and explicit case prerequisite; no verified contribution or run is manufactured.", ".sf-n29-resident-detail")
  }

  const history = await open(page, owner, "/orchestra/sf-imports", "Import result", "UI57")
  const historyRead = history.locator('[data-sf-history="authorized-reference"]')
  await expect(historyRead).toBeVisible()
  await expect(historyRead.getByRole("button", { name: "Refresh receipt", exact: true })).toBeDisabled()
  await record(page, info, "UI57", "history-reference-prerequisite",
    "No authorized manifest reference has been selected. The applied receipt and actual denial are covered by operations.spec.ts.")

  const exports = await open(page, owner, "/orchestra/sf-imports/exports", "Exports", "UI68")
  await expect(exports.getByRole("combobox", { name: "File format", exact: true })).toBeVisible()
  await record(page, info, "UI68", "original-export-availability", "Original export controls and current prerequisite reasons; no file or download is claimed.")

  const context = await open(page, owner, "/orchestra/sf-home/context", "Context and access", "UI67")
  const identity = context.locator('[data-sf-context="authorized"]')
  await expect(identity).toContainText(owner.projectId)
  await expect(identity).toContainText(owner.installationId)
  await expect(identity).toContainText(installation.actorId)
  await record(page, info, "UI67", "original-local-operator-context", "Real local-operator enrollment; project, installation and principal match the original bound owner. No live Microsoft identity is simulated.")
  const administration = await open(page, owner, "/orchestra/sf-home/administration", "Local administration", "UI69")
  await expect(administration).toHaveAttribute("data-sf-owner", "local-operator")
  await expect(administration.getByRole("heading", { name: "Profile", exact: true })).toBeVisible()
  await record(page, info, "UI69", "original-local-administration", "Original authenticated local administration read. No maintenance, backup restore, permission change or Teams write is invoked.")
  expect(diagnostics.pageErrors).toEqual([])
})
