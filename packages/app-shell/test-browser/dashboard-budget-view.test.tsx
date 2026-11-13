import { afterEach, expect, test } from "bun:test"
import type { Sucafina } from "@orchestra/schema/sucafina"
import { createComponent, createSignal } from "solid-js"
import { render } from "solid-js/web"
import { DashboardBudget } from "../../../modules/sucafina/Sucafinav1/runtime/dashboard-budget.ts"
import type { Actor, Environment, Snapshot } from "../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { NativeViewProps } from "../src/orchestra/chapters/sucafina/view-contract"
import { createLocalePlatform } from "./native-locale-fixture"

const { solidDom } = await import("./solid-dom")
const { PlatformProvider }: typeof import("@/context/platform") = await import(solidDom("@/context/platform", import.meta.dir))
const { LanguageProvider, loadLocaleDict, useLanguage }: typeof import("@/context/language") = await import(solidDom("@/context/language", import.meta.dir))
const { DashboardBudgetView }: typeof import("../src/orchestra/chapters/sucafina/dashboard-budget-view") = await import(
  solidDom("../src/orchestra/chapters/sucafina/dashboard-budget-view", import.meta.dir)
)
const { SF_NATIVE_DASHBOARD_BUDGET_COPY, SF_NATIVE_DASHBOARD_BUDGET_COPY_BR } = await import(
  "../src/i18n/orchestra-chapters/sucafina-native-dashboard-budget"
)

const budgetPages = ["Executive Dashboard", "Budget Overview", "OPEX Detail", "CAPEX Projects"]
const reader: Actor = { id: "budget-reader", name: "Budget Reader", canWrite: false, roles: ["domain leader"], assigned: [], domains: [] }
const deniedActor: Actor = { id: "no-budget-access", name: "No Budget Access", canWrite: false, roles: [], assigned: [], domains: [] }
const environment: Environment = {
  at: "2026-11-13T12:00:00Z",
  id: () => "unused",
  directory: [{ id: "budget-reader", name: "Budget Reader" }],
}
const cleanup: (() => void)[] = []
afterEach(() => cleanup.splice(0).forEach((dispose) => dispose()))

function sourceSnapshot(data: Record<string, unknown>): Snapshot {
  return { data, versions: {}, sequences: {}, audit: [], notices: [] }
}

function projectedPage(
  pageName: string,
  sourceData: Record<string, unknown>,
  pages: readonly string[] = budgetPages,
  actor: Actor = reader,
): Sucafina.PageState {
  const view = DashboardBudget.domain.view(sourceSnapshot(sourceData), actor, environment)
  return {
    surface: "dashboard",
    page: pageName,
    pages: [...pages],
    actor,
    year: 2026,
    month: 3,
    data: view.data as Sucafina.PageState["data"],
    versions: view.versions,
    directory: environment.directory,
  }
}

function mount(initialPage: Sucafina.PageState, initialQuery: Sucafina.PageQuery = {}, locale: "en" | "br" = "en") {
  const [page, setPage] = createSignal(initialPage)
  const [query, setQuery] = createSignal(initialQuery)
  const calls: Sucafina.PageQuery[] = []
  const host = document.createElement("div")
  document.body.append(host)
  const scope: { language?: ReturnType<typeof useLanguage> } = {}
  const props: NativeViewProps = {
    get page() { return page() },
    get query() { return query() },
    onQuery(next) { calls.push(next); setQuery(next) },
  }
  const dispose = render(() => createComponent(PlatformProvider, {
    value: createLocalePlatform(),
    get children() { return createComponent(LanguageProvider, { locale, get children() {
      scope.language = useLanguage()
      return createComponent(DashboardBudgetView, props)
    } }) },
  }), host)
  cleanup.push(() => { dispose(); host.remove() })
  const language = scope.language
  if (!language) throw new Error("Language provider did not initialize")
  return { host, calls, page, query, setPage, language }
}

async function until(predicate: () => boolean) {
  for (let attempt = 0; attempt < 200 && !predicate(); attempt++) await Bun.sleep(10)
  if (!predicate()) throw new Error("Timed out waiting for dashboard budget locale copy")
}

function changeSelect(host: HTMLElement, labelText: string, current: string, next: string) {
  const label = [...host.querySelectorAll("label")].find((item) => item.textContent?.includes(labelText))
  const select = label?.querySelector("select")
  if (!select || select.value !== current) throw new Error(`Missing ${labelText} selector at ${current}`)
  if (![...select.options].some((option) => option.value === next)) throw new Error(`${labelText} selector does not offer ${next}`)
  select.value = next
  select.dispatchEvent(new Event("change", { bubbles: true }))
}

function cells(host: HTMLElement, tableLabel: string) {
  const table = [...host.querySelectorAll("table")].find((item) => item.getAttribute("aria-label") === tableLabel)
  const row = table?.querySelector("tbody tr")
  return row ? [...row.querySelectorAll("th, td")].map((cell) => cell.textContent?.trim()) : []
}

function monthOptionValues(host: HTMLElement) {
  return [...(host.querySelectorAll("select")[1]?.options ?? [])].map((option) => option.value)
}

function fieldValue(host: HTMLElement, label: string) {
  const term = [...host.querySelectorAll("dt")].find((item) => item.textContent?.trim() === label)
  return term?.nextElementSibling?.textContent?.trim()
}

function sourceData(): Record<string, unknown> {
  return {
    members: [{ id: "member-active", status: "Active", end: "" }],
    projects: [{ id: "pmo-active", status: "Active", risk: "High" }],
    risks: [{ id: "risk-open", status: "open", impact: 4, probability: 4 }],
    itUsersMonthly: [{ id: "users-2026-03", year: 2026, month: 3, users: 142 }],
    costPerUserBenchmarks: [{ id: "benchmark-2026", year: 2026, value: 87.25 }],
    opsCats: ["IT Security"],
    opsTickets: [{ year: 2026, month: 3, "IT Security|Incidents|Open": 17, "IT Security|Incidents|Closed": 12 }],
    opsSLA: [{ year: 2026, month: 3, incSLA: 96.5, svcSLA: 94 }],
    opsHeatmap: [{ year: 2026, month: 3, p1: 2 }],
    secKpi: [],
    secIncidents: [],
    opexOwners: [{ id: "owner-north", name: "Northern Operations", budget: 240 }],
    opexEntries: [{ id: "opex-march", ownerId: "owner-north", year: 2026, month: 3, budget: 201, actual: 173, forecast: 189 }],
    capexProjects: [{ id: "project-router", name: "Router Renewal", budget: 120, status: "Active" }],
    capexEntries: [{ id: "capex-march", projId: "project-router", year: 2026, month: 3, budget: 113, actual: 83, forecast: 97 }],
    budgetCurrentMonth: { "2026": 3 },
    revenueByYear: { "2026": 500 },
    budgetYtd: { opex: {}, capex: {} },
    deviations: { "opex-owner-north-2026-3": { flag: "dev-amber", text: "Review March actuals" } },
  }
}

test("Executive Dashboard renders actual authorized projection fields without inventing monthly user totals", () => {
  const view = mount(projectedPage("Executive Dashboard", sourceData()))
  expect(fieldValue(view.host, "Active people")).toBe("1")
  expect(fieldValue(view.host, "Active PMO projects")).toBe("1")
  expect(fieldValue(view.host, "Cost per User Benchmark")).toBe("87.25")
  expect(fieldValue(view.host, "P1")).toBe("2")
  expect(fieldValue(view.host, "Budget and cost per user metrics")).toContain("Unavailable: authoritative budget summary projection is not supplied.")
})

test("Budget Overview associates exact projected owner, project, month, revenue and raw entry cells", () => {
  const view = mount(projectedPage("Budget Overview", sourceData()))
  expect(fieldValue(view.host, "Current month")).toBe("3")
  expect(fieldValue(view.host, "Revenue")).toBe("500")
  expect(cells(view.host, "OPEX budget records for 2026")).toEqual(["Northern Operations", "240", "3", "201", "173", "189"])
  expect(cells(view.host, "CAPEX budget records for 2026")).toEqual(["Router Renewal", "120", "3", "113", "83", "97"])
  expect(view.host.textContent).toContain("OPEX/CAPEX totals, variance, actual-to-budget, revenue ratios, progress, and monthly budget series are unavailable until the server supplies the authoritative summary projection.")
  const fieldLabels = [...view.host.querySelectorAll("dt")].map((item) => item.textContent?.trim())
  expect(fieldLabels).not.toContain("OPEX total")
  expect(fieldLabels).not.toContain("CAPEX total")
  expect(view.host.querySelector('table[aria-label*="chart"]')).toBeNull()
})

test("OPEX Detail joins the projected owner and displays its exact raw entry cells", () => {
  const view = mount(projectedPage("OPEX Detail", sourceData()))
  expect(view.host.querySelector("h2")?.textContent).toBe("OPEX owners · 2026")
  expect(cells(view.host, "Northern Operations monthly budget records")).toEqual([
    "3", "201", "173", "189", "dev-amber", "Review March actuals",
  ])
  expect(view.host.textContent).not.toContain("owner-north")
})

test("CAPEX numeric IDs and legacy projectId join exactly; orphan and unlinked entries stay unattached", () => {
  const data = sourceData()
  data.capexProjects = [
    { id: 42, name: "Router Renewal", budget: 120, status: "Active" },
    { id: 77, name: "Unmatched Project", budget: 280, status: "Active" },
  ]
  data.capexEntries = [
    { id: "legacy-alias", projectId: 42, year: 2026, month: 3, budget: 113, actual: 83, forecast: 97 },
    { id: "orphan", projId: 404, year: 2026, month: 3, budget: 777, actual: 666, forecast: 555 },
    { id: "unlinked", year: 2026, month: 3, budget: 444, actual: 333, forecast: 222 },
  ]
  const view = mount(projectedPage("CAPEX Projects", data))
  expect(view.host.querySelector("h2")?.textContent).toBe("CAPEX Projects · 2026")
  expect(cells(view.host, "Router Renewal monthly budget records")).toEqual(["3", "113", "83", "97", "—", "—"])
  const unmatched = [...view.host.querySelectorAll("section[aria-label]")].find((item) => item.getAttribute("aria-label") === "Unmatched Project")
  expect(unmatched?.textContent).toContain("No monthly records are available for 2026.")
  expect(unmatched?.querySelector("table")).toBeNull()
  expect(view.host.textContent).not.toContain("777")
  expect(view.host.textContent).not.toContain("666")
  expect(view.host.textContent).not.toContain("444")
})

test("empty source collections stay empty, while absent projections show unavailable", () => {
  const empty = sourceData()
  empty.opexOwners = []
  empty.opexEntries = []
  empty.capexProjects = []
  empty.capexEntries = []
  const budget = mount(projectedPage("Budget Overview", empty))
  expect(budget.host.textContent).toContain("No OPEX records are available.")
  expect(budget.host.textContent).toContain("No CAPEX records are available.")
  expect(budget.host.querySelector('table[aria-label="OPEX budget records for 2026"]')).toBeNull()

  const emptyParentsWithoutMonthlyCollections = sourceData()
  emptyParentsWithoutMonthlyCollections.opexOwners = []
  delete emptyParentsWithoutMonthlyCollections.opexEntries
  emptyParentsWithoutMonthlyCollections.capexProjects = []
  delete emptyParentsWithoutMonthlyCollections.capexEntries
  const unavailableMonthlyCollections = mount(projectedPage("Budget Overview", emptyParentsWithoutMonthlyCollections))
  expect(unavailableMonthlyCollections.host.textContent).toContain("No OPEX records are available.")
  expect(unavailableMonthlyCollections.host.textContent).toContain("OPEX monthly entry projection is unavailable.")
  expect(unavailableMonthlyCollections.host.textContent).toContain("No CAPEX records are available.")
  expect(unavailableMonthlyCollections.host.textContent).toContain("CAPEX monthly entry projection is unavailable.")

  const absentOwner = sourceData()
  delete absentOwner.opexOwners
  const unavailableOwner = mount(projectedPage("OPEX Detail", absentOwner))
  expect(unavailableOwner.page().data).not.toHaveProperty("opexOwners")
  expect(unavailableOwner.host.textContent).toContain("OPEX owners projection is unavailable.")

  const absentEntries = sourceData()
  delete absentEntries.opexEntries
  const unavailableEntries = mount(projectedPage("OPEX Detail", absentEntries))
  expect(unavailableEntries.page().data).not.toHaveProperty("opexEntries")
  expect(unavailableEntries.host.textContent).toContain("Monthly entry projection is unavailable.")

  const emptyOpexWithoutEntries = sourceData()
  emptyOpexWithoutEntries.opexOwners = []
  delete emptyOpexWithoutEntries.opexEntries
  const unavailableOpexDetail = mount(projectedPage("OPEX Detail", emptyOpexWithoutEntries))
  expect(unavailableOpexDetail.page().data).not.toHaveProperty("opexEntries")
  expect(unavailableOpexDetail.host.textContent).toContain("Monthly entry projection is unavailable.")
  expect(unavailableOpexDetail.host.textContent).toContain("No owners are available for this year.")

  const emptyCapexWithoutEntries = sourceData()
  emptyCapexWithoutEntries.capexProjects = []
  delete emptyCapexWithoutEntries.capexEntries
  const unavailableCapexDetail = mount(projectedPage("CAPEX Projects", emptyCapexWithoutEntries))
  expect(unavailableCapexDetail.page().data).not.toHaveProperty("capexEntries")
  expect(unavailableCapexDetail.host.textContent).toContain("Monthly entry projection is unavailable.")
  expect(unavailableCapexDetail.host.textContent).toContain("No projects are available for this year.")

  const emptyOpexDetail = sourceData()
  emptyOpexDetail.opexOwners = []
  emptyOpexDetail.opexEntries = []
  const availableEmptyOpexDetail = mount(projectedPage("OPEX Detail", emptyOpexDetail))
  expect(availableEmptyOpexDetail.page().data).toHaveProperty("opexEntries", [])
  expect(availableEmptyOpexDetail.host.textContent).toContain("No owners are available for this year.")
  expect(availableEmptyOpexDetail.host.textContent).not.toContain("Monthly entry projection is unavailable.")

  const emptyCapexDetail = sourceData()
  emptyCapexDetail.capexProjects = []
  emptyCapexDetail.capexEntries = []
  const availableEmptyCapexDetail = mount(projectedPage("CAPEX Projects", emptyCapexDetail))
  expect(availableEmptyCapexDetail.page().data).toHaveProperty("capexEntries", [])
  expect(availableEmptyCapexDetail.host.textContent).toContain("No projects are available for this year.")
  expect(availableEmptyCapexDetail.host.textContent).not.toContain("Monthly entry projection is unavailable.")

  const presentEmptyMonthlyCollections = sourceData()
  presentEmptyMonthlyCollections.opexOwners = []
  presentEmptyMonthlyCollections.opexEntries = []
  presentEmptyMonthlyCollections.capexProjects = []
  presentEmptyMonthlyCollections.capexEntries = []
  const availableEmptyMonthlyCollections = mount(projectedPage("Budget Overview", presentEmptyMonthlyCollections))
  expect(availableEmptyMonthlyCollections.host.textContent).toContain("No OPEX records are available.")
  expect(availableEmptyMonthlyCollections.host.textContent).toContain("No CAPEX records are available.")
  expect(availableEmptyMonthlyCollections.host.textContent).not.toContain("OPEX monthly entry projection is unavailable.")
  expect(availableEmptyMonthlyCollections.host.textContent).not.toContain("CAPEX monthly entry projection is unavailable.")
})

test("OPEX zero budget and null actual occupy their exact distinct cells", () => {
  const data = sourceData()
  data.opexOwners = [{ id: 7, name: "Zero Budget Operations", budget: 0 }]
  data.opexEntries = [{ id: "zero-entry", ownerId: 7, year: 2026, month: 3, budget: 0, actual: null, forecast: 350 }]
  const view = mount(projectedPage("OPEX Detail", data))
  expect(cells(view.host, "Zero Budget Operations monthly budget records")).toEqual(["3", "0", "—", "350", "—", "—"])
})

test("actual domain projection denies unrecognized roles and the view reveals no denied data", () => {
  const source = sourceSnapshot(sourceData())
  const projection = DashboardBudget.domain.view(source, deniedActor, environment)
  expect(projection).toEqual({ data: {}, versions: {} })
  const page = projectedPage("Budget Overview", source.data, [], deniedActor)
  const view = mount(page)
  expect(view.host.textContent).toBe("")
  expect(page.pages).toEqual([])
})

test("projected names and notes are escaped, and unrelated page or surface renders no budget data", () => {
  const hostile = '<img src=x onerror="alert(1)">'
  const data = sourceData()
  data.capexProjects = [{ id: "unsafe-project-id", name: hostile, budget: 560 }]
  data.capexEntries = [{ id: "unsafe-entry", projId: "unsafe-project-id", year: 2026, month: 3, budget: 400, actual: null, forecast: 300 }]
  data.deviations = { "capex-unsafe-project-id-2026-3": { flag: "dev-red", text: hostile } }
  const escaped = mount(projectedPage("CAPEX Projects", data))
  expect(escaped.host.textContent).toContain(hostile)
  expect(escaped.host.querySelector("img")).toBeNull()
  expect(escaped.host.textContent).not.toContain("unsafe-project-id")

  const unrelatedPage = projectedPage("Overview", sourceData(), ["Overview"])
  const unrelated = mount({ ...unrelatedPage, page: "Overview" })
  expect(unrelated.host.textContent).toBe("")
  const wrongSurface = mount({ ...projectedPage("OPEX Detail", sourceData()), surface: "planner" })
  expect(wrongSurface.host.textContent).toBe("")
})

test("removing the authorized page clears private rows while page, surface and projected data remain", () => {
  const data = sourceData()
  data.capexProjects = [{ id: "private-capex-id", name: "CAPEX-PRIVATE-PROJECT", budget: 910 }]
  data.capexEntries = [{ id: "private-capex-entry", projId: "private-capex-id", year: 2026, month: 3, budget: 70, actual: 50, forecast: 60 }]
  const initial = projectedPage("CAPEX Projects", data)
  const view = mount(initial)
  expect(view.host.textContent).toContain("CAPEX-PRIVATE-PROJECT")
  view.setPage((current) => ({ ...current, pages: [] }))
  expect(view.page().page).toBe("CAPEX Projects")
  expect(view.page().surface).toBe("dashboard")
  expect(view.page().data).toBe(initial.data)
  expect(view.page().pages).toEqual([])
  expect(view.host.textContent).not.toContain("CAPEX-PRIVATE-PROJECT")
  expect(view.host.textContent).not.toContain("private-capex-id")
})

test("Executive query filters call onQuery and retain prior selections and unrelated keys", () => {
  const initial: Sucafina.PageQuery = {
    year: "2025",
    execYear: "2026",
    executiveMonth: "3",
    opsMonth: "4",
    tab: "keep-tab",
    supplier: "keep-supplier",
  }
  const view = mount(projectedPage("Executive Dashboard", sourceData()), initial)
  expect([...view.host.querySelectorAll("select")]).toHaveLength(3)
  changeSelect(view.host, "Year", "2026", "2027")
  expect(view.calls[0]).toEqual({ ...initial, execYear: "2027" })
  changeSelect(view.host, "Month", "3", "6")
  expect(view.calls[1]).toEqual({ ...initial, execYear: "2027", executiveMonth: "6" })
  changeSelect(view.host, "Operations month", "4", "5")
  expect(view.calls[2]).toEqual({ ...initial, execYear: "2027", executiveMonth: "6", opsMonth: "5" })
  expect(view.query()).toEqual(view.calls[2])
})

test("dashboard budget English copy preserves the frozen source wording byte for byte", () => {
  expect(Object.keys(SF_NATIVE_DASHBOARD_BUDGET_COPY_BR)).toEqual(Object.keys(SF_NATIVE_DASHBOARD_BUDGET_COPY))
  expect(Object.keys(SF_NATIVE_DASHBOARD_BUDGET_COPY).every((key) => key.startsWith("sucafina.native.dashboard-budget."))).toBe(true)
  expect(Object.values(SF_NATIVE_DASHBOARD_BUDGET_COPY)).toEqual([
    "Executive snapshot", "Year", "Month", "Executive snapshot projection is unavailable.",
    "No executive snapshot is available for this year and month.", "Active people", "Departures this year",
    "Departures this month", "Active PMO projects", "PMO at risk", "Active risks", "Top risks",
    "IT performance on target", "Cost per User Benchmark", "Budget and cost per user metrics",
    "Unavailable: authoritative budget summary projection is not supplied.", "Reported monthly IT users · {{year}}",
    "Reported monthly IT users for {{year}}", "Monthly IT users projection is unavailable.",
    "No monthly IT users records are available for {{year}}.", "Reported users", "Service operations",
    "Operations month", "Operations projection is unavailable.", "Tickets opened", "Tickets closed",
    "Final backlog", "Backlog YTD — latest month", "Incidents SLA", "Service Requests SLA", "Incidents SLA YTD",
    "Service Requests SLA YTD", "P1", "Open security incidents for selected snapshot",
    "Security KPI projection is unavailable.", "Security KPI", "Security KPI status", "Latest value", "Status",
    "Budget summary",
    "Budget, actual, forecast, variance, and cost per user totals require an authoritative server summary projection. No totals are calculated from budget rows in this view.",
    "Budget Overview · {{year}}",
    "OPEX/CAPEX totals, variance, actual-to-budget, revenue ratios, progress, and monthly budget series are unavailable until the server supplies the authoritative summary projection.",
    "Current month", "Revenue", "{{collection}} records · {{year}}", "OPEX", "CAPEX",
    "OPEX projection is unavailable.", "CAPEX projection is unavailable.",
    "{{collection}} monthly entry projection is unavailable.", "No OPEX records are available.",
    "No CAPEX records are available.", "Owner", "Project", "Annual budget", "Budget", "Actual", "Forecast",
    "Read-only projection for fiscal year {{year}}. Monthly effective budgets, deviations, utilization, and 12-month totals are not supplied as authoritative fields.",
    "OPEX owners", "CAPEX Projects", "Monthly entry projection is unavailable.",
    "OPEX owners projection is unavailable.", "CAPEX Projects projection is unavailable.",
    "No owners are available for this year.", "No projects are available for this year.", "Total 12mo",
    "Unavailable: server projection required.", "Overridden", "No monthly records are available for {{year}}.",
    "{{name}} monthly budget records", "{{collection}} · {{year}}", "OPEX budget records for {{year}}", "CAPEX budget records for {{year}}",
    "Deviation flag", "Deviation notes", "January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December",
  ])
})

test("dashboard budget copy and month options react EN to pt-BR and back through the real providers", async () => {
  await loadLocaleDict("en")
  await loadLocaleDict("br")
  const source = sourceData()
  source.members = [{ id: "member-active", status: "Active", end: "", fte: 1, flag: "classified" }]
  const view = mount(projectedPage("Executive Dashboard", source))
  await view.language.ready.promise
  await until(() => view.host.querySelector("h2")?.textContent === "Executive snapshot")
  expect(view.host.querySelector("label span")?.textContent).toBe("Year")
  const monthOptions = view.host.querySelectorAll("select")[1]?.options
  const monthWireValues = monthOptionValues(view.host)
  expect(monthOptions?.[0]?.textContent).toBe("January")
  expect(monthWireValues).toEqual(Array.from({ length: 12 }, (_, index) => String(index + 1)))
  expect(view.host.querySelector('table[aria-label="Security KPI status"] thead th')?.textContent).toBe("Security KPI")
  const usersRow = view.host.querySelector('table[aria-label="Reported monthly IT users for 2026"] tbody tr')
  expect(cells(view.host, "Reported monthly IT users for 2026")).toEqual(["2026", "3", "142"])
  expect(fieldValue(view.host, "Active people")).toBe("1")
  expect(view.page().data).not.toHaveProperty("members")

  view.language.setLocale("br")
  await until(() => view.host.querySelector("h2")?.textContent === "Visão executiva")
  expect(view.host.querySelector("label span")?.textContent).toBe("Ano")
  expect([...view.host.querySelectorAll("select")][1]?.options[0]?.textContent).toBe("janeiro")
  expect([...view.host.querySelectorAll("select")][1]?.options).toHaveLength(12)
  expect(monthOptionValues(view.host)).toEqual(monthWireValues)
  expect(view.host.querySelector('table[aria-label="Status do KPI de segurança"] thead th')?.textContent).toBe("KPI de segurança")
  expect(view.host.querySelector('table[aria-label="Status do KPI de segurança"] thead th:nth-child(2)')?.textContent).toBe("Valor mais recente")
  expect(fieldValue(view.host, "Pessoas ativas")).toBe("1")
  expect(fieldValue(view.host, "Referência de custo por usuário")).toBe("87,25")
  expect(cells(view.host, "Registros mensais de usuários de TI de 2026")).toEqual(["2026", "3", "142"])
  expect(view.host.querySelector('table[aria-label="Registros mensais de usuários de TI de 2026"] tbody tr')).toBe(usersRow)
  expect(view.host.textContent).toContain("Os totais de orçamento, valores realizados e previstos, variação e custo por usuário exigem uma projeção oficial do servidor. Esta tela não calcula totais a partir dos registros orçamentários.")

  view.language.setLocale("en")
  await until(() => view.host.querySelector("h2")?.textContent === "Executive snapshot")
  expect(view.host.querySelector("label span")?.textContent).toBe("Year")
  expect([...view.host.querySelectorAll("select")][1]?.options[0]?.textContent).toBe("January")
  expect(monthOptionValues(view.host)).toEqual(monthWireValues)
  expect(view.host.querySelector('table[aria-label="Security KPI status"] thead th')?.textContent).toBe("Security KPI")
  expect(cells(view.host, "Reported monthly IT users for 2026")).toEqual(["2026", "3", "142"])
  expect(view.host.querySelector('table[aria-label="Reported monthly IT users for 2026"] tbody tr')).toBe(usersRow)
  expect(fieldValue(view.host, "Active people")).toBe("1")

  const sourceAfterHeadcountChange = sourceData()
  sourceAfterHeadcountChange.members = [{ id: "member-active", status: "Active", end: "", fte: null }]
  view.setPage(projectedPage("Executive Dashboard", sourceAfterHeadcountChange))
  expect(fieldValue(view.host, "Active people")).toBe("1")
  expect(view.page().data).not.toHaveProperty("members")
  expect(view.host.textContent).not.toContain("classified")
  expect(view.host.textContent).not.toContain("member-active")
})
