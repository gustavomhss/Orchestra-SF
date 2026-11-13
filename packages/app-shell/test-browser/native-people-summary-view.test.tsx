import { afterEach, expect, test } from "bun:test"
import type { Sucafina } from "@orchestra/schema/sucafina"
import type { Locale } from "@/context/language"
import { createComponent, createSignal } from "solid-js"
import { render } from "solid-js/web"
import { solidDom } from "./solid-dom"

const { DashboardPeopleView }: typeof import("../src/orchestra/chapters/sucafina/dashboard-people-view") =
  await import(solidDom("../src/orchestra/chapters/sucafina/dashboard-people-view", import.meta.dir))
const { LanguageProvider, loadLocaleDict, useLanguage }: typeof import("@/context/language") =
  await import(solidDom("@/context/language", import.meta.dir))
const { PlatformProvider }: typeof import("@/context/platform") = await import(solidDom("@/context/platform", import.meta.dir))
const { createLocalePlatform } = await import(solidDom("./native-locale-fixture", import.meta.dir))
const { SF_NATIVE_DASHBOARD_PEOPLE_COPY, SF_NATIVE_DASHBOARD_PEOPLE_COPY_BR }:
  typeof import("@/i18n/orchestra-chapters/sucafina-native-dashboard-people") =
  await import(solidDom("@/i18n/orchestra-chapters/sucafina-native-dashboard-people", import.meta.dir))

const cleanups: (() => void)[] = []
afterEach(() => cleanups.splice(0).forEach((dispose) => dispose()))
const hostile = '<img src=x onerror="alert(1)">'
const admin = { id: "reader", name: "Reader", canWrite: false, roles: ["admin"], assigned: [], domains: [] }
const labels = {
  active: /^(?:total )?active$/i,
  employees: /^employees$/i,
  contractors: /^contractors$/i,
  terminated: /^terminated$/i,
  departures: /^(?:ytd )?departures(?: this year| in \d{4})?$/i,
  itLeaders: /^it leaders$/i,
  averageTenureMonths: /^(?:average|avg) tenure(?: \(months\))?$/i,
  attritionPercent: /^attrition(?: rate)?(?: ytd)?$/i,
  staffRatio: /^(?:it )?staff ratio$/i,
  users: /^(?:total |reported )?(?:it )?users(?: served)?$/i,
  usersMonth: /^(?:it )?users month$|^month (?:for|of) (?:it )?users$/i,
  averageHeadcount: /^(?:average|avg) (?:headcount|hc)$/i,
  tenureCount: /^(?:members|people) with (?:a )?(?:valid )?start date$|^tenure count$/i,
  staffPercent: /^(?:it )?staff (?:percentage|percent)(?: \(%\))?$|^(?:it )?staff \/ (?:it )?users$/i,
  talent: /^talent$/i,
  solid: /^solid(?: contributors)?$/i,
  laggers: /^laggers?$/i,
}

// Literal wire values intentionally disagree with the raw records and with one another.
// Displaying them proves consumption of the supplied projection, not client aggregation.
function supplied() {
  return {
    active: 91, employees: 82, contractors: 9, terminated: 14, departures: 6, itLeaders: 8,
    averageTenureMonths: 9.4, attritionPercent: 17.3, staffRatio: 73, users: 6543, usersMonth: 4,
    averageHeadcount: 33.5, tenureCount: 23, staffPercent: 8.6, talent: 12, solid: 13, laggers: 14,
    leaders: [
      { id: "second", name: "Supplied second", domain: "Apps", location: "Brazil", active: 19, employees: 17, contractors: 2, averageTenureMonths: 3.4, talent: 5, solid: 6, laggers: 7 },
      { id: "first", name: "Supplied first", domain: "Ops", location: "Lisbon", active: 7, employees: 4, contractors: 3, averageTenureMonths: null, talent: 0, solid: 1, laggers: 2 },
    ],
    unassigned: { id: "", name: "", domain: "", location: "", active: 11, employees: 10, contractors: 1, averageTenureMonths: 2.6, talent: 3, solid: 4, laggers: 5 },
    leaderTotals: { active: 50, employees: 41, contractors: 9, talent: 24, solid: 25, laggers: 26 },
    departureDetails: [{ id: "z", name: "Projected departure Z", end: "2025-01-02" }, { id: "a", name: "Projected departure A", end: "2026-07-08" }],
  }
}

function page(summary: unknown = supplied()): Sucafina.PageState {
  return {
    surface: "dashboard", page: "Headcount Overview", pages: ["Headcount Overview", "Team Structure", "Talent Review"],
    actor: admin, year: 2026, month: 11,
    data: {
      nativeHeadcountSummaryByYear: { 2026: summary },
      members: [{ id: "raw", name: "Raw record survives", status: "Terminated", type: "Employee", cls: "Talent", notes: "PRIVATE-RAW-NOTE", outlook: "PRIVATE-RAW-OUTLOOK", end: "2026-12-31" }],
      leaders: [{ id: "raw-leader", name: "Raw leader" }],
      itUsersMonthly: [{ year: 2026, month: 11, users: 1 }],
    } as Sucafina.PageState["data"],
    versions: {}, directory: [],
  }
}

function mount(initial = page(), initialQuery: Sucafina.PageQuery = { year: "2026", tab: "keep-tab", q: "keep-query" }) {
  const [current, setPage] = createSignal(initial)
  const [query, setQuery] = createSignal(initialQuery)
  const calls: Sucafina.PageQuery[] = []
  const language: { current?: ReturnType<typeof useLanguage> } = {}
  const host = document.createElement("div")
  document.body.append(host)
  const dispose = render(() => createComponent(PlatformProvider, {
    value: createLocalePlatform(),
    get children() { return createComponent(LanguageProvider, {
      locale: "en",
      get children() {
        language.current = useLanguage()
        return createComponent(DashboardPeopleView, {
          get page() { return current() }, get query() { return query() },
          onQuery(next) { calls.push(next); setQuery(next) },
        })
      },
    }) },
  }), host)
  cleanups.push(() => { dispose(); host.remove() })
  return { host, setPage, setQuery, calls, language: () => language.current! }
}

function metric(host: HTMLElement, label: RegExp) {
  const key = [...host.querySelectorAll("dt, .metric-label, article.metric > span")]
    .find((element) => label.test(element.textContent?.trim() ?? ""))
  expect(key, `Missing labeled headcount metric ${label}`).toBeDefined()
  if (!key?.parentElement) throw new Error(`Missing metric ${label}`)
  const value = key.parentElement.querySelector("dd, .metric-value, strong")
  expect(value, `Missing metric value ${label}`).not.toBeNull()
  return value?.textContent?.trim() ?? ""
}

function number(host: HTMLElement, label: RegExp) {
  const text = metric(host, label)
  expect(text).toMatch(/\d/)
  return Number(text.replace(/^1\s*:\s*/, "").replaceAll(",", "").replace(/%$/, ""))
}

function tables(host: HTMLElement) {
  return [...host.querySelectorAll<HTMLElement>('table, [role="table"]')]
}

function leaderTable(host: HTMLElement) {
  const table = tables(host).find((table) => {
    const columns = [...table.querySelectorAll('th, [role="columnheader"]')].map((cell) => cell.textContent?.trim())
    return columns.includes("Employees") && columns.includes("Contractors") && columns.includes("Leader")
  })
  expect(table, "Missing accessible supplied leader summary table").toBeDefined()
  if (!table) throw new Error("Missing leader summary table")
  expect(table.getAttribute("aria-label") || table.getAttribute("aria-labelledby")).toBeTruthy()
  return table
}

function cells(table: HTMLElement, name: string) {
  const row = [...table.querySelectorAll('tr, [role="row"]')]
    .find((row) => [...row.querySelectorAll('td, [role="cell"]')].some((cell) => cell.textContent?.trim() === name))
  expect(row, `Missing supplied row ${name}`).toBeDefined()
  return [...(row?.querySelectorAll('td, [role="cell"]') ?? [])].map((cell) => cell.textContent?.trim() ?? "")
}

function column(table: HTMLElement, row: string, label: string) {
  const headers = [...table.querySelectorAll('th, [role="columnheader"]')].map((cell) => cell.textContent?.trim())
  const index = headers.indexOf(label)
  expect(index, `Missing leader column ${label}`).toBeGreaterThanOrEqual(0)
  return cells(table, row)[index]
}

async function locale(view: ReturnType<typeof mount>, selected: Locale, visible: string) {
  view.language().setLocale(selected)
  await view.language().ready.promise
  for (let attempt = 0; attempt < 200; attempt++) {
    if (view.language().locale() === selected && view.host.textContent?.includes(visible)) return
    await Bun.sleep(10)
  }
  expect(view.language().locale()).toBe(selected)
  expect(view.host.textContent).toContain(visible)
}

test("supplied headcount metrics and subtitles override contradictory raw records", () => {
  const view = mount()
  for (const [label, expected] of [
    [labels.active, 91], [labels.employees, 82], [labels.contractors, 9], [labels.terminated, 14], [labels.departures, 6],
    [labels.itLeaders, 8], [labels.averageTenureMonths, 9.4], [labels.attritionPercent, 17.3], [labels.staffRatio, 73],
    [labels.users, 6543], [labels.usersMonth, 4], [labels.averageHeadcount, 33.5], [labels.tenureCount, 23], [labels.staffPercent, 8.6],
    [labels.talent, 12], [labels.solid, 13], [labels.laggers, 14],
  ] as const) expect(number(view.host, label)).toBe(expected)
  expect(view.host.textContent).not.toContain("Headcount measures and leader aggregates are not included")
  expect(view.host.querySelector('[aria-label="Headcount people"]')?.textContent).toContain("Raw record survives")
  expect(view.host.textContent).not.toContain("PRIVATE-RAW-NOTE")
  expect(view.host.textContent).not.toContain("PRIVATE-RAW-OUTLOOK")
})

test("leader rows, separate unassigned and supplied TOTAL retain server order and values", () => {
  const table = leaderTable(mount().host)
  expect(cells(table, "Supplied second")).toEqual(["Supplied second", "Apps", "Brazil", "17", "2", "19", "3.4", "5", "6", "7"])
  expect(cells(table, "Supplied first")).toEqual(["Supplied first", "Ops", "Lisbon", "4", "3", "7", "—", "0", "1", "2"])
  expect(cells(table, "Unassigned")).toEqual(["Unassigned", "—", "—", "10", "1", "11", "2.6", "3", "4", "5"])
  expect(column(table, "Supplied second", "Domain")).toBe("Apps")
  expect(column(table, "Supplied second", "Location")).toBe("Brazil")
  expect(column(table, "Supplied second", "Employees")).toBe("17")
  expect(column(table, "Supplied second", "Contractors")).toBe("2")
  expect(cells(table, "Supplied second")).toContain("19")
  expect(cells(table, "Supplied second")).toContain("3.4")
  expect(cells(table, "Supplied first")).toContain("—")
  expect(column(table, "Unassigned", "Employees")).toBe("10")
  expect(column(table, "Unassigned", "Contractors")).toBe("1")
  expect(cells(table, "Unassigned")).toContain("11")
  expect(column(table, "TOTAL", "Employees")).toBe("41")
  expect(column(table, "TOTAL", "Contractors")).toBe("9")
  expect(cells(table, "TOTAL")).toContain("50")
  const rows = [...table.querySelectorAll('tr, [role="row"]')].map((row) => row.textContent ?? "")
  expect(rows.findIndex((row) => row.includes("Supplied second"))).toBeLessThan(rows.findIndex((row) => row.includes("Supplied first")))
  for (const [name, values] of [["Supplied second", ["5", "6", "7"]], ["Unassigned", ["3", "4", "5"]], ["TOTAL", ["24", "25", "26"]]] as const) {
    expect(column(table, name, "Talent")).toBe(values[0])
    expect(column(table, name, "Solid")).toBe(values[1])
    expect(column(table, name, "Lagger")).toBe(values[2])
  }
})

test("departure details use supplied rows without raw-member year filtering", () => {
  const host = mount().host
  const table = tables(host).find((table) => table.textContent?.includes("Projected departure Z"))
  expect(table).toBeDefined()
  if (!table) throw new Error("Missing departure detail table")
  expect(table.getAttribute("aria-label") || table.getAttribute("aria-labelledby")).toBeTruthy()
  expect(cells(table, "Projected departure Z")).toContain("2025-01-02")
  expect(cells(table, "Projected departure A")).toContain("2026-07-08")
  expect(table.textContent).not.toContain("Raw record survives")
  expect(table.textContent?.indexOf("Projected departure Z")).toBeLessThan(table.textContent?.indexOf("Projected departure A") ?? -1)
})

test("classification omission follows supplied fields even for admin with classified raw members", () => {
  const summary: Record<string, unknown> = supplied()
  for (const value of [summary, ...(summary.leaders as Record<string, unknown>[]), summary.unassigned, summary.leaderTotals] as Record<string, unknown>[]) {
    delete value.talent; delete value.solid; delete value.laggers
  }
  const host = mount(page(summary)).host
  expect(number(host, labels.active)).toBe(91)
  expect([...host.querySelectorAll('dt, .metric-label, article.metric > span, th, [role="columnheader"]')]
    .map((element) => element.textContent?.trim()).filter((text) => /^(?:talent(?: \(active\))?|solid(?: contributors)?|laggers?)$/i.test(text ?? ""))).toEqual([])
  expect(cells(leaderTable(host), "TOTAL")).toContain("50")
})

test("supplied classification is displayed without inferring permissions from actor roles", () => {
  const initial = page()
  const host = mount({ ...initial, actor: { ...initial.actor, roles: ["viewer"] } }).host
  expect(number(host, labels.talent)).toBe(12)
  expect(column(leaderTable(host), "TOTAL", "Talent")).toBe("24")
})

test("zero metrics remain visible while null tenure, ratio and percentage remain unavailable", () => {
  const summary = {
    active: 0, employees: 0, contractors: 0, terminated: 0, departures: 0, itLeaders: 0,
    averageTenureMonths: null, attritionPercent: 0, staffRatio: null, users: 0, usersMonth: 6,
    averageHeadcount: 0, tenureCount: 0, staffPercent: null, talent: 0, solid: 0, laggers: 0,
    leaders: [],
    unassigned: { id: "", name: "", domain: "", location: "", active: 0, employees: 0, contractors: 0, averageTenureMonths: null, talent: 0, solid: 0, laggers: 0 },
    leaderTotals: { active: 0, employees: 0, contractors: 0, talent: 0, solid: 0, laggers: 0 }, departureDetails: [],
  }
  const view = mount(page(summary))
  const host = view.host
  for (const label of [labels.active, labels.employees, labels.contractors, labels.terminated, labels.departures, labels.itLeaders, labels.attritionPercent, labels.users, labels.averageHeadcount, labels.tenureCount, labels.talent, labels.solid, labels.laggers]) expect(number(host, label)).toBe(0)
  for (const label of [labels.averageTenureMonths, labels.staffRatio, labels.staffPercent]) expect(metric(host, label)).toMatch(/^—$|unavailable/i)
  expect(column(leaderTable(host), "TOTAL", "Employees")).toBe("0")
  expect(host.textContent).not.toContain("Projected departure")
  expect([...host.querySelectorAll('[role="status"]')].some((status) => /no departures/i.test(status.textContent ?? ""))).toBe(true)
  view.setPage(page({ ...summary, users: 111, staffPercent: 0 }))
  expect(number(host, labels.staffPercent)).toBe(0)
  expect(metric(host, labels.staffRatio)).toMatch(/^—$|unavailable/i)
})

test("missing, malformed or missing-year summaries cannot become fabricated zero counts", () => {
  for (const map of [undefined, null, [], "bad", {}, { 2026: null }, { 2026: [] }, { 2026: "bad" }, { 2026: {} }]) {
    const initial = page()
    const data = { ...initial.data }
    if (map === undefined) delete data.nativeHeadcountSummaryByYear
    else data.nativeHeadcountSummaryByYear = map
    const host = mount({ ...initial, data }).host
    expect(host.querySelector('[aria-label="Headcount people"]')?.textContent).toContain("Raw record survives")
    expect([...host.querySelectorAll('[role="status"]')].some((status) => /(?:headcount|summary)/i.test(status.textContent ?? "") && /unavailable|not.*supplied/i.test(status.textContent ?? ""))).toBe(true)
    expect([...host.querySelectorAll('dt, .metric-label, article.metric > span')].some((label) => labels.active.test(label.textContent?.trim() ?? ""))).toBe(false)
  }
})

test("year changes remain reactive, preserve query fields and fall back to page year for invalid queries", () => {
  const initial = page()
  initial.data.nativeHeadcountSummaryByYear = { 2026: supplied(), 2025: { ...supplied(), active: 205, users: 5025, departureDetails: [] } }
  const view = mount(initial, { year: "invalid", tab: "keep-tab", q: "keep-query" })
  expect(number(view.host, labels.active)).toBe(91)
  const select = view.host.querySelector("label select") as HTMLSelectElement | null
  expect(select).not.toBeNull()
  if (!select) throw new Error("Missing year selector")
  select.value = "2025"
  select.dispatchEvent(new Event("change", { bubbles: true }))
  expect(view.calls).toEqual([{ year: "2025", tab: "keep-tab", q: "keep-query" }])
  expect(number(view.host, labels.active)).toBe(205)
  expect(number(view.host, labels.users)).toBe(5025)
  expect(view.host.textContent).not.toContain("Projected departure Z")
  view.setQuery({ year: "2026", tab: "keep-tab", q: "keep-query" })
  expect(view.host.querySelector("label select")).toBe(select)
  expect(number(view.host, labels.active)).toBe(91)
})

test("new copy comes from EN and BR catalog and switches language in the same mounted view", async () => {
  await loadLocaleDict("en")
  await loadLocaleDict("br")
  const view = mount()
  await view.language().ready.promise
  expect(number(view.host, labels.active)).toBe(91)
  const select = view.host.querySelector("label select")
  const en: Record<string, string> = SF_NATIVE_DASHBOARD_PEOPLE_COPY
  const br: Record<string, string> = SF_NATIVE_DASHBOARD_PEOPLE_COPY_BR
  const copy = [...view.host.querySelectorAll('dt, .metric-label, article.metric > span, h2, th, [role="columnheader"]')]
    .map((element) => element.textContent?.trim() ?? "").filter(Boolean)
  for (const label of copy) expect(Object.values(en)).toContain(label)
  const activeCopy = copy.find((label) => labels.active.test(label))
  expect(activeCopy).toBeDefined()
  const activeKey = Object.keys(en).find((key) => en[key] === activeCopy)
  if (!activeKey) throw new Error("Active metric needs catalog copy")
  expect(br[activeKey]).toBeTruthy()
  expect(br[activeKey]).not.toBe(en[activeKey])
  const provider = view.language()
  const unassignedKey = Object.keys(en).find((key) => en[key] === "Unassigned")
  const totalKey = Object.keys(en).find((key) => en[key] === "TOTAL")
  expect(unassignedKey).toBeDefined()
  expect(totalKey).toBeDefined()
  if (!unassignedKey || !totalKey) throw new Error("Summary row labels need catalog copy")
  expect(br[unassignedKey]).toBeTruthy()
  expect(br[totalKey]).toBeTruthy()
  expect(br[unassignedKey]).not.toBe(en[unassignedKey])
  expect(cells(leaderTable(view.host), en[unassignedKey]!)[0]).toBe(en[unassignedKey])
  expect(cells(leaderTable(view.host), en[totalKey]!)[0]).toBe(en[totalKey])
  await locale(view, "br", br[activeKey]!)
  expect(view.host.querySelector("label select")).toBe(select)
  for (const label of copy) {
    const key = Object.keys(en).find((key) => en[key] === label)
    expect(key).toBeDefined()
    if (key) expect(view.host.textContent).toContain(br[key]!)
  }
  expect(view.host.textContent).toContain("Supplied second")
  expect(view.host.textContent).toContain("Projected departure Z")
  const translatedTable = tables(view.host).find((table) => table.textContent?.includes("Supplied second"))
  expect(translatedTable).toBeDefined()
  if (!translatedTable) throw new Error("Missing translated leader table")
  expect(cells(translatedTable, br[unassignedKey]!)[0]).toBe(br[unassignedKey])
  expect(cells(translatedTable, br[unassignedKey]!)).toContain("11")
  expect(cells(translatedTable, br[totalKey]!)[0]).toBe(br[totalKey])
  expect(cells(translatedTable, br[totalKey]!)).toContain("50")
  expect(view.host.textContent).not.toContain("Unassigned")
  await locale(view, "en", activeCopy!)
  expect(number(view.host, labels.active)).toBe(91)
  expect(cells(leaderTable(view.host), "Unassigned")[0]).toBe(en[unassignedKey])
  expect(cells(leaderTable(view.host), "TOTAL")[0]).toBe(en[totalKey])

  const unavailable = page()
  delete unavailable.data.nativeHeadcountSummaryByYear
  view.setPage(unavailable)
  const unavailableStatus = [...view.host.querySelectorAll('[role="status"]')]
    .find((status) => /(?:headcount|summary)/i.test(status.textContent ?? "") && /unavailable|not.*supplied/i.test(status.textContent ?? ""))
  expect(unavailableStatus).toBeDefined()
  const unavailableText = unavailableStatus?.textContent?.trim()
  const unavailableKey = Object.keys(en).find((key) => en[key] === unavailableText)
  expect(unavailableKey).toBeDefined()
  if (!unavailableKey) throw new Error("Summary unavailable status needs catalog copy")
  expect(br[unavailableKey]).toBeTruthy()
  expect(br[unavailableKey]).not.toBe(en[unavailableKey])
  await locale(view, "br", br[unavailableKey]!)
  expect([...view.host.querySelectorAll('[role="status"]')].map((status) => status.textContent?.trim())).toContain(br[unavailableKey])
  expect(view.host.textContent).not.toContain(en[unavailableKey]!)
  expect(view.language()).toBe(provider)
  expect(view.host.querySelector("label select")).toBe(select)
  await locale(view, "en", en[unavailableKey]!)

  view.setPage(page({ ...supplied(), departureDetails: [] }))
  const emptyStatus = [...view.host.querySelectorAll('[role="status"]')]
    .find((status) => /no departures/i.test(status.textContent ?? ""))
  expect(emptyStatus).toBeDefined()
  const emptyText = emptyStatus?.textContent?.trim()
  const emptyKey = Object.keys(en).find((key) => en[key] === emptyText)
  expect(emptyKey).toBeDefined()
  if (!emptyKey) throw new Error("No-departures empty status needs catalog copy")
  expect(br[emptyKey]).toBeTruthy()
  expect(br[emptyKey]).not.toBe(en[emptyKey])
  await locale(view, "br", br[emptyKey]!)
  expect([...view.host.querySelectorAll('[role="status"]')].map((status) => status.textContent?.trim())).toContain(br[emptyKey])
  expect(view.host.textContent).not.toContain(en[emptyKey]!)
  expect(view.host.textContent).not.toContain("Projected departure Z")
  expect(view.language()).toBe(provider)
  expect(view.host.querySelector("label select")).toBe(select)
  await locale(view, "en", en[emptyKey]!)
  expect(number(view.host, labels.active)).toBe(91)
})

test("hostile supplied leader and departure strings render as text, with read-only native tables", () => {
  const summary = supplied()
  summary.leaders[0]!.name = hostile
  summary.leaders[0]!.domain = hostile
  summary.leaders[0]!.location = hostile
  summary.departureDetails[0]!.name = hostile
  summary.departureDetails[0]!.end = hostile
  const host = mount(page(summary)).host
  expect(leaderTable(host).textContent).toContain(hostile)
  expect(tables(host).filter((table) => table.textContent?.includes(hostile))).toHaveLength(2)
  expect(host.querySelector("img, script, iframe")).toBeNull()
  expect(host.querySelector("[onerror], [onclick]")).toBeNull()
  expect(host.querySelector("form[data-command], button[type=submit]")).toBeNull()
})

test("removing page authorization clears supplied summary and departure data", () => {
  const initial = page()
  const view = mount(initial)
  expect(number(view.host, labels.active)).toBe(91)
  expect(view.host.textContent).toContain("Projected departure Z")
  view.setPage({ ...initial, pages: [] })
  expect(view.host.textContent).toBe("")
})
