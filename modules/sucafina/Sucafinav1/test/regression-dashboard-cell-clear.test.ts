// INV-DASH-CELL-CLEAR: exercise the production dashboard and planner commands.
import { expect, test } from "bun:test"
import type { Actor, Command, Environment, Snapshot } from "../runtime/contract.ts"
import { rows } from "../runtime/contract.ts"
import { domain, render } from "../runtime/dashboard-budget.ts"
import { computeBudgetTotals, effectiveMonthlyBudget } from "../src/dashboard-accounts.ts"

const admin: Actor = { id: "directory-admin", canWrite: true, roles: ["admin"] }
const leader: Actor = { id: "leader", canWrite: true, roles: ["domain leader"] }
const env: Environment = { at: "2026-11-12T12:00:00Z", id: () => "new-entry", directory: [] }
const amounts = { budget: 5000.25, actual: 4000.75, forecast: 3000.125 }

function setup(kind: "opex" | "capex"): Snapshot {
  const collection = kind === "opex" ? "opexOwners" : "capexProjects"
  const entries = kind === "opex" ? "opexEntries" : "capexEntries"
  const ref = kind === "opex" ? "ownerId" : "projId"
  return {
    data: {
      [collection]: [{ id: "line", name: "Apps", budget: 12000 }],
      [entries]: [
        { id: "jan", [ref]: "line", year: 2026, month: 1, ...amounts },
        { id: "dec", [ref]: "line", year: 2026, month: 12, budget: 0, actual: 7.25, forecast: 8.5 },
        { id: "old", [ref]: "line", year: 2025, month: 1, budget: 31, actual: 32, forecast: 33 },
      ],
      budgetLineIds: { leader: [`${collection}:line`] },
    },
    versions: { [`${entries}:jan`]: { version: 3, by: "other" } },
    sequences: {}, audit: [], notices: [],
  }
}

function command(kind: "opex" | "capex", values: Record<string, unknown>, id = "jan", version = 3): Command {
  return {
    page: kind === "opex" ? "OPEX Detail" : "CAPEX Projects",
    action: "save-entry", id, version,
    values: { [kind === "opex" ? "ownerId" : "projId"]: "line", year: 2026, month: 1, ...values },
  }
}

function entry(state: Snapshot, kind: "opex" | "capex", id = "jan") {
  const result = rows(state.data[kind === "opex" ? "opexEntries" : "capexEntries"]).find((row) => row.id === id)
  if (!result) throw new Error(`Missing entry ${id}`)
  return result
}

for (const kind of ["opex", "capex"] as const) {
  for (const field of ["budget", "actual", "forecast"] as const) {
    for (const cleared of [null, ""] as const) {
      test(`INV-DASH-CELL-CLEAR ${kind} ${field} submitted ${cleared === null ? "null" : "blank"} clears existing month`, () => {
        const state = setup(kind)
        const untouched = structuredClone(rows(state.data[kind === "opex" ? "opexEntries" : "capexEntries"]).slice(1))
        expect(domain.execute(state, admin, command(kind, { ...amounts, [field]: cleared }), env)).toMatchObject({ ok: true })
        const saved = entry(state, kind)
        expect(saved).toMatchObject({ ...amounts, [field]: 0 })
        expect(rows(state.data[kind === "opex" ? "opexEntries" : "capexEntries"]).slice(1)).toEqual(untouched)
        expect(state.versions[`${kind === "opex" ? "opexEntries" : "capexEntries"}:jan`]).toEqual({ version: 4, by: admin.id })
        if (field === "budget") {
          expect(effectiveMonthlyBudget(Number(saved.budget), 12000)).toBe(1000)
          const html = render(kind === "opex" ? "OPEX Detail" : "CAPEX Projects", state.data, {
            actor: admin, year: 2026, month: 1, at: env.at, versions: state.versions,
          }) ?? ""
          const section = html.split("<h2>Apps</h2>")[1]?.split("</section>")[0] ?? ""
          const january = section.split("<tr>").find((part) => part.startsWith("<td>1</td>")) ?? ""
          expect(january).toStartWith("<td>1</td><td>$1000</td>")
        }
        const totals = computeBudgetTotals({
          [kind === "opex" ? "opexOwners" : "capexProjects"]: [{ id: "line", budget: 12000 }],
          [kind === "opex" ? "opexEntries" : "capexEntries"]: rows(state.data[kind === "opex" ? "opexEntries" : "capexEntries"]).map((row) => ({
            year: Number(row.year), month: Number(row.month),
            [kind === "opex" ? "ownerId" : "projId"]: String(row[kind === "opex" ? "ownerId" : "projId"]),
            budget: Number(row.budget), actual: Number(row.actual), forecast: Number(row.forecast),
          })),
        }, 2026)
        expect(totals[kind === "opex" ? "opexActual" : "capexActual"]).toBe((field === "actual" ? 0 : amounts.actual) + 7.25)
        expect(totals[kind === "opex" ? "opexForecast" : "capexForecast"]).toBe((field === "forecast" ? 0 : amounts.forecast) + 8.5)
        expect(totals[kind === "opex" ? "opexBudget" : "capexBudget"]).toBe(field === "budget" ? 12000 : 16000.25)
      })
    }
  }

  test(`INV-DASH-CELL-CLEAR ${kind} typed zero and positive fractional values persist`, () => {
    const state = setup(kind)
    expect(domain.execute(state, leader, command(kind, { budget: 0, actual: 0, forecast: 0 }), env)).toMatchObject({ ok: true })
    expect(entry(state, kind)).toMatchObject({ budget: 0, actual: 0, forecast: 0 })
    expect(domain.execute(state, admin, command(kind, { budget: 12.345, actual: 0.125, forecast: 900.01 }, "jan", 4), env)).toMatchObject({ ok: true })
    expect(entry(state, kind)).toMatchObject({ budget: 12.345, actual: 0.125, forecast: 900.01 })
    expect(effectiveMonthlyBudget(Number(entry(state, kind).budget), 12000)).toBe(12.345)
  })

  test(`INV-DASH-CELL-CLEAR ${kind} missing month accepts null and blank as zero`, () => {
    const state = setup(kind)
    expect(domain.execute(state, admin, command(kind, { month: 2, budget: null, actual: "", forecast: null }, "", 0), env)).toMatchObject({ ok: true })
    expect(entry(state, kind, "new-entry")).toMatchObject({ month: 2, budget: 0, actual: 0, forecast: 0 })
    expect(entry(state, kind)).toMatchObject(amounts)
  })

  test(`INV-DASH-CELL-CLEAR ${kind} stale, unauthorized and invalid saves roll back`, () => {
    const state = setup(kind)
    const before = structuredClone(state)
    expect(domain.execute(state, admin, command(kind, { ...amounts, actual: null }, "jan", 2), env)).toMatchObject({ ok: false, status: 409, by: "other" })
    expect(state).toEqual(before)
    expect(domain.execute(state, { id: "outsider", canWrite: true, roles: ["domain leader"] }, command(kind, { ...amounts, actual: null }), env)).toMatchObject({ ok: false, status: 403 })
    expect(state).toEqual(before)
    expect(domain.execute(state, admin, command(kind, { ...amounts, forecast: "invalid" }), env)).toMatchObject({ ok: false, status: 422 })
    expect(state).toEqual(before)
  })
}

test("INV-DASH-CELL-CLEAR planner actual and forecast null stay null", async () => {
  const { domain } = await import("../runtime/planner.ts")
  const state: Snapshot = {
    data: { versions: [{ id: "v", name: "Plan", year: 2027, locked: false, closed: 0, lines: [{ id: "L1", sec: "opex", el: "services", name: "Licences", a: [1, ...Array(11).fill(null)], f: [2, ...Array(11).fill(null)] }], projects: [], hc: { positions: [], rates: [] }, fx: [], lists: {} }], officials: {} },
    versions: {}, sequences: {}, audit: [], notices: [],
  }
  expect(domain.execute(state, admin, {
    page: "OPEX", action: "save", id: "L1", version: 0,
    values: { versionId: "v", collection: "lines", a0: null, f0: null },
  }, env)).toMatchObject({ ok: true })
  const line = rows(rows(state.data.versions)[0]?.lines)[0]
  expect(line?.a).toEqual(Array(12).fill(null))
  expect(line?.f).toEqual(Array(12).fill(null))
})
