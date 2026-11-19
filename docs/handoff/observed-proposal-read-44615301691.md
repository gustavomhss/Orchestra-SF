# Proposal native read observation

Original run 44615301691, artifact 14574791796. Read-only diagnostic, no rerun and no product assertion changed.

## Original archive members
test-ci-evidence/benchmark-runtime.json
test-ci-evidence/playwright-runtime.json
test-ci-evidence/playwright-selection.json
test-ci-evidence/request.json
packages/app-shell/e2e/test-results/sucafina-dashboard-install-66700-alues-until-explicit-review-chromium/error-context.md
packages/app-shell/e2e/test-results/sucafina-dashboard-install-67ccc-rite-authority-is-withdrawn-chromium/error-context.md
packages/app-shell/e2e/test-results/sucafina-dashboard-install-77a3c-re-purging-actual-read-loss-chromium/error-context.md
packages/app-shell/e2e/test-results/sucafina-dashboard-install-a86c7-pply-an-existing-C12-choice-chromium/error-context.md
packages/app-shell/e2e/test-results/sucafina-dashboard-install-fe91b-e-current-base-is-confirmed-chromium/error-context.md
packages/app-shell/e2e/playwright-report/data/5821597db0b756579bead31c2e66a80844bddbf4.md
packages/app-shell/e2e/playwright-report/data/af788dd7fe9cd98f667ade3c5e8445fed88fde10.md
packages/app-shell/e2e/playwright-report/data/d1d37553dc716adda20e5d7913bd1c34794410a6.md
packages/app-shell/e2e/playwright-report/data/de41547f6311ebd5b9b655e437860069b5c0272f.md
packages/app-shell/e2e/playwright-report/data/efc878d3b280ad714f5c8bea6572c396cb5746b6.md
packages/app-shell/e2e/playwright-report/index.html

## packages/app-shell/e2e/test-results/sucafina-dashboard-install-66700-alues-until-explicit-review-chromium/error-context.md

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sucafina/dashboard-installed/proposals.spec.ts >> Dashboard reads the current source and active private proposal while preserving dirty values until explicit review
- Location: e2e/sucafina/dashboard-installed/proposals.spec.ts:116:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-sf-private-proposal]').getByText('The original producer saved this private proposal.', { exact: true })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('[data-sf-private-proposal]').getByText('The original producer saved this private proposal.', { exact: true })

```

# Test source

```ts
  1   | import { expect, test, type Locator, type Page, type Response, type Route } from "@playwright/test"
  2   | import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"
  3   | import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical"
  4   | import { object } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract"
  5   | import { createProposalInstallation, enterProposalShell, proposalResponseBody, retainProposalResponse, withProposalHost } from "../proposals-support/installation"
  6   | import type { ProposalObservation } from "../proposals-support/protocol"
  7   | 
  8   | test.use({ trace: "off", screenshot: "off", video: "off" })
  9   | const currentLoaded = "Current proposal and source loaded. Review both before saving."
  10  | const retainedMessage = "Current options loaded. Your edits were retained."
  11  | const savedMessage = "The original producer saved this private proposal."
  12  | const confirmationLabel = "I reviewed the current proposal and source; keep my values against this base."
  13  | const reloadLabel = "Load current version and keep my edits"
  14  | const modeResponse = (mode: string) => (response: Response) => response.request().method() === "POST" &&
  15  |   new URL(response.url()).pathname === "/sucafina/dashboard" && new URL(response.url()).searchParams.get("sf") === mode
  16  | const modeUrl = (mode: string) => (url: URL) => url.pathname === "/sucafina/dashboard" && url.searchParams.get("sf") === mode
  17  | 
  18  | async function openProposal(page: Page, origin: string, reference = "new") {
  19  |   if (reference === "new") {
  20  |     expect((await page.goto(origin + "/orchestra/sf-dashboard/hot-topics?year=2026"))?.status()).toBe(200)
  21  |     const create = page.getByRole("button", { name: "New private proposal", exact: true })
  22  |     await expect(create).toBeEnabled()
  23  |     const [response] = await Promise.all([
  24  |       page.waitForResponse(modeResponse("dashboard-workbench")), create.click(),
  25  |     ])
  26  |     expect(response.status()).toBe(200)
  27  |     expect(object(proposalResponseBody(response)).status).toBe("ok")
  28  |   } else {
  29  |     const [response] = await Promise.all([
  30  |       page.waitForResponse(modeResponse("dashboard-workbench")),
  31  |       page.goto(origin + "/orchestra/sf-dashboard/hot-topics/proposals/" + encodeSfRouteRef(reference)),
  32  |     ])
  33  |     expect(response.status()).toBe(200)
  34  |     expect(object(proposalResponseBody(response)).status).toBe("ok")
  35  |   }
  36  |   const panel = page.locator("[data-sf-private-proposal]")
  37  |   await expect(panel).toBeVisible()
  38  |   await expect(panel).not.toContainText("Unrelated confidential case")
  39  |   return panel
  40  | }
  41  | async function chooseNew(panel: Locator, sourceLabel = "Original action") {
  42  |   try {
  43  |     await panel.getByLabel("Select case", { exact: true }).selectOption({ label: "Review the action" })
  44  |     await panel.getByLabel("Select source record", { exact: true }).selectOption({ label: sourceLabel })
  45  |   } catch (error) {
  46  |     console.info("SF_PROPOSAL_SELECTION_STATE", JSON.stringify({
  47  |       labels: await panel.locator("label").allTextContents(),
  48  |       text: (await panel.textContent())?.slice(0, 2000),
  49  |     }))
  50  |     throw error
  51  |   }
  52  | }
  53  | async function saveDraft(page: Page, panel: Locator) {
  54  |   const [written, discovered] = await Promise.all([
  55  |     page.waitForResponse(modeResponse("dashboard-hot-topic-draft")),
  56  |     page.waitForResponse(modeResponse("dashboard-workbench")),
  57  |     panel.getByRole("button", { name: "Save proposal", exact: true }).click(),
  58  |   ])
  59  |   expect(written.status()).toBe(200)
  60  |   expect(object(proposalResponseBody(written)).status).toBe("ok")
  61  |   expect(discovered.status()).toBe(200)
  62  |   expect(object(proposalResponseBody(discovered)).status).toBe("ok")
> 63  |   await expect(panel.getByText(savedMessage, { exact: true })).toBeVisible()
      |                                                                ^ Error: expect(locator).toBeVisible() failed
  64  |   return written.request().postDataJSON() as Record<string, unknown>
  65  | }
  66  | function onlyDraft(observation: ProposalObservation) {
  67  |   expect(observation.preferences.status).toBe("ok")
  68  |   expect(observation.preferences.value?.drafts).toHaveLength(1)
  69  |   const draft = observation.preferences.value?.drafts[0]
  70  |   if (!draft) throw new Error("Original C08 private draft unavailable")
  71  |   return draft
  72  | }
  73  | 
  74  | async function prepareRecordAgenda(page: Page, origin: string) {
  75  |   expect((await page.goto(origin + "/orchestra/sf-reviews/agenda?year=2026"))?.status()).toBe(200)
  76  |   const agenda = page.locator('[data-sf-surface="UI47"]')
  77  |   await expect(agenda).toBeVisible()
  78  |   await agenda.getByLabel("Source dashboard page", { exact: true }).fill("Hot Topics & Actions")
  79  |   const found = page.waitForResponse((response) => response.request().method() === "GET" &&
  80  |     new URL(response.url()).pathname.endsWith("/api/ui/projections/review") &&
  81  |     new URL(response.url()).searchParams.get("page") === "Hot Topics & Actions")
  82  |   await agenda.getByRole("button", { name: "Find authorized sections", exact: true }).click()
  83  |   const discovery = await found
  84  |   expect(discovery.status()).toBe(200)
  85  |   const discovered = object(proposalResponseBody(discovery))
  86  |   expect(discovered.status).toBe("ok")
  87  |   expect(object(discovered.value).items).toHaveLength(1)
  88  |   await agenda.getByRole("button", { name: "Add to agenda", exact: true }).click()
  89  |   const selected = agenda.locator('[data-sf-agenda-order] [data-sf-record-id="topic"]')
  90  |   await expect(selected).toHaveCount(1)
  91  |   await expect(selected).toContainText("Original action")
  92  |   const pending = page.waitForResponse(modeResponse("dashboard-agenda"))
  93  |   await page.getByRole("button", { name: "Review selected sections", exact: true }).click()
  94  |   const response = await pending
  95  |   expect(response.status()).toBe(200)
  96  |   const preview = object(proposalResponseBody(response))
  97  |   expect(preview.status).toBe("ok")
  98  |   const sections = object(preview.value).sections
  99  |   expect(sections).toHaveLength(1)
  100 |   expect(object((sections as unknown[])[0]).recordCount).toBe(1)
  101 |   const shown = agenda.locator("[data-sf-agenda-preview]")
  102 |   await expect(shown).toContainText("Original action")
  103 |   return { agenda, shown, preview: object(preview.value) }
  104 | }
  105 | 
  106 | async function expectPreservationWithdrawn(page: Page, origin: string) {
  107 |   expect((await page.goto(origin + "/orchestra/sf-dashboard/hot-topics/" + encodeSfRouteRef("topic") + "?year=2026"))?.status()).toBe(200)
  108 |   const capture = page.locator("[data-sf-record-capture]")
  109 |   await expect(capture).toBeVisible()
  110 |   await expect(capture).toContainText("Original action")
  111 |   await expect(capture.getByRole("button", { name: "Preserve this record", exact: true })).toBeDisabled()
  112 | }
  113 | 
  114 | // Ports the original consumer-read journeys intact to the installed chapter.
  115 | // Every success, conflict and denial comes from the real producer and SQLite.
  116 | test("Dashboard reads the current source and active private proposal while preserving dirty values until explicit review", async ({ browser }, info) => {
  117 |   const installation = await createProposalInstallation(), errors: string[] = []
  118 |   try {
  119 |     await withProposalHost(installation, info, async (host) => {
  120 |       const context = await browser.newContext()
  121 |       context.setDefaultTimeout(10000)
  122 |       context.setDefaultNavigationTimeout(15000)
  123 |       try {
  124 |         const page = await context.newPage()
  125 |         page.on("pageerror", (error) => errors.push(error.message))
  126 |         await enterProposalShell(page, installation, host)
  127 |         const panel = await openProposal(page, installation.origin)
  128 |         await chooseNew(panel)
  129 |         await panel.getByLabel("Action", { exact: true }).fill("Initially saved proposal")
  130 |         await panel.getByLabel("Notes", { exact: true }).fill("Initially saved private context")
  131 |         await saveDraft(page, panel)
  132 |         const initial = onlyDraft(await host.control())
  133 |         const original = structuredClone(initial)
  134 |         await panel.getByLabel("Action", { exact: true }).fill("My retained action")
  135 |         await panel.getByLabel("Notes", { exact: true }).fill("My retained explanation")
  136 | 
  137 |         const other = await context.newPage()
  138 |         other.on("pageerror", (error) => errors.push(error.message))
  139 |         const otherPanel = await openProposal(other, installation.origin, original.draftRef)
  140 |         await otherPanel.getByLabel("Action", { exact: true }).fill("Active proposal from another page")
  141 |         await otherPanel.getByLabel("Notes", { exact: true }).fill("Current private proposal context")
  142 |         const secondWrite = await saveDraft(other, otherPanel)
  143 |         expect(secondWrite.expectedVersion).toBe(1)
  144 | 
  145 |         const [stale] = await Promise.all([
  146 |           page.waitForResponse(modeResponse("dashboard-hot-topic-draft")),
  147 |           panel.getByRole("button", { name: "Save proposal", exact: true }).click(),
  148 |         ])
  149 |         expect(stale.status()).toBe(409)
  150 |         expect(stale.request().postDataJSON()).toMatchObject({
  151 |           draftRef: original.draftRef, expectedVersion: 1, targetEvidence: original.targetEvidence,
  152 |         })
  153 |         await expect(panel.getByText("This topic changed. Review the current version before saving.", { exact: true })).toBeVisible()
  154 | 
  155 |         const activeKey = "sf:proposal-coverage:hot-topic:active:" + digestSfValue(original.id)
  156 |         const observation = await host.control()
  157 |         expect(observation.preferences.value?.keys).toContain(activeKey)
  158 |         const active = onlyDraft(observation)
  159 |         expect(active).toMatchObject({ id: original.id, incarnation: original.incarnation, version: 2,
  160 |           fields: { action: "Active proposal from another page", notes: "Current private proposal context" } })
  161 |         const changed = await page.request.post(installation.origin + "/sucafina/dashboard", {
  162 |           headers: { origin: installation.origin }, data: {
  163 |             page: "Hot Topics & Actions", action: "save", id: "topic", version: 0,
```

## packages/app-shell/e2e/test-results/sucafina-dashboard-install-67ccc-rite-authority-is-withdrawn-chromium/error-context.md

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sucafina/dashboard-installed/proposals.spec.ts >> Dashboard contextual draft retains edits when current write authority is withdrawn
- Location: e2e/sucafina/dashboard-installed/proposals.spec.ts:359:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-sf-private-proposal]').getByText('Current options loaded. Your edits were retained.', { exact: true })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('[data-sf-private-proposal]').getByText('Current options loaded. Your edits were retained.', { exact: true })

```

# Test source

```ts
  288 |           panel.getByRole("button", { name: reloadLabel, exact: true }).click(),
  289 |         ])
  290 |         await page.unroute(workbenchUrl, withdrawWrite)
  291 |         expect(object(object(object(prior).value).decisions).permissions).toMatchObject({ draft: true })
  292 |         expect(restricted.status()).toBe(200)
  293 |         const restrictedValue = object(object(proposalResponseBody(restricted)).value)
  294 |         expect(restrictedValue.permissions).toMatchObject({ draft: false, prepare: false, apply: false, capture: false, preserve: false })
  295 |         await expect(panel.getByText(retainedMessage, { exact: true })).toBeVisible()
  296 |         await expect(panel.getByRole("button", { name: "Save proposal", exact: true })).toBeDisabled()
  297 |         await expect(panel.getByLabel("Action", { exact: true })).toBeDisabled()
  298 |         await expect(panel.getByLabel("Action", { exact: true })).toHaveValue("Private retained operator action")
  299 |         await expect(panel.getByLabel("Notes", { exact: true })).toHaveValue("Private retained operator context")
  300 |         const preservedRecord = await context.newPage()
  301 |         preservedRecord.on("pageerror", (error) => errors.push(error.message))
  302 |         await expectPreservationWithdrawn(preservedRecord, installation.origin)
  303 |         await preservedRecord.close()
  304 |         const preferences = (await host.control()).preferences
  305 |         expect(preferences.status).toBe("ok")
  306 |         expect(preferences.value?.keys).toEqual([])
  307 |         await expect(panel.getByText("Access to this private proposal was withdrawn. Its local values were cleared.", { exact: true })).toHaveCount(0)
  308 | 
  309 |         const beforeReadLoss = Promise.withResolvers<void>()
  310 |         const actualDenial = Promise.withResolvers<{ status: number; body: unknown }>()
  311 |         const observeDenial = async (route: Route) => {
  312 |           try {
  313 |             const response = await route.fetch({ maxRetries: 0, maxRedirects: 0 })
  314 |             await retainProposalResponse(route, response)
  315 |             const body: unknown = await response.json()
  316 |             await route.fulfill({ response })
  317 |             actualDenial.resolve({ status: response.status(), body })
  318 |             await response.dispose()
  319 |           } catch (error) { actualDenial.reject(error); await route.abort().catch(() => {}) }
  320 |         }
  321 |         const withdrawRead = async (route: Route) => {
  322 |           try {
  323 |             const response = await route.fetch({ maxRetries: 0, maxRedirects: 0 })
  324 |             await retainProposalResponse(route, response)
  325 |             expect(response.status()).toBe(200)
  326 |             await host.control("withdraw-read")
  327 |             await route.fulfill({ response })
  328 |             beforeReadLoss.resolve()
  329 |             await response.dispose()
  330 |           } catch (error) { beforeReadLoss.reject(error); await route.abort().catch(() => {}) }
  331 |         }
  332 |         await page.route(workbenchUrl, withdrawRead)
  333 |         await page.route(readUrl, observeDenial)
  334 |         const [, revoked, denial] = await Promise.all([
  335 |           beforeReadLoss.promise, page.waitForResponse(modeResponse("dashboard-draft-read")), actualDenial.promise,
  336 |           panel.getByRole("button", { name: reloadLabel, exact: true }).click(),
  337 |         ])
  338 |         await page.unroute(workbenchUrl, withdrawRead)
  339 |         await page.unroute(readUrl, observeDenial)
  340 |         expect(revoked.status()).toBe(403)
  341 |         expect(denial.status).toBe(403)
  342 |         expect(object(denial.body).status).toBe("denied")
  343 |         expect(JSON.stringify(denial.body)).not.toContain("Private retained operator")
  344 |         await expect(panel.getByText(
  345 |           "Access to this private proposal was withdrawn. Its local values were cleared.", { exact: true })).toBeVisible()
  346 |         await expect(panel.locator("input, textarea, select")).toHaveCount(0)
  347 |         await expect(page.locator("body")).not.toContainText("Private retained operator")
  348 |         const browserState = await page.evaluate(() => JSON.stringify({
  349 |           history: history.state, local: { ...localStorage }, session: { ...sessionStorage },
  350 |         }))
  351 |         expect(browserState).not.toContain("Private retained operator action")
  352 |         expect(browserState).not.toContain("Private retained operator context")
  353 |         expect(errors).toEqual([])
  354 |       } finally { await context.close() }
  355 |     })
  356 |   } finally { await installation.dispose() }
  357 | })
  358 | 
  359 | test("Dashboard contextual draft retains edits when current write authority is withdrawn", async ({ browser }, info) => {
  360 |   const installation = await createProposalInstallation(), errors: string[] = []
  361 |   try {
  362 |     await withProposalHost(installation, info, async (host) => {
  363 |       const context = await browser.newContext()
  364 |       context.setDefaultTimeout(10000)
  365 |       context.setDefaultNavigationTimeout(15000)
  366 |       try {
  367 |         const page = await context.newPage()
  368 |         page.on("pageerror", (error) => errors.push(error.message))
  369 |         await enterProposalShell(page, installation, host)
  370 |         const panel = await openProposal(page, installation.origin)
  371 |         await chooseNew(panel)
  372 |         await panel.getByLabel("Action", { exact: true }).fill("Unsaved operator wording")
  373 |         await host.control("withdraw-write")
  374 |         const [rejected] = await Promise.all([
  375 |           page.waitForResponse(modeResponse("dashboard-hot-topic-draft")),
  376 |           panel.getByRole("button", { name: "Save proposal", exact: true }).click(),
  377 |         ])
  378 |         expect(rejected.status()).toBe(403)
  379 |         expect(object(proposalResponseBody(rejected)).status).toBe("denied")
  380 |         await expect(panel.getByText("Reading is available. The current authority does not permit saving this proposal.", { exact: true })).toBeVisible()
  381 |         await expect(panel.getByLabel("Action", { exact: true })).toHaveValue("Unsaved operator wording")
  382 |         await expect(panel).toHaveAttribute("data-dirty", "true")
  383 |         const [read] = await Promise.all([
  384 |           page.waitForResponse(modeResponse("dashboard-draft-read")),
  385 |           panel.getByRole("button", { name: reloadLabel, exact: true }).click(),
  386 |         ])
  387 |         expect(read.status()).toBe(200)
> 388 |         await expect(panel.getByText(retainedMessage, { exact: true })).toBeVisible()
      |                                                                         ^ Error: expect(locator).toBeVisible() failed
  389 |         await expect(panel.getByRole("button", { name: "Save proposal", exact: true })).toBeDisabled()
  390 |         await expect(panel.getByLabel("Action", { exact: true })).toHaveValue("Unsaved operator wording")
  391 |         const preservedRecord = await context.newPage()
  392 |         preservedRecord.on("pageerror", (error) => errors.push(error.message))
  393 |         await expectPreservationWithdrawn(preservedRecord, installation.origin)
  394 |         await preservedRecord.close()
  395 |         const state = await host.control()
  396 |         expect(state.preferences.status).toBe("ok")
  397 |         expect(state.preferences.value?.keys).toEqual([])
  398 |         const forged = await page.request.post(installation.origin + "/sucafina/dashboard?sf=dashboard-capture", {
  400 |           data: { sourceRef: "not-a-grant" },
  401 |         })
  402 |         expect(forged.status()).toBe(403)
  403 |         expect(state.record.action).toBe("Original action")
  404 |         expect((await host.control()).record.action).toBe("Original action")
  405 |         expect(errors).toEqual([])
  406 |       } finally { await context.close() }
  407 |     })
  408 |   } finally { await installation.dispose() }
  409 | })
  410 | 
  411 | test("Dashboard draft conflict reloads the same draft identity and preserves local edits until the current base is confirmed", async ({ browser }, info) => {
  412 |   const installation = await createProposalInstallation(), errors: string[] = []
  413 |   try {
  414 |     await withProposalHost(installation, info, async (host) => {
  415 |       const context = await browser.newContext()
  416 |       context.setDefaultTimeout(15000)
  417 |       context.setDefaultNavigationTimeout(15000)
  418 |       try {
  419 |         const page = await context.newPage()
  420 |         page.on("pageerror", (error) => errors.push(error.message))
  421 |         await enterProposalShell(page, installation, host)
  422 |         const panel = await openProposal(page, installation.origin)
  423 |         await chooseNew(panel)
  424 |         await panel.getByLabel("Action", { exact: true }).fill("Initial shared draft")
  425 |         await saveDraft(page, panel)
  426 |         const first = onlyDraft(await host.control())
  427 | 
  428 |         const other = await context.newPage()
  429 |         other.on("pageerror", (error) => errors.push(error.message))
  430 |         const otherPanel = await openProposal(other, installation.origin, first.draftRef)
  431 |         await panel.getByLabel("Action", { exact: true }).fill("My retained action")
  432 |         await panel.getByLabel("Notes", { exact: true }).fill("My retained explanation")
  433 |         await otherPanel.getByLabel("Action", { exact: true }).fill("Action saved in another tab")
  434 |         await saveDraft(other, otherPanel)
  435 | 
  436 |         // A distinct private draft targets the same case and record. The reader
  437 |         // must bind the retained identity rather than match a target or label.
  438 |         const independent = await openProposal(other, installation.origin)
  439 |         expect(new URL(other.url()).pathname).toBe("/orchestra/sf-dashboard/hot-topics/proposals/" + encodeSfRouteRef("new"))
  440 |         const selectedCase = independent.getByLabel("Select case", { exact: true })
  441 |         await expect(selectedCase).toBeEnabled()
  442 |         await selectedCase.selectOption({ label: "Review the action" })
  443 |         await expect(selectedCase.locator("option:checked")).toHaveText("Review the action")
  444 |         const selectedSource = independent.getByLabel("Select source record", { exact: true })
  445 |         await expect(selectedSource.locator("option", { hasText: "Original action" })).toHaveCount(1)
  446 |         await selectedSource.selectOption({ label: "Original action" })
  447 |         await independent.getByLabel("Action", { exact: true }).fill("Independent action draft")
  448 |         await expect(independent.getByLabel("Action", { exact: true })).toHaveValue("Independent action draft")
  449 |         await saveDraft(other, independent)
  450 | 
  451 |         const [conflict] = await Promise.all([
  452 |           page.waitForResponse(modeResponse("dashboard-hot-topic-draft")),
  453 |           panel.getByRole("button", { name: "Save proposal", exact: true }).click(),
  454 |         ])
  455 |         expect(conflict.status()).toBe(409)
  456 |         expect(conflict.request().postDataJSON()).toMatchObject({ draftRef: first.draftRef, expectedVersion: 1 })
  457 |         await expect(panel.getByText("This topic changed. Review the current version before saving.", { exact: true })).toBeVisible()
  458 |         await expect(panel.getByLabel("Action", { exact: true })).toHaveValue("My retained action")
  459 |         await expect(panel.getByLabel("Notes", { exact: true })).toHaveValue("My retained explanation")
  460 |         await expect(panel.getByRole("button", { name: "Save proposal", exact: true })).toBeDisabled()
  461 | 
  462 |         const [discovered, read] = await Promise.all([
  463 |           page.waitForResponse(modeResponse("dashboard-workbench")),
  464 |           page.waitForResponse(modeResponse("dashboard-draft-read")),
  465 |           panel.getByRole("button", { name: reloadLabel, exact: true }).click(),
  466 |         ])
  467 |         expect(discovered.status()).toBe(200)
  468 |         expect(object(proposalResponseBody(discovered)).status).toBe("ok")
  469 |         expect(read.status()).toBe(200)
  470 |         expect(read.request().postDataJSON()).toEqual({ caseRef: first.caseRef, targetEvidence: first.targetEvidence, draftRef: first.draftRef })
  471 |         await expect(panel.getByText(currentLoaded, { exact: true })).toBeVisible()
  472 |         const comparison = panel.locator("[data-sf-proposal-comparison]")
  473 |         await expect(comparison).toContainText("Initial shared draft")
  474 |         await expect(comparison).toContainText("Action saved in another tab")
  475 |         await expect(comparison).toContainText("My retained action")
  476 |         await expect(comparison).not.toContainText("Independent action draft")
  477 |         await expect(panel.getByLabel("Notes", { exact: true })).toHaveValue("My retained explanation")
  478 |         await expect(panel.getByRole("button", { name: "Save proposal", exact: true })).toBeDisabled()
  479 |         await expect(panel.getByLabel(confirmationLabel, { exact: true })).not.toBeChecked()
  480 |         await panel.getByLabel(confirmationLabel, { exact: true }).check()
  481 |         await saveDraft(page, panel)
  482 | 
  483 |         const latest = await host.control()
  484 |         expect(latest.preferences.status).toBe("ok")
  485 |         expect(latest.preferences.value?.drafts).toHaveLength(2)
  486 |         const retained = latest.preferences.value?.drafts.find((draft) => draft.fields.action === "My retained action")
  487 |         expect(retained).toMatchObject({ id: first.id, incarnation: first.incarnation, version: 3,
  488 |           fields: { action: "My retained action", notes: "My retained explanation", owner: "Operations", due: "2026-12-01" } })
```

## packages/app-shell/e2e/test-results/sucafina-dashboard-install-77a3c-re-purging-actual-read-loss-chromium/error-context.md

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sucafina/dashboard-installed/proposals.spec.ts >> Dashboard keeps dirty values through interrupted reads and fences write withdrawal between admissions before purging actual read loss
- Location: e2e/sucafina/dashboard-installed/proposals.spec.ts:220:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-sf-private-proposal]').getByText('Current options loaded. Your edits were retained.', { exact: true })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('[data-sf-private-proposal]').getByText('Current options loaded. Your edits were retained.', { exact: true })

```

# Test source

```ts
  167 |         expect(changed.status()).toBe(200)
  168 |         expect(object(await changed.json()).ok).toBe(true)
  169 | 
  170 |         const [discovered, checked] = await Promise.all([
  171 |           page.waitForResponse(modeResponse("dashboard-workbench")),
  172 |           page.waitForResponse(modeResponse("dashboard-draft-read")),
  173 |           panel.getByRole("button", { name: reloadLabel, exact: true }).click(),
  174 |         ])
  175 |         expect(discovered.status()).toBe(200)
  176 |         expect(checked.status()).toBe(200)
  177 |         expect(checked.request().postDataJSON()).toEqual({
  178 |           caseRef: original.caseRef, targetEvidence: original.targetEvidence, draftRef: original.draftRef,
  179 |         })
  180 |         const checkedBody = object(proposalResponseBody(checked))
  181 |         expect(checkedBody.status).toBe("ok")
  182 |         const current = object(checkedBody.value), proposal = object(current.draft)
  183 |         expect(current.originalSource).toEqual({ refId: original.targetEvidence.refId, refDigest: original.targetEvidence.refDigest })
  184 |         expect(current.currentSource).not.toEqual(original.targetEvidence)
  185 |         expect(proposal).toMatchObject({ id: original.id, incarnation: original.incarnation, version: 2,
  186 |           fields: { action: "Active proposal from another page", notes: "Current private proposal context" } })
  187 |         expect(object(object(current.source).draft).fields).toMatchObject({
  188 |           action: "Current materially changed source", notes: "Current source context",
  189 |         })
  190 |         await expect(panel.getByText(currentLoaded, { exact: true })).toBeVisible()
  191 |         const tables = panel.locator("[data-sf-proposal-comparison] table")
  192 |         await expect(tables).toHaveCount(2)
  193 |         expect(await tables.nth(0).locator("th").allTextContents()).toEqual(["Field", "Original fields", "Current proposal", "My retained values"])
  194 |         expect(await tables.nth(0).getByRole("row").filter({ has: page.getByRole("cell", { name: "Action", exact: true }) }).locator("td").allTextContents())
  195 |           .toEqual(["Action", "Initially saved proposal", "Active proposal from another page", "My retained action"])
  196 |         expect(await tables.nth(1).locator("th").allTextContents()).toEqual(["Field", "Current authorized source"])
  197 |         await expect(tables.nth(1)).toContainText("Current materially changed source")
  198 |         await expect(panel.getByLabel("Notes", { exact: true })).toHaveValue("My retained explanation")
  199 |         await expect(panel.getByLabel(confirmationLabel, { exact: true })).not.toBeChecked()
  200 |         await expect(panel.getByRole("button", { name: "Save proposal", exact: true })).toBeDisabled()
  201 |         expect(onlyDraft(await host.control())).toEqual(active)
  202 | 
  203 |         await panel.getByLabel(confirmationLabel, { exact: true }).check()
  204 |         const reviewedWrite = await saveDraft(page, panel)
  205 |         expect(reviewedWrite.expectedVersion).toBe(2)
  206 |         expect(reviewedWrite.draftRef).toBe(proposal.draftRef)
  207 |         expect(reviewedWrite.targetEvidence).toEqual(current.currentSource)
  208 |         expect(reviewedWrite.sourceRefs).toEqual([current.currentSource])
  209 |         const latest = await host.control()
  210 |         expect(onlyDraft(latest)).toMatchObject({ id: original.id, incarnation: original.incarnation, version: 3,
  211 |           fields: { action: "My retained action", notes: "My retained explanation" }, targetEvidence: current.currentSource })
  212 |         expect(latest.record).toMatchObject({ action: "Current materially changed source", notes: "Current source context" })
  213 |         expect(initial).toEqual(original)
  214 |         expect(errors).toEqual([])
  215 |       } finally { await context.close() }
  216 |     })
  217 |   } finally { await installation.dispose() }
  218 | })
  219 | 
  220 | test("Dashboard keeps dirty values through interrupted reads and fences write withdrawal between admissions before purging actual read loss", async ({ browser }, info) => {
  221 |   const installation = await createProposalInstallation(), errors: string[] = []
  222 |   try {
  223 |     await withProposalHost(installation, info, async (host) => {
  224 |       const context = await browser.newContext()
  225 |       context.setDefaultTimeout(10000)
  226 |       context.setDefaultNavigationTimeout(15000)
  227 |       try {
  228 |         const page = await context.newPage()
  229 |         page.on("pageerror", (error) => errors.push(error.message))
  230 |         await enterProposalShell(page, installation, host)
  231 |         const panel = await openProposal(page, installation.origin)
  232 |         await chooseNew(panel)
  233 |         await panel.getByLabel("Action", { exact: true }).fill("Private retained operator action")
  234 |         await panel.getByLabel("Notes", { exact: true }).fill("Private retained operator context")
  235 |         await expect(panel.getByRole("button", { name: "Save proposal", exact: true })).toBeEnabled()
  236 |         const readUrl = modeUrl("dashboard-draft-read")
  237 |         const interrupted = Promise.withResolvers<{ status: number; body: unknown }>()
  238 |         const abortRead = async (route: Route) => {
  239 |           try {
  240 |             const response = await route.fetch({ maxRetries: 0, maxRedirects: 0 })
  241 |             await retainProposalResponse(route, response)
  242 |             const body: unknown = await response.json()
  243 |             await route.abort("aborted")
  244 |             interrupted.resolve({ status: response.status(), body })
  245 |             await response.dispose()
  246 |           } catch (error) { interrupted.reject(error); await route.abort().catch(() => {}) }
  247 |         }
  248 |         await page.route(readUrl, abortRead)
  249 |         const [observed] = await Promise.all([
  250 |           interrupted.promise, panel.getByRole("button", { name: reloadLabel, exact: true }).click(),
  251 |         ])
  252 |         expect(observed.status).toBe(200)
  253 |         expect(object(observed.body).status).toBe("ok")
  254 |         await expect(panel.getByRole("button", { name: reloadLabel, exact: true })).toBeEnabled()
  255 |         await page.unroute(readUrl, abortRead)
  256 |         await expect(panel.getByLabel("Action", { exact: true })).toHaveValue("Private retained operator action")
  257 |         await expect(panel.getByLabel("Notes", { exact: true })).toHaveValue("Private retained operator context")
  258 |         await expect(panel).toHaveAttribute("data-dirty", "true")
  259 |         await expect(panel.getByRole("button", { name: "Save proposal", exact: true })).toBeDisabled()
  260 |         await expect(panel.getByText("Access to this private proposal was withdrawn. Its local values were cleared.", { exact: true })).toHaveCount(0)
  261 | 
  262 |         const [retried] = await Promise.all([
  263 |           page.waitForResponse(modeResponse("dashboard-draft-read")),
  264 |           panel.getByRole("button", { name: reloadLabel, exact: true }).click(),
  265 |         ])
  266 |         expect(retried.status()).toBe(200)
> 267 |         await expect(panel.getByText(retainedMessage, { exact: true })).toBeVisible()
      |                                                                         ^ Error: expect(locator).toBeVisible() failed
  268 |         await expect(panel.getByRole("button", { name: "Save proposal", exact: true })).toBeEnabled()
  269 |         await expect(panel.getByLabel("Action", { exact: true })).toHaveValue("Private retained operator action")
  270 | 
  271 |         const workbenchUrl = modeUrl("dashboard-workbench")
  272 |         const priorWrite = Promise.withResolvers<unknown>()
  273 |         const withdrawWrite = async (route: Route) => {
  274 |           try {
  275 |             const response = await route.fetch({ maxRetries: 0, maxRedirects: 0 })
  276 |             await retainProposalResponse(route, response)
  277 |             const body: unknown = await response.json()
  278 |             expect(response.status()).toBe(200)
  279 |             await host.control("withdraw-write")
  280 |             await route.fulfill({ response })
  281 |             priorWrite.resolve(body)
  282 |             await response.dispose()
  283 |           } catch (error) { priorWrite.reject(error); await route.abort().catch(() => {}) }
  284 |         }
  285 |         await page.route(workbenchUrl, withdrawWrite)
  286 |         const [prior, restricted] = await Promise.all([
  287 |           priorWrite.promise, page.waitForResponse(modeResponse("dashboard-draft-read")),
  288 |           panel.getByRole("button", { name: reloadLabel, exact: true }).click(),
  289 |         ])
  290 |         await page.unroute(workbenchUrl, withdrawWrite)
  291 |         expect(object(object(object(prior).value).decisions).permissions).toMatchObject({ draft: true })
  292 |         expect(restricted.status()).toBe(200)
  293 |         const restrictedValue = object(object(proposalResponseBody(restricted)).value)
  294 |         expect(restrictedValue.permissions).toMatchObject({ draft: false, prepare: false, apply: false, capture: false, preserve: false })
  295 |         await expect(panel.getByText(retainedMessage, { exact: true })).toBeVisible()
  296 |         await expect(panel.getByRole("button", { name: "Save proposal", exact: true })).toBeDisabled()
  297 |         await expect(panel.getByLabel("Action", { exact: true })).toBeDisabled()
  298 |         await expect(panel.getByLabel("Action", { exact: true })).toHaveValue("Private retained operator action")
  299 |         await expect(panel.getByLabel("Notes", { exact: true })).toHaveValue("Private retained operator context")
  300 |         const preservedRecord = await context.newPage()
  301 |         preservedRecord.on("pageerror", (error) => errors.push(error.message))
  302 |         await expectPreservationWithdrawn(preservedRecord, installation.origin)
  303 |         await preservedRecord.close()
  304 |         const preferences = (await host.control()).preferences
  305 |         expect(preferences.status).toBe("ok")
  306 |         expect(preferences.value?.keys).toEqual([])
  307 |         await expect(panel.getByText("Access to this private proposal was withdrawn. Its local values were cleared.", { exact: true })).toHaveCount(0)
  308 | 
  309 |         const beforeReadLoss = Promise.withResolvers<void>()
  310 |         const actualDenial = Promise.withResolvers<{ status: number; body: unknown }>()
  311 |         const observeDenial = async (route: Route) => {
  312 |           try {
  313 |             const response = await route.fetch({ maxRetries: 0, maxRedirects: 0 })
  314 |             await retainProposalResponse(route, response)
  315 |             const body: unknown = await response.json()
  316 |             await route.fulfill({ response })
  317 |             actualDenial.resolve({ status: response.status(), body })
  318 |             await response.dispose()
  319 |           } catch (error) { actualDenial.reject(error); await route.abort().catch(() => {}) }
  320 |         }
  321 |         const withdrawRead = async (route: Route) => {
  322 |           try {
  323 |             const response = await route.fetch({ maxRetries: 0, maxRedirects: 0 })
  324 |             await retainProposalResponse(route, response)
  325 |             expect(response.status()).toBe(200)
  326 |             await host.control("withdraw-read")
  327 |             await route.fulfill({ response })
  328 |             beforeReadLoss.resolve()
  329 |             await response.dispose()
  330 |           } catch (error) { beforeReadLoss.reject(error); await route.abort().catch(() => {}) }
  331 |         }
  332 |         await page.route(workbenchUrl, withdrawRead)
  333 |         await page.route(readUrl, observeDenial)
  334 |         const [, revoked, denial] = await Promise.all([
  335 |           beforeReadLoss.promise, page.waitForResponse(modeResponse("dashboard-draft-read")), actualDenial.promise,
  336 |           panel.getByRole("button", { name: reloadLabel, exact: true }).click(),
  337 |         ])
  338 |         await page.unroute(workbenchUrl, withdrawRead)
  339 |         await page.unroute(readUrl, observeDenial)
  340 |         expect(revoked.status()).toBe(403)
  341 |         expect(denial.status).toBe(403)
  342 |         expect(object(denial.body).status).toBe("denied")
  343 |         expect(JSON.stringify(denial.body)).not.toContain("Private retained operator")
  344 |         await expect(panel.getByText(
  345 |           "Access to this private proposal was withdrawn. Its local values were cleared.", { exact: true })).toBeVisible()
  346 |         await expect(panel.locator("input, textarea, select")).toHaveCount(0)
  347 |         await expect(page.locator("body")).not.toContainText("Private retained operator")
  348 |         const browserState = await page.evaluate(() => JSON.stringify({
  349 |           history: history.state, local: { ...localStorage }, session: { ...sessionStorage },
  350 |         }))
  351 |         expect(browserState).not.toContain("Private retained operator action")
  352 |         expect(browserState).not.toContain("Private retained operator context")
  353 |         expect(errors).toEqual([])
  354 |       } finally { await context.close() }
  355 |     })
  356 |   } finally { await installation.dispose() }
  357 | })
  358 | 
  359 | test("Dashboard contextual draft retains edits when current write authority is withdrawn", async ({ browser }, info) => {
  360 |   const installation = await createProposalInstallation(), errors: string[] = []
  361 |   try {
  362 |     await withProposalHost(installation, info, async (host) => {
  363 |       const context = await browser.newContext()
  364 |       context.setDefaultTimeout(10000)
  365 |       context.setDefaultNavigationTimeout(15000)
  366 |       try {
  367 |         const page = await context.newPage()
```

## packages/app-shell/e2e/test-results/sucafina-dashboard-install-a86c7-pply-an-existing-C12-choice-chromium/error-context.md

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sucafina/dashboard-installed/proposals.spec.ts >> Dashboard contextual controls preserve a real agenda and record, then review and apply an existing C12 choice
- Location: e2e/sucafina/dashboard-installed/proposals.spec.ts:499:1

# Error details

```
Error: "route.fetch: Target page, context or browser has been closed
Call log:
  - → POST http://127.0.0.1:3000/sucafina/dashboard?sf=dashboard-workbench
    - user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.7727.15 Safari/537.36
    - accept: application/json
    - accept-encoding: gzip,deflate,br
    - accept-language: en-US
    - content-type: application/json
    - origin: http://127.0.0.1:3000
    - referer: http://127.0.0.1:3000/orchestra/sf-dashboard/hot-topics/r_dG9waWM?year=2026
    - sec-ch-ua: "HeadlessChrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"
    - sec-ch-ua-mobile: ?0
    - sec-ch-ua-platform: "Windows"
    - content-length: 82
" while running route callback.
Consider awaiting `await page.unrouteAll({ behavior: 'ignoreErrors' })`
before the end of the test to ignore remaining routes in flight.
```

# Test source

```ts
  13  | 
  14  | const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..")
  15  | 
  16  | // Keep only the bytes/status of this request's original APIResponse. The browser
  17  | // still receives that response unchanged; assertions never fetch it again.
  18  | const originalResponses = new WeakMap<PlaywrightRequest, { status: number; text: string }>()
  19  | export async function retainProposalResponse(route: Route, response: APIResponse) {
  20  |   originalResponses.set(route.request(), { status: response.status(), text: await response.text() })
  21  | }
  22  | export function proposalResponseBody(response: Response): unknown {
  23  |   const original = originalResponses.get(response.request())
  24  |   if (!original) throw new Error("PROPOSAL_ORIGINAL_RESPONSE_NOT_RETAINED")
  25  |   expect(response.status()).toBe(original.status)
  26  |   return JSON.parse(original.text) as unknown
  27  | }
  28  | 
  29  | export async function createProposalInstallation() {
  30  |   const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-proposal-native-"))
  31  |   await chmod(directory, 0o700)
  32  |   const configuration: ProposalConfiguration = { directory, origin: installedShellOrigin(),
  33  |     installationId: randomUUID(), controlKey: randomBytes(32).toString("hex") }
  34  |   const filename = path.join(directory, "proposal-configuration.json")
  35  |   await writeFile(filename, JSON.stringify(configuration), { mode: 0o600 })
  36  |   return { ...configuration, filename, dispose: () => rm(directory, { recursive: true, force: true }) }
  37  | }
  38  | 
  39  | /** The installed source/authority/SQLite graph runs in its own process.
  40  |  * The private fixture controls withdraw authority and read original state.
  41  |  * They never substitute a product response or grant access.
  42  |  */
  43  | export async function withProposalHost<T>(
  44  |   installation: Awaited<ReturnType<typeof createProposalInstallation>>,
  45  |   info: TestInfo,
  46  |   action: (host: ProposalReady & { control: (operation?: ProposalControlOperation) => Promise<ProposalObservation> }) => Promise<T>,
  47  | ): Promise<T> {
  48  |   const { Effect, Stream } = await import("effect")
  49  |   const { ChildProcess } = await import("effect/unstable/process")
  50  |   const { AppProcess } = await import("@orchestra/core/process")
  51  |   const { LayerNode } = await import("@orchestra/core/effect/layer-node")
  52  |   const logs: string[] = []
  54  |   await rm(path.join(installation.directory, "proposal-ready.json"), { force: true })
  55  |   const environment = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] =>
  56  |     entry[1] !== undefined && (["PATH", "BUN_INSTALL", "LANG", "LC_ALL", "TZ", "CI", "SYSTEMROOT", "WINDIR"].includes(entry[0]) ||
  57  |       entry[0].startsWith("HUGR_OMNI_"))))
  58  |   try {
  59  |     return await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
  60  |       const service = yield* AppProcess.Service
  61  |       const process = yield* service.spawn(ChildProcess.make("bun",
  62  |         [path.join(root, "packages/app-shell/e2e/sucafina/proposals-support/host.ts"), installation.filename],
  63  |         { cwd: root, env: environment, stdin: "ignore", stdout: "pipe", stderr: "pipe" }))
  64  |       const capture = (chunk: Uint8Array) => { logs.push(Buffer.from(chunk).toString("utf8")) }
  65  |       yield* Effect.forkScoped(Stream.runForEach(process.stdout, (chunk) => Effect.sync(() => capture(chunk))))
  66  |       yield* Effect.forkScoped(Stream.runForEach(process.stderr, (chunk) => Effect.sync(() => capture(chunk))))
  67  |       const state = { exited: false }
  68  |       yield* Effect.forkScoped(process.exitCode.pipe(Effect.tap(() => Effect.sync(() => { state.exited = true }))))
  69  |       return yield* Effect.promise(async () => {
  70  |         let ready: ProposalReady | undefined
  71  |         await expect.poll(async () => {
  72  |           if (state.exited) throw new Error("The private proposal host exited before its original graph initialized")
  73  |           ready = await readFile(path.join(installation.directory, "proposal-ready.json"), "utf8")
  74  |             .then((value) => JSON.parse(value) as ProposalReady).catch((error: NodeJS.ErrnoException) => {
  75  |               if (error.code === "ENOENT") return undefined
  76  |               throw error
  77  |             })
  78  |           return !!ready
  79  |         }, { timeout: 60_000, message: "The original private proposal host must initialize" }).toBe(true)
  80  |         if (!ready) throw new Error("private proposal native host unavailable")
  82  |         const control = async (operation: ProposalControlOperation = "observe"): Promise<ProposalObservation> => {
  83  |           const response = await fetch("http://localhost:4110/__proposal_control", { method: "POST",
  84  |             headers: { "content-type": "application/json", "x-proposal-control": installation.controlKey },
  85  |             body: JSON.stringify({ operation }) })
  86  |           expect(response.status, "The fixture must observe the original SQLite state").toBe(200)
  87  |           return response.json() as Promise<ProposalObservation>
  88  |         }
  89  |         return action({ ...ready, control })
  90  |       })
  91  |     })).pipe(Effect.provide(LayerNode.compile(AppProcess.node))))
  92  |   } finally {
  93  |     // A new composition may only reuse the directory after the old listener exits.
  94  |     let source = logs.join("").slice(-40_000)
  98  |       .replace(/\b[a-f0-9]{32,}\b/gi, "[redacted-hex]")
  99  |     await info.attach("proposal-host.log", { body: source, contentType: "text/plain" })
  100 |     await expect.poll(portAvailable, { timeout: 5_000, message: "The old private proposal host releases its owned listener" }).toBe(true)
  101 |   }
  102 | }
  103 | 
  104 | export async function enterProposalShell(page: Page, installation: Awaited<ReturnType<typeof createProposalInstallation>>, host: ProposalReady) {
  105 |   // Buffer each one original JSON response before Chromium's CDP body eviction.
  106 |   // Preserve its actual status, headers and bytes; authentication is not intercepted.
  107 |   const modes = new Set(["dashboard-workbench", "dashboard-draft-read", "dashboard-hot-topic-draft",
  108 |     "dashboard-hot-topic-draft-outcome", "dashboard-hot-topic-prepare", "dashboard-hot-topic-review",
  109 |     "dashboard-hot-topic-apply", "dashboard-agenda", "dashboard-review-preserve", "dashboard-capture", "dashboard-history"])
  110 |   await page.context().route((url) => url.origin === installation.origin &&
  111 |     (url.pathname === "/sucafina/dashboard" && modes.has(url.searchParams.get("sf") ?? "") ||
  112 |       url.pathname === "/sucafina/api/ui/projections/review"), async (route) => {
> 113 |     const original = await route.fetch({ maxRetries: 0, maxRedirects: 0 })
      |                                  ^ Error: "route.fetch: Target page, context or browser has been closed
  114 |     await retainProposalResponse(route, original)
  115 |     await route.fulfill({ response: original })
  116 |   })
  119 |   const discoveryURL = new URL("/api/sucafina/installations", installation.origin)
  120 |   discoveryURL.search = new URLSearchParams({ select: "location", "location[directory]": installation.directory }).toString()
  121 |   const discovered = await page.request.get(discoveryURL.toString())
  122 |   expect(discovered.status()).toBe(200)
  123 |   const discovery = Schema.decodeUnknownSync(SfInstallationList)(await discovered.json())
  124 |   expect(discovery.installations).toHaveLength(1)
  125 |   const binding = discovery.installations[0]!
  126 |   expect(binding.mount).toBe("/sucafina")
  127 |   expect(binding.publicOrigin).toBe(installation.origin)
  128 |   const url = new URL(binding.mount + "/api/ui/context", binding.publicOrigin)
  129 |   url.search = new URLSearchParams({ installationId: binding.installationId, projectId: binding.projectId, hostId: binding.hostId }).toString()
  130 |   const contextResponse = await page.request.get(url.toString())
  131 |   expect(contextResponse.status()).toBe(200)
  132 |   const context = Schema.decodeUnknownSync(SfContextResult)(await contextResponse.json())
  133 |   if (context.status !== "ok") throw new Error("The private proposal operator did not receive original context admission")
  134 |   expect(context.value.stamp).toMatchObject({ installationId: binding.installationId, projectId: binding.projectId,
  135 |     hostId: binding.hostId, principalRef: host.actorId })
  136 |   await page.setViewportSize({ width: 1440, height: 900 })
  137 |   await page.goto(installation.origin + "/")
  138 |   const project = page.getByRole("button", { name: "Choose project", exact: true })
  139 |   await project.click()
  140 |   await page.locator('[data-component="orchestra-profile-picker"]').getByRole("menuitem", { name: "Add project", exact: true }).click()
  141 |   const folders = page.getByRole("dialog")
  142 |   await folders.getByPlaceholder("Search folders", { exact: true }).fill(installation.directory)
  143 |   await folders.locator(`[data-directory-path=${JSON.stringify(installation.directory)}]`).click()
  144 |   await expect(project.locator("small")).toHaveAttribute("title", installation.directory)
  145 | }
  146 | 
  147 | async function portAvailable() {
  148 |   const server = createServer()
  149 |   const available = await new Promise<boolean>((resolve, reject) => {
  150 |     server.once("error", (error: NodeJS.ErrnoException) => error.code === "EADDRINUSE" ? resolve(false) : reject(error))
  151 |     server.listen(4110, "localhost", () => resolve(true))
  152 |   })
  153 |   if (available) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  154 |   return available
  155 | }
  156 | 
```

## packages/app-shell/e2e/test-results/sucafina-dashboard-install-fe91b-e-current-base-is-confirmed-chromium/error-context.md

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sucafina/dashboard-installed/proposals.spec.ts >> Dashboard draft conflict reloads the same draft identity and preserves local edits until the current base is confirmed
- Location: e2e/sucafina/dashboard-installed/proposals.spec.ts:411:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-sf-private-proposal]').getByText('The original producer saved this private proposal.', { exact: true })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('[data-sf-private-proposal]').getByText('The original producer saved this private proposal.', { exact: true })

```

# Test source

```ts
  1   | import { expect, test, type Locator, type Page, type Response, type Route } from "@playwright/test"
  2   | import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"
  3   | import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical"
  4   | import { object } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract"
  5   | import { createProposalInstallation, enterProposalShell, proposalResponseBody, retainProposalResponse, withProposalHost } from "../proposals-support/installation"
  6   | import type { ProposalObservation } from "../proposals-support/protocol"
  7   | 
  8   | test.use({ trace: "off", screenshot: "off", video: "off" })
  9   | const currentLoaded = "Current proposal and source loaded. Review both before saving."
  10  | const retainedMessage = "Current options loaded. Your edits were retained."
  11  | const savedMessage = "The original producer saved this private proposal."
  12  | const confirmationLabel = "I reviewed the current proposal and source; keep my values against this base."
  13  | const reloadLabel = "Load current version and keep my edits"
  14  | const modeResponse = (mode: string) => (response: Response) => response.request().method() === "POST" &&
  15  |   new URL(response.url()).pathname === "/sucafina/dashboard" && new URL(response.url()).searchParams.get("sf") === mode
  16  | const modeUrl = (mode: string) => (url: URL) => url.pathname === "/sucafina/dashboard" && url.searchParams.get("sf") === mode
  17  | 
  18  | async function openProposal(page: Page, origin: string, reference = "new") {
  19  |   if (reference === "new") {
  20  |     expect((await page.goto(origin + "/orchestra/sf-dashboard/hot-topics?year=2026"))?.status()).toBe(200)
  21  |     const create = page.getByRole("button", { name: "New private proposal", exact: true })
  22  |     await expect(create).toBeEnabled()
  23  |     const [response] = await Promise.all([
  24  |       page.waitForResponse(modeResponse("dashboard-workbench")), create.click(),
  25  |     ])
  26  |     expect(response.status()).toBe(200)
  27  |     expect(object(proposalResponseBody(response)).status).toBe("ok")
  28  |   } else {
  29  |     const [response] = await Promise.all([
  30  |       page.waitForResponse(modeResponse("dashboard-workbench")),
  31  |       page.goto(origin + "/orchestra/sf-dashboard/hot-topics/proposals/" + encodeSfRouteRef(reference)),
  32  |     ])
  33  |     expect(response.status()).toBe(200)
  34  |     expect(object(proposalResponseBody(response)).status).toBe("ok")
  35  |   }
  36  |   const panel = page.locator("[data-sf-private-proposal]")
  37  |   await expect(panel).toBeVisible()
  38  |   await expect(panel).not.toContainText("Unrelated confidential case")
  39  |   return panel
  40  | }
  41  | async function chooseNew(panel: Locator, sourceLabel = "Original action") {
  42  |   try {
  43  |     await panel.getByLabel("Select case", { exact: true }).selectOption({ label: "Review the action" })
  44  |     await panel.getByLabel("Select source record", { exact: true }).selectOption({ label: sourceLabel })
  45  |   } catch (error) {
  46  |     console.info("SF_PROPOSAL_SELECTION_STATE", JSON.stringify({
  47  |       labels: await panel.locator("label").allTextContents(),
  48  |       text: (await panel.textContent())?.slice(0, 2000),
  49  |     }))
  50  |     throw error
  51  |   }
  52  | }
  53  | async function saveDraft(page: Page, panel: Locator) {
  54  |   const [written, discovered] = await Promise.all([
  55  |     page.waitForResponse(modeResponse("dashboard-hot-topic-draft")),
  56  |     page.waitForResponse(modeResponse("dashboard-workbench")),
  57  |     panel.getByRole("button", { name: "Save proposal", exact: true }).click(),
  58  |   ])
  59  |   expect(written.status()).toBe(200)
  60  |   expect(object(proposalResponseBody(written)).status).toBe("ok")
  61  |   expect(discovered.status()).toBe(200)
  62  |   expect(object(proposalResponseBody(discovered)).status).toBe("ok")
> 63  |   await expect(panel.getByText(savedMessage, { exact: true })).toBeVisible()
      |                                                                ^ Error: expect(locator).toBeVisible() failed
  64  |   return written.request().postDataJSON() as Record<string, unknown>
  65  | }
  66  | function onlyDraft(observation: ProposalObservation) {
  67  |   expect(observation.preferences.status).toBe("ok")
  68  |   expect(observation.preferences.value?.drafts).toHaveLength(1)
  69  |   const draft = observation.preferences.value?.drafts[0]
  70  |   if (!draft) throw new Error("Original C08 private draft unavailable")
  71  |   return draft
  72  | }
  73  | 
  74  | async function prepareRecordAgenda(page: Page, origin: string) {
  75  |   expect((await page.goto(origin + "/orchestra/sf-reviews/agenda?year=2026"))?.status()).toBe(200)
  76  |   const agenda = page.locator('[data-sf-surface="UI47"]')
  77  |   await expect(agenda).toBeVisible()
  78  |   await agenda.getByLabel("Source dashboard page", { exact: true }).fill("Hot Topics & Actions")
  79  |   const found = page.waitForResponse((response) => response.request().method() === "GET" &&
  80  |     new URL(response.url()).pathname.endsWith("/api/ui/projections/review") &&
  81  |     new URL(response.url()).searchParams.get("page") === "Hot Topics & Actions")
  82  |   await agenda.getByRole("button", { name: "Find authorized sections", exact: true }).click()
  83  |   const discovery = await found
  84  |   expect(discovery.status()).toBe(200)
  85  |   const discovered = object(proposalResponseBody(discovery))
  86  |   expect(discovered.status).toBe("ok")
  87  |   expect(object(discovered.value).items).toHaveLength(1)
  88  |   await agenda.getByRole("button", { name: "Add to agenda", exact: true }).click()
  89  |   const selected = agenda.locator('[data-sf-agenda-order] [data-sf-record-id="topic"]')
  90  |   await expect(selected).toHaveCount(1)
  91  |   await expect(selected).toContainText("Original action")
  92  |   const pending = page.waitForResponse(modeResponse("dashboard-agenda"))
  93  |   await page.getByRole("button", { name: "Review selected sections", exact: true }).click()
  94  |   const response = await pending
  95  |   expect(response.status()).toBe(200)
  96  |   const preview = object(proposalResponseBody(response))
  97  |   expect(preview.status).toBe("ok")
  98  |   const sections = object(preview.value).sections
  99  |   expect(sections).toHaveLength(1)
  100 |   expect(object((sections as unknown[])[0]).recordCount).toBe(1)
  101 |   const shown = agenda.locator("[data-sf-agenda-preview]")
  102 |   await expect(shown).toContainText("Original action")
  103 |   return { agenda, shown, preview: object(preview.value) }
  104 | }
  105 | 
  106 | async function expectPreservationWithdrawn(page: Page, origin: string) {
  107 |   expect((await page.goto(origin + "/orchestra/sf-dashboard/hot-topics/" + encodeSfRouteRef("topic") + "?year=2026"))?.status()).toBe(200)
  108 |   const capture = page.locator("[data-sf-record-capture]")
  109 |   await expect(capture).toBeVisible()
  110 |   await expect(capture).toContainText("Original action")
  111 |   await expect(capture.getByRole("button", { name: "Preserve this record", exact: true })).toBeDisabled()
  112 | }
  113 | 
  114 | // Ports the original consumer-read journeys intact to the installed chapter.
  115 | // Every success, conflict and denial comes from the real producer and SQLite.
  116 | test("Dashboard reads the current source and active private proposal while preserving dirty values until explicit review", async ({ browser }, info) => {
  117 |   const installation = await createProposalInstallation(), errors: string[] = []
  118 |   try {
  119 |     await withProposalHost(installation, info, async (host) => {
  120 |       const context = await browser.newContext()
  121 |       context.setDefaultTimeout(10000)
  122 |       context.setDefaultNavigationTimeout(15000)
  123 |       try {
  124 |         const page = await context.newPage()
  125 |         page.on("pageerror", (error) => errors.push(error.message))
  126 |         await enterProposalShell(page, installation, host)
  127 |         const panel = await openProposal(page, installation.origin)
  128 |         await chooseNew(panel)
  129 |         await panel.getByLabel("Action", { exact: true }).fill("Initially saved proposal")
  130 |         await panel.getByLabel("Notes", { exact: true }).fill("Initially saved private context")
  131 |         await saveDraft(page, panel)
  132 |         const initial = onlyDraft(await host.control())
  133 |         const original = structuredClone(initial)
  134 |         await panel.getByLabel("Action", { exact: true }).fill("My retained action")
  135 |         await panel.getByLabel("Notes", { exact: true }).fill("My retained explanation")
  136 | 
  137 |         const other = await context.newPage()
  138 |         other.on("pageerror", (error) => errors.push(error.message))
  139 |         const otherPanel = await openProposal(other, installation.origin, original.draftRef)
  140 |         await otherPanel.getByLabel("Action", { exact: true }).fill("Active proposal from another page")
  141 |         await otherPanel.getByLabel("Notes", { exact: true }).fill("Current private proposal context")
  142 |         const secondWrite = await saveDraft(other, otherPanel)
  143 |         expect(secondWrite.expectedVersion).toBe(1)
  144 | 
  145 |         const [stale] = await Promise.all([
  146 |           page.waitForResponse(modeResponse("dashboard-hot-topic-draft")),
  147 |           panel.getByRole("button", { name: "Save proposal", exact: true }).click(),
  148 |         ])
  149 |         expect(stale.status()).toBe(409)
  150 |         expect(stale.request().postDataJSON()).toMatchObject({
  151 |           draftRef: original.draftRef, expectedVersion: 1, targetEvidence: original.targetEvidence,
  152 |         })
  153 |         await expect(panel.getByText("This topic changed. Review the current version before saving.", { exact: true })).toBeVisible()
  154 | 
  155 |         const activeKey = "sf:proposal-coverage:hot-topic:active:" + digestSfValue(original.id)
  156 |         const observation = await host.control()
  157 |         expect(observation.preferences.value?.keys).toContain(activeKey)
  158 |         const active = onlyDraft(observation)
  159 |         expect(active).toMatchObject({ id: original.id, incarnation: original.incarnation, version: 2,
  160 |           fields: { action: "Active proposal from another page", notes: "Current private proposal context" } })
  161 |         const changed = await page.request.post(installation.origin + "/sucafina/dashboard", {
  162 |           headers: { origin: installation.origin }, data: {
  163 |             page: "Hot Topics & Actions", action: "save", id: "topic", version: 0,
```

## Bounded step outcomes
[]

