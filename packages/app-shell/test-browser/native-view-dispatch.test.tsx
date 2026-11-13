import { afterEach, expect, test } from "bun:test"
import type { Sucafina } from "@orchestra/schema/sucafina"
import { createComponent, createSignal } from "solid-js"
import { render } from "solid-js/web"
import type { NativeViewProps } from "../src/orchestra/chapters/sucafina/view-contract"
import { createLocalePlatform } from "./native-locale-fixture"

const { solidDom } = await import("./solid-dom")
const { PlatformProvider }: typeof import("@/context/platform") = await import(solidDom("@/context/platform", import.meta.dir))
const { LanguageProvider, useLanguage, loadLocaleDict }: typeof import("@/context/language") = await import(solidDom("@/context/language", import.meta.dir))
const { NativeViews }: typeof import("../src/orchestra/chapters/sucafina/native-views") = await import(
  solidDom("../src/orchestra/chapters/sucafina/native-views", import.meta.dir)
)

// Route membership is derived from the original navigation and seven source inventories.
const routes: { surface: Sucafina.Surface; page: string; group: string }[] = [
  { surface: "dashboard", page: "Executive Dashboard", group: "dashboard-budget" },
  { surface: "dashboard", page: "Budget Overview", group: "dashboard-budget" },
  { surface: "dashboard", page: "OPEX Detail", group: "dashboard-budget" },
  { surface: "dashboard", page: "CAPEX Projects", group: "dashboard-budget" },
  { surface: "dashboard", page: "Headcount Overview", group: "dashboard-people" },
  { surface: "dashboard", page: "Team Structure", group: "dashboard-people" },
  { surface: "dashboard", page: "Talent Review", group: "dashboard-people" },
  { surface: "dashboard", page: "Hot Topics & Actions", group: "dashboard-portfolio" },
  { surface: "dashboard", page: "Portfolio Dashboard", group: "dashboard-portfolio" },
  { surface: "dashboard", page: "All Projects", group: "dashboard-portfolio" },
  { surface: "dashboard", page: "IT Risks", group: "dashboard-portfolio" },
  { surface: "dashboard", page: "Stakeholder Management", group: "dashboard-portfolio" },
  { surface: "dashboard", page: "IT Performance Contract", group: "dashboard-portfolio" },
  { surface: "dashboard", page: "IT Operations", group: "dashboard-operations" },
  { surface: "dashboard", page: "IT Security KPIs", group: "dashboard-operations" },
  { surface: "dashboard", page: "Vendor Contracts", group: "dashboard-operations" },
  { surface: "planner", page: "Overview", group: "planner-lines" },
  { surface: "planner", page: "OPEX", group: "planner-lines" },
  { surface: "planner", page: "CAPEX", group: "planner-lines" },
  { surface: "planner", page: "Versions", group: "planner-lines" },
  { surface: "planner", page: "Headcount", group: "planner-headcount" },
  { surface: "planner", page: "Entities & allocations", group: "planner-headcount" },
  { surface: "planner", page: "FX rates", group: "planner-headcount" },
  { surface: "procurement", page: "Dashboard", group: "procurement-ui" },
  { surface: "procurement", page: "Requests", group: "procurement-ui" },
  { surface: "procurement", page: "My approvals", group: "procurement-ui" },
  { surface: "procurement", page: "Suppliers", group: "procurement-ui" },
  { surface: "procurement", page: "Settings", group: "procurement-ui" },
]

const cleanup: (() => void)[] = []
afterEach(() => cleanup.splice(0).forEach((dispose) => dispose()))

function pageState(route: (typeof routes)[number]): Sucafina.PageState {
  return {
    surface: route.surface,
    page: route.page,
    pages: [route.page],
    actor: { id: "routing-reader", name: "Routing reader", canWrite: false, roles: ["admin"], assigned: [], domains: [] },
    year: 2026,
    month: 1,
    data: {},
    versions: {},
    directory: [],
  }
}

async function mount(initial: Sucafina.PageState) {
  const [page, setPage] = createSignal(initial)
  const host = document.createElement("div")
  document.body.append(host)
  const props: NativeViewProps = {
    get page() { return page() },
    query: {},
    onQuery() {},
  }
  const context: { language?: ReturnType<typeof useLanguage> } = {}
  const dispose = render(() => createComponent(PlatformProvider, {
    value: createLocalePlatform(),
    get children() { return createComponent(LanguageProvider, { locale: "en", get children() {
      context.language = useLanguage()
      return createComponent(NativeViews, props)
    } }) },
  }), host)
  cleanup.push(() => { dispose(); host.remove() })
  if (!context.language) throw new Error("Language provider did not initialize")
  await context.language.ready.promise
  await loadLocaleDict("en")
  return { host, setPage, language: context.language }
}

function groups(host: HTMLElement) {
  return [...host.querySelectorAll("[data-sf-view-group]")].map((element) => element.getAttribute("data-sf-view-group"))
}

for (const route of routes) {
  test(`${route.surface}: ${route.page} renders exactly its inventory group`, async () => {
    const view = await mount(pageState(route))
    expect(groups(view.host)).toEqual([route.group])
  })

  test(`${route.surface}: ${route.page} rejects wrong surfaces and removed authorization`, async () => {
    const view = await mount(pageState(route))
    for (const surface of ["dashboard", "planner", "procurement"] as const) {
      if (surface === route.surface) continue
      view.setPage({ ...pageState(route), surface })
      expect(groups(view.host)).toEqual([])
    }
    view.setPage({ ...pageState(route), pages: [] })
    expect(groups(view.host)).toEqual([])
  })

  test(`${route.surface}: ${route.page} reacts to group changes and removal`, async () => {
    const view = await mount(pageState(route))
    expect(groups(view.host)).toEqual([route.group])
    const next = routes.find((candidate) => candidate.group !== route.group)!
    view.setPage(pageState(next))
    expect(groups(view.host)).toEqual([next.group])
    view.setPage((current) => ({ ...current, pages: [] }))
    expect(groups(view.host)).toEqual([])
  })
}

test("unknown authorized page renders no selected group on every surface", async () => {
  for (const surface of ["dashboard", "planner", "procurement"] as const) {
    const view = await mount({ ...pageState(routes[0]), surface, page: "Unknown page", pages: ["Unknown page"] })
    expect(groups(view.host)).toEqual([])
  }
})


test("same mounted planner group updates page and table headings on EN to BR to EN", async () => {
  const route = routes.find((item) => item.surface === "planner" && item.page === "Entities & allocations")!
  // One structurally empty record exposes static table headings without asserting business data.
  const view = await mount({ ...pageState(route), data: { entities: [{}] } })
  const title = () => view.host.querySelector("h1")?.textContent
  const columns = () => [...view.host.querySelectorAll("thead th")].map((item) => item.textContent?.trim())
  expect(title()).toBe("Entities & allocations")
  expect(columns()).toEqual(["Name", "Code"])

  await loadLocaleDict("br")
  view.language.setLocale("br")
  const deadline = Date.now() + 5000
  while (title() !== "Entidades e alocações" || view.language.t("sucafina.native.planner-headcount.lists.entityCode") !== "Código") {
    if (Date.now() > deadline) throw new Error(`Portuguese dictionary did not become ready: ${view.host.innerHTML}`)
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  expect(columns()).toEqual(["Nome", "Código"])

  view.language.setLocale("en")
  const englishDeadline = Date.now() + 5000
  while (title() !== "Entities & allocations" || view.language.t("sucafina.native.planner-headcount.lists.entityCode") !== "Code") {
    if (Date.now() > englishDeadline) throw new Error(`English dictionary did not become ready: ${view.host.innerHTML}`)
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  expect(columns()).toEqual(["Name", "Code"])
})
