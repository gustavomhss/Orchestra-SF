import { expect, test } from "bun:test"
import type { Actor, Snapshot } from "../runtime/contract.ts"
import { domain, render } from "../runtime/dashboard-people.ts"
import { empty } from "./fixture/persistence.ts"

const environment = { at: "2026-06-15T12:00:00Z", id: () => "unused", directory: [] }
const admin: Actor = { id: "admin", roles: ["admin"], canWrite: true }
const leader: Actor = { id: "leader", roles: ["domain leader"], canWrite: true }
const viewer: Actor = { id: "viewer", roles: ["viewer"], canWrite: false }

type LeaderSummary = {
  id: string; name: string; domain: string; location: string; active: number; employees: number; contractors: number
  averageTenureMonths: number | null; talent?: number; solid?: number; laggers?: number
}
type Summary = {
  active: number; terminated: number; departures: number; attritionPercent: number; averageTenureMonths: number | null
  averageHeadcount: number; tenureCount: number; staffPercent: number | null
  staffRatio: number | null; users: number; usersMonth: number; employees: number; contractors: number; itLeaders: number
  talent?: number; solid?: number; laggers?: number; leaders: LeaderSummary[]; unassigned: LeaderSummary
  leaderTotals: { employees: number; contractors: number; active: number; talent?: number; solid?: number; laggers?: number }
  departureDetails: { id: string; name: string; end: string }[]
}

function fixture() {
  const state = empty()
  state.data.leaders = [{ id: 7, name: "A Leader", domain: "Apps", location: "Brazil", privateInfo: "PRIVATE-LEADER" }, { id: "8", name: "B Leader", domain: "Ops", location: "" }]
  state.data.members = [
    { id: 1, name: "Ada", status: "Active", type: "Employee", leaderId: 7, start: "2025-06-15", cls: "Talent", notes: "PRIVATE-NOTE", outlook: "PRIVATE-OUTLOOK", salary: "PRIVATE-SALARY" },
    { id: "b", name: "Bea", status: "Active", type: "Contractor", leaderId: "7", start: "2025-12-15", cls: "Solid Contributor" },
    { id: "c", name: "Cai", status: "Active", type: "", start: "invalid", cls: "Lagger" },
    { id: "d", name: "Dee", status: "Active", leaderId: "missing", cls: "Talent" },
    { id: "e", name: "Eli", status: "Terminated", end: "2026-02-01", cls: "Talent", notes: "PRIVATE-DEPARTURE" },
    { id: "f", name: "Flo", status: "Terminated", end: "2025-08-01", cls: "Solid Contributor" },
    { id: "g", name: "Gus", status: "On Leave", cls: "Lagger" },
  ]
  state.data.itUsersMonthly = [{ year: 2025, month: 5, users: 50 }, { year: 2026, month: 6, users: 120 }, { year: 2027, month: 4, users: 300 }]
  return state
}

function byYear(state: Snapshot, actor: Actor = admin) {
  const view = domain.view(state, actor, environment)
  expect(view.data.nativeHeadcountSummaryByYear).toBeDefined()
  return view.data.nativeHeadcountSummaryByYear as Record<string, Summary>
}

test("authorized summary uses the same real headcount metrics as legacy render", () => {
  const state = fixture()
  const view = domain.view(state, admin, environment)
  const years = view.data.nativeHeadcountSummaryByYear as Record<string, Summary>
  expect(years).toBeDefined()
  const year = years["2026"]!
  expect(Object.keys(year).sort()).toEqual(["active", "attritionPercent", "averageHeadcount", "averageTenureMonths", "contractors", "departureDetails", "departures", "employees", "itLeaders", "laggers", "leaderTotals", "leaders", "solid", "staffPercent", "staffRatio", "talent", "tenureCount", "terminated", "unassigned", "users", "usersMonth"].sort())
  expect(year).toMatchObject({ active: 4, terminated: 2, departures: 1, attritionPercent: 100 / 4.5, averageTenureMonths: 9, users: 120, usersMonth: 6, staffRatio: 30, employees: 3, contractors: 1, itLeaders: 2, talent: 3, solid: 2, laggers: 2 })
  expect(year).toMatchObject({ averageHeadcount: 4.5, tenureCount: 2, staffPercent: 3.3333333333333335 })
  const html = render("Headcount Overview", view.data, { actor: admin, year: 2026, month: 1, at: environment.at, versions: view.versions })!
  expect(html).toContain("<span>Active</span><strong>4</strong>")
  expect(html).toContain("<span>Terminated</span><strong>2</strong>")
  expect(html).toContain("<span>Attrition YTD</span><strong>22.2%</strong>")
  expect(html).toContain("<span>Average tenure (months)</span><strong>9.0</strong>")
  expect(html).toContain("<span>Staff ratio</span><strong>30</strong>")
  expect(html).toContain("<span>Talent</span><strong>3</strong>")
  expect(html).toContain("<td>A Leader</td><td>2</td><td>1</td>")
})

test("all four years select departures and user exact, prior and cross-year fallback", () => {
  const years = byYear(fixture())
  expect(Object.keys(years).sort()).toEqual(["2024", "2025", "2026", "2027"])
  expect(years["2024"]).toMatchObject({ departures: 0, attritionPercent: 0, users: 300, usersMonth: 12, staffRatio: 75, departureDetails: [] })
  expect(years["2025"]).toMatchObject({ departures: 1, attritionPercent: 100 / 4.5, users: 50, usersMonth: 12, staffRatio: 13, departureDetails: [{ id: "f", name: "Flo", end: "2025-08-01" }] })
  expect(years["2026"]).toMatchObject({ departures: 1, users: 120, usersMonth: 6, departureDetails: [{ id: "e", name: "Eli", end: "2026-02-01" }] })
  expect(years["2027"]).toMatchObject({ departures: 0, users: 300, usersMonth: 12, staffRatio: 75, departureDetails: [] })
  expect(years["2024"]).toMatchObject({ averageHeadcount: 4, tenureCount: 2, staffPercent: 1.3333333333333335 })
  expect(years["2025"]).toMatchObject({ averageHeadcount: 4.5, tenureCount: 2, staffPercent: 8 })
  expect(years["2027"]).toMatchObject({ averageHeadcount: 4, tenureCount: 2, staffPercent: 1.3333333333333335 })
})

test("current-year prior user value wins over a future month and does not use page month", () => {
  const state = fixture()
  state.data.itUsersMonthly = [{ year: 2026, month: 2, users: 44 }, { year: 2026, month: 9, users: 400 }]
  expect(byYear(state)["2026"]).toMatchObject({ usersMonth: 6, users: 44, staffRatio: 11 })
})

test("zero users or no active members yields null staff ratio and zero-denominator attrition", () => {
  const state = fixture()
  state.data.itUsersMonthly = [{ year: 2026, month: 6, users: 0 }]
  expect(byYear(state)["2026"]).toMatchObject({ users: 0, staffRatio: null })
  expect(byYear(state)["2026"]).toMatchObject({ averageHeadcount: 4.5, tenureCount: 2, staffPercent: null })
  const noActive = empty()
  noActive.data.members = [{ id: "l", status: "On Leave" }]
  noActive.data.itUsersMonthly = [{ year: 2026, month: 6, users: 100 }]
  expect(byYear(noActive)["2026"]).toMatchObject({ active: 0, terminated: 0, departures: 0, attritionPercent: 0, averageTenureMonths: null, users: 100, staffRatio: null })
  expect(byYear(noActive)["2026"]).toMatchObject({ averageHeadcount: 0, tenureCount: 0, staffPercent: 0 })
  noActive.data.members = [{ id: "t", status: "Terminated", end: "2026-01-01" }]
  expect(byYear(noActive)["2026"]).toMatchObject({ active: 0, departures: 1, attritionPercent: 200, staffRatio: null })
  expect(byYear(noActive)["2026"]).toMatchObject({ averageHeadcount: 0.5, tenureCount: 0, staffPercent: 0 })
})

test("tenure excludes missing and invalid starts but keeps valid future negative months", () => {
  const state = empty()
  state.data.members = [{ id: "a", status: "Active", start: "2025-06-15" }, { id: "b", status: "Active", start: "2026-11-15" }, { id: "c", status: "Active", start: "invalid" }, { id: "d", status: "Active" }, { id: "e", status: "Terminated", start: "2000-01-01" }]
  expect(byYear(state)["2026"]?.averageTenureMonths).toBe(3.5)
  expect(byYear(state)["2026"]?.tenureCount).toBe(2)
  state.data.members = [{ id: "a", status: "Active", start: "invalid" }, { id: "b", status: "Active" }]
  expect(byYear(state)["2026"]?.averageTenureMonths).toBeNull()
  expect(byYear(state)["2026"]?.tenureCount).toBe(0)
})

test("leader rows, unassigned and TOTAL preserve identity, order and unmatched exclusion", () => {
  const year = byYear(fixture())["2026"]!
  expect(year.leaders).toEqual([
    { id: "7", name: "A Leader", domain: "Apps", location: "Brazil", active: 2, employees: 1, contractors: 1, averageTenureMonths: 9, talent: 1, solid: 1, laggers: 0 },
    { id: "8", name: "B Leader", domain: "Ops", location: "", active: 0, employees: 0, contractors: 0, averageTenureMonths: null, talent: 0, solid: 0, laggers: 0 },
  ])
  expect(year.unassigned).toEqual({ id: "", name: "", domain: "", location: "", active: 1, employees: 1, contractors: 0, averageTenureMonths: null, talent: 0, solid: 0, laggers: 1 })
  expect(year.leaderTotals).toEqual({ active: 2, employees: 1, contractors: 1, talent: 1, solid: 1, laggers: 0 })
  expect(year.active).toBe(4)
})

test("departure details are exact, ordered, year-scoped and contain no private extras", () => {
  const state = fixture()
  const members = state.data.members as Record<string, unknown>[]
  members.push({ id: 9, name: "Hao", status: "Terminated", end: "2026-11-01", notes: "PRIVATE-DETAIL", salary: "PRIVATE-DETAIL" })
  expect(byYear(state)["2026"]?.departureDetails).toEqual([{ id: "e", name: "Eli", end: "2026-02-01" }, { id: "9", name: "Hao", end: "2026-11-01" }])
})

test("leader and granted viewer summaries use real read mask and omit all classifications", () => {
  for (const actor of [leader, viewer]) {
    const state = fixture()
    state.data.summaries = ["Headcount Overview"]
    const view = domain.view(state, actor, environment)
    const years = view.data.nativeHeadcountSummaryByYear as Record<string, Summary>
    expect(years).toBeDefined()
    const year = years["2026"]!
    expect(year).toMatchObject({ active: 4, terminated: 2, averageTenureMonths: 9, employees: 3, contractors: 1 })
    expect(year).toMatchObject({ averageHeadcount: 4.5, tenureCount: 2, staffPercent: 3.3333333333333335 })
    for (const current of Object.values(years)) {
      for (const value of [current, ...current.leaders, current.unassigned, current.leaderTotals]) {
        expect(value).not.toHaveProperty("talent")
        expect(value).not.toHaveProperty("solid")
        expect(value).not.toHaveProperty("laggers")
      }
    }
    expect(JSON.stringify(view.data)).not.toMatch(/PRIVATE-NOTE|PRIVATE-OUTLOOK|PRIVATE-SALARY|PRIVATE-DEPARTURE|PRIVATE-LEADER|"cls"|"outlook"|"notes"/)
    const html = render("Headcount Overview", view.data, { actor, year: 2026, month: 6, at: environment.at, versions: view.versions })!
    expect(html).not.toContain("<span>Talent</span>")
    expect(html).not.toContain("Talent (active)")
  }
})

test("viewer without Headcount access gets no summary even when members are projected for Executive", () => {
  const state = fixture()
  const view = domain.view(state, viewer, environment)
  expect(view.data.members).toBeDefined()
  expect(view.data).not.toHaveProperty("nativeHeadcountSummaryByYear")
  const denied = domain.view(fixture(), { id: "outside", roles: ["finance"], canWrite: false }, environment)
  expect(denied.data).not.toHaveProperty("nativeHeadcountSummaryByYear")
})

test("authorized view preserves projected records, versions and snapshot except existing member reads", () => {
  for (const actor of [admin, leader]) {
    const state = fixture()
    state.versions = { "members:1": { version: 2, by: "writer" }, "leaders:7": { version: 3, by: "writer" } }
    const before = structuredClone(state)
    const view = domain.view(state, actor, environment)
    expect(view.data.nativeHeadcountSummaryByYear).toBeDefined()
    const members = view.data.members as Record<string, unknown>[]
    expect(members[0]).toMatchObject({ id: "1", name: "Ada", leaderId: 7, status: "Active", type: "Employee", start: "2025-06-15" })
    if (actor.roles.includes("admin")) expect(members[0]).toMatchObject({ cls: "Talent", notes: "PRIVATE-NOTE", outlook: "PRIVATE-OUTLOOK" })
    else expect(members[0]).toEqual({ id: "1", name: "Ada", leaderId: 7, status: "Active", type: "Employee", start: "2025-06-15" })
    expect(view.data.leaders).toEqual([{ id: "7", name: "A Leader", domain: "Apps", location: "Brazil" }, { id: "8", name: "B Leader", domain: "Ops", location: "" }])
    expect(view.data.itUsersMonthly).toEqual(before.data.itUsersMonthly)
    expect(view.versions).toEqual(before.versions)
    expect(JSON.stringify(view.data.nativeHeadcountSummaryByYear)).not.toMatch(/PRIVATE-/)
    expect(state).toEqual({ ...before, audit: [...before.audit, ...["1", "b", "c", "d", "e", "f", "g"].map((id) => ({ who: actor.id, at: environment.at, record: `members:${id}`, was: null, became: { read: true, member: id } }))] })
  }
})

test("legacy oracle: complete admin Headcount Overview with assigned, empty and unassigned rows", () => {
  const view = domain.view(fixture(), admin, environment)
  const html = render("Headcount Overview", view.data, { actor: admin, year: 2026, month: 1, at: environment.at, versions: view.versions })
  expect(html).toBe('<div class="metric-grid metric-grid--4"><article class="metric"><span>Active</span><strong>4</strong></article><article class="metric"><span>Terminated</span><strong>2</strong></article><article class="metric"><span>Attrition YTD</span><strong>22.2%</strong></article><article class="metric"><span>Average tenure (months)</span><strong>9.0</strong></article><article class="metric"><span>Staff ratio</span><strong>30</strong></article><article class="metric"><span>Contractors</span><strong>1</strong></article><article class="metric"><span>Employees</span><strong>3</strong></article><article class="metric"><span>Talent</span><strong>3</strong></article></div><div class="table-scroll"><table><thead><tr><th scope="col">Leader</th><th scope="col">Active</th><th scope="col">Talent (active)</th></tr></thead><tbody><tr><td>A Leader</td><td>2</td><td>1</td></tr><tr><td>B Leader</td><td>0</td><td>0</td></tr><tr><td>No leader</td><td>1</td><td>0</td></tr></tbody></table></div><a href="?page=Team%20Structure">Team Structure</a>')
})

test("legacy oracle: complete masked domain leader Headcount Overview", () => {
  const view = domain.view(fixture(), leader, environment)
  const html = render("Headcount Overview", view.data, { actor: leader, year: 2026, month: 1, at: environment.at, versions: view.versions })
  expect(html).toBe('<div class="metric-grid metric-grid--4"><article class="metric"><span>Active</span><strong>4</strong></article><article class="metric"><span>Terminated</span><strong>2</strong></article><article class="metric"><span>Attrition YTD</span><strong>22.2%</strong></article><article class="metric"><span>Average tenure (months)</span><strong>9.0</strong></article><article class="metric"><span>Staff ratio</span><strong>30</strong></article><article class="metric"><span>Contractors</span><strong>1</strong></article><article class="metric"><span>Employees</span><strong>3</strong></article></div><div class="table-scroll"><table><thead><tr><th scope="col">Leader</th><th scope="col">Active</th></tr></thead><tbody><tr><td>A Leader</td><td>2</td></tr><tr><td>B Leader</td><td>0</td></tr><tr><td>No leader</td><td>1</td></tr></tbody></table></div><a href="?page=Team%20Structure">Team Structure</a>')
})

test("legacy oracle: complete empty admin Headcount Overview", () => {
  const view = domain.view(empty(), admin, environment)
  const html = render("Headcount Overview", view.data, { actor: admin, year: 2026, month: 6, at: environment.at, versions: view.versions })
  expect(html).toBe('<div class="metric-grid metric-grid--4"><article class="metric"><span>Active</span><strong>0</strong></article><article class="metric"><span>Terminated</span><strong>0</strong></article><article class="metric"><span>Attrition YTD</span><strong>0.0%</strong></article><article class="metric"><span>Average tenure (months)</span><strong>—</strong></article><article class="metric"><span>Staff ratio</span><strong>—</strong></article><article class="metric"><span>Contractors</span><strong>0</strong></article><article class="metric"><span>Employees</span><strong>0</strong></article><article class="metric"><span>Talent</span><strong>0</strong></article></div><div class="table-scroll"><table><thead><tr><th scope="col">Leader</th><th scope="col">Active</th><th scope="col">Talent (active)</th></tr></thead><tbody><tr><td>No leader</td><td>0</td><td>0</td></tr></tbody></table></div><a href="?page=Team%20Structure">Team Structure</a>')
})

test("legacy oracle: complete prior-year admin view preserves ratio rounding and year selection", () => {
  const view = domain.view(fixture(), admin, environment)
  const html = render("Headcount Overview", view.data, { actor: admin, year: 2025, month: 1, at: environment.at, versions: view.versions })
  expect(html).toBe('<div class="metric-grid metric-grid--4"><article class="metric"><span>Active</span><strong>4</strong></article><article class="metric"><span>Terminated</span><strong>2</strong></article><article class="metric"><span>Attrition YTD</span><strong>22.2%</strong></article><article class="metric"><span>Average tenure (months)</span><strong>9.0</strong></article><article class="metric"><span>Staff ratio</span><strong>13</strong></article><article class="metric"><span>Contractors</span><strong>1</strong></article><article class="metric"><span>Employees</span><strong>3</strong></article><article class="metric"><span>Talent</span><strong>3</strong></article></div><div class="table-scroll"><table><thead><tr><th scope="col">Leader</th><th scope="col">Active</th><th scope="col">Talent (active)</th></tr></thead><tbody><tr><td>A Leader</td><td>2</td><td>1</td></tr><tr><td>B Leader</td><td>0</td><td>0</td></tr><tr><td>No leader</td><td>1</td><td>0</td></tr></tbody></table></div><a href="?page=Team%20Structure">Team Structure</a>')
})
