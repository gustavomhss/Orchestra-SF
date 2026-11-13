import { afterEach, expect, test } from "bun:test"
import type { Sucafina } from "@orchestra/schema/sucafina"
import type { Locale } from "@/context/language"
import { createComponent, createSignal } from "solid-js"
import { render } from "solid-js/web"
import { DashboardPeople } from "../../../modules/sucafina/Sucafinav1/runtime/dashboard-people.ts"
import type { Snapshot } from "../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { solidDom } from "./solid-dom"

const { DashboardPeopleView }: typeof import("../src/orchestra/chapters/sucafina/dashboard-people-view") =
  await import(solidDom("../src/orchestra/chapters/sucafina/dashboard-people-view", import.meta.dir))
const { LanguageProvider, loadLocaleDict, useLanguage }: typeof import("@/context/language") = await import(
  solidDom("@/context/language", import.meta.dir)
)
const { PlatformProvider }: typeof import("@/context/platform") = await import(solidDom("@/context/platform", import.meta.dir))
const { createLocalePlatform } = await import(solidDom("./native-locale-fixture", import.meta.dir))
const { SF_NATIVE_DASHBOARD_PEOPLE_COPY, SF_NATIVE_DASHBOARD_PEOPLE_COPY_BR }:
  typeof import("@/i18n/orchestra-chapters/sucafina-native-dashboard-people") = await import(
    solidDom("@/i18n/orchestra-chapters/sucafina-native-dashboard-people", import.meta.dir)
  )

const pageNames = ["Headcount Overview", "Team Structure", "Talent Review"]
const admin = { id: "admin-1", name: "Casey Admin", canWrite: true, roles: ["admin"], assigned: [], domains: [] }
const domainLeader = { id: "leader-1", name: "Ravi Example", canWrite: true, roles: ["domain leader"], assigned: [], domains: ["Platform"] }
const environment = {
  at: "2026-11-13T12:00:00Z",
  id: () => "unused",
  directory: [{ id: "member-1", name: "Nia Example" }, { id: "leader-1", name: "Ravi Example" }],
}
const hostile = '<img src=x onerror="alert(1)">'
const privateMarker = "private-review-note-7f3a"
const cleanups: (() => void)[] = []
afterEach(() => cleanups.splice(0).forEach((dispose) => dispose()))

function snapshot(populated = true, unsafeName = false): Snapshot {
  return {
    data: {
      cio: populated ? { name: "Ari CIO", title: "Chief Information Officer", location: "São Paulo", start: "2020-04-01" } : {},
      leaders: populated ? [{ id: "leader-1", name: "Ravi Example", title: "Platform Lead", domain: "Platform", location: "São Paulo", start: "2021-02-01" }] : [],
      members: populated ? [{
        id: "member-1",
        name: unsafeName ? hostile : "Nia Example",
        title: "Systems Analyst",
        type: "Employee",
        leaderId: "leader-1",
        location: "São Paulo",
        start: "2023-05-15",
        end: "",
        status: "Active",
        cls: "Talent",
        outlook: "Promote",
        notes: privateMarker,
      }] : [],
      itUsersMonthly: populated ? [{ year: 2026, month: 10, users: 0 }, { year: 2026, month: 11, users: null }] : [],
    },
    versions: {},
    sequences: {},
    audit: [],
    notices: [],
  }
}

function projected(name: string, populated = true, unsafeName = false): Sucafina.PageState {
  const source = snapshot(populated, unsafeName)
  return project(name, source)
}

function project(name: string, source: Snapshot, actor = admin): Sucafina.PageState {
  const view = DashboardPeople.domain.view(source, actor, environment)
  return {
    surface: "dashboard",
    page: name,
    pages: pageNames,
    actor,
    year: 2026,
    month: 11,
    data: view.data as Sucafina.PageState["data"],
    versions: view.versions,
    directory: environment.directory,
  }
}

function mount(initial: Sucafina.PageState, locale: Locale = "en") {
  const [page, setPage] = createSignal(initial)
  const [query, setQuery] = createSignal<Sucafina.PageQuery>({
    page: initial.page,
    year: "2026",
    memberStatus: "",
    q: "keep search",
    tab: "keep tab",
  })
  const calls: Sucafina.PageQuery[] = []
  const language: { current?: ReturnType<typeof useLanguage> } = {}
  const host = document.createElement("div")
  document.body.append(host)
  const dispose = render(() => createComponent(PlatformProvider, {
    value: createLocalePlatform(),
    get children() { return createComponent(LanguageProvider, {
      locale,
      get children() {
        language.current = useLanguage()
        return createComponent(DashboardPeopleView, {
          get page() { return page() },
          get query() { return query() },
          onQuery(next) { calls.push(next); setQuery(next) },
        })
      },
    }) },
  }), host)
  cleanups.push(() => { dispose(); host.remove() })
  return { host, setPage, calls, language: () => language.current! }
}

function contains(host: HTMLElement, ...values: string[]) {
  for (const value of values) expect(host.textContent).toContain(value)
}

async function waitForLocaleCopy(view: ReturnType<typeof mount>, locale: Locale, visible: string) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (view.language().locale() === locale && view.host.textContent?.includes(visible)) return
    await Bun.sleep(10)
  }
  expect(view.language().locale()).toBe(locale)
  expect(view.host.textContent).toContain(visible)
}

test("native people English copy keeps the source wording byte for byte", () => {
  const expected = {
    "sucafina.native.dashboard-people.year": "Year",
    "sucafina.native.dashboard-people.projectionLimited": "Projection limited",
    "sucafina.native.dashboard-people.measuresUnavailable": "Headcount measures and leader aggregates are not included in the authorized page data.",
    "sucafina.native.dashboard-people.headcountPeople": "Headcount people",
    "sucafina.native.dashboard-people.name": "Name",
    "sucafina.native.dashboard-people.leader": "Leader",
    "sucafina.native.dashboard-people.domain": "Domain",
    "sucafina.native.dashboard-people.location": "Location",
    "sucafina.native.dashboard-people.type": "Type",
    "sucafina.native.dashboard-people.status": "Status",
    "sucafina.native.dashboard-people.noMemberRecords": "No member records in this authorized projection.",
    "sucafina.native.dashboard-people.memberRecordsUnavailable": "No authorized projection was supplied for Member records.",
    "sucafina.native.dashboard-people.leaderRecordsUnavailable": "No authorized projection was supplied for Leader records.",
    "sucafina.native.dashboard-people.cioPositionUnavailable": "No authorized projection was supplied for CIO position.",
    "sucafina.native.dashboard-people.leaderUnassigned": "Unassigned",
    "sucafina.native.dashboard-people.leaderDataUnavailable": "Leader data unavailable",
    "sucafina.native.dashboard-people.memberDataUnavailable": "Member data unavailable",
    "sucafina.native.dashboard-people.cioPosition": "CIO position",
    "sucafina.native.dashboard-people.title": "Title",
    "sucafina.native.dashboard-people.start": "Start",
    "sucafina.native.dashboard-people.teamLeaders": "Team leaders",
    "sucafina.native.dashboard-people.teamLeadersUnavailable": "No authorized projection was supplied for Team leaders.",
    "sucafina.native.dashboard-people.members": "Members",
    "sucafina.native.dashboard-people.noLeaders": "No leaders in this authorized projection.",
    "sucafina.native.dashboard-people.teamMembers": "Team members",
    "sucafina.native.dashboard-people.teamMembersUnavailable": "No authorized projection was supplied for Team members.",
    "sucafina.native.dashboard-people.startDate": "Start date",
    "sucafina.native.dashboard-people.endDate": "End date",
    "sucafina.native.dashboard-people.talentReview": "Talent review",
    "sucafina.native.dashboard-people.activeDefault": "Active (default)",
    "sucafina.native.dashboard-people.active": "Active",
    "sucafina.native.dashboard-people.onLeave": "On Leave",
    "sucafina.native.dashboard-people.terminated": "Terminated",
    "sucafina.native.dashboard-people.reportsTo": "Reports To",
    "sucafina.native.dashboard-people.classification": "Classification",
    "sucafina.native.dashboard-people.outlook": "3-Yr Outlook",
    "sucafina.native.dashboard-people.notes": "Notes",
    "sucafina.native.dashboard-people.noStatusMatch": "No members match the selected status.",
  } as const
  for (const key of Object.keys(expected) as (keyof typeof expected)[]) expect(SF_NATIVE_DASHBOARD_PEOPLE_COPY[key]).toBe(expected[key])
  expect(Object.keys(SF_NATIVE_DASHBOARD_PEOPLE_COPY_BR)).toEqual(Object.keys(SF_NATIVE_DASHBOARD_PEOPLE_COPY))
})

test("native people copy reacts en to pt-BR to en through the isolated real providers", async () => {
  await loadLocaleDict("en")
  await loadLocaleDict("br")
  const view = mount(projected("Talent Review"), "en")
  await view.language().ready.promise
  await waitForLocaleCopy(view, "en", "Talent review")
  const status = [...view.host.querySelectorAll("label")]
    .find((label) => label.textContent?.includes("Status"))?.querySelector("select")
  expect(status).toBeDefined()
  if (!status) throw new Error("Missing Talent Review status selector")
  const talentTable = view.host.querySelector('[role="table"]')
  expect(talentTable).not.toBeNull()
  if (!talentTable) throw new Error("Missing Talent Review table")
  const expectProjectedSource = () => {
    const memberRow = [...talentTable.querySelectorAll('[role="row"]')]
      .find((row) => row.textContent?.includes("Nia Example"))
    expect(memberRow).toBeDefined()
    if (!memberRow) throw new Error("Missing projected Talent Review member row")
    expect([...memberRow.querySelectorAll('[role="cell"]')].map((cell) => cell.textContent?.trim())).toEqual([
      "Nia Example", "Systems Analyst", "Employee", "Ravi Example", "São Paulo", "Active", "Talent", "Promote", privateMarker,
    ])
  }
  const expectStatusOptions = (options: [string, string][]) => {
    expect(status.isConnected).toBe(true)
    expect(view.host.querySelector("label select")).toBe(status)
    expect(view.host.querySelector('[role="table"]')).toBe(talentTable)
    expect([...status.options].map((option) => [option.textContent, option.value])).toEqual(options)
    expectProjectedSource()
  }

  expectStatusOptions([
    ["Active (default)", ""], ["Active", "Active"], ["On Leave", "On Leave"], ["Terminated", "Terminated"],
  ])

  view.language().setLocale("br")
  await view.language().ready.promise
  await waitForLocaleCopy(view, "br", "Avaliação de talentos")
  expect(view.host.querySelector("label")?.textContent).toContain("Status")
  expectStatusOptions([
    ["Ativo (padrão)", ""], ["Ativo", "Active"], ["Afastado", "On Leave"], ["Desligado", "Terminated"],
  ])

  await loadLocaleDict("en")
  view.language().setLocale("en")
  await view.language().ready.promise
  await waitForLocaleCopy(view, "en", "Talent review")
  expectStatusOptions([
    ["Active (default)", ""], ["Active", "Active"], ["On Leave", "On Leave"], ["Terminated", "Terminated"],
  ])
})

test("Headcount year label reacts EN to pt-BR while numeric year options stay unchanged", async () => {
  await loadLocaleDict("en")
  await loadLocaleDict("br")
  const view = mount(projected("Headcount Overview"), "en")
  await view.language().ready.promise
  await waitForLocaleCopy(view, "en", "Headcount people")
  const year = [...view.host.querySelectorAll("label")]
    .find((label) => label.textContent?.includes("Year"))?.querySelector("select")
  expect(year).toBeDefined()
  if (!year) throw new Error("Missing Headcount Overview year selector")
  const yearOptions = () => [...year.options].map((option) => [option.textContent, option.value])
  const expectedYears = [["2024", "2024"], ["2025", "2025"], ["2026", "2026"], ["2027", "2027"]]
  expect(yearOptions()).toEqual(expectedYears)

  view.language().setLocale("br")
  await view.language().ready.promise
  await waitForLocaleCopy(view, "br", "Pessoas do quadro")
  expect(view.host.querySelector("label")?.textContent).toContain("Ano")
  expect(view.host.querySelector("label select")).toBe(year)
  expect(yearOptions()).toEqual(expectedYears)
})

test("Team Structure unavailable projection messages react EN to pt-BR through the real providers", async () => {
  await loadLocaleDict("en")
  await loadLocaleDict("br")
  const team = projected("Team Structure", false)
  const unavailableData = { ...team.data }
  delete unavailableData.leaders
  delete unavailableData.members
  const view = mount({ ...team, data: unavailableData as Sucafina.PageState["data"] }, "en")
  await view.language().ready.promise
  await waitForLocaleCopy(view, "en", "No authorized projection was supplied for Team leaders.")
  const unavailableMessages = () => [...view.host.querySelectorAll('[role="status"]')]
    .map((status) => status.textContent?.trim())
  expect(unavailableMessages()).toEqual([
    "No authorized projection was supplied for Team leaders.",
    "No authorized projection was supplied for Team members.",
  ])

  view.language().setLocale("br")
  await view.language().ready.promise
  await waitForLocaleCopy(view, "br", "A projeção autorizada de líderes da equipe não foi fornecida.")
  expect(unavailableMessages()).toEqual([
    "A projeção autorizada de líderes da equipe não foi fornecida.",
    "A projeção autorizada de membros da equipe não foi fornecida.",
  ])
})

test("Headcount Overview renders authorized member fields and its year query", () => {
  const view = mount(projected("Headcount Overview"))
  contains(view.host, "Headcount people", "Name", "Leader", "Domain", "Location", "Type", "Status", "Nia Example", "Ravi Example", "Platform", "São Paulo", "Employee", "Active")
  expect(view.host.textContent).not.toContain("private-review-note")
  const year = [...view.host.querySelectorAll("label")].find((label) => label.textContent?.includes("Year"))?.querySelector("select")
  expect(year).toBeDefined()
  if (!year) throw new Error("Missing Headcount Overview year selector")
  year.value = "2025"
  year.dispatchEvent(new Event("change", { bubbles: true }))
  expect(view.calls).toHaveLength(1)
  expect(view.calls[0]).toMatchObject({ page: "Headcount Overview", year: "2025", q: "keep search", tab: "keep tab", memberStatus: "" })
})

test("Team Structure renders CIO and resolves member leader IDs to projected names", () => {
  const view = mount(projected("Team Structure"))
  contains(view.host, "CIO position", "Ari CIO", "Chief Information Officer", "Team leaders", "Platform Lead", "Platform", "Team members", "Nia Example", "Ravi Example", "Systems Analyst", "Employee", "2023-05-15", "Active")
  const leaderTable = view.host.querySelector('[aria-label="Team leaders"]')
  expect(leaderTable?.textContent).toContain("Title")
  expect(leaderTable?.textContent).toContain("Start")
  expect(leaderTable?.textContent).toContain("2021-02-01")
  expect(view.host.textContent).not.toContain("private-review-note")
})

test("numeric leader IDs resolve only to the matching projected string IDs on each people page", () => {
  const source = snapshot()
  source.data.leaders = [
    { id: 0, name: "Zero ID Leader", title: "Zero Lead", domain: "Zero Domain", location: "São Paulo", start: "2020-01-01" },
    { id: 42, name: "Forty Two Leader", title: "Forty Two Lead", domain: "Forty Two Domain", location: "Lisbon", start: "2022-02-02" },
  ]
  source.data.members = [
    { id: "member-zero", name: "Reports to Zero", type: "Employee", leaderId: 0, title: "Analyst", location: "São Paulo", start: "2024-01-01", end: "", status: "Active" },
    { id: "member-forty-two", name: "Reports to Forty Two", type: "Employee", leaderId: 42, title: "Engineer", location: "Lisbon", start: "2024-02-02", end: "", status: "Active" },
    { id: "member-missing", name: "Missing Leader Target", type: "Employee", leaderId: 404, title: "Coordinator", location: "Remote", start: "2024-03-03", end: "", status: "Active" },
  ]
  for (const name of pageNames) {
    const page = project(name, source)
    expect(page.data.leaders).toMatchObject([{ id: "0" }, { id: "42" }])
    expect(page.data.members).toMatchObject([{ leaderId: 0 }, { leaderId: 42 }, { leaderId: 404 }])
    const view = mount(page)
    const sectionName = name === "Headcount Overview" ? "Headcount people" : name === "Team Structure" ? "Team members" : "Talent review"
    const section = view.host.querySelector(`[aria-label="${sectionName}"]`)
    expect(section).not.toBeNull()
    const row = (memberName: string) => {
      const found = [...section!.querySelectorAll('[role="row"]')].find((item) => item.textContent?.includes(memberName))
      if (!found) throw new Error(`Missing ${name} row ${memberName}`)
      return [...found.querySelectorAll('[role="cell"]')].map((cell) => cell.textContent?.trim())
    }
    const leaderCell = name === "Talent Review" ? 3 : 1
    expect(row("Reports to Zero")[leaderCell]).toBe("Zero ID Leader")
    expect(row("Reports to Forty Two")[leaderCell]).toBe("Forty Two Leader")
    expect(row("Missing Leader Target")[leaderCell]).toBe("404")
    expect(row("Missing Leader Target")[leaderCell]).not.toBe("Zero ID Leader")
    expect(row("Missing Leader Target")[leaderCell]).not.toBe("Forty Two Leader")
    if (name === "Team Structure") {
      const leaders = view.host.querySelector('[aria-label="Team leaders"]')
      expect(leaders).not.toBeNull()
      const memberColumn = [...leaders!.querySelectorAll('[role="columnheader"]')]
        .findIndex((header) => header.textContent?.trim() === "Members")
      expect(memberColumn).toBeGreaterThanOrEqual(0)
      const leaderRow = (leaderName: string) => {
        const found = [...leaders!.querySelectorAll('[role="row"]')].find((item) => item.textContent?.includes(leaderName))
        if (!found) throw new Error(`Missing leader row ${leaderName}`)
        return [...found.querySelectorAll('[role="cell"]')].map((cell) => cell.textContent?.trim())
      }
      expect(leaderRow("Zero ID Leader")[memberColumn]).toContain("Reports to Zero")
      expect(leaderRow("Forty Two Leader")[memberColumn]).toContain("Reports to Forty Two")
    }
  }
})

test("Talent Review renders admin-projected private fields as text and forwards status query", () => {
  const view = mount(projected("Talent Review"))
  contains(view.host, "Talent review", "Classification", "3-Yr Outlook", "Notes", "Nia Example", "Ravi Example", "Talent", "Promote", privateMarker)
  const status = [...view.host.querySelectorAll("label")].find((label) => label.textContent?.includes("Status"))?.querySelector("select")
  expect(status).toBeDefined()
  if (!status) throw new Error("Missing Talent Review status selector")
  status.value = "Terminated"
  status.dispatchEvent(new Event("change", { bubbles: true }))
  expect(view.calls).toHaveLength(1)
  expect(view.calls[0]).toMatchObject({ page: "Talent Review", memberStatus: "Terminated", year: "2026", q: "keep search", tab: "keep tab" })
  expect(view.host.textContent).toContain("No members match the selected status.")
  expect(view.host.textContent).not.toContain("Nia Example")
})

test("non-admin domain-leader projection omits private member fields and does not render them", () => {
  const page = project("Team Structure", snapshot(), domainLeader)
  expect(page.pages).toContain("Team Structure")
  expect(page.data.members).toMatchObject([{ id: "member-1", name: "Nia Example", leaderId: "leader-1" }])
  const members = page.data.members as Record<string, unknown>[]
  const member = members[0]
  expect(member).toBeDefined()
  if (!member) throw new Error("Missing projected member")
  for (const field of ["cls", "outlook", "notes"]) expect(Object.hasOwn(member, field)).toBe(false)
  const view = mount(page)
  contains(view.host, "Nia Example", "Ravi Example", "Systems Analyst")
  for (const value of ["Talent", "Promote", privateMarker]) expect(view.host.textContent).not.toContain(value)
})

test("empty projected collections show empty states without fabricated people", () => {
  for (const name of pageNames) {
    const view = mount(projected(name, false))
    expect(view.host.textContent).not.toContain("Nia Example")
    expect(view.host.textContent).not.toContain("Ravi Example")
    expect(view.host.textContent).not.toContain("Ari CIO")
    if (name !== "Headcount Overview") expect(view.host.querySelectorAll('[role="status"]').length).toBe(name === "Team Structure" ? 2 : 1)
    const records = name === "Headcount Overview" ? view.host.querySelector('[aria-label="Headcount people"]') : view.host
    expect(records).not.toBeNull()
    if (name === "Headcount Overview") expect(records?.textContent).toContain("No member records in this authorized projection.")
    for (const row of records!.querySelectorAll('[role="row"]')) {
      if (row.querySelector('[role="columnheader"]')) continue
      expect(row.textContent?.trim()).toBe("")
    }
  }
})

test("missing or malformed people projections are unavailable, while valid empty arrays stay empty", () => {
  const base = projected("Team Structure", false)
  const invalid = [
    { label: "members missing", key: "members", remove: true },
    { label: "members malformed", key: "members", value: "not-an-array" },
    { label: "leaders missing", key: "leaders", remove: true },
    { label: "leaders malformed", key: "leaders", value: { id: "not-a-list" } },
    { label: "CIO missing", key: "cio", remove: true },
    { label: "CIO malformed", key: "cio", value: [] },
  ] as const
  for (const item of invalid) {
    const data = { ...base.data } as Record<string, unknown>
    if ("remove" in item) delete data[item.key]
    else data[item.key] = item.value
    const view = mount({ ...base, data: data as Sucafina.PageState["data"] })
    const unavailableCopy = item.key === "members"
      ? SF_NATIVE_DASHBOARD_PEOPLE_COPY["sucafina.native.dashboard-people.teamMembersUnavailable"]
      : item.key === "leaders"
        ? SF_NATIVE_DASHBOARD_PEOPLE_COPY["sucafina.native.dashboard-people.teamLeadersUnavailable"]
        : SF_NATIVE_DASHBOARD_PEOPLE_COPY["sucafina.native.dashboard-people.cioPositionUnavailable"]
    const region = [...view.host.querySelectorAll('[role="status"]')]
      .find((status) => status.textContent?.trim() === unavailableCopy)
    expect(region).toBeDefined()
    expect(region?.textContent?.trim()).toBe(unavailableCopy)
    if (item.key === "members") {
      expect(region?.textContent).not.toContain(SF_NATIVE_DASHBOARD_PEOPLE_COPY["sucafina.native.dashboard-people.noMemberRecords"])
    }
    if (item.key === "leaders") {
      expect(region?.textContent).not.toContain(SF_NATIVE_DASHBOARD_PEOPLE_COPY["sucafina.native.dashboard-people.noLeaders"])
    }
  }
  const validEmpty = mount(base)
  expect(validEmpty.host.querySelector('[aria-label="Team members"]')?.textContent).toContain("No member records in this authorized projection.")
  expect(validEmpty.host.querySelector('[aria-label="Team leaders"]')?.textContent).toContain("No leaders in this authorized projection.")
  expect(validEmpty.host.querySelector('[aria-labelledby="people-cio-title"]')?.textContent).not.toMatch(/unavailable/i)
})

test("unsafe projected member text stays escaped, and unrelated page or surface renders no people data", () => {
  const unsafe = mount(projected("Team Structure", true, true))
  expect(unsafe.host.textContent).toContain(hostile)
  expect(unsafe.host.querySelector("img")).toBeNull()

  for (const page of [
    { ...projected("Executive Dashboard"), page: "Executive Dashboard" },
    { ...projected("Headcount Overview"), surface: "planner" as const },
  ]) {
    const unrelated = mount(page)
    for (const value of ["Nia Example", "Ravi Example", "Ari CIO", privateMarker]) expect(unrelated.host.textContent).not.toContain(value)
  }
})

test("removing the authorized page clears prior private rows while page and data remain", () => {
  const initial = projected("Talent Review")
  const view = mount(initial)
  contains(view.host, "Nia Example", privateMarker)
  view.setPage({ ...initial, pages: [] })
  expect(view.host.textContent).not.toContain("Nia Example")
  expect(view.host.textContent).not.toContain(privateMarker)
  expect(view.host.textContent).not.toContain("Ravi Example")
})
