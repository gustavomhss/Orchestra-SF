import { afterEach, expect, test } from "bun:test"
import type { Sucafina } from "@orchestra/schema/sucafina"
import { createComponent, createSignal } from "solid-js"
import { render } from "solid-js/web"
import type { NativeViewProps } from "../src/orchestra/chapters/sucafina/view-contract"
import { createLocalePlatform } from "./native-locale-fixture"

const { solidDom } = await import("./solid-dom")
const { PlatformProvider }: typeof import("@/context/platform") = await import(solidDom("@/context/platform", import.meta.dir))
const { LanguageProvider, loadLocaleDict, useLanguage }: typeof import("@/context/language") = await import(solidDom("@/context/language", import.meta.dir))
const { DashboardBudgetView }: typeof import("../src/orchestra/chapters/sucafina/dashboard-budget-view") = await import(solidDom("../src/orchestra/chapters/sucafina/dashboard-budget-view", import.meta.dir))

const cleanup: (() => void)[] = []
afterEach(() => cleanup.splice(0).forEach((dispose) => dispose()))

// Explicit examples of the frozen server response; these numbers are not calculated from the raw rows below.
const summary2026 = {
  currentMonth: 4,
  opex: { budget: 1200, actual: 300, forecast: 850, variance: 350, actualBudgetPercent: 25 },
  capex: { budget: 1200, actual: 600, forecast: 1400, variance: -200, actualBudgetPercent: 50 },
  total: { budget: 2400, actual: 900, forecast: 2250, variance: 150, actualBudgetPercent: 37.5 },
  monthlyBudget: [200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200],
}
const summary2027 = {
  currentMonth: 9,
  opex: { budget: 3000, actual: 1500, forecast: 2500, variance: 500, actualBudgetPercent: 50 },
  capex: { budget: 4200, actual: 1050, forecast: 4700, variance: -500, actualBudgetPercent: 25 },
  total: { budget: 7200, actual: 2550, forecast: 7200, variance: 0, actualBudgetPercent: 35.41666666666667 },
  monthlyBudget: [600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600],
}
const zero = { budget: 0, actual: 0, forecast: 0, variance: 0, actualBudgetPercent: null }

function page(name = "Budget Overview", summary: unknown = { "2026": summary2026, "2027": summary2027 }): Sucafina.PageState {
  return {
    surface: "dashboard", page: name, pages: ["Executive Dashboard", "Budget Overview", "OPEX Detail", "CAPEX Projects"],
    actor: { id: "reader", name: "Reader", canWrite: false, roles: ["domain leader"], assigned: [], domains: [] },
    year: 2026, month: 3,
    data: {
      nativeBudgetSummaryByYear: summary,
      budgetCurrentMonth: { "2026": 3, "2027": 2 },
      revenueByYear: { "2026": 9876, "2027": 8765 },
      opexOwners: [{ id: "o", name: "Raw OPEX owner", budget: 999999 }],
      opexEntries: [{ id: "oe", ownerId: "o", year: 2026, month: 3, budget: 999999, actual: 888888, forecast: 777777 }],
      capexProjects: [{ id: "c", name: "Raw CAPEX project", budget: 666666 }],
      capexEntries: [{ id: "ce", projId: "c", year: 2026, month: 3, budget: 666666, actual: 555555, forecast: 444444 }],
      executiveMonths: { "2026:3": {}, "2027:3": {} },
    } as Sucafina.PageState["data"],
    versions: {}, directory: [],
  }
}

function mount(initialPage = page(), initialQuery: Sucafina.PageQuery = {}) {
  const [currentPage, setPage] = createSignal(initialPage)
  const [query, setQuery] = createSignal(initialQuery)
  const calls: Sucafina.PageQuery[] = []
  const host = document.createElement("div")
  document.body.append(host)
  const scope: { language?: ReturnType<typeof useLanguage> } = {}
  const props: NativeViewProps = {
    get page() { return currentPage() },
    get query() { return query() },
    onQuery(next) { calls.push(next); setQuery(next) },
  }
  const dispose = render(() => createComponent(PlatformProvider, {
    value: createLocalePlatform(),
    get children() { return createComponent(LanguageProvider, { locale: "en", get children() {
      scope.language = useLanguage()
      return createComponent(DashboardBudgetView, props)
    } }) },
  }), host)
  cleanup.push(() => { dispose(); host.remove() })
  if (!scope.language) throw new Error("Language provider did not initialize")
  return { host, setPage, calls, query, language: scope.language }
}

function summaryTable(host: HTMLElement) {
  const result = [...host.querySelectorAll("table")].find((table) => {
    const headers = [...table.querySelectorAll("thead th")].map((cell) => cell.textContent?.trim())
    return ["Budget", "Actual", "Forecast", "Variance"].every((name) => headers.includes(name)) &&
      headers.some((name) => /actuals?\s*\/\s*budget\s*%/i.test(name ?? "")) &&
      [...table.querySelectorAll("tbody tr")].some((row) => row.textContent?.includes("OPEX"))
  })
  if (!result) throw new Error("Missing annual category table")
  return result
}

function row(table: HTMLTableElement, name: string) {
  const result = [...table.querySelectorAll("tbody tr")].find((item) => item.querySelector("th, td")?.textContent?.trim() === name)
  if (!result) throw new Error(`Missing ${name} row`)
  return [...result.querySelectorAll("th, td")].map((cell) => cell.textContent?.trim() ?? "")
}

function monthlyTable(host: HTMLElement) {
  const result = [...host.querySelectorAll("table")].find((table) => {
    const headers = [...table.querySelectorAll("thead th")].map((cell) => cell.textContent?.trim())
    return headers.includes("Month") && headers.includes("Budget") && table.querySelectorAll("tbody tr").length === 12
  })
  if (!result) throw new Error("Missing twelve-month budget table")
  return result
}

// Named regions let missing-data checks target the summary itself, not unrelated warnings.
// Their exact accessible names are an integration detail for the lead to confirm.
function region(host: HTMLElement, name: RegExp) {
  const result = [...host.querySelectorAll<HTMLElement>('section[aria-label], [role="region"][aria-label], figure[aria-label]')]
    .find((item) => name.test(item.getAttribute("aria-label") ?? ""))
  if (!result) throw new Error(`Missing accessible region ${name}`)
  return result
}

function notice(host: HTMLElement, subject: RegExp) {
  const result = [...host.querySelectorAll("p, [role=\"status\"], [role=\"note\"]")]
    .find((item) => subject.test(item.textContent ?? "") && /unavailable|not available/i.test(item.textContent ?? ""))
  if (!result) throw new Error(`Missing specific unavailable notice for ${subject}`)
  return result
}

const annualRegion = (host: HTMLElement) => region(host, /(?:annual.*budget|budget.*annual|annual.*summary|budget summary|resumo orçamentário)/i)
const chartRegion = (host: HTMLElement) => region(host, /(?:monthly.*budget|budget.*monthly|orçamento mensal)/i)

function metric(host: HTMLElement, name: string) {
  const label = [...host.querySelectorAll("dt")].find((item) => item.textContent?.trim() === name)
  return label?.nextElementSibling?.textContent?.trim()
}

function progress(host: HTMLElement) {
  const value = host.querySelector<HTMLProgressElement>('progress, [role="progressbar"]')
  if (!value) throw new Error("Missing accessible utilization progress")
  return value
}

function changeYear(host: HTMLElement, next: string) {
  const control = [...host.querySelectorAll("label")].find((item) => item.querySelector("span")?.textContent?.trim() === "Year")?.querySelector("select")
  if (!control) throw new Error("Missing executive year selector")
  control.value = next
  control.dispatchEvent(new Event("change", { bubbles: true }))
}

async function until(check: () => boolean) {
  for (let attempt = 0; attempt < 200 && !check(); attempt++) await Bun.sleep(10)
  if (!check()) throw new Error("Timed out waiting for localized summary")
}

const money = (value: string) => new RegExp(`\\$\\s*${value}(?:\\.00)?`)

test("Budget Overview shows server annual category values, total cards, and unmodified raw records", () => {
  const view = mount()
  const table = summaryTable(view.host)
  expect(row(table, "OPEX").slice(1)).toEqual([expect.stringMatching(money("1,200")), expect.stringMatching(money("300")), expect.stringMatching(money("850")), expect.stringMatching(money("350")), "25%"])
  expect(row(table, "CAPEX").slice(1)).toEqual([expect.stringMatching(money("1,200")), expect.stringMatching(money("600")), expect.stringMatching(money("1,400")), expect.stringMatching(/-\s*\$\s*200|\$\s*-\s*200/), "50%"])
  const annual = annualRegion(view.host)
  expect(metric(annual, "Budget")).toMatch(money("2,400"))
  expect(metric(annual, "Actual")).toMatch(money("900"))
  expect(metric(annual, "Forecast")).toMatch(money("2,250"))
  expect(Number(progress(view.host).getAttribute("value") ?? progress(view.host).getAttribute("aria-valuenow"))).toBe(37.5)
  expect(view.host.textContent).toContain("Raw OPEX owner")
  expect(view.host.textContent).toContain("Raw CAPEX project")
  expect(metric(view.host, "Current month")).toBe("4")
  expect(metric(view.host, "Revenue")).toBe("9,876")
  expect(notice(view.host, /revenue[ -]+ratios?/i)).toBeTruthy()
})

test("Executive uses execYear independently and keeps unrelated query selections", () => {
  const initial = { execYear: "2026", executiveMonth: "3", opsMonth: "4", tab: "keep" }
  const view = mount(page("Executive Dashboard"), initial)
  expect(row(summaryTable(view.host), "OPEX").join(" ")).toMatch(money("1,200"))
  changeYear(view.host, "2027")
  expect(view.calls.at(-1)).toEqual({ ...initial, execYear: "2027" })
  expect(row(summaryTable(view.host), "OPEX").join(" ")).toMatch(money("3,000"))
  expect(monthlyTable(view.host).textContent).toMatch(money("600"))
  expect(notice(view.host, /cost[ -]+per[ -]+user/i)).toBeTruthy()
})

test("Budget Overview follows the projected page year while preserving query", () => {
  const view = mount(page(), { tab: "keep", executiveMonth: "6" })
  view.setPage((prior) => ({ ...prior, year: 2027 }))
  expect(row(summaryTable(view.host), "CAPEX").join(" ")).toMatch(money("4,200"))
  expect(metric(view.host, "Current month")).toBe("9")
  expect(metric(view.host, "Revenue")).toBe("8,765")
  expect(view.query()).toEqual({ tab: "keep", executiveMonth: "6" })
})

test("zero category and null percent stay distinct from unavailable", () => {
  const view = mount(page("Budget Overview", { "2026": { currentMonth: 4, opex: zero, capex: zero, total: zero, monthlyBudget: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] } }))
  const cells = row(summaryTable(view.host), "OPEX")
  expect(cells.slice(1, 5)).toEqual([expect.stringMatching(money("0")), expect.stringMatching(money("0")), expect.stringMatching(money("0")), expect.stringMatching(money("0"))])
  expect(cells[5]).toBe("—")
  const bar = progress(view.host)
  expect(bar.getAttribute("aria-label") || bar.getAttribute("aria-labelledby")).toBeTruthy()
  expect(Number(bar.getAttribute("value") ?? bar.getAttribute("aria-valuenow"))).toBe(0)
})

test("missing and malformed categories show unavailable instead of invented zeros", () => {
  const view = mount(page("Budget Overview", { "2026": { currentMonth: 4, opex: { ...summary2026.opex, forecast: "bad" }, capex: null } }))
  expect(row(summaryTable(view.host), "OPEX").join(" ").toLowerCase()).toContain("unavailable")
  expect(row(summaryTable(view.host), "CAPEX").join(" ").toLowerCase()).toContain("unavailable")
  expect(row(summaryTable(view.host), "OPEX").join(" ")).not.toMatch(money("0"))
  view.setPage(page("Budget Overview", { "2026": { currentMonth: 4, opex: { ...summary2026.opex, actual: Number.NaN } } }))
  expect(row(summaryTable(view.host), "OPEX").join(" ").toLowerCase()).toContain("unavailable")
  view.setPage(page("Budget Overview", {}))
  for (const label of ["Budget", "Actual", "Forecast"])
    expect(metric(annualRegion(view.host), label)?.toLowerCase()).toContain("unavailable")
  expect(chartRegion(view.host).textContent?.toLowerCase()).toContain("unavailable")
})

test("invalid summary and currentMonth fall back to stored month without deriving totals", () => {
  const view = mount(page("Budget Overview", { "2026": { currentMonth: 13, opex: { ...summary2026.opex, variance: null }, total: { ...summary2026.total, actualBudgetPercent: "45" }, monthlyBudget: null } }))
  expect(metric(view.host, "Current month")).toBe("3")
  expect(row(summaryTable(view.host), "OPEX").join(" ").toLowerCase()).toContain("unavailable")
  for (const label of ["Budget", "Actual", "Forecast"])
    expect(metric(annualRegion(view.host), label)?.toLowerCase()).toContain("unavailable")
  expect(chartRegion(view.host).textContent?.toLowerCase()).toContain("unavailable")
  expect(chartRegion(view.host).querySelector("svg")).toBeNull()
})

test("the provided twelve monthly values have an accessible responsive chart and matching table", () => {
  // Deliberately inconsistent with total/12: the UI must use the supplied series, not reconstruct it.
  const supplied = [111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122]
  const view = mount(page("Budget Overview", { "2026": { ...summary2026, monthlyBudget: supplied } }))
  const chart = chartRegion(view.host).querySelector("svg")
  expect(chart).not.toBeNull()
  expect(chart?.querySelector("title")?.textContent?.trim()).toBeTruthy()
  expect(chart?.querySelector("desc")?.textContent?.trim()).toBeTruthy()
  expect(chart?.getAttribute("viewBox")).toBeTruthy()
  expect(/^\d+(?:px)?$/.test(chart?.getAttribute("width") ?? "")).toBe(false)
  const rows = [...monthlyTable(chartRegion(view.host)).querySelectorAll("tbody tr")]
  expect(rows).toHaveLength(12)
  expect(rows.map((item) => item.querySelector("th, td")?.textContent?.trim())).toEqual(["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"])
  expect(rows.map((item) => item.querySelectorAll("th, td")[1]?.textContent?.trim()))
    .toEqual(supplied.map((value) => expect.stringMatching(new RegExp(`^\\$\\s*${value}(?:\\.00)?$`))))
})

test("nonfinite or wrong-length monthly series never renders an invented chart", () => {
  for (const monthlyBudget of [[1, 2], [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, "bad"], [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, Number.POSITIVE_INFINITY], null]) {
    const view = mount(page("Budget Overview", { "2026": { ...summary2026, monthlyBudget } }))
    expect(chartRegion(view.host).querySelector("svg")).toBeNull()
    expect(chartRegion(view.host).textContent?.toLowerCase()).toContain("unavailable")
    expect([...view.host.querySelectorAll("table")].some((table) => table.querySelectorAll("tbody tr").length === 12)).toBe(false)
  }
})

test("utilization clamps rendering while retaining the authoritative percentage text", () => {
  const view = mount(page("Budget Overview", { "2026": { ...summary2026, total: { ...summary2026.total, actualBudgetPercent: 175 } } }))
  const bar = progress(view.host)
  expect(bar.getAttribute("aria-label") || bar.getAttribute("aria-labelledby")).toBeTruthy()
  expect(Number(bar.getAttribute("max") ?? bar.getAttribute("aria-valuemax"))).toBe(100)
  expect(Number(bar.getAttribute("value") ?? bar.getAttribute("aria-valuenow"))).toBe(100)
  expect(view.host.textContent).toContain("175%")
  view.setPage(page("Budget Overview", { "2026": { ...summary2026, total: { ...summary2026.total, actualBudgetPercent: -10 } } }))
  expect(Number(progress(view.host).getAttribute("value") ?? progress(view.host).getAttribute("aria-valuenow"))).toBe(0)
  expect(view.host.textContent).toContain("-10%")
})

test("same mounted summary switches English and Brazilian Portuguese number formatting and back", async () => {
  await loadLocaleDict("en")
  await loadLocaleDict("br")
  const view = mount(page("Budget Overview", { "2026": { ...summary2026, capex: null } }))
  await view.language.ready.promise
  expect(row(summaryTable(view.host), "OPEX").join(" ")).toMatch(money("1,200"))
  expect(row(summaryTable(view.host), "CAPEX").join(" ").toLowerCase()).toContain("unavailable")
  expect(annualRegion(view.host).textContent).toContain("37.5%")
  view.language.setLocale("br")
  await until(() => annualRegion(view.host).textContent?.includes("37,5%") === true)
  const annual = annualRegion(view.host)
  expect(annual.textContent).toMatch(/\$\s*1\.200(?:,00)?/)
  expect(annual.textContent).toContain("37,5%")
  expect(annual.textContent).toContain("Orçamento")
  expect(annual.textContent).toContain("Realizado")
  expect(annual.textContent).toContain("Previsão")
  const capex = [...annual.querySelectorAll("tbody tr")].find((item) => item.querySelector("th, td")?.textContent?.trim() === "CAPEX")
  expect(capex?.textContent?.toLowerCase()).toMatch(/indisponível|não (?:está )?disponível/)
  expect(chartRegion(view.host).textContent?.toLowerCase()).toContain("janeiro")
  view.language.setLocale("en")
  await until(() => annualRegion(view.host).textContent?.includes("37.5%") === true)
  expect(row(summaryTable(view.host), "OPEX").join(" ")).toMatch(money("1,200"))
  expect(row(summaryTable(view.host), "CAPEX").join(" ").toLowerCase()).toContain("unavailable")
})

test("unauthorized page or surface never exposes projected annual data", () => {
  const denied = page()
  denied.pages = []
  const view = mount(denied)
  expect(view.host.textContent).toBe("")
  view.setPage({ ...page(), surface: "planner" })
  expect(view.host.textContent).toBe("")
})
