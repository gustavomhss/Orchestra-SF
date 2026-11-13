import { afterEach, expect, test } from "bun:test"
import type { Sucafina } from "@orchestra/schema/sucafina"
import { createComponent, createSignal } from "solid-js"
import { render } from "solid-js/web"
import { solidDom } from "./solid-dom"

const { PlannerHeadcountView }: typeof import("../src/orchestra/chapters/sucafina/planner-headcount-view") = await import(
  solidDom("../src/orchestra/chapters/sucafina/planner-headcount-view", import.meta.dir)
)
const { PlatformProvider }: typeof import("@/context/platform") = await import(solidDom("@/context/platform", import.meta.dir))
const { LanguageProvider, useLanguage, loadLocaleDict }: typeof import("@/context/language") = await import(solidDom("@/context/language", import.meta.dir))
const { domain } = await import("../../../modules/sucafina/Sucafinav1/runtime/planner")
const { createLocalePlatform } = await import("./native-locale-fixture")

const names = ["Headcount", "Entities & allocations", "FX rates"]
const unsafe = '<img src=x onerror="alert(1)">'
const actor = { id: "operator", name: "Operator", canWrite: true, roles: ["admin"], assigned: [], domains: [] }
const cleanups: (() => void)[] = []
afterEach(() => cleanups.splice(0).forEach((close) => close()))

// Construct a real planner domain projection, including calculated fields and role redaction.
function projected(page: string, filled = true, roles = ["admin"], options: { numericIds?: boolean; noVersions?: boolean; fte?: number; usdRate?: number } = {}): Sucafina.PageState {
  const leaderId = options.numericIds ? 7 : "leader-id"
  const directory = [{ id: String(leaderId), name: "Marta Silva" }]
  const view = domain.view({
    data: {
      versions: options.noVersions ? [] : [{
        id: options.numericIds ? 1 : "v1", name: "Plan Alpha", year: 2026, locked: false, closed: 0,
        lines: [], projects: [], fx: filled ? [{ id: options.numericIds ? 8 : "usd", cur: "USD", rate: options.usdRate ?? 1 }, { id: options.numericIds ? 3 : "eur", cur: "EUR", rate: 1.25 }, { id: "chf", cur: "CHF", rate: null }] : [],
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

function projectedWithNullFte() {
  const state = projected("Headcount")
  const versions = state.data.versions as Record<string, unknown>[]
  const version = versions[0]!
  return {
    ...state,
    data: {
      ...state.data,
      versions: [{ ...version, summary: { ...(version.summary as Record<string, unknown>), fte: null } }, ...versions.slice(1)],
    } as Sucafina.PageState["data"],
  }
}

async function mount(initial: Sucafina.PageState, initialQuery: Sucafina.PageQuery = { page: initial.page, version: "v1", year: "2026" }, locale: "en" | "br" = "en") {
  const [page, setPage] = createSignal(initial)
  const [query, setQuery] = createSignal(initialQuery)
  const calls: Sucafina.PageQuery[] = []
  const host = document.createElement("div")
  const state: { language?: ReturnType<typeof useLanguage> } = {}
  document.body.append(host)
  const dispose = render(() => createComponent(PlatformProvider, {
    value: createLocalePlatform(),
    get children() { return createComponent(LanguageProvider, { locale, get children() {
      return createComponent(() => {
        state.language = useLanguage()
        return createComponent(PlannerHeadcountView, {
          get page() { return page() },
          get query() { return query() },
          onQuery(value) { calls.push(value); setQuery(value) },
        })
      })
    } }) },
  }), host)
  cleanups.push(() => { dispose(); host.remove() })
  if (!state.language) throw new Error("LanguageProvider did not create the locale context")
  if (state.language.ready.promise) await state.language.ready.promise
  await loadLocaleDict(locale)
  return { host, setPage, setQuery, calls, setLocale: (next: "en" | "br") => state.language?.setLocale(next) }
}

function row(host: HTMLElement, marker: string) {
  const found = [...host.querySelectorAll("tr")].find((item) => item.textContent?.includes(marker))
  if (!found) throw new Error(`Missing row containing ${marker}`)
  return found.textContent ?? ""
}

async function until(check: () => boolean, host: HTMLElement) {
  const deadline = Date.now() + 5000
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`timed out\n${host.innerHTML}`)
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

test("planner headcount copy and static table labels react to en-br-en locale changes", async () => {
  const view = await mount(projected("Headcount"))
  const englishTitle = view.host.querySelector("h1")
  const englishPositionRow = [...view.host.querySelectorAll('table[aria-label="Headcount positions"] tbody tr')].find((item) => item.textContent?.includes(unsafe))
  const englishRosterRow = [...view.host.querySelectorAll('table[aria-label="Roster leader to domain mapping"] tbody tr')].find((item) => item.textContent?.includes("Marta Silva"))
  const englishDomainRow = [...view.host.querySelectorAll<HTMLTableRowElement>('table[aria-label="HR Staff budget by domain"] tbody tr')].find((item) => item.textContent?.includes("Applications"))
  if (!englishTitle || !englishPositionRow || !englishRosterRow || !englishDomainRow) throw new Error("Missing English headcount DOM identity anchors")
  expect(englishTitle.textContent).toBe("Headcount")
  expect(view.host.querySelector(".mx-eyebrow")?.textContent).toBe("Planner")
  expect(view.host.querySelector(".mx-heading p")?.textContent).toBe("Review authorized positions, rate cards, and projected HR Staff data for the selected budget version.")
  expect(view.host.querySelector('[aria-label="Budget version selection"]')).not.toBeNull()
  expect(view.host.querySelector('[aria-label="Headcount summary"]')).not.toBeNull()
  expect(view.host.querySelector('[aria-label="HR Staff budget by domain"] h2')?.textContent).toBe("HR Staff budget by domain")
  expect(view.host.querySelector('[aria-label="HR Staff budget by domain"] thead')?.textContent).toBe("DomainBudget USD")
  expect(view.host.querySelector('[aria-label="Roster leader to domain mapping"] thead')?.textContent).toBe("Roster leaderDomain")
  expect(view.host.querySelector('[aria-label="Headcount positions"] thead')?.textContent).toContain("Rate card")
  expect(view.host.querySelector('select[aria-label="Budget version"]')).not.toBeNull()
  expect(view.host.querySelector('input[aria-label="Search name, title, location"]')).not.toBeNull()
  expect(view.host.querySelector('table[aria-label="Headcount positions"] thead')?.textContent).toContain("Domain")
  const assertOptions = (label: string) => {
    const select = view.host.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)
    if (!select) throw new Error(`Missing ${label} selector`)
    expect([...select.options].map((option) => [option.value, option.textContent?.trim()])).toEqual([
      ["v1", "Plan Alpha · FY2026"],
      ["v2", "Plan Beta · FY2026"],
    ])
  }
  assertOptions("Budget version")
  expect(englishPositionRow.textContent).toContain("Applications")
  expect(englishRosterRow.textContent).toContain("Applications")
  expect(englishDomainRow.cells[1]?.textContent?.trim()).toBe("$0.00")
  await loadLocaleDict("br")
  view.setLocale("br")
  await until(() => view.host.querySelector("h1")?.textContent === "Quadro de pessoal", view.host)
  expect(view.host.querySelector('select[aria-label="Versão do orçamento"]')).not.toBeNull()
  assertOptions("Versão do orçamento")
  expect(view.host.textContent).toContain("FTE em dezembro")
  expect(view.host.textContent).toContain("Orçamento da equipe de RH em USD")
  const portuguesePositionTable = view.host.querySelector('table[aria-label="Cargos do quadro de pessoal"]')
  const portugueseRosterTable = view.host.querySelector('table[aria-label="Mapeamento de líderes por área"]')
  const portugueseDomainTable = view.host.querySelector('table[aria-label="Orçamento da equipe de RH por área"]')
  expect(portuguesePositionTable?.querySelector("thead")?.textContent).toContain("Área")
  expect(portuguesePositionTable?.querySelector("tbody tr")).toBe(englishPositionRow)
  expect(portugueseRosterTable?.querySelector("tbody tr")).toBe(englishRosterRow)
  expect(portugueseDomainTable?.querySelector("tbody tr")).toBe(englishDomainRow)
  expect(englishPositionRow.textContent).toContain("Applications")
  expect(englishRosterRow.textContent).toContain("Marta Silva")
  expect(englishDomainRow.textContent).toContain("Applications")
  expect(englishDomainRow.cells[1]?.textContent?.trim()).toBe("$0.00")
  await loadLocaleDict("en")
  view.setLocale("en")
  await until(() => view.host.querySelector("h1")?.textContent === "Headcount", view.host)
  assertOptions("Budget version")
  expect(view.host.querySelector('table[aria-label="Roster leader to domain mapping"]')).not.toBeNull()
  expect(view.host.querySelector('table[aria-label="Headcount positions"] thead')?.textContent).toContain("Domain")
  expect(view.host.querySelector('table[aria-label="Headcount positions"] tbody tr')).toBe(englishPositionRow)
  expect(view.host.querySelector('table[aria-label="Roster leader to domain mapping"] tbody tr')).toBe(englishRosterRow)
  expect(view.host.querySelector('table[aria-label="HR Staff budget by domain"] tbody tr')).toBe(englishDomainRow)
  expect(englishPositionRow.textContent).toContain("Applications")
  expect(englishRosterRow.textContent).toContain("Marta Silva")
  expect(englishDomainRow.textContent).toContain("Applications")
  expect(englishDomainRow.cells[1]?.textContent?.trim()).toBe("$0.00")
})

test("Headcount displays projected position, domain, rate and zero FTE", async () => {
  const view = await mount(projected("Headcount"))
  expect(view.host.textContent).toContain("FTE in December")
  expect(view.host.textContent).toContain("Positions")
  expect(view.host.textContent).toContain("Rate cards")
  expect(row(view.host, unsafe)).toContain("Applications")
  expect(row(view.host, "Specialist rate")).toContain("USD")
  expect(row(view.host, "Specialist rate")).toMatch(/120[,\s]?000/)
  expect(row(view.host, "Marta Silva")).toContain("Applications")
  const fte = [...view.host.querySelectorAll("dt")].find((node) => node.textContent?.trim() === "FTE in December")
  expect(fte?.nextElementSibling?.textContent?.trim()).toBe("0")
})

test("Headcount renders a null FTE as unavailable instead of zero", async () => {
  const initial = projected("Headcount")
  const initialVersion = (initial.data.versions as Record<string, unknown>[])[0]!
  const initialSummary = initialVersion.summary as Record<string, unknown>
  const initialApplications = (initialSummary.hr as Record<string, unknown>[]).find((item) => item.domain === "Applications")
  expect(initialApplications?.annual).toBe(0)
  const view = await mount(initial)
  const fte = [...view.host.querySelectorAll("dt")].find((node) => node.textContent?.trim() === "FTE in December")
  expect(fte?.nextElementSibling?.textContent?.trim()).toBe("0")
  const mapping = view.host.querySelector('table[aria-label="Roster leader to domain mapping"] tbody tr')
  expect(mapping?.textContent).toContain("Marta Silva")
  const domainRow = view.host.querySelector<HTMLTableRowElement>('table[aria-label="HR Staff budget by domain"] tbody tr')
  expect(domainRow?.cells[0]?.textContent?.trim()).toBe("Applications")
  expect(domainRow?.cells[1]?.textContent?.trim()).toBe("$0.00")
  const nullFte = projectedWithNullFte()
  const nullFteVersion = (nullFte.data.versions as Record<string, unknown>[])[0]!
  const nullFteSummary = nullFteVersion.summary as Record<string, unknown>
  const nullFteApplications = (nullFteSummary.hr as Record<string, unknown>[]).find((item) => item.domain === "Applications")
  expect(nullFteApplications?.annual).toBe(0)
  view.setPage(nullFte)
  const updatedFte = [...view.host.querySelectorAll("dt")].find((node) => node.textContent?.trim() === "FTE in December")
  expect(updatedFte?.nextElementSibling?.textContent?.trim()).toBe("—")
  expect(view.host.querySelector('table[aria-label="Roster leader to domain mapping"] tbody tr')?.textContent).toContain("Marta Silva")
  const nullFteDomainRow = view.host.querySelector<HTMLTableRowElement>('table[aria-label="HR Staff budget by domain"] tbody tr')
  expect(nullFteDomainRow?.cells[0]?.textContent?.trim()).toBe("Applications")
  expect(nullFteDomainRow?.cells[1]?.textContent?.trim()).toBe("$0.00")
  expect(view.host.textContent).toContain("HR Staff budget USD")
  const domainTable = view.host.querySelector('table[aria-label="HR Staff budget by domain"]')
  if (!domainTable) throw new Error("Missing authorized domain budget table")
  expect(row(domainTable, "Applications")).toContain("$0.00")
  const authorized = projected("Headcount")
  const authorizedVersion = (authorized.data.versions as Record<string, unknown>[])[0]!
  const authorizedSummary = authorizedVersion.summary as Record<string, unknown>
  const authorizedApplications = (authorizedSummary.hr as Record<string, unknown>[]).find((item) => item.domain === "Applications")
  expect(authorizedApplications?.annual).toBe(0)
  const data = Object.fromEntries(Object.entries(authorized.data).filter(([key]) => key !== "headcountMappingVisible"))
  view.setPage({ ...authorized, data: data as Sucafina.PageState["data"] })
  expect(view.host.querySelector('table[aria-label="Roster leader to domain mapping"]')).toBeNull()
  expect(view.host.textContent).toContain("HR Staff budget USD")
  const retainedDomainTable = view.host.querySelector('table[aria-label="HR Staff budget by domain"]')
  if (!retainedDomainTable) throw new Error("Missing authorized domain budget table after visibility flag removal")
  const flaglessDomainRow = retainedDomainTable.querySelector<HTMLTableRowElement>("tbody tr")
  expect(flaglessDomainRow?.cells[0]?.textContent?.trim()).toBe("Applications")
  expect(flaglessDomainRow?.cells[1]?.textContent?.trim()).toBe("$0.00")
  expect(row(retainedDomainTable, "Applications")).toContain("$0.00")
})

test("Entities & allocations displays actual list names, codes and descriptions", async () => {
  const view = await mount(projected("Entities & allocations"))
  expect(view.host.textContent).toContain("Entities")
  expect(view.host.textContent).toContain("Allocations")
  expect(row(view.host, "Geneva office")).toContain("GVA")
  expect(row(view.host, "Direct spend")).toContain("Core services")
  expect(view.host.textContent).not.toContain("Specialist rate")
})

test("FX rates preserves the projected USD value and distinguishes a null rate", async () => {
  const view = await mount(projected("FX rates", true, ["admin"], { usdRate: 1.125 }))
  expect(view.host.textContent).toContain("Currency")
  expect(view.host.textContent).toContain("USD per 1 unit")
  const usd = [...view.host.querySelectorAll("tbody tr")].find((item) => item.cells[0]?.textContent?.trim() === "USD")
  expect(usd).toBeDefined()
  expect([...usd!.cells].map((cell) => cell.textContent?.trim())).toEqual(["USD", "1.125", "Available"])
  expect(row(view.host, "EUR")).toContain("1.25")
  const chf = [...view.host.querySelectorAll("tbody tr")].find((item) => item.cells[0]?.textContent?.trim() === "CHF")
  expect(chf).toBeDefined()
  expect(chf?.cells[1]?.textContent?.trim()).toBe("—")
  expect(chf?.cells[2]?.textContent?.trim()).toBe("No rate")
})

for (const page of names) {
  test(`${page} renders empty projected collections without example rows`, async () => {
    const view = await mount(projected(page, false))
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

test("untrusted position text is escaped and unrelated page or surface exposes no rows", async () => {
  const view = await mount(projected("Headcount"))
  expect(view.host.textContent).toContain(unsafe)
  expect(view.host.querySelector("img")).toBeNull()
  view.setPage(projected("Overview"))
  expect(view.host.textContent).not.toContain(unsafe)
  expect(view.host.textContent).not.toContain("Specialist rate")
  view.setPage({ ...projected("Headcount"), surface: "dashboard" })
  expect(view.host.textContent).not.toContain(unsafe)
  expect(view.host.textContent).not.toContain("Specialist rate")
})

test("replacement with a redacted view removes individual salary fields while keeping authorized domain totals", async () => {
  const view = await mount(projected("Headcount", true, ["admin"], { fte: 0.5 }))
  expect((view.host.textContent ?? "")).toContain("Marta Silva")
  expect(view.host.textContent).toContain("Specialist rate")
  for (const role of ["budget owner", "viewer"]) {
    const restricted = projected("Headcount", true, [role], { fte: 0.5 })
    const version = (restricted.data.versions as Record<string, unknown>[])[0]!
    const hc = version.hc as Record<string, unknown>
    const position = (hc.positions as Record<string, unknown>[])[0]!
    const summary = version.summary as Record<string, unknown>
    expect((restricted.data as Record<string, unknown>).headcountMappingVisible).toBe(false)
    expect(hc).not.toHaveProperty("rates")
    expect(position).not.toHaveProperty("rateId")
    expect(position).not.toHaveProperty("rateOverride")
    expect(position).not.toHaveProperty("months")
    expect(position).not.toHaveProperty("annualCost")
    expect(summary.hrTotal).toBe(54000)
    expect((summary.hr as Record<string, unknown>[]).find((item) => item.domain === "Applications")?.annual).toBe(54000)
    view.setPage(restricted)
    expect(view.host.querySelector('table[aria-label="Roster leader to domain mapping"]')).toBeNull()
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

test("roster leader mapping fails closed when the producer visibility flag is absent", async () => {
  const authorized = projected("Headcount")
  expect((authorized.data as Record<string, unknown>).headcountMappingVisible).toBe(true)
  const data = Object.fromEntries(Object.entries(authorized.data).filter(([key]) => key !== "headcountMappingVisible"))
  const view = await mount({ ...authorized, data: data as Sucafina.PageState["data"] })
  expect(view.host.querySelector('table[aria-label="Roster leader to domain mapping"]')).toBeNull()
  expect(view.host.textContent).not.toContain("Marta Silva")
})

test("removing the current page from authorized pages clears retained private data", async () => {
  const current = projected("Headcount")
  const view = await mount(current)
  expect(view.host.textContent).toContain(unsafe)
  expect(view.host.textContent).toContain("Specialist rate")
  view.setPage({ ...current, pages: [] })
  expect(view.host.textContent).not.toContain(unsafe)
  expect(view.host.textContent).not.toContain("Specialist rate")
})

test("version filter forwards the selected version while retaining unrelated query values", async () => {
  const view = await mount(projected("Headcount"), { page: "Headcount", version: "v1", year: "2026", q: "keep-search" })
  const select = view.host.querySelector<HTMLSelectElement>('select[aria-label="Budget version"]')
  if (!select) throw new Error("Missing Budget version selector")
  expect([...select.options].map((option) => option.value)).toContain("v2")
  select.value = "v2"
  select.dispatchEvent(new Event("change", { bubbles: true }))
  expect(view.calls).toEqual([{ page: "Headcount", version: "v2", year: "2026", q: "keep-search" }])
})

test("numeric legacy identifiers resolve the selected version, rate and lists from the real projection", async () => {
  const state = projected("Headcount", true, ["admin"], { numericIds: true })
  const version = (state.data.versions as Record<string, unknown>[])[0]!
  const hc = version.hc as Record<string, unknown>
  const position = (hc.positions as Record<string, unknown>[])[0]!
  expect(version.id).toBe("1")
  expect(position.id).toBe("4")
  expect(position.rateId).toBe("2")
  expect((hc.rates as Record<string, unknown>[])[0]?.id).toBe("2")
  const headcount = await mount(state, { page: "Headcount", version: "1" })
  expect(row(headcount.host, unsafe)).toContain("Specialist rate")
  const lists = await mount(projected("Entities & allocations", true, ["admin"], { numericIds: true }))
  expect(row(lists.host, "Geneva office")).toContain("GVA")
  expect(row(lists.host, "Direct spend")).toContain("Core services")
  const fx = await mount(projected("FX rates", true, ["admin"], { numericIds: true }), { page: "FX rates", version: "1" })
  expect(row(fx.host, "EUR")).toContain("1.25")
  expect(row(headcount.host, "Marta Silva")).toContain("Applications")
})

for (const page of ["Headcount", "FX rates"]) {
  test(`${page} distinguishes a missing version projection from an empty version list`, async () => {
    const view = await mount(projected(page, false, ["admin"], { noVersions: true }), { page, year: "2026" })
    expect(view.host.textContent).toContain("No budget versions yet")
    expect(view.host.textContent).not.toContain("Budget version data unavailable")
    expect(view.host.textContent).not.toContain("No positions yet")
    expect([...view.host.querySelectorAll("tbody tr")]).toHaveLength(0)

    const complete = projected(page, false)
    const missingProjection = {
      ...complete,
      data: Object.fromEntries(Object.entries(complete.data).filter(([key]) => key !== "versions")) as Sucafina.PageState["data"],
    }
    const missing = await mount(missingProjection, { page, year: "2026" })
    expect(missing.host.textContent).toContain("Budget version data unavailable")
    expect(missing.host.textContent).not.toContain("No budget versions yet")
    expect([...missing.host.querySelectorAll("tbody tr")]).toHaveLength(0)
  })

  test(`${page} does not substitute a different plan for an explicit missing version`, async () => {
    const view = await mount(projected(page), { page, version: "v1" })
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
