import { afterEach, expect, test } from "bun:test"
import type { Sucafina } from "@orchestra/schema/sucafina"
import { createComponent, createSignal } from "solid-js"
import { render } from "solid-js/web"
import { SF_NATIVE_DASHBOARD_PORTFOLIO_COPY } from "../src/i18n/orchestra-chapters/sucafina-native-dashboard-portfolio"
import { createLocalePlatform } from "./native-locale-fixture"
import { DashboardPeople } from "../../../modules/sucafina/Sucafinav1/runtime/dashboard-people.ts"
import { DashboardPortfolio } from "../../../modules/sucafina/Sucafinav1/runtime/dashboard-portfolio.ts"
import type { Actor, Environment, Snapshot } from "../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { dashboardPages } from "../../../modules/sucafina/Sucafinav1/src/nav.ts"
import { solidDom } from "./solid-dom"

const { DashboardPortfolioView }: typeof import("../src/orchestra/chapters/sucafina/dashboard-portfolio-view") =
  await import(solidDom("../src/orchestra/chapters/sucafina/dashboard-portfolio-view", import.meta.dir))
const { PlatformProvider }: typeof import("@/context/platform") = await import(solidDom("@/context/platform", import.meta.dir))
const { LanguageProvider, useLanguage }: typeof import("@/context/language") = await import(solidDom("@/context/language", import.meta.dir))

const viewNames = ["Hot Topics & Actions", "Portfolio Dashboard", "All Projects", "IT Risks", "Stakeholder Management", "IT Performance Contract"]
const admin: Actor = { id: "admin", name: "Admin", canWrite: true, roles: ["admin"], assigned: [], domains: [] }
const environment: Environment = { at: "2026-06-01T00:00:00Z", id: () => "unused", directory: [{ id: "leader-1", name: "Ada Directory Entry" }] }
const closes: (() => void)[] = []
afterEach(() => closes.splice(0).forEach((close) => close()))

function snapshot(data: Record<string, unknown>, versions: Snapshot["versions"] = {}): Snapshot {
  return { data, versions, sequences: {}, audit: [], notices: [] }
}

function page(name: string, state: Snapshot, actor: Actor = admin): Sucafina.PageState {
  const people = DashboardPeople.domain.view(state, actor, environment)
  const portfolio = DashboardPortfolio.domain.view(state, actor, environment)
  const summaries = Array.isArray(state.data.summaries) ? state.data.summaries.filter((item): item is string => typeof item === "string") : []
  return {
    surface: "dashboard", page: name, pages: dashboardPages(actor, summaries), actor,
    year: 2026, month: 6,
    data: { ...people.data, ...portfolio.data } as Sucafina.PageState["data"],
    versions: { ...people.versions, ...portfolio.versions }, directory: environment.directory,
  }
}

function mount(initial: Sucafina.PageState, initialQuery: Sucafina.PageQuery = { page: initial.page, year: "2026" }, locale: "en" | "br" = "en") {
  const [current, setPage] = createSignal(initial)
  const [query, setQuery] = createSignal(initialQuery)
  const changes: Sucafina.PageQuery[] = []
  const scope: { language?: ReturnType<typeof useLanguage> } = {}
  const host = document.createElement("div")
  document.body.append(host)
  const dispose = render(() => createComponent(PlatformProvider, {
    value: createLocalePlatform(),
    get children() { return createComponent(LanguageProvider, { locale, get children() {
      return createComponent(() => {
        scope.language = useLanguage()
        return createComponent(DashboardPortfolioView, {
          get page() { return current() },
          get query() { return query() },
          onQuery(next) { changes.push(next); setQuery(next) },
        })
      }, {})
    } }) },
  }), host)
  closes.push(() => { dispose(); host.remove() })
  return { host, setPage, changes, language: scope.language! }
}

const project = {
  id: 713, name: "Atlas rollout", status: "In Progress", risk: "High", priority: "Urgent",
  pm: "Ada Manager", leaderId: 41, budget: 0, spent: 250, pct: 25, watchList: true,
  milestones: [{ id: 31, name: "Pilot milestone", date: "2026-06-15", status: "upcoming" }],
}
const otherProject = {
  id: 714, name: "Network refresh", status: "Planning", risk: "Low", pm: "Ada Manager",
  budget: 500, spent: 0, pct: 0, watchList: false, milestones: [],
}
const risk = { id: 801, name: "Network outage", responsible: "Ari Owner", status: "mitigating", impact: 4, probability: 3 }
const stakeholder = { id: 901, name: "Kim Partner", priority: "action", owner: "Sam Owner", biz: 3, iti: 4, perc: 2 }
const performance = {
  name: "Delivery contract", year: 2026, items: [{
    id: 1001, name: "Delivery objectives", totalWeight: 0.5,
    subs: [
      { id: 1002, label: "Available score", score: 0, status: "on", totalWeight: 0.25 },
      { id: 1003, label: "Unscored objective", score: null, status: "behind", totalWeight: 0.25 },
    ],
  }],
}
const filledState = snapshot({
  summaries: ["Portfolio Dashboard"],
  projects: [project, otherProject],
  hotTopics: [{ id: 1101, action: "Review recovery plan", responsible: "Ari Owner", status: "open", priority: "high" }],
  risks: [risk],
  stakeholders: [stakeholder],
  itperf: performance,
})

for (const name of ["Portfolio Dashboard", "All Projects"]) {
  test(`${name}: renders the projected manager and project fields`, () => {
    const projected = page(name, filledState)
    const rows = projected.data.projects as Record<string, unknown>[]
    expect(rows[0]?.id).toBe(713)
    expect(rows[0]?.leaderId).toBe(41)
    const view = mount(projected)
    const row = [...view.host.querySelectorAll("table[aria-label='Projects'] tbody tr")].find((item) => item.textContent?.includes("Atlas rollout"))
    expect(row).toBeDefined()
    expect(row?.textContent).toContain("Ada Manager")
    expect(row?.textContent).not.toContain("Ada Directory Entry")
    expect(row?.cells[7]?.textContent?.trim()).toBe("0")
    for (const text of ["Project manager", "Status", "Risk", "Budget", "Spent", "Progress", "Atlas rollout", "In Progress", "High", "25"])
      expect(view.host.textContent).toContain(text)
  })
}

test("IT Risks renders the actual authorized projection", () => {
  const view = mount(page("IT Risks", filledState))
  for (const text of ["Risk Register", "Risk", "Status", "Impact", "Probability", "Network outage", "Ari Owner", "mitigating", "4", "3"])
    expect(view.host.textContent).toContain(text)
})

test("Stakeholder Management renders the actual authorized projection", () => {
  const view = mount(page("Stakeholder Management", filledState))
  for (const text of ["Stakeholder Register", "Stakeholder", "Priority override", "Owner", "Kim Partner", "Sam Owner"])
    expect(view.host.textContent).toContain(text)
})

test("IT Performance Contract distinguishes the projected zero score from null", () => {
  const view = mount(page("IT Performance Contract", filledState))
  for (const text of ["Delivery objectives", "Available score", "Unscored objective", "Score", "Status"])
    expect(view.host.textContent).toContain(text)
  const rows = [...view.host.querySelectorAll("tr")]
  const scored = rows.find((row) => row.textContent?.includes("Available score"))
  const missing = rows.find((row) => row.textContent?.includes("Unscored objective"))
  expect(scored).toBeDefined()
  expect(missing).toBeDefined()
  const table = scored?.closest("table")
  const scoreColumn = [...(table?.querySelectorAll("thead th") ?? [])].findIndex((header) => header.textContent?.trim() === "Score")
  expect(scoreColumn).toBeGreaterThanOrEqual(0)
  expect(scored?.querySelectorAll("td")[scoreColumn]?.textContent?.trim()).toMatch(/^0(?:\.0+)?$/)
  expect(missing?.querySelectorAll("td")[scoreColumn]?.textContent?.trim()).toBe("—")
  expect(view.host.querySelector("table[aria-label='Sub-items: Delivery objectives']")).not.toBeNull()
})

test("Hot Topics renders the actual authorized action projection", () => {
  const view = mount(page("Hot Topics & Actions", filledState))
  expect(view.host.querySelector("table[aria-label='Actions']")).not.toBeNull()
  expect(view.host.textContent).toContain("Review recovery plan")
})

test("each authorized page renders its genuine empty state from domain views", () => {
  const empty = snapshot({ summaries: ["Portfolio Dashboard"], projects: [], hotTopics: [], risks: [], stakeholders: [], itperf: { name: "", year: 2026, items: [] } })
  const expected: Record<string, { table?: string; status: string }> = {
    "Hot Topics & Actions": { table: "Actions", status: "No records to show." },
    "Portfolio Dashboard": { table: "Projects", status: "No records to show." },
    "All Projects": { table: "Projects", status: "No records to show." },
    "IT Risks": { table: "Risk Register", status: "No records to show." },
    "Stakeholder Management": { table: "Stakeholder Register", status: "No records to show." },
    "IT Performance Contract": { status: "No contract items to show." },
  }
  for (const name of viewNames) {
    const view = mount(page(name, empty))
    const region = [...view.host.querySelectorAll("section[aria-label]")].find((item) => item.getAttribute("aria-label") === name)
    expect(region).toBeDefined()
    expect(region?.querySelector('[role="status"]')?.textContent).toBe(expected[name]?.status)
    if (expected[name]?.table) expect(region?.querySelector(`table[aria-label='${expected[name]?.table}']`)).not.toBeNull()
    expect(region?.querySelectorAll("tbody tr")).toHaveLength(0)
  }
})

test("each authorized page distinguishes an unavailable projection from an empty collection", () => {
  const empty = snapshot({ summaries: ["Portfolio Dashboard"], projects: [], hotTopics: [], risks: [], stakeholders: [], itperf: { name: "", year: 2026, items: [] } })
  const collections: Record<string, string> = {
    "Hot Topics & Actions": "hotTopics", "Portfolio Dashboard": "projects", "All Projects": "projects",
    "IT Risks": "risks", "Stakeholder Management": "stakeholders", "IT Performance Contract": "itperf",
  }
  for (const name of viewNames) {
    const projected = page(name, empty)
    const data = { ...projected.data }
    delete data[collections[name]!]
    const view = mount({ ...projected, data })
    const region = [...view.host.querySelectorAll("section[aria-label]")].find((item) => item.getAttribute("aria-label") === name)
    expect(region).toBeDefined()
    expect(region?.querySelector('[role="status"]')?.textContent).toBe("Information unavailable.")
    expect(region?.querySelectorAll("tbody tr")).toHaveLength(0)
  }
})

test("untrusted projected text stays escaped", () => {
  const hostile = '<img src=x onerror="alert(1)">'
  const state = snapshot({ projects: [{ ...project, name: hostile }] })
  const view = mount(page("All Projects", state))
  expect(view.host.textContent).toContain(hostile)
  expect(view.host.querySelector("img")).toBeNull()
})

test("restricted viewer receives only the summarized project page and its projected records", () => {
  const viewer: Actor = { id: "viewer", name: "Viewer", canWrite: false, roles: ["viewer"], assigned: [], domains: [] }
  const projected = page("Portfolio Dashboard", filledState, viewer)
  expect(projected.pages).toContain("Portfolio Dashboard")
  expect(projected.pages).not.toContain("All Projects")
  expect(projected.data.projects).toHaveLength(2)
  expect(projected.data.projects).toMatchObject([
    { id: 713, name: "Atlas rollout", pm: "Ada Manager" },
    { id: 714, name: "Network refresh", pm: "Ada Manager" },
  ])
  expect(projected.data.risks).toBeUndefined()
  const view = mount(projected)
  expect(view.host.textContent).toContain("Atlas rollout")
  expect(view.host.textContent).toContain("Network refresh")
  expect(view.host.textContent).not.toContain("Network outage")
})

test("unrelated page and surface never render portfolio records", () => {
  const unrelated = mount(page("Executive Dashboard", filledState))
  expect(unrelated.host.textContent).not.toContain("Atlas rollout")
  const planner = page("All Projects", filledState)
  unrelated.setPage({ ...planner, surface: "planner" })
  expect(unrelated.host.textContent).not.toContain("Atlas rollout")
})

test("removing the current page from authorized pages clears retained private rows", () => {
  const current = page("All Projects", filledState)
  const view = mount(current)
  expect(view.host.textContent).toContain("Atlas rollout")
  view.setPage({ ...current, pages: [] })
  expect(view.host.textContent).not.toContain("Atlas rollout")
  expect(view.host.textContent).not.toContain("Ada Manager")
})

test("project search, Status, and Show controls change visible rows and preserve unrelated query keys", () => {
  const view = mount(page("All Projects", filledState), {
    page: "All Projects", year: "2026", owner: "Ada Manager", status: "", filter: "", q: "",
  })
  const region = [...view.host.querySelectorAll("section[aria-label]")].find((item) => item.getAttribute("aria-label") === "All Projects")
  const table = region?.querySelector("table[aria-label='Projects']")
  expect(table?.textContent).toContain("Atlas rollout")
  expect(table?.textContent).toContain("Network refresh")

  const search = [...(region?.querySelectorAll("label") ?? [])].find((item) => item.querySelector("span")?.textContent === SF_NATIVE_DASHBOARD_PORTFOLIO_COPY["sucafina.native.dashboard-portfolio.filter.search"])?.querySelector("input")
  if (!search) throw new Error("Expected the project Search control")
  search.value = "Atlas"
  search.dispatchEvent(new Event("input", { bubbles: true }))
  search.dispatchEvent(new Event("change", { bubbles: true }))
  expect(table?.textContent).toContain("Atlas rollout")
  expect(table?.textContent).not.toContain("Network refresh")
  expect(view.changes.at(-1)).toMatchObject({ page: "All Projects", year: "2026", owner: "Ada Manager", status: "", filter: "", q: "Atlas" })

  const status = [...(region?.querySelectorAll("label") ?? [])].find((item) => item.querySelector("span")?.textContent === SF_NATIVE_DASHBOARD_PORTFOLIO_COPY["sucafina.native.dashboard-portfolio.filter.status"])?.querySelector("select")
  if (!status) throw new Error("Expected the project Status control")
  status.value = "Completed"
  status.dispatchEvent(new Event("change", { bubbles: true }))
  expect(table?.textContent).not.toContain("Atlas rollout")
  status.value = "In Progress"
  status.dispatchEvent(new Event("change", { bubbles: true }))
  expect(table?.textContent).toContain("Atlas rollout")
  expect(view.changes.at(-1)).toMatchObject({ page: "All Projects", year: "2026", owner: "Ada Manager", q: "Atlas", status: "In Progress", filter: "" })

  search.value = ""
  search.dispatchEvent(new Event("input", { bubbles: true }))
  search.dispatchEvent(new Event("change", { bubbles: true }))
  status.value = ""
  status.dispatchEvent(new Event("change", { bubbles: true }))
  expect(table?.textContent).toContain("Atlas rollout")
  expect(table?.textContent).toContain("Network refresh")
  expect(view.changes.at(-1)).toMatchObject({ page: "All Projects", year: "2026", owner: "Ada Manager", q: "", status: "", filter: "" })

  const show = [...(region?.querySelectorAll("label") ?? [])].find((item) => item.querySelector("span")?.textContent === SF_NATIVE_DASHBOARD_PORTFOLIO_COPY["sucafina.native.dashboard-portfolio.filter.show"])?.querySelector("select")
  if (!show) throw new Error("Expected the project Show control")
  show.value = "watch"
  show.dispatchEvent(new Event("change", { bubbles: true }))
  expect(table?.textContent).toContain("Atlas rollout")
  expect(table?.textContent).not.toContain("Network refresh")
  expect(view.changes.at(-1)).toMatchObject({ page: "All Projects", year: "2026", owner: "Ada Manager", q: "", status: "", filter: "watch" })

  show.value = ""
  show.dispatchEvent(new Event("change", { bubbles: true }))
  expect(table?.textContent).toContain("Atlas rollout")
  expect(table?.textContent).toContain("Network refresh")
  expect(view.changes.at(-1)).toMatchObject({ page: "All Projects", year: "2026", owner: "Ada Manager", q: "", status: "", filter: "" })
})

test("English dashboard portfolio copy preserves the source wording", () => {
  expect(SF_NATIVE_DASHBOARD_PORTFOLIO_COPY["sucafina.native.dashboard-portfolio.page.allProjects"]).toBe("All Projects")
  expect(SF_NATIVE_DASHBOARD_PORTFOLIO_COPY["sucafina.native.dashboard-portfolio.column.projectManager"]).toBe("Project manager")
  expect(SF_NATIVE_DASHBOARD_PORTFOLIO_COPY["sucafina.native.dashboard-portfolio.option.onHold"]).toBe("On Hold")
  expect(SF_NATIVE_DASHBOARD_PORTFOLIO_COPY["sucafina.native.dashboard-portfolio.status.riskTierUnavailable"]).toBe("Risk tier data is unavailable for the selected filter: {{filter}}.")
  const view = mount(page("All Projects", filledState))
  const region = [...view.host.querySelectorAll("section[aria-label]")].find((item) => item.getAttribute("aria-label") === "All Projects")
  expect(region?.querySelector("table[aria-label='Projects'] thead th")?.textContent).toBe(
    SF_NATIVE_DASHBOARD_PORTFOLIO_COPY["sucafina.native.dashboard-portfolio.column.project"],
  )
  const projectManager = [...(region?.querySelectorAll("table[aria-label='Projects'] thead th") ?? [])].find((item) => item.textContent === "Project manager")
  expect(projectManager?.textContent).toBe(SF_NATIVE_DASHBOARD_PORTFOLIO_COPY["sucafina.native.dashboard-portfolio.column.projectManager"])
})

test("dashboard portfolio copy reacts EN to pt-BR and back through one real language provider", async () => {
  const view = mount(page("All Projects", filledState), { page: "All Projects", year: "2026", owner: "Ada Manager", q: "" }, "en")
  await view.language.ready.promise
  expect(view.language.locale()).toBe("en")
  const region = () => [...view.host.querySelectorAll("section[aria-label]")].find((item) => item.getAttribute("aria-label") === view.language.t("sucafina.native.dashboard-portfolio.page.allProjects"))
  const statusControl = () => [...view.host.querySelectorAll("label")].find((item) => item.querySelector("span")?.textContent === view.language.t("sucafina.native.dashboard-portfolio.filter.status"))?.querySelector("select")
  const showControl = () => [...view.host.querySelectorAll("label")].find((item) => item.querySelector("span")?.textContent === view.language.t("sucafina.native.dashboard-portfolio.filter.show"))?.querySelector("select")
  const projectTable = () => region()?.querySelector("table")
  const expectFilteredProjects = () => {
    expect(projectTable()?.querySelectorAll("tbody tr")).toHaveLength(1)
    expect(projectTable()?.textContent).toContain("Atlas rollout")
    expect(projectTable()?.textContent).not.toContain("Network refresh")
  }
  const expectPreservedQuery = () => expect(view.changes.at(-1)).toMatchObject({
    page: "All Projects", year: "2026", owner: "Ada Manager", q: "", status: "In Progress", filter: "watch",
  })
  const waitFor = async (condition: () => boolean) => {
    for (let attempt = 0; attempt < 200 && !condition(); attempt++) await Bun.sleep(10)
    expect(condition()).toBe(true)
  }
  expect(region()?.querySelector("table[aria-label='Projects'] thead th")?.textContent).toBe("Project")
  expect(showControl()?.options[0]?.value).toBe("")
  expect(showControl()?.options[1]?.value).toBe("watch")
  expect(showControl()?.options[1]?.textContent).toBe("Watch list")
  expect(view.host.textContent).toContain("2026-06-15")

  const status = statusControl()
  if (!status) throw new Error("Expected the project Status control")
  status.value = "In Progress"
  status.dispatchEvent(new Event("change", { bubbles: true }))
  expect(projectTable()?.textContent).toContain("Atlas rollout")
  expect(projectTable()?.textContent).not.toContain("Network refresh")
  const show = showControl()
  if (!show) throw new Error("Expected the project Show control")
  show.value = "watch"
  show.dispatchEvent(new Event("change", { bubbles: true }))
  expect(status.value).toBe("In Progress")
  expect(show.value).toBe("watch")
  expectFilteredProjects()
  expectPreservedQuery()

  view.language.setLocale("br")
  await waitFor(() => view.language.locale() === "br" && region()?.querySelector("table[aria-label='Projetos'] thead th")?.textContent === "Projeto")
  expect(region()?.querySelector("table[aria-label='Projetos'] thead th:nth-child(2)")?.textContent).toBe("Gerente do projeto")
  expect(statusControl()?.value).toBe("In Progress")
  expect(statusControl()?.selectedOptions[0]?.textContent).toBe("Em andamento")
  expect(showControl()?.value).toBe("watch")
  expect(showControl()?.options[0]?.value).toBe("")
  expect(showControl()?.options[1]?.value).toBe("watch")
  expect(showControl()?.options[1]?.textContent).toBe("Lista de acompanhamento")
  expectFilteredProjects()
  expectPreservedQuery()
  expect(view.host.textContent).toContain("2026-06-15")

  view.language.setLocale("en")
  await waitFor(() => view.language.locale() === "en" && region()?.querySelector("table[aria-label='Projects'] thead th")?.textContent === "Project")
  expect(statusControl()?.value).toBe("In Progress")
  expect(statusControl()?.selectedOptions[0]?.textContent).toBe("In Progress")
  expect(showControl()?.value).toBe("watch")
  expect(showControl()?.options[1]?.value).toBe("watch")
  expect(showControl()?.options[1]?.textContent).toBe("Watch list")
  expectFilteredProjects()
  expectPreservedQuery()
  expect(view.host.textContent).toContain("2026-06-15")
})
