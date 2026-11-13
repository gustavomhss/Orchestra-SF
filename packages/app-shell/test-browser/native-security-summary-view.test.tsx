import { afterEach, expect, test } from "bun:test"
import type { Sucafina } from "@orchestra/schema/sucafina"
import { createComponent, createSignal } from "solid-js"
import { render } from "solid-js/web"
import { createLocalePlatform } from "./native-locale-fixture"
import { solidDom } from "./solid-dom"

const { DashboardOperationsView }: typeof import("../src/orchestra/chapters/sucafina/dashboard-operations-view") = await import(solidDom("../src/orchestra/chapters/sucafina/dashboard-operations-view", import.meta.dir))
const { PlatformProvider }: typeof import("@/context/platform") = await import(solidDom("@/context/platform", import.meta.dir))
const { LanguageProvider, useLanguage, loadLocaleDict }: typeof import("@/context/language") = await import(solidDom("@/context/language", import.meta.dir))

// Literal wire fixtures intentionally contradict both raw records and business thresholds.
const tiles = [
  { key: "training", value: 11, status: "Good" },
  { key: "patch", value: "22", status: "High risk" },
  { key: "patchEndpoint", value: 33, status: "Moderate" },
  { key: "patchServer", value: 44, status: "No data" },
  { key: "scan", value: null, status: "No data" },
  { key: "assessment", value: "0", status: "Good" },
  { key: "socPending", value: 0, status: "High risk" },
  { key: "socClosure", value: 0, status: "Good" },
]
const alternate = [
  { key: "training", value: 71, status: "Moderate" },
  { key: "patch", value: 72, status: "Good" },
  { key: "patchEndpoint", value: 73, status: "High risk" },
  { key: "patchServer", value: 74, status: "Good" },
  { key: "scan", value: 75, status: "Good" },
  { key: "assessment", value: 76, status: "Moderate" },
  { key: "socPending", value: 77, status: "Good" },
  { key: "socClosure", value: "0", status: "High risk" },
]
const labels = [
  [/^Training$/i, /^Treinamento$/i],
  [/^(?:Patch Gen\.|General patching)$/i, /^Correção geral$/i],
  [/^(?:Patch Endp\.|Endpoint patching)$/i, /^Correção de endpoints$/i],
  [/^(?:Patch Serv\.|Server patching)$/i, /^Correção de servidores$/i],
  [/^Scan$/i, /^Verificação$/i],
  [/^Assessment$/i, /^Avaliação$/i],
  [/^(?:SOC )?Pending$/i, /^(?:SOC )?Pendente$/i],
  [/^(?:SOC Closure|Closure \(source value\))$/i, /^(?:Encerramento do SOC|Encerramento \(valor de origem\))$/i],
] as const
const cleanups: (() => void)[] = []
afterEach(() => cleanups.splice(0).forEach((close) => close()))

function page(map: unknown = { "2026": { "3": { tiles } }, "2027": { "3": { tiles: alternate }, "4": { tiles } } }): Sucafina.PageState {
  return {
    surface: "dashboard", page: "IT Security KPIs", pages: ["IT Operations", "IT Security KPIs", "Vendor Contracts"],
    actor: { id: "security-reader", name: "Security Reader", canWrite: false, roles: ["viewer"], assigned: [], domains: [] },
    year: 2026, month: 3, versions: {}, directory: [],
    data: {
      nativeSecuritySummaryByYear: map,
      secKpi: [
        {
          year: 2026, month: 3,
          training: 999, assessment: 901, scan: 902, patch: 998, patchEndpoint: 903, patchServer: 904,
          socCritical: 905, socHigh: 906, socMedium: 907, socLow: 908, socPending: 99,
          socTP: 909, socFP: 910, socEPS: 911, socIPs: 912, socClosure: 88,
          notes: "Raw March observation",
        },
        { year: 2026, month: 2, training: 997, socClosure: 87, notes: "Raw February observation" },
        { year: 2027, month: 3, training: 996, notes: "Raw next-year observation" },
      ],
      secActions: [{ id: "action", text: "Retained management action", done: false }],
      secIncidents: [{ title: "Retained incident", date: "2026-03-01", impact: "Fixture impact" }],
      secPhishing: [{ name: "Retained campaign", targeted: 10, clicked: 1, departments: [] }],
    } as Sucafina.PageState["data"],
  }
}

function mount(initial = page(), initialQuery: Sucafina.PageQuery = { secYear: "2026", securityMonth: "3" }) {
  const [current, setPage] = createSignal(initial)
  const [query, setQuery] = createSignal(initialQuery)
  const calls: Sucafina.PageQuery[] = []
  const state: { language?: ReturnType<typeof useLanguage> } = {}
  const host = document.createElement("div")
  document.body.append(host)
  const dispose = render(() => createComponent(PlatformProvider, {
    value: createLocalePlatform(),
    get children() { return createComponent(LanguageProvider, { locale: "en", get children() {
      state.language = useLanguage()
      return createComponent(DashboardOperationsView, {
        get page() { return current() }, get query() { return query() },
        onQuery(next: Sucafina.PageQuery) { calls.push(next); setQuery(next) },
      })
    } }) },
  }), host)
  cleanups.push(() => { dispose(); host.remove() })
  if (!state.language) throw new Error("Missing real LanguageProvider")
  return { host, setPage, calls, query, language: state.language }
}

function summary(host: HTMLElement) {
  const result = [...host.querySelectorAll<HTMLElement>('section[aria-label], [role="region"][aria-label]')]
    .find((item) => /security.*summary|summary.*security|resumo.*segurança/i.test(item.getAttribute("aria-label") ?? ""))
  if (!result) throw new Error("Missing accessible security summary region")
  return result
}

function cards(host: HTMLElement) {
  return [...summary(host).querySelectorAll<HTMLElement>('article[aria-label], [role="group"][aria-label]')]
}

function card(host: HTMLElement, index: number, locale: "en" | "br" = "en") {
  const result = cards(host).find((item) => labels[index]![locale === "en" ? 0 : 1].test(item.getAttribute("aria-label") ?? ""))
  if (!result) throw new Error(`Missing accessible metric ${index} in ${locale}`)
  return result
}

function reading(host: HTMLElement, index: number, locale: "en" | "br" = "en") {
  const values = card(host, index, locale).querySelectorAll("output, dd, strong")
  if (values.length !== 1) throw new Error(`Expected one associated metric value for tile ${index}`)
  return values[0]!.textContent?.trim()
}

function rawTable(host: HTMLElement) {
  const section = [...host.querySelectorAll("section[aria-label]")].find((item) => item.getAttribute("aria-label") === "Monthly Entries · source values")
  const table = section?.querySelector("table")
  if (!table) throw new Error("Missing raw monthly table")
  return table
}

function select(host: HTMLElement, name: string, next: string) {
  const control = [...host.querySelectorAll("label")].find((item) => item.querySelector("span")?.textContent?.trim() === name)?.querySelector("select")
  if (!control || ![...control.options].some((option) => option.value === next)) throw new Error(`Missing ${name} option ${next}`)
  control.value = next
  control.dispatchEvent(new Event("change", { bubbles: true }))
}

async function until(check: () => boolean) {
  for (let attempt = 0; attempt < 200 && !check(); attempt++) await Bun.sleep(10)
  if (!check()) throw new Error("Timed out waiting for localized security cards")
}

test("eight ordered cards display the authoritative supplied values and statuses", () => {
  const view = mount()
  expect(cards(view.host)).toHaveLength(8)
  expect(cards(view.host).map((item, index) => labels[index]![0].test(item.getAttribute("aria-label") ?? ""))).toEqual([true, true, true, true, true, true, true, true])
  expect([0, 1, 2, 3, 5, 6, 7].map((index) => reading(view.host, index))).toEqual(["11", "22", "33", "44", "0", "0", "0"])
  for (const [index, tile] of tiles.entries()) expect(card(view.host, index).textContent).toContain(tile.status)
  expect(summary(view.host).textContent).not.toContain("999")
  expect(summary(view.host).textContent).not.toContain("99%")
  const authorized = page()
  view.setPage({ ...authorized, actor: { ...authorized.actor, roles: [] } })
  expect(cards(view.host)).toHaveLength(8)
  expect(reading(view.host, 0)).toBe("11")
})

test("numeric zero, string zero and null have distinct associated values", () => {
  const view = mount()
  expect(reading(view.host, 5)).toBe("0")
  expect(reading(view.host, 6)).toBe("0")
  expect(reading(view.host, 7)).toBe("0")
  expect(reading(view.host, 4)).toMatch(/^(?:—|No data|Unavailable)$/i)
  expect(card(view.host, 4).textContent).toContain("No data")
  expect(card(view.host, 6).textContent).toContain("High risk")
  expect(card(view.host, 7).textContent).toContain("Good")
})

test("existing security year and month controls select exactly that map period and preserve aliases", () => {
  const initial = { secYear: "2026", securityMonth: "3", year: "2024", opsYear: "2025", operationsMonth: "6", tab: "keep", q: "keep" }
  const view = mount(page(), initial)
  select(view.host, "Year", "2027")
  expect(view.calls[0]).toEqual({ ...initial, secYear: "2027" })
  expect(reading(view.host, 0)).toBe("71")
  expect(reading(view.host, 7)).toBe("0")
  expect(card(view.host, 7).textContent).toContain("High risk")
  select(view.host, "Month", "4")
  expect(view.calls[1]).toEqual({ ...initial, secYear: "2027", securityMonth: "4" })
  expect(reading(view.host, 0)).toBe("11")
  expect(view.query()).toEqual(view.calls[1])
})

test("invalid security period aliases use existing page year and month defaults", () => {
  const view = mount(page(), { secYear: "bad", securityMonth: "13", year: "2027", operationsMonth: "4" })
  expect(reading(view.host, 0)).toBe("11")
  expect(view.host.querySelectorAll("select")[0]?.value).toBe("2026")
  expect(view.host.querySelectorAll("select")[1]?.value).toBe("3")
})

test("absent map, year or period never falls back to raw or neighboring summaries", () => {
  for (const map of [undefined, null, {}, { "2027": { "3": { tiles: alternate } } }, { "2026": { "2": { tiles: alternate }, "4": { tiles } } }]) {
    const projected = page(map)
    if (map === undefined) delete projected.data.nativeSecuritySummaryByYear
    const view = mount(projected)
    expect(cards(view.host)).toHaveLength(0)
    expect(summary(view.host).textContent?.toLowerCase()).toMatch(/unavailable|not available/)
    expect(rawTable(view.host).textContent).toContain("999")
  }
})

test("malformed, missing and duplicate tiles reject the whole summary", () => {
  const malformed = [
    null, {}, new Array<unknown>(8), [], tiles.slice(0, 7), [...tiles, tiles[0]], [tiles[0], tiles[0], ...tiles.slice(2)],
    [{ ...tiles[0], key: "unknown" }, ...tiles.slice(1)],
    [{ ...tiles[0], status: "Unknown" }, ...tiles.slice(1)],
    [{ ...tiles[0], value: "" }, ...tiles.slice(1)],
    [{ ...tiles[0], value: "not numeric" }, ...tiles.slice(1)],
    [{ ...tiles[0], value: "Infinity" }, ...tiles.slice(1)],
    [{ ...tiles[0], value: "   " }, ...tiles.slice(1)],
    [{ ...tiles[0], value: Number.POSITIVE_INFINITY }, ...tiles.slice(1)],
    [{ ...tiles[0], value: false }, ...tiles.slice(1)],
    [null, ...tiles.slice(1)],
  ]
  for (const invalid of malformed) {
    const view = mount(page({ "2026": { "3": { tiles: invalid } } }))
    expect(cards(view.host)).toHaveLength(0)
    expect(summary(view.host).textContent?.toLowerCase()).toMatch(/unavailable|not available/)
  }
})

test("raw selected-month records and other security sections remain independent of cards", () => {
  const original = page()
  const view = mount(original)
  const table = rawTable(view.host)
  const headers = [...table.querySelectorAll("thead th")].map((item) => item.textContent?.trim())
  const rows = [...table.querySelectorAll("tbody tr")]
  expect(headers).toEqual([
    "Month", "Training", "Assessment", "Scan", "Patch Gen.", "Patch Endp.", "Patch Serv.",
    "SOC Critical", "SOC High", "SOC Medium", "SOC Low", "Pending", "True Pos.", "False Pos.",
    "SOC EPS", "SOC IPs", "Closure (source value)", "Notes",
  ])
  expect(rows).toHaveLength(1)
  expect([...rows[0]!.cells].map((cell) => cell.textContent?.trim())).toEqual([
    "3", "999", "901", "902", "998", "903", "904", "905", "906", "907", "908", "99",
    "909", "910", "911", "912", "88", "Raw March observation",
  ])
  expect(table.textContent).not.toContain("Raw February observation")
  expect(view.host.textContent).toContain("Retained management action")
  expect(view.host.textContent).toContain("Retained incident")
  expect(view.host.textContent).toContain("Retained campaign")
  view.setPage({ ...original, data: { ...original.data, secKpi: [{ year: 2026, month: 3, training: 123456, socClosure: 100 }] } })
  expect(reading(view.host, 0)).toBe("11")
  expect(reading(view.host, 7)).toBe("0")
  expect(rawTable(view.host).textContent).toContain("123456")
  expect(view.host.textContent).not.toContain("KPI status/targets, missing-versus-zero summaries, calculated SOC Closure")
  const missingRaw = { ...original, data: { ...original.data } }
  delete missingRaw.data.secKpi
  view.setPage(missingRaw)
  expect(cards(view.host)).toHaveLength(8)
  const unavailable = [...view.host.querySelectorAll("section[aria-label]")].find((item) => item.getAttribute("aria-label") === "Monthly Entries")
  expect(unavailable?.textContent).toContain("Projection unavailable.")
})

test("card labels and all supplied status tokens react EN BR EN in the same view", async () => {
  await loadLocaleDict("en")
  await loadLocaleDict("br")
  const view = mount()
  await view.language.ready.promise
  expect(card(view.host, 0).textContent).toContain("Good")
  view.language.setLocale("br")
  await until(() => cards(view.host).some((item) => item.getAttribute("aria-label") === "Treinamento"))
  expect(cards(view.host)).toHaveLength(8)
  for (const index of [0, 1, 2, 3, 4, 5, 6, 7]) expect(card(view.host, index, "br")).toBeDefined()
  expect(card(view.host, 0, "br").textContent?.toLowerCase()).toMatch(/bom|boa/)
  expect(card(view.host, 1, "br").textContent?.toLowerCase()).toMatch(/alto risco|risco alto/)
  expect(card(view.host, 2, "br").textContent?.toLowerCase()).toMatch(/moderad[oa]/)
  expect(card(view.host, 3, "br").textContent?.toLowerCase()).toContain("sem dados")
  expect(reading(view.host, 4, "br")?.toLowerCase()).toMatch(/^(?:—|sem dados|indisponível)$/)
  expect(reading(view.host, 6, "br")).toBe("0")
  expect(summary(view.host).textContent).not.toContain("High risk")
  view.setPage(page({}))
  expect(cards(view.host)).toHaveLength(0)
  expect(summary(view.host).textContent?.toLowerCase()).toMatch(/indisponível|não (?:está )?disponível/)
  view.setPage(page())
  expect(reading(view.host, 0, "br")).toBe("11")
  view.language.setLocale("en")
  await until(() => cards(view.host).some((item) => item.getAttribute("aria-label") === "Training"))
  expect(card(view.host, 1).textContent).toContain("High risk")
  expect(card(view.host, 2).textContent).toContain("Moderate")
  expect(card(view.host, 3).textContent).toContain("No data")
  expect(reading(view.host, 0)).toBe("11")
})

test("hostile tile strings cannot inject HTML or server-selected classes", () => {
  const hostile = '<img src=x onerror="alert(1)">'
  for (const field of ["key", "value", "status"]) {
    const view = mount(page({ "2026": { "3": { tiles: [{ ...tiles[0], [field]: hostile }, ...tiles.slice(1)] } } }))
    expect(cards(view.host)).toHaveLength(0)
    expect(summary(view.host).querySelector("img, script, [onerror]")).toBeNull()
    expect(summary(view.host).textContent?.toLowerCase()).toMatch(/unavailable|not available/)
  }
  const projected = page({ "2026": { "3": { tiles: tiles.map((tile) => ({ ...tile, label: hostile, class: "server-evil-status", style: "display:none" })) } } })
  projected.data.secKpi = [{ year: 2026, month: 3, notes: hostile }]
  const view = mount(projected)
  // Unknown decorative fields may be ignored or fail shape validation, but can never drive DOM attributes.
  if (cards(view.host).length === 8) expect(reading(view.host, 0)).toBe("11")
  if (cards(view.host).length !== 8) {
    expect(cards(view.host)).toHaveLength(0)
    expect(summary(view.host).textContent?.toLowerCase()).toMatch(/unavailable|not available/)
  }
  expect(view.host.querySelector("img, script, .server-evil-status, [onerror]")).toBeNull()
  const region = summary(view.host)
  for (const element of [region, ...region.querySelectorAll<HTMLElement>("*")]) {
    expect(element.getAttribute("style") ?? "").not.toMatch(/(?:^|;)\s*display\s*:\s*none(?:\s*!important)?\s*(?:;|$)/i)
    expect(element.style.getPropertyValue("display").trim().toLowerCase()).not.toBe("none")
  }
  expect(rawTable(view.host).textContent).toContain(hostile)
})

test("unrelated pages, surfaces and withdrawn authorization expose no previous cards", () => {
  const original = page()
  const view = mount(original)
  expect(cards(view.host)).toHaveLength(8)
  for (const next of [
    { ...original, page: "IT Operations" }, { ...original, page: "Vendor Contracts" },
    { ...original, page: "Other" }, { ...original, surface: "planner" as const }, { ...original, pages: [] },
  ]) {
    view.setPage(original)
    expect(cards(view.host)).toHaveLength(8)
    view.setPage(next)
    expect(view.host.querySelectorAll('article[aria-label], [role="group"][aria-label]')).toHaveLength(0)
    expect(view.host.textContent).not.toContain("High risk")
  }
})
