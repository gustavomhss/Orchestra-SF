import { afterEach, expect, test } from "bun:test"
import type { Sucafina } from "@orchestra/schema/sucafina"
import { createComponent, createSignal } from "solid-js"
import { render } from "solid-js/web"
import { solidDom } from "./solid-dom"

const { PlannerHeadcountView }: typeof import("../src/orchestra/chapters/sucafina/planner-headcount-view") = await import(
  solidDom("../src/orchestra/chapters/sucafina/planner-headcount-view", import.meta.dir)
)
const { domain } = await import("../../../modules/sucafina/Sucafinav1/runtime/planner")

const names = ["Headcount", "Entities & allocations", "FX rates"]
const unsafe = '<img src=x onerror="alert(1)">'
const actor = { id: "operator", name: "Operator", canWrite: true, roles: ["admin"], assigned: [], domains: [] }
const cleanups: (() => void)[] = []
afterEach(() => cleanups.splice(0).forEach((close) => close()))

// Construct a real planner domain projection, including calculated fields and role redaction.
function projected(page: string, filled = true, roles = ["admin"], options: { numericIds?: boolean; noVersions?: boolean; fte?: number } = {}): Sucafina.PageState {
  const leaderId = options.numericIds ? 7 : "leader-id"
  const directory = [{ id: String(leaderId), name: "Marta Silva" }]
  const view = domain.view({
    data: {
      versions: options.noVersions ? [] : [{
        id: options.numericIds ? 1 : "v1", name: "Plan Alpha", year: 2026, locked: false, closed: 0,
        lines: [], projects: [], fx: filled ? [{ id: options.numericIds ? 8 : "usd", cur: "USD", rate: 1 }, { id: options.numericIds ? 3 : "eur", cur: "EUR", rate: 1.25 }, { id: "chf", cur: "CHF", rate: null }] : [],
        lists: {},
        hc: {
          positions: filled ? [{ id: options.numericIds ? 4 : "p1", name: unsafe, title: "Analyst", type: "Employee", location: "Brazil", domain: "Applications", include: true, fte: options.fte ?? 0, start: 1, end: 12, rateId: options.numericIds ? 2 : "r1", rateOverride: 108000, src: "new" }] : [],
          rates: filled ? [{ id: options.numericIds ? 2 : "r1", name: "Specialist rate", annual: 120000, cur: "USD", locs: "Brazil" }] : [],
          inc: 0, incMonth: 1, hrAF: {}, leaderDomains: { [String(leaderId)]: "Applications" },
        },
      }, {
        id: "v2", name: "Plan Beta", year: 2026, locked: false, closed: 0,
        lines: [], projects: [], fx: [], lists: {}, hc: { positions: [], rates: [], inc: 0, incMonth: 1, hrAF: {} },
      }],
      roster: filled ? [{ name: "Ana Lima", leader: leaderId, status: "Active", type: "Employee", location: "Brazil" }] : [],
      entities: filled ? [{ id: options.numericIds ? 5 : "e1", name: "Geneva office", code: "GVA" }] : [],
      allocations: filled ? [{ id: options.numericIds ? 6 : "a1", name: "Direct spend", desc: "Core services" }] : [],
    }, versions: {}, sequences: {}, audit: [], notices: [],
  }, { ...actor, roles }, { at: "2026-11-13T12:00:00Z", id: () => "unused", directory })
  return {
    surface: "planner", page, pages: names, actor: { ...actor, roles }, year: 2026, month: 1,
    data: view.data as unknown as Sucafina.PageState["data"], versions: view.versions, directory,
  }
}

function mount(initial: Sucafina.PageState, initialQuery: Sucafina.PageQuery = { page: initial.page, version: "v1", year: "2026" }) {
  const [page, setPage] = createSignal(initial)
  const [query, setQuery] = createSignal(initialQuery)
  const calls: Sucafina.PageQuery[] = []
  const host = document.createElement("div")
  document.body.append(host)
  const dispose = render(() => createComponent(PlannerHeadcountView, {
    get page() { return page() },
    get query() { return query() },
    onQuery(value) { calls.push(value); setQuery(value) },
  }), host)
  cleanups.push(() => { dispose(); host.remove() })
  return { host, setPage, setQuery, calls }
}

function row(host: HTMLElement, marker: string) {
  const found = [...host.querySelectorAll("tr")].find((item) => item.textContent?.includes(marker))
  if (!found) throw new Error(`Missing row containing ${marker}`)
  return found.textContent ?? ""
}

test("Headcount displays projected position, domain, rate and zero FTE", () => {
  const view = mount(projected("Headcount"))
  expect(view.host.textContent).toContain("FTE in December")
  expect(view.host.textContent).toContain("Positions")
  expect(view.host.textContent).toContain("Rate cards")
  expect(row(view.host, unsafe)).toContain("Applications")
  expect(row(view.host, "Specialist rate")).toContain("USD")
  expect(row(view.host, "Specialist rate")).toMatch(/120[,\s]?000/)
  expect(row(view.host, "Marta Silva")).toContain("Applications")
  const fte = [...view.host.querySelectorAll("*")].find((node) => node.textContent?.trim() === "FTE in December")
  expect(fte?.nextElementSibling?.textContent?.trim()).toBe("0")
})

test("Entities & allocations displays actual list names, codes and descriptions", () => {
  const view = mount(projected("Entities & allocations"))
  expect(view.host.textContent).toContain("Entities")
  expect(view.host.textContent).toContain("Allocations")
  expect(row(view.host, "Geneva office")).toContain("GVA")
  expect(row(view.host, "Direct spend")).toContain("Core services")
  expect(view.host.textContent).not.toContain("Specialist rate")
})

test("FX rates shows currency values and leaves a null rate distinct", () => {
  const view = mount(projected("FX rates"))
  expect(view.host.textContent).toContain("Currency")
  expect(view.host.textContent).toContain("USD per 1 unit")
  const usd = [...view.host.querySelectorAll("tbody tr")].find((item) => item.cells[0]?.textContent?.trim() === "USD")
  expect(usd).toBeDefined()
  expect([...usd!.cells].map((cell) => cell.textContent?.trim())).toEqual(["USD", "1", "Available"])
  expect(row(view.host, "EUR")).toContain("1.25")
  const chf = [...view.host.querySelectorAll("tbody tr")].find((item) => item.cells[0]?.textContent?.trim() === "CHF")
  expect(chf).toBeDefined()
  expect(chf?.cells[1]?.textContent?.trim()).toBe("—")
  expect(chf?.cells[2]?.textContent?.trim()).toBe("No rate")
})

for (const page of names) {
  test(`${page} renders empty projected collections without example rows`, () => {
    const view = mount(projected(page, false))
    expect(view.host.textContent).not.toContain("Geneva office")
    expect(view.host.textContent).not.toContain("Direct spend")
    expect(view.host.textContent).not.toContain("Specialist rate")
    expect(view.host.textContent).not.toContain(unsafe)
    expect(view.host.textContent).not.toContain("EUR")
    expect(view.host.textContent).not.toContain("CHF")
    const renderedRows = [...view.host.querySelectorAll("tbody tr")]
    if (page === "FX rates") {
      expect(view.host.textContent).toContain("No FX rates yet")
      expect(renderedRows).toHaveLength(0)
    }
    if (page === "Headcount") {
      expect(view.host.textContent).toContain("No positions yet")
      expect(view.host.textContent).toContain("No rate cards yet")
      expect(renderedRows).toHaveLength(0)
      expect(view.host.textContent).toContain("No roster leaders yet")
      expect(view.host.textContent).not.toContain("Marta Silva")
    }
    if (page === "Entities & allocations") {
      expect(view.host.textContent).toContain("No entities yet")
      expect(view.host.textContent).toContain("No allocations yet")
      expect(renderedRows).toHaveLength(0)
    }
  })
}

test("untrusted position text is escaped and unrelated page or surface exposes no rows", () => {
  const view = mount(projected("Headcount"))
  expect(view.host.textContent).toContain(unsafe)
  expect(view.host.querySelector("img")).toBeNull()
  view.setPage(projected("Overview"))
  expect(view.host.textContent).not.toContain(unsafe)
  expect(view.host.textContent).not.toContain("Specialist rate")
  view.setPage({ ...projected("Headcount"), surface: "dashboard" })
  expect(view.host.textContent).not.toContain(unsafe)
  expect(view.host.textContent).not.toContain("Specialist rate")
})

test("replacement with a redacted view removes individual salary fields while keeping authorized domain totals", () => {
  const view = mount(projected("Headcount", true, ["admin"], { fte: 0.5 }))
  expect(view.host.textContent).toContain("Specialist rate")
  for (const role of ["budget owner", "viewer"]) {
    const restricted = projected("Headcount", true, [role], { fte: 0.5 })
    const version = (restricted.data.versions as Record<string, unknown>[])[0]!
    const hc = version.hc as Record<string, unknown>
    const position = (hc.positions as Record<string, unknown>[])[0]!
    const summary = version.summary as Record<string, unknown>
    expect(hc).not.toHaveProperty("rates")
    expect(position).not.toHaveProperty("rateId")
    expect(position).not.toHaveProperty("rateOverride")
    expect(position).not.toHaveProperty("months")
    expect(position).not.toHaveProperty("annualCost")
    expect(summary.hrTotal).toBe(54000)
    expect((summary.hr as Record<string, unknown>[]).find((item) => item.domain === "Applications")?.annual).toBe(54000)
    view.setPage(restricted)
    expect(view.host.textContent).not.toContain("Specialist rate")
    expect(view.host.textContent).not.toContain("Rate override")
    expect(view.host.textContent).not.toContain("FY cost USD")
    expect(view.host.textContent).toContain(unsafe)
    expect(view.host.querySelector("img")).toBeNull()
    const domainTable = view.host.querySelector('table[aria-label="HR Staff budget by domain"]')
    if (!domainTable) throw new Error("Missing authorized domain budget table")
    expect(row(domainTable, "Applications")).toMatch(/54[,\s]?000/)
  }
  view.setPage(projected("Headcount", false, ["budget owner"]))
  expect(view.host.textContent).not.toContain(unsafe)
  expect(view.host.textContent).not.toContain("Specialist rate")
})

test("removing the current page from authorized pages clears retained private data", () => {
  const current = projected("Headcount")
  const view = mount(current)
  expect(view.host.textContent).toContain(unsafe)
  expect(view.host.textContent).toContain("Specialist rate")
  view.setPage({ ...current, pages: [] })
  expect(view.host.textContent).not.toContain(unsafe)
  expect(view.host.textContent).not.toContain("Specialist rate")
})

test("version filter forwards the selected version while retaining unrelated query values", () => {
  const view = mount(projected("Headcount"), { page: "Headcount", version: "v1", year: "2026", q: "keep-search" })
  const label = [...view.host.querySelectorAll("label")].find((item) => item.querySelector("span")?.textContent?.trim() === "Budget version")
  const select = label?.querySelector("select")
  if (!select) throw new Error("Missing Version selector")
  expect([...select.options].map((option) => option.value)).toContain("v2")
  select.value = "v2"
  select.dispatchEvent(new Event("change", { bubbles: true }))
  expect(view.calls).toEqual([{ page: "Headcount", version: "v2", year: "2026", q: "keep-search" }])
})

test("numeric legacy identifiers resolve the selected version, rate and lists from the real projection", () => {
  const state = projected("Headcount", true, ["admin"], { numericIds: true })
  const version = (state.data.versions as Record<string, unknown>[])[0]!
  const hc = version.hc as Record<string, unknown>
  const position = (hc.positions as Record<string, unknown>[])[0]!
  expect(version.id).toBe("1")
  expect(position.id).toBe("4")
  expect(position.rateId).toBe("2")
  expect((hc.rates as Record<string, unknown>[])[0]?.id).toBe("2")
  const headcount = mount(state, { page: "Headcount", version: "1" })
  expect(row(headcount.host, unsafe)).toContain("Specialist rate")
  const lists = mount(projected("Entities & allocations", true, ["admin"], { numericIds: true }))
  expect(row(lists.host, "Geneva office")).toContain("GVA")
  expect(row(lists.host, "Direct spend")).toContain("Core services")
  const fx = mount(projected("FX rates", true, ["admin"], { numericIds: true }), { page: "FX rates", version: "1" })
  expect(row(fx.host, "EUR")).toContain("1.25")
  expect(row(headcount.host, "Marta Silva")).toContain("Applications")
})

for (const page of ["Headcount", "FX rates"]) {
  test(`${page} distinguishes a missing version projection from an empty version list`, () => {
    const view = mount(projected(page, false, ["admin"], { noVersions: true }), { page, year: "2026" })
    expect(view.host.textContent).toContain("No budget versions yet")
    expect(view.host.textContent).not.toContain("Budget version data unavailable")
    expect(view.host.textContent).not.toContain("No positions yet")
    expect([...view.host.querySelectorAll("tbody tr")]).toHaveLength(0)

    const complete = projected(page, false)
    const missingProjection = {
      ...complete,
      data: Object.fromEntries(Object.entries(complete.data).filter(([key]) => key !== "versions")) as Sucafina.PageState["data"],
    }
    const missing = mount(missingProjection, { page, year: "2026" })
    expect(missing.host.textContent).toContain("Budget version data unavailable")
    expect(missing.host.textContent).not.toContain("No budget versions yet")
    expect([...missing.host.querySelectorAll("tbody tr")]).toHaveLength(0)
  })

  test(`${page} does not substitute a different plan for an explicit missing version`, () => {
    const view = mount(projected(page), { page, version: "v1" })
    if (page === "Headcount") {
      expect(view.host.textContent).toContain(unsafe)
      expect(view.host.textContent).toContain("Specialist rate")
    }
    if (page === "FX rates") expect(view.host.textContent).toContain("EUR")
    view.setQuery({ page, version: "missing-plan" })
    expect(view.host.textContent).toContain("Selected budget version unavailable")
    expect(view.host.textContent).not.toContain(unsafe)
    expect(view.host.textContent).not.toContain("Specialist rate")
    expect(view.host.textContent).not.toContain("EUR")
    expect([...view.host.querySelectorAll("tbody tr")]).toHaveLength(0)
  })
}

test("null projected FTE displays an em dash while zero remains zero", () => {
  const state = structuredClone(projected("Headcount"))
  const version = (state.data.versions as Record<string, unknown>[])[0]!
  const summary = version.summary as Record<string, unknown>
  expect(summary.fte).toBe(0)
  const view = mount(state)
  const metric = () => [...view.host.querySelectorAll("dt")].find((item) => item.textContent?.trim() === "FTE in December")?.nextElementSibling?.textContent?.trim()
  expect(metric()).toBe("0")
  summary.fte = null
  view.setPage(structuredClone(state))
  expect(metric()).toBe("—")
})

test("FX rates displays the exact supplied USD rate from the projection", () => {
  const state = structuredClone(projected("FX rates"))
  const version = (state.data.versions as Record<string, unknown>[])[0]!
  const usd = (version.fx as Record<string, unknown>[]).find((item) => item.cur === "USD")
  if (!usd) throw new Error("Missing projected USD rate")
  usd.rate = 1.75
  const view = mount(state)
  const usdRow = [...view.host.querySelectorAll("tbody tr")].find((item) => item.cells[0]?.textContent?.trim() === "USD")
  expect(usdRow).toBeDefined()
  expect([...usdRow!.cells].map((cell) => cell.textContent?.trim())).toEqual(["USD", "1.75", "Available"])
})

test("restricted projections clear leader mapping reactively while retaining public HR aggregates", () => {
  const authorized = projected("Headcount", true, ["admin"], { fte: 0.5 })
  expect(authorized.data.headcountMappingVisible).toBe(true)
  const view = mount(authorized)
  expect(row(view.host, "Marta Silva")).toContain("Applications")
  for (const role of ["budget owner", "viewer"]) {
    const restricted = projected("Headcount", true, [role], { fte: 0.5 })
    expect(restricted.data.headcountMappingVisible).toBe(false)
    expect(restricted.data.roster).toEqual([expect.objectContaining({ name: "Ana Lima", leader: "leader-id" })])
    view.setPage(restricted)
    expect(view.host.textContent).not.toContain("Marta Silva")
    expect(view.host.querySelector('table[aria-label="Roster leader to domain mapping"]')).toBeNull()
    const domainTable = view.host.querySelector('table[aria-label="HR Staff budget by domain"]')
    if (!domainTable) throw new Error("Missing authorized domain budget table")
    expect(row(domainTable, "Applications")).toMatch(/54[,\s]?000/)
    const fte = [...view.host.querySelectorAll("dt")].find((item) => item.textContent?.trim() === "FTE in December")
    expect(fte?.nextElementSibling?.textContent?.trim()).toBe("0.5")
  }
})

test("a missing mapping flag hides roster leaders even when actual roster and mapping exist", () => {
  const state = projected("Headcount", true, ["admin"], { fte: 0.5 })
  expect(state.data.headcountMappingVisible).toBe(true)
  expect(state.data.roster).toEqual([expect.objectContaining({ name: "Ana Lima", leader: "leader-id" })])
  const version = (state.data.versions as Record<string, unknown>[])[0]!
  expect((version.hc as Record<string, unknown>).leaderDomains).toEqual({ "leader-id": "Applications" })
  const view = mount(state)
  expect(row(view.host, "Marta Silva")).toContain("Applications")
  view.setPage({ ...state, data: Object.fromEntries(Object.entries(state.data).filter(([key]) => key !== "headcountMappingVisible")) as Sucafina.PageState["data"] })
  expect(view.host.textContent).not.toContain("Marta Silva")
  expect(view.host.querySelector('table[aria-label="Roster leader to domain mapping"]')).toBeNull()
  const domainTable = view.host.querySelector('table[aria-label="HR Staff budget by domain"]')
  if (!domainTable) throw new Error("Missing authorized domain budget table")
  expect(row(domainTable, "Applications")).toMatch(/54[,\s]?000/)
})
