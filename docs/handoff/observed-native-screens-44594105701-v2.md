# Original native screen observations

Read-only extraction from already completed Actions; no tests rerun.

## Run 44594105701; artifact 14565396740

Available contexts: packages/app-shell/e2e/test-results/sucafina-operations-CI-UI--048f9-ssion-without-a-new-version-chromium/error-context.md, packages/app-shell/e2e/test-results/sucafina-operations-CI-UI--3344d-ues-and-exact-C02-drilldown-chromium/error-context.md, packages/app-shell/e2e/test-results/sucafina-operations-CI-UI--a3b16-t-without-duplicate-effects-chromium/error-context.md, packages/app-shell/e2e/test-results/sucafina-operations-CI-UI--b41a7-while-the-future-PO-changes-chromium/error-context.md, packages/app-shell/e2e/test-results/sucafina-operations-CI-UI--baa3d-e-through-source-revocation-chromium/error-context.md, packages/app-shell/e2e/test-results/sucafina-wp04-procurement--1f0cd--an-explicit-version-choice-chromium/error-context.md, packages/app-shell/e2e/test-results/sucafina-wp04-procurement--5ae3c-n-the-real-detail-and-queue-chromium/error-context.md, packages/app-shell/e2e/test-results/sucafina-wp04-procurement--87a1f-hanging-a-submitted-request-chromium/error-context.md, packages/app-shell/e2e/test-results/sucafina-wp04-procurement--90263-egotiated-entries-preserved-chromium/error-context.md, packages/app-shell/e2e/test-results/sucafina-wp04-procurement--9e351--without-clearing-the-draft-chromium/error-context.md, packages/app-shell/e2e/test-results/sucafina-wp04-procurement--a3e63-n-action-after-cancellation-chromium/error-context.md, packages/app-shell/e2e/test-results/sucafina-wp04-procurement--e9930--edits-without-another-POST-chromium/error-context.md, packages/app-shell/e2e/test-results/sucafina-wp04-procurement--f398c-read-or-update-bank-details-chromium/error-context.md

Screen context files: 5

### packages/app-shell/e2e/test-results/sucafina-operations-CI-UI--048f9-ssion-without-a-new-version-chromium/error-context.md

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sucafina/operations.spec.ts >> CI-UI-OPERATIONS >> OP-PROC-03 missing FX stays unavailable and refuses submission without a new version
- Location: e2e/sucafina/operations.spec.ts:23:3

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
          - generic "Requests"
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
              - strong [ref=e231]: sf-wp04-browser-2KJi6f
              - generic "/tmp/sf-wp04-browser-2KJi6f" [ref=e232]: 8 agents
            - generic [ref=e233]: ⌄
          - paragraph [ref=e234]: Build what matters. With agents.
      - main [ref=e236]:
        - generic [ref=e238]:
          - toolbar "Context and access" [ref=e239]:
            - button "Refresh access" [ref=e240] [cursor=pointer]
            - button "Sign out" [ref=e241] [cursor=pointer]
          - region "Requests" [ref=e244]:
            - generic [ref=e245]:
              - generic [ref=e246]:
                - generic [ref=e247]:
                  - generic [ref=e248]: ⁨sf-wp04-browser-2KJi6f⁩ · Requests
                  - heading "Requests" [level=1] [ref=e249]
                - button "Create request" [disabled] [ref=e252]
              - generic [ref=e254]:
                - generic [ref=e255]:
                  - generic [ref=e256]:
                    - text: Search requests
                    - generic [ref=e257]:
                      - searchbox "Search requests" [ref=e258]
                      - button "Clear filters" [disabled] [ref=e259]
                    - table "Requests" [ref=e262]:
                      - caption [ref=e263]: Requests
                      - rowgroup [ref=e270]:
                        - row "Sort by Request identity Sort by Title Sort by Status Sort by Requester Actions" [ref=e271]:
                          - columnheader "Sort by Request identity" [ref=e272]:
                            - button "Sort by Request identity" [ref=e273] [cursor=pointer]:
                              - generic [ref=e274]: Request identity
                              - generic [ref=e275]: ↕
                          - columnheader "Sort by Title" [ref=e276]:
                            - button "Sort by Title" [ref=e277] [cursor=pointer]:
                              - generic [ref=e278]: Title
                              - generic [ref=e279]: ↕
                          - columnheader "Sort by Status" [ref=e280]:
                            - button "Sort by Status" [ref=e281] [cursor=pointer]:
                              - generic [ref=e282]: Status
                              - generic [ref=e283]: ↕
                          - columnheader "Sort by Requester" [ref=e284]:
                            - button "Sort by Requester" [ref=e285] [cursor=pointer]:
                              - generic [ref=e286]: Requester
                              - generic [ref=e287]: ↕
                          - columnheader "Actions" [ref=e288]
                      - rowgroup [ref=e289]:
                        - row "PR-2026-0001 Open record Frozen browser sourcing comparison src_pending First procurement operator Actions for this record" [ref=e290]:
                          - cell "PR-2026-0001 Open record" [ref=e291]:
                            - generic [ref=e292]:
                              - generic [ref=e293]: PR-2026-0001
                              - button "Open record" [ref=e294] [cursor=pointer]
                          - cell "Frozen browser sourcing comparison" [ref=e295]
                          - cell "src_pending" [ref=e296]
                          - cell "First procurement operator" [ref=e297]
                          - cell "Actions for this record" [ref=e298]:
                            - group "Actions for this record"
                  - article [ref=e300]:
                    - heading "Create request" [level=2] [ref=e302]
                    - alert [ref=e303]: The response may have been lost after the command. Do not retry automatically; reconcile with the source.
                    - generic [ref=e305]:
                      - group "Requisition" [ref=e306]:
                        - generic [ref=e307]: Requisition
                        - generic [ref=e308]:
                          - generic [ref=e309]:
                            - generic [ref=e310]: Title
                            - textbox "Title" [disabled] [ref=e311]: Operations missing FX 91452fdd-54eb-41a5-af2c-373591c9724d
                          - generic [ref=e312]:
                            - generic [ref=e313]: Type
                            - combobox "Type" [disabled] [ref=e314]:
                              - option "Choose…" [disabled]
                              - option "product" [disabled]
                              - option "service" [disabled] [selected]
                          - generic [ref=e315]:
                            - generic [ref=e316]: Description
                            - textbox "Description" [disabled] [ref=e317]: Isolated Operations sourcing scope
                          - generic [ref=e318]:
                            - generic [ref=e319]: Estimated amount
                            - spinbutton "Estimated amount" [disabled] [ref=e320]: "100"
                          - generic [ref=e321]:
                            - generic [ref=e322]: Cost center
                            - textbox "Cost center" [disabled] [ref=e323]: Synthetic IT
                          - generic [ref=e324]:
                            - generic [ref=e325]: Needed by
                            - textbox "Needed by" [disabled] [ref=e326]: 2026-12-01
                          - generic [ref=e327]:
                            - generic [ref=e328]: Justification
                            - textbox "Justification" [disabled] [ref=e329]: Operations fixture only
                          - generic [ref=e330]:
                            - generic [ref=e331]: Recurring
                            - checkbox "Recurring" [disabled] [ref=e332]
                          - generic [ref=e333]:
                            - generic [ref=e334]: Frequency
                            - textbox "Frequency" [disabled] [ref=e335]
                          - generic [ref=e336]:
                            - generic [ref=e337]: Estimated annual
                            - spinbutton "Estimated annual" [disabled] [ref=e338]
                          - generic [ref=e339]:
                            - generic [ref=e340]: Expense type
                            - textbox "Expense type" [disabled] [ref=e341]
                          - generic [ref=e342]:
                            - generic [ref=e343]: Category
                            - textbox "Category" [disabled] [ref=e344]
                        - paragraph [ref=e345]: Saving does not submit or approve a request.
                      - button "Discard local draft changes" [disabled] [ref=e347]
                - alert [ref=e348]:
                  - text: The response may have been lost after the command. Do not retry automatically; reconcile with the source.
                  - button "Refresh source" [ref=e349] [cursor=pointer]
  - generic:
    - region "Notifications alt+T"
```

# Test source

```ts
  56  |   expect(selected.request().postDataJSON()).toMatchObject({ values: { quoteId } })
  57  |   await page.getByRole("button", { name: "Sourcing", exact: true }).click()
  58  |   const version = await sourceVersion(page)
  59  |   await page.goto(`/orchestra/sf-procurement/requests/${encoded}/history`)
  60  |   const history = page.locator(`article[data-sf-request-ref="${id}"] [data-stage="history"]`).getByRole("listitem")
  61  |   const historyText = await history.allTextContents()
  62  |   expect(historyText.length).toBeGreaterThan(0)
  63  |   const summary = await page.locator(`article[data-sf-request-ref="${id}"] p`).filter({ hasText: /^Status:/ }).innerText()
  64  |   await page.goto(`/orchestra/sf-procurement/requests/${encoded}/sourcing`)
  65  |   const pending = commandResponse(page, account.origin, "submit_sourcing", id)
  66  |   await page.getByRole("button", { name: "Submit sourcing", exact: true }).click()
  67  |   const review = page.locator('[data-component="sf-change-review"]')
  68  |   await expect(review).toHaveCount(1)
  69  |   await review.getByRole("button", { name: "Confirm once", exact: true }).click()
  70  |   const rejected = await pending
  71  |   const producer = "Quote 1: no FX rate defined for JPY (Settings → Currencies)"
  72  |   const alert = "sourcing.quotes.0.currency: " + producer
  73  |   expect(rejected.status()).toBe(422)
  74  |   expect(rejected.request().postDataJSON()).toMatchObject({ page: "Requests", action: "submit_sourcing", id, version: Number(version) })
  75  |   expect(await rejected.json()).toMatchObject({ ok: false, errors: [producer], fieldErrors: [{ field: "sourcing.quotes.0.currency", message: producer }] })
  76  |   await expect(page.getByRole("alert").filter({ hasText: alert })).toHaveText(alert)
  77  |   await expect(page.getByRole("alert", { name: "The producer did not accept this operation.", exact: true })).toBeVisible()
  78  |   const currency = page.locator("fieldset.sf-u12-quote").first().getByRole("textbox", { name: "Currency", exact: true })
  79  |   await expect(currency).toHaveValue("JPY")
  80  |   await expect(currency).toHaveAttribute("aria-invalid", "true")
  81  |   await expect(currency).toHaveAttribute("aria-describedby", "sf-u12-currency-0")
  82  |   await expect(page.locator("#sf-u12-currency-0")).toHaveText(producer)
  83  |   await expect(currency).toHaveAccessibleDescription(producer)
  84  |   await expect(page.locator(".sf-u12-heading p").filter({ hasText: /^Stage:/ })).toHaveText("Stage: sourcing · Source version: " + version)
  85  |   await page.goto(`/orchestra/sf-procurement/requests/${encoded}`)
  86  |   await expect(page.locator(`article[data-sf-request-ref="${id}"] p`).filter({ hasText: /^Status:/ })).toHaveText(summary)
  87  |   await expect(page.locator(`article[data-sf-request-ref="${id}"] p`).filter({ hasText: /^Status:/ })).toHaveText("Status: sourcing")
  88  |   await expect(page.locator(`article[data-sf-request-ref="${id}"] p[data-request-summary="${id}"]`)).toContainText("Value unavailable")
  89  |   await expect(page.locator(`article[data-sf-request-ref="${id}"] p[data-request-summary="${id}"]`)).not.toContainText("Sourcing approval")
  90  |   await expect(page.locator(`article[data-sf-request-ref="${id}"] p[data-request-money="${id}"]`)).toHaveText("Current request value: 28000 JPY; base value: Unavailable; FX: Unavailable.")
  91  |   await page.goto(`/orchestra/sf-procurement/requests/${encoded}/history`)
  92  |   await expect(page.locator(`article[data-sf-request-ref="${id}"] [data-stage="history"]`).getByRole("listitem")).toHaveText(historyText)
  93  |   await page.goto(`/orchestra/sf-procurement/approvals/${encoded}/review`)
  94  |   await expect(page).toHaveURL((url) => url.origin === account.origin && url.pathname === `/orchestra/sf-procurement/approvals/${encoded}/review`)
  95  |   await expect(page.getByRole("button", { name: "Approve current step", exact: true })).toHaveCount(0)
  96  |   await page.goto(`/orchestra/sf-procurement/requests/${encoded}/sourcing`)
  97  |   await expect(page.locator(".sf-u12-heading p").filter({ hasText: /^Stage:/ })).toHaveText("Stage: sourcing · Source version: " + version)
  98  |   await expect(page.locator("fieldset.sf-u12-quote legend").first()).toContainText(quoteId)
  99  |   await expect(page.locator("fieldset.sf-u12-quote").first().getByRole("combobox", { name: "Registered supplier", exact: true })).toHaveValue(supplier)
  100 |   await page.getByRole("button", { name: "Compare quotations", exact: true }).click()
  101 |   await expect(page.getByRole("combobox", { name: "Selected quotation", exact: true })).toHaveValue(quoteId)
  102 |   await observation(info, "operations-missing-fx-refusal", { recordId: id, quoteId, supplierId: supplier, domainVersion: version, refusal: { status: 422, field: "sourcing.quotes.0.currency", message: producer }, submitted: false })
  103 | }
  104 | 
  105 | async function createRequest(page: Page, account: Account, title: string) {
  106 |   const form = page.locator('form[data-command="create"][data-page="Requests"]')
  107 |   await expect(form).toHaveCount(1)
  108 |   await form.getByRole("textbox", { name: "Title", exact: true }).fill(title)
  109 |   await form.getByRole("combobox", { name: "Type", exact: true }).selectOption("service")
  110 |   await form.getByRole("textbox", { name: "Description", exact: true }).fill("Isolated Operations sourcing scope")
  111 |   await form.getByRole("spinbutton", { name: "Estimated amount", exact: true }).fill("100")
  112 |   await form.getByRole("textbox", { name: "Cost center", exact: true }).fill("Synthetic IT")
  113 |   await form.getByLabel("Needed by", { exact: true }).fill("2026-12-01")
  114 |   await form.getByRole("textbox", { name: "Justification", exact: true }).fill("Operations fixture only")
  115 |   await confirmCommand(page, account, "create", undefined, form.getByRole("button", { name: "Create request", exact: true }), "Confirm action")
  116 |   const row = page.locator("tr[data-sf-row]").filter({ has: page.getByRole("cell", { name: title, exact: true }) })
  117 |   await expect(row).toHaveCount(1)
  118 |   const id = (await row.getAttribute("data-sf-row")) ?? ""
  119 |   expect(id).toMatch(/^PR-2026-\d+$/)
  120 |   return id
  121 | }
  122 | 
  123 | async function approveRequest(page: Page, account: Account, id: string) {
  124 |   const encoded = encodeSfRouteRef(id)
  125 |   await page.goto(`/orchestra/sf-procurement/approvals/${encoded}`)
  126 |   await expect(page).toHaveURL((url) => url.origin === account.origin && url.pathname === `/orchestra/sf-procurement/approvals/${encoded}`)
  127 |   await page.getByRole("button", { name: "Review decision", exact: true }).click()
  128 |   const review = page.locator('[data-component="sf-change-review"]')
  129 |   await expect(review).toHaveCount(1)
  130 |   await page.getByRole("textbox", { name: "Approval comment (optional)", exact: true }).fill("Operations missing FX approval")
  131 |   const pending = commandResponse(page, account.origin, "approve", id)
  132 |   await review.getByRole("button", { name: "Approve PR", exact: true }).click()
  133 |   const response = await pending
  134 |   expect(response.status()).toBe(200)
  135 |   expect(await response.json()).toMatchObject({ ok: true })
  136 |   expect(response.request().postDataJSON()).toMatchObject({ page: "My approvals", action: "approve", id, values: { comment: "Operations missing FX approval" } })
  137 |   await expect(page.getByText("The producer acknowledged the command. No receipt was returned.", { exact: true })).toBeVisible()
  138 | }
  139 | 
  140 | async function confirmCommand(page: Page, account: Account, action: string, id: string | undefined, openReview: Locator, confirmName: string) {
  141 |   await expect(openReview).toBeEnabled()
  142 |   await openReview.click()
  143 |   const review = page.locator('[data-component="sf-change-review"]')
  144 |   await expect(review).toHaveCount(1)
  145 |   const pending = commandResponse(page, account.origin, action, id)
  146 |   await expect(review.getByRole("button", { name: confirmName, exact: true })).toBeEnabled()
  147 |   await review.getByRole("button", { name: confirmName, exact: true }).click()
  148 |   const response = await pending
  149 |   expect(response.status()).toBe(200)
  150 |   expect(await response.json()).toMatchObject({ ok: true })
  151 |   expect(response.request().postDataJSON()).toMatchObject({ page: "Requests", action, ...(id ? { id } : {}) })
  152 |   return response
  153 | }
  154 | 
  155 | function commandResponse(page: Page, origin: string, action: string, id?: string) {
> 156 |   return page.waitForResponse((response) => {
      |               ^ Error: page.waitForResponse: Test timeout of 60000ms exceeded.
  157 |     const request = response.request()
  158 |     const url = new URL(request.url())
  159 |     if (request.method() !== "POST" || url.origin !== origin || url.pathname !== "/sucafina/procurement") return false
  160 |     const body = request.postDataJSON() as { action?: string; id?: string }
  161 |     return body.action === action && (id === undefined || body.id === id)
  162 |   })
  163 | }
  164 | 
  165 | async function fillEnabledScores(quote: Locator) {
  166 |   for (const name of ["Technical scores", "Commercial scores"]) {
  167 |     const section = quote.locator("section").filter({ has: quote.page().getByRole("heading", { name, exact: true }) })
  168 |     const scores = section.getByRole("spinbutton")
  169 |     const count = await scores.count()
  170 |     for (let index = 0; index < count; index++) {
  171 |       const input = scores.nth(index)
  172 |       if (await input.isEnabled()) await input.fill("4")
  173 |     }
  174 |   }
  175 | }
  176 | 
  177 | async function sourceVersion(page: Page) {
  178 |   const line = page.locator(".sf-u12-heading p").filter({ hasText: /^Stage:/ })
  179 |   await expect(line).toHaveText(/^Stage: \S+ · Source version: [1-9]\d*$/)
  180 |   return (await line.innerText()).replace(/^Stage: \S+ · Source version: /, "")
  181 | }
  182 | 
```

### packages/app-shell/e2e/test-results/sucafina-operations-CI-UI--3344d-ues-and-exact-C02-drilldown-chromium/error-context.md

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sucafina/operations.spec.ts >> CI-UI-OPERATIONS >> OP-PROC-01 real comparison preserves the J04 values and exact C02 drilldown
- Location: e2e/sucafina/operations.spec.ts:13:3

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByRole('table').filter({ has: getByRole('columnheader', { name: 'Value basis', exact: true }) }).getByRole('row').filter({ has: getByRole('table').filter({ has: getByRole('columnheader', { name: 'Value basis', exact: true }) }).getByRole('link', { name: 'PR-2026-0001', exact: true }) }).getByRole('cell', { name: 'pending-approval', exact: true })
Expected: 1
Received: 0
Timeout:  10000ms

Call log:
  - Expect "toHaveCount" with timeout 10000ms
  - waiting for getByRole('table').filter({ has: getByRole('columnheader', { name: 'Value basis', exact: true }) }).getByRole('row').filter({ has: getByRole('table').filter({ has: getByRole('columnheader', { name: 'Value basis', exact: true }) }).getByRole('link', { name: 'PR-2026-0001', exact: true }) }).getByRole('cell', { name: 'pending-approval', exact: true })
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
          - generic "Requests"
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
              - strong [ref=e231]: sf-wp04-browser-2KJi6f
              - generic "/tmp/sf-wp04-browser-2KJi6f" [ref=e232]: 8 agents
            - generic [ref=e233]: ⌄
          - paragraph [ref=e234]: Build what matters. With agents.
      - main [ref=e236]:
        - generic [ref=e238]:
          - toolbar "Context and access" [ref=e239]:
            - button "Refresh access" [ref=e240] [cursor=pointer]
            - button "Sign out" [ref=e241] [cursor=pointer]
          - region [ref=e243]:
            - generic [ref=e244]:
              - generic [ref=e246]:
                - generic [ref=e247]: ⁨sf-wp04-browser-2KJi6f⁩ · Requests
                - heading [level=1]
              - generic [ref=e249]:
                - group "Filters" [ref=e250]:
                  - generic [ref=e251]: Filters
                  - generic [ref=e252]:
                    - text: Queue
                    - combobox "Queue" [ref=e253]:
                      - option "All" [selected]
                  - generic [ref=e254]:
                    - text: Status
                    - combobox "Status" [ref=e255]:
                      - option "All" [selected]
                      - option "Sourcing approval"
                  - generic [ref=e256]:
                    - text: Decision
                    - combobox "Decision" [ref=e257]:
                      - option "All" [selected]
                  - generic [ref=e258]:
                    - text: Search
                    - searchbox "Search" [ref=e259]
                - table "Procurement requests" [ref=e264]:
                  - caption [ref=e265]: Procurement requests
                  - rowgroup [ref=e277]:
                    - row "Request Value basis Amount Subject Status Decision Holder Waiting since Next step Actions" [ref=e278]:
                      - columnheader "Request" [ref=e279]
                      - columnheader "Value basis" [ref=e280]
                      - columnheader "Amount" [ref=e281]
                      - columnheader "Subject" [ref=e282]
                      - columnheader "Status" [ref=e283]
                      - columnheader "Decision" [ref=e284]
                      - columnheader "Holder" [ref=e285]
                      - columnheader "Waiting since" [ref=e286]
                      - columnheader "Next step" [ref=e287]
                      - columnheader "Actions" [ref=e288]
                  - rowgroup [ref=e289]:
                    - row "PR-2026-0001 Open record pending-approval 32400 USD Frozen browser sourcing comparison Sourcing approval Unavailable Unassigned Unavailable Unavailable Actions for this record" [ref=e290]:
                      - cell "PR-2026-0001 Open record" [ref=e291]:
                        - generic [ref=e292]:
                          - link "PR-2026-0001" [ref=e294]:
                            - /url: "?request=PR-2026-0001#PR-2026-0001"
                          - button "Open record" [ref=e295] [cursor=pointer]
                      - cell "pending-approval" [ref=e296]
                      - cell "32400 USD" [ref=e297]
                      - cell "Frozen browser sourcing comparison" [ref=e298]
                      - cell "Sourcing approval" [ref=e299]
                      - cell "Unavailable" [ref=e300]
                      - cell "Unassigned" [ref=e301]
                      - cell "Unavailable" [ref=e302]
                      - cell "Unavailable" [ref=e303]
                      - cell "Actions for this record" [ref=e304]:
                        - group "Actions for this record"
          - region "Requests" [ref=e307]:
            - generic [ref=e308]:
              - generic [ref=e309]:
                - generic [ref=e310]:
                  - generic [ref=e311]: ⁨sf-wp04-browser-2KJi6f⁩ · Requests
                  - heading "Requests" [level=1] [ref=e312]
                - button "Create request" [ref=e315] [cursor=pointer]
              - generic [ref=e318]:
                - generic [ref=e319]:
                  - text: Search requests
                  - generic [ref=e320]:
                    - searchbox "Search requests" [ref=e321]
                    - button "Clear filters" [disabled] [ref=e322]
                  - table "Requests" [ref=e325]:
                    - caption [ref=e326]: Requests
                    - rowgroup [ref=e333]:
                      - row "Sort by Request identity Sort by Title Sort by Status Sort by Requester Actions" [ref=e334]:
                        - columnheader "Sort by Request identity" [ref=e335]:
                          - button "Sort by Request identity" [ref=e336] [cursor=pointer]:
                            - generic [ref=e337]: Request identity
                            - generic [ref=e338]: ↕
                        - columnheader "Sort by Title" [ref=e339]:
                          - button "Sort by Title" [ref=e340] [cursor=pointer]:
                            - generic [ref=e341]: Title
                            - generic [ref=e342]: ↕
                        - columnheader "Sort by Status" [ref=e343]:
                          - button "Sort by Status" [ref=e344] [cursor=pointer]:
                            - generic [ref=e345]: Status
                            - generic [ref=e346]: ↕
                        - columnheader "Sort by Requester" [ref=e347]:
                          - button "Sort by Requester" [ref=e348] [cursor=pointer]:
                            - generic [ref=e349]: Requester
                            - generic [ref=e350]: ↕
                        - columnheader "Actions" [ref=e351]
                    - rowgroup [ref=e352]:
                      - row "PR-2026-0001 Open record Frozen browser sourcing comparison src_pending First procurement operator Actions for this record" [ref=e353]:
                        - cell "PR-2026-0001 Open record" [ref=e354]:
                          - generic [ref=e355]:
                            - generic [ref=e356]: PR-2026-0001
                            - button "Open record" [ref=e357] [cursor=pointer]
                        - cell "Frozen browser sourcing comparison" [ref=e358]
                        - cell "src_pending" [ref=e359]
                        - cell "First procurement operator" [ref=e360]
                        - cell "Actions for this record" [ref=e361]:
                          - group "Actions for this record"
                - status [ref=e363]: Open request
  - generic:
    - region "Notifications alt+T"
```

# Test source

```ts
  1  | import { expect, type Page, type TestInfo } from "@playwright/test"
  2  | import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"
  3  | import { login, observation, readManifest } from "./runtime"
  4  | 
  5  | /** Literal J04 oracle; no test-side scoring or currency formula. */
  6  | export async function procurementComparison(page: Page, info: TestInfo) {
  7  |   const account = await login(page, "first", "comparison")
  8  |   const manifest = await readManifest()
  9  |   const id = manifest.records.comparison
  10 |   expect(id).toMatch(/^PR-2026-\d+$/)
  11 |   const encoded = encodeSfRouteRef(id)
  12 |   await page.goto(`/orchestra/sf-procurement/requests/${encoded}/sourcing/compare`)
  13 |   await expect(page).toHaveURL((url) => url.origin === account.origin && url.pathname === `/orchestra/sf-procurement/requests/${encoded}/sourcing/compare`)
  14 |   const comparison = page.locator("section.sf-u12-comparison")
  15 |   const table = comparison.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "Base amount / FX", exact: true }) })
  16 |   await expect(table).toHaveCount(1)
  17 |   await expect(table.getByRole("row")).toHaveCount(4)
  18 |   const quotes = [
  19 |     ["Browser quote A", "32400 USD (base: 1)", "Browser quote A · USD 32400"],
  20 |     ["Browser quote B", "30240 USD (submitted FX: 1.08)", "Browser quote B · EUR 28000"],
  21 |     ["Browser quote C", "29000 USD (base: 1)", "Browser quote C · USD 29000"],
  22 |   ] as const
  23 |   for (const expected of quotes) {
  24 |     const row = table.getByRole("row").filter({ hasText: expected[0] })
  25 |     await expect(row).toHaveCount(1)
  26 |     await expect(row.getByRole("cell", { name: expected[1], exact: true })).toHaveCount(1)
  27 |     await expect(comparison.getByRole("combobox", { name: "Selected quotation", exact: true }).locator("option").filter({ hasText: expected[2] })).toHaveCount(1)
  28 |   }
  29 |   await expect(comparison.getByRole("status").filter({ hasText: "Rank 1: Browser quote A" })).toHaveText("Rank 1: Browser quote A")
  30 |   await expect(comparison.getByRole("status").filter({ hasText: "2160 USD (7.14%) above the lowest eligible proposal" })).toHaveText("2160 USD (7.14%) above the lowest eligible proposal")
  31 |   const selected = comparison.getByRole("combobox", { name: "Selected quotation", exact: true })
  32 |   await expect(selected.locator("option:checked")).toHaveText("Browser quote A · USD 32400")
  33 |   await page.goto(`/orchestra/sf-procurement/requests/${encoded}`)
  34 |   const detail = page.locator(`article[data-sf-request-ref="${id}"]`)
  35 |   await expect(detail).toHaveCount(1)
  36 |   await expect(detail.locator("p").filter({ hasText: /^Request identity:/ })).toHaveText(`Request identity: ${id}`)
  37 |   await expect(detail.locator("p").filter({ hasText: /^Status:/ })).toHaveText("Status: src_pending")
  38 |   await expect(detail.locator("p").filter({ hasText: /^Current source version:/ })).toHaveText(/^Current source version: [1-9]\d*$/)
  39 |   await page.goto(`/orchestra/sf-procurement/requests/${encoded}/sourcing`)
  40 |   await expect(page.getByRole("status").filter({ hasText: /^Sourcing is not editable in the current request stage\.$/ }))
  41 |     .toHaveText("Sourcing is not editable in the current request stage.")
  42 |   await expect(page.getByRole("button", { name: "Submit sourcing", exact: true })).toHaveCount(0)
  43 |   await page.goto("/orchestra/sf-procurement/requests")
  44 |   const queue = page.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "Value basis", exact: true }) })
  45 |   await expect(queue).toHaveCount(1)
  46 |   const link = queue.getByRole("link", { name: id, exact: true })
  47 |   await expect(link).toHaveAttribute("href", `?request=${id}#${id}`)
> 48 |   await expect(queue.getByRole("row").filter({ has: link }).getByRole("cell", { name: "pending-approval", exact: true })).toHaveCount(1)
     |                                                                                                                           ^ Error: expect(locator).toHaveCount(expected) failed
  49 |   await link.click()
  50 |   await expect(page).toHaveURL((url) => url.searchParams.get("request") === id && decodeURIComponent(url.hash.slice(1)) === id)
  51 |   await expect(page.getByText("Current request value: 32400 USD; base value: 32400 USD; FX: 1 (base).", { exact: true })).toHaveCount(1)
  52 |   await observation(info, "operations-j04-comparison", { recordId: id, literalOracle: { selected: "A", originalB: "28000 EUR", submittedRateB: 1.08, baseB: "30240 USD", rank: ["A", "B"], premium: "2160 USD (7.14%)" }, c06MaterialConfirmation: "NOT_EXERCISED" })
  53 | }
  54 | 
```

### packages/app-shell/e2e/test-results/sucafina-operations-CI-UI--a3b16-t-without-duplicate-effects-chromium/error-context.md

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sucafina/operations.spec.ts >> CI-UI-OPERATIONS >> OP-IMPORT-01 real preview and one Apply recover the same receipt without duplicate effects
- Location: e2e/sucafina/operations.spec.ts:28:3

# Error details

```
Error: expect(locator).toBeEnabled() failed

Locator:  locator('[data-sf-record-detail]').locator('#sf-u46-name')
Expected: enabled
Received: disabled
Timeout:  10000ms

Call log:
  - Expect "toBeEnabled" with timeout 10000ms
  - waiting for locator('[data-sf-record-detail]').locator('#sf-u46-name')
    14 × locator resolved to <input disabled type="text" id="sf-u46-name" class="mx-input"/>
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
              - strong [ref=e231]: sf-wp04-browser-2KJi6f
              - generic "/tmp/sf-wp04-browser-2KJi6f" [ref=e232]: 8 agents
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
                  - generic [ref=e247]: ⁨sf-wp04-browser-2KJi6f⁩ · Versions
                  - heading "Versions" [level=1] [ref=e248]
                - button "Create version" [ref=e251] [cursor=pointer]
              - generic [ref=e252]:
                - generic [ref=e254]:
                  - term [ref=e255]: Year
                  - definition [ref=e256]: "2027"
                - generic [ref=e258]:
                  - button "Compare versions" [disabled] [ref=e260]
                  - button "Version" [ref=e262] [cursor=pointer]
                  - button "Import workbook" [ref=e264] [cursor=pointer]
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
                            - text: c5355a97-86b1-4495-b3b1-1d63b7ad1bee
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
  36  |       rows.push(Array.from({ length: sheet.columnCount }, (_, column) => row.getCell(column + 1).value))
  37  |     })
  38  |     return [sheet.name, rows]
  39  |   }))
  40  | }
  41  | 
  42  | async function tokens(page: Page, account: Account, version: string, year: string, ids: string[]) {
  43  |   expect((await page.goto(`/orchestra/sf-planner/opex?${new URLSearchParams({ version, year })}`))?.status()).toBe(200)
  44  |   const result: Record<string, number> = {}
  45  |   for (const id of ids) {
  46  |     const row = page.locator(`tr[data-sf-row="${id}"]`)
  47  |     await expect(row).toHaveCount(1)
  48  |     await row.getByRole("button", { name: "Manage", exact: true }).click()
  49  |     const detail = page.getByRole("region", { name: "Manage record", exact: true })
  50  |     const line = detail.locator("p").filter({ has: page.locator("code", { hasText: id }) })
  51  |     await expect(line).toHaveCount(1)
  52  |     const match = /Source revision:\s*(\d+)/.exec(await line.innerText())
  53  |     expect(match).not.toBeNull()
  54  |     const revision = Number(match![1])
  55  |     expect(Number.isSafeInteger(revision)).toBe(true)
  56  |     result[id] = revision
  57  |   }
  58  |   return result
  59  | }
  60  | 
  61  | function versionSave(page: Page, account: Account) {
  62  |   const path = new URL(account.baseURL).pathname + "/planner"
  63  |   return page.waitForResponse((response) => {
  64  |     const request = response.request()
  65  |     const url = new URL(request.url())
  66  |     return request.method() === "POST" && url.origin === account.origin && url.pathname === path && url.searchParams.get("page") === "Versions" && request.postDataJSON()?.action === "save"
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
> 136 |   await expect(nameField).toBeEnabled()
      |                           ^ Error: expect(locator).toBeEnabled() failed
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
  165 |   expect((await page.goto("/orchestra/sf-imports"))?.status()).toBe(200)
  166 |   const root = page.locator("[data-import-workbench]")
  167 |   await expect(root).toHaveCount(1)
  168 |   const status = root.locator(":scope > [role='status']")
  169 |   await expect(status).toHaveCount(1)
  170 |   const invalid = await page.request.post(modeURL(account, "planner", "import-preview").href, { maxRetries: 0, headers: { Origin: account.origin, "Idempotency-Key": randomUUID() }, data: { admittedFileRef: "invalid-schema-probe", format: "xlsx", options: { unknown: true } } })
  171 |   expect(invalid.status()).toBe(400)
  172 |   expect(await invalid.json()).toEqual({ status: "invalid" })
  173 |   const destinations = waiting("import-targets")
  174 |   await root.getByRole("button", { name: "Find destinations", exact: true }).click()
  175 |   const targets = await valueOf<Destination[]>(await destinations)
  176 |   expect(targets.filter((target) => target.label === name)).toHaveLength(1)
  177 |   const index = targets.findIndex((target) => target.label === name)
  178 |   expect(targets[index]).toMatchObject({ surface: "planner", formats: expect.arrayContaining(["xlsx"]) })
  179 |   await root.getByLabel("Destination", { exact: true }).selectOption(String(index))
  180 |   await root.getByLabel("File", { exact: true }).setInputFiles({ name: name + ".xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: bytes })
  181 |   await expect(root.getByLabel("Create a new Planner version", { exact: true })).not.toBeChecked()
  182 |   await expect(root.getByLabel("Remove records missing from supplied sheets", { exact: true })).not.toBeChecked()
  183 |   const admission = waiting("import-admit", "POST"), previewResponse = waiting("import-preview", "POST"), detailResponse = waiting("import-detail")
  184 |   await root.getByRole("button", { name: "Preview changes", exact: true }).click()
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
  203 |   const detail = await valueOf<Detail>(await detailResponse)
  204 |   expect(preview).toMatchObject({ sourceDigest, format: "xlsx", state: "preview", domainApplied: false, receipts: [], issues: [], context: { principalRef: account.principal, surface: "planner" } })
  205 |   expect(preview.baseIdentity).toEqual([expect.objectContaining({ surface: "planner", type: "planner-version", id: version })])
  206 |   expect(preview.commands).toHaveLength(1)
  207 |   const command = preview.commands[0]!
  208 |   expect(command.target).toEqual(preview.baseIdentity[0])
  209 |   expect(command.preview.engineVersion).toBe("planner-runtime-v1")
  210 |   for (const [id, prior, next] of [[renewal, 72000, 84000], [fixed, 518000, 518000]] as const) {

### packages/app-shell/e2e/test-results/sucafina-operations-CI-UI--b41a7-while-the-future-PO-changes-chromium/error-context.md

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
          - generic "Requests"
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
              - strong [ref=e231]: sf-wp04-browser-2KJi6f
              - generic "/tmp/sf-wp04-browser-2KJi6f" [ref=e232]: 8 agents
            - generic [ref=e233]: ⌄
          - paragraph [ref=e234]: Build what matters. With agents.
      - main [ref=e236]:
        - generic [ref=e238]:
          - toolbar "Context and access" [ref=e239]:
            - button "Refresh access" [ref=e240] [cursor=pointer]
            - button "Sign out" [ref=e241] [cursor=pointer]
          - region "Requests" [ref=e244]:
            - generic [ref=e245]:
              - generic [ref=e246]:
                - generic [ref=e247]:
                  - generic [ref=e248]: ⁨sf-wp04-browser-2KJi6f⁩ · Requests
                  - heading "Requests" [level=1] [ref=e249]
                - button "Create request" [disabled] [ref=e252]
              - generic [ref=e254]:
                - generic [ref=e255]:
                  - generic [ref=e256]:
                    - text: Search requests
                    - generic [ref=e257]:
                      - searchbox "Search requests" [ref=e258]
                      - button "Clear filters" [disabled] [ref=e259]
                    - table "Requests" [ref=e262]:
                      - caption [ref=e263]: Requests
                      - rowgroup [ref=e270]:
                        - row "Sort by Request identity Sort by Title Sort by Status Sort by Requester Actions" [ref=e271]:
                          - columnheader "Sort by Request identity" [ref=e272]:
                            - button "Sort by Request identity" [ref=e273] [cursor=pointer]:
                              - generic [ref=e274]: Request identity
                              - generic [ref=e275]: ↕
                          - columnheader "Sort by Title" [ref=e276]:
                            - button "Sort by Title" [ref=e277] [cursor=pointer]:
                              - generic [ref=e278]: Title
                              - generic [ref=e279]: ↕
                          - columnheader "Sort by Status" [ref=e280]:
                            - button "Sort by Status" [ref=e281] [cursor=pointer]:
                              - generic [ref=e282]: Status
                              - generic [ref=e283]: ↕
                          - columnheader "Sort by Requester" [ref=e284]:
                            - button "Sort by Requester" [ref=e285] [cursor=pointer]:
                              - generic [ref=e286]: Requester
                              - generic [ref=e287]: ↕
                          - columnheader "Actions" [ref=e288]
                      - rowgroup [ref=e289]:
                        - row "PR-2026-0001 Open record Frozen browser sourcing comparison src_pending First procurement operator Actions for this record" [ref=e290]:
                          - cell "PR-2026-0001 Open record" [ref=e291]:
                            - generic [ref=e292]:
                              - generic [ref=e293]: PR-2026-0001
                              - button "Open record" [ref=e294] [cursor=pointer]
                          - cell "Frozen browser sourcing comparison" [ref=e295]
                          - cell "src_pending" [ref=e296]
                          - cell "First procurement operator" [ref=e297]
                          - cell "Actions for this record" [ref=e298]:
                            - group "Actions for this record"
                  - article [ref=e300]:
                    - heading "Create request" [level=2] [ref=e302]
                    - alert [ref=e303]: The response may have been lost after the command. Do not retry automatically; reconcile with the source.
                    - generic [ref=e305]:
                      - group "Requisition" [ref=e306]:
                        - generic [ref=e307]: Requisition
                        - generic [ref=e308]:
                          - generic [ref=e309]:
                            - generic [ref=e310]: Title
                            - textbox "Title" [disabled] [ref=e311]: Operations EUR snapshot 3f83e6ac-dee4-4958-b875-ab40aeb72271
                          - generic [ref=e312]:
                            - generic [ref=e313]: Type
                            - combobox "Type" [disabled] [ref=e314]:
                              - option "Choose…" [disabled]
                              - option "product" [disabled]
                              - option "service" [disabled] [selected]
                          - generic [ref=e315]:
                            - generic [ref=e316]: Description
                            - textbox "Description" [disabled] [ref=e317]: Isolated Operations sourcing scope
                          - generic [ref=e318]:
                            - generic [ref=e319]: Estimated amount
                            - spinbutton "Estimated amount" [disabled] [ref=e320]: "100"
                          - generic [ref=e321]:
                            - generic [ref=e322]: Cost center
                            - textbox "Cost center" [disabled] [ref=e323]: Synthetic IT
                          - generic [ref=e324]:
                            - generic [ref=e325]: Needed by
                            - textbox "Needed by" [disabled] [ref=e326]: 2026-12-01
                          - generic [ref=e327]:
                            - generic [ref=e328]: Justification
                            - textbox "Justification" [disabled] [ref=e329]: Operations fixture only
                          - generic [ref=e330]:
                            - generic [ref=e331]: Recurring
                            - checkbox "Recurring" [disabled] [ref=e332]
                          - generic [ref=e333]:
                            - generic [ref=e334]: Frequency
                            - textbox "Frequency" [disabled] [ref=e335]
                          - generic [ref=e336]:
                            - generic [ref=e337]: Estimated annual
                            - spinbutton "Estimated annual" [disabled] [ref=e338]
                          - generic [ref=e339]:
                            - generic [ref=e340]: Expense type
                            - textbox "Expense type" [disabled] [ref=e341]
                          - generic [ref=e342]:
                            - generic [ref=e343]: Category
                            - textbox "Category" [disabled] [ref=e344]
                        - paragraph [ref=e345]: Saving does not submit or approve a request.
                      - button "Discard local draft changes" [disabled] [ref=e347]
                - alert [ref=e348]:
                  - text: The response may have been lost after the command. Do not retry automatically; reconcile with the source.
                  - button "Refresh source" [ref=e349] [cursor=pointer]
  - generic:
    - region "Notifications alt+T"
```

# Test source

```ts
  35  |   const comparison = page.locator("section.sf-u12-comparison")
  36  |   await expect(comparison.getByRole("status", { name: "Comparison is limited: fewer than two proposals are eligible.", exact: true })).toBeVisible()
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
  58  |   await expect(frozen.getByRole("status", { name: "Comparison is limited: fewer than two proposals are eligible.", exact: true })).toBeVisible()
  59  |   const original = await setEurRate(page, account, "2")
  60  |   try {
  61  |     expect(original).toBe("1.08")
  62  |     await page.goto(`/orchestra/sf-procurement/requests/${encoded}/sourcing`)
  63  |     await expect(page.locator(".sf-u12-heading p").filter({ hasText: /^Stage:/ })).toHaveText("Stage: src_pending · Source version: " + pendingVersion)
  64  |     await expect(page.locator(`p[data-request-summary="${id}"]`)).toContainText("Sourcing approval")
  65  |     await expect(page.locator(`p[data-request-summary="${id}"]`)).toContainText("30240 USD")
  66  |     await expect(page.locator(`p[data-request-money="${id}"]`)).toHaveText("Current request value: 28000 EUR; base value: 30240 USD; FX: 1.08 (submitted).")
  67  |     await expect(page.getByRole("status", { name: "Estimate value: 28000 EUR; base value: 56000 USD; FX: 2 (current).", exact: true })).toBeVisible()
  68  |     await expect(page.getByRole("status", { name: "Order value 56000 USD; approved sourcing value 30240 USD. Review the difference.", exact: true })).toBeVisible()
  69  |     await expect(page.getByRole("status", { name: "Sourcing is not editable in the current request stage.", exact: true })).toBeVisible()
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
  83  | async function createRequest(page: Page, account: Account, title: string) {
  84  |   const form = page.locator('form[data-command="create"][data-page="Requests"]')
  85  |   await expect(form).toHaveCount(1)
  86  |   await form.getByRole("textbox", { name: "Title", exact: true }).fill(title)
  87  |   await form.getByRole("combobox", { name: "Type", exact: true }).selectOption("service")
  88  |   await form.getByRole("textbox", { name: "Description", exact: true }).fill("Isolated Operations sourcing scope")
  89  |   await form.getByRole("spinbutton", { name: "Estimated amount", exact: true }).fill("100")
  90  |   await form.getByRole("textbox", { name: "Cost center", exact: true }).fill("Synthetic IT")
  91  |   await form.getByLabel("Needed by", { exact: true }).fill("2026-12-01")
  92  |   await form.getByRole("textbox", { name: "Justification", exact: true }).fill("Operations fixture only")
  93  |   await confirmCommand(page, account, "create", undefined, form.getByRole("button", { name: "Create request", exact: true }), "Confirm action")
  94  |   const row = page.locator("tr[data-sf-row]").filter({ has: page.getByRole("cell", { name: title, exact: true }) })
  95  |   await expect(row).toHaveCount(1)
  96  |   const id = (await row.getAttribute("data-sf-row")) ?? ""
  97  |   expect(id).toMatch(/^PR-2026-\d+$/)
  98  |   return id
  99  | }
  100 | 
  101 | export async function approveRequest(page: Page, account: Account, id: string) {
  102 |   const encoded = encodeSfRouteRef(id)
  103 |   await page.goto(`/orchestra/sf-procurement/approvals/${encoded}`)
  104 |   await expect(page).toHaveURL((url) => url.origin === account.origin && url.pathname === `/orchestra/sf-procurement/approvals/${encoded}`)
  105 |   await page.getByRole("button", { name: "Review decision", exact: true }).click()
  106 |   const review = page.locator('[data-component="sf-change-review"]')
  107 |   await expect(review).toHaveCount(1)
  108 |   await page.getByRole("textbox", { name: "Approval comment (optional)", exact: true }).fill("Operations snapshot approval")
  109 |   const pending = commandResponse(page, account.origin, "approve", id)
  110 |   await review.getByRole("button", { name: "Approve PR", exact: true }).click()
  111 |   const response = await pending
  112 |   expect(response.status()).toBe(200)
  113 |   expect(await response.json()).toMatchObject({ ok: true })
  114 |   expect(response.request().postDataJSON()).toMatchObject({ page: "My approvals", action: "approve", id, values: { comment: "Operations snapshot approval" } })
  115 |   await expect(page.getByText("The producer acknowledged the command. No receipt was returned.", { exact: true })).toBeVisible()
  116 | }
  117 | 
  118 | export async function confirmCommand(page: Page, account: Account, action: string, id: string | undefined, openReview: Locator, confirmName: string) {
  119 |   await expect(openReview).toBeEnabled()
  120 |   await openReview.click()
  121 |   const review = page.locator('[data-component="sf-change-review"]')
  122 |   await expect(review).toHaveCount(1)
  123 |   const pending = commandResponse(page, account.origin, action, id)
  124 |   const confirm = review.getByRole("button", { name: confirmName, exact: true })
  125 |   await expect(confirm).toBeEnabled()
  126 |   await confirm.click()
  127 |   const response = await pending
  128 |   expect(response.status()).toBe(200)
  129 |   expect(await response.json()).toMatchObject({ ok: true })
  130 |   expect(response.request().postDataJSON()).toMatchObject({ page: "Requests", action, ...(id ? { id } : {}) })
  131 |   return response
  132 | }
  133 | 
  134 | function commandResponse(page: Page, origin: string, action: string, id?: string) {
> 135 |   return page.waitForResponse((response) => {
      |               ^ Error: page.waitForResponse: Test timeout of 60000ms exceeded.
  136 |     const request = response.request()
  137 |     const url = new URL(request.url())
  138 |     if (request.method() !== "POST" || url.origin !== origin || url.pathname !== "/sucafina/procurement") return false
  139 |     const body = request.postDataJSON() as { action?: string; id?: string }
  140 |     return body.action === action && (id === undefined || body.id === id)
  141 |   })
  142 | }
  143 | 
  144 | export async function fillEnabledScores(quote: Locator) {
  145 |   for (const name of ["Technical scores", "Commercial scores"]) {
  146 |     const section = quote.locator("section").filter({ has: quote.page().getByRole("heading", { name, exact: true }) })
  147 |     const scores = section.getByRole("spinbutton")
  148 |     const count = await scores.count()
  149 |     for (let index = 0; index < count; index++) {
  150 |       const input = scores.nth(index)
  151 |       if (await input.isEnabled()) await input.fill("4")
  152 |     }
  153 |   }
  154 | }
  155 | 
  156 | export async function setEurRate(page: Page, account: Account, value: string) {
  157 |   await page.goto("/orchestra/sf-procurement/settings")
  158 |   const settings = page.locator("form.sf-n21-settings-form")
  159 |   await expect(settings).toHaveCount(1)
  160 |   const code = settings.locator("#sf-u36-fx-code-1")
  161 |   const rate = settings.locator("#sf-u36-fx-rate-1")
  162 |   await expect(code).toHaveValue("EUR")
  163 |   const original = await rate.inputValue()
  164 |   const version = Number(await settings.getAttribute("data-version"))
  165 |   expect(Number.isSafeInteger(version)).toBe(true)
  166 |   await rate.fill(value)
  167 |   const pending = commandResponse(page, account.origin, "save")
  168 |   await settings.getByRole("button", { name: "Review changes", exact: true }).click()
  169 |   const review = page.locator('[data-component="sf-change-review"]')
  170 |   await expect(review).toHaveCount(1)
  171 |   await review.getByRole("button", { name: "Save", exact: true }).click()
  172 |   const response = await pending
  173 |   expect(response.status()).toBe(200)
  174 |   expect(response.request().postDataJSON()).toMatchObject({ page: "Settings", action: "save", version })

### packages/app-shell/e2e/test-results/sucafina-operations-CI-UI--baa3d-e-through-source-revocation-chromium/error-context.md

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
              - strong [ref=e231]: sf-wp04-browser-2KJi6f
              - generic "/tmp/sf-wp04-browser-2KJi6f" [ref=e232]: 8 agents
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
                  - generic [ref=e247]: ⁨sf-wp04-browser-2KJi6f⁩ · Suppliers
                  - heading "Suppliers" [level=1] [ref=e248]
                - button "New supplier" [disabled] [ref=e251]
              - generic [ref=e252]:
                - generic [ref=e255]:
                  - button "Export suppliers CSV" [disabled] [ref=e256]
                  - generic [ref=e257]: CSV export requires the producer-authorized download binding; no client-side export is substituted.
                - generic [ref=e259]:
                  - alert [ref=e260]: Command outcome is unknown. Do not resubmit; reconcile with the producer.
                  - paragraph [ref=e261]: Re-read the current record; a changed status alone does not prove which lost command executed.
                  - button "Refresh from source" [ref=e262] [cursor=pointer]
  - generic:
    - region "Notifications alt+T"
```

# Test source

```ts
  1   | import { createHash, randomUUID } from "node:crypto"
  2   | import { expect } from "@playwright/test"
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
> 14  |   return page.waitForResponse((response) => {
      |               ^ Error: page.waitForResponse: Test timeout of 60000ms exceeded.
  15  |     const request = response.request()
  16  |     const url = new URL(request.url())
  17  |     if (request.method() !== "POST" || url.origin !== account.origin || !url.pathname.endsWith("/procurement") || url.searchParams.get("page") !== "Suppliers") return false
  18  |     const body = request.postDataJSON() as { action?: string; id?: string }
  19  |     return body.action === action && (id === undefined || body.id === id)
  20  |   })
  21  | }
  22  | 
  23  | async function valueOf<T>(response: APIResponse | Response): Promise<T> {
  24  |   expect(response.status()).toBe(200)
  25  |   const body = await response.json() as { status: string; value: T }
  26  |   expect(body.status).toBe("ok")
  27  |   return body.value
  28  | }
  29  | 
  30  | /** PR34 15df31a: real private bytes, explicit schema and confirmation, then removal of the same source. */
  31  | export async function documentJourney(page: Page, info: TestInfo) {
  32  |   const account = await login(page, "first", "suppliers")
  33  |   const key = randomUUID(), name = "Operations document " + key, filename = key + ".txt"
  34  |   const text = "Price: 42\nReference: " + key + "\n"
  35  |   const bytes = Buffer.from(text, "utf8"), blobDigest = createHash("sha256").update(bytes).digest("hex")
  36  |   const endpoint = (mode: string, query: Record<string, string> = {}) => modeURL(account, "procurement", mode, query).href
  37  |   const isMode = (url: string, mode: string) => {
  38  |     const candidate = new URL(url)
  39  |     return candidate.origin === account.origin && candidate.pathname === new URL(account.baseURL).pathname + "/procurement" && candidate.searchParams.get("sf") === mode
  40  |   }
  41  |   const waiting = (mode: string, method = "GET") => page.waitForResponse((response) => isMode(response.url(), mode) && response.request().method() === method)
  42  |   expect((await page.goto("/orchestra/sf-procurement/suppliers"))?.status()).toBe(200)
  43  |   const suppliers = page.locator(".sf-u14-layout")
  44  |   await expect(suppliers).toHaveCount(1)
  45  |   await page.getByRole("button", { name: "New supplier", exact: true }).click()
  46  |   const editor = suppliers.locator(".sf-u14-editor")
  47  |   await expect(editor).toHaveCount(1)
  48  |   await expect(editor.getByRole("heading", { name: "Create supplier", exact: true })).toBeVisible()
  49  |   for (const [label, value] of [
  50  |     ["Legal name", name],
  51  |     ["Country", "France"],
  52  |     ["Address", "Isolated E2E supplier"],
  53  |     ["Tax ID", key],
  54  |     ["Contact email", "operations@example.invalid"],
  55  |     ["Payment terms", "Net 45"],
  56  |     ["Currency", "USD"],
  57  |     ["Risk rating", "Low"],
  58  |   ]) await editor.getByLabel(label!, { exact: true }).fill(value!)
  59  |   const openReview = editor.getByRole("button", { name: "Create supplier", exact: true })
  60  |   await expect(openReview).toBeEnabled()
  61  |   await openReview.click()
  62  |   const review = page.locator('[data-component="sf-change-review"]')
  63  |   await expect(review).toHaveCount(1)
  64  |   await expect(review.getByRole("heading", { name: "Review changes", exact: true })).toBeVisible()
  65  |   await expect(review).toContainText(name)
  66  |   const confirmCreate = review.getByRole("button", { name: "Confirm once", exact: true })
  67  |   await expect(confirmCreate).toBeEnabled()
  68  |   const creation = domainPost(page, account, "create")
  69  |   await confirmCreate.click()
  70  |   const created = await creation
  71  |   expect(created.status()).toBe(200)
  72  |   expect(await created.json()).toMatchObject({ ok: true })
  73  |   expect(created.request().postDataJSON()).toMatchObject({
  74  |     page: "Suppliers", action: "create", version: 0,
  75  |     values: { supplier: { legalName: name, country: "France", address: "Isolated E2E supplier", taxId: key, contactEmail: "operations@example.invalid", paymentTerms: "Net 45", currency: "USD", riskRating: "Low" } },
  76  |   })
  77  |   const suppliersURL = "/orchestra/sf-procurement/suppliers"
  78  |   expect((await page.goto(suppliersURL))?.status()).toBe(200)
  79  |   const supplierRow = page.locator("tr[data-sf-row]").filter({ has: page.getByRole("cell", { name, exact: true }) })
  80  |   await expect(supplierRow).toHaveCount(1)
  81  |   const supplierNumber = (await supplierRow.getByRole("cell").first().innerText()).trim()
  82  |   expect(supplierNumber).toMatch(/^SUP-\d+$/)
  83  |   const supplier = await supplierRow.getAttribute("data-sf-row")
  84  |   if (!supplier || !/^[a-zA-Z0-9_-]+$/.test(supplier)) throw new Error("The supplier chapter did not expose the created supplier identity")
  85  |   const supplierRoute = `/orchestra/sf-procurement/suppliers/${encodeSfRouteRef(supplier)}`
  86  |   expect((await page.goto(supplierRoute))?.status()).toBe(200)
  87  |   const supplierDetail = page.locator(`[data-sf-supplier-ref="${supplier}"]`)
  88  |   await expect(supplierDetail).toHaveCount(1)
  89  |   await expect(supplierDetail).toHaveAttribute("data-source-version", /^\d+$/)
  90  |   const beforeVersion = Number(await supplierDetail.getAttribute("data-source-version"))
  91  |   expect(Number.isSafeInteger(beforeVersion)).toBe(true)
  92  |   const upload = supplierDetail.locator(`.sf-bound-assets[data-sf-asset-record="${supplier}"]`)
  93  |   await expect(upload).toHaveCount(1)
  94  |   await upload.getByLabel("Attach a source document (server scan required)", { exact: true })
  95  |     .setInputFiles({ name: filename, mimeType: "text/plain", buffer: bytes })
  96  |   const uploaded = page.waitForResponse((response) => {
  97  |     const url = new URL(response.url())
  98  |     return url.origin === account.origin && url.pathname === new URL(account.baseURL).pathname + "/procurement" && url.searchParams.get("upload") === "supplier" && url.searchParams.get("record") === supplier && response.request().method() === "POST"
  99  |   })
  100 |   await upload.getByRole("button", { name: `Admit / scan / link (version ${beforeVersion})`, exact: true }).click()
  101 |   const uploadResponse = await uploaded
  102 |   if (uploadResponse.status() !== 200) {
  103 |     const responseBody = await uploadResponse.json().catch(() => null) as { errors?: unknown } | null
  104 |     const knownErrors = new Set([
  105 |       "Attachment limit is not configured.",
  106 |       "Attachment exceeds the configured limit.",
  107 |       "The scanner did not accept this file.",
  108 |       "The file was not accepted by the scanner.",
  109 |       "Unsupported file.",
  110 |     ])
  111 |     await observation(info, "operations-document-upload-blocked", {
  112 |       stage: "supplier-private-upload", httpStatus: uploadResponse.status(),
  113 |       producerErrors: Array.isArray(responseBody?.errors)
  114 |         ? responseBody.errors.filter((value): value is string => typeof value === "string" && knownErrors.has(value))
```

