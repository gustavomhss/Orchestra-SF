# Operations native read observation

Original run 44619924653, artifact 14577090913. Read-only diagnostic, no rerun and no product assertion changed.

## packages/app-shell/e2e/test-results/sucafina-operations-CI-UI--a3b16-t-without-duplicate-effects-chromium/error-context.md

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sucafina/operations.spec.ts >> CI-UI-OPERATIONS >> OP-IMPORT-01 real preview and one Apply recover the same receipt without duplicate effects
- Location: e2e/sucafina/operations.spec.ts:28:3

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('[data-sf-leaf="u23"]')
Expected: 1
Received: 0
Timeout:  10000ms

Call log:
  - Expect "toHaveCount" with timeout 10000ms
  - waiting for locator('[data-sf-leaf="u23"]')
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
          - generic "Import file"
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
            - button "Overview" [ref=e98] [cursor=pointer]:
              - img [ref=e99]
              - generic [ref=e103]: Overview
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
              - strong [ref=e231]: sf-wp04-browser-dw72oI
              - generic "/tmp/sf-wp04-browser-dw72oI" [ref=e232]: 8 agents
            - generic [ref=e233]: ⌄
          - paragraph [ref=e234]: Build what matters. With agents.
      - main [ref=e236]:
        - generic [ref=e238]:
          - toolbar "Context and access" [ref=e239]:
            - button "Refresh access" [ref=e240] [cursor=pointer]
            - button "Sign out" [ref=e241] [cursor=pointer]
          - status [ref=e242]: Sucafina route not admitted
  - generic:
    - region "Notifications alt+T"
```

# Test source

```ts
  67  |   })
  68  | }
  69  | 
  70  | async function confirmVersion(page: Page, account: Account, opener: Locator) {
  71  |   await expect(opener).toBeEnabled()
  72  |   await opener.click()
  73  |   const review = page.locator('[data-component="sf-change-review"]')
  74  |   await expect(review).toHaveCount(1)
  75  |   await expect(review.getByRole("heading", { name: "Review changes", exact: true })).toBeVisible()
  76  |   const confirm = review.getByRole("button", { name: "Confirm", exact: true })
  77  |   await expect(confirm).toBeEnabled()
  78  |   const pending = versionSave(page, account)
  79  |   await confirm.click()
  80  |   const response = await pending
  81  |   expect(response.status()).toBe(200)
  82  |   const body = await response.json() as { ok?: boolean; value?: unknown }
  83  |   expect(body).toMatchObject({ ok: true })
  84  |   return { response, body }
  85  | }
  86  | 
  87  | /** PR34 15df31a: actual XLSX admission, C02 preview, one Apply, delivery loss and read-only reconciliation. */
  88  | export async function importJourney(page: Page, info: TestInfo) {
  89  |   const account = await login(page, "first", "journey")
  90  |   const name = "Operations import " + randomUUID()
  91  |   const renewal = randomUUID(), fixed = randomUUID()
  92  |   const isMode = (url: string, mode: string) => {
  93  |     const candidate = new URL(url)
  94  |     return candidate.origin === account.origin && candidate.pathname === new URL(account.baseURL).pathname + "/planner" && candidate.searchParams.get("sf") === mode
  95  |   }
  96  |   const waiting = (mode: string, method = "GET") => {
  97  |     const response = page.waitForResponse((response) => isMode(response.url(), mode) && response.request().method() === method)
  98  |     // Admission can fail before the later preview/detail responses exist. Observe teardown
  99  |     // rejection eagerly; returning the original promise preserves every awaited failure.
  100 |     void response.catch(() => undefined)
  101 |     return response
  102 |   }
  103 |   const beforeVersionsResponse = await page.request.get(account.baseURL + "/api/ui/pages/CAP23")
  104 |   expect(beforeVersionsResponse.status()).toBe(200)
  105 |   const beforeVersions = Schema.decodeUnknownSync(SfPlanner.operations["domain.page.CAP23"].output)(await beforeVersionsResponse.json())
  106 |   expect(beforeVersions.status).toBe("ok")
  107 |   if (beforeVersions.status !== "ok") throw new Error("The installed Planner versions were not admitted")
  108 |   expect((await page.goto("/orchestra/sf-planner/versions/new"))?.status()).toBe(200)
  109 |   const surface = page.locator('[data-sf-surface="CAP23"]')
  110 |   const created = await confirmVersion(page, account, surface.getByRole("button", { name: "Create first version", exact: true }))
  111 |   expect(created.response.request().postDataJSON()).toMatchObject({ page: "Versions", action: "save", confirmed: true, values: {} })
  112 |   expect(created.response.request().postDataJSON().id).toBeUndefined()
  113 |   await expect(page.locator('[data-component="sf-change-review"]')).toHaveCount(0)
  114 |   const afterVersionsResponse = await page.request.get(account.baseURL + "/api/ui/pages/CAP23")
  115 |   expect(afterVersionsResponse.status()).toBe(200)
  116 |   const afterVersions = Schema.decodeUnknownSync(SfPlanner.operations["domain.page.CAP23"].output)(await afterVersionsResponse.json())
  117 |   expect(afterVersions.status).toBe("ok")
  118 |   if (afterVersions.status !== "ok") throw new Error("The installed Planner readback was not admitted")
  119 |   const inserted = afterVersions.value.data.versions.filter((record) =>
  120 |     !beforeVersions.value.data.versions.some((before) => before.id === record.id))
  121 |   expect(inserted).toHaveLength(1)
  122 |   const persisted = inserted[0]!
  123 |   const version = persisted.id
  124 |   expect((await page.goto("/orchestra/sf-planner/versions?" + new URLSearchParams({ year: String(persisted.year) })))?.status()).toBe(200)
  125 |   const insertedRow = page.locator(`tr[data-sf-row="${version}"]`)
  126 |   await expect(insertedRow).toHaveCount(1)
  127 |   await expect(insertedRow.locator(".sf-s01-cell-value")).toHaveText(persisted.name)
  128 |   await insertedRow.locator('button[data-sf-action="select"]').click()
  129 |   const versionDetail = page.locator("[data-sf-record-detail]")
  130 |   await expect(versionDetail).toHaveCount(1)
  131 |   const identity = versionDetail.locator("p.sf-s01-secondary bdi")
  132 |   await expect(identity).toHaveText(version)
  133 |   const year = versionDetail.locator("#sf-u46-year")
  134 |   await expect(year).toHaveValue(/^\d{4}$/)
  135 |   const nameField = versionDetail.locator("#sf-u46-name")
  136 |   await expect(nameField).toBeEnabled()
  137 |   await nameField.fill(name)
  138 |   const renamed = await confirmVersion(page, account, versionDetail.getByRole("button", { name: "Save", exact: true }))
  139 |   expect(renamed.response.request().postDataJSON()).toMatchObject({ page: "Versions", action: "save", id: version, confirmed: true, values: { name } })
  140 |   await expect(versionDetail.locator("#sf-u46-name")).toHaveValue(name)
  141 |   await expect(versionDetail.getByRole("heading", { name, exact: true })).toBeVisible()
  142 |   const fiscalYear = await year.inputValue()
  143 |   expect((await page.goto(`/orchestra/sf-planner/versions?${new URLSearchParams({ year: fiscalYear })}`))?.status()).toBe(200)
  144 |   const versionRow = page.locator("tr[data-sf-row]").filter({ has: page.getByText(name, { exact: true }) })
  145 |   await expect(versionRow).toHaveCount(1)
  146 |   expect(await versionRow.getAttribute("data-sf-row")).toBe(version)
  147 |   await expect(versionRow.locator(".sf-s01-cell-value")).toHaveText(name)
  148 |   await expect(versionRow.getByRole("cell").nth(1)).toHaveText(fiscalYear)
  149 |   // Seed isolated preconditions through the real domain; line creation is not claimed as UI coverage.
  150 |   for (const [id, label, amount] of [[renewal, "Renewal", 72000], [fixed, "Unchanged", 518000]] as const) {
  151 |     const response = await page.request.post(account.baseURL + "/planner", { maxRetries: 0, headers: { Origin: account.origin }, data: { page: "OPEX", action: "save", id, version: 0, values: { versionId: version, name: label, el: "licenses", cur: "USD", owner: account.principal, f0: amount } } })
  152 |     expect(response.status()).toBe(200)
  153 |     expect(await response.json()).toMatchObject({ ok: true })
  154 |   }
  155 |   const reader = await page.context().newPage()
  156 |   const beforeTokens = await tokens(reader, account, version, fiscalYear, [renewal, fixed])
  157 |   const before = await exported(reader, account, version)
  158 |   expect(before.OPEX?.filter((row) => row[0] === renewal || row[0] === fixed)).toHaveLength(6)
  159 |   expect(before.OPEX?.filter((row) => row[0] === renewal && row[8] === "Forecast").map((row) => row[9])).toEqual([72000])
  160 |   expect(before.OPEX?.filter((row) => row[0] === fixed && row[8] === "Forecast").map((row) => row[9])).toEqual([518000])
  161 |   const workbook = new Workbook()
  162 |   workbook.addWorksheet("OPEX").addRows([["Line ID", "Cost element", "Vendor / item", "Currency", "Measure", "Jan"], [renewal, "Licenses", "Renewal", "USD", "Forecast", 84000]])
  163 |   const bytes = Buffer.from(await workbook.xlsx.writeBuffer())
  164 |   const sourceDigest = createHash("sha256").update(bytes).digest("hex")
  165 |   expect((await page.goto("/orchestra/sf-imports/new"))?.status()).toBe(200)
  166 |   const root = page.locator('[data-sf-leaf="u23"]')
> 167 |   await expect(root).toHaveCount(1)
      |                      ^ Error: expect(locator).toHaveCount(expected) failed
  168 |   await expect(root).toHaveAttribute("data-sf-surface", "UI55")
  169 |   await expect(root).toHaveAttribute("data-sf-read-state", "ready")
  170 |   const invalid = await page.request.post(modeURL(account, "planner", "import-preview").href, { maxRetries: 0, headers: { Origin: account.origin, "Idempotency-Key": randomUUID() }, data: { admittedFileRef: "invalid-schema-probe", format: "xlsx", options: { unknown: true } } })
  171 |   expect(invalid.status()).toBe(400)
  172 |   expect(await invalid.json()).toEqual({ status: "invalid" })
  173 |   const destinations = waiting("import-targets")
  174 |   await root.getByRole("button", { name: "Find destinations", exact: true }).click()
  175 |   const targets = await valueOf<Destination[]>(await destinations)
  176 |   expect(targets.filter((target) => target.label === name)).toHaveLength(1)
  177 |   const index = targets.findIndex((target) => target.label === name)
  178 |   expect(targets[index]).toMatchObject({ surface: "planner", formats: expect.arrayContaining(["xlsx"]) })
  179 |   await root.getByLabel("Destination", { exact: true }).selectOption(targets[index]!.selectionRef)
  180 |   await root.getByLabel("File", { exact: true }).setInputFiles({ name: name + ".xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: bytes })
  181 |   await expect(root.getByLabel("Create a new Planner version", { exact: true })).not.toBeChecked()
  182 |   await expect(root.getByLabel("Remove records missing from supplied sheets", { exact: true })).not.toBeChecked()
  183 |   const admission = waiting("import-admit", "POST"), previewResponse = waiting("import-preview", "POST"), detailResponse = waiting("import-reference")
  184 |   await root.getByRole("button", { name: "Generate preview", exact: true }).click()
  185 |   const admissionTransport = await admission
  186 |   if (admissionTransport.status() !== 200) {
  187 |     const statusBody = await admissionTransport.json().catch(() => null) as { status?: unknown } | null
  188 |     // Preserve the original producer's denial; attach only the public status
  189 |     // category, never enrollment, selectors, source bytes or authority internals.
  190 |     await observation(info, "operations-import-admission-blocked", {
  191 |       stage: "import-admit", httpStatus: admissionTransport.status(),
  192 |       producerStatus: typeof statusBody?.status === "string" &&
  193 |         ["denied", "unavailable", "stale", "needs-input", "invalid", "conflict"].includes(statusBody.status)
  194 |         ? statusBody.status : "unclassified",
  195 |       scannerConfigured: Boolean(process.env.SF_OPERATIONS_CLAMD_PORT),
  196 |       syntheticApprovalUsed: false,
  197 |     })
  198 |   }
  199 |   const admitted = await valueOf<{ ref: string }>(admissionTransport)
  200 |   const previewTransport = await previewResponse
  201 |   expect(previewTransport.request().postDataJSON()).toEqual({ admittedFileRef: admitted.ref, format: "xlsx", options: {} })
  202 |   const preview = await valueOf<ImportManifest>(previewTransport)
  203 |   const detail = await valueOf<Reference>(await detailResponse)
  204 |   expect(detail.manifest).toEqual(preview)
  205 |   expect(preview).toMatchObject({ sourceDigest, format: "xlsx", state: "preview", domainApplied: false, receipts: [], issues: [], context: { principalRef: account.principal, surface: "planner" } })
  206 |   expect(preview.baseIdentity).toEqual([expect.objectContaining({ surface: "planner", type: "planner-version", id: version })])
  207 |   expect(preview.commands).toHaveLength(1)
  208 |   const command = preview.commands[0]!
  209 |   expect(command.target).toEqual(preview.baseIdentity[0])
  210 |   expect(command.preview.engineVersion).toBe("planner-runtime-v1")
  211 |   for (const [id, prior, next] of [[renewal, 72000, 84000], [fixed, 518000, 518000]] as const) {
  212 |     expect(command.preview.values.filter((value) => value.id === `before:${id}:1:forecast`)).toEqual([expect.objectContaining({ value: prior, currency: "USD" })])
  213 |     expect(command.preview.values.filter((value) => value.id === `after:${id}:1:forecast`)).toEqual([expect.objectContaining({ value: next, currency: "USD" })])
  214 |   }
  215 |   expect(detail.detail).toMatchObject({ manifestId: preview.id, version: preview.version, sourceDigest })
  216 |   expect(detail.receipt).toBeUndefined()
  217 |   expect(detail.detail.changes.filter((change) => change.path === `/versions/@id=${version}/lines/@id=${renewal}/f/0`)).toEqual([expect.objectContaining({ kind: "changed", before: { state: "present", value: 72000 }, after: { state: "present", value: 84000 }, source: { kind: "file", sheet: "OPEX", row: 2, column: 6, address: "F2", field: "Jan" } })])
  218 |   await expect(root).toHaveAttribute("data-sf-phase", "reviewing")
  219 |   await expect(root.getByRole("status").filter({ hasText: "Review the simulation, including ignored and rejected items. Apply requires your explicit action." })).toHaveCount(1)
  220 |   await expect(root.getByRole("heading", { name: "Simulation · no domain changes applied", exact: true })).toBeVisible()
  221 |   await expect(root.getByRole("region", { name: "Item and field changes", exact: true })).toContainText(`/versions/@id=${version}/lines/@id=${renewal}/f/0`)
  222 |   await expect(root.getByRole("region", { name: "Item and field changes", exact: true })).toContainText("72000 → 84000")
  223 |   expect(await exported(reader, account, version)).toEqual(before)
  224 |   expect(await tokens(reader, account, version, fiscalYear, [renewal, fixed])).toEqual(beforeTokens)
  225 |   const applies: string[] = [], committed: ImportManifest[] = []
  226 |   page.on("request", (request) => { if (isMode(request.url(), "import-apply") && request.method() === "POST") applies.push(request.postData() ?? "") })
  227 |   // Send the real mutation once and discard only its delivery. No response is manufactured.
  228 |   await page.route((url) => isMode(url.href, "import-apply"), async (route) => {
  229 |     expect(route.request().postDataJSON()).toEqual({ manifestId: preview.id, version: preview.version })
  230 |     committed.push(await valueOf<ImportManifest>(await route.fetch({ maxRetries: 0 })))
  231 |     await route.abort("failed")
  232 |   }, { times: 1 })
  233 |   const failedDelivery = page.waitForEvent("requestfailed", (request) => isMode(request.url(), "import-apply"))
  234 |   // Ignore the mandatory pre-Apply read; only the read after the sole POST can prove recovery.
  235 |   const recoveredResponse = page.waitForResponse((response) =>
  236 |     isMode(response.url(), "import-reference") && response.request().method() === "GET" && applies.length === 1)
  237 |   await root.getByRole("button", { name: "Apply reviewed import", exact: true }).click()
  238 |   await failedDelivery
  239 |   const recovered = await valueOf<Reference>(await recoveredResponse)
  240 |   expect(committed).toHaveLength(1)
  241 |   expect(recovered.manifest).toEqual(committed[0])
  242 |   expect(recovered.manifest.receipts).toHaveLength(1)
  243 |   const receipt = recovered.manifest.receipts[0]!
  244 |   expect(recovered.manifest).toEqual({ ...preview, state: "applied", domainApplied: true, receipts: [receipt] })
  245 |   expect(receipt).toMatchObject({ idempotencyKey: command.idempotencyKey, commandDigest: command.commandDigest, targetIncarnation: command.target.incarnation, principalRef: account.principal, surface: "planner", status: "applied", errors: [] })
  246 |   expect(recovered.receipt).toMatchObject({ receiptId: receipt.id, manifestId: preview.id, idempotencyKey: command.idempotencyKey, commandDigest: command.commandDigest, outcome: "applied" })
  247 |   expect(recovered.receipt?.changedFields).toBeGreaterThan(0)
  248 |   expect(recovered.detail).toEqual(detail.detail)
  249 |   await expect(root).toHaveAttribute("data-sf-phase", "receipt")
  250 |   await expect(root).toHaveAttribute("data-sf-read-state", "ready")
  251 |   const renderedReceipt = root.locator('[data-sf-receipt="producer"]')
  252 |   await expect(renderedReceipt.getByRole("heading", { name: "Confirmed receipt", exact: true })).toBeVisible()
  253 |   await expect(renderedReceipt).toContainText("Receipt: " + receipt.id)
  254 |   await expect(renderedReceipt).toContainText("Manifest: " + preview.id)
  255 |   await expect(renderedReceipt).toContainText("Actor: " + account.principal + " · Version: " + receipt.version)
  256 |   const after = await exported(reader, account, version)
  257 |   expect(after.OPEX?.filter((row) => row[0] === renewal && row[8] === "Forecast").map((row) => row[9])).toEqual([84000])
  258 |   expect(after.OPEX?.filter((row) => row[0] === fixed)).toEqual(before.OPEX?.filter((row) => row[0] === fixed))
  259 |   expect(after.OPEX?.filter((row) => row[0] === renewal || row[0] === fixed)).toHaveLength(6)
  260 |   expect(after.OPEX?.map((row) => [row[0], row[8]])).toEqual(before.OPEX?.map((row) => [row[0], row[8]]))
  261 |   expect(after.OPEX?.filter((row) => row[0] !== renewal || row[8] !== "Forecast")).toEqual(before.OPEX?.filter((row) => row[0] !== renewal || row[8] !== "Forecast"))
  262 |   const priorRow = before.OPEX!.find((row) => row[0] === renewal && row[8] === "Forecast")!
  263 |   const changedRow = after.OPEX!.find((row) => row[0] === renewal && row[8] === "Forecast")!
  264 |   expect(changedRow.slice(0, 9)).toEqual(priorRow.slice(0, 9))
  265 |   expect(changedRow.slice(10, 21)).toEqual(priorRow.slice(10, 21))
  266 |   expect(changedRow[21]).toEqual({ ...(priorRow[21] as { formula: string }), result: 84000 })
  267 |   for (const sheet of Object.keys(before).filter((name) => name !== "OPEX")) expect(after[sheet]).toEqual(before[sheet])
```

## packages/app-shell/e2e/test-results/sucafina-operations-CI-UI--b41a7-while-the-future-PO-changes-chromium/error-context.md

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sucafina/operations.spec.ts >> CI-UI-OPERATIONS >> OP-PROC-02 pending sourcing keeps its submitted FX while the future PO changes
- Location: e2e/sucafina/operations.spec.ts:18:3

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Review decision', exact: true })

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
          - generic "My approvals"
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
            - button "My approvals" [ref=e92] [cursor=pointer]:
              - img [ref=e93]
              - generic [ref=e97]: My approvals
            - button "Overview" [ref=e98] [cursor=pointer]:
              - img [ref=e99]
              - generic [ref=e103]: Overview
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
              - strong [ref=e231]: sf-wp04-browser-dw72oI
              - generic "/tmp/sf-wp04-browser-dw72oI" [ref=e232]: 8 agents
            - generic [ref=e233]: ⌄
          - paragraph [ref=e234]: Build what matters. With agents.
      - main [ref=e236]:
        - generic [ref=e238]:
          - toolbar "Context and access" [ref=e239]:
            - button "Refresh access" [ref=e240] [cursor=pointer]
            - button "Sign out" [ref=e241] [cursor=pointer]
          - region "My approvals" [ref=e243]:
            - generic [ref=e244]:
              - generic [ref=e246]:
                - generic [ref=e247]: ⁨sf-wp04-browser-dw72oI⁩ · My approvals
                - heading "My approvals" [level=1] [ref=e248]
              - region "Approval details are unavailable." [ref=e251]:
                - alert [ref=e252]:
                  - paragraph [ref=e253]: Approval details are unavailable.
                  - button "Try again" [ref=e255] [cursor=pointer]
  - generic:
    - region "Notifications alt+T"
```

# Test source

```ts
  6   | 
  7   | export async function sourcingSnapshot(page: Page, info: TestInfo) {
  8   |   const account = await login(page, "first", "settings")
  9   |   const supplier = (await readManifest()).records.supplier
  10  |   const title = "Operations EUR snapshot " + randomUUID()
  11  |   const id = await createRequest(page, account, title)
  12  |   const encoded = encodeSfRouteRef(id)
  13  |   await page.goto(`/orchestra/sf-procurement/requests/${encoded}`)
  14  |   const detail = page.locator(`article[data-sf-request-ref="${id}"]`)
  15  |   await expect(detail).toHaveCount(1)
  16  |   await confirmCommand(page, account, "submit_pr", id, detail.getByRole("button", { name: "Submit requisition", exact: true }), "Confirm action")
  17  |   await approveRequest(page, account, id)
  18  |   await page.goto(`/orchestra/sf-procurement/requests/${encoded}/sourcing`)
  19  |   await page.getByRole("textbox", { name: "Evaluator", exact: true }).fill("Synthetic Operations evaluator")
  20  |   await page.getByRole("textbox", { name: "Fewer quotations justification", exact: true }).fill("Isolated single-quote snapshot regression; comparison remains limited")
  21  |   await page.getByRole("textbox", { name: "Selection justification", exact: true }).fill("Review the EUR quotation with the current holder")
  22  |   const quotations = page.locator("fieldset.sf-u12-quote")
  23  |   if (await quotations.count() === 0) await page.getByRole("button", { name: "Add quotation", exact: true }).click()
  24  |   const quote = page.locator("fieldset.sf-u12-quote").first()
  25  |   await quote.getByRole("textbox", { name: "Supplier", exact: true }).fill("Journey registered supplier")
  26  |   await quote.getByRole("combobox", { name: "Registered supplier", exact: true }).selectOption(supplier)
  27  |   await quote.getByRole("textbox", { name: "Currency", exact: true }).fill("EUR")
  28  |   await quote.getByRole("spinbutton", { name: "Stated total", exact: true }).fill("28000")
  29  |   await quote.getByRole("spinbutton", { name: "Quantity", exact: true }).fill("1")
  30  |   await quote.getByRole("spinbutton", { name: "Unit price", exact: true }).fill("28000")
  31  |   await fillEnabledScores(quote)
  32  |   await confirmCommand(page, account, "save", id, page.getByRole("button", { name: "Save sourcing", exact: true }), "Confirm once")
  33  |   await expect(page.getByRole("textbox", { name: "Selection justification", exact: true })).toHaveValue("Review the EUR quotation with the current holder")
  34  |   await page.getByRole("button", { name: "Compare quotations", exact: true }).click()
  35  |   const comparison = page.locator("section.sf-u12-comparison")
  36  |   await expect(comparison.getByRole("status").filter({ hasText: /^Comparison is limited: fewer than two proposals are eligible\.$/ })).toBeVisible()
  37  |   const winning = comparison.getByRole("combobox", { name: "Selected quotation", exact: true })
  38  |   await winning.selectOption({ label: "Journey registered supplier · EUR 28000" })
  39  |   await confirmCommand(page, account, "select_quote", id, comparison.getByRole("button", { name: "Select winning quote", exact: true }), "Confirm once")
  40  |   const order = page.locator("section").filter({ has: page.getByRole("button", { name: "Submit purchase order", exact: true }) })
  41  |   await expect(order).toHaveCount(1)
  42  |   await expect(order.getByRole("textbox", { name: "Supplier", exact: true })).toHaveValue("Journey registered supplier")
  43  |   await expect(order.getByRole("textbox", { name: "Currency", exact: true })).toHaveValue("EUR")
  44  |   await expect(order.getByRole("spinbutton", { name: "Unit price", exact: true })).toHaveValue("28000")
  45  |   await expect(order.getByRole("button", { name: "Submit purchase order", exact: true })).toBeDisabled()
  46  |   await page.getByRole("button", { name: "Sourcing", exact: true }).click()
  47  |   await confirmCommand(page, account, "submit_sourcing", id, page.getByRole("button", { name: "Submit sourcing", exact: true }), "Confirm once")
  48  |   await expect(page.locator(".sf-u12-heading p").filter({ hasText: /^Stage:/ })).toHaveText(/^Stage: src_pending · Source version: [1-9]\d*$/)
  49  |   const pendingVersion = (await page.locator(".sf-u12-heading p").filter({ hasText: /^Stage:/ }).innerText()).replace("Stage: src_pending · Source version: ", "")
  50  |   await page.goto(`/orchestra/sf-procurement/requests/${encoded}`)
  51  |   await expect(detail.locator("p").filter({ hasText: /^Status:/ })).toHaveText("Status: src_pending")
  52  |   await expect(detail.locator(`p[data-request-summary="${id}"]`)).toContainText("Sourcing approval")
  53  |   await expect(detail.locator(`p[data-request-summary="${id}"]`)).toContainText("30240 USD")
  54  |   await expect(detail.locator(`p[data-request-money="${id}"]`)).toHaveText("Current request value: 28000 EUR; base value: 30240 USD; FX: 1.08 (submitted).")
  55  |   await page.goto(`/orchestra/sf-procurement/requests/${encoded}/sourcing/compare`)
  56  |   const frozen = page.locator("section.sf-u12-comparison")
  57  |   await expect(frozen.getByRole("row").filter({ hasText: "Journey registered supplier" }).getByRole("cell", { name: "30240 USD (submitted FX: 1.08)", exact: true })).toHaveCount(1)
  58  |   await expect(frozen.getByRole("status").filter({ hasText: /^Comparison is limited: fewer than two proposals are eligible\.$/ })).toBeVisible()
  59  |   const original = await setEurRate(page, account, "2")
  60  |   try {
  61  |     expect(original).toBe("1.08")
  62  |     await page.goto(`/orchestra/sf-procurement/requests/${encoded}/sourcing`)
  63  |     await expect(page.locator(".sf-u12-heading p").filter({ hasText: /^Stage:/ })).toHaveText("Stage: src_pending · Source version: " + pendingVersion)
  64  |     await expect(page.locator(`p[data-request-summary="${id}"]`)).toContainText("Sourcing approval")
  65  |     await expect(page.locator(`p[data-request-summary="${id}"]`)).toContainText("30240 USD")
  66  |     await expect(page.locator(`p[data-request-money="${id}"]`)).toHaveText("Current request value: 28000 EUR; base value: 30240 USD; FX: 1.08 (submitted).")
  67  |     await expect(page.getByRole("status").filter({ hasText: /^Estimate value: 28000 EUR; base value: 56000 USD; FX: 2 \(current\)\.$/ })).toBeVisible()
  68  |     await expect(page.getByRole("status").filter({ hasText: /^Order value 56000 USD; approved sourcing value 30240 USD\. Review the difference\.$/ })).toBeVisible()
  69  |     await expect(page.getByRole("status").filter({ hasText: /^Sourcing is not editable in the current request stage\.$/ })).toBeVisible()
  70  |     await expect(page.getByRole("button", { name: "Submit sourcing", exact: true })).toHaveCount(0)
  71  |     await page.goto(`/orchestra/sf-procurement/requests/${encoded}/sourcing/compare`)
  72  |     await expect(page.locator("section.sf-u12-comparison").getByRole("cell", { name: "30240 USD (submitted FX: 1.08)", exact: true })).toHaveCount(1)
  73  |     await page.reload()
  74  |     await expect(page.locator(".sf-u12-heading p").filter({ hasText: /^Stage:/ })).toHaveText("Stage: src_pending · Source version: " + pendingVersion)
  75  |     await expect(page.locator(`p[data-request-money="${id}"]`)).toHaveText("Current request value: 28000 EUR; base value: 30240 USD; FX: 1.08 (submitted).")
  76  |     await expect(page.locator("section.sf-u12-comparison").getByRole("cell", { name: "30240 USD (submitted FX: 1.08)", exact: true })).toHaveCount(1)
  77  |     await observation(info, "operations-sourcing-frozen-fx", { recordId: id, domainVersion: pendingVersion, pendingSourcing: { original: 28000, currency: "EUR", rate: 1.08, baseAmount: 30240, state: "src_pending" }, futurePo: { baseAmount: 56000, rate: 2, submitted: false }, c06MaterialConfirmation: "BLOCKED_DEPENDENCY" })
  78  |   } finally {
  79  |     await setEurRate(page, account, original)
  80  |   }
  81  | }
  82  | 
  83  | export async function createRequest(page: Page, account: Account, title: string) {
  84  |   const form = page.locator('form[data-command="create"][data-page="Requests"]')
  85  |   await expect(form).toHaveCount(1)
  86  |   await form.getByRole("textbox", { name: "Title", exact: true }).fill(title)
  87  |   await form.getByRole("combobox", { name: "Type", exact: true }).selectOption("service")
  88  |   await form.getByRole("textbox", { name: "Description", exact: true }).fill("Isolated Operations sourcing scope")
  89  |   await form.getByRole("spinbutton", { name: "Estimated amount", exact: true }).fill("100")
  90  |   await form.getByRole("textbox", { name: "Cost center", exact: true }).fill("Synthetic IT")
  91  |   await form.getByLabel("Needed by", { exact: true }).fill("2026-12-01")
  92  |   await form.getByRole("textbox", { name: "Justification", exact: true }).fill("Operations fixture only")
  93  |   const created = await confirmCommand(page, account, "create", undefined, form.getByRole("button", { name: "Create request", exact: true }), "Confirm action")
  94  |   expect(created.request().postDataJSON()).toMatchObject({ values: { pr: { estAmount: 100 } } })
  95  |   const row = page.locator("tr[data-sf-row]").filter({ has: page.getByRole("cell", { name: title, exact: true }) })
  96  |   await expect(row).toHaveCount(1)
  97  |   const id = (await row.getAttribute("data-sf-row")) ?? ""
  98  |   expect(id).toMatch(/^PR-2026-\d+$/)
  99  |   return id
  100 | }
  101 | 
  102 | export async function approveRequest(page: Page, account: Account, id: string) {
  103 |   const encoded = encodeSfRouteRef(id)
  104 |   await page.goto(`/orchestra/sf-procurement/approvals/${encoded}`)
  105 |   await expect(page).toHaveURL((url) => url.origin === account.origin && url.pathname === `/orchestra/sf-procurement/approvals/${encoded}`)
> 106 |   await page.getByRole("button", { name: "Review decision", exact: true }).click()
      |                                                                            ^ Error: locator.click: Test timeout of 60000ms exceeded.
  107 |   const review = page.locator('[data-component="sf-change-review"]')
  108 |   await expect(review).toHaveCount(1)
  109 |   await page.getByRole("textbox", { name: "Approval comment (optional)", exact: true }).fill("Operations snapshot approval")
  110 |   const pending = commandResponse(page, account.origin, "approve", id)
  111 |   await review.getByRole("button", { name: "Approve PR", exact: true }).click()
  112 |   const response = await pending
  113 |   expect(response.status()).toBe(200)
  114 |   expect(await response.json()).toMatchObject({ ok: true })
  115 |   expect(response.request().postDataJSON()).toMatchObject({ page: "My approvals", action: "approve", id, values: { comment: "Operations snapshot approval" } })
  116 |   await expect(page.getByText("The producer acknowledged the command. No receipt was returned.", { exact: true })).toBeVisible()
  117 | }
  118 | 
  119 | export async function confirmCommand(page: Page, account: Account, action: string, id: string | undefined, openReview: Locator, confirmName: string) {
  120 |   await expect(openReview).toBeEnabled()
  121 |   await openReview.click()
  122 |   const review = page.locator('[data-component="sf-change-review"]')
  123 |   await expect(review).toHaveCount(1)
  124 |   const pending = commandResponse(page, account.origin, action, id)
  125 |   const confirm = review.getByRole("button", { name: confirmName, exact: true })
  126 |   await expect(confirm).toBeEnabled()
  127 |   await confirm.click()
  128 |   const response = await pending
  129 |   expect(response.status()).toBe(200)
  130 |   expect(await response.json()).toMatchObject({ ok: true })
  131 |   expect(response.request().postDataJSON()).toMatchObject({ page: "Requests", action, ...(id ? { id } : {}) })
  132 |   return response
  133 | }
  134 | 
  135 | function commandResponse(page: Page, origin: string, action: string, id?: string) {
  136 |   return page.waitForResponse((response) => {
  137 |     const request = response.request()
  138 |     const url = new URL(request.url())
  139 |     if (request.method() !== "POST" || url.origin !== origin || url.pathname !== "/sucafina/procurement") return false
  140 |     const body = request.postDataJSON() as { action?: string; id?: string }
  141 |     return body.action === action && (id === undefined || body.id === id)
  142 |   })
  143 | }
  144 | 
  145 | export async function fillEnabledScores(quote: Locator) {
  146 |   for (const name of ["Technical scores", "Commercial scores"]) {
  147 |     const section = quote.locator("section").filter({ has: quote.page().getByRole("heading", { name, exact: true }) })
  148 |     const scores = section.getByRole("spinbutton")
  149 |     const count = await scores.count()
  150 |     for (let index = 0; index < count; index++) {
  151 |       const input = scores.nth(index)
  152 |       if (await input.isEnabled()) await input.fill("4")
  153 |     }
  154 |   }
  155 | }
  156 | 
  157 | export async function setEurRate(page: Page, account: Account, value: string) {
  158 |   await page.goto("/orchestra/sf-procurement/settings")
  159 |   const settings = page.locator("form.sf-n21-settings-form")
  160 |   await expect(settings).toHaveCount(1)
  161 |   const code = settings.locator("#sf-u36-fx-code-1")
  162 |   const rate = settings.locator("#sf-u36-fx-rate-1")
  163 |   await expect(code).toHaveValue("EUR")
  164 |   const original = await rate.inputValue()
  165 |   const version = Number(await settings.getAttribute("data-version"))
  166 |   expect(Number.isSafeInteger(version)).toBe(true)
  167 |   await rate.fill(value)
  168 |   const pending = commandResponse(page, account.origin, "save")
  169 |   await settings.getByRole("button", { name: "Review changes", exact: true }).click()
  170 |   const review = page.locator('[data-component="sf-change-review"]')
  171 |   await expect(review).toHaveCount(1)
  172 |   await review.getByRole("button", { name: "Save", exact: true }).click()
  173 |   const response = await pending
  174 |   expect(response.status()).toBe(200)
  175 |   expect(response.request().postDataJSON()).toMatchObject({ page: "Settings", action: "save", version })
  176 |   expect(await response.json()).toMatchObject({ ok: true })
  177 |   await expect(settings).toHaveAttribute("data-version", String(version + 1))
  178 |   await page.reload()
  179 |   await expect(page.locator("#sf-u36-fx-rate-1")).toHaveValue(value)
  180 |   return original
  181 | }
  182 | 
```

## packages/app-shell/e2e/test-results/sucafina-operations-CI-UI--baa3d-e-through-source-revocation-chromium/error-context.md

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sucafina/operations.spec.ts >> CI-UI-OPERATIONS >> OP-DOC-01 real schema and confirmation preserve exact evidence through source revocation
- Location: e2e/sucafina/operations.spec.ts:33:3

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: page.waitForResponse: Test timeout of 60000ms exceeded.
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
          - generic "Suppliers"
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
            - button "Suppliers" [ref=e92] [cursor=pointer]:
              - img [ref=e93]
              - generic [ref=e97]: Suppliers
            - button "Overview" [ref=e98] [cursor=pointer]:
              - img [ref=e99]
              - generic [ref=e103]: Overview
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
              - strong [ref=e231]: sf-wp04-browser-dw72oI
              - generic "/tmp/sf-wp04-browser-dw72oI" [ref=e232]: 8 agents
            - generic [ref=e233]: ⌄
          - paragraph [ref=e234]: Build what matters. With agents.
      - main [ref=e236]:
        - generic [ref=e238]:
          - toolbar "Context and access" [ref=e239]:
            - button "Refresh access" [ref=e240] [cursor=pointer]
            - button "Sign out" [ref=e241] [cursor=pointer]
          - region "Suppliers" [ref=e243]:
            - generic [ref=e244]:
              - generic [ref=e245]:
                - generic [ref=e246]:
                  - generic [ref=e247]: ⁨sf-wp04-browser-dw72oI⁩ · Suppliers
                  - heading "Suppliers" [level=1] [ref=e248]
                - button "New supplier" [ref=e251] [cursor=pointer]
              - generic [ref=e252]:
                - generic [ref=e255]:
                  - button "Export suppliers CSV" [disabled] [ref=e256]
                  - generic [ref=e257]: CSV export requires the producer-authorized download binding; no client-side export is substituted.
                - generic [ref=e259]:
                  - generic [ref=e260]:
                    - generic [ref=e261]:
                      - generic [ref=e262]:
                        - text: Search suppliers
                        - searchbox "Search suppliers" [ref=e263]
                      - generic [ref=e264]:
                        - text: Filter by status
                        - combobox "Filter by status" [ref=e265]:
                          - option [selected]
                          - option "Pending"
                          - option "Active"
                          - option "Blocked"
                          - option "Inactive"
                    - table "Suppliers" [ref=e268]:
                      - caption [ref=e269]: Suppliers
                      - rowgroup [ref=e275]:
                        - row "Sort by Supplier number Sort by Supplier Sort by Status Actions" [ref=e276]:
                          - columnheader "Sort by Supplier number" [ref=e277]:
                            - button "Sort by Supplier number" [ref=e278] [cursor=pointer]:
                              - generic [ref=e279]: Supplier number
                              - generic [ref=e280]: ↕
                          - columnheader "Sort by Supplier" [ref=e281]:
                            - button "Sort by Supplier" [ref=e282] [cursor=pointer]:
                              - generic [ref=e283]: Supplier
                              - generic [ref=e284]: ↕
                          - columnheader "Sort by Status" [ref=e285]:
                            - button "Sort by Status" [ref=e286] [cursor=pointer]:
                              - generic [ref=e287]: Status
                              - generic [ref=e288]: ↕
                          - columnheader "Actions" [ref=e289]
                      - rowgroup [ref=e290]:
                        - row "SUP-00001 Open record Journey registered supplier active Actions for this record" [ref=e291]:
                          - cell "SUP-00001 Open record" [ref=e292]:
                            - generic [ref=e293]:
                              - generic [ref=e294]: SUP-00001
                              - button "Open record" [ref=e295] [cursor=pointer]
                          - cell "Journey registered supplier" [ref=e296]
                          - cell "active" [ref=e297]
                          - cell "Actions for this record" [ref=e298]:
                            - group "Actions for this record" [ref=e299]:
                              - button "Save supplier" [ref=e300] [cursor=pointer]
                        - row "SUP-00002 Open record Operations document b58699c1-0a8a-40b9-8907-6f3bcf6aa455 pending Actions for this record" [selected] [ref=e301]:
                          - cell "SUP-00002 Open record" [ref=e302]:
                            - generic [ref=e303]:
                              - generic [ref=e304]: SUP-00002
                              - button "Open record" [ref=e305] [cursor=pointer]
                          - cell "Operations document b58699c1-0a8a-40b9-8907-6f3bcf6aa455" [ref=e306]
                          - cell "pending" [ref=e307]
                          - cell "Actions for this record" [ref=e308]:
                            - group "Actions for this record" [ref=e309]:
                              - button "Save supplier" [ref=e310] [cursor=pointer]
                    - paragraph [ref=e311]: CSV export requires the producer-authorized download binding; no client-side export is substituted.
                  - generic [ref=e312]:
                    - article "Operations document b58699c1-0a8a-40b9-8907-6f3bcf6aa455" [ref=e313]:
                      - generic [ref=e314]:
                        - generic [ref=e315]:
                          - button "Back" [ref=e316] [cursor=pointer]
                          - generic [ref=e317]:
                            - heading "Operations document b58699c1-0a8a-40b9-8907-6f3bcf6aa455" [level=2] [ref=e318]
                            - paragraph [ref=e319]:
                              - generic [ref=e320]: "Record reference:"
                              - text: SUP-00002
                          - generic [ref=e321]:
                            - generic [ref=e322]: "Status:"
                            - text: pending
                        - generic [ref=e323]:
                          - button "Save supplier" [ref=e324] [cursor=pointer]
                          - button "Activate" [ref=e325] [cursor=pointer]
                          - button "Block" [ref=e326] [cursor=pointer]
                          - button "Inactivate" [ref=e327] [cursor=pointer]
                          - button "Delete pending supplier" [ref=e328] [cursor=pointer]
                          - button "Open page" [ref=e329] [cursor=pointer]
                      - generic [ref=e330]:
                        - generic [ref=e331]:
                          - term [ref=e332]: Supplier number
                          - definition [ref=e333]: SUP-00002
                        - generic [ref=e334]:
                          - term [ref=e335]: Status
                          - definition [ref=e336]: pending
                      - generic [ref=e337]:
                        - region "General information" [ref=e338]:
                          - heading "General information" [level=3] [ref=e339]
                          - generic [ref=e342]:
                            - generic [ref=e343]:
                              - term [ref=e344]: Legal name
                              - definition [ref=e345]: Operations document b58699c1-0a8a-40b9-8907-6f3bcf6aa455
                            - generic [ref=e346]:
                              - term [ref=e347]: Trading name
                              - definition [ref=e348]: Unavailable
                            - generic [ref=e349]:
                              - term [ref=e350]: Type
                              - definition [ref=e351]: Unavailable
                            - generic [ref=e352]:
                              - term [ref=e353]: Country
                              - definition [ref=e354]: France
                            - generic [ref=e355]:
                              - term [ref=e356]: Address
                              - definition [ref=e357]: Isolated E2E supplier
                            - generic [ref=e358]:
                              - term [ref=e359]: Tax ID
                              - definition [ref=e360]: b58699c1-0a8a-40b9-8907-6f3bcf6aa455
                            - generic [ref=e361]:
                              - term [ref=e362]: Registration number
                              - definition [ref=e363]: Unavailable
                            - generic [ref=e364]:
                              - term [ref=e365]: Contact name
                              - definition [ref=e366]: Unavailable
                            - generic [ref=e367]:
                              - term [ref=e368]: Contact email
                              - definition [ref=e369]: operations@example.invalid
                            - generic [ref=e370]:
                              - term [ref=e371]: Contact phone
                              - definition [ref=e372]: Unavailable
                            - generic [ref=e373]:
                              - term [ref=e374]: Finance email
                              - definition [ref=e375]: Unavailable
                            - generic [ref=e376]:
                              - term [ref=e377]: Payment terms
                              - definition [ref=e378]: Net 45
                            - generic [ref=e379]:
                              - term [ref=e380]: Currency
                              - definition [ref=e381]: USD
                            - generic [ref=e382]:
                              - term [ref=e383]: Incoterm
                              - definition [ref=e384]: Unavailable
                            - generic [ref=e385]:
                              - term [ref=e386]: Risk rating
                              - definition [ref=e387]: Low
                            - generic [ref=e388]:
                              - term [ref=e389]: Due diligence complete
                              - definition [ref=e390]: Unavailable
                            - generic [ref=e391]:
                              - term [ref=e392]: Sanctions screening date
                              - definition [ref=e393]: Unavailable
                            - generic [ref=e394]:
                              - term [ref=e395]: NDA
                              - definition [ref=e396]: Unavailable
                            - generic [ref=e397]:
                              - term [ref=e398]: DPA
                              - definition [ref=e399]: Unavailable
                            - generic [ref=e400]:
                              - term [ref=e401]: Certifications
                              - definition
                            - generic [ref=e402]:
                              - term [ref=e403]: Categories
                              - definition
                            - generic [ref=e404]:
                              - term [ref=e405]: Notes
                              - definition [ref=e406]: Unavailable
                        - region "Contacts" [ref=e407]:
                          - heading "Contacts" [level=3] [ref=e408]
                          - generic:
                            - generic:
                              - list
                        - region "Commercial" [ref=e409]:
                          - heading "Commercial" [level=3] [ref=e410]
                          - paragraph [ref=e413]: Unavailable
                        - region "Compliance" [ref=e414]:
                          - heading "Compliance" [level=3] [ref=e415]
                          - paragraph [ref=e418]: Unavailable
                        - region "Bank" [ref=e419]:
                          - heading "Bank" [level=3] [ref=e420]
                          - generic [ref=e423]:
                            - group [ref=e424]:
                              - generic [ref=e425]:
                                - text: IBAN
                                - textbox "IBAN" [disabled] [ref=e426]
                              - generic [ref=e427]:
                                - text: Account
                                - textbox "Account" [disabled] [ref=e428]
                            - button "Review bank change" [ref=e429] [cursor=pointer]
                        - region "Source documents" [ref=e430]:
                          - heading "Source documents" [level=3] [ref=e431]
                          - generic [ref=e434]:
                            - region "No admitted attachments are linked to this record." [ref=e435]:
                              - status [ref=e436]:
                                - paragraph [ref=e437]: No admitted attachments are linked to this record.
                            - generic [ref=e438]:
                              - text: Attach a source document (server scan required)
                              - button "Attach a source document (server scan required)" [disabled] [ref=e439]
                              - button "Admit / scan / link (version 1)" [disabled] [ref=e440]
                        - region "Linked requests" [ref=e441]:
                          - heading "Linked requests" [level=3] [ref=e442]
                          - paragraph [ref=e445]: No linked requests in the authorized projection.
                        - region "Audit" [ref=e446]:
                          - heading "Audit" [level=3] [ref=e447]
                          - generic:
                            - generic:
                              - list
                    - paragraph [ref=e448]: Activation requires recorded prerequisites and the producer's current approval policy; this view does not certify external screening.
  - generic:
    - region "Notifications alt+T"
```

# Test source

```ts
  3   | import type { APIResponse, Page, Response, TestInfo } from "@playwright/test"
  4   | import type { DocumentEvidence } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
  5   | import { login, modeURL, observation } from "./runtime.ts"
  6   | import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"
  7   | import type { Account } from "./runtime.ts"
  8   | 
  9   | type Source = { selectionRef: string; label: string; surface: string }
  10  | type Schema = { id: string; version: number; ref: string; fields: { id: string; type: string; unit?: string }[] }
  11  | type Presentation = { title: string; excerpt: string; location: string; href?: string }
  12  | 
  13  | function domainPost(page: Page, account: Account, action: string, id?: string) {
  14  |   return page.waitForResponse((response) => {
  15  |     const request = response.request()
  16  |     const url = new URL(request.url())
  17  |     if (request.method() !== "POST" || url.origin !== account.origin || !url.pathname.endsWith("/procurement") || url.searchParams.get("page") !== "Suppliers") return false
  18  |     const body = request.postDataJSON() as { action?: string; id?: string }

## Bounded step outcomes
[]

