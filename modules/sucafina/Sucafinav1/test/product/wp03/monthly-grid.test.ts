import { expect, test } from "bun:test"
import type { Snapshot } from "../../../runtime/contract.ts"
import { object, rows } from "../../../runtime/contract.ts"
import { domain, render } from "../../../runtime/planner.ts"
import { projectMonthlyGrid, renderMonthlyGrid } from "../../../product/planner/monthly-grid.ts"
import { previewMonthlyDrafts, previewMonthlyOperation } from "../../../product/planner/monthly-edit.ts"

const environment = { at: "2026-11-13T00:00:00Z", id: () => "new-record", directory: [] }
const admin = { id: "admin", roles: ["admin"], canWrite: true }

function fixture(): Snapshot {
  return { data: { versions: [{ id: "v1", name: "Plan", year: 2027, closed: 1, locked: false, lines: [{ id: "line", name: "License <script>", sec: "opex", el: "licenses", owner: "owner", cur: "USD", annual: 1300, b: [200, ...Array(11).fill(100)], bm: [true, ...Array(11).fill(false)], a: [null, 0], f: [null, 0] }], projects: [], hc: { positions: [], rates: [], hrAF: {} }, fx: [], lists: {} }] }, versions: {}, sequences: {}, audit: [], notices: [] }
}

test("monthly grid distinguishes absent actual, explicit zero, inherited forecast and manual closed month", () => {
  const snapshot = fixture()
  const before = structuredClone(snapshot)
  const view = domain.view(snapshot, admin, environment)
  const cells = projectMonthlyGrid(view, admin, "OPEX", "v1")!.rows[0].cells
  expect(cells[0]).toMatchObject({ closed: true, manual: true, actual: { value: null, source: "absent" }, forecast: { value: 200, stored: null, source: "inherited-budget" } })
  expect(cells[1].forecast).toMatchObject({ value: 0, stored: 0, source: "explicit" })
  expect(cells[2].forecast).toMatchObject({ value: 100, stored: null, source: "inherited-budget" })
  const html = renderMonthlyGrid(view, admin, "OPEX", "v1")
  expect(html).toContain("Inherited budget")
  expect(html).toContain("Explicit zero")
  expect(html).toContain("Closed month")
  expect(html).toContain("scope=\"col\"")
  expect(html).not.toContain("<script>")
  expect(snapshot).toEqual(before)
})

test("monthly presentation matches field permissions for owner, finance and synthetic HR budget", () => {
  const snapshot = fixture()
  const version = rows(snapshot.data.versions)[0]
  object(version.hc).hrAF = { IT: { a: [1], f: [2] } }
  version.locked = true
  const owner = { id: "owner", roles: ["budget owner"], canWrite: true }
  const other = { ...owner, id: "someone-else" }
  const finance = { id: "finance", roles: ["finance"], canWrite: true }
  for (const [actor, budget, actual, forecast] of [[owner, false, false, true], [other, false, false, false], [finance, false, true, true]] as const) {
    const grid = projectMonthlyGrid(domain.view(snapshot, actor, environment), actor, "OPEX", "v1")!
    expect(grid.rows[0].cells[0]).toMatchObject({ budget: { editable: budget }, actual: { editable: actual }, forecast: { editable: forecast } })
    expect(grid.rows.find((line) => line.id === "HR:IT")!.cells[0].budget).toMatchObject({ source: "derived", editable: false })
  }
  const grid = projectMonthlyGrid(domain.view(snapshot, admin, environment), admin, "OPEX", "v1")!
  expect(grid.rows.find((line) => line.id === "HR:IT")!.cells[0].budget).toMatchObject({ source: "derived", editable: false })
})

test("real OPEX and CAPEX rendering mounts saved monthly states for the selected measure", () => {
  const snapshot = fixture()
  const version = rows(snapshot.data.versions)[0]
  version.lines = [...rows(version.lines), { id: "capex", name: "Server", sec: "capex", el: "hwo", cur: "USD", annual: 1200, b: Array(12).fill(100), bm: Array(12).fill(false), a: [0], f: [null, 0] }]
  const before = structuredClone(snapshot)
  const view = domain.view(snapshot, admin, environment)
  const context = { actor: admin, year: 2027, month: 1, at: environment.at, versions: view.versions }
  const opex = render("OPEX", { ...view.data, version: "v1", mode: "forecast" }, context)!
  expect(opex).toContain('class="planner-monthly-state"')
  expect(opex).toContain("OPEX forecast · Plan · 2027")
  expect(opex).toContain("Inherited budget")
  expect(opex).toContain("Explicit zero")
  expect(opex).toContain("Closed month")
  expect(opex).not.toContain('<tr data-planner-line="capex">')
  const capex = render("CAPEX", { ...view.data, version: "v1", mode: "actual" }, context)!
  expect(capex).toContain("CAPEX actual · Plan · 2027")
  expect(capex).toContain('<tr data-planner-line="capex">')
  expect(capex).toContain("Explicit zero")
  expect(capex).toContain("Absent")
  expect(capex).not.toContain('<tr data-planner-line="line">')
  expect(snapshot).toEqual(before)
})

test("annual previews retain the all-manual legacy reset and disclose the affected months", () => {
  const snapshot = fixture()
  const line = rows(rows(snapshot.data.versions)[0].lines)[0]
  line.bm = Array(12).fill(true)
  const before = structuredClone(snapshot)
  const preview = previewMonthlyOperation(snapshot, admin, environment, "OPEX", "v1", "line", 0, "annual", 1440)
  expect(preview).toMatchObject({ annualBefore: 1300, annualAfter: 1440, allMonthsManual: true, errors: [] })
  expect(preview.changedMonths).toEqual(Array.from({ length: 12 }, (_, index) => index + 1))
  expect(preview.after.every((cell) => cell.value === 120 && cell.manual === false)).toBe(true)
  expect(snapshot).toEqual(before)
})

test("batch preview exposes changed cells while retaining invalid text and stale row edits", () => {
  const snapshot = fixture()
  const preview = previewMonthlyDrafts(snapshot, admin, environment, "OPEX", "v1", [
    { rowId: "line", revision: 0, cells: [{ measure: "forecast", month: 2, text: "25" }, { measure: "forecast", month: 3, text: "0" }] },
    { rowId: "line", revision: 0, cells: [{ measure: "forecast", month: 4, text: "99" }] },
    { rowId: "line", revision: 1, cells: [{ measure: "forecast", month: 5, text: "invalid" }] },
  ])
  expect(preview.before!.rows[0].cells[1].forecast.value).toBe(0)
  expect(preview.after!.rows[0].cells[1].forecast.value).toBe(25)
  expect(preview.after!.rows[0].cells[2].forecast.value).toBe(0)
  expect(preview.rows[1]).toMatchObject({ draft: { cells: [{ text: "99" }] }, result: { ok: false, status: 409 } })
  expect(preview.rows[2]).toMatchObject({ draft: { cells: [{ text: "invalid" }] }, errors: [{ reason: "invalid-number" }] })
})
