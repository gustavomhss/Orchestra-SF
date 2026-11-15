# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sucafina/reports.spec.ts >> CI-UI-REPORTS · real preserved dossier >> RPT-03 removes one authorized record without editing its source and creates only an explicit new revision
- Location: e2e/sucafina/reports.spec.ts:101:3

# Error details

```
Test timeout of 180000ms exceeded.
```

```
Error: page.waitForResponse: Test timeout of 180000ms exceeded.
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "Skip to content" [ref=e2] [cursor=pointer]:
    - /url: "#content"
  - complementary [ref=e3]:
    - generic [ref=e4]:
      - strong [ref=e5]: Sucafina
      - generic [ref=e6]: Review and reports
    - navigation "Review and reports" [ref=e7]:
      - link "Dashboard" [ref=e8] [cursor=pointer]:
        - /url: /sucafina/dashboard
  - generic [ref=e9]:
    - banner [ref=e10]:
      - generic [ref=e11]: Sucafina workspace
      - navigation "Applications" [ref=e12]:
        - link "Dashboard" [ref=e13] [cursor=pointer]:
          - /url: ./dashboard
        - link "Budget Planner" [ref=e14] [cursor=pointer]:
          - /url: ./planner
        - link "Procurement" [ref=e15] [cursor=pointer]:
          - /url: ./procurement
      - generic [ref=e16]:
        - button "Refresh data" [ref=e17] [cursor=pointer]
        - button "Sign out" [ref=e18] [cursor=pointer]
    - paragraph [ref=e19]: Period and version filters apply to this application only.
    - main [ref=e20]:
      - heading "Review and reports" [level=1] [ref=e21]
      - region "Prepare review" [ref=e23]:
        - heading "Prepare review" [level=2] [ref=e24]
        - status [ref=e25]: "Selection unavailable: agenda-unavailable. Captured content is hidden until access is checked again."
        - button "Load selection" [ref=e26] [cursor=pointer]
```

# Test source

```ts
  1   | import { expect } from "@playwright/test"
  2   | import type { APIRequestContext, Page, TestInfo } from "@playwright/test"
  3   | import type { PreservedReview } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
  4   | import type { ReviewAgendaPreview } from "../../../../../modules/sucafina/Sucafinav1/product/reviews/selection.ts"
  5   | import type { ReportsInstallation } from "./production-installation.ts"
  6   | import type { ReportsCorpus } from "./corpus.ts"
  7   | import { agendaResult, object, projection, readReview, responseFor, review, text } from "./model.ts"
  8   | import { inspectReport } from "./ooxml.ts"
  9   | 
  10  | export async function prepareReview(page: Page, app: ReportsInstallation, corpus: ReportsCorpus, info: TestInfo, options: { removeOne?: boolean } = {}) {
  11  |   await page.goto(app.workbenchURL)
  12  |   await expect(page.locator("#content").getByRole("heading", { name: "Decisions", exact: true }),
  13  |     "The real installation must enter Workbench before Reports").toBeVisible()
  14  |   await page.goto(`${app.dashboardURL}?page=Budget%20Overview&year=${corpus.year}`)
  15  |   await page.getByText("Reports and backup", { exact: true }).click()
  16  |   const form = page.locator("form.report-form")
  17  |   await expect(form).toHaveCount(1)
  18  |   // These labels wrap their selects and option text. Use the exact accessible
  19  |   // combobox names exposed by the installed Reports form.
  20  |   const format = form.getByRole("combobox", { name: "Format", exact: true })
  21  |   const year = form.getByRole("combobox", { name: "Year", exact: true })
  22  |   await expect(format).toBeEnabled()
  23  |   await format.selectOption("docx")
  24  |   await expect(format).toHaveValue("docx")
  25  |   await expect(year).toBeEnabled()
  26  |   await year.selectOption(String(corpus.year))
  27  |   await expect(year).toHaveValue(String(corpus.year))
  28  |   await form.getByLabel("Title", { exact: true }).fill("Isolated Reports preserved dossier")
  29  |   for (const checkbox of await form.getByRole("checkbox").all()) await checkbox.uncheck()
  30  |   for (const title of ["Budget Overview", "Portfolio Dashboard", "Hot Topics & Actions"])
  31  |     await form.getByRole("checkbox", { name: title, exact: true }).check()
  32  |   await form.getByRole("button", { name: "Generate Report", exact: true }).click()
  33  | 
  34  |   // C6 mounts the delivered preparation view from the existing Reports entry.
  35  |   // This journey uses that installed composition and its preserved selection.
  36  |   const preparation = page.getByRole("region", { name: "Prepare review", exact: true })
  37  |   await expect(preparation, "Generate Report opens the installed ReviewPreparationView").toBeVisible()
  38  |   const load = preparation.getByRole("button", { name: "Load selection", exact: true })
  39  |   await expect(load).toBeEnabled()
> 40  |   const pendingAgenda = page.waitForResponse(responseFor(app.dashboardURL, "review-agenda", "POST"))
      |                              ^ Error: page.waitForResponse: Test timeout of 180000ms exceeded.
  41  |   await load.click()
  42  |   const selected = await agendaResult(await pendingAgenda)
  43  |   expect(selected.sections.map((section) => section.title).sort()).toEqual(["Budget", "Hot Topics", "Projects"])
  44  |   const projects = selected.sections.filter((section) => section.title === "Projects")
  45  |   expect(projects).toHaveLength(1)
  46  |   expect(projects[0]!.recordCount).toBe(25)
  47  |   expect(selected.sections.filter((section) => section.title === "Hot Topics").map((section) => section.recordCount)).toEqual([0])
  48  |   expect(selected.sections.flatMap((section) => section.projection.values)
  49  |     .filter((value) => value.id === corpus.forecastField)).toMatchObject([{ value: corpus.before, period: corpus.annual, currency: "unspecified" }])
  50  |   expect(selected.sections.flatMap((section) => section.projection.values)
  51  |     .filter((value) => value.id === `budget:${corpus.year}-01:forecast`)).toMatchObject([{ value: 110, period: corpus.january, currency: "unspecified" }])
  52  |   const projectNames = projects[0]!.projection.values.filter((value) => /^projects\[id:reports-project-\d{2}\]\.name$/.test(value.id))
  53  |   expect(projectNames.map((value) => value.value)).toEqual(corpus.projects.map((project) => project.name))
  54  |   projectNames.forEach((value) => expect(value.period).toEqual({ start: corpus.today, end: corpus.today }))
  55  |   await expect(preparation.getByRole("status")).toHaveText("Review the selection, order and periods, then explicitly preserve it.")
  56  |   await expect(preparation.getByRole("table", { name: "Budget · selected source values", exact: true })
  57  |     .getByRole("row").filter({ has: page.getByRole("cell", { name: corpus.forecastField, exact: true }) }).getByRole("cell"))
  58  |     .toHaveText([corpus.forecastField, `${corpus.before} unspecified`, `${corpus.annual.start} – ${corpus.annual.end}`])
  59  |   const retained = options.removeOne ? await removeOneProject(page, app, selected) : selected
  60  |   const order = ["Projects", "Budget", "Hot Topics"]
  61  |   for (const [index, title] of order.entries()) {
  62  |     const shown = await preparation.getByRole("heading", { level: 3 }).allTextContents()
  63  |     const moves = shown.indexOf(title) - index
  64  |     expect(moves).toBeGreaterThanOrEqual(0)
  65  |     for (const _move of Array.from({ length: moves }))
  66  |       await preparation.getByRole("button", { name: `Move ${title} up`, exact: true }).click()
  67  |   }
  68  |   await expect(preparation.getByRole("heading", { level: 3 })).toHaveText(order)
  69  |   const pendingPreserve = page.waitForResponse(responseFor(app.dashboardURL, "review-preserve", "POST"))
  70  |   await preparation.getByRole("button", { name: "Preserve this review", exact: true }).click()
  71  |   const response = await pendingPreserve
  72  |   expect(response.status()).toBe(200)
  73  |   const body = object(await response.json())
  74  |   expect(body.status).toBe("ok")
  75  |   const saved = review(body.value)
  76  |   expect(saved.sections.map((section) => section.title)).toEqual(order)
  77  |   expect(saved.sections.map((section) => section.id)).toEqual(order.map((title) => retained.sections.find((section) => section.title === title)!.id))
  78  |   expect(saved.sections.map((section) => section.count)).toEqual(order.map((title) => retained.sections.find((section) => section.title === title)!.recordCount))
  79  |   expect(saved.sections[0]!.count).toBe(options.removeOne ? 24 : 25)
  80  |   expect(projection(saved.sections[0]!.content).values).toEqual(retained.sections.find((section) => section.title === "Projects")!.projection.values)
  81  |   await expect(preparation.getByRole("status")).toHaveText("Review preserved. Source updates will not replace this meeting's captured values.")
  82  |   expect(await readReview(page.request, app.dashboardURL, saved.id)).toEqual(saved)
  83  |   await info.attach("preserved-selection", { body: JSON.stringify({ selectionRef: retained.selectionRef, selectedRecords: retained.sectionRecordRefs, saved }, null, 2), contentType: "application/json" })
  84  |   return { preparation, saved }
  85  | }
  86  | 
  87  | async function removeOneProject(page: Page, app: ReportsInstallation, selected: ReviewAgendaPreview) {
  88  |   const section = selected.sections.filter((entry) => entry.title === "Projects")
  89  |   expect(section).toHaveLength(1)
  90  |   const choices = selected.sectionRecordRefs.filter((entry) => entry.sectionRef === section[0]!.id)
  91  |   expect(choices).toHaveLength(1)
  92  |   expect(choices[0]!.recordRefs).toHaveLength(25)
  93  |   expect(new Set(choices[0]!.recordRefs).size).toBe(25)
  94  |   // The opaque identity comes from the actual authorized selector. Do not invent
  95  |   // a ref encoding or pretend the page-level evidence identifies one project.
  96  |   const reference = choices[0]!.recordRefs[0]!
  97  |   const preparation = page.getByRole("region", { name: "Prepare review", exact: true })
  98  |   const pending = page.waitForResponse(responseFor(app.dashboardURL, "review-agenda", "POST"))
  99  |   await preparation.getByRole("button", { name: `Remove record ${reference}`, exact: true }).click()
  100 |   const retained = await agendaResult(await pending)
  101 |   expect(retained.sectionRecordRefs.filter((entry) => entry.sectionRef === section[0]!.id)).toEqual([
  102 |     { sectionRef: section[0]!.id, recordRefs: choices[0]!.recordRefs.filter((entry) => entry !== reference) },
  103 |   ])
  104 |   const after = retained.sections.filter((entry) => entry.id === section[0]!.id)
  105 |   expect(after).toHaveLength(1)
  106 |   expect(after[0]!.recordCount).toBe(24)
  107 |   const beforeIds = section[0]!.projection.values.filter((value) => /^projects\[id:[^\]]+\]\.id$/.test(value.id))
  108 |   const afterIds = after[0]!.projection.values.filter((value) => /^projects\[id:[^\]]+\]\.id$/.test(value.id))
  109 |   expect(beforeIds).toHaveLength(25)
  110 |   expect(afterIds).toHaveLength(24)
  111 |   const removed = beforeIds.filter((value) => !afterIds.some((current) => current.id === value.id))
  112 |   expect(removed).toHaveLength(1)
  113 |   const prefix = removed[0]!.id.slice(0, -2)
  114 |   expect(after[0]!.projection.values.map((value) => ({ id: value.id, value: value.value, period: value.period }))).toEqual(
  115 |     section[0]!.projection.values.filter((value) => !value.id.startsWith(prefix))
  116 |       .map((value) => ({ id: value.id, value: value.value, period: value.period })),
  117 |   )
  118 |   await expect(preparation.getByRole("status")).toHaveText("Selection refreshed from the authorized sources. Check the new counts and values before preserving.")
  119 |   return retained
  120 | }
  121 | 
  122 | export async function readSourceData(request: APIRequestContext, app: ReportsInstallation) {
  123 |   const response = await request.get(`${app.dashboardURL}?download=json`, { maxRedirects: 0 })
  124 |   expect(response.status()).toBe(200)
  125 |   expect(response.headers()["content-type"]).toContain("application/json")
  126 |   const data = object(await response.json())
  127 |   return { projects: data.projects, opexOwners: data.opexOwners, opexEntries: data.opexEntries, hotTopics: data.hotTopics }
  128 | }
  129 | 
  130 | export async function preserveNewRevision(page: Page, app: ReportsInstallation, prior: PreservedReview, corpus: ReportsCorpus) {
  131 |   const preparation = page.getByRole("region", { name: "Prepare review", exact: true })
  132 |   const load = page.waitForResponse(responseFor(app.dashboardURL, "review-agenda", "POST"))
  133 |   await preparation.getByRole("button", { name: "Prepare current data as a new revision", exact: true }).click()
  134 |   const selected = await agendaResult(await load)
  135 |   expect(selected.sections.flatMap((section) => section.projection.values).filter((value) => value.id === corpus.forecastField))
  136 |     .toMatchObject([{ value: corpus.after, period: corpus.annual }])
  137 |   expect(selected.sections.filter((section) => section.title === "Projects").map((section) => section.recordCount)).toEqual([24])
  138 |   const preserve = page.waitForResponse(responseFor(app.dashboardURL, "review-preserve", "POST"))
  139 |   await preparation.getByRole("button", { name: "Preserve this review", exact: true }).click()
  140 |   const response = await preserve
```