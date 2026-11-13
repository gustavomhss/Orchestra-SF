import { afterEach, expect, test } from "bun:test"
import type { Sucafina } from "@orchestra/schema/sucafina"
import type { Locale } from "@/context/language"
import { createComponent, createSignal } from "solid-js"
import { render } from "solid-js/web"
import { SF_NATIVE_DASHBOARD_OPERATIONS_COPY, SF_NATIVE_DASHBOARD_OPERATIONS_COPY_BR } from "../src/i18n/orchestra-chapters/sucafina-native-dashboard-operations"
import { DashboardOperations } from "../../../modules/sucafina/Sucafinav1/runtime/dashboard-operations.ts"
import { DashboardPortfolio } from "../../../modules/sucafina/Sucafinav1/runtime/dashboard-portfolio.ts"
import type { Snapshot } from "../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { createLocalePlatform } from "./native-locale-fixture"
import { solidDom } from "./solid-dom"

const { DashboardOperationsView }: typeof import("../src/orchestra/chapters/sucafina/dashboard-operations-view") =
  await import(solidDom("../src/orchestra/chapters/sucafina/dashboard-operations-view", import.meta.dir))
const { PlatformProvider }: typeof import("@/context/platform") = await import(solidDom("@/context/platform", import.meta.dir))
const { LanguageProvider, useLanguage }: typeof import("@/context/language") = await import(solidDom("@/context/language", import.meta.dir))

const pages = ["IT Operations", "IT Security KPIs", "Vendor Contracts"]
const actor = { id: "operator", name: "Operator", canWrite: true, roles: ["admin"], assigned: [], domains: [] }
const environment = { at: "2026-11-13T12:00:00Z", id: () => "unused", directory: [{ id: "owner-1", name: "Alex Owner" }] }
const hostile = '<img src=x onerror="alert(1)">'
const cleanups: (() => void)[] = []
afterEach(() => cleanups.splice(0).forEach((dispose) => dispose()))

async function until(predicate: () => boolean) {
  for (let attempt = 0; attempt < 200 && !predicate(); attempt++) await Bun.sleep(10)
  expect(predicate()).toBe(true)
}

function snapshot(populated = true): Snapshot {
  return {
    data: {
      opsCats: populated ? ["Infrastructure"] : [],
      opsHmItems: populated ? ["Core network"] : [],
      opsTickets: populated ? [{ id: "2026-3", year: 2026, month: 3, "Infrastructure|Incidents|Open": 7, "Infrastructure|Incidents|Closed": 2 }] : [],
      opsSLA: populated ? [{ id: "2026-3", year: 2026, month: 3, incSLA: 0, svcSLA: null, avail: 98.5 }] : [],
      opsHeatmap: populated ? [{ id: "2026-3:Core network", year: 2026, month: 3, item: "Core network", p1: 1, p2: 2, tickets: 9, comments: hostile }] : [],
      secKpi: populated ? [{ id: "2026-3", year: 2026, month: 3, training: 87, assessment: 0, scan: null }] : [],
      secActions: populated ? [{ id: 713, text: "Review privileged access", done: false }] : [],
      secIncidents: populated ? [{ id: "incident-1", title: "Mail disruption", date: "2026-03-12", impact: "Mail unavailable", contained: false, remediated: false, rootCause: false, consequences: [] }] : [],
      secPhishing: populated ? [{ id: "campaign-1", name: "March exercise", targeted: 50, clicked: 3, departments: [{ name: "Finance team", users: 20, failed: 2, entered: 1, reported: 4 }] }] : [],
      contracts: populated ? [{ id: "contract-1", vendor: hostile, num: "C-42", name: "Connectivity", owner: "Alex Owner", ownerId: "owner-1", amount: 1250, amtType: "annual", renewal: "2026-12-01", renewType: "fixed", eval: "A", docs: [{ id: "doc-1", name: "Schedule.pdf", status: "available" }] }] : [],
    },
    versions: {}, sequences: {}, audit: [], notices: [],
  }
}

function projected(name: string, populated = true, state = snapshot(populated)): Sucafina.PageState {
  const operations = DashboardOperations.domain.view(state, actor, environment)
  const portfolio = DashboardPortfolio.domain.view(state, actor, environment)
  return {
    surface: "dashboard", page: name, pages, actor, year: 2026, month: 3,
    data: { ...operations.data, ...portfolio.data } as Sucafina.PageState["data"],
    versions: { ...operations.versions, ...portfolio.versions }, directory: environment.directory,
  }
}

function mount(initial: Sucafina.PageState, initialQuery?: Sucafina.PageQuery, locale: Locale = "en") {
  const [page, setPage] = createSignal(initial)
  const [query, setQuery] = createSignal<Sucafina.PageQuery>(initialQuery ?? { page: initial.page, year: "2026", opsYear: "2026", secYear: "2026", operationsMonth: "3", securityMonth: "3" })
  const calls: Sucafina.PageQuery[] = []
  const languageContext: { current: ReturnType<typeof useLanguage> | undefined } = { current: undefined }
  const host = document.createElement("div")
  document.body.append(host)
  const dispose = render(() => createComponent(PlatformProvider, {
    value: createLocalePlatform(),
    get children() {
      return createComponent(LanguageProvider, {
        locale,
        get children() {
          return createComponent(() => {
            languageContext.current = useLanguage()
            return createComponent(DashboardOperationsView, {
              get page() { return page() },
              get query() { return query() },
              onQuery(next: Sucafina.PageQuery) { calls.push(next); setQuery(next) },
            })
          }, {})
        },
      })
    },
  }), host)
  cleanups.push(() => { dispose(); host.remove() })
  return { host, setPage, calls, languageContext }
}

function contains(host: HTMLElement, ...values: string[]) {
  for (const value of values) expect(host.textContent).toContain(value)
}

function expectEmptyRecordTable(host: HTMLElement, name: string, emptyMessage: string) {
  const section = [...host.querySelectorAll("section[aria-label]")].find((item) => item.getAttribute("aria-label") === name)
  expect(section).toBeDefined()
  if (!section) throw new Error(`Missing ${name} section`)
  expect(section.textContent).toContain(emptyMessage)
  expect(section.querySelectorAll("tbody tr")).toHaveLength(0)
}

test("IT Operations renders projected ticket, SLA and heat-map values without executing markup", () => {
  const view = mount(projected("IT Operations"))
  contains(view.host, "Ticket Register", "SLA and Availability", "Incident SLA", "Service SLA", "Availability", "98.5", "Heat Map", "Core network")
  const ticketSection = [...view.host.querySelectorAll("section[aria-label]")].find((item) => item.getAttribute("aria-label") === "Ticket Register · source records")
  const ticketTable = ticketSection?.querySelector("table")
  expect(ticketTable).toBeDefined()
  if (!ticketTable) throw new Error("Missing ticket register columns")
  const headers = [...ticketTable.querySelectorAll("thead th")].map((cell) => cell.textContent?.trim() ?? "")
  const month = [...ticketTable.querySelectorAll("tbody tr")].find((row) => row.cells[headers.indexOf("Month")]?.textContent?.trim() === "3" &&
    row.cells[headers.indexOf("Category")]?.textContent?.trim() === "Infrastructure" &&
    row.cells[headers.indexOf("Type")]?.textContent?.trim() === "Incidents" &&
    row.cells[headers.indexOf("Measure")]?.textContent?.trim() === "Open")
  expect(month).toBeDefined()
  if (!month) throw new Error("Missing March ticket row")
  expect(month.cells[headers.indexOf("Value")]?.textContent?.trim()).toBe("7")
  const closed = [...ticketTable.querySelectorAll("tbody tr")].find((row) => row.cells[headers.indexOf("Month")]?.textContent?.trim() === "3" &&
    row.cells[headers.indexOf("Category")]?.textContent?.trim() === "Infrastructure" &&
    row.cells[headers.indexOf("Type")]?.textContent?.trim() === "Incidents" &&
    row.cells[headers.indexOf("Measure")]?.textContent?.trim() === "Closed")
  expect(closed?.cells[headers.indexOf("Value")]?.textContent?.trim()).toBe("2")
  const comment = [...view.host.querySelectorAll("*")].some((element) =>
    element.getAttribute("title") === hostile || element.textContent === hostile,
  )
  expect(comment).toBe(true)
  expect(view.host.querySelector("img")).toBeNull()
})

test("ticket register and heat map retain other months in the selected year", () => {
  const state = snapshot()
  state.data.opsTickets = [
    { id: "2026-3", year: 2026, month: 3, "Infrastructure|Incidents|Open": 7, "Infrastructure|Incidents|Closed": 2 },
    { id: "2026-4", year: 2026, month: 4, "Infrastructure|Incidents|Open": 13, "Infrastructure|Incidents|Closed": 11 },
  ]
  state.data.opsHeatmap = [
    { id: "2026-3:Core network", year: 2026, month: 3, item: "Core network", p1: 1, p2: 2, tickets: 9, comments: "March observation" },
    { id: "2026-4:Core network", year: 2026, month: 4, item: "Core network", p1: 3, p2: 4, tickets: 17, comments: "April observation" },
  ]
  const page = projected("IT Operations", true, state)
  expect(page.data.opsTickets).toMatchObject([{ month: 3 }, { month: 4 }])
  const view = mount(page)
  const ticketSection = [...view.host.querySelectorAll("section[aria-label]")].find((item) => item.getAttribute("aria-label") === "Ticket Register · source records")
  const ticket = ticketSection?.querySelector("table")
  expect(ticket).toBeDefined()
  if (!ticket) throw new Error("Missing ticket register")
  const headers = [...ticket.querySelectorAll("thead th")].map((cell) => cell.textContent?.trim() ?? "")
  const aprilTicket = [...ticket.querySelectorAll("tbody tr")].find((row) => row.cells[headers.indexOf("Month")]?.textContent?.trim() === "4" &&
    row.cells[headers.indexOf("Category")]?.textContent?.trim() === "Infrastructure" &&
    row.cells[headers.indexOf("Type")]?.textContent?.trim() === "Incidents" &&
    row.cells[headers.indexOf("Measure")]?.textContent?.trim() === "Open")
  expect(aprilTicket).toBeDefined()
  expect(aprilTicket?.cells[headers.indexOf("Value")]?.textContent?.trim()).toBe("13")
  const aprilClosed = [...ticket.querySelectorAll("tbody tr")].find((row) => row.cells[headers.indexOf("Month")]?.textContent?.trim() === "4" &&
    row.cells[headers.indexOf("Category")]?.textContent?.trim() === "Infrastructure" &&
    row.cells[headers.indexOf("Type")]?.textContent?.trim() === "Incidents" &&
    row.cells[headers.indexOf("Measure")]?.textContent?.trim() === "Closed")
  expect(aprilClosed?.cells[headers.indexOf("Value")]?.textContent?.trim()).toBe("11")
  const heatSection = [...view.host.querySelectorAll("section[aria-label]")].find((item) => item.getAttribute("aria-label") === "Heat Map · selected year")
  const heat = heatSection?.querySelector("table")
  expect(heat).toBeDefined()
  if (!heat) throw new Error("Missing heat map")
  const heatHeaders = [...heat.querySelectorAll("thead th")].map((cell) => cell.textContent?.trim() ?? "")
  const march = [...heat.querySelectorAll("tbody tr")].find((row) => row.cells[heatHeaders.indexOf("Item")]?.textContent?.trim() === "Core network" &&
    row.cells[heatHeaders.indexOf("Month")]?.textContent?.trim() === "3")
  expect(march).toBeDefined()
  const aprilHeatmap = [...heat.querySelectorAll("tbody tr")].find((row) => row.cells[heatHeaders.indexOf("Item")]?.textContent?.trim() === "Core network" &&
    row.cells[heatHeaders.indexOf("Month")]?.textContent?.trim() === "4")
  expect(aprilHeatmap).toBeDefined()
  expect(aprilHeatmap?.cells[heatHeaders.indexOf("P1")]?.textContent?.trim()).toBe("3")
  expect(aprilHeatmap?.cells[heatHeaders.indexOf("P2")]?.textContent?.trim()).toBe("4")
  expect(aprilHeatmap?.cells[heatHeaders.indexOf("Tickets")]?.textContent?.trim()).toBe("17")
  expect(aprilHeatmap?.cells[heatHeaders.indexOf("Comments")]?.textContent?.trim()).toBe("April observation")
})

test("missing and empty operation categories and heat-map items remain independent", () => {
  for (const [key, other, marker] of [["opsCats", "opsHmItems", "Core network"], ["opsHmItems", "opsCats", "Infrastructure"]] as const) {
    const sectionName = key === "opsCats" ? "Ticket categories" : "Heat-map item names"
    const unavailableName = key === "opsCats" ? "Ticket categories" : "Heat-map items"
    const otherSectionName = other === "opsCats" ? "Ticket categories" : "Heat-map item names"
    const emptyMessage = key === "opsCats" ? "No ticket categories are available." : "No heat-map items are available."
    const missing = snapshot()
    delete missing.data[key]
    const missingPage = projected("IT Operations", true, missing)
    expect(Object.hasOwn(missingPage.data, key)).toBe(false)
    expect(missingPage.data[other]).toBeDefined()
    const missingView = mount(missingPage)
    const unavailableSection = [...missingView.host.querySelectorAll("section[aria-label]")].find((item) => item.getAttribute("aria-label") === unavailableName)
    expect(unavailableSection).toBeDefined()
    expect(unavailableSection?.textContent).toContain("Projection unavailable.")
    const otherSection = [...missingView.host.querySelectorAll("section[aria-label]")].find((item) => item.getAttribute("aria-label") === otherSectionName)
    expect(otherSection?.textContent).toContain(marker)

    const empty = snapshot()
    empty.data[key] = []
    const emptyPage = projected("IT Operations", true, empty)
    expect(emptyPage.data[key]).toEqual([])
    expect(emptyPage.data[other]).toBeDefined()
    const emptyView = mount(emptyPage)
    expectEmptyRecordTable(emptyView.host, sectionName, emptyMessage)
    const emptyOtherSection = [...emptyView.host.querySelectorAll("section[aria-label]")].find((item) => item.getAttribute("aria-label") === otherSectionName)
    expect(emptyOtherSection?.textContent).toContain(marker)
  }
})

test("security source notes and campaign interaction counts render as escaped values", () => {
  const state = snapshot()
  const kpiNote = '<img src=x onerror="alert(1)"> KPI note'
  const campaignNote = '<svg onload="alert(1)"></svg> campaign note'
  state.data.secKpi = [{ id: "2026-3", year: 2026, month: 3, training: 87, assessment: 0, scan: null, notes: kpiNote }]
  state.data.secPhishing = [{ id: "campaign-1", name: "March exercise", targeted: 50, noInteraction: 31, openedOnly: 8, notes: campaignNote, departments: [] }]
  const page = projected("IT Security KPIs", true, state)
  expect(page.data.secKpi).toMatchObject([{ notes: kpiNote }])
  expect(page.data.secPhishing).toMatchObject([{ noInteraction: 31, openedOnly: 8, notes: campaignNote }])
  const view = mount(page)
  contains(view.host, kpiNote, campaignNote, "March exercise")
  const campaignTable = [...view.host.querySelectorAll("section[aria-label]")].find((item) => item.getAttribute("aria-label") === "Phishing Campaigns · source values")?.querySelector("table")
  expect(campaignTable).toBeDefined()
  if (!campaignTable) throw new Error("Missing campaign source values")
  const campaignHeaders = [...campaignTable.querySelectorAll("thead th")].map((cell) => cell.textContent?.trim() ?? "")
  const campaignRow = [...campaignTable.querySelectorAll("tbody tr")].find((row) => row.cells[campaignHeaders.indexOf("Campaign")]?.textContent?.trim() === "March exercise")
  expect(campaignRow).toBeDefined()
  if (!campaignRow) throw new Error("Missing March campaign row")
  expect(campaignRow.cells[campaignHeaders.indexOf("No interaction")]?.textContent?.trim()).toBe("31")
  expect(campaignRow.cells[campaignHeaders.indexOf("Opened only")]?.textContent?.trim()).toBe("8")
  expect(view.host.querySelector("img")).toBeNull()
  expect(view.host.querySelector("svg[onload]")).toBeNull()
})

test("campaign departments distinguish an absent field from an empty list", () => {
  const state = snapshot()
  state.data.secPhishing = [
    { id: "missing-departments", name: "Unreported departments", targeted: 20 },
    { id: "empty-departments", name: "No departments", targeted: 10, departments: [] },
  ]
  const page = projected("IT Security KPIs", true, state)
  expect(page.data.secPhishing).toMatchObject([{ name: "Unreported departments" }, { name: "No departments", departments: [] }])
  const campaigns = page.data.secPhishing as Record<string, unknown>[]
  expect(Object.hasOwn(campaigns[0], "departments")).toBe(false)
  const view = mount(page)
  const absentCard = [...view.host.querySelectorAll("section[aria-label]")].find((item) => item.getAttribute("aria-label") === "Departments · Unreported departments")
  const emptyCard = [...view.host.querySelectorAll("section[aria-label]")].find((item) => item.getAttribute("aria-label") === "Departments · No departments")
  expect(absentCard).toBeDefined()
  expect(emptyCard).toBeDefined()
  expect(absentCard).not.toBe(emptyCard)
  expect(absentCard?.textContent).toMatch(/unavailable|not available/i)
  expect(emptyCard?.textContent).not.toMatch(/unavailable|not available/i)
  expect(emptyCard?.querySelectorAll("tbody tr")).toHaveLength(0)
})

test("IT Security KPIs renders source KPI, action, campaign and incident details", () => {
  const state = projected("IT Security KPIs")
  expect(state.data.secActions).toMatchObject([{ id: 713, text: "Review privileged access" }])
  const view = mount(state)
  contains(view.host, "Training", "87", "Management Actions", "Review privileged access", "March exercise", "Finance team", "Mail disruption", "2026-03-12", "Mail unavailable")
  const table = [...view.host.querySelectorAll("table")].find((item) => {
    const headers = [...item.querySelectorAll("thead th")].map((cell) => cell.textContent?.trim())
    return headers.includes("Assessment") && headers.includes("Scan")
  })
  expect(table).toBeDefined()
  if (!table) throw new Error("Missing KPI monthly entries")
  const headers = [...table.querySelectorAll("thead th")].map((cell) => cell.textContent?.trim())
  const month = [...table.querySelectorAll("tbody tr")].find((row) => /^(3|Mar|March)$/i.test(row.cells[0]?.textContent?.trim() ?? ""))
  expect(month).toBeDefined()
  if (!month) throw new Error("Missing March KPI row")
  expect(month.cells[headers.indexOf("Assessment")]?.textContent?.trim()).toBe("0")
  expect(["", "—", "–", "No data"]).toContain(month.cells[headers.indexOf("Scan")]?.textContent?.trim())
})

test("Vendor Contracts renders projected vendor, record and document details as text", () => {
  const view = mount(projected("Vendor Contracts"))
  contains(view.host, "Contract Register", "Vendor", hostile, "C-42", "annual", "2026-12-01", "A", "Alex Owner", "Schedule.pdf", "available")
  expect(view.host.textContent).toMatch(/1,?250/)
  expect(view.host.querySelector("img")).toBeNull()
})

test("zero and null service values remain distinguishable", () => {
  const view = mount(projected("IT Operations"))
  const table = [...view.host.querySelectorAll("table")].find((item) => item.textContent?.includes("Incident SLA") && item.textContent.includes("Service SLA"))
  expect(table).toBeDefined()
  const headers = [...table!.querySelectorAll("thead th")].map((item) => item.textContent?.trim())
  const row = [...table!.querySelectorAll("tbody tr")].find((item) => item.textContent?.includes("98.5"))
  expect(row).toBeDefined()
  const cells = [...row!.querySelectorAll("td")].map((item) => item.textContent?.trim())
  expect(cells[headers.indexOf("Incident SLA")]).toBe("0")
  expect(["", "—", "–", "No data"]).toContain(cells[headers.indexOf("Service SLA")])
})

test("empty projected collections do not fabricate ticket, security or contract records", () => {
  for (const name of pages) {
    const view = mount(projected(name, false))
    if (name === "IT Operations") {
      expectEmptyRecordTable(view.host, "Ticket Register · source records", "No ticket records for this year.")
      expectEmptyRecordTable(view.host, "SLA and Availability", "No SLA records for this year.")
      expectEmptyRecordTable(view.host, "Heat Map · selected year", "No heat-map records for this year.")
      expectEmptyRecordTable(view.host, "Heat-map item names", "No heat-map items are available.")
      expectEmptyRecordTable(view.host, "Ticket categories", "No ticket categories are available.")
    }
    if (name === "IT Security KPIs") {
      expectEmptyRecordTable(view.host, "Monthly Entries · source values", "No monthly KPI record for this period.")
      expectEmptyRecordTable(view.host, "Management Actions", "No management actions.")
      expectEmptyRecordTable(view.host, "Phishing Campaigns · source values", "No phishing campaigns.")
      expectEmptyRecordTable(view.host, "Security Incidents with Business Impact", "No incidents for this year.")
    }
    if (name === "Vendor Contracts") {
      expectEmptyRecordTable(view.host, "Contract Register", "No contracts match these filters.")
    }
  }
})

test("an unavailable SLA collection is not represented as an empty successful collection", () => {
  const state = snapshot()
  delete state.data.opsSLA
  const operations = DashboardOperations.domain.view(state, actor, environment)
  const portfolio = DashboardPortfolio.domain.view(state, actor, environment)
  expect(Object.hasOwn(operations.data, "opsSLA")).toBe(false)
  const page = projected("IT Operations")
  const view = mount({ ...page, data: { ...operations.data, ...portfolio.data } as Sucafina.PageState["data"] })
  contains(view.host, "Ticket Register", "Core network")
  expect(view.host.textContent).toMatch(/(?:SLA[\s\S]{0,100}(?:unavailable|not available)|(?:unavailable|not available)[\s\S]{0,100}SLA)/i)
  expect(view.host.textContent).not.toContain("98.5")
})

test("viewer projection exposes authorized operations while withholding security and contracts", () => {
  const state = snapshot()
  state.data.summaries = ["IT Operations"]
  const viewer = { id: "viewer", name: "Viewer", canWrite: false, roles: ["viewer"], assigned: [], domains: [] }
  const operations = DashboardOperations.domain.view(state, viewer, environment)
  const portfolio = DashboardPortfolio.domain.view(state, viewer, environment)
  expect(operations.data.opsHeatmap).toBeDefined()
  expect(operations.data.secActions).toBeUndefined()
  expect(portfolio.data.contracts).toBeUndefined()
  const previous = projected("IT Security KPIs")
  const view = mount(previous)
  contains(view.host, "Review privileged access")
  view.setPage({
    ...previous, page: "IT Operations", pages: ["IT Operations"], actor: viewer,
    data: { ...operations.data, ...portfolio.data } as Sucafina.PageState["data"],
    versions: { ...operations.versions, ...portfolio.versions },
  })
  contains(view.host, "Core network")
  expect(view.host.textContent).not.toContain("Review privileged access")
  expect(view.host.textContent).not.toContain("C-42")
})

test("unrelated page and surface cannot render operations data", () => {
  for (const page of [{ ...projected("Overview"), surface: "dashboard" as const }, { ...projected("IT Operations"), surface: "planner" as const }]) {
    const view = mount(page)
    for (const value of ["Infrastructure", "Core network", "Review privileged access", "Mail disruption", "C-42"]) expect(view.host.textContent).not.toContain(value)
  }
})

test("removing the current page from authorized pages clears previous private rows", () => {
  for (const [name, marker] of [["IT Operations", "Core network"], ["IT Security KPIs", "Review privileged access"], ["Vendor Contracts", "C-42"]]) {
    const initial = projected(name)
    const view = mount(initial)
    contains(view.host, marker)
    view.setPage({ ...initial, pages: [] })
    expect(view.host.textContent).not.toContain(marker)
    expect(view.host.textContent).not.toContain(hostile)
  }
})

test("exposed period filter delegates its query and preserves unrelated filters", () => {
  for (const [name, key] of [["IT Operations", "opsYear"], ["IT Security KPIs", "secYear"]] as const) {
    const view = mount(projected(name), { page: name, year: "2026", opsYear: "2026", secYear: "2026", operationsMonth: "3", securityMonth: "3", q: "keep search" })
    const label = [...view.host.querySelectorAll("label")].find((item) => item.textContent?.includes("Year"))
    const control = label?.querySelector("select, input")
    expect(control).toBeDefined()
    if (!(control instanceof HTMLSelectElement || control instanceof HTMLInputElement)) throw new Error("Missing Year control")
    const nextYear = control instanceof HTMLSelectElement
      ? [...control.options].find((option) => option.value && option.value !== control.value)?.value
      : "2025"
    expect(nextYear).toBeDefined()
    if (!nextYear) throw new Error("No alternate year option")
    control.value = nextYear
    control.dispatchEvent(new Event("change", { bubbles: true }))
    expect(view.calls).toHaveLength(1)
    expect(view.calls[0]).toMatchObject({ page: name, [key]: nextYear, q: "keep search", year: "2026", operationsMonth: "3", securityMonth: "3" })
  }
})

test("dashboard operations copy preserves English and renders from the Brazilian Portuguese provider", async () => {
  const englishOperations = mount(projected("IT Operations"))
  const englishSecurity = mount(projected("IT Security KPIs"))
  const englishContracts = mount(projected("Vendor Contracts"))
  const emptyContracts = mount(projected("Vendor Contracts", false), undefined, "br")
  await Promise.all([englishOperations, englishSecurity, englishContracts].map(async (view) => {
    const language = view.languageContext.current
    expect(language).toBeDefined()
    if (!language) throw new Error("Missing LanguageProvider context")
    await language.ready.promise
  }))
  const emptyLanguage = emptyContracts.languageContext.current
  expect(emptyLanguage).toBeDefined()
  if (!emptyLanguage) throw new Error("Missing empty contracts LanguageProvider context")
  await emptyLanguage.ready.promise
  await until(() => emptyLanguage.locale() === "br" &&
    emptyLanguage.t("sucafina.native.dashboard-operations.empty.contracts") === SF_NATIVE_DASHBOARD_OPERATIONS_COPY_BR["sucafina.native.dashboard-operations.empty.contracts"] &&
    emptyContracts.host.textContent?.includes(SF_NATIVE_DASHBOARD_OPERATIONS_COPY_BR["sucafina.native.dashboard-operations.empty.contracts"]) === true)
  contains(englishOperations.host, "IT Operations", "Read-only dashboard information from the authorized page projection.", "Ticket Register · source records", "SLA and Availability", "Availability")
  contains(englishSecurity.host, "IT Security KPIs", "Monthly Entries · source values", "No interaction", "Management Actions")
  contains(englishContracts.host, "Vendor Contracts", "Contract Register", "Contract name", "C-42", "Schedule.pdf")
  expectEmptyRecordTable(emptyContracts.host, SF_NATIVE_DASHBOARD_OPERATIONS_COPY_BR["sucafina.native.dashboard-operations.table.contractRegister"], "Nenhum contrato corresponde a esses filtros.")
  expect(SF_NATIVE_DASHBOARD_OPERATIONS_COPY["sucafina.native.dashboard-operations.page.operations"]).toBe("IT Operations")
  expect(SF_NATIVE_DASHBOARD_OPERATIONS_COPY["sucafina.native.dashboard-operations.table.ticketRegister"]).toBe("Ticket Register · source records")

  const language = englishContracts.languageContext.current
  expect(language).toBeDefined()
  if (!language) throw new Error("Missing LanguageProvider context")
  const contractTable = englishContracts.host.querySelector("table")
  const documentTable = [...englishContracts.host.querySelectorAll("table")].find((table) =>
    [...table.querySelectorAll("thead th")].some((cell) => cell.textContent?.trim() === "Availability"))
  const contractHeaders = [...(contractTable?.querySelectorAll("thead th") ?? [])].map((cell) => cell.textContent?.trim() ?? "")
  const contractRow = [...(contractTable?.querySelectorAll("tbody tr") ?? [])].find((row) =>
    row.cells[contractHeaders.indexOf("Contract #")]?.textContent?.trim() === "C-42")
  const evaluationSelect = [...englishContracts.host.querySelectorAll("select")].find((select) =>
    [...select.options].some((option) => option.value === "A"))
  expect(contractTable).toBeDefined()
  expect(documentTable).toBeDefined()
  expect(contractRow).toBeDefined()
  expect(evaluationSelect).toBeDefined()
  if (!contractTable || !documentTable || !contractRow || !evaluationSelect) throw new Error("Missing contract row, document table, or evaluation options")
  const allEvaluationsOption = evaluationSelect.options[0]
  const gradeAOption = [...evaluationSelect.options].find((option) => option.value === "A")
  if (!gradeAOption) throw new Error("Missing evaluation grade A option")
  const contractOptionNodes = [...evaluationSelect.options]
  const assertContractEnglish = () => {
    const headers = [...contractTable.querySelectorAll("thead th")].map((cell) => cell.textContent?.trim() ?? "")
    expect(englishContracts.host.querySelector("h1")?.textContent).toBe("Vendor Contracts")
    expect(headers).toEqual(["Vendor", "Contract #", "Amount", "Type", "Currency", "Renewal", "Renewal date", "Eval", "Notes", "Documents"])
    expect(documentTable.querySelector("thead th")?.textContent?.trim()).toBe("Document")
    expect(englishContracts.host.querySelector("table")).toBe(contractTable)
    expect(englishContracts.host.querySelector("select")).toBe(evaluationSelect)
    expect([...contractTable.querySelectorAll("tbody tr")]).toContain(contractRow)
    expect(contractRow.cells[headers.indexOf("Vendor")]?.textContent?.trim()).toBe(hostile)
    expect(contractRow.cells[headers.indexOf("Contract #")]?.textContent?.trim()).toBe("C-42")
    expect(contractRow.cells[headers.indexOf("Amount")]?.textContent?.trim()).toBe("1250")
    expect([...evaluationSelect.options].map((option) => option.value)).toEqual(["", "A", "B", "C", "D"])
    expect(evaluationSelect.options[0]).toBe(allEvaluationsOption)
    expect(allEvaluationsOption.value).toBe("")
    expect(allEvaluationsOption.textContent?.trim()).toBe("All evaluations")
    expect(gradeAOption.value).toBe("A")
    expect(evaluationSelect.options).toContain(gradeAOption)
  }
  assertContractEnglish()

  language.setLocale("br")
  await until(() => language.locale() === "br" &&
    language.t("sucafina.native.dashboard-operations.page.contracts") === SF_NATIVE_DASHBOARD_OPERATIONS_COPY_BR["sucafina.native.dashboard-operations.page.contracts"] &&
    allEvaluationsOption.textContent?.trim() === SF_NATIVE_DASHBOARD_OPERATIONS_COPY_BR["sucafina.native.dashboard-operations.empty.allEvaluations"])
  const contractHeadersBr = [...contractTable.querySelectorAll("thead th")].map((cell) => cell.textContent?.trim() ?? "")
  expect(englishContracts.host.querySelector("table")).toBe(contractTable)
  expect(englishContracts.host.querySelector("select")).toBe(evaluationSelect)
  expect(englishContracts.host.querySelector("h1")?.textContent).toBe("Contratos de fornecedores")
  expect(contractHeadersBr).toEqual(["Fornecedor", "Nº do contrato", "Valor", "Tipo", "Moeda", "Renovação", "Data de renovação", "Avaliação", "Observações", "Documentos"])
  expect(documentTable.querySelector("thead th")?.textContent?.trim()).toBe("Documento")
  expect([...contractTable.querySelectorAll("tbody tr")]).toContain(contractRow)
  expect(contractRow.cells[contractHeadersBr.indexOf("Nº do contrato")]?.textContent?.trim()).toBe("C-42")
  expect(contractRow.cells[contractHeadersBr.indexOf("Fornecedor")]?.textContent?.trim()).toBe(hostile)
  expect(contractRow.cells[contractHeadersBr.indexOf("Valor")]?.textContent?.trim()).toBe("1250")
  expect(evaluationSelect.options).toHaveLength(contractOptionNodes.length)
  for (const [index, option] of contractOptionNodes.entries()) expect(evaluationSelect.options[index]).toBe(option)
  expect([...evaluationSelect.options].map((option) => option.value)).toEqual(["", "A", "B", "C", "D"])
  expect(allEvaluationsOption.value).toBe("")
  expect(allEvaluationsOption.textContent?.trim()).toBe("Todas as avaliações")
  expect(gradeAOption.value).toBe("A")
  contains(englishContracts.host, "Contratos de fornecedores", "Cadastro de contratos", "Nome do contrato")

  language.setLocale("en")
  await until(() => language.locale() === "en" && allEvaluationsOption.textContent?.trim() === "All evaluations")
  assertContractEnglish()
  englishContracts.setPage(projected("IT Operations"))
  await until(() => englishContracts.host.querySelector("h1")?.textContent === "IT Operations")
  englishContracts.setPage(projected("IT Security KPIs"))
  await until(() => englishContracts.host.querySelector("h1")?.textContent === "IT Security KPIs")

  const operationsLanguage = englishOperations.languageContext.current
  const securityLanguage = englishSecurity.languageContext.current
  expect(operationsLanguage).toBeDefined()
  expect(securityLanguage).toBeDefined()
  if (!operationsLanguage || !securityLanguage) throw new Error("Missing dashboard LanguageProvider context")
  operationsLanguage.setLocale("br")
  securityLanguage.setLocale("br")
  await until(() => operationsLanguage.locale() === "br" && securityLanguage.locale() === "br" &&
    englishOperations.host.textContent?.includes("Operações de TI") === true &&
    englishSecurity.host.textContent?.includes("Indicadores de segurança de TI") === true)
  contains(englishOperations.host, "Operações de TI", "Registro de chamados · registros de origem", "Infrastructure", "Core network", "98.5")
  const emptyOperations = mount(projected("IT Operations", false), undefined, "br")
  const emptyOperationsLanguage = emptyOperations.languageContext.current
  if (!emptyOperationsLanguage) throw new Error("Missing empty operations LanguageProvider context")
  await emptyOperationsLanguage.ready.promise
  await until(() => emptyOperations.host.textContent?.includes("Não há registros de chamados neste ano.") === true)
  contains(emptyOperations.host, "Operações de TI", "Não há registros de chamados neste ano.")
  contains(englishSecurity.host, "Indicadores de segurança de TI", "Registros mensais · valores de origem", "Sem interação", "Ações de gestão")
  expect(SF_NATIVE_DASHBOARD_OPERATIONS_COPY_BR["sucafina.native.dashboard-operations.page.operations"]).toBe("Operações de TI")
  expect(SF_NATIVE_DASHBOARD_OPERATIONS_COPY_BR["sucafina.native.dashboard-operations.table.ticketRegister"]).toBe("Registro de chamados · registros de origem")
  expect(SF_NATIVE_DASHBOARD_OPERATIONS_COPY_BR["sucafina.native.dashboard-operations.column.noInteraction"]).toBe("Sem interação")
  expect(SF_NATIVE_DASHBOARD_OPERATIONS_COPY_BR["sucafina.native.dashboard-operations.detail.contractName"]).toBe("Nome do contrato")
})

