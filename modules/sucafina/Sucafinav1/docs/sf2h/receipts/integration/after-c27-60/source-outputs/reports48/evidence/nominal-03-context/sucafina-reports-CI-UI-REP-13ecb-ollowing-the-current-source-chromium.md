# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sucafina/reports.spec.ts >> CI-UI-REPORTS · real preserved dossier >> RPT-01 preserves authorized sources, exports 25 real projects and reopens before following the current source
- Location: e2e/sucafina/reports.spec.ts:22:3

# Error details

```
Test timeout of 180000ms exceeded.
```

```
Error: locator.selectOption: Test timeout of 180000ms exceeded.
Call log:
  - waiting for locator('form.report-form').getByLabel('Format', { exact: true })

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - link "Skip to content" [ref=e2] [cursor=pointer]:
    - /url: "#content"
  - complementary [ref=e3]:
    - generic [ref=e4]:
      - strong [ref=e5]: Sucafina
      - generic [ref=e6]: CIO Dashboard
    - navigation "CIO Dashboard" [ref=e7]:
      - generic [ref=e8]: Overview
      - link "Executive Dashboard" [ref=e9] [cursor=pointer]:
        - /url: http://localhost:4110/sucafina/dashboard?page=Executive+Dashboard&year=2026
      - link "Hot Topics & Actions" [ref=e10] [cursor=pointer]:
        - /url: http://localhost:4110/sucafina/dashboard?page=Hot+Topics+%26+Actions&year=2026
      - generic [ref=e11]: Budget and people
      - link "Budget Overview" [ref=e12] [cursor=pointer]:
        - /url: http://localhost:4110/sucafina/dashboard?page=Budget+Overview&year=2026
      - link "OPEX Detail" [ref=e13] [cursor=pointer]:
        - /url: http://localhost:4110/sucafina/dashboard?page=OPEX+Detail&year=2026
      - link "CAPEX Projects" [ref=e14] [cursor=pointer]:
        - /url: http://localhost:4110/sucafina/dashboard?page=CAPEX+Projects&year=2026
      - link "Headcount Overview" [ref=e15] [cursor=pointer]:
        - /url: http://localhost:4110/sucafina/dashboard?page=Headcount+Overview&year=2026
      - link "Team Structure" [ref=e16] [cursor=pointer]:
        - /url: http://localhost:4110/sucafina/dashboard?page=Team+Structure&year=2026
      - link "Talent Review" [ref=e17] [cursor=pointer]:
        - /url: http://localhost:4110/sucafina/dashboard?page=Talent+Review&year=2026
      - generic [ref=e18]: Portfolio
      - link "Portfolio Dashboard" [ref=e19] [cursor=pointer]:
        - /url: http://localhost:4110/sucafina/dashboard?page=Portfolio+Dashboard&year=2026
      - link "All Projects" [ref=e20] [cursor=pointer]:
        - /url: http://localhost:4110/sucafina/dashboard?page=All+Projects&year=2026
      - generic [ref=e21]: Operations and governance
      - link "IT Operations" [ref=e22] [cursor=pointer]:
        - /url: http://localhost:4110/sucafina/dashboard?page=IT+Operations&year=2026
      - link "IT Security KPIs" [ref=e23] [cursor=pointer]:
        - /url: http://localhost:4110/sucafina/dashboard?page=IT+Security+KPIs&year=2026
      - link "IT Risks" [ref=e24] [cursor=pointer]:
        - /url: http://localhost:4110/sucafina/dashboard?page=IT+Risks&year=2026
      - link "Vendor Contracts" [ref=e25] [cursor=pointer]:
        - /url: http://localhost:4110/sucafina/dashboard?page=Vendor+Contracts&year=2026
      - link "Stakeholder Management" [ref=e26] [cursor=pointer]:
        - /url: http://localhost:4110/sucafina/dashboard?page=Stakeholder+Management&year=2026
      - link "IT Performance Contract" [ref=e27] [cursor=pointer]:
        - /url: http://localhost:4110/sucafina/dashboard?page=IT+Performance+Contract&year=2026
    - generic [ref=e28]:
      - text: FY
      - combobox "FY" [ref=e29]:
        - option "2024"
        - option "2025"
        - option "2026" [selected]
        - option "2027"
  - generic [ref=e30]:
    - status [ref=e31]: Homologação local · unknown · Microsoft 365 desativado neste perfil
    - banner [ref=e32]:
      - generic [ref=e33]: Sucafina workspace
      - navigation "Applications" [ref=e34]:
        - link "Dashboard" [ref=e35] [cursor=pointer]:
          - /url: ./dashboard
        - link "Budget Planner" [ref=e36] [cursor=pointer]:
          - /url: ./planner
        - link "Procurement" [ref=e37] [cursor=pointer]:
          - /url: ./procurement
      - generic [ref=e38]:
        - link "Imports" [ref=e39] [cursor=pointer]:
          - /url: "?sf=imports"
        - link "Documents" [ref=e40] [cursor=pointer]:
          - /url: "?sf=documents"
        - link "Workbench" [ref=e41] [cursor=pointer]:
          - /url: "?sf=workbench"
        - link "Business intelligence" [ref=e42] [cursor=pointer]:
          - /url: /sucafina/dashboard?sf=bi
        - link "Backups" [ref=e43] [cursor=pointer]:
          - /url: /sucafina/backups
        - group [ref=e44]:
          - generic "Notifications" [ref=e45] [cursor=pointer]: Notifications
        - button "Refresh data" [ref=e46] [cursor=pointer]
        - button "Sign out" [ref=e47] [cursor=pointer]
    - paragraph [ref=e48]: Period and version filters apply to this application only.
    - main [ref=e49]:
      - heading "Budget Overview" [level=1] [ref=e50]
      - generic [ref=e51]:
        - article [ref=e52]:
          - generic [ref=e53]: Budget — 12 months
          - strong [ref=e54]: $1200
        - article [ref=e55]:
          - generic [ref=e56]: Known actuals — 12 months
          - strong [ref=e57]: $1200
        - article [ref=e58]:
          - generic [ref=e59]: Known forecast — 12 months
          - strong [ref=e60]: $1320
      - table [ref=e62]:
        - rowgroup [ref=e63]:
          - row "12 months Budget Known actuals Known forecast Budget minus known forecast Known actuals / budget" [ref=e64]:
            - columnheader "12 months" [ref=e65]
            - columnheader "Budget" [ref=e66]
            - columnheader "Known actuals" [ref=e67]
            - columnheader "Known forecast" [ref=e68]
            - columnheader "Budget minus known forecast" [ref=e69]
            - columnheader "Known actuals / budget" [ref=e70]
        - rowgroup [ref=e71]:
          - row "OPEX $1200 $1200 $1320 $-120 100%" [ref=e72]:
            - cell "OPEX" [ref=e73]
            - cell "$1200" [ref=e74]
            - cell "$1200" [ref=e75]
            - cell "$1320" [ref=e76]
            - cell "$-120" [ref=e77]
            - cell "100%" [ref=e78]
          - row "CAPEX $0 $0 $0 $0 —" [ref=e79]:
            - cell "CAPEX" [ref=e80]
            - cell "$0" [ref=e81]
            - cell "$0" [ref=e82]
            - cell "$0" [ref=e83]
            - cell "$0" [ref=e84]
            - cell "—" [ref=e85]
      - paragraph [ref=e86]: Actual and forecast totals sum available entries; missing entries are not observed zero. The $ symbol is a legacy display convention; source currency is unspecified.
      - generic [ref=e87]:
        - article [ref=e88]:
          - generic [ref=e89]: Budget minus known forecast
          - strong [ref=e90]: $-120
        - article [ref=e91]:
          - generic [ref=e92]: Actuals / budget
          - strong [ref=e93]: 100%
      - generic [ref=e94]:
        - article [ref=e95]:
          - generic [ref=e96]: OPEX / revenue
          - strong [ref=e97]: —
        - article [ref=e98]:
          - generic [ref=e99]: CAPEX / revenue
          - strong [ref=e100]: —
        - article [ref=e101]:
          - generic [ref=e102]: Total / revenue
          - strong [ref=e103]: —
      - generic [ref=e104]:
        - text: Actuals / budget
        - progressbar "Actuals / budget" [ref=e105]
      - figure "Effective budget, including monthly overrides" [ref=e106]:
        - img "Effective monthly budget" [ref=e107]:
          - 'generic "Month 1: $100" [ref=e108]'
          - generic [ref=e109]: "1"
          - 'generic "Month 2: $100" [ref=e110]'
          - generic [ref=e111]: "2"
          - 'generic "Month 3: $100" [ref=e112]'
          - generic [ref=e113]: "3"
          - 'generic "Month 4: $100" [ref=e114]'
          - generic [ref=e115]: "4"
          - 'generic "Month 5: $100" [ref=e116]'
          - generic [ref=e117]: "5"
          - 'generic "Month 6: $100" [ref=e118]'
          - generic [ref=e119]: "6"
          - 'generic "Month 7: $100" [ref=e120]'
          - generic [ref=e121]: "7"
          - 'generic "Month 8: $100" [ref=e122]'
          - generic [ref=e123]: "8"
          - 'generic "Month 9: $100" [ref=e124]'
          - generic [ref=e125]: "9"
          - 'generic "Month 10: $100" [ref=e126]'
          - generic [ref=e127]: "10"
          - 'generic "Month 11: $100" [ref=e128]'
          - generic [ref=e129]: "11"
          - 'generic "Month 12: $100" [ref=e130]'
          - generic [ref=e131]: "12"
        - generic [ref=e132]: Effective budget, including monthly overrides
      - table [ref=e134]:
        - rowgroup [ref=e135]:
          - row "Month Effective budget Flat reference (annual allocations / 12)" [ref=e136]:
            - columnheader "Month" [ref=e137]
            - columnheader "Effective budget" [ref=e138]
            - columnheader "Flat reference (annual allocations / 12)" [ref=e139]
        - rowgroup [ref=e140]:
          - row "1 $100 $100" [ref=e141]:
            - cell "1" [ref=e142]
            - cell "$100" [ref=e143]
            - cell "$100" [ref=e144]
          - row "2 $100 $100" [ref=e145]:
            - cell "2" [ref=e146]
            - cell "$100" [ref=e147]
            - cell "$100" [ref=e148]
          - row "3 $100 $100" [ref=e149]:
            - cell "3" [ref=e150]
            - cell "$100" [ref=e151]
            - cell "$100" [ref=e152]
          - row "4 $100 $100" [ref=e153]:
            - cell "4" [ref=e154]
            - cell "$100" [ref=e155]
            - cell "$100" [ref=e156]
          - row "5 $100 $100" [ref=e157]:
            - cell "5" [ref=e158]
            - cell "$100" [ref=e159]
            - cell "$100" [ref=e160]
          - row "6 $100 $100" [ref=e161]:
            - cell "6" [ref=e162]
            - cell "$100" [ref=e163]
            - cell "$100" [ref=e164]
          - row "7 $100 $100" [ref=e165]:
            - cell "7" [ref=e166]
            - cell "$100" [ref=e167]
            - cell "$100" [ref=e168]
          - row "8 $100 $100" [ref=e169]:
            - cell "8" [ref=e170]
            - cell "$100" [ref=e171]
            - cell "$100" [ref=e172]
          - row "9 $100 $100" [ref=e173]:
            - cell "9" [ref=e174]
            - cell "$100" [ref=e175]
            - cell "$100" [ref=e176]
          - row "10 $100 $100" [ref=e177]:
            - cell "10" [ref=e178]
            - cell "$100" [ref=e179]
            - cell "$100" [ref=e180]
          - row "11 $100 $100" [ref=e181]:
            - cell "11" [ref=e182]
            - cell "$100" [ref=e183]
            - cell "$100" [ref=e184]
          - row "12 $100 $100" [ref=e185]:
            - cell "12" [ref=e186]
            - cell "$100" [ref=e187]
            - cell "$100" [ref=e188]
      - group [ref=e189]:
        - generic "Save" [ref=e190] [cursor=pointer]
      - group [ref=e191]:
        - generic "Save" [ref=e192] [cursor=pointer]
      - group [ref=e193]:
        - generic "Access and configuration" [ref=e194] [cursor=pointer]
      - generic [ref=e195]:
        - heading "Find a record" [level=2] [ref=e196]
        - paragraph [ref=e197]: Search the records available in an application. Results keep the page, period and version used for the search.
        - generic [ref=e198]:
          - generic [ref=e199]:
            - text: Application
            - combobox "Application" [ref=e200]:
              - option "Dashboard" [selected]
              - option "Budget Planner"
              - option "Procurement"
          - generic [ref=e201]:
            - text: Record name or value
            - searchbox "Record name or value" [ref=e202]
          - button "Find records" [ref=e203] [cursor=pointer]
        - status
        - list
      - generic [ref=e204]:
        - heading "Saved views" [level=2] [ref=e205]
        - status [ref=e206]: Saved views are unavailable. Refresh saved views to try again.
        - list
        - button "Refresh saved views" [ref=e207] [cursor=pointer]
        - generic [ref=e208]:
          - text: Display density
          - combobox "Display density" [ref=e209]:
            - option "Comfortable" [selected]
            - option "Compact"
        - generic [ref=e210]:
          - generic [ref=e211]:
            - text: View name
            - textbox "View name" [ref=e212]
          - button "Save this page and filters" [ref=e213] [cursor=pointer]
        - button "Use this page as my starting page" [ref=e214] [cursor=pointer]
      - group [ref=e215]:
        - generic "Extract document evidence" [ref=e216] [cursor=pointer]
        - option "Choose a document" [selected]
        - option "Text" [selected]
        - option "Number"
        - option "Yes or no"
        - option "Date"
        - option "Choose a schema" [selected]
      - group [ref=e217]:
        - generic "Import with preview" [ref=e218] [cursor=pointer]
        - option "Choose a destination" [selected]
      - group [ref=e219]:
        - generic "Revisão e ações" [ref=e220] [cursor=pointer]
        - option "Selecione um registro" [selected]
        - option "Selecione um item do histórico" [selected]
        - option "Selecione um caso" [selected]
        - option "Selecione novo ou existente" [selected]
        - option "Selecione um Hot Topic" [selected]
        - option "Normal" [selected]
        - option "Alta"
        - option "Crítica"
        - option "Selecione uma escolha" [selected]
        - option "Selecione uma alteração" [selected]
      - navigation "Business analysis" [ref=e221]:
        - link "Business intelligence" [ref=e222] [cursor=pointer]:
          - /url: "?sf=bi&page=Budget+Overview&start=2026-01-01&end=2026-12-31"
        - link "Prepare review and reports" [ref=e223] [cursor=pointer]:
          - /url: "?sf=review&page=Budget+Overview&start=2026-01-01&end=2026-12-31"
      - navigation "Controles de decisão" [ref=e224]:
        - link "Controles da decisão" [ref=e225] [cursor=pointer]:
          - /url: "?sf=decision-controls"
    - complementary [ref=e226]:
      - group [ref=e227]:
        - generic "Reports and backup" [active] [ref=e228] [cursor=pointer]
        - generic [ref=e229]:
          - generic [ref=e230]:
            - text: Format
            - combobox "Format" [ref=e231]:
              - option "PowerPoint" [selected]
              - option "Word"
          - generic [ref=e232]:
            - text: Year
            - combobox "Year" [ref=e233]:
              - option "2024"
              - option "2025"
              - option "2026" [selected]
              - option "2027"
          - generic [ref=e234]:
            - text: Title
            - textbox "Title" [ref=e235]
          - group "Topics" [ref=e236]:
            - generic [ref=e237]: Topics
            - generic [ref=e238]:
              - checkbox "Executive Dashboard" [checked] [ref=e239]
              - text: Executive Dashboard
            - generic [ref=e240]:
              - checkbox "Hot Topics & Actions" [ref=e241]
              - text: Hot Topics & Actions
            - generic [ref=e242]:
              - checkbox "Budget Overview" [ref=e243]
              - text: Budget Overview
            - generic [ref=e244]:
              - checkbox "OPEX Detail" [ref=e245]
              - text: OPEX Detail
            - generic [ref=e246]:
              - checkbox "CAPEX Projects" [ref=e247]
              - text: CAPEX Projects
            - generic [ref=e248]:
              - checkbox "Headcount Overview" [ref=e249]
              - text: Headcount Overview
            - generic [ref=e250]:
              - checkbox "Team Structure" [ref=e251]
              - text: Team Structure
            - generic [ref=e252]:
              - checkbox "Talent Review" [ref=e253]
              - text: Talent Review
            - generic [ref=e254]:
              - checkbox "Portfolio Dashboard" [ref=e255]
              - text: Portfolio Dashboard
            - generic [ref=e256]:
              - checkbox "All Projects" [ref=e257]
              - text: All Projects
            - generic [ref=e258]:
              - checkbox "IT Operations" [ref=e259]
              - text: IT Operations
            - generic [ref=e260]:
              - checkbox "IT Security KPIs" [ref=e261]
              - text: IT Security KPIs
            - generic [ref=e262]:
              - checkbox "IT Risks" [ref=e263]
              - text: IT Risks
            - generic [ref=e264]:
              - checkbox "Vendor Contracts" [ref=e265]
              - text: Vendor Contracts
            - generic [ref=e266]:
              - checkbox "Stakeholder Management" [ref=e267]
              - text: Stakeholder Management
            - generic [ref=e268]:
              - checkbox "IT Performance Contract" [ref=e269]
              - text: IT Performance Contract
          - button "Generate Report" [ref=e270] [cursor=pointer]
        - link "Export JSON" [ref=e271] [cursor=pointer]:
          - /url: "?download=json"
        - generic [ref=e272]:
          - generic [ref=e273]:
            - text: Import JSON
            - button "Import JSON" [ref=e274]
          - button "Import JSON" [ref=e275] [cursor=pointer]
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
> 18  |   await form.getByLabel("Format", { exact: true }).selectOption("docx")
      |                                                    ^ Error: locator.selectOption: Test timeout of 180000ms exceeded.
  19  |   await form.getByLabel("Year", { exact: true }).selectOption(String(corpus.year))
  20  |   await form.getByLabel("Title", { exact: true }).fill("Isolated Reports preserved dossier")
  21  |   for (const checkbox of await form.getByRole("checkbox").all()) await checkbox.uncheck()
  22  |   for (const title of ["Budget Overview", "Portfolio Dashboard", "Hot Topics & Actions"])
  23  |     await form.getByRole("checkbox", { name: title, exact: true }).check()
  24  |   await form.getByRole("button", { name: "Generate Report", exact: true }).click()
  25  | 
  26  |   // C6 mounts the delivered preparation view from the existing Reports entry.
  27  |   // This journey uses that installed composition and its preserved selection.
  28  |   const preparation = page.getByRole("region", { name: "Prepare review", exact: true })
  29  |   await expect(preparation, "Generate Report opens the installed ReviewPreparationView").toBeVisible()
  30  |   const load = preparation.getByRole("button", { name: "Load selection", exact: true })
  31  |   await expect(load).toBeEnabled()
  32  |   const pendingAgenda = page.waitForResponse(responseFor(app.dashboardURL, "review-agenda", "POST"))
  33  |   await load.click()
  34  |   const selected = await agendaResult(await pendingAgenda)
  35  |   expect(selected.sections.map((section) => section.title).sort()).toEqual(["Budget", "Hot Topics", "Projects"])
  36  |   const projects = selected.sections.filter((section) => section.title === "Projects")
  37  |   expect(projects).toHaveLength(1)
  38  |   expect(projects[0]!.recordCount).toBe(25)
  39  |   expect(selected.sections.filter((section) => section.title === "Hot Topics").map((section) => section.recordCount)).toEqual([0])
  40  |   expect(selected.sections.flatMap((section) => section.projection.values)
  41  |     .filter((value) => value.id === corpus.forecastField)).toMatchObject([{ value: corpus.before, period: corpus.annual, currency: "unspecified" }])
  42  |   expect(selected.sections.flatMap((section) => section.projection.values)
  43  |     .filter((value) => value.id === `budget:${corpus.year}-01:forecast`)).toMatchObject([{ value: 110, period: corpus.january, currency: "unspecified" }])
  44  |   const projectNames = projects[0]!.projection.values.filter((value) => /^projects\[id:reports-project-\d{2}\]\.name$/.test(value.id))
  45  |   expect(projectNames.map((value) => value.value)).toEqual(corpus.projects.map((project) => project.name))
  46  |   projectNames.forEach((value) => expect(value.period).toEqual({ start: corpus.today, end: corpus.today }))
  47  |   await expect(preparation.getByRole("status")).toHaveText("Review the selection, order and periods, then explicitly preserve it.")
  48  |   await expect(preparation.getByRole("table", { name: "Budget · selected source values", exact: true })
  49  |     .getByRole("row").filter({ has: page.getByRole("cell", { name: corpus.forecastField, exact: true }) }).getByRole("cell"))
  50  |     .toHaveText([corpus.forecastField, `${corpus.before} unspecified`, `${corpus.annual.start} – ${corpus.annual.end}`])
  51  |   const retained = options.removeOne ? await removeOneProject(page, app, selected) : selected
  52  |   const order = ["Projects", "Budget", "Hot Topics"]
  53  |   for (const [index, title] of order.entries()) {
  54  |     const shown = await preparation.getByRole("heading", { level: 3 }).allTextContents()
  55  |     const moves = shown.indexOf(title) - index
  56  |     expect(moves).toBeGreaterThanOrEqual(0)
  57  |     for (const _move of Array.from({ length: moves }))
  58  |       await preparation.getByRole("button", { name: `Move ${title} up`, exact: true }).click()
  59  |   }
  60  |   await expect(preparation.getByRole("heading", { level: 3 })).toHaveText(order)
  61  |   const pendingPreserve = page.waitForResponse(responseFor(app.dashboardURL, "review-preserve", "POST"))
  62  |   await preparation.getByRole("button", { name: "Preserve this review", exact: true }).click()
  63  |   const response = await pendingPreserve
  64  |   expect(response.status()).toBe(200)
  65  |   const body = object(await response.json())
  66  |   expect(body.status).toBe("ok")
  67  |   const saved = review(body.value)
  68  |   expect(saved.sections.map((section) => section.title)).toEqual(order)
  69  |   expect(saved.sections.map((section) => section.id)).toEqual(order.map((title) => retained.sections.find((section) => section.title === title)!.id))
  70  |   expect(saved.sections.map((section) => section.count)).toEqual(order.map((title) => retained.sections.find((section) => section.title === title)!.recordCount))
  71  |   expect(saved.sections[0]!.count).toBe(options.removeOne ? 24 : 25)
  72  |   expect(projection(saved.sections[0]!.content).values).toEqual(retained.sections.find((section) => section.title === "Projects")!.projection.values)
  73  |   await expect(preparation.getByRole("status")).toHaveText("Review preserved. Source updates will not replace this meeting's captured values.")
  74  |   expect(await readReview(page.request, app.dashboardURL, saved.id)).toEqual(saved)
  75  |   await info.attach("preserved-selection", { body: JSON.stringify({ selectionRef: retained.selectionRef, selectedRecords: retained.sectionRecordRefs, saved }, null, 2), contentType: "application/json" })
  76  |   return { preparation, saved }
  77  | }
  78  | 
  79  | async function removeOneProject(page: Page, app: ReportsInstallation, selected: ReviewAgendaPreview) {
  80  |   const section = selected.sections.filter((entry) => entry.title === "Projects")
  81  |   expect(section).toHaveLength(1)
  82  |   const choices = selected.sectionRecordRefs.filter((entry) => entry.sectionRef === section[0]!.id)
  83  |   expect(choices).toHaveLength(1)
  84  |   expect(choices[0]!.recordRefs).toHaveLength(25)
  85  |   expect(new Set(choices[0]!.recordRefs).size).toBe(25)
  86  |   // The opaque identity comes from the actual authorized selector. Do not invent
  87  |   // a ref encoding or pretend the page-level evidence identifies one project.
  88  |   const reference = choices[0]!.recordRefs[0]!
  89  |   const preparation = page.getByRole("region", { name: "Prepare review", exact: true })
  90  |   const pending = page.waitForResponse(responseFor(app.dashboardURL, "review-agenda", "POST"))
  91  |   await preparation.getByRole("button", { name: `Remove record ${reference}`, exact: true }).click()
  92  |   const retained = await agendaResult(await pending)
  93  |   expect(retained.sectionRecordRefs.filter((entry) => entry.sectionRef === section[0]!.id)).toEqual([
  94  |     { sectionRef: section[0]!.id, recordRefs: choices[0]!.recordRefs.filter((entry) => entry !== reference) },
  95  |   ])
  96  |   const after = retained.sections.filter((entry) => entry.id === section[0]!.id)
  97  |   expect(after).toHaveLength(1)
  98  |   expect(after[0]!.recordCount).toBe(24)
  99  |   const beforeIds = section[0]!.projection.values.filter((value) => /^projects\[id:[^\]]+\]\.id$/.test(value.id))
  100 |   const afterIds = after[0]!.projection.values.filter((value) => /^projects\[id:[^\]]+\]\.id$/.test(value.id))
  101 |   expect(beforeIds).toHaveLength(25)
  102 |   expect(afterIds).toHaveLength(24)
  103 |   const removed = beforeIds.filter((value) => !afterIds.some((current) => current.id === value.id))
  104 |   expect(removed).toHaveLength(1)
  105 |   const prefix = removed[0]!.id.slice(0, -2)
  106 |   expect(after[0]!.projection.values.map((value) => ({ id: value.id, value: value.value, period: value.period }))).toEqual(
  107 |     section[0]!.projection.values.filter((value) => !value.id.startsWith(prefix))
  108 |       .map((value) => ({ id: value.id, value: value.value, period: value.period })),
  109 |   )
  110 |   await expect(preparation.getByRole("status")).toHaveText("Selection refreshed from the authorized sources. Check the new counts and values before preserving.")
  111 |   return retained
  112 | }
  113 | 
  114 | export async function readSourceData(request: APIRequestContext, app: ReportsInstallation) {
  115 |   const response = await request.get(`${app.dashboardURL}?download=json`, { maxRedirects: 0 })
  116 |   expect(response.status()).toBe(200)
  117 |   expect(response.headers()["content-type"]).toContain("application/json")
  118 |   const data = object(await response.json())
```