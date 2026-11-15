import { expect, test } from "bun:test"
import { SfPlanner } from "../../../../../packages/schema/src/sucafina/planner.ts"
import { prepareSfPlannerMonthlyRange, unresolvedSfPlannerMonthlyRows } from "../../../../../packages/client/src/sucafina/planner/monthly.ts"
import { domain } from "../../runtime/planner.ts"
import { prepareMonthlyDrafts, previewMonthlyDrafts } from "../../product/planner/monthly-edit.ts"
import { projectMonthlyGrid } from "../../product/planner/monthly-grid.ts"
import type { Snapshot } from "../../runtime/contract.ts"

const actor = { id: "real-directory-principal", roles: ["admin"], canWrite: true }
const env = { at: "2026-11-15T12:00:00Z", id: () => "new-record", directory: [{ id: actor.id, name: "Operator" }] }
function fixture(): Snapshot {
  return {
    data: {
      versions: [{
        id: "plan", name: "Plan", year: 2026, locked: false, closed: 0,
        lines: [{
          id: "line", name: "Operations", sec: "opex", el: "licenses", cur: "USD",
          annual: 0, b: Array(12).fill(0), bm: Array(12).fill(false),
          a: Array(12).fill(null), f: Array(12).fill(null),
        }],
        projects: [], fx: [], lists: {},
        hc: { positions: [], rates: [], inc: 0, incMonth: 1, hrAF: {} },
      }],
      officials: {}, entities: [], allocations: [], roster: [],
    },
    versions: {}, sequences: {}, audit: [], notices: [],
  }
}
test("A02 exports exactly the 7 page reads, 29 legacy commands and 3 Planner ports", () => {
  const ids = Object.keys(SfPlanner.operations)
  const reads = ids.filter((id) => id.startsWith("domain.page."))
  const commands = ids.filter((id) => id.startsWith("domain.command."))
  const hosts = ids.filter((id) => id.startsWith("planner."))
  expect([reads.length, commands.length, hosts.length]).toEqual([7, 29, 3])
  expect(ids.length).toBe(39)
  expect(new Set(ids).size).toBe(39)
  for (const [id, binding] of Object.entries(SfPlanner.operations)) {
    expect(binding.operationId).toBe(id)
    expect(binding.pathTemplate.startsWith("{mount}/")).toBe(true)
    expect(binding.responseMode).toBe("json")
    expect(binding.method).toBe(id.startsWith("domain.page.") ? "GET" : "POST")
  }
  expect(SfPlanner.operations["planner.monthly.preview"].fixedQuery).toEqual({ sf: "workbench-planner" })
  expect(SfPlanner.operations["planner.monthly.apply"].fixedBodyDiscriminator).toEqual({ action: "apply" })
  expect(SfPlanner.operations["domain.command.CAP23.official"].fixedBodyDiscriminator).toEqual({ page: "Versions", action: "official" })
})
test("UI 0..11 converts exactly once to host 1..12, with original money text", () => {
  const prepared = prepareSfPlannerMonthlyRange("OPEX", "plan", [{
    rowId: "line", revision: 0, cells: [
      { monthIndex: 0, measure: "budget", text: "0" },
      { monthIndex: 11, measure: "forecast", text: "" },
      { monthIndex: 3, measure: "actual", text: "not-a-number" },
    ],
  }])
  expect(prepared.status).toBe("ready")
  if (prepared.status !== "ready") return
  expect(prepared.input.drafts[0]!.cells.map((c) => c.month)).toEqual([1, 12, 4])
  expect(prepared.input.drafts[0]!.cells.map((c) => c.text)).toEqual(["0", "", "not-a-number"])
  const parsed = prepareMonthlyDrafts("OPEX", "plan", prepared.input.drafts)
  expect(parsed[0]!.errors).toEqual([{ cell: prepared.input.drafts[0]!.cells[2], reason: "invalid-number" }])
  expect(parsed[0]!.command).toBeUndefined()
})
test("bounds, duplicate cells, duplicate rows and impossible month are rejected before transport", () => {
  expect(prepareSfPlannerMonthlyRange("CAPEX", "plan", [{
    rowId: "a", revision: 0, cells: [{ monthIndex: 12, measure: "budget", text: "1" }],
  }])).toMatchObject({ status: "invalid", reason: "month-index" })
  expect(prepareSfPlannerMonthlyRange("OPEX", "plan", [{
    rowId: "a", revision: 0, cells: [
      { monthIndex: 0, measure: "budget", text: "1" },
      { monthIndex: 0, measure: "budget", text: "2" },
    ],
  }])).toMatchObject({ status: "invalid", reason: "duplicate-cell" })
  expect(prepareSfPlannerMonthlyRange("OPEX", "plan", [
    { rowId: "a", revision: 0, cells: [{ monthIndex: 0, measure: "budget", text: "" }] },
    { rowId: "a", revision: 0, cells: [{ monthIndex: 1, measure: "budget", text: "1" }] },
  ])).toMatchObject({ status: "invalid", reason: "duplicate-row" })
})
test("pure domain simulation leaves the authoritative snapshot and revision untouched", () => {
  const state = fixture()
  const before = structuredClone(state)
  const drafts = [{ rowId: "line", revision: 0, cells: [
    { month: 1, measure: "budget" as const, text: "0" },
    { month: 12, measure: "forecast" as const, text: "" },
  ] }]
  const preview = previewMonthlyDrafts(state, actor, env, "OPEX", "plan", drafts)
  expect(state).toEqual(before)
  expect(preview.rows).toHaveLength(1)
  expect(preview.rows[0]?.result?.ok).toBe(true)
  const grid = projectMonthlyGrid(domain.view(state, actor, env), actor, "OPEX", "plan")
  expect(grid?.rows[0]?.cells[0]?.budget.value).toBe(0)
  expect(grid?.rows[0]?.cells[0]?.forecast.stored).toBe(null)
  expect(grid?.rows[0]?.cells[0]?.forecast.source).toBe("inherited-budget")
  expect(state.audit).toHaveLength(0)
})
test("CAS conflicts still belong to the producer and do not mutate a second time", () => {
  const state = fixture()
  const first = domain.execute(state, actor, {
    page: "OPEX", action: "save", id: "line", version: 0,
    values: { versionId: "plan", b0: 100 },
  }, env)
  expect(first.ok).toBe(true)
  const snapshot = structuredClone(state)
  const stale = domain.execute(state, actor, {
    page: "OPEX", action: "save", id: "line", version: 0,
    values: { versionId: "plan", b0: 200 },
  }, env)
  expect(stale).toMatchObject({ ok: false, status: 409, currentVersionCAS: 1 })
  expect(state).toEqual(snapshot)
})
test("unknown outcome is retained verbatim; partial known success retains only non-applied rows", () => {
  const sent = {
    page: "OPEX" as const, versionId: "plan",
    drafts: [
      { rowId: "a", revision: 0, cells: [{ measure: "budget" as const, month: 1, text: "0" }] },
      { rowId: "b", revision: 0, cells: [{ measure: "forecast" as const, month: 2, text: "" }] },
    ],
  }
  const unknown = unresolvedSfPlannerMonthlyRows(sent, { kind: "transport-error", reason: "outcome-unknown" })
  expect(unknown).toEqual({ status: "outcome-unknown", rows: sent.drafts })
  const known = unresolvedSfPlannerMonthlyRows(sent, {
    kind: "response", status: 200, headers: {},
    body: { status: "ok", value: {
      view: { data: {}, versions: {} },
      rows: [
        { draft: sent.drafts[0], errors: [], result: { ok: true } },
        { draft: sent.drafts[1], errors: [{ reason: "stale" }], result: { ok: false, status: 409 } },
      ],
    } },
  })
  expect(known.status).toBe("known")
  expect(known.rows).toEqual([sent.drafts[1]])
})
