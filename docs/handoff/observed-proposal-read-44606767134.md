# Proposal native read observation

Original run 44606767134, artifact 14571166555. Read-only diagnostic, no rerun and no product assertion changed.

## packages/app-shell/e2e/test-results/sucafina-dashboard-install-66700-alues-until-explicit-review-chromium/error-context.md

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sucafina/dashboard-installed/proposals.spec.ts >> Dashboard reads the current source and active private proposal while preserving dirty values until explicit review
- Location: e2e/sucafina/dashboard-installed/proposals.spec.ts:100:1

# Error details

```
TimeoutError: locator.selectOption: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('[data-sf-private-proposal]').getByLabel('Select case', { exact: true })

```

# Test source

```ts
  1   | import { expect, test, type Locator, type Page, type Response, type Route } from "@playwright/test"
  2   | import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"
  3   | import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical"
  4   | import { object } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract"
  5   | import { createProposalInstallation, enterProposalShell, withProposalHost } from "../proposals-support/installation"
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
  27  |     expect(object(await response.json()).status).toBe("ok")
  28  |   } else {
  29  |     const [response] = await Promise.all([
  30  |       page.waitForResponse(modeResponse("dashboard-workbench")),
  31  |       page.goto(origin + "/orchestra/sf-dashboard/hot-topics/proposals/" + encodeSfRouteRef(reference)),
  32  |     ])
  33  |     expect(response.status()).toBe(200)
  34  |     expect(object(await response.json()).status).toBe("ok")
  35  |   }
  36  |   const panel = page.locator("[data-sf-private-proposal]")
  37  |   await expect(panel).toBeVisible()
  38  |   await expect(panel).not.toContainText("Unrelated confidential case")
  39  |   return panel
  40  | }
  41  | async function chooseNew(panel: Locator) {
> 42  |   await panel.getByLabel("Select case", { exact: true }).selectOption({ label: "Review the action" })
      |                                                          ^ TimeoutError: locator.selectOption: Timeout 10000ms exceeded.
  43  |   await panel.getByLabel("Select source record", { exact: true }).selectOption({ label: "Original action" })
  44  | }
  45  | async function saveDraft(page: Page, panel: Locator) {
  46  |   const [written, discovered] = await Promise.all([
  47  |     page.waitForResponse(modeResponse("dashboard-hot-topic-draft")),
  48  |     page.waitForResponse(modeResponse("dashboard-workbench")),
  49  |     panel.getByRole("button", { name: "Save proposal", exact: true }).click(),
  50  |   ])
  51  |   expect(written.status()).toBe(200)
  52  |   expect(object(await written.json()).status).toBe("ok")
  53  |   expect(discovered.status()).toBe(200)
  54  |   expect(object(await discovered.json()).status).toBe("ok")
  55  |   await expect(panel.getByText(savedMessage, { exact: true })).toBeVisible()
  56  |   return written.request().postDataJSON() as Record<string, unknown>
  57  | }
  58  | function onlyDraft(observation: ProposalObservation) {
  59  |   expect(observation.preferences.status).toBe("ok")
  60  |   expect(observation.preferences.value?.drafts).toHaveLength(1)
  61  |   const draft = observation.preferences.value?.drafts[0]
  62  |   if (!draft) throw new Error("Original C08 private draft unavailable")
  63  |   return draft
  64  | }
  65  | 
  66  | async function expectPreservationWithdrawn(page: Page, origin: string) {
  67  |   expect((await page.goto(origin + "/orchestra/sf-reviews/agenda?year=2026"))?.status()).toBe(200)
  68  |   const agenda = page.locator('[data-sf-surface="UI47"]')
  69  |   await expect(agenda).toBeVisible()
  70  |   await agenda.getByLabel("Source dashboard page", { exact: true }).fill("Hot Topics & Actions")
  71  |   const found = page.waitForResponse((response) => response.request().method() === "GET" &&
  72  |     new URL(response.url()).pathname.endsWith("/api/ui/projections/review") &&
  73  |     new URL(response.url()).searchParams.get("page") === "Hot Topics & Actions")
  74  |   await agenda.getByRole("button", { name: "Find authorized sections", exact: true }).click()
  75  |   const discovery = await found
  76  |   expect(discovery.status()).toBe(200)
  77  |   const discovered = object(await discovery.json())
  78  |   expect(discovered.status).toBe("ok")
  79  |   expect(object(discovered.value).items).toHaveLength(1)
  80  |   await agenda.getByRole("button", { name: "Add to agenda", exact: true }).click()
  81  |   const selected = agenda.locator('[data-sf-agenda-order] [data-sf-record-id="topic"]')
  82  |   await expect(selected).toHaveCount(1)
  83  |   await expect(selected).toContainText("Original action")
  84  |   const pending = page.waitForResponse(modeResponse("dashboard-agenda"))
  85  |   await page.getByRole("button", { name: "Review selected sections", exact: true }).click()
  86  |   const response = await pending
  87  |   expect(response.status()).toBe(200)
  88  |   const preview = object(await response.json())
  89  |   expect(preview.status).toBe("ok")
  90  |   const sections = object(preview.value).sections
  91  |   expect(sections).toHaveLength(1)
  92  |   expect(object((sections as unknown[])[0]).recordCount).toBe(1)
  93  |   const shown = agenda.locator("[data-sf-agenda-preview]")
  94  |   await expect(shown).toContainText("Original action")
  95  |   await expect(shown.getByRole("button", { name: "Confirm preservation", exact: true })).toBeDisabled()
  96  | }
  97  | 
  98  | // Ports the original consumer-read journeys intact to the installed chapter.
  99  | // Every success, conflict and denial comes from the real producer and SQLite.
  100 | test("Dashboard reads the current source and active private proposal while preserving dirty values until explicit review", async ({ browser }, info) => {
  101 |   const installation = await createProposalInstallation(), errors: string[] = []
  102 |   try {
  103 |     await withProposalHost(installation, info, async (host) => {
  104 |       const context = await browser.newContext()
  105 |       context.setDefaultTimeout(10000)
  106 |       context.setDefaultNavigationTimeout(15000)
  107 |       try {
  108 |         const page = await context.newPage()
  109 |         page.on("pageerror", (error) => errors.push(error.message))
  110 |         await enterProposalShell(page, installation, host)
  111 |         const panel = await openProposal(page, installation.origin)
  112 |         await chooseNew(panel)
  113 |         await panel.getByLabel("Action", { exact: true }).fill("Initially saved proposal")
  114 |         await panel.getByLabel("Notes", { exact: true }).fill("Initially saved private context")
  115 |         await saveDraft(page, panel)
  116 |         const initial = onlyDraft(await host.control())
  117 |         const original = structuredClone(initial)
  118 |         await panel.getByLabel("Action", { exact: true }).fill("My retained action")
  119 |         await panel.getByLabel("Notes", { exact: true }).fill("My retained explanation")
  120 | 
  121 |         const other = await context.newPage()
  122 |         other.on("pageerror", (error) => errors.push(error.message))
  123 |         const otherPanel = await openProposal(other, installation.origin, original.draftRef)
  124 |         await otherPanel.getByLabel("Action", { exact: true }).fill("Active proposal from another page")
  125 |         await otherPanel.getByLabel("Notes", { exact: true }).fill("Current private proposal context")
  126 |         const secondWrite = await saveDraft(other, otherPanel)
  127 |         expect(secondWrite.expectedVersion).toBe(1)
  128 | 
  129 |         const [stale] = await Promise.all([
  130 |           page.waitForResponse(modeResponse("dashboard-hot-topic-draft")),
  131 |           panel.getByRole("button", { name: "Save proposal", exact: true }).click(),
  132 |         ])
  133 |         expect(stale.status()).toBe(409)
  134 |         expect(stale.request().postDataJSON()).toMatchObject({
  135 |           draftRef: original.draftRef, expectedVersion: 1, targetEvidence: original.targetEvidence,
  136 |         })
  137 |         await expect(panel.getByText("This topic changed. Review the current version before saving.", { exact: true })).toBeVisible()
  138 | 
  139 |         const activeKey = "sf:proposal-coverage:hot-topic:active:" + digestSfValue(original.id)
  140 |         const observation = await host.control()
  141 |         expect(observation.preferences.value?.keys).toContain(activeKey)
  142 |         const active = onlyDraft(observation)
```

## packages/app-shell/e2e/test-results/sucafina-dashboard-install-67ccc-rite-authority-is-withdrawn-chromium/error-context.md

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sucafina/dashboard-installed/proposals.spec.ts >> Dashboard contextual draft retains edits when current write authority is withdrawn
- Location: e2e/sucafina/dashboard-installed/proposals.spec.ts:336:1

# Error details

```
TimeoutError: locator.selectOption: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('[data-sf-private-proposal]').getByLabel('Select case', { exact: true })

```

# Test source

```ts
  1   | import { expect, test, type Locator, type Page, type Response, type Route } from "@playwright/test"
  2   | import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"
  3   | import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical"
  4   | import { object } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract"
  5   | import { createProposalInstallation, enterProposalShell, withProposalHost } from "../proposals-support/installation"
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
  27  |     expect(object(await response.json()).status).toBe("ok")
  28  |   } else {
  29  |     const [response] = await Promise.all([
  30  |       page.waitForResponse(modeResponse("dashboard-workbench")),
  31  |       page.goto(origin + "/orchestra/sf-dashboard/hot-topics/proposals/" + encodeSfRouteRef(reference)),
  32  |     ])
  33  |     expect(response.status()).toBe(200)
  34  |     expect(object(await response.json()).status).toBe("ok")
  35  |   }
  36  |   const panel = page.locator("[data-sf-private-proposal]")
  37  |   await expect(panel).toBeVisible()
  38  |   await expect(panel).not.toContainText("Unrelated confidential case")
  39  |   return panel
  40  | }
  41  | async function chooseNew(panel: Locator) {
> 42  |   await panel.getByLabel("Select case", { exact: true }).selectOption({ label: "Review the action" })
      |                                                          ^ TimeoutError: locator.selectOption: Timeout 10000ms exceeded.
  43  |   await panel.getByLabel("Select source record", { exact: true }).selectOption({ label: "Original action" })
  44  | }
  45  | async function saveDraft(page: Page, panel: Locator) {
  46  |   const [written, discovered] = await Promise.all([
  47  |     page.waitForResponse(modeResponse("dashboard-hot-topic-draft")),
  48  |     page.waitForResponse(modeResponse("dashboard-workbench")),
  49  |     panel.getByRole("button", { name: "Save proposal", exact: true }).click(),
  50  |   ])
  51  |   expect(written.status()).toBe(200)
  52  |   expect(object(await written.json()).status).toBe("ok")
  53  |   expect(discovered.status()).toBe(200)
  54  |   expect(object(await discovered.json()).status).toBe("ok")
  55  |   await expect(panel.getByText(savedMessage, { exact: true })).toBeVisible()
  56  |   return written.request().postDataJSON() as Record<string, unknown>
  57  | }
  58  | function onlyDraft(observation: ProposalObservation) {
  59  |   expect(observation.preferences.status).toBe("ok")
  60  |   expect(observation.preferences.value?.drafts).toHaveLength(1)
  61  |   const draft = observation.preferences.value?.drafts[0]
  62  |   if (!draft) throw new Error("Original C08 private draft unavailable")
  63  |   return draft
  64  | }
  65  | 
  66  | async function expectPreservationWithdrawn(page: Page, origin: string) {
  67  |   expect((await page.goto(origin + "/orchestra/sf-reviews/agenda?year=2026"))?.status()).toBe(200)
  68  |   const agenda = page.locator('[data-sf-surface="UI47"]')
  69  |   await expect(agenda).toBeVisible()
  70  |   await agenda.getByLabel("Source dashboard page", { exact: true }).fill("Hot Topics & Actions")
  71  |   const found = page.waitForResponse((response) => response.request().method() === "GET" &&
  72  |     new URL(response.url()).pathname.endsWith("/api/ui/projections/review") &&
  73  |     new URL(response.url()).searchParams.get("page") === "Hot Topics & Actions")
  74  |   await agenda.getByRole("button", { name: "Find authorized sections", exact: true }).click()
  75  |   const discovery = await found
  76  |   expect(discovery.status()).toBe(200)
  77  |   const discovered = object(await discovery.json())
  78  |   expect(discovered.status).toBe("ok")
  79  |   expect(object(discovered.value).items).toHaveLength(1)
  80  |   await agenda.getByRole("button", { name: "Add to agenda", exact: true }).click()
  81  |   const selected = agenda.locator('[data-sf-agenda-order] [data-sf-record-id="topic"]')
  82  |   await expect(selected).toHaveCount(1)
  83  |   await expect(selected).toContainText("Original action")
  84  |   const pending = page.waitForResponse(modeResponse("dashboard-agenda"))
  85  |   await page.getByRole("button", { name: "Review selected sections", exact: true }).click()
  86  |   const response = await pending
  87  |   expect(response.status()).toBe(200)
  88  |   const preview = object(await response.json())
  89  |   expect(preview.status).toBe("ok")
  90  |   const sections = object(preview.value).sections
  91  |   expect(sections).toHaveLength(1)
  92  |   expect(object((sections as unknown[])[0]).recordCount).toBe(1)
  93  |   const shown = agenda.locator("[data-sf-agenda-preview]")
  94  |   await expect(shown).toContainText("Original action")
  95  |   await expect(shown.getByRole("button", { name: "Confirm preservation", exact: true })).toBeDisabled()
  96  | }
  97  | 
  98  | // Ports the original consumer-read journeys intact to the installed chapter.
  99  | // Every success, conflict and denial comes from the real producer and SQLite.
  100 | test("Dashboard reads the current source and active private proposal while preserving dirty values until explicit review", async ({ browser }, info) => {
  101 |   const installation = await createProposalInstallation(), errors: string[] = []
  102 |   try {
  103 |     await withProposalHost(installation, info, async (host) => {
  104 |       const context = await browser.newContext()
  105 |       context.setDefaultTimeout(10000)
  106 |       context.setDefaultNavigationTimeout(15000)
  107 |       try {
  108 |         const page = await context.newPage()
  109 |         page.on("pageerror", (error) => errors.push(error.message))
  110 |         await enterProposalShell(page, installation, host)
  111 |         const panel = await openProposal(page, installation.origin)
  112 |         await chooseNew(panel)
  113 |         await panel.getByLabel("Action", { exact: true }).fill("Initially saved proposal")
  114 |         await panel.getByLabel("Notes", { exact: true }).fill("Initially saved private context")
  115 |         await saveDraft(page, panel)
  116 |         const initial = onlyDraft(await host.control())
  117 |         const original = structuredClone(initial)
  118 |         await panel.getByLabel("Action", { exact: true }).fill("My retained action")
  119 |         await panel.getByLabel("Notes", { exact: true }).fill("My retained explanation")
  120 | 
  121 |         const other = await context.newPage()
  122 |         other.on("pageerror", (error) => errors.push(error.message))
  123 |         const otherPanel = await openProposal(other, installation.origin, original.draftRef)
  124 |         await otherPanel.getByLabel("Action", { exact: true }).fill("Active proposal from another page")
  125 |         await otherPanel.getByLabel("Notes", { exact: true }).fill("Current private proposal context")
  126 |         const secondWrite = await saveDraft(other, otherPanel)
  127 |         expect(secondWrite.expectedVersion).toBe(1)
  128 | 
  129 |         const [stale] = await Promise.all([
  130 |           page.waitForResponse(modeResponse("dashboard-hot-topic-draft")),
  131 |           panel.getByRole("button", { name: "Save proposal", exact: true }).click(),
  132 |         ])
  133 |         expect(stale.status()).toBe(409)
  134 |         expect(stale.request().postDataJSON()).toMatchObject({
  135 |           draftRef: original.draftRef, expectedVersion: 1, targetEvidence: original.targetEvidence,
  136 |         })
  137 |         await expect(panel.getByText("This topic changed. Review the current version before saving.", { exact: true })).toBeVisible()
  138 | 
  139 |         const activeKey = "sf:proposal-coverage:hot-topic:active:" + digestSfValue(original.id)
  140 |         const observation = await host.control()
  141 |         expect(observation.preferences.value?.keys).toContain(activeKey)
  142 |         const active = onlyDraft(observation)
```

## packages/app-shell/e2e/test-results/sucafina-dashboard-install-77a3c-re-purging-actual-read-loss-chromium/error-context.md

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sucafina/dashboard-installed/proposals.spec.ts >> Dashboard keeps dirty values through interrupted reads and fences write withdrawal between admissions before purging actual read loss
- Location: e2e/sucafina/dashboard-installed/proposals.spec.ts:204:1

# Error details

```
Error: response.json: Protocol error (Network.getResponseBody): No data found for resource with given identifier
```

# Test source

```ts
  1   | import { expect, test, type Locator, type Page, type Response, type Route } from "@playwright/test"
  2   | import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"
  3   | import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical"
  4   | import { object } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract"
  5   | import { createProposalInstallation, enterProposalShell, withProposalHost } from "../proposals-support/installation"
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
> 27  |     expect(object(await response.json()).status).toBe("ok")
      |                                  ^ Error: response.json: Protocol error (Network.getResponseBody): No data found for resource with given identifier
  28  |   } else {
  29  |     const [response] = await Promise.all([
  30  |       page.waitForResponse(modeResponse("dashboard-workbench")),
  31  |       page.goto(origin + "/orchestra/sf-dashboard/hot-topics/proposals/" + encodeSfRouteRef(reference)),
  32  |     ])
  33  |     expect(response.status()).toBe(200)
  34  |     expect(object(await response.json()).status).toBe("ok")
  35  |   }
  36  |   const panel = page.locator("[data-sf-private-proposal]")
  37  |   await expect(panel).toBeVisible()
  38  |   await expect(panel).not.toContainText("Unrelated confidential case")
  39  |   return panel
  40  | }
  41  | async function chooseNew(panel: Locator) {
  42  |   await panel.getByLabel("Select case", { exact: true }).selectOption({ label: "Review the action" })
  43  |   await panel.getByLabel("Select source record", { exact: true }).selectOption({ label: "Original action" })
  44  | }
  45  | async function saveDraft(page: Page, panel: Locator) {
  46  |   const [written, discovered] = await Promise.all([
  47  |     page.waitForResponse(modeResponse("dashboard-hot-topic-draft")),
  48  |     page.waitForResponse(modeResponse("dashboard-workbench")),
  49  |     panel.getByRole("button", { name: "Save proposal", exact: true }).click(),
  50  |   ])
  51  |   expect(written.status()).toBe(200)
  52  |   expect(object(await written.json()).status).toBe("ok")
  53  |   expect(discovered.status()).toBe(200)
  54  |   expect(object(await discovered.json()).status).toBe("ok")
  55  |   await expect(panel.getByText(savedMessage, { exact: true })).toBeVisible()
  56  |   return written.request().postDataJSON() as Record<string, unknown>
  57  | }
  58  | function onlyDraft(observation: ProposalObservation) {
  59  |   expect(observation.preferences.status).toBe("ok")
  60  |   expect(observation.preferences.value?.drafts).toHaveLength(1)
  61  |   const draft = observation.preferences.value?.drafts[0]
  62  |   if (!draft) throw new Error("Original C08 private draft unavailable")
  63  |   return draft
  64  | }
  65  | 
  66  | async function expectPreservationWithdrawn(page: Page, origin: string) {
  67  |   expect((await page.goto(origin + "/orchestra/sf-reviews/agenda?year=2026"))?.status()).toBe(200)
  68  |   const agenda = page.locator('[data-sf-surface="UI47"]')
  69  |   await expect(agenda).toBeVisible()
  70  |   await agenda.getByLabel("Source dashboard page", { exact: true }).fill("Hot Topics & Actions")
  71  |   const found = page.waitForResponse((response) => response.request().method() === "GET" &&
  72  |     new URL(response.url()).pathname.endsWith("/api/ui/projections/review") &&
  73  |     new URL(response.url()).searchParams.get("page") === "Hot Topics & Actions")
  74  |   await agenda.getByRole("button", { name: "Find authorized sections", exact: true }).click()
  75  |   const discovery = await found
  76  |   expect(discovery.status()).toBe(200)
  77  |   const discovered = object(await discovery.json())
  78  |   expect(discovered.status).toBe("ok")
  79  |   expect(object(discovered.value).items).toHaveLength(1)
  80  |   await agenda.getByRole("button", { name: "Add to agenda", exact: true }).click()
  81  |   const selected = agenda.locator('[data-sf-agenda-order] [data-sf-record-id="topic"]')
  82  |   await expect(selected).toHaveCount(1)
  83  |   await expect(selected).toContainText("Original action")
  84  |   const pending = page.waitForResponse(modeResponse("dashboard-agenda"))
  85  |   await page.getByRole("button", { name: "Review selected sections", exact: true }).click()
  86  |   const response = await pending
  87  |   expect(response.status()).toBe(200)
  88  |   const preview = object(await response.json())
  89  |   expect(preview.status).toBe("ok")
  90  |   const sections = object(preview.value).sections
  91  |   expect(sections).toHaveLength(1)
  92  |   expect(object((sections as unknown[])[0]).recordCount).toBe(1)
  93  |   const shown = agenda.locator("[data-sf-agenda-preview]")
  94  |   await expect(shown).toContainText("Original action")
  95  |   await expect(shown.getByRole("button", { name: "Confirm preservation", exact: true })).toBeDisabled()
  96  | }
  97  | 
  98  | // Ports the original consumer-read journeys intact to the installed chapter.
  99  | // Every success, conflict and denial comes from the real producer and SQLite.
  100 | test("Dashboard reads the current source and active private proposal while preserving dirty values until explicit review", async ({ browser }, info) => {
  101 |   const installation = await createProposalInstallation(), errors: string[] = []
  102 |   try {
  103 |     await withProposalHost(installation, info, async (host) => {
  104 |       const context = await browser.newContext()
  105 |       context.setDefaultTimeout(10000)
  106 |       context.setDefaultNavigationTimeout(15000)
  107 |       try {
  108 |         const page = await context.newPage()
  109 |         page.on("pageerror", (error) => errors.push(error.message))
  110 |         await enterProposalShell(page, installation, host)
  111 |         const panel = await openProposal(page, installation.origin)
  112 |         await chooseNew(panel)
  113 |         await panel.getByLabel("Action", { exact: true }).fill("Initially saved proposal")
  114 |         await panel.getByLabel("Notes", { exact: true }).fill("Initially saved private context")
  115 |         await saveDraft(page, panel)
  116 |         const initial = onlyDraft(await host.control())
  117 |         const original = structuredClone(initial)
  118 |         await panel.getByLabel("Action", { exact: true }).fill("My retained action")
  119 |         await panel.getByLabel("Notes", { exact: true }).fill("My retained explanation")
  120 | 
  121 |         const other = await context.newPage()
  122 |         other.on("pageerror", (error) => errors.push(error.message))
  123 |         const otherPanel = await openProposal(other, installation.origin, original.draftRef)
  124 |         await otherPanel.getByLabel("Action", { exact: true }).fill("Active proposal from another page")
  125 |         await otherPanel.getByLabel("Notes", { exact: true }).fill("Current private proposal context")
  126 |         const secondWrite = await saveDraft(other, otherPanel)
  127 |         expect(secondWrite.expectedVersion).toBe(1)
```

## Bounded step outcomes
[]

