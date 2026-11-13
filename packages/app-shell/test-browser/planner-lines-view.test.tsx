import { afterEach, expect, test } from "bun:test"
import type { Sucafina } from "@orchestra/schema/sucafina"
import { createComponent, createSignal } from "solid-js"
import { render } from "solid-js/web"
import { domain } from "../../../modules/sucafina/Sucafinav1/runtime/planner.ts"
import type { Snapshot } from "../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { NativeViewProps } from "../src/orchestra/chapters/sucafina/view-contract"
import { createLocalePlatform } from "./native-locale-fixture"
import { solidDom } from "./solid-dom"

const { PlannerLinesView }: typeof import("../src/orchestra/chapters/sucafina/planner-lines-view") = await import(
  solidDom("../src/orchestra/chapters/sucafina/planner-lines-view", import.meta.dir)
)
const { PlatformProvider }: typeof import("@/context/platform") = await import(solidDom("@/context/platform", import.meta.dir))
const { LanguageProvider, useLanguage }: typeof import("@/context/language") = await import(
  solidDom("@/context/language", import.meta.dir)
)
const { SF_NATIVE_PLANNER_LINES_COPY, SF_NATIVE_PLANNER_LINES_COPY_BR }: typeof import(
  "../src/i18n/orchestra-chapters/sucafina-native-planner-lines"
) = await import(solidDom("../src/i18n/orchestra-chapters/sucafina-native-planner-lines", import.meta.dir))

const authorizedPages = ["Overview", "OPEX", "CAPEX", "Versions"]
const actor = { id: "budget-admin", name: "Nora Admin", canWrite: true, roles: ["admin"], assigned: [], domains: [] }
const restrictedActor = { id: "budget-owner", name: "Morgan Owner", canWrite: true, roles: ["budget owner"], assigned: [], domains: [] }
const directory = [
  { id: "person-1", name: "Morgan Lee" },
  { id: "person-2", name: "Ravi Costa" },
]
const environment = { at: "2026-11-13T12:00:00Z", id: () => "fixture-id", directory }
const unsafeDescription = '<img data-planner-probe="unsafe" src=x onerror="alert(1)"> imported note'
const cleanups: (() => void)[] = []

afterEach(() => cleanups.splice(0).forEach((close) => close()))

function sourceSnapshot(versions = [
  {
    id: "plan-2026",
    name: "FY 2026 Plan",
    year: 2026,
    locked: false,
    closed: 2,
    lines: [
      {
        id: "opex-services",
        sec: "opex",
        el: "services",
        name: "Analytics subscription",
        desc: unsafeDescription,
        owner: "person-1",
        entity: "entity-north",
        alloc: "allocation-ops",
        cur: "USD",
        annual: 300,
        b: [100, 200],
        a: [0, null],
        f: [null, null, 25],
      },
      {
        id: "capex-hardware",
        sec: "capex",
        el: "hwo",
        cls: "capex",
        proj: "project-hub",
        name: "Workstation deployment",
        desc: "Regional engineering equipment",
        owner: "person-2",
        entity: "entity-north",
        alloc: "allocation-capital",
        cur: "USD",
        annual: 600,
        b: [300, 300],
        a: [null, 30],
        f: [50],
      },
    ],
    projects: [
      {
        id: "project-hub",
        name: "Research Hub",
        code: "CPX-2026-001",
        owner: "person-2",
        desc: "Regional equipment program",
      },
    ],
    hc: { positions: [], rates: [], inc: 0, incMonth: 1, hrAF: {} },
    fx: [{ cur: "USD", rate: 1 }],
    lists: {},
  },
  {
    id: "prior-plan",
    name: "Prior Plan",
    year: 2025,
    locked: true,
    closed: 12,
    lines: [],
    projects: [],
    hc: { positions: [], rates: [], inc: 0, incMonth: 1, hrAF: {} },
    fx: [{ cur: "USD", rate: 1 }],
    lists: {},
  },
]): Snapshot {
  return {
    data: {
      versions,
      officials: {},
      entities: [{ id: "entity-north", name: "North Office" }],
      allocations: [
        { id: "allocation-ops", name: "Operations" },
        { id: "allocation-capital", name: "Capital" },
      ],
      roster: [],
    },
    versions: { "plan-2026:lines:opex-services": { version: 3, by: "person-1" } },
    sequences: {},
    audit: [],
    notices: [],
  }
}

function projected(versions?: Parameters<typeof sourceSnapshot>[0]) {
  return domain.view(sourceSnapshot(versions), actor, environment)
}

function page(pageName: string, view = projected(), pages = authorizedPages, pageActor = actor): Sucafina.PageState {
  return {
    surface: "planner",
    page: pageName,
    pages,
    actor: pageActor,
    year: 2026,
    month: 2,
    data: view.data as Sucafina.PageState["data"],
    versions: view.versions,
    directory: view.data.directory as Sucafina.PageState["directory"],
  }
}

function mount(props: NativeViewProps, locale: "en" | "br" = "en") {
  const [current, setCurrent] = createSignal(props)
  const scope: { language?: ReturnType<typeof useLanguage> } = {}
  const host = document.createElement("div")
  document.body.append(host)
  const dispose = render(
    () => createComponent(PlatformProvider, {
      value: createLocalePlatform(),
      get children() { return createComponent(LanguageProvider, {
        locale,
        get children() {
          scope.language = useLanguage()
          return createComponent(PlannerLinesView, {
            get page() { return current().page },
            get query() { return current().query },
            onQuery(query) { current().onQuery(query) },
          })
        },
      }) },
    }),
    host,
  )
  cleanups.push(() => { dispose(); host.remove() })
  return { host, set: setCurrent, language: scope.language! }
}

function props(pageState: Sucafina.PageState, query: Sucafina.PageQuery = {}, onQuery: NativeViewProps["onQuery"] = () => {}) {
  return { page: pageState, query, onQuery }
}

function select(host: HTMLElement, label: string) {
  const control = [...host.querySelectorAll("label")]
    .find((item) => item.querySelector("span")?.textContent === label)
    ?.querySelector("select")
  if (!control) throw new Error(`Missing ${label} select`)
  return control
}

function table(host: HTMLElement, tableName: string) {
  return [...host.querySelectorAll("table")].find((item) => item.getAttribute("aria-label") === tableName)
}

function row(host: HTMLElement, tableName: string, rowName: string) {
  const target = table(host, tableName)
  if (!target) throw new Error(`Missing ${tableName} table`)
  const found = [...target.querySelectorAll<HTMLTableRowElement>("tbody tr")].find((item) => item.textContent?.includes(rowName))
  if (!found) throw new Error(`Missing ${rowName} row in ${tableName}`)
  return found
}

async function until(predicate: () => boolean) {
  for (let attempt = 0; attempt < 200 && !predicate(); attempt++) await Bun.sleep(10)
  expect(predicate()).toBe(true)
}

test("Overview renders projected plan metrics, monthly totals, and version comparison values", () => {
  const view = projected()
  const screen = mount(props(page("Overview", view), { version: "plan-2026", filter: "prior-plan" }))
  const metrics = new Map([...screen.host.querySelectorAll("dl dt")].map((label) => [
    label.textContent?.trim(),
    label.nextElementSibling?.textContent?.trim(),
  ] as const))
  expect(metrics).toEqual(new Map([
    ["Total budget OPEX + CAPEX USD", "900"],
    ["Actual YTD", "30"],
    ["Full-year outlook", "55"],
    ["HR Staff", "0"],
    ["FTE December", "0"],
  ]))
  expect(screen.host.textContent).toContain("Fiscal year 2026 · Actuals closed through 2")
  expect([...row(screen.host, "Monthly budget actual and outlook", "Jan").cells].map((cell) => cell.textContent?.trim()))
    .toEqual(["Jan", "400", "0", "0"])
  expect([...row(screen.host, "Monthly budget actual and outlook", "Feb").cells].map((cell) => cell.textContent?.trim()))
    .toEqual(["Feb", "500", "30", "30"])
  expect([...row(screen.host, "Version comparison", "FY 2026 Plan").cells].map((cell) => cell.textContent?.trim()))
    .toEqual(["FY 2026 Plan", "900", "0"])
  expect([...row(screen.host, "Version comparison", "Prior Plan").cells].map((cell) => cell.textContent?.trim()))
    .toEqual(["Prior Plan", "0", "0"])
})

test("planner lines preserves English copy across an EN to pt-BR to EN provider transition", async () => {
  const screen = mount(props(page("CAPEX"), {
    version: "plan-2026",
    mode: "budget",
    owner: "person-2",
    class: "capex",
    q: "Workstation",
  }), "en")
  await screen.language.ready.promise
  expect(screen.language.locale()).toBe("en")
  expect(screen.host.querySelector("section")?.getAttribute("aria-label"))
    .toBe(SF_NATIVE_PLANNER_LINES_COPY["sucafina.native.planner-lines.section"].replace("{{page}}", "CAPEX"))
  expect(screen.host.textContent).toContain(SF_NATIVE_PLANNER_LINES_COPY["sucafina.native.planner-lines.projects"])
  expect(screen.host.textContent).toContain(SF_NATIVE_PLANNER_LINES_COPY["sucafina.native.planner-lines.field.search"])

  const grid = select(screen.host, "Grid")
  const owner = select(screen.host, "Owner")
  const classification = select(screen.host, "Classification")
  const search = screen.host.querySelector<HTMLInputElement>("input")!
  const capexTable = table(screen.host, "CAPEX lines")!
  const rowValues = () => {
    const line = [...capexTable.querySelectorAll<HTMLTableRowElement>("tbody tr")]
      .find((item) => item.textContent?.includes("Workstation deployment"))
    if (!line) throw new Error("Missing projected CAPEX row")
    return [...line.cells].map((cell) => cell.textContent?.trim())
  }
  const months = () => [...capexTable.querySelectorAll("thead th")]
    .map((cell) => cell.textContent?.trim()).slice(-12)
  const assertRetainedView = () => {
    expect(grid.value).toBe("budget")
    expect(owner.value).toBe("person-2")
    expect(classification.value).toBe("capex")
    expect(search.value).toBe("Workstation")
    expect(rowValues()).toEqual([
      "Hardware", "Workstation deployment", "Regional engineering equipment", "Ravi Costa",
      "North Office", "Capital", "Research Hub", "capex", "USD", "600", "300", "300",
      "—", "—", "—", "—", "—", "—", "—", "—", "—", "—",
    ])
  }
  expect(capexTable.getAttribute("aria-label")).toBe("CAPEX lines")
  expect([...grid.options].map((option) => option.textContent?.trim()))
    .toEqual(["Budget", "Actual", "Forecast", "Compare"])
  assertRetainedView()
  expect(months()).toEqual(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])

  screen.language.setLocale("br")
  await screen.language.ready.promise
  await until(() => screen.language.locale() === "br"
    && screen.language.t("sucafina.native.planner-lines.month.jan") === "jan."
    && screen.language.t("sucafina.native.planner-lines.mode.budget") === "Orçamento")
  expect(screen.host.querySelector("section")?.getAttribute("aria-label"))
    .toBe(SF_NATIVE_PLANNER_LINES_COPY_BR["sucafina.native.planner-lines.section"].replace("{{page}}", "CAPEX"))
  expect(capexTable.getAttribute("aria-label")).toBe("Linhas de CAPEX")
  expect(screen.host.textContent).toContain("Pesquisar")
  expect([...grid.options].map((option) => option.textContent?.trim()))
    .toEqual(["Orçamento", "Realizado", "Previsão", "Comparar"])
  expect([...owner.options].map((option) => option.textContent?.trim())[0]).toBe("Todos")
  expect([...classification.options].map((option) => option.textContent?.trim()))
    .toEqual(["Todas", "CAPEX", "OPEX"])
  assertRetainedView()
  expect(months()).toEqual(["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."])

  screen.language.setLocale("en")
  await until(() => screen.language.locale() === "en"
    && screen.language.t("sucafina.native.planner-lines.month.jan") === "Jan")
  expect(capexTable.getAttribute("aria-label")).toBe("CAPEX lines")
  expect([...grid.options].map((option) => option.textContent?.trim()))
    .toEqual(["Budget", "Actual", "Forecast", "Compare"])
  assertRetainedView()
  expect(months()).toEqual(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])
})

test("OPEX renders a populated projected line and actual zero distinctly from missing values", () => {
  const view = projected()
  const projectedVersion = (view.data.versions as Record<string, unknown>[]).find((item) => item.id === "plan-2026")!
  const projectedLine = (projectedVersion.lines as Record<string, unknown>[]).find((item) => item.id === "opex-services")!
  expect((projectedLine.a as unknown[]).slice(0, 2)).toEqual([0, null])

  const screen = mount(props(page("OPEX", view), { version: "plan-2026", mode: "actual" }))
  const line = row(screen.host, "OPEX lines", "Analytics subscription")
  expect([...table(screen.host, "OPEX lines")!.querySelectorAll("thead th")].map((cell) => cell.textContent?.trim()).slice(0, 9))
    .toEqual(["Element", "Line", "Description", "Owner", "Entity", "Allocation", "Currency", "Annual budget", "Jan"])
  expect([...line.cells].slice(0, 10).map((cell) => cell.textContent?.trim()))
    .toEqual(["Services", "Analytics subscription", unsafeDescription, "Morgan Lee", "North Office", "Operations", "USD", "300", "0", "—"])
  expect(line.querySelector("img[data-planner-probe='unsafe']")).toBeNull()
  expect(line.textContent).toContain(unsafeDescription)
  expect(screen.host.textContent).not.toContain("person-1")
  expect(screen.host.textContent).not.toContain("entity-north")
})

test("numeric legacy IDs and references resolve through the actual domain projection", () => {
  const snapshot = sourceSnapshot()
  const versions = snapshot.data.versions as Record<string, unknown>[]
  const version = versions[0]!
  version.id = 2026
  const lines = version.lines as Record<string, unknown>[]
  lines[0]!.owner = 1
  lines[0]!.entity = 9
  lines[0]!.alloc = 10
  lines[1]!.owner = 2
  lines[1]!.entity = 9
  lines[1]!.alloc = 11
  lines[1]!.proj = 12
  const projects = version.projects as Record<string, unknown>[]
  projects[0]!.id = 12
  projects[0]!.owner = 2
  snapshot.data.entities = [{ id: 9, name: "North Office" }]
  snapshot.data.allocations = [
    { id: 10, name: "Operations" },
    { id: 11, name: "Capital" },
  ]
  const numericDirectory = [{ id: "1", name: "Morgan Lee" }, { id: "2", name: "Ravi Costa" }]
  const view = domain.view(snapshot, actor, { ...environment, directory: numericDirectory })

  const screen = mount(props(page("CAPEX", view), { version: "2026", mode: "budget" }))
  expect([...row(screen.host, "Projects", "Research Hub").cells].map((cell) => cell.textContent?.trim()))
    .toEqual(["Research Hub", "CPX-2026-001", "Ravi Costa", "Regional equipment program"])
  expect([...row(screen.host, "CAPEX lines", "Workstation deployment").cells].slice(0, 7).map((cell) => cell.textContent?.trim()))
    .toEqual(["Hardware", "Workstation deployment", "Regional engineering equipment", "Ravi Costa", "North Office", "Capital", "Research Hub"])
})

test("restricted projection masks private HR fields while retaining authorized domain aggregates", () => {
  const snapshot = sourceSnapshot()
  const version = (snapshot.data.versions as Record<string, unknown>[])[0]!
  version.hc = {
    positions: [{
      id: "position-private",
      name: "People partner",
      type: "Employee",
      location: "Brazil",
      domain: "Applications",
      include: true,
      fte: 1,
      start: 1,
      end: 12,
      rateId: "rate-private",
      rateOverride: 120000,
    }],
    rates: [{ id: "rate-private", name: "Confidential rate", annual: 120000, cur: "USD", locs: "Brazil" }],
    inc: 5,
    incMonth: 1,
    hrAF: {},
  }
  const view = domain.view(snapshot, restrictedActor, environment)
  const projectedVersion = (view.data.versions as Record<string, unknown>[])[0]!
  const projectedHc = projectedVersion.hc as Record<string, unknown>
  const projectedPosition = (projectedHc.positions as Record<string, unknown>[])[0]!
  const summary = projectedVersion.summary as Record<string, unknown>
  const hrAggregates = summary.hr as Record<string, unknown>[]
  expect(projectedHc).not.toHaveProperty("rates")
  expect(projectedHc).not.toHaveProperty("inc")
  expect(projectedHc).not.toHaveProperty("incMonth")
  expect(projectedPosition).not.toHaveProperty("rateId")
  expect(projectedPosition).not.toHaveProperty("rateOverride")
  expect(projectedPosition).not.toHaveProperty("months")
  expect(summary.hrTotal).toBeGreaterThan(0)
  const domainAggregate = hrAggregates.find((item) => item.domain === "Applications")
  expect(domainAggregate?.annual).toBeGreaterThan(0)
  expect(summary.hrTotal).toBe(domainAggregate?.annual)

  const screen = mount(props(page("Overview", view, authorizedPages, restrictedActor)))
  expect(screen.host.textContent).toContain("HR Staff")
  expect(screen.host.textContent).not.toContain("Confidential rate")
})

test("unknown requested version is unavailable and does not fall back to another plan", () => {
  const view = projected()
  expect((view.data.versions as Record<string, unknown>[])[0]?.lines).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: "Analytics subscription" }),
  ]))
  const screen = mount(props(page("OPEX", view), { version: "unknown-plan", mode: "actual" }))
  expect(screen.host.textContent).toContain("No version. A plan can be created in Versions.")
  expect(table(screen.host, "OPEX lines")).toBeUndefined()
  expect(screen.host.textContent).not.toContain("Analytics subscription")
  expect(screen.host.textContent).not.toContain("Workstation deployment")
})

test("CAPEX renders a populated projected project and line with directory-resolved values", () => {
  const screen = mount(props(page("CAPEX"), { version: "plan-2026", mode: "budget" }))
  expect([...row(screen.host, "Projects", "Research Hub").cells].map((cell) => cell.textContent?.trim()))
    .toEqual(["Research Hub", "CPX-2026-001", "Ravi Costa", "Regional equipment program"])
  const line = row(screen.host, "CAPEX lines", "Workstation deployment")
  expect([...line.cells].slice(0, 11).map((cell) => cell.textContent?.trim()))
    .toEqual(["Hardware", "Workstation deployment", "Regional engineering equipment", "Ravi Costa", "North Office", "Capital", "Research Hub", "capex", "USD", "600", "300"])
  expect(screen.host.textContent).not.toContain("person-2")
  expect(screen.host.textContent).not.toContain("allocation-capital")
})

test("Versions renders only its frozen projected version and summary fields", () => {
  const screen = mount(props(page("Versions")))
  expect([...screen.host.querySelectorAll("table[aria-label='Budget versions'] thead th")]
    .map((cell) => cell.textContent?.trim()).filter((_, index) => [0, 1, 2, 5, 6].includes(index)))
    .toEqual(["Version", "Year", "Status", "Total budget USD", "FTE December"])
  expect([...row(screen.host, "Budget versions", "FY 2026 Plan").cells]
    .map((cell) => cell.textContent?.trim()).filter((_, index) => [0, 1, 2, 5, 6].includes(index)))
    .toEqual(["FY 2026 Plan", "2026", "Draft", "900", "0"])
  expect([...row(screen.host, "Budget versions", "Prior Plan").cells]
    .map((cell) => cell.textContent?.trim()).filter((_, index) => [0, 1, 2, 5, 6].includes(index)))
    .toEqual(["Prior Plan", "2025", "Locked", "0", "0"])
})

test("empty projected version, line, and project arrays render empty states without fabricated rows", () => {
  const noVersions = mount(props(page("Versions", projected([]))))
  expect(noVersions.host.textContent).toContain("No versions yet.")
  expect(noVersions.host.querySelectorAll("tbody tr")).toHaveLength(0)

  const emptyPlan = projected([{
    id: "empty-plan", name: "Empty Plan", year: 2026, locked: false, closed: 0,
    lines: [], projects: [], hc: { positions: [], rates: [], inc: 0, incMonth: 1, hrAF: {} }, fx: [], lists: {},
  }])
  const noOpex = mount(props(page("OPEX", emptyPlan), { version: "empty-plan" }))
  expect(noOpex.host.textContent).toContain("No lines match this view.")
  expect(table(noOpex.host, "OPEX lines")?.querySelectorAll("tbody tr") ?? []).toHaveLength(0)

  const noCapex = mount(props(page("CAPEX", emptyPlan), { version: "empty-plan" }))
  expect(noCapex.host.textContent).toContain("No projects yet.")
  expect(noCapex.host.textContent).toContain("No lines match this view.")
  expect(noCapex.host.querySelectorAll("tbody tr")).toHaveLength(0)
})

test("unrelated page and surface render no planner view data", () => {
  const projection = projected()
  for (const pageState of [
    page("Headcount", projection, [...authorizedPages, "Headcount"]),
    { ...page("OPEX", projection), surface: "dashboard" as const },
  ]) {
    const screen = mount(props(pageState, { version: "plan-2026" }))
    expect(screen.host.textContent).toBe("")
    expect(screen.host.querySelector("section")).toBeNull()
    expect(screen.host.textContent).not.toContain("Analytics subscription")
    expect(screen.host.textContent).not.toContain("Workstation deployment")
  }
})

test("removing the active page from current authorization clears retained private view data", () => {
  const activePage = page("OPEX")
  const screen = mount(props(activePage, { version: "plan-2026" }))
  expect(screen.host.textContent).toContain("Analytics subscription")
  screen.set((previous) => ({ ...previous, page: { ...activePage, pages: [] } }))
  expect(screen.host.textContent).toBe("")
  expect(screen.host.querySelector("section")).toBeNull()
  expect(screen.host.textContent).not.toContain("Analytics subscription")
  expect(screen.host.textContent).not.toContain(unsafeDescription)
})

test("Overview and grid filters forward query changes while retaining unrelated filters", () => {
  const overviewCalls: Sucafina.PageQuery[] = []
  const overviewQuery: Sucafina.PageQuery = {
    page: "Overview", version: "plan-2026", filter: "prior-plan", year: "2026", month: "2", owner: "person-1", q: "retained",
  }
  const overview = mount(props(page("Overview"), overviewQuery, (query) => overviewCalls.push(query)))
  select(overview.host, "Plan").value = "prior-plan"
  select(overview.host, "Plan").dispatchEvent(new Event("change", { bubbles: true }))
  expect(overviewCalls.at(-1)).toEqual({ ...overviewQuery, version: "prior-plan" })
  select(overview.host, "Compare budget").value = ""
  select(overview.host, "Compare budget").dispatchEvent(new Event("change", { bubbles: true }))
  expect(overviewCalls.at(-1)).toEqual({ ...overviewQuery, filter: "" })

  const opexCalls: Sucafina.PageQuery[] = []
  const opexQuery: Sucafina.PageQuery = {
    page: "OPEX", version: "plan-2026", mode: "budget", owner: "person-1", class: "capex", q: "retained", risk: "high",
  }
  const opex = mount(props(page("OPEX"), opexQuery, (query) => opexCalls.push(query)))
  select(opex.host, "Grid").value = "actual"
  select(opex.host, "Grid").dispatchEvent(new Event("change", { bubbles: true }))
  expect(opexCalls.at(-1)).toEqual({ ...opexQuery, mode: "actual" })

  const capexCalls: Sucafina.PageQuery[] = []
  const capexQuery: Sucafina.PageQuery = {
    page: "CAPEX", version: "plan-2026", mode: "budget", owner: "person-1", class: "capex", q: "work", filter: "prior-plan", status: "draft",
  }
  const capex = mount(props(page("CAPEX"), capexQuery, (query) => capexCalls.push(query)))
  select(capex.host, "Grid").value = "forecast"
  select(capex.host, "Grid").dispatchEvent(new Event("change", { bubbles: true }))
  select(capex.host, "Owner").value = "person-2"
  select(capex.host, "Owner").dispatchEvent(new Event("change", { bubbles: true }))
  select(capex.host, "Classification").value = "opex"
  select(capex.host, "Classification").dispatchEvent(new Event("change", { bubbles: true }))
  const search = capex.host.querySelector<HTMLInputElement>("input")
  if (!search) throw new Error("Missing Search input")
  search.value = "regional"
  search.dispatchEvent(new Event("input", { bubbles: true }))
  expect(capexCalls).toEqual([
    { ...capexQuery, mode: "forecast" },
    { ...capexQuery, owner: "person-2" },
    { ...capexQuery, class: "opex" },
    { ...capexQuery, q: "regional" },
  ])
})
