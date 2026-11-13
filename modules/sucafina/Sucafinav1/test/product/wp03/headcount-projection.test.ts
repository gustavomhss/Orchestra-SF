import { expect, test } from "bun:test"
import type { Snapshot } from "../../../runtime/contract.ts"
import { object, rows } from "../../../runtime/contract.ts"
import { domain } from "../../../runtime/planner.ts"
import { headcountStates, prepareHeadcountDelete, prepareHeadcountPositionSave, prepareHeadcountSync, projectHeadcount } from "../../../product/planner/headcount.ts"

const environment = { at: "2026-11-13T00:00:00Z", id: () => "new-position", directory: [] }
const hr = { id: "hr", roles: ["hr"], canWrite: true }

function fixture(): Snapshot {
  return { data: { versions: [{ id: "v1", name: "Plan", year: 2027, closed: 0, locked: false, projects: [], lines: [], lists: {}, fx: [], hc: { positions: [{ id: "person", name: "Person", type: "Employee", location: "Brazil", include: true, fte: 1, start: 7, end: 12, domain: "IT", rateId: "rate" }], rates: [{ id: "rate", name: "Brazil", locs: "Brazil", annual: 120000, cur: "USD" }], inc: 10, incMonth: 10, hrAF: {} } }] }, versions: {}, sequences: {}, audit: [], notices: [] }
}

test("headcount publishes planned monthly FTE and independent budget, actual, forecast and outlook", () => {
  const snapshot = fixture()
  const version = rows(snapshot.data.versions)[0]
  version.closed = 1
  object(version.hc).hrAF = { IT: { a: [500], f: [null, 0] } }
  const before = structuredClone(snapshot)
  const projected = projectHeadcount(snapshot, hr, environment, "v1")!
  const group = projected.groups[0]
  expect(projected.monthlyPlannedFte).toEqual([0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1])
  expect(projected.plannedDecemberFte).toBe(1)
  expect(group.monthlyBudgetUsd).toEqual([0, 0, 0, 0, 0, 0, 10000, 10000, 10000, 11000, 11000, 11000])
  expect(group.monthlyActualUsd?.slice(0, 2)).toEqual([500, null])
  expect(group.monthlyForecastUsd?.slice(0, 3)).toEqual([null, 0, null])
  expect(group.monthlyOutlookUsd?.slice(0, 3)).toEqual([500, 0, 0])
  expect(group.outlookSources?.slice(0, 3)).toEqual(["actual", "forecast", "budget"])
  expect(snapshot).toEqual(before)
})

test("missing rate and missing FX are scoped to the active domain and inherited budget month", () => {
  const snapshot = fixture()
  const version = rows(snapshot.data.versions)[0]
  version.closed = 1
  version.lines = [{ id: "foreign-license", sec: "opex", el: "licenses", cur: "EUR", b: Array(12).fill(100) }]
  version.fx = [{ id: "EUR", cur: "EUR", rate: null }]
  const hc = object(version.hc)
  hc.positions = [...rows(hc.positions), { id: "missing", name: "Unknown rate", src: "new", include: true, fte: 1, start: 7, end: 12, domain: "Finance", type: "Employee", location: "Unknown" }, { id: "foreign", name: "Unknown FX", include: true, fte: 0.5, start: 7, end: 12, domain: "Legal", type: "Employee", location: "France", rateId: "euro" }]
  hc.rates = [...rows(hc.rates), { id: "euro", name: "Europe", locs: "France", annual: 90000, cur: "EUR" }]
  hc.hrAF = { IT: { a: [10] }, Finance: { a: [500], f: [null, null, null, null, null, null, 0] }, Legal: { a: [250], f: [null, null, null, null, null, null, 20] } }
  const projected = projectHeadcount(snapshot, hr, environment, "v1")!
  const it = projected.groups.find((group) => group.domain === "IT")!
  const finance = projected.groups.find((group) => group.domain === "Finance")!
  const legal = projected.groups.find((group) => group.domain === "Legal")!
  expect(it.monthlyBudgetUsd?.slice(6)).toEqual([10000, 10000, 10000, 11000, 11000, 11000])
  expect(it.budgetState).toBe("known")
  expect(finance.monthlyBudgetUsd).toEqual([0, 0, 0, 0, 0, 0, null, null, null, null, null, null])
  expect(finance.monthlyOutlookUsd?.slice(0, 2)).toEqual([500, 0])
  expect(finance.monthlyOutlookUsd?.slice(6, 8)).toEqual([0, null])
  expect(finance.costNote).toBe("no-rate-is-not-confirmed-savings")
  expect(finance.monthlyPlannedFte[6]).toBe(1)
  expect(headcountStates(object(finance.positions[0]))).toEqual(["no-rate", "new-hire"])
  expect(legal.monthlyOutlookUsd?.slice(6, 8)).toEqual([20, null])
  expect(legal.costNote).toBe("missing-fx-is-not-confirmed-savings")
})

test("excluding an unpriced position removes capacity and cost contribution without deleting it", () => {
  const snapshot = fixture()
  const hc = object(rows(snapshot.data.versions)[0].hc)
  hc.rates = []
  const person = rows(hc.positions)[0]
  delete person.rateId
  expect(projectHeadcount(snapshot, hr, environment, "v1")!.groups[0].monthlyBudgetUsd?.[6]).toBeNull()
  const command = prepareHeadcountPositionSave("v1", "person", 0, { include: false })!
  expect(domain.execute(snapshot, hr, command, environment)).toMatchObject({ ok: true })
  const excluded = projectHeadcount(snapshot, hr, environment, "v1")!
  expect(excluded.monthlyPlannedFte).toEqual(Array(12).fill(0))
  expect(excluded.groups[0].monthlyBudgetUsd).toEqual(Array(12).fill(0))
  expect(excluded.groups[0].positions).toHaveLength(1)
  expect(excluded.groups[0].positions[0]).toMatchObject({ state: "excluded" })
})

test("headcount projections retain permitted domain aggregates and remove private position costs for owner and viewer", () => {
  const snapshot = fixture()
  rows(object(rows(snapshot.data.versions)[0].hc).positions)[0].rateOverride = 987654
  const expected = projectHeadcount(snapshot, hr, environment, "v1")!.groups[0]
  for (const role of ["viewer", "budget owner"]) {
    const projected = projectHeadcount(snapshot, { id: role, roles: [role], canWrite: role !== "viewer" }, environment, "v1")!
    expect(projected.monthlyPlannedFte[11]).toBe(1)
    expect(projected.rates).toEqual([])
    expect(projected.increase).toBeNull()
    expect(projected.groups[0]).toMatchObject({ costState: "known", budgetState: "known", monthlyOutlookUsd: expected.monthlyOutlookUsd, monthlyBudgetUsd: expected.monthlyBudgetUsd, monthlyActualUsd: expected.monthlyActualUsd, monthlyForecastUsd: expected.monthlyForecastUsd, outlookSources: expected.outlookSources })
    const serialized = JSON.stringify(projected)
    expect(serialized).not.toContain("987654")
    expect(serialized).not.toContain('"rateOverride"')
    expect(serialized).not.toContain('"rateId"')
    expect(serialized).not.toContain('"months"')
  }
})

test("roster sync preserves a manual domain and HR actual/forecast and rejects a locked plan", () => {
  const snapshot = fixture()
  const version = rows(snapshot.data.versions)[0]
  const hc = object(version.hc)
  Object.assign(rows(hc.positions)[0], { name: "Alice", domainManual: true })
  hc.positions = [...rows(hc.positions), { id: "absent", name: "Absent", include: true, fte: 1, start: 1, end: 12, domain: "IT" }]
  hc.hrAF = { IT: { a: [100], f: [null, 200] } }
  snapshot.data.roster = [{ name: "Alice", leader: "Leader", domain: "Other" }, { name: "Future", start: "2028-01-01" }, { name: "Terminated", status: "Terminated" }]
  const beforeAf = structuredClone(hc.hrAF)
  expect(domain.execute(snapshot, hr, prepareHeadcountSync("v1", 0)!, environment)).toMatchObject({ ok: true })
  const current = object(rows(snapshot.data.versions)[0].hc)
  expect(rows(current.positions).find((person) => person.id === "person")).toMatchObject({ domain: "IT", domainManual: true })
  expect(rows(current.positions).find((person) => person.id === "absent")).toMatchObject({ left: true })
  expect(rows(current.positions)).toHaveLength(2)
  expect(current.hrAF).toEqual(beforeAf)
  expect(domain.execute(snapshot, hr, prepareHeadcountDelete("v1", "rates", "rate", 0)!, environment)).toMatchObject({ ok: false, status: 422 })
  rows(snapshot.data.versions)[0].locked = true
  const beforeLocked = structuredClone(snapshot)
  expect(domain.execute(snapshot, hr, prepareHeadcountSync("v1", 1)!, environment)).toMatchObject({ ok: false, status: 403 })
  expect(snapshot).toEqual(beforeLocked)
})
