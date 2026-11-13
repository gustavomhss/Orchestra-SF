import { expect, test } from "bun:test"
import type { Actor, Snapshot } from "../runtime/contract.ts"
import { domain } from "../runtime/planner.ts"
import { parseWorkbook } from "../runtime/workbooks.ts"

const owner: Actor = { id: "owner-1", canWrite: true, roles: ["budget owner"], domains: ["Apps"] }
const admin: Actor = { id: "admin", canWrite: true, roles: ["admin"] }
const finance: Actor = { id: "finance", canWrite: true, roles: ["finance"] }
const env = {
  at: "2026-11-12T12:00:00Z",
  id: () => "new-line",
  directory: [{ id: "owner-1", name: "Budget Owner" }, { id: "other", name: "Other Owner" }],
}
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function snapshot(locked = false): Snapshot {
  const line = (id: string, domain: string, ownerId: string) => ({
    id, sec: "opex", el: "licenses", name: id, cur: "USD", annual: 1200,
    b: Array(12).fill(100), bm: Array(12).fill(false), a: Array(12).fill(null), f: Array(12).fill(null),
    domain, owner: { id: ownerId, name: ownerId === "owner-1" ? "Budget Owner" : "Other Owner" },
    entity: "1", alloc: "2",
  })
  return {
    data: {
      versions: [{
        id: "V1", name: "FY26", year: 2026, locked, closed: 0,
        lines: [line("owned", "", "owner-1"), line("domain", "Apps", "other"), line("foreign", "Other", "other")],
        projects: [], hc: { positions: [], rates: [], inc: 0, incMonth: 1, hrAF: {} }, fx: [{ id: "EUR", cur: "EUR", rate: 1.2 }], lists: {},
      }],
      officials: {}, entities: [{ id: 1, name: "Old Entity", code: "OLD" }, { id: 9, name: "São Paulo", code: "SP" }],
      allocations: [{ id: 2, name: "Old Allocation" }, { id: 10, name: "Direct" }], roster: [],
    },
    versions: {
      "versions:V1": { version: 4, by: "prior" },
      "V1:lines:owned": { version: 1, by: "prior" },
      "V1:lines:domain": { version: 2, by: "prior" },
      "V1:lines:foreign": { version: 3, by: "prior" },
    },
    sequences: { cpx: 80 },
    audit: [{ who: "prior", at: env.at, record: "seed", was: null, became: "seed" }],
    notices: [{ kind: "pending", to: ["prior"], record: "seed", at: env.at }],
  }
}

function row(id: string, measure: string, fields: Record<string, unknown> = {}) {
  return { "Line ID": id, "Cost element": "Licenses", Measure: measure, ...fields }
}

function apply(state: Snapshot, who: Actor, opex: Record<string, unknown>[], versions = structuredClone(state.versions)) {
  return domain.execute(state, who, {
    page: "Overview", action: "import-workbook", version: state.versions["versions:V1"].version,
    values: { versionId: "V1", sheets: { OPEX: opex }, versions },
  }, env)
}

function lines(state: Snapshot) {
  return (state.data.versions as { lines: Record<string, unknown>[] }[])[0].lines
}

function line(state: Snapshot, id: string) {
  const found = lines(state).find((item) => item.id === id)
  if (!found) throw new Error(`Missing line ${id}`)
  return found
}

test("AJ-PL-IMPORT-SCOPE applies all budget months and referenced metadata on stored owned and domain lines", () => {
  for (const id of ["owned", "domain"]) {
    const state = snapshot()
    const budget = months.map((_, index) => (index + 1) * 100)
    expect(apply(state, owner, [row(id, "Budget", {
      "Vendor / item": "Renamed", Entity: "SP", Allocation: "Direct", Owner: "Budget Owner", Currency: "EUR",
      ...Object.fromEntries(months.map((month, index) => [month, budget[index]])),
    })])).toMatchObject({ ok: true })
    expect(line(state, id)).toMatchObject({
      id, sec: "opex", name: "Renamed", entity: "9", alloc: "10", owner: { id: "owner-1", name: "Budget Owner" },
      cur: "EUR", b: budget, annual: 7800,
    })
  }
})

test("AJ-PL-IMPORT-SCOPE reassignment that loses no-domain ownership rejects the full batch", () => {
  const state = snapshot()
  const before = structuredClone(state)
  expect(apply(state, owner, [
    row("domain", "Forecast", { Jan: 42 }),
    row("owned", "Budget", { Owner: "Other Owner", Jan: 90 }),
  ])).toMatchObject({ ok: false, status: 403 })
  expect(state).toEqual(before)
})

test("AJ-PL-IMPORT-SCOPE unlocked in-domain CAPEX imports currency and classification", () => {
  const state = snapshot()
  const version = (state.data.versions as { projects: Record<string, unknown>[]; lines: Record<string, unknown>[] }[])[0]
  version.projects.push({ id: "project", name: "Core", code: "CPX-2026-001", owner: "" })
  version.lines.push({ ...structuredClone(line(state, "domain")), id: "capex", sec: "capex", proj: "project", cls: "capex" })
  state.versions["V1:lines:capex"] = { version: 5, by: "prior" }
  expect(domain.execute(state, owner, {
    page: "Overview", action: "import-workbook", version: state.versions["versions:V1"].version,
    values: { versionId: "V1", versions: structuredClone(state.versions), sheets: { CAPEX: [
      row("capex", "Budget", { Project: "Core", Classification: "OPEX", Currency: "EUR", Jan: 125 }),
    ] } },
  }, env)).toMatchObject({ ok: true })
  expect(line(state, "capex")).toMatchObject({ id: "capex", sec: "capex", proj: "project", cls: "opex", cur: "EUR", annual: 125, b: [125, ...Array(11).fill(0)] })
})

test("AJ-PL-IMPORT-SCOPE parsed XLSX applies budget and forecast for the same line", async () => {
  const state = snapshot()
  const { Workbook } = await import("exceljs")
  const workbook = new Workbook()
  workbook.addWorksheet("OPEX").addRows([
    ["Line ID", "Cost element", "Vendor / item", "Measure", ...months],
    ["domain", "Licenses", "domain", "Budget", ...months.map((_, index) => index + 1)],
    ["domain", "Licenses", "domain", "Forecast", 70, ...Array(11).fill(null)],
  ])
  const parsed = await parseWorkbook(new Uint8Array(await workbook.xlsx.writeBuffer()))
  expect(parsed.ok).toBe(true)
  if (!parsed.ok) throw new Error(parsed.errors.join("; "))
  expect(apply(state, owner, parsed.sheets.OPEX)).toMatchObject({ ok: true })
  expect(line(state, "domain")).toMatchObject({ b: months.map((_, index) => index + 1), annual: 78, f: [70, ...Array(11).fill(null)] })
})

test("AJ-PL-IMPORT-SCOPE creates a new no-domain line owned by the directory actor", () => {
  const state = snapshot()
  expect(apply(state, owner, [row("", "Budget", { "Vendor / item": "New subscription", Owner: "Budget Owner", Currency: "USD", Jan: 500 })])).toMatchObject({ ok: true })
  expect(lines(state)).toHaveLength(4)
  expect(line(state, "new-line")).toMatchObject({ sec: "opex", name: "New subscription", owner: { id: "owner-1", name: "Budget Owner" }, annual: 500, b: [500, ...Array(11).fill(0)] })
  expect(line(state, "new-line").domain || "").toBe("")
})

test("AJ-PL-IMPORT-SCOPE rejects a posted owner grant on a stored foreign line and rolls back the whole workbook", () => {
  const state = snapshot()
  const before = structuredClone(state)
  expect(apply(state, owner, [
    row("owned", "Forecast", { Jan: 42 }),
    row("foreign", "Forecast", { Owner: "Budget Owner", Jan: 90 }),
  ])).toMatchObject({ ok: false, status: 403 })
  expect(state).toEqual(before)
})

test("AJ-PL-IMPORT-SCOPE rejects a forged owner on foreign budget after an authorized change", () => {
  const state = snapshot()
  const before = structuredClone(state)
  expect(apply(state, owner, [
    row("owned", "Forecast", { Jan: 42 }),
    row("foreign", "Budget", { Owner: "Budget Owner", Jan: 90 }),
  ])).toMatchObject({ ok: false, status: 403 })
  expect(state).toEqual(before)
})

test("AJ-PL-IMPORT-SCOPE a new line owned by another directory identity does not gain the actor's scope", () => {
  const state = snapshot()
  const before = structuredClone(state)
  apply(state, owner, [row("", "Budget", { "Vendor / item": "Other subscription", Owner: "Other Owner", Jan: 500 })])
  expect(state).toEqual(before)
})

test("AJ-PL-IMPORT-SCOPE stored nonempty domain requires assignment even for the stored owner", () => {
  const state = snapshot()
  line(state, "foreign").owner = { id: "owner-1", name: "Budget Owner" }
  const before = structuredClone(state)
  expect(apply(state, owner, [row("foreign", "Forecast", { Jan: 50 })])).toMatchObject({ ok: false, status: 403 })
  expect(state).toEqual(before)
  expect(apply(state, owner, [row("owned", "Forecast", { Jan: 60 })])).toMatchObject({ ok: true })
  expect(line(state, "owned").f).toEqual([60, ...Array(11).fill(null)])
})

test("AJ-PL-IMPORT-SCOPE stale per-line revision rejects the entire batch", () => {
  const state = snapshot()
  const revisions = structuredClone(state.versions)
  revisions["V1:lines:domain"].version = 1
  const before = structuredClone(state)
  expect(apply(state, owner, [row("owned", "Forecast", { Jan: 42 }), row("domain", "Forecast", { Jan: 90 })], revisions)).toMatchObject({ ok: false, status: 409 })
  expect(state).toEqual(before)
})

test("AJ-PL-IMPORT-SCOPE locked budget and structure remain while an in-scope forecast applies", () => {
  const state = snapshot(true)
  const before = structuredClone(line(state, "domain"))
  expect(apply(state, owner, [
    row("domain", "Budget", { "Cost element": "Services", "Vendor / item": "Changed", Currency: "EUR", Entity: "SP", Allocation: "Direct", Classification: "OPEX", Jan: 900 }),
    row("domain", "Forecast", { Jan: 75 }),
  ])).toMatchObject({ ok: true })
  expect(line(state, "domain")).toMatchObject({ el: before.el, cur: before.cur, entity: before.entity, alloc: before.alloc, b: before.b, annual: before.annual, f: [75, ...Array(11).fill(null)] })
})

test("AJ-PL-IMPORT-SCOPE locked CAPEX retains project and classification while applying forecast", () => {
  const state = snapshot(true)
  const version = (state.data.versions as { projects: Record<string, unknown>[]; lines: Record<string, unknown>[] }[])[0]
  version.projects.push({ id: "project", name: "Core", code: "CPX-2026-001", owner: "" })
  version.projects.push({ id: "other-project", name: "Other project", code: "CPX-2026-002", owner: "" })
  version.lines.push({ ...structuredClone(line(state, "domain")), id: "capex", sec: "capex", proj: "project", cls: "capex" })
  state.versions["V1:lines:capex"] = { version: 5, by: "prior" }
  const before = structuredClone(line(state, "capex"))
  expect(domain.execute(state, owner, {
    page: "Overview", action: "import-workbook", version: state.versions["versions:V1"].version,
    values: { versionId: "V1", versions: structuredClone(state.versions), sheets: { CAPEX: [
      row("capex", "Budget", { Project: "Other project", "Project code": "CPX-2026-002", Classification: "OPEX", Jan: 900 }),
      row("capex", "Forecast", { Project: "Core", Jan: 75 }),
    ] } },
  }, env)).toMatchObject({ ok: true })
  expect(line(state, "capex")).toMatchObject({ proj: before.proj, cls: before.cls, b: before.b, annual: before.annual, f: [75, ...Array(11).fill(null)] })
})

test("AJ-PL-IMPORT-SCOPE finance cannot import budget but unlocked admin can", () => {
  const financeState = snapshot()
  expect(apply(financeState, finance, [row("domain", "Budget", { Jan: 900 })])).toMatchObject({ ok: true })
  expect(line(financeState, "domain").b).toEqual(Array(12).fill(100))
  const adminState = snapshot()
  expect(apply(adminState, admin, [row("domain", "Budget", { Jan: 900 })])).toMatchObject({ ok: true })
  expect(line(adminState, "domain")).toMatchObject({ b: [900, ...Array(11).fill(0)], annual: 900 })
})

test("AJ-PL-IMPORT-SCOPE finance imports actual and forecast across closed and open months", () => {
  for (const locked of [false, true]) {
    const state = snapshot(locked)
    ;(state.data.versions as { closed: number }[])[0].closed = 2
    expect(apply(state, finance, [
      row("domain", "Actual", { Jan: 11, Apr: 44 }),
      row("domain", "Forecast", { Jan: 22, Apr: 55 }),
    ])).toMatchObject({ ok: true })
    expect(line(state, "domain")).toMatchObject({
      a: [11, null, null, 44, ...Array(8).fill(null)],
      f: [22, null, null, 55, ...Array(8).fill(null)],
    })
    expect((state.data.versions as { closed: number }[])[0].closed).toBe(2)
  }
})

test("AJ-PL-IMPORT-SCOPE HR workbook domain cannot be forged by a posted owner", () => {
  const state = snapshot()
  const version = (state.data.versions as { hc: { hrAF: Record<string, unknown> } }[])[0]
  version.hc.hrAF.Other = { a: Array(12).fill(null), f: Array(12).fill(null) }
  state.versions["V1:hrAF:HR:Other"] = { version: 1, by: "prior" }
  const before = structuredClone(state)
  expect(apply(state, owner, [
    row("owned", "Forecast", { Jan: 42 }),
    row("HR:Other", "Forecast", { "Cost element": "HR Staff", "Vendor / item": "Apps", Owner: "Budget Owner", Jan: 90 }),
  ])).toMatchObject({ ok: false, status: 403 })
  expect(state).toEqual(before)
})

test("AJ-PL-IMPORT-SCOPE a new conflicting HR domain cannot be created by posting self as owner", () => {
  const state = snapshot()
  const before = structuredClone(state)
  expect(apply(state, owner, [
    row("owned", "Forecast", { Jan: 42 }),
    row("HR:Other", "Forecast", { "Cost element": "HR Staff", "Vendor / item": "Other", Owner: "Budget Owner", Jan: 90 }),
  ])).toMatchObject({ ok: false, status: 403 })
  expect(state).toEqual(before)
})

test("AJ-PL-IMPORT-SCOPE budget owner cannot widen roster or salary authority through workbook", () => {
  const rosterState = snapshot()
  const rosterBefore = structuredClone(rosterState)
  expect(domain.execute(rosterState, owner, {
    page: "Overview", action: "import-workbook", version: rosterState.versions["versions:V1"].version,
    values: { versionId: "V1", versions: structuredClone(rosterState.versions), sheets: {
      OPEX: [row("owned", "Forecast", { Jan: 42 })],
      Headcount: [{ Name: "New hire", Leader: "Lead", "Start Date": "2026-01-01" }],
    } },
  }, env)).toMatchObject({ ok: false, status: 403 })
  expect(rosterState).toEqual(rosterBefore)

  const rateState = snapshot()
  const version = (rateState.data.versions as { hc: { rates: Record<string, unknown>[] } }[])[0]
  version.hc.rates.push({ id: "rate-1", name: "Employee", locs: "Brazil", annual: 120000, cur: "USD" })
  const rateBefore = structuredClone(rateState)
  const result = domain.execute(rateState, owner, {
    page: "Overview", action: "import-workbook", version: rateState.versions["versions:V1"].version,
    values: { versionId: "V1", versions: structuredClone(rateState.versions), sheets: {
      "Rate cards": [{ "Rate ID": "rate-1", "Rate card": "Employee", Locations: "Brazil", Currency: "USD", "Annual cost per FTE": 1 }],
    } },
  }, env)
  expect(result).toMatchObject({ ok: true })
  expect(rateState).toEqual(rateBefore)
})

test("AJ-PL-IMPORT-SCOPE viewer and read-only owner cannot apply workbooks", () => {
  for (const actor of [{ id: "viewer", canWrite: true, roles: ["viewer"] }, { ...owner, canWrite: false }]) {
    const state = snapshot()
    const before = structuredClone(state)
    expect(apply(state, actor, [row("owned", "Forecast", { Jan: 10 })])).toMatchObject({ ok: false, status: 403 })
    expect(state).toEqual(before)
  }
})
