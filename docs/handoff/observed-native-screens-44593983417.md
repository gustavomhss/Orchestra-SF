# Original native screen observations

Read-only extraction from already completed Actions; no tests rerun.

## Run 44593983417; artifact 14565536261

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
Error: expect(locator).toBeEnabled() failed

Locator:  locator('#sf-u46-name')
Expected: enabled
Received: disabled
Timeout:  10000ms

Call log:
  - Expect "toBeEnabled" with timeout 10000ms
  - waiting for locator('#sf-u46-name')
    9 × locator resolved to <input disabled type="text" id="sf-u46-name" class="mx-input"/>
      - unexpected value "disabled"

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
              - strong [ref=e231]: sf-wp03-browser-hvVG7h
              - generic "/tmp/sf-wp03-browser-hvVG7h" [ref=e232]: 17 agents
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
                  - generic [ref=e247]: ⁨sf-wp03-browser-hvVG7h⁩ · Versions
                  - heading "Versions" [level=1] [ref=e248]
                - button "Create version" [ref=e251] [cursor=pointer]
              - generic [ref=e252]:
                - generic [ref=e254]:
                  - term [ref=e255]: Year
                  - definition [ref=e256]: "2027"
                - generic [ref=e258]:
                  - button "Compare versions" [disabled] [ref=e260]
                  - button "Version" [ref=e262] [cursor=pointer]
                  - button "Import workbook" [disabled] [ref=e264]
                - generic [ref=e268]:
                  - generic [ref=e270]:
                    - generic [ref=e271]: "2027"
                    - combobox "2027" [ref=e272]:
                      - option "2027" [selected]
                  - article "FY2027 — Draft 1" [ref=e273]:
                    - generic [ref=e274]:
                      - generic [ref=e275]:
                        - button "Back" [ref=e276] [cursor=pointer]
                        - generic [ref=e277]:
                          - heading "FY2027 — Draft 1" [level=2] [ref=e278]
                          - paragraph [ref=e279]:
                            - generic [ref=e280]: "Record reference:"
                            - text: 55b3cd44-2f4e-4337-8208-7986edd764ab
                        - generic [ref=e281]:
                          - generic [ref=e282]: "Status:"
                          - text: Draft
                      - generic [ref=e283]:
                        - button "Save" [disabled] [ref=e284]
                        - button "copy" [ref=e285] [cursor=pointer]
                        - button "official" [ref=e286] [cursor=pointer]
                        - button "lock" [ref=e287] [cursor=pointer]
                        - button "Open page" [ref=e288] [cursor=pointer]
                    - generic [ref=e289]:
                      - generic [ref=e290]:
                        - term [ref=e291]: Year
                        - definition [ref=e292]:
                          - generic [ref=e293]: 2,027 Year
                      - generic [ref=e294]:
                        - term [ref=e295]: State
                        - definition [ref=e296]: Draft
                    - region "Edit version" [ref=e298]:
                      - heading "Edit version" [level=3] [ref=e299]
                      - generic [ref=e302]:
                        - generic [ref=e303]: Name
                        - textbox "Name" [disabled] [ref=e304]: FY2027 — Draft 1
                        - generic [ref=e305]: Year
                        - spinbutton "Year" [disabled] [ref=e306]: "2027"
                    - button "delete" [ref=e308] [cursor=pointer]
  - generic:
    - region "Notifications alt+T"
```

# Test source

```ts
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
  103 |       await expect(review).toHaveAttribute("data-state", "ready")
  104 |       await expect(review.getByRole("heading", { name: "Review changes", exact: true })).toBeVisible()
  105 |       expect(commandCount, "Opening a native review must not submit the command").toBe(0)
  106 |       const confirm = review.getByRole("button", { name: "Confirm", exact: true })
  107 |       await expect(confirm).toBeEnabled()
  108 |       await confirm.click()
  109 |       // Observe completion or failure of the one confirmed native command;
  110 |       // never resend an uncertain mutation.
  111 |       try { await expect.poll(() => lifecycle.outcome?.state ?? "pending", { message: "first Planner save finishes or fails at the real HTTP boundary", timeout: 15_000 }).toMatch(/^(finished|failed)$/) }
  112 |       catch (error) { problem = error; observations.push({ event: "first-save-outcome-not-observed", elapsedMs: Date.now() - began }) }
  113 |       observations.push({ event: "rendered-outcome", commandCount, state: lifecycle.outcome?.state ?? "not-observed",
  114 |         notices: (await surface.locator(".sf-u46-alert").allTextContents()).map(redact),
  115 |         uncertain: await review.evaluateAll((reviews) => reviews.map((element) => element.getAttribute("data-state"))),
  116 |         knownVersionIds: await surface.locator("tr[data-sf-row]").evaluateAll((rows) => rows.map((element) => element.getAttribute("data-sf-row"))) })
  117 |     })
  118 | 
  119 |     await test.step("read current state without resending the save", async () => {
  120 |       try {
  121 |         const current = await page.request.get(sourceUrl, { timeout: 10_000 })
  122 |         const envelope = asRecord(await current.json())
  123 |         const versions = asRecord(asRecord(envelope.value).data).versions
  124 |         observations.push({ event: "read-only-current-Planner", status: current.status(), contentType: current.headers()["content-type"] ?? null,
  125 |           resultStatus: envelope.status, knownVersionIds: Array.isArray(versions) ? versions.map((version) => asRecord(version).id) : null })
  126 |       } catch (error) { observations.push({ event: "read-only-current-Planner-failed", error: redact(String(error)) }) }
  127 |       // Personal views uses POST for its read-only list, so this records whether
  128 |       // the same real body-bearing ingress also answers its normal read command.
  129 |       try {
  130 |         const current = await page.request.post(`${installation.origin}/sucafina/planner?sf=workbench-views`, {
  131 |           headers: { origin: installation.origin, "idempotency-key": randomUUID() }, data: { action: "list", input: {} }, timeout: 10_000,
  132 |         })
  133 |         const body: unknown = await current.json()
  134 |         const value = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {}
  135 |         observations.push({ event: "read-only-personal-views", status: current.status(), contentType: current.headers()["content-type"] ?? null,
  136 |           resultStatus: value.status, reason: typeof value.reason === "string" ? redact(value.reason) : null,
  137 |           entryCount: Array.isArray(value.value) ? value.value.length : null })
  138 |       } catch (error) { observations.push({ event: "read-only-personal-views-failed", error: redact(String(error)) }) }
  139 |     })
  140 | 
  141 |     expect(commandCount, "The uncertain mutation must not be repeated").toBe(1)
  142 |     if (problem) throw problem
  143 |     expect(lifecycle.outcome?.state, "The installed first-save request must complete, not fail in browser transport").toBe("finished")
  144 |     const response = lifecycle.outcome ? responses.get(lifecycle.outcome.request) : undefined
  145 |     expect(response, "The completed first save must have HTTP response headers").toBeDefined()
  146 |     const submitted = asRecord(response!.request().postDataJSON())
  147 |     expect(submitted).toMatchObject({ page: "Versions", action: "save", version: initial.version, confirmed: true })
  148 |     expect(submitted.values).toEqual({})
  149 |     expect(submitted.id).toBeUndefined()
  150 |     expect(response!.status()).toBe(200)
  151 |     expect(response!.headers()["content-type"]).toContain("application/json")
  152 |     const body: { ok?: unknown; value?: unknown } = await response!.json()
  153 |     observations.push({ event: "first-save-result", ok: body.ok, recordId: typeof body.value === "string" ? body.value : null })
  154 |     expect(body.ok).toBe(true)
  155 |     // The mounted producer intentionally returns only ok/warnings. The exact
  156 |     // new identity and fields are read through its authorized CAP23 boundary.
  157 |     const saved = await page.request.get(sourceUrl)
  158 |     expect(saved.status()).toBe(200)
  159 |     const read = Schema.decodeUnknownSync(SfPlanner.operations["domain.page.CAP23"].output)(await saved.json())
  160 |     if (read.status !== "ok") throw new Error("The saved Planner collection is unavailable")
  161 |     expect(read.value.data.versions).toHaveLength(initial.ids.length + 1)
  162 |     const created = read.value.data.versions.filter((record) => !initial.ids.includes(record.id))
  163 |     expect(created).toHaveLength(1)
  164 |     const record = created[0]!
  165 |     expect(record.id).toMatch(/\S+/)
  166 |     expect(record.name).toMatch(/\S+/)
  167 |     expect(Number.isInteger(record.year) && record.year > 2000 && record.year < 2100).toBe(true)
  168 |     await expect(page).toHaveURL((current) => current.pathname === "/orchestra/sf-planner/versions")
  169 |     expect(new URL(page.url()).searchParams.get("year")).toBe(String(record.year))
  170 |     const row = page.locator('tr[data-sf-row="' + record.id + '"]')
  171 |     await expect(row).toHaveCount(1)
  172 |     await expect(row).toBeVisible()
  173 |     await expect(row).toContainText(record.name)
  174 |     await expect(row).toContainText(String(record.year))
  175 |     await row.locator('button[data-sf-action="select"]').click()
  176 |     await expect(page).toHaveURL((current) => current.pathname === "/orchestra/sf-planner/versions/" + encodeSfRouteRef(record.id))
> 177 |     await expect(page.locator("#sf-u46-name")).toBeEnabled()
      |                                                ^ Error: expect(locator).toBeEnabled() failed
  178 |     await expect(page.locator("#sf-u46-name")).toHaveValue(record.name)
  179 |     await expect(page.locator("#sf-u46-year")).toHaveValue(String(record.year))
  180 |     expect(new URL(page.url()).searchParams.get("year")).toBe(String(record.year))
  181 |     await page.reload()
  182 |     await expect(page).toHaveURL((current) => current.pathname === "/orchestra/sf-planner/versions/" + encodeSfRouteRef(record.id))
  183 |     await expect(page.locator("#sf-u46-name")).toHaveValue(record.name)
  184 |     await expect(page.locator("#sf-u46-year")).toHaveValue(String(record.year))
  185 |     expect(commandCount).toBe(1)
  186 |     observations.push({ event: "first-save-authorized-identity", recordId: record.id, year: record.year })
  187 |   } catch (error) {
  188 |     problem = error
  189 |     throw error
  190 |   } finally {
  191 |     // Preserve transport/UI observations while the live page and host still
  192 |     // exist. The unchanged shared fixture then emits its redacted CLI log.
  193 |     try {
  194 |       if (commandCount !== 1 || problem) console.info("SF_PLANNER_INGRESS", JSON.stringify({ commandCount, observations }))
  195 |       await info.attach("bi62-first-save-http.json", { body: JSON.stringify({ snapshot: process.env.GITHUB_SHA ?? null,
  196 |         commandCount, observations, boundary: "Real CLI/factory/enrollment/Planner UI; one save attempt; subsequent requests only read current state. No route, body, authority or domain result is replaced." }, null, 2), contentType: "application/json" })
  197 |       await info.attach("bi62-first-save.png", { body: await page.screenshot(), contentType: "image/png" })
  198 |     } finally { await installation.stop() }
  199 |   }
  200 | })
  201 | 
  202 | function redact(value: string) {
  203 |   return value.slice(0, 4000)
  205 |     .replace(/(sucafina_operator_[a-f0-9]{24}=)[^;\s"']*/gi, "$1[redacted]")
  207 |     .replace(/\b[a-f0-9]{32,}\b/gi, "[redacted-hex]")
  208 | }
  209 | 
```

