import { afterEach, expect, test } from "bun:test"
import type { Sucafina } from "@orchestra/schema/sucafina"
import { createComponent, createSignal } from "solid-js"
import { render } from "solid-js/web"
import { DashboardOperations } from "../../../modules/sucafina/Sucafinav1/runtime/dashboard-operations.ts"
import { DashboardPortfolio } from "../../../modules/sucafina/Sucafinav1/runtime/dashboard-portfolio.ts"
import type { Snapshot } from "../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { solidDom } from "./solid-dom"

const { DashboardOperationsView }: typeof import("../src/orchestra/chapters/sucafina/dashboard-operations-view") =
  await import(solidDom("../src/orchestra/chapters/sucafina/dashboard-operations-view", import.meta.dir))

const pages = ["IT Operations", "IT Security KPIs", "Vendor Contracts"]
const actor = { id: "operator", name: "Operator", canWrite: true, roles: ["admin"], assigned: [], domains: [] }
const environment = { at: "2026-11-13T12:00:00Z", id: () => "unused", directory: [{ id: "owner-1", name: "Alex Owner" }] }
const hostile = '<img src=x onerror="alert(1)">'
const cleanups: (() => void)[] = []
afterEach(() => cleanups.splice(0).forEach((dispose) => dispose()))

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

function mount(initial: Sucafina.PageState, initialQuery?: Sucafina.PageQuery) {
  const [page, setPage] = createSignal(initial)
  const [query, setQuery] = createSignal<Sucafina.PageQuery>(initialQuery ?? { page: initial.page, year: "2026", opsYear: "2026", secYear: "2026", operationsMonth: "3", securityMonth: "3" })
  const calls: Sucafina.PageQuery[] = []
  const host = document.createElement("div")
  document.body.append(host)
  const dispose = render(() => createComponent(DashboardOperationsView, {
    get page() { return page() },
    get query() { return query() },
    onQuery(next) { calls.push(next); setQuery(next) },
  }), host)
  cleanups.push(() => { dispose(); host.remove() })
  return { host, setPage, calls }
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
  const april = [...ticket.querySelectorAll("tbody tr")].find((row) => row.cells[headers.indexOf("Month")]?.textContent?.trim() === "4" &&
    row.cells[headers.indexOf("Category")]?.textContent?.trim() === "Infrastructure" &&
    row.cells[headers.indexOf("Type")]?.textContent?.trim() === "Incidents" &&
    row.cells[headers.indexOf("Measure")]?.textContent?.trim() === "Open")
  expect(april).toBeDefined()
  expect(april?.cells[headers.indexOf("Value")]?.textContent?.trim()).toBe("13")
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
  const heatRows = [...heat.querySelectorAll("tbody tr")]
  const marchHeat = heatRows.find((row) => row.cells[heatHeaders.indexOf("Item")]?.textContent?.trim() === "Core network" &&
    row.cells[heatHeaders.indexOf("Month")]?.textContent?.trim() === "3")
  const aprilHeat = heatRows.find((row) => row.cells[heatHeaders.indexOf("Item")]?.textContent?.trim() === "Core network" &&
    row.cells[heatHeaders.indexOf("Month")]?.textContent?.trim() === "4")
  expect(marchHeat).toBeDefined()
  expect(aprilHeat).toBeDefined()
  if (!aprilHeat) throw new Error("Missing April heat-map source row")
  expect(aprilHeat.cells[heatHeaders.indexOf("P1")]?.textContent?.trim()).toBe("3")
  expect(aprilHeat.cells[heatHeaders.indexOf("P2")]?.textContent?.trim()).toBe("4")
  expect(aprilHeat.cells[heatHeaders.indexOf("Tickets")]?.textContent?.trim()).toBe("17")
  expect(aprilHeat.cells[heatHeaders.indexOf("Comments")]?.textContent?.trim()).toBe("April observation")
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
