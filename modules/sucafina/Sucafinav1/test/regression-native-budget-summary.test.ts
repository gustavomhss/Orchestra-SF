import { expect, test } from "bun:test"
import type { Actor, Snapshot } from "../runtime/contract.ts"
import { domain, render } from "../runtime/dashboard-budget.ts"
import { budgetChartSeries, computeBudgetTotals } from "../src/dashboard-accounts.ts"
import { empty } from "./fixture/persistence.ts"

const environment = { at: "2026-06-15T12:00:00Z", id: () => "unused", directory: [] }
const admin: Actor = { id: "budget-admin", canWrite: true, roles: ["admin"] }
const viewer: Actor = { id: "budget-viewer", canWrite: false, roles: ["viewer"] }
const leader: Actor = { id: "budget-leader", canWrite: true, roles: ["domain leader"] }

type Category = { budget: number; actual: number; forecast: number; variance: number; actualBudgetPercent: number | null }
type YearSummary = { currentMonth: number; opex?: Category; capex?: Category; total?: Category; monthlyBudget?: number[] }

function summary(snapshot: Snapshot, actor: Actor = admin, at = environment.at) {
  const view = domain.view(snapshot, actor, { ...environment, at })
  expect(view.data.nativeBudgetSummaryByYear).toBeDefined()
  return view.data.nativeBudgetSummaryByYear as Record<string, YearSummary>
}

function reference() {
  const snapshot = empty()
  snapshot.data.opexOwners = [{ id: 1, name: "Licenses", budget: 1200 }]
  snapshot.data.opexEntries = [
    { ownerId: 1, year: 2026, month: 1, budget: 0, actual: 10, forecast: 20 },
    { ownerId: 1, year: 2026, month: 2, budget: 200, actual: 20, forecast: 30 },
    { ownerId: 1, year: 2026, month: 2, budget: 900, actual: 30, forecast: 40 },
    { ownerId: 1, year: 2025, month: 2, budget: 800, actual: 9000, forecast: 9000 },
  ]
  snapshot.data.capexProjects = [{ id: 2, name: "Equipment", budget: 600 }]
  snapshot.data.capexEntries = [
    { projectId: 2, year: 2026, month: 3, budget: 150, actual: 40, forecast: 50 },
    { projectId: 2, year: 2027, month: 1, budget: 1000, actual: 9000, forecast: 9000 },
  ]
  return snapshot
}

test("annual categories use actual helper totals and legacy Budget Overview render", () => {
  const snapshot = reference()
  const projected = domain.view(snapshot, admin, environment)
  const byYear = projected.data.nativeBudgetSummaryByYear as Record<string, YearSummary>
  expect(byYear).toBeDefined()
  const result = byYear["2026"]!
  // This fixture already uses valid numeric values; no production normalization is copied here.
  const totals = computeBudgetTotals({
    opexOwners: snapshot.data.opexOwners as { id: number; budget: number }[],
    opexEntries: snapshot.data.opexEntries as { ownerId: number; year: number; month: number; budget: number; actual: number; forecast: number }[],
    capexProjects: snapshot.data.capexProjects as { id: number; budget: number }[],
    capexEntries: snapshot.data.capexEntries as { projectId: number; year: number; month: number; budget: number; actual: number; forecast: number }[],
  }, 2026)
  expect(totals).toEqual({ opexBudget: 1300, opexActual: 60, opexForecast: 90, capexBudget: 700, capexActual: 40, capexForecast: 50, totalBudget: 2000, totalActual: 100, totalForecast: 140 })
  expect(result.opex).toEqual({ budget: totals.opexBudget, actual: totals.opexActual, forecast: totals.opexForecast, variance: 1210, actualBudgetPercent: 60 / 1300 * 100 })
  expect(result.capex).toEqual({ budget: totals.capexBudget, actual: totals.capexActual, forecast: totals.capexForecast, variance: 650, actualBudgetPercent: 40 / 700 * 100 })
  expect(result.total).toEqual({ budget: totals.totalBudget, actual: totals.totalActual, forecast: totals.totalForecast, variance: 1860, actualBudgetPercent: 5 })
  const html = render("Budget Overview", projected.data, { actor: admin, year: 2026, month: 1, at: environment.at, versions: projected.versions })!
  expect(html).toContain('<span>Budget — 12 months</span><strong>$2000</strong>')
  expect(html).toContain('<span>Actuals — 12 months</span><strong>$100</strong>')
  expect(html).toContain('<span>Forecast — 12 months</span><strong>$140</strong>')
  expect(html).toContain('<span>Variance — budget minus forecast</span><strong>$1860</strong>')
})

test("flat monthly chart follows the public helper, not effective entry budgets", () => {
  const year = summary(reference())["2026"]!
  expect(year.monthlyBudget).toEqual(budgetChartSeries(2000))
  expect(year.monthlyBudget).toHaveLength(12)
  expect(year.monthlyBudget?.every((amount) => amount === 2000 / 12)).toBe(true)
})

test("year map has exactly four years and independently excludes other-year entries", () => {
  const years = summary(reference())
  expect(Object.keys(years).sort()).toEqual(["2024", "2025", "2026", "2027"])
  expect(years["2024"]?.opex).toEqual({ budget: 1200, actual: 0, forecast: 0, variance: 1200, actualBudgetPercent: 0 })
  expect(years["2025"]?.opex).toEqual({ budget: 1900, actual: 9000, forecast: 9000, variance: -7100, actualBudgetPercent: 9000 / 1900 * 100 })
  expect(years["2027"]?.capex).toEqual({ budget: 1550, actual: 9000, forecast: 9000, variance: -7450, actualBudgetPercent: 9000 / 1550 * 100 })
})

test("current month uses valid stored values and local year-dependent fallback", () => {
  const snapshot = reference()
  snapshot.data.budgetCurrentMonth = { 2024: "2", 2025: 13, 2026: 0, 2027: 4 }
  const years = summary(snapshot)
  expect(Object.fromEntries(Object.entries(years).map(([year, item]) => [year, item.currentMonth])))
    .toEqual({ 2024: 2, 2025: 12, 2026: 6, 2027: 4 })
  const fallback = summary(empty())
  expect(Object.fromEntries(Object.entries(fallback).map(([year, item]) => [year, item.currentMonth])))
    .toEqual({ 2024: 12, 2025: 12, 2026: 6, 2027: 1 })
})

test("positive, negative and zero variance and uncapped ratios are category-specific", () => {
  const snapshot = empty()
  snapshot.data.opexOwners = [{ id: "o", budget: 1200 }]
  snapshot.data.opexEntries = [{ ownerId: "o", year: 2026, month: 12, actual: 1800, forecast: 1000 }]
  snapshot.data.capexProjects = [{ id: "c", budget: 1200 }]
  snapshot.data.capexEntries = [{ projId: "c", year: 2026, month: 12, actual: 600, forecast: 1400 }]
  const year = summary(snapshot)["2026"]!
  expect(year.opex).toEqual({ budget: 1200, actual: 1800, forecast: 1000, variance: 200, actualBudgetPercent: 150 })
  expect(year.capex).toEqual({ budget: 1200, actual: 600, forecast: 1400, variance: -200, actualBudgetPercent: 50 })
  expect(year.total).toEqual({ budget: 2400, actual: 2400, forecast: 2400, variance: 0, actualBudgetPercent: 100 })
})

test("complete empty arrays produce real zero categories and null ratios", () => {
  const snapshot = empty()
  Object.assign(snapshot.data, { opexOwners: [], opexEntries: [], capexProjects: [], capexEntries: [] })
  const year = summary(snapshot)["2026"]!
  const zero = { budget: 0, actual: 0, forecast: 0, variance: 0, actualBudgetPercent: null }
  expect(year).toEqual({ currentMonth: 6, opex: zero, capex: zero, total: zero, monthlyBudget: Array(12).fill(0) })
  snapshot.data.opexOwners = [{ id: "zero", budget: 0 }]
  snapshot.data.opexEntries = [{ ownerId: "zero", year: 2026, month: 1, actual: 10, forecast: 20 }]
  expect(summary(snapshot)["2026"]?.opex).toEqual({ budget: 0, actual: 10, forecast: 20, variance: -20, actualBudgetPercent: null })
})

test("missing, null and malformed collections omit only their dependent categories", () => {
  for (const invalid of [undefined, null, {}, "bad"]) {
    for (const key of ["opexOwners", "opexEntries", "capexProjects", "capexEntries"]) {
      const snapshot = empty()
      Object.assign(snapshot.data, { opexOwners: [], opexEntries: [], capexProjects: [], capexEntries: [] })
      if (invalid === undefined) delete snapshot.data[key]
      else snapshot.data[key] = invalid
      const year = summary(snapshot)["2026"]!
      expect(Object.keys(year).sort()).toEqual(key.startsWith("opex") ? ["capex", "currentMonth"] : ["currentMonth", "opex"])
      expect(key.startsWith("opex") ? year.capex : year.opex).toEqual({ budget: 0, actual: 0, forecast: 0, variance: 0, actualBudgetPercent: null })
    }
  }
  expect(summary(empty())["2026"]).toEqual({ currentMonth: 6 })
})

test("runtime normalization ignores numeric strings and keeps projectId alias and numeric ids", () => {
  const snapshot = empty()
  snapshot.data.opexOwners = [{ id: 3, budget: 1200 }]
  snapshot.data.opexEntries = [{ ownerId: 3, year: 2026, month: 1, budget: "700", actual: "99", forecast: "88" }]
  snapshot.data.capexProjects = [{ id: 4, budget: 600 }]
  snapshot.data.capexEntries = [{ projectId: 4, year: 2026, month: 1, budget: 150, actual: 25, forecast: 30 }]
  const year = summary(snapshot)["2026"]!
  expect(year.opex).toEqual({ budget: 1200, actual: 0, forecast: 0, variance: 1200, actualBudgetPercent: 0 })
  expect(year.capex).toEqual({ budget: 700, actual: 25, forecast: 30, variance: 670, actualBudgetPercent: 25 / 700 * 100 })
})

test("authorized roles preserve raw projection and snapshot except existing member-read audit", () => {
  for (const actor of [admin, viewer, leader]) {
    const snapshot = reference()
    snapshot.data.members = [{ id: "member-1", status: "Active", notes: "PRIVATE-MEMBER-MARKER" }]
    snapshot.data.unrelated = { secret: "PRIVATE-OTHER-MARKER" }
    snapshot.versions = { "opexOwners:1": { version: 3, by: "prior" } }
    const before = structuredClone(snapshot)
    const view = domain.view(snapshot, actor, environment)
    expect(view.data.nativeBudgetSummaryByYear).toBeDefined()
    for (const key of ["opexOwners", "opexEntries", "capexProjects", "capexEntries"]) expect(view.data[key]).toEqual(before.data[key])
    expect(view.data.opexEntries).not.toBe(snapshot.data.opexEntries)
    expect(JSON.stringify(view.data)).not.toContain("PRIVATE-MEMBER-MARKER")
    expect(JSON.stringify(view.data)).not.toContain("PRIVATE-OTHER-MARKER")
    expect(snapshot).toEqual({ ...before, audit: [...before.audit, { who: actor.id, at: environment.at, record: "members:member-1", was: null, became: null }] })
    expect(view.versions).toEqual(before.versions)
  }
})

test("unauthorized actors receive exact empty view without any snapshot changes", () => {
  const snapshot = reference()
  snapshot.data.members = [{ id: "member-1", notes: "PRIVATE-MEMBER-MARKER" }]
  const before = structuredClone(snapshot)
  const denied: Actor = { id: "outsider", canWrite: true, roles: ["contributor"] }
  expect(domain.view(snapshot, denied, environment)).toEqual({ data: {}, versions: {} })
  expect(snapshot).toEqual(before)
})
