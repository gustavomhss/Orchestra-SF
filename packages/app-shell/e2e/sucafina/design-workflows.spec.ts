import { expect, type Page, type TestInfo } from "@playwright/test"
import { Schema } from "effect"
import { SfDomain } from "@orchestra/schema/sucafina/domain"
import { SfReviewDomainProjection, SfReviewPreserved } from "@orchestra/schema/sucafina/reviews"
import { waveFourTest, enter, observePage, capture, reflow, scheme, scrollPageTop } from "./design-support/wave-four"
import { captureWorkflowState } from "./design-support/workflow-polish-capture"
import { workflowPolishCoverage } from "./design-support/workflow-polish-coverage"
import { workflowCase, settledSurface, sourceObject, sourceText, sourceArray, type WorkflowOwner } from "./design-support/workflow-polish-source"
import { seedWorkflowCollab, workflowCollabData } from "./design-support/workflow-polish-collab-seed"
import { seedWorkflowProposal } from "./design-support/workflow-polish-proposal-seed"
import { forwardOnce } from "./operations-support/runtime"
import { readWorkflowAdmission, captureWorkflowRefusal, type WorkflowRequirement } from "./design-support/workflow-polish-admission"
import { encodeSfRouteRef } from "../../src/orchestra/chapters/sucafina/navigation-state"

// Each case owns a real isolated enrollment, original source readbacks and three
// captures per checkpoint. These budgets include those multi-page journeys;
// writes are never retried and a blocked read is recorded with its original reason.
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
async function admitted(page: Page, owner: WorkflowOwner, info: TestInfo, path: string, surface: string, required: readonly WorkflowRequirement[]) {
  const proof = await readWorkflowAdmission(page, owner, info, surface, required)
  if (proof.ready) return true
  await captureWorkflowRefusal(page, owner, info, path, surface, proof)
  return false
}
async function record(page: Page, info: TestInfo, surface: string, state: string, evidence: string, focus?: string) {
  await settledSurface(page, surface)
  await captureWorkflowState(page, info, { surface, state, evidence, focus })
}

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
  if (await admitted(page, owner, info, "/orchestra/sf-work/relations/" + encodeSfRouteRef(seeded.relation.id), "UI51",
    [{ operationId: "collaboration.relation-read" }])) {
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
  }

  if (await admitted(page, owner, info, "/orchestra/sf-work/threads/" + encodeSfRouteRef(seeded.thread.id), "UI52",
    [{ operationId: "collaboration.thread-read" }])) {
    const thread = await open(page, owner, "/orchestra/sf-work/threads/" + encodeSfRouteRef(seeded.thread.id),
      "Discussion", "UI52")
    await expect(thread.getByText(workflowCollabData.comment, { exact: true })).toBeVisible()
    await thread.getByRole("textbox", { name: "Comment", exact: true }).fill(workflowCollabData.draft)
    await thread.getByRole("button", { name: "Open originating record", exact: true }).click()
    await expect(thread.locator("[data-sf-thread-origin]")).toContainText(seeded.thread.sourceRef)
    await expect(thread.getByRole("textbox", { name: "Comment", exact: true })).toHaveValue(workflowCollabData.draft)
    await record(page, info, "UI52", "origin-and-unsent-draft", "Original unaddressed local test comment and source provenance; the new composer text remains unsent.")
  }

  const prepared = sourceObject(sourceObject(await seeded.post("collaboration-confirmation-prepare", { scope: seeded.scope })).value)
  if (await admitted(page, owner, info, "/orchestra/sf-work/confirmations/" + encodeSfRouteRef(sourceText(prepared.selectionRef)), "UI53",
    [{ operationId: "collaboration.confirmation-project" }])) {
    const confirmation = await open(page, owner, "/orchestra/sf-work/confirmations/" + encodeSfRouteRef(sourceText(prepared.selectionRef)),
      "Confirm no change", "UI53")
    await expect(confirmation.locator("[data-sf-confirm-material]")).toBeVisible()
    await expect(confirmation.locator("[data-sf-confirm-fingerprint]")).toHaveText(sourceText(prepared.scopeFingerprint))
    await expect(confirmation.locator("[data-sf-confirm-receipt]")).toHaveCount(0)
    await record(page, info, "UI53", "original-material-review", "Current material and exact fingerprint were prepared by the original producer; no no-change confirmation is submitted.")
  }

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
    if (!await admitted(page, owner, info, screen.path, screen.id,
      [{ operationId: "intelligence.memory-catalog" }])) continue
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
  if (await admitted(page, owner, info, "/orchestra/sf-memory/cases", "UI62",
    [{ operationId: "projection.cases" }, { operationId: "intelligence.memory-similar-cases" }])) {
    const similar = await open(page, owner, "/orchestra/sf-memory/cases", "Similar cases", "UI62")
    const selector = similar.locator(".sf-memory-similarity-form").getByRole("combobox")
    await expect(selector).toHaveCount(1)
    const option = selector.getByRole("option", { name: selected.title + " — " + selected.version, exact: true })
    await expect(option).toHaveCount(1)
    await expect(option).toHaveAttribute("value", selected.ref)
    await selector.selectOption(selected.ref)
    await expect(similar.locator(".sf-memory-candidates")).toBeVisible({ timeout: 40_000 })
    await record(page, info, "UI62", "authorized-source-and-candidates", "Original authorized case and candidate choices; no similarity search result is inferred from another screen.")
  }

  expect(diagnostics.pageErrors).toEqual([])
})

waveFourTest("workflow polish: routines, schedules, exports and local context", async ({ page, installation, owner }, info) => {
  waveFourTest.setTimeout(660_000)
  const diagnostics = observePage(page)
  if (await admitted(page, owner, info, "/orchestra/sf-routines", "UI64",
    [{ operationId: "intelligence.analysis.choices", family: "intelligence" },
      { operationId: "routines.catalog", family: "intelligence" }])) {
    await open(page, owner, "/orchestra/sf-routines", "Routines", "UI64")
    await expect(page.getByRole("button", { name: "Prepare routine", exact: true })).toBeDisabled()
    await record(page, info, "UI64", "original-admission-prerequisites",
      "Native case/recipe admission state. No routine is prepared or run and a missing producer is recorded as missing.")
  }

  if (await admitted(page, owner, info, "/orchestra/sf-routines/runs", "UI65",
    [{ operationId: "projection.routine", family: "intelligence" }])) {
    const runs = await open(page, owner, "/orchestra/sf-routines/runs", "Routine result", "UI65")
    await expect(runs.getByText("Select an authorized routine run.", { exact: true })).toBeVisible()
    await expect(runs.locator("[data-sf-native-execution]")).toHaveCount(0)
    await record(page, info, "UI65", "no-selected-run", "No run reference was selected; no execution or verified result is claimed.")
  }

  if (await admitted(page, owner, info, "/orchestra/sf-routines/schedules", "UI66",
    [{ operationId: "schedules.list", family: "intelligence" }])) {
    const schedules = await open(page, owner, "/orchestra/sf-routines/schedules", "Schedule", "UI66")
    await expect(schedules.getByRole("heading", { name: "Schedules", exact: true })).toBeVisible()
    await expect(schedules.getByRole("heading", { name: "Occurrences", exact: true })).toBeVisible()
    await record(page, info, "UI66", "original-schedule-list", "Original installed schedule list or its explicit unavailable state; no recurrence is synthesized.")
    const newSchedule = await open(page, owner, "/orchestra/sf-routines/schedules/new", "Schedule", "UI66")
    await expect(newSchedule.getByLabel("Condition reference", { exact: true })).toHaveValue("")
    await expect(newSchedule.getByRole("button", { name: "Review proposed changes", exact: true })).toBeDisabled()
    await record(page, info, "UI66", "new-recurrence-prerequisites", "Empty original condition, recipe, recurrence and timezone fields keep review disabled; no schedule is created.")
  }

  if (await admitted(page, owner, info, "/orchestra/sf-routines/residents", "UI70",
    [{ operationId: "projection.residents", family: "intelligence" }])) {
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
  const summaryWrites: string[] = []
  page.on("request", (request) => {
    const url = new URL(request.url())
    if (request.method() === "POST" && url.origin === installation.origin &&
      url.pathname === installation.mount + "/api/ui/local-admin/configure-summaries") summaryWrites.push(url.pathname)
  })
  const administration = await open(page, owner, "/orchestra/sf-home/administration", "Local administration", "UI69")
  const summaries = administration.locator("[data-sf-summary-settings]")
  const form = summaries.locator("[data-sf-summary-form]")
  await expect(form).toBeVisible()
  const unavailable = administration.getByRole("region", { name: "Currently unavailable", exact: true })
  await expect(unavailable).toBeVisible()

  // Observe explicit original read actions after the owner and form have settled.
  // Bootstrap reads can be cancelled by context resolution and are not a delivery receipt.
  const observeOriginalRead = async (endpoint: string, trigger: () => Promise<void>) => {
    const read = await forwardOnce(page, (url) =>
      url.origin === installation.origin && url.pathname === installation.mount + endpoint, "GET")
    try {
      const [{ response }] = await Promise.all([read.completed, trigger()])
      return response
    } finally {
      await read.close()
    }
  }
  const adminResponse = await observeOriginalRead("/api/ui/projections/local-admin", () =>
    unavailable.getByRole("button", { name: "Try again", exact: true }).click())
  const adminBody = Schema.decodeUnknownSync(SfDomain.operations["projection.local-admin"].output)(await adminResponse.json())
  // The original private jobs/backups reader port is deliberately unbound.
  // A local-operator identity is not evidence that this separate producer returned data.
  expect(adminResponse.status()).toBe(503)
  expect(adminBody).toEqual({ status: "unavailable", reason: "local-operator-reader-not-bound" })
  await expect(administration).toHaveAttribute("data-sf-owner", "not-authorized")
  await expect(administration.getByRole("heading", { name: "Profile", exact: true })).toHaveCount(0)
  await expect(administration.getByRole("region", { name: "Currently unavailable", exact: true })).toBeVisible()

  const summaryResponse = await observeOriginalRead("/api/ui/local-admin/summary-settings", () =>
    summaries.getByRole("button", { name: "Current source", exact: true }).click())
  const summaryBody = Schema.decodeUnknownSync(SfDomain.operations["local-admin.summary-read"].output)(await summaryResponse.json())
  expect(summaryResponse.status()).toBe(200)
  if (summaryBody.status !== "ok") throw new Error("Original summary settings read required")
  expect(summaryBody.context.projectId).toBe(owner.projectId)
  expect(summaryBody.context.installationId).toBe(owner.installationId)
  expect(summaryBody.context.principalRef).toBe(installation.actorId)
  expect(summaryBody.value.canConfigure).toBe(true)
  expect(summaryBody.value.availablePages.length).toBeGreaterThan(0)
  await expect(form).toBeVisible()
  await expect(form).toHaveAttribute("data-version", String(summaryBody.value.version))
  const choices = form.locator('input[name="pages"]')
  expect(await choices.evaluateAll((elements) => elements.map((element) => (element as HTMLInputElement).value)))
    .toEqual(summaryBody.value.availablePages)
  expect(await choices.evaluateAll((elements) => elements.filter((element) => (element as HTMLInputElement).checked)
    .map((element) => (element as HTMLInputElement).value))).toEqual(summaryBody.value.availablePages.filter((value) => summaryBody.value.pages.includes(value)))
  await info.attach("UI69-original-administration-readers", { contentType: "application/json",
    body: JSON.stringify({ profile: { httpStatus: adminResponse.status(), body: adminBody },
      summaries: { httpStatus: summaryResponse.status(), context: summaryBody.context, value: summaryBody.value },
      profileRendered: false, summarySettingsRendered: true, writes: summaryWrites }) })
  await record(page, info, "UI69", "original-summary-settings-and-unbound-profile",
    "The original summary-settings reader returned authorized data. The separate private jobs/backups projection returned503 local-operator-reader-not-bound; no Profile or backup data is fabricated.")
  await record(page, info, "UI69", "original-summary-settings-actions",
    "Original configurable summary choices and review action; no configuration write is submitted.", "[data-sf-summary-form] button[type=submit]")
  const first = summaryBody.value.availablePages[0]!
  await expect(choices.first()).toHaveValue(first)
  await choices.first().setChecked(!summaryBody.value.pages.includes(first))
  await form.getByRole("button", { name: "Review changes", exact: true }).click()
  const review = summaries.locator('[data-component="sf-change-review"]')
  await expect(review).toBeVisible()
  await expect(review.locator('.sf-s03-comparison-field[data-difference="changed"]')).toHaveCount(1)
  await expect(review.locator('.sf-s03-version[data-version="proposed"] .sf-s03-value-list')).toHaveCount(1)
  await record(page, info, "UI69", "summary-selection-review",
    "Original summary values compared with an unsent one-choice change; typed display keys preserve identity and order. The producer version and configure command remain unchanged.")
  await record(page, info, "UI69", "summary-selection-review-actions",
    "Review and cancel remain reachable in the original summary editor; no configuration, maintenance, restore or Teams write is invoked.", '[data-component="sf-change-review"] .sf-s03-actions')
  await review.getByRole("button", { name: "Cancel review", exact: true }).click({ timeout: 15_000 })
  await expect(review).toHaveCount(0)
  await expect(form).toBeVisible()
  expect(summaryWrites).toEqual([])
  expect(diagnostics.pageErrors).toEqual([])
})
