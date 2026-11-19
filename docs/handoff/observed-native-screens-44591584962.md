# Original native screen observations

Read-only extraction from already completed Actions; no tests rerun.

## Run 44591584962; artifact 14562244092

Screen context files: 1

### packages/app-shell/e2e/test-results/sucafina-bi-installed-inst-92835-TTP-outcome-before-BI-setup-chromium/error-context.md

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sucafina/bi-installed/installed-planner-ingress.spec.ts >> BI62 installed Planner first save exposes its real HTTP outcome before BI setup
- Location: e2e/sucafina/bi-installed/installed-planner-ingress.spec.ts:15:1

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('tr[data-sf-row="7d921133-598c-4e2c-926d-bdecc0ae3637"]')
Expected: 1
Received: 0
Timeout:  10000ms

Call log:
  - Expect "toHaveCount" with timeout 10000ms
  - waiting for locator('tr[data-sf-row="7d921133-598c-4e2c-926d-bdecc0ae3637"]')
    14 × locator resolved to 0 elements
       - unexpected value "0"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - banner [ref=e4]:
      - generic [ref=e5]:
        - generic [ref=e6]: DEV
        - generic:
          - generic: Orchestra
          - generic: /
          - generic "Versions"
        - button "Dark" [ref=e7] [cursor=pointer]:
          - img [ref=e8]
    - generic [ref=e10]:
      - complementary "Repositories" [ref=e11]:
        - generic [ref=e12]:
          - img "HuGR" [ref=e13]
          - generic [ref=e14]: Orchestra
        - button "Collapse sidebar" [expanded] [ref=e15] [cursor=pointer]:
          - img [ref=e16]
        - navigation [ref=e19]:
          - button "Home" [ref=e20] [cursor=pointer]:
            - img [ref=e21]
            - generic [ref=e23]: Home
          - button "Chat" [ref=e24] [cursor=pointer]:
            - img [ref=e25]
            - generic [ref=e27]: Chat
          - button "Inbox" [ref=e28] [cursor=pointer]:
            - img [ref=e29]
            - generic [ref=e32]: Inbox
          - button "Project Board" [ref=e33] [cursor=pointer]:
            - img [ref=e34]
            - generic [ref=e38]: Project Board
          - button "Agents" [ref=e39] [cursor=pointer]:
            - img [ref=e40]
            - generic [ref=e44]: Agents
          - button "Actions" [ref=e45] [cursor=pointer]:
            - img [ref=e46]
            - generic [ref=e51]: Actions
          - button "Extensions" [disabled] [expanded] [ref=e53] [cursor=pointer]:
            - generic [ref=e54]: Extensions
            - img [ref=e55]
          - generic [ref=e57]:
            - button "Today" [ref=e58] [cursor=pointer]:
              - img [ref=e59]
              - generic [ref=e62]: Today
            - button "Decisions" [ref=e63] [cursor=pointer]:
              - img [ref=e64]
              - generic [ref=e67]: Decisions
            - button "Executive Dashboard" [ref=e68] [cursor=pointer]:
              - img [ref=e69]
              - generic [ref=e74]: Executive Dashboard
            - button "Headcount Overview" [ref=e75] [cursor=pointer]:
              - img [ref=e76]
              - generic [ref=e81]: Headcount Overview
            - button "IT Operations" [ref=e82] [cursor=pointer]:
              - img [ref=e83]
              - generic [ref=e87]: IT Operations
            - button "Portfolio Dashboard" [ref=e88] [cursor=pointer]:
              - img [ref=e89]
              - generic [ref=e91]: Portfolio Dashboard
            - button "Requests" [ref=e92] [cursor=pointer]:
              - img [ref=e93]
              - generic [ref=e97]: Requests
            - button "Versions" [ref=e98] [cursor=pointer]:
              - img [ref=e99]
              - generic [ref=e103]: Versions
            - button "My work" [ref=e104] [cursor=pointer]:
              - img [ref=e105]
              - generic [ref=e109]: My work
            - button "Analytics" [ref=e110] [cursor=pointer]:
              - img [ref=e111]
              - generic [ref=e114]: Analytics
            - button "Meeting agenda" [ref=e115] [cursor=pointer]:
              - img [ref=e116]
              - generic [ref=e120]: Meeting agenda
            - button "Import file" [ref=e121] [cursor=pointer]:
              - img [ref=e122]
              - generic [ref=e125]: Import file
            - button "Documents" [ref=e126] [cursor=pointer]:
              - img [ref=e127]
              - generic [ref=e131]: Documents
            - button "Signals" [ref=e132] [cursor=pointer]:
              - img [ref=e133]
              - generic [ref=e137]: Signals
            - button "Routines" [ref=e138] [cursor=pointer]:
              - img [ref=e139]
              - generic [ref=e142]: Routines
            - button "Maestro" [ref=e143] [cursor=pointer]:
              - img [ref=e144]
              - generic [ref=e147]: Maestro
            - button "Flight Engineer" [ref=e148] [cursor=pointer]:
              - img [ref=e149]
              - generic [ref=e152]: Flight Engineer
            - button "Workflows" [ref=e153] [cursor=pointer]:
              - img [ref=e154]
              - generic [ref=e159]: Workflows
            - button "Atlas" [ref=e160] [cursor=pointer]:
              - img [ref=e161]
              - generic [ref=e164]: Atlas
            - button "Rag Studio" [ref=e165] [cursor=pointer]:
              - img [ref=e166]
              - generic [ref=e169]: Rag Studio
            - button "MCP" [ref=e170] [cursor=pointer]:
              - img [ref=e171]
              - generic [ref=e173]: MCP
            - button "Integrations" [ref=e174] [cursor=pointer]:
              - img [ref=e175]
              - generic [ref=e177]: Integrations
            - button "Skills" [ref=e178] [cursor=pointer]:
              - img [ref=e179]
              - generic [ref=e181]: Skills
            - button "Plugins" [ref=e182] [cursor=pointer]:
              - img [ref=e183]
              - generic [ref=e185]: Plugins
            - button "Hooks" [ref=e186] [cursor=pointer]:
              - img [ref=e187]
              - generic [ref=e190]: Hooks
            - button "Context savings" [ref=e191] [cursor=pointer]:
              - img [ref=e192]
              - generic [ref=e194]: Context savings
            - button "Schedule" [ref=e195] [cursor=pointer]:
              - img [ref=e196]
              - generic [ref=e199]: Schedule
            - button ".env" [ref=e200] [cursor=pointer]:
              - img [ref=e201]
              - generic [ref=e204]: .env
            - button "MCP Dock" [ref=e205] [cursor=pointer]:
              - img [ref=e206]
              - generic [ref=e208]: MCP Dock
            - button "Workspaces" [ref=e209] [cursor=pointer]:
              - img [ref=e210]
              - generic [ref=e212]: Workspaces
            - button "Search" [ref=e213] [cursor=pointer]:
              - img [ref=e214]
              - generic [ref=e217]: Search
              - generic [ref=e218]: Ctrl+K
          - button "Settings" [ref=e220] [cursor=pointer]:
            - img [ref=e221]
            - generic [ref=e225]: Settings
        - generic [ref=e226]:
          - button "Choose project" [ref=e227] [cursor=pointer]:
            - generic [ref=e229]: s
            - generic [ref=e230]:
              - strong [ref=e231]: sf-wp03-browser-5w4Se1
              - generic "/tmp/sf-wp03-browser-5w4Se1" [ref=e232]: 17 agents
            - generic [ref=e233]: ⌄
          - paragraph [ref=e234]: Build what matters. With agents.
      - main [ref=e236]:
        - generic [ref=e238]:
          - toolbar "Context and access" [ref=e239]:
            - button "Refresh access" [ref=e240] [cursor=pointer]
            - button "Sign out" [ref=e241] [cursor=pointer]
          - region "Versions" [ref=e243]:
            - generic [ref=e244]:
              - generic [ref=e245]:
                - generic [ref=e246]:
                  - generic [ref=e247]: ⁨sf-wp03-browser-5w4Se1⁩ · Versions
                  - heading "Versions" [level=1] [ref=e248]
                - button "Create version" [ref=e251] [cursor=pointer]
              - generic [ref=e252]:
                - generic [ref=e254]:
                  - term [ref=e255]: Year
                  - definition [ref=e256]: "2026"
                - generic [ref=e258]:
                  - button "Compare versions" [disabled] [ref=e260]
                  - button "Version" [ref=e262] [cursor=pointer]
                  - button "Import workbook" [disabled] [ref=e264]
                - region "No results for these filters." [ref=e266]:
                  - status [ref=e267]:
                    - paragraph [ref=e268]: No results for these filters.
                  - generic [ref=e270]:
                    - generic [ref=e272]:
                      - generic [ref=e273]: Unavailable
                      - combobox "Unavailable" [ref=e274]:
                        - option "Unavailable" [disabled] [selected]
                        - option "2027"
                    - region "No results for these filters." [ref=e276]:
                      - status [ref=e277]:
                        - paragraph [ref=e278]: No results for these filters.
  - generic:
    - region "Notifications alt+T"
```

# Test source

```ts
  70  |     if (isFirstSave(request)) lifecycle.outcome = { state: "failed", request }
  71  |   })
  72  |   page.on("console", (message) => {
  73  |     if (message.type() === "error" || message.type() === "warning")
  74  |       observations.push({ event: "browser-console", elapsedMs: Date.now() - began, type: message.type(), message: redact(message.text()) })
  75  |   })
  76  |   page.on("pageerror", (error) => observations.push({ event: "page-error", elapsedMs: Date.now() - began, message: redact(error.message) }))
  77  | 
  78  |   try {
  79  |     await installation.signIn(page)
  80  |     await test.step("open the real empty Planner and submit Create first version once", async () => {
  81  |       const opened = await page.goto(url)
  82  |       expect(opened?.status()).toBe(200)
  83  |       await expect(page.getByRole("heading", { name: "Versions", exact: true, level: 1 })).toBeVisible()
  84  |       const surface = page.locator('[data-sf-surface="CAP23"]')
  85  |       await expect(surface).toHaveCount(1)
  86  |       const source = await page.request.get(sourceUrl)
  87  |       expect(source.status()).toBe(200)
  88  |       const envelope = Schema.decodeUnknownSync(SfPlanner.operations["domain.page.CAP23"].output)(await source.json())
  89  |       expect(envelope.status).toBe("ok")
  90  |       if (envelope.status !== "ok") throw new Error("The initial Planner collection is unavailable")
  91  |       const projection = envelope.value
  92  |       expect(projection.data.versions).toEqual([])
  93  |       initial.ids = projection.data.versions.map((record) => record.id)
  94  |       const version = projection.versions["versions:first"]?.version ?? 0
  95  |       expect(typeof version).toBe("number")
  96  |       expect(Number.isSafeInteger(version) && Number(version) >= 0).toBe(true)
  97  |       initial.version = Number(version)
  98  |       const button = surface.getByRole("button", { name: "Create first version", exact: true })
  99  |       await expect(button).toBeEnabled()
  100 |       await button.click()
  101 |       const review = surface.locator('[data-component="sf-change-review"]')
  102 |       await expect(review).toHaveCount(1)

## Run 44590617991; artifact 14563577838

Screen context files: 1

### packages/app-shell/e2e/test-results/sucafina-wp10-composition--44d22-rough-the-real-installation-chromium/error-context.md

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sucafina/wp10/composition.spec.ts >> WP10 composes Dashboard, persisted Workbench decisions, Requests and BI through the real installation
- Location: e2e/sucafina/wp10/composition.spec.ts:33:1

# Error details

```
Error: locator.click: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Choose project', exact: true })

```

# Test source

```ts
  327 |           await table.scrollIntoViewIfNeeded()
  328 |         })
  329 | 
  330 |         let budgetBiSelection: string | undefined
  331 |         await observe("bi-table", async (record) => {
  332 |           const result = await openBudgetBi(page)
  333 |           budgetBiSelection = result.request.selectionRef
  334 |           record.facts.openHttp = 200
  335 |           record.facts.dataHttp = 200
  336 |           const panel = page.locator('[data-sf-catalog="UI46"]')
  337 |           expect(result.projection.context.surface).toBe("dashboard")
  338 |           expect(result.request.viewId).toBe("BI01")
  339 |           expect(result.request.period).toEqual({ start: "2027-01-01", end: "2027-12-31" })
  340 |           expect(result.projection.values).toHaveLength(48)
  341 |           await expect(panel.getByRole("heading", { name: "How do budget, actuals and outlook evolve?", exact: true }).first()).toBeVisible()
  342 |           const table = panel.getByRole("table", { name: "Authorized values and source references", exact: true })
  343 |           await expect(table.getByRole("columnheader")).toHaveText(["Measure", "Value", "Unit", "Period", "Granularity", "Evidence", "Source reference"])
  344 |           await expect(table.getByRole("row")).toHaveCount(49)
  345 |           const values = new Map(result.projection.values.map((value) => [value.id, value]))
  346 |           const rows = result.presentation.series.flatMap((series) => series.valueIds.map((id) => {
  347 |             const value = values.get(id)
  348 |             if (!value) throw new Error("The original presentation referenced an absent value")
  349 |             return { measure: series.label + " · " + value.id, granularity: value.granularity }
  350 |           }))
  351 |           expect(rows).toHaveLength(48)
  352 |           for (const [index, expected] of rows.entries()) {
  353 |             const cells = table.locator("tbody tr").nth(index).locator("td, th")
  354 |             await expect(cells.nth(0)).toHaveText(expected.measure)
  355 |             await expect(cells.nth(4)).toHaveText(expected.granularity)
  356 |           }
  357 |           await expect(table.getByRole("cell").filter({ hasText: "budget:2027-01:effective" })).toHaveCount(1)
  358 |           const limitations = panel.locator(".sf-bi-limitations").getByRole("listitem")
  359 |           await expect(limitations).toHaveText(result.presentation.limitations)
  360 |           expect(result.presentation.limitations).toContain("Currency is unspecified in Dashboard; missing actual or forecast stays unknown.")
  361 |           record.facts.viewId = "BI01"
  362 |           record.facts.period = "2027-01-01/2027-12-31"
  363 |           record.facts.projectionRows = result.projection.values.length
  364 |           record.facts.dataStatus = "authorized-projection-rendered"
  365 |           record.facts.limitations = result.presentation.limitations
  366 |           const invalid = await context.request.get(origin + "/sucafina/dashboard?sf=bi-data&unexpected=1")
  367 |           const refused: unknown = await invalid.json()
  368 |           record.facts.invalidSelectionHttp = invalid.status()
  369 |           record.facts.invalidSelectionStatus = statusOf(refused)
  370 |           record.facts.invalidSelectionReason = reasonOf(refused)
  371 |           expect(invalid.status(), "The real host refuses an unsupported selection query").toBe(400)
  372 |           expect(statusOf(refused)).toBe("needs-input")
  373 |           expect(reasonOf(refused)).toBe("invalid-query")
  374 |           await table.scrollIntoViewIfNeeded()
  375 |         })
  376 | 
  377 |         let reviewRevocationUrl: string | undefined
  378 |         await observe("extended-ui", async (record) => {
  379 |           const facts = await qualifyWp10ExtendedUi({ page, origin, testInfo })
  380 |           Object.assign(record.facts, facts)
  381 |           if (typeof facts.reviewRevocationUrl === "string") reviewRevocationUrl = facts.reviewRevocationUrl
  382 |         })
  383 | 
  384 |         await observe("bi-revocation", async (record) => {
  385 |           if (!reviewRevocationUrl) throw new Error("A preserved review is required for the revocation proof")
  386 |           const reviewPrivacy = await prepareWp10ReviewRevocation({ context, url: reviewRevocationUrl, testInfo })
  387 |           try {
  388 |             if (!budgetBiSelection) throw new Error("The original BI01 selector is required for reload and revocation")
  389 |             await openBudgetBi(page, budgetBiSelection)
  390 |             const panel = page.locator('[data-sf-catalog="UI46"]')
  391 |             await expect(panel.getByRole("table", { name: "Authorized values and source references", exact: true })).toBeVisible()
  392 |             expect(await panel.locator('[data-sf-field="selection"] option').count()).toBeGreaterThan(1)
  393 |             const logout = await context.request.post(origin + "/sucafina/auth/logout", { headers: { origin } })
  394 |             record.facts.logoutHttp = logout.status()
  395 |             expect(logout.status()).toBe(204)
  396 |             const rejected = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "bi-options")
  397 |             await panel.getByRole("button", { name: "Choose context", exact: true }).click()
  398 |             record.facts.recheckHttp = (await rejected).status()
  399 |             expect([401, 403]).toContain(record.facts.recheckHttp)
  400 |             await expect(panel).toContainText(/Sign in again to continue\.|You do not have access to this content\./)
  401 |             await expect(panel.getByRole("table")).toHaveCount(0)
  402 |             await expect(panel.locator('[data-sf-field="selection"] option, [data-sf-field="base-ref"] option, [data-sf-field="candidate-ref"] option')).toHaveCount(0)
  403 |             await expect(panel.getByRole("navigation", { name: "Authorized source links", exact: true }).getByRole("link")).toHaveCount(0)
  404 |             record.facts.privateProjectionRemoved = true
  405 |             record.facts.privateChoicesRemoved = true
  406 |             const deniedContext = page.waitForResponse((response) => new URL(response.url()).pathname === "/sucafina/api/ui/context" && response.status() === 401)
  407 |             await page.getByRole("button", { name: "Refresh access", exact: true }).click()
  408 |             expect((await deniedContext).status()).toBe(401)
  409 |             await expect(page.locator('[data-sf-f01="unauthenticated"]')).toBeVisible()
  410 |             const reviewStatuses = await reviewPrivacy.verifyAfterLogout()
  411 |             for (const [operation, status] of Object.entries(reviewStatuses)) record.facts[`review-${operation}-denied`] = status
  412 |             record.facts.reviewPrivateSectionsRemoved = true
  413 |             record.facts.reviewLateResponseDiscarded = true
  414 |           } finally { await reviewPrivacy.dispose() }
  415 |         })
  416 | 
  417 |         const failed = observations.filter((record) => record.outcome !== "passed")
  418 |         if (failed.length) throw new Error("WP10 composition failed: " + failed.map((record) => `${record.flow}: ${record.failure ?? record.outcome}`).join("\n"))
  419 |         state.stage = "completed"
  420 |       })
  421 |     })).pipe(Effect.provide(LayerNode.compile(AppProcess.node))), { signal: AbortSignal.timeout(7 * 60000) })
  422 |     const counters = processCounters()
  423 |     expect(counters.spawns, "Revision, seed, serve and Chromium must use AppProcess/Omni").toBeGreaterThanOrEqual(4)
  424 |     expect(counters.delegations).toBe(0)
  425 |   } catch (error) {
  426 |     state.failure = redact(error instanceof Error ? error.message : String(error))
> 427 |     throw new Error(state.failure)
      |           ^ Error: locator.click: Timeout 10000ms exceeded.
  428 |   } finally {
  429 |     try {
  430 |       await mkdir(testInfo.outputDir, { recursive: true })
  431 |       await writeFile(testInfo.outputPath("wp10-server.log"), redact(logs.join("")))
  432 |       await testInfo.attach("wp10-server", { path: testInfo.outputPath("wp10-server.log"), contentType: "text/plain" })
  433 |       await testInfo.attach("wp10-composition-observations", { body: JSON.stringify({
  434 |         schema: "wp10-real-composition-v1", executedSnapshotCommit: process.env.GITHUB_SHA, productCommit: state.productSha,
  435 |         workflowRunId: process.env.GITHUB_RUN_ID, workflowRunAttempt: process.env.GITHUB_RUN_ATTEMPT, startedAt,
  436 |         stage: state.stage, failure: state.failure, authenticated: state.authenticated, serverExitCode: state.exitCode,
  437 |         environment: { operatingSystem: `${process.platform} ${release()}`, browserVersion: state.browserVersion, runtimeVersion: state.corpus?.runtimeVersion,
  438 |           datasetDigest: state.corpus?.datasetDigest, counts: state.corpus?.counts, provider: state.corpus?.provider, viewport: { width: 1440, height: 900 } },
  439 |         observations, http, browserEvents,
  440 |         processObservation: processCounters ? { ...processCounters(), control: "Playwright scoped Omni counters; not the Bun canonical control" } : null,
  441 |         limits: ["Local operator and synthetic published corpus only", "Decision reopens through fresh authorized HTTP reads; no server restart or recovery qualification", "A visible BI table preserves missing/estimated values and producer limitations; it is not a completeness verdict", "Viewport dimensions and screenshots are observations, not the WP00 zoom/performance matrix", "No native AI, global epic, Microsoft identity or independent review acceptance"],
  442 |       }, null, 2), contentType: "application/json" })
  443 |     } finally { await rm(directory, { recursive: true, force: true }) }
  444 |   }
  445 | })
  446 | 
  447 | async function nativeBody(response: Response): Promise<unknown> {
  448 |   expect(response.status()).toBe(200)
  449 |   expect(await response.finished()).toBeNull()
  450 |   expect(response.request().failure()).toBeNull()
  451 |   return response.json()
  452 | }
  453 | 
  454 | async function openBudgetBi(page: Page, expectedSelection?: string) {
  455 |   if (expectedSelection !== undefined) {
  456 |     const reloaded = page.waitForResponse((response) => response.request().method() === "GET" &&
  457 |       new URL(response.url()).searchParams.get("sf") === "bi-data" &&
  458 |       new URL(response.url()).searchParams.get("viewId") === "BI01" &&
  459 |       new URL(response.url()).searchParams.get("selectionRef") === expectedSelection)
  460 |     await page.goto(origin + "/orchestra/sf-bi/" + encodeSfRouteRef("BI01"))
  461 |     const body = Schema.decodeUnknownSync(Schema.toType(SfBiBiDataOutput))(await nativeBody(await reloaded))
  462 |     if (!("request" in body)) throw new Error("Reload did not reauthorize the original BI01 selection")
  463 |     expect(body.request.selectionRef).toBe(expectedSelection)
  464 |     expect(body.request.period).toEqual({ start: "2027-01-01", end: "2027-12-31" })
  465 |     await expect(page.locator('[data-sf-field="selection"]')).toHaveValue(expectedSelection)
  466 |     return body
  467 |   }
  468 |   await page.goto(origin + "/orchestra/sf-bi/" + encodeSfRouteRef("BI01"))
  469 |   const panel = page.locator('[data-sf-catalog="UI46"]')
  470 |   await panel.locator('[data-sf-field="start"]').fill("2027-01-01")
  471 |   await panel.locator('[data-sf-field="end"]').fill("2027-12-31")
  472 |   const pendingOptions = page.waitForResponse((response) => response.request().method() === "GET" &&
  473 |     new URL(response.url()).searchParams.get("sf") === "bi-options")
  474 |   await panel.getByRole("button", { name: "Choose context", exact: true }).click()
  475 |   const options = Schema.decodeUnknownSync(Schema.toType(SfBiBiOptionsOutput))(await nativeBody(await pendingOptions))
  476 |   if (options.status !== "ok") throw new Error("The original BI01 catalog was unavailable")
  477 |   expect(options.value.choices).toHaveLength(1)
  478 |   const selection = panel.locator('[data-sf-field="selection"]')
  479 |   await expect(selection).toHaveValue("")
  480 |   await selection.selectOption(options.value.choices[0]!.selectionRef)
  481 |   const pendingData = page.waitForResponse((response) => response.request().method() === "GET" &&
  482 |     new URL(response.url()).searchParams.get("sf") === "bi-data" &&
  483 |     new URL(response.url()).searchParams.get("viewId") === "BI01")
  484 |   await panel.locator('[data-sf-action="view-data"]').click()
  485 |   const result = Schema.decodeUnknownSync(Schema.toType(SfBiBiDataOutput))(await nativeBody(await pendingData))
  486 |   if (!("request" in result)) throw new Error("BI01 did not return its authorized original projection")
  487 |   expect(result.request.selectionRef).toBe(options.value.choices[0]!.selectionRef)
  488 |   return result
  489 | }
  490 | 
  491 | async function capture(page: Page, testInfo: TestInfo, record: Observation, name: string) {
  492 |   if (page.isClosed()) throw new Error("Browser closed before its evidence could be captured")
  493 |   record.layout = await page.evaluate(() => {
  494 |     const main = document.querySelector("main")
  495 |     return { viewport: { width: innerWidth, height: innerHeight }, document: { width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }, main: main ? { width: main.clientWidth, scrollWidth: main.scrollWidth } : null }
  496 |   })
  497 |   record.facts.renderedRoute = safeRoute(page.url()) ?? "unrecognized"
  498 |   // A viewport screenshot preserves the actual desktop layout rather than shrinking a long table to one image.
  499 |   const file = name + ".png"
  500 |   await page.screenshot({ path: testInfo.outputPath(file), fullPage: false })
  501 |   await testInfo.attach(file, { path: testInfo.outputPath(file), contentType: "image/png" })
  502 |   record.screenshots.push(file)
  503 | }
  504 | 
  505 | function statusOf(value: unknown) {
  506 |   return value && typeof value === "object" && "status" in value && typeof value.status === "string" ? redact(value.status) : "not-declared"
  507 | }
  508 | 
  509 | function reasonOf(value: unknown) {
  510 |   return value && typeof value === "object" && "reason" in value && typeof value.reason === "string" ? redact(value.reason) : "not-declared"
  511 | }
  512 | 
  513 | function safeRoute(value: string) {
  514 |   const url = new URL(value)
  515 |   if (url.origin !== origin) return undefined
  516 |   const api = ["/sucafina/dashboard", "/sucafina/planner", "/sucafina/procurement", "/sucafina/status"].includes(url.pathname) ||
  517 |     /^\/sucafina\/api\/ui\/(?:context|pages\/CAP\d+|projections\/(?:case|cases|review))$/.test(url.pathname)
  518 |   const chapter = /^\/orchestra\/sf-(?:dashboard|planner|procurement|bi|decisions|reviews)(?:\/|$)/.test(url.pathname)
  519 |   if (!api && !chapter) return undefined
  520 |   const query = new URLSearchParams()
  521 |   for (const key of ["sf", "page", "year", "viewId", "start", "end"]) {
  522 |     const selected = url.searchParams.get(key)
  523 |     if (selected !== null) query.set(key, selected)
  524 |   }
  525 |   return url.pathname.replace(/\/r_[^/]+/g, "/:ref") + (query.size ? "?" + query.toString() : "")
  526 | }
  527 | 
```

