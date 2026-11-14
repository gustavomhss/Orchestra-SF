import { expect, test } from "bun:test"
import { projectDashboardScope } from "../../../product/dashboard/scope.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { Snapshot } from "../../../runtime/contract.ts"

const admin = { id: "admin", roles: ["admin"], canWrite: true }
const asOf = "2026-11-13T00:00:00Z"
const annual = { start: "2026-01-01", end: "2026-12-31" }

test("scoped budget projection ignores restricted unrelated content and detects compensating components", () => {
  const state: Snapshot = { data: { opexOwners: [{ id: "a", budget: 1200 }, { id: "b", budget: 1200 }], opexEntries: [], members: [{ id: "m", notes: "private" }] }, versions: {}, sequences: {}, audit: [], notices: [] }
  const selector = { page: "Budget Overview", fields: ["budgetMetrics"], period: annual }
  const before = structuredClone(state)
  const initial = projectDashboardScope(state, admin, selector, asOf)!
  expect(Object.keys(initial.selected)).toEqual(["budgetMetrics"])
  expect(state).toEqual(before)
  const changedPrivate = structuredClone(state)
  const members = changedPrivate.data.members as { notes: string }[]
  members[0]!.notes = "different private content"
  expect(projectDashboardScope(changedPrivate, admin, selector, asOf)).toEqual(initial)
  const changedComponents = structuredClone(state)
  const owners = changedComponents.data.opexOwners as { budget: number }[]
  owners[0]!.budget += 120
  owners[1]!.budget -= 120
  const projected = projectDashboardScope(changedComponents, admin, selector, asOf)!
  expect(projected.selected).toEqual(initial.selected)
  expect(projected.privateDependencyDigest).not.toBe(initial.privateDependencyDigest)
})

test("scope filters unrelated months and does not incorporate ungranted security inputs", () => {
  const state: Snapshot = { data: { summaries: ["IT Operations"], opexOwners: [{ id: "o", budget: 1200 }], opexEntries: [{ id: "jan", ownerId: "o", year: 2026, month: 1, actual: 10 }, { id: "feb", ownerId: "o", year: 2026, month: 2, actual: 20 }], opsTickets: [], secIncidents: [{ id: "restricted-incident-id", title: "confidential-incident-alpha" }] }, versions: {}, sequences: {}, audit: [], notices: [] }
  const jan = { page: "OPEX Detail", fields: ["opexEntries"], period: { start: "2026-01-01", end: "2026-01-31" } }
  const original = projectDashboardScope(state, admin, jan, asOf)!
  const changed = structuredClone(state)
  const entries = changed.data.opexEntries as { actual: number }[]
  entries[1]!.actual = 99
  expect(projectDashboardScope(changed, admin, jan, asOf)).toEqual(original)
  entries[0]!.actual = 11
  expect(digestSfValue(projectDashboardScope(changed, admin, jan, asOf))).not.toBe(digestSfValue(original))
  const viewer = { id: "viewer", roles: ["viewer"], canWrite: false }
  const ops = { page: "Executive Dashboard", fields: ["executiveMonths"], period: annual }
  const safe = projectDashboardScope(state, viewer, ops, asOf)!
  const revoked = structuredClone(state)
  revoked.data.secIncidents = [{ id: "restricted-incident-id", title: "confidential-incident-beta" }]
  expect(projectDashboardScope(revoked, viewer, ops, asOf)).toEqual(safe)
  expect(JSON.stringify(safe)).not.toContain("confidential-incident-alpha")
  expect(JSON.stringify(safe.selected)).not.toContain("restricted-incident-id")
})


test("February headcount scope excludes annual and other-month changes", () => {
  const state: Snapshot = { data: { members: [{ id: "f", status: "Terminated", end: "2026-02-01" }, { id: "m", status: "Terminated", end: "2026-03-01" }] }, versions: {}, sequences: {}, audit: [], notices: [] }
  const selector = { page: "Executive Dashboard", fields: ["executiveByYear"], period: { start: "2026-02-01", end: "2026-02-28" } }
  const before = projectDashboardScope(state, admin, selector, asOf)
  const changed = structuredClone(state)
  ;(changed.data.members as { end: string }[])[1]!.end = "2026-04-01"
  expect(projectDashboardScope(changed, admin, selector, asOf)).toEqual(before)
  const months = ((before!.selected.executiveByYear as Record<string, { monthlyDepartures: (number | null)[] }>)["2026"]!).monthlyDepartures
  expect(months[1]).toBe(1)
  expect(months[2]).toBeNull()
})


test("monthly budget series ignores other months while binding annual fallback", () => {
  const state: Snapshot = { data: { opexOwners: [{ id: "o", budget: 1200, name: "Owner" }], opexEntries: [{ id: "jan", ownerId: "o", year: 2026, month: 1, actual: 0 }, { id: "feb", ownerId: "o", year: 2026, month: 2, actual: 20 }, { id: "orphan", ownerId: "missing", year: 2026, month: 1, actual: 1 }] }, versions: {}, sequences: {}, audit: [], notices: [] }
  const selector = { page: "Budget Overview", fields: ["budgetSeries"], period: { start: "2026-01-01", end: "2026-01-31" } }
  const original = projectDashboardScope(state, admin, selector, asOf)
  const changed = structuredClone(state)
  ;(changed.data.opexEntries as { actual: number }[])[1]!.actual = 99
  ;(changed.data.opexEntries as { actual: number }[])[2]!.actual = 42
  ;(changed.data.opexOwners as { name: string }[])[0]!.name = "Renamed"
  expect(projectDashboardScope(changed, admin, selector, asOf)).toEqual(original)
  ;(changed.data.opexOwners as { budget: number }[])[0]!.budget = 2400
  expect(projectDashboardScope(changed, admin, selector, asOf)).not.toEqual(original)
})

test("monthly budget overrides exclude unused annual budgets from the scope", () => {
  const state: Snapshot = { data: { opexOwners: [{ id: "o", budget: 1200 }], opexEntries: [{ id: "jan", ownerId: "o", year: 2026, month: 1, budget: 200, actual: 0 }], capexProjects: [{ id: "p", budget: 2400 }], capexEntries: [{ id: "capex-jan", projId: "p", year: 2026, month: 1, budget: 300, actual: 0 }] }, versions: {}, sequences: {}, audit: [], notices: [] }
  const selector = { page: "Budget Overview", fields: ["budgetSeries"], period: { start: "2026-01-01", end: "2026-01-31" } }
  const original = projectDashboardScope(state, admin, selector, asOf)
  const changed = structuredClone(state)
  ;(changed.data.opexOwners as { budget: number }[])[0]!.budget = 3600
  ;(changed.data.capexProjects as { budget: number }[])[0]!.budget = 4800
  expect(projectDashboardScope(changed, admin, selector, asOf)).toEqual(original)
  ;(changed.data.capexEntries as { budget: number }[])[0]!.budget = 0
  expect(projectDashboardScope(changed, admin, selector, asOf)).not.toEqual(original)
})

test("milestone date scope isolates the selected dates and omits current private fields", () => {
  const state: Snapshot = { data: { projects: [{ id: "p", notes: "confidential-project-notes", milestones: [{ id: "m1", name: "Earlier", date: "2026-03-05", status: "done", notes: "secret-milestone" }, { id: "m2", name: "Later", date: "2026-08-10", status: "late" }] }] }, versions: {}, sequences: {}, audit: [], notices: [] }
  const selector = { page: "Portfolio Dashboard", fields: ["milestoneDates"], period: { start: "2026-02-01", end: "2026-05-31" } }
  const before = projectDashboardScope(state, admin, selector, asOf)!
  expect(before.selected.milestoneDates).toEqual([{ projectId: "p", id: "m1", name: "Earlier", date: "2026-03-05" }])
  expect(JSON.stringify(before)).not.toContain("secret-milestone")
  expect(JSON.stringify(before)).not.toContain("confidential-project-notes")
  const changed = structuredClone(state)
  const project = (changed.data.projects as { notes: string; milestones: { name: string; status: string }[] }[])[0]!
  project.notes = "other private value"
  project.milestones[0]!.status = "upcoming"
  project.milestones[1]!.name = "Unrelated future milestone"
  expect(projectDashboardScope(changed, admin, selector, asOf)).toEqual(before)
  project.milestones[0]!.name = "New current label"
  expect(projectDashboardScope(changed, admin, selector, asOf)).not.toEqual(before)
})

test("milestone status is observed only in a period containing today", () => {
  const state: Snapshot = { data: { projects: [{ id: "p", milestones: [{ id: "m", name: "Launch", date: "2026-03-05", status: "upcoming" }] }] }, versions: {}, sequences: {}, audit: [], notices: [] }
  const current = { page: "Portfolio Dashboard", fields: ["milestoneDates"], period: { start: "2026-01-01", end: "2026-12-31" } }
  const historical = { ...current, period: { start: "2026-03-01", end: "2026-03-31" } }
  const before = projectDashboardScope(state, admin, current, asOf)!
  const old = projectDashboardScope(state, admin, historical, asOf)!
  expect(before.selected.milestoneDates).toMatchObject([{ status: "upcoming" }])
  expect(JSON.stringify(old.selected)).not.toContain("upcoming")
  ;(state.data.projects as { milestones: { status: string }[] }[])[0]!.milestones[0]!.status = "late"
  expect(projectDashboardScope(state, admin, current, asOf)).not.toEqual(before)
  expect(projectDashboardScope(state, admin, historical, asOf)).toEqual(old)
})
