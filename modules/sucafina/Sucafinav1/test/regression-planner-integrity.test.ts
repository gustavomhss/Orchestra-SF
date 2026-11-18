// AJ-PL-EMPTY-SAVE and AJ-PL-LOCK-ROSTER.
// Calls domain.execute and domain.view. Compares the snapshot that call stores.
// Workbook bytes come from the real planner and All Members exporters.

import { expect, test } from "bun:test"
import type { ArtifactResult } from "../runtime/artifact.ts"
import type { Actor, Environment, Result, Snapshot } from "../runtime/contract.ts"
import { rows } from "../runtime/contract.ts"
import { domain } from "../runtime/planner.ts"
import { exportMembers, exportPlanner, parseWorkbook } from "../runtime/workbooks.ts"

const at = "2026-11-12T12:00:00Z"
const directory = [
  { id: "owner-1", name: "Budget Owner" },
  { id: "owner-2", name: "Ada Owner" },
  { id: "other-owner", name: "Other Owner" },
]
const admin: Actor = { id: "directory-admin", canWrite: true, roles: ["admin"] }
const finance: Actor = { id: "finance", canWrite: true, roles: ["finance"] }
const hr: Actor = { id: "hr", canWrite: true, roles: ["hr"] }
const owned: Actor = { id: "owner-1", canWrite: true, roles: ["budget owner"] }
const inDomain: Actor = { id: "domain-lead", canWrite: true, roles: ["budget owner"], domains: ["IT"] }
const outsider: Actor = { id: "stranger", canWrite: true, roles: ["budget owner"], domains: ["Facilities"] }
const viewer: Actor = { id: "viewer", canWrite: false, roles: ["viewer"] }
const NULL_BUDGET = [null, 10, ...Array.from({ length: 9 }, () => null), 4]
const adaRoster = [
  {
    name: "Ada",
    title: "Engineer",
    type: "Employee",
    leader: "Marta",
    location: "Brazil",
    start: "2026-01-15",
    end: "",
    status: "Active",
  },
]

function environment(): Environment {
  let generated = 0
  return { at, directory, id: () => `generated-${++generated}` }
}

function monthsOf(first: number | null, second: number | null = null): (number | null)[] {
  return [first, second, ...Array.from({ length: 10 }, () => null)]
}

function postedMonths(prefix: "a" | "f", values: readonly (number | null)[]): Record<string, number | null> {
  return Object.fromEntries(values.map((value, index) => [`${prefix}${index}`, value]))
}

function nullableLine(): Record<string, unknown> {
  return {
    id: "L1",
    sec: "opex",
    el: "services",
    name: "Kept licences",
    desc: "Kept description",
    owner: { id: "owner-1", name: "Budget Owner" },
    entity: "entity-1",
    alloc: "alloc-1",
    cur: "USD",
    domain: "Applications",
    b: [...NULL_BUDGET],
    a: monthsOf(1),
    f: monthsOf(null, 2),
    note: "operator note",
    legacy: { keep: true },
  }
}

function bareLine(): Record<string, unknown> {
  return {
    id: "L2",
    sec: "opex",
    el: "licenses",
    name: "Bare line",
    desc: "Bare description",
    owner: { id: "other-owner", name: "Other Owner" },
    entity: "entity-1",
    alloc: "alloc-1",
    cur: "USD",
    domain: "IT",
    a: monthsOf(null),
    f: monthsOf(null),
    legacy: { keep: true },
  }
}

function plan(locked: boolean): Snapshot {
  return {
    data: {
      versions: [
        {
          id: "v",
          name: "Plan",
          year: 2027,
          locked,
          closed: 0,
          lines: [nullableLine(), bareLine()],
          projects: [{ id: "PR1", name: "Plant", code: "", owner: "", desc: "Kept project" }],
          hc: {
            positions: [
              {
                id: "P1",
                name: "Kept position",
                title: "Analyst",
                type: "",
                location: "Brazil",
                include: null,
                fte: null,
                start: 3,
                end: 9,
                domain: "IT",
                domainManual: true,
                src: "manual",
                rateId: "R1",
                rateOverride: 654321,
                role: "Preserved role",
              },
            ],
            rates: [{ id: "R1", name: "Employee", locs: "Brazil", annual: 120000 }],
            inc: 0,
            incMonth: 1,
            hrAF: { Existing: { marker: true } },
            leaderDomains: { Marta: "IT" },
          },
          fx: [{ id: "fx-eur", cur: "EUR", rate: 1.234567891 }],
          lists: {},
        },
      ],
      officials: {},
      entities: [{ id: "entity-1", name: "Geneva", code: "GVA" }],
      allocations: [{ id: "alloc-1", name: "Direct", desc: "" }],
      roster: [
        {
          name: "Existing Person",
          title: "Analyst",
          type: "Employee",
          leader: "Marta",
          location: "Brazil",
          start: "2024-02-01",
          end: "",
          status: "Active",
        },
      ],
    },
    versions: { "v:positions:sync": { version: 5, by: "earlier" } },
    sequences: { cpx: 80 },
    audit: [],
    notices: [],
  }
}

function execute(
  state: Snapshot,
  actor: Actor,
  env: Environment,
  page: string,
  action: string,
  id: string,
  values: Record<string, unknown>,
  version = 0,
): Result {
  return domain.execute(
    state,
    actor,
    { page, action, id, version, values: { versionId: "v", ...values } },
    env,
  )
}

function apply(
  state: Snapshot,
  actor: Actor,
  env: Environment,
  sheets: Record<string, Record<string, unknown>[]>,
  version = state.versions["versions:v"]?.version ?? 0,
  extra: Record<string, unknown> = {},
): Result {
  return domain.execute(
    state,
    actor,
    {
      page: "Headcount",
      action: "import-workbook",
      version,
      values: {
        versionId: "v",
        sheets,
        versions: structuredClone(state.versions),
        ...extra,
      },
    },
    env,
  )
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>
  throw new Error(`Expected ${label}`)
}

function storedVersion(state: Snapshot): Record<string, unknown> {
  const version = rows(state.data.versions)[0]
  if (!version) throw new Error("Expected a plan version")
  return version
}

function hcOf(state: Snapshot): Record<string, unknown> {
  return record(storedVersion(state).hc, "headcount")
}

function lineOf(state: Snapshot, id: string): Record<string, unknown> {
  const line = rows(storedVersion(state).lines).find((row) => row.id === id)
  if (!line) throw new Error(`Expected line ${id}`)
  return line
}

function viewedLine(state: Snapshot, actor: Actor, env: Environment, id: string): Record<string, unknown> {
  const line = rows(rows(domain.view(state, actor, env).data.versions)[0]?.lines).find((row) => row.id === id)
  if (!line) throw new Error(`Expected viewed line ${id}`)
  return line
}

function expectBudgetUntouched(line: Record<string, unknown>, budget: (number | null)[] | undefined) {
  if (budget) expect(line.b).toEqual(budget)
  if (!budget) expect(Object.hasOwn(line, "b")).toBe(false)
  expect(Object.hasOwn(line, "bm")).toBe(false)
  expect(Object.hasOwn(line, "annual")).toBe(false)
}

function expectSamePeople(state: Snapshot, before: Snapshot) {
  expect(state.data.roster).toEqual(before.data.roster)
  expect(rows(hcOf(state).positions)).toEqual(rows(hcOf(before).positions))
  expect(rows(hcOf(state).rates)).toEqual(rows(hcOf(before).rates))
  expect(hcOf(state).hrAF).toEqual(hcOf(before).hrAF)
  expect(hcOf(state).leaderDomains).toEqual(hcOf(before).leaderDomains)
  expect(rows(storedVersion(state).fx)).toEqual(rows(storedVersion(before).fx))
  expect(rows(storedVersion(state).projects)).toEqual(rows(storedVersion(before).projects))
  expect(state.sequences).toEqual(before.sequences)
  expect(state.notices).toEqual(before.notices)
}

function rosterLocked(result: Result): boolean {
  if (!result.ok) return false
  return (result.warnings ?? []).some((warning) => /lock/i.test(warning) && /roster|all members/i.test(warning))
}

function withEdits(row: Record<string, unknown>): Record<string, unknown> {
  const id = row["Line ID"]
  const measure = row.Measure
  if (id === "L1" && measure === "Budget")
    return { ...row, Jan: 999, "Vendor / item": "Forbidden rename", Description: "Forbidden description" }
  if (id === "L1" && measure === "Actual") return { ...row, Jan: 25, Feb: 0 }
  if (id === "L1" && measure === "Forecast") return { ...row, Jan: 40, Owner: "Ada Owner" }
  if (id === "L2" && measure === "Budget") return { ...row, Jan: 777 }
  if (id === "L2" && measure === "Actual") return { ...row, Jan: 8 }
  return row
}

async function parsedSheets(
  exported: Promise<ArtifactResult>,
  label: string,
): Promise<Record<string, Record<string, unknown>[]>> {
  const workbook = await exported
  expect(workbook.ok).toBe(true)
  if (!workbook.ok) throw new Error(workbook.errors?.join("; ") || label)
  const parsed = await parseWorkbook(workbook.bytes)
  expect(parsed.ok).toBe(true)
  if (!parsed.ok) throw new Error(parsed.errors.join("; "))
  return parsed.sheets
}

async function memberSheets(env: Environment): Promise<Record<string, Record<string, unknown>[]>> {
  const sheets = await parsedSheets(
    exportMembers(
      {
        data: {
          members: [
            {
              id: "member-ada",
              name: "Ada",
              title: "Engineer",
              type: "Employee",
              leaderId: "leader-marta",
              location: "Brazil",
              start: "2026-01-15",
              end: "",
              status: "Active",
              cls: "Talent",
              outlook: "Stay",
              notes: "Private details",
            },
          ],
          leaders: [{ id: "leader-marta", name: "Marta", domain: "Product", location: "Brazil" }],
        },
        versions: {},
        sequences: {},
        audit: [],
        notices: [],
      },
      admin,
      env,
    ),
    "All Members workbook",
  )
  const member = sheets["All Members"]?.[0]
  expect(member).toEqual(
    expect.objectContaining({
      Name: "Ada",
      "Start Date": "2026-01-15",
      "End Date": "",
      Status: "Active",
      Leader: "Marta",
    }),
  )
  expect(member).not.toHaveProperty("FTE")
  expect(member).not.toHaveProperty("Position ID")
  if (!sheets["Summary by Leader"]) throw new Error("Expected Summary by Leader")
  return sheets
}

async function plannerSheets(
  state: Snapshot,
  env: Environment,
): Promise<Record<string, Record<string, unknown>[]>> {
  const sheets = await parsedSheets(exportPlanner(structuredClone(state), admin, env, "v"), "Planner workbook")
  if (!sheets.Info || !sheets.OPEX?.some((row) => row["Line ID"] === "L1" && row.Measure === "Actual"))
    throw new Error("Expected exported planner sheets")
  return sheets
}

async function combinedSheets(
  state: Snapshot,
  env: Environment,
): Promise<Record<string, Record<string, unknown>[]>> {
  const planner = await plannerSheets(state, env)
  const members = await memberSheets(env)
  return {
    Info: planner.Info ?? [],
    // HR Staff rows are headcount output. This package does not widen that authority.
    OPEX: (planner.OPEX ?? []).filter((row) => !String(row["Line ID"] ?? "").startsWith("HR:")).map(withEdits),
    "All Members": members["All Members"] ?? [],
    "Summary by Leader": members["Summary by Leader"] ?? [],
  }
}

test("AJ-PL-EMPTY-SAVE keeps stale 409 and viewer 403 ahead of an empty existing-row 403", () => {
  const env = environment()
  const state = plan(true)
  state.versions["v:lines:L1"] = { version: 4, by: "other" }
  const before = structuredClone(state)
  const empty: Record<string, unknown> = { collection: "lines" }
  expect(execute(state, viewer, env, "OPEX", "save", "L1", empty, 3)).toMatchObject({ ok: false, status: 403 })
  expect(execute(state, { ...admin, canWrite: false }, env, "OPEX", "save", "L1", empty, 3)).toMatchObject({
    ok: false,
    status: 403,
  })
  expect(execute(state, finance, env, "OPEX", "save", "L1", empty, 3)).toMatchObject({ ok: false, status: 409 })
  expect(execute(state, finance, env, "OPEX", "save", "L1", { collection: "lines", a0: "nope" }, 3)).toMatchObject({
    ok: false,
    status: 409,
  })
  expect(execute(state, finance, env, "OPEX", "save", "L1", { collection: "lines", notAField: 1 }, 3)).toMatchObject({
    ok: false,
    status: 409,
  })
  expect(execute(state, finance, env, "OPEX", "save", "L1", { collection: "lines", a0: "nope" }, 4)).toMatchObject({
    ok: false,
    status: 422,
  })
  expect(execute(state, finance, env, "OPEX", "save", "L1", empty, 4)).toMatchObject({ ok: false, status: 403 })
  expect(state).toEqual(before)
})

test("AJ-PL-EMPTY-SAVE rejects an existing row posted with only versionId and collection", () => {
  const saves = [
    { page: "OPEX", id: "L1", collection: "lines" },
    { page: "CAPEX", id: "PR1", collection: "projects" },
    { page: "Headcount", id: "P1", collection: "positions" },
    { page: "Headcount", id: "R1", collection: "rates" },
    { page: "FX rates", id: "fx-eur", collection: "fx" },
  ]
  for (const actor of [admin, finance, hr, owned])
    for (const save of saves) {
      const env = environment()
      const state = plan(true)
      const before = structuredClone(state)
      expect(execute(state, actor, env, save.page, "save", save.id, { collection: save.collection })).toMatchObject({
        ok: false,
        status: 403,
      })
      expect(state).toEqual(before)
      expect(rows(storedVersion(state).projects)[0]?.code).toBe("")
      expect(rows(hcOf(state).positions)[0]?.fte).toBeNull()
      expect(rows(storedVersion(state).fx)[0]?.rate).toBe(1.234567891)
      expect(state.versions["v:positions:sync"]).toEqual({ version: 5, by: "earlier" })
      expect(state.versions["sequences:cpx"]).toBeUndefined()
      expect(state.sequences).toEqual({ cpx: 80 })
      expect(state.audit).toEqual([])
      expect(state.notices).toEqual([])
    }
})

test("AJ-PL-EMPTY-SAVE finance, owned and in-domain actual or forecast saves leave unposted budget exact", () => {
  const env = environment()
  const denied = plan(true)
  const deniedBefore = structuredClone(denied)
  expect(
    execute(denied, outsider, env, "OPEX", "save", "L1", { collection: "lines", ...postedMonths("f", monthsOf(40, 2)) }),
  ).toMatchObject({ ok: false, status: 403 })
  expect(denied).toEqual(deniedBefore)

  const state = plan(true)
  expect(
    execute(state, finance, env, "OPEX", "save", "L1", {
      collection: "lines",
      ...postedMonths("a", monthsOf(25, 0)),
    }),
  ).toMatchObject({ ok: true })
  expect(
    execute(state, finance, env, "OPEX", "save", "L2", { collection: "lines", ...postedMonths("a", monthsOf(8)) }, 0),
  ).toMatchObject({ ok: true })
  const actual = lineOf(state, "L1")
  expect(actual.a).toEqual(monthsOf(25, 0))
  expect(actual.f).toEqual(monthsOf(null, 2))
  expectBudgetUntouched(actual, NULL_BUDGET)
  expect(actual.el).toBe("services")
  expect(actual.cur).toBe("USD")
  expect(actual.entity).toBe("entity-1")
  expect(actual.alloc).toBe("alloc-1")
  expect(actual.name).toBe("Kept licences")
  expect(actual.desc).toBe("Kept description")
  expect(actual.note).toBe("operator note")
  expect(actual.legacy).toEqual({ keep: true })
  expect(actual.domain).toBe("Applications")
  const bare = lineOf(state, "L2")
  expect(bare.a).toEqual(monthsOf(8))
  expectBudgetUntouched(bare, undefined)
  expect(bare.legacy).toEqual({ keep: true })
  expect(viewedLine(state, finance, env, "L1").b).toEqual(NULL_BUDGET)
  expect(viewedLine(state, finance, env, "L1").a).toEqual(monthsOf(25, 0))
  expect(Object.hasOwn(viewedLine(state, finance, env, "L2"), "b")).toBe(false)
  expect(state.audit.map((entry) => entry.record)).toEqual(["v:lines:L1", "v:lines:L2"])
  expect(state.versions["v:lines:L1"]).toEqual({ version: 1, by: "finance" })
  expect(state.versions["v:lines:L2"]).toEqual({ version: 1, by: "finance" })
  expect(state.versions["v:positions:sync"]).toEqual({ version: 5, by: "earlier" })
  expect(state.versions["sequences:cpx"]).toBeUndefined()
  expect(state.sequences).toEqual({ cpx: 80 })
  expect(state.notices).toEqual([])
  expect(rows(hcOf(state).positions)[0]?.fte).toBeNull()

  const ownerState = plan(true)
  // A self-owned line without a domain uses owner scope; a stored domain requires a matching actor domain.
  lineOf(ownerState, "L1").domain = ""
  expect(
    execute(ownerState, owned, env, "OPEX", "save", "L1", {
      collection: "lines",
      ...postedMonths("f", monthsOf(40, 2)),
    }),
  ).toMatchObject({ ok: true })
  expect(lineOf(ownerState, "L1").f).toEqual(monthsOf(40, 2))
  expect(lineOf(ownerState, "L1").a).toEqual(monthsOf(1))
  expectBudgetUntouched(lineOf(ownerState, "L1"), NULL_BUDGET)
  expect(viewedLine(ownerState, owned, env, "L1").b).toEqual(NULL_BUDGET)
  expect(viewedLine(ownerState, owned, env, "L1").f).toEqual(monthsOf(40, 2))
  expect(ownerState.audit.map((entry) => entry.record)).toEqual(["v:lines:L1"])
  expect(ownerState.versions["v:positions:sync"]).toEqual({ version: 5, by: "earlier" })
  expect(ownerState.sequences).toEqual({ cpx: 80 })
  expect(ownerState.notices).toEqual([])

  const domainState = plan(true)
  expect(
    execute(domainState, inDomain, env, "OPEX", "save", "L2", {
      collection: "lines",
      ...postedMonths("f", monthsOf(6)),
    }),
  ).toMatchObject({ ok: true })
  expect(lineOf(domainState, "L2").f).toEqual(monthsOf(6))
  expectBudgetUntouched(lineOf(domainState, "L2"), undefined)
  expect(Object.hasOwn(viewedLine(domainState, inDomain, env, "L2"), "b")).toBe(false)
  expect(domainState.audit.map((entry) => entry.record)).toEqual(["v:lines:L2"])
  expect(domainState.versions["sequences:cpx"]).toBeUndefined()
  expect(domainState.notices).toEqual([])
})

test("AJ-PL-EMPTY-SAVE locked admin name, owner and desc save leaves unposted budget exact", () => {
  const env = environment()
  const state = plan(true)
  expect(
    execute(state, admin, env, "OPEX", "save", "L1", {
      collection: "lines",
      name: "Renamed licences",
      owner: "owner-2",
      desc: "Updated description",
    }),
  ).toMatchObject({ ok: true })
  const line = lineOf(state, "L1")
  expect(line.name).toBe("Renamed licences")
  expect(line.desc).toBe("Updated description")
  expect(line.owner).toEqual({ id: "owner-2", name: "Ada Owner" })
  expect(line.a).toEqual(monthsOf(1))
  expect(line.f).toEqual(monthsOf(null, 2))
  expectBudgetUntouched(line, NULL_BUDGET)
  expect(line.el).toBe("services")
  expect(line.cur).toBe("USD")
  expect(line.entity).toBe("entity-1")
  expect(line.alloc).toBe("alloc-1")
  expect(line.domain).toBe("Applications")
  expect(line.note).toBe("operator note")
  expect(line.legacy).toEqual({ keep: true })
  expectBudgetUntouched(lineOf(state, "L2"), undefined)
  expect(viewedLine(state, admin, env, "L1").b).toEqual(NULL_BUDGET)
  expect(viewedLine(state, admin, env, "L1").name).toBe("Renamed licences")
  expect(Object.hasOwn(viewedLine(state, admin, env, "L1"), "bm")).toBe(false)
  expect(Object.hasOwn(viewedLine(state, admin, env, "L1"), "annual")).toBe(false)
  expect(state.audit.map((entry) => entry.record)).toEqual(["v:lines:L1"])
  expect(state.versions["v:lines:L1"]).toEqual({ version: 1, by: "directory-admin" })
  expect(state.versions["v:positions:sync"]).toEqual({ version: 5, by: "earlier" })
  expect(state.versions["sequences:cpx"]).toBeUndefined()
  expect(state.sequences).toEqual({ cpx: 80 })
  expect(state.notices).toEqual([])
  expect(rows(hcOf(state).positions)[0]?.fte).toBeNull()
  expect(rows(storedVersion(state).projects)[0]?.code).toBe("")
})

test("AJ-PL-EMPTY-SAVE finance closed-through and explicit admin budget save commit only submitted fields", () => {
  const env = environment()
  const closed = plan(true)
  expect(execute(closed, finance, env, "OPEX", "save", "L1", { closed: 4 })).toMatchObject({ ok: true })
  expect(storedVersion(closed).closed).toBe(4)
  expectBudgetUntouched(lineOf(closed, "L1"), NULL_BUDGET)
  expect(lineOf(closed, "L1").a).toEqual(monthsOf(1))
  expectBudgetUntouched(lineOf(closed, "L2"), undefined)
  expect(closed.versions["v:closed"]).toEqual({ version: 1, by: "finance" })
  expect(closed.versions["v:lines:L1"]).toBeUndefined()
  expect(closed.versions["v:positions:sync"]).toEqual({ version: 5, by: "earlier" })
  expect(closed.audit.map((entry) => entry.record)).toEqual(["v:closed"])
  expect(closed.sequences).toEqual({ cpx: 80 })
  expect(closed.notices).toEqual([])

  const budget = plan(false)
  expect(execute(budget, admin, env, "OPEX", "save", "L1", { collection: "lines", annual: 1200 })).toMatchObject({
    ok: true,
  })
  const line = lineOf(budget, "L1")
  expect(line.annual).toBe(1200)
  expect(line.b).not.toEqual(NULL_BUDGET)
  expect(Array.isArray(line.b)).toBe(true)
  expect(line.entity).toBe("entity-1")
  expect(line.a).toEqual(monthsOf(1))
  expect(line.f).toEqual(monthsOf(null, 2))
  expect(line.name).toBe("Kept licences")
  expect(line.legacy).toEqual({ keep: true })
  expectBudgetUntouched(lineOf(budget, "L2"), undefined)
  expect(budget.versions["v:lines:L1"]).toEqual({ version: 1, by: "directory-admin" })
  expect(budget.versions["v:positions:sync"]).toEqual({ version: 5, by: "earlier" })
  expect(budget.versions["sequences:cpx"]).toBeUndefined()
  expect(budget.sequences).toEqual({ cpx: 80 })
  expect(budget.notices).toEqual([])
  expect(rows(hcOf(budget).positions)[0]?.fte).toBeNull()
  expect(rows(storedVersion(budget).projects)[0]?.code).toBe("")
})

test("AJ-PL-EMPTY-SAVE does not normalize unposted position, rate or FX fields", () => {
  const env = environment()
  const positions = plan(false)
  expect(
    execute(positions, hr, env, "Headcount", "save", "P1", { collection: "positions", title: "Engineer" }),
  ).toMatchObject({ ok: true })
  const position = rows(hcOf(positions).positions)[0]
  if (!position) throw new Error("Expected position")
  expect(position.title).toBe("Engineer")
  expect(position.name).toBe("Kept position")
  expect(position.fte).toBeNull()
  expect(position.include).toBeNull()
  expect(position.type).toBe("")
  expect(position.start).toBe(3)
  expect(position.end).toBe(9)
  expect(position.src).toBe("manual")
  expect(position.domain).toBe("IT")
  expect(position.domainManual).toBe(true)
  expect(position.rateOverride).toBe(654321)
  expect(position.role).toBe("Preserved role")
  expect(positions.audit.map((entry) => entry.record)).toEqual(["v:positions:P1", "v:positions:sync"])
  expect(positions.versions["v:positions:P1"]).toEqual({ version: 1, by: "hr" })
  expect(positions.versions["v:positions:sync"]).toEqual({ version: 6, by: "hr" })
  expect(positions.sequences).toEqual({ cpx: 80 })
  expect(positions.notices).toEqual([])
  expect(rows(storedVersion(positions).projects)[0]?.code).toBe("")

  const rates = plan(false)
  expect(execute(rates, hr, env, "Headcount", "save", "R1", { collection: "rates", locs: "Colombia" })).toMatchObject({
    ok: true,
  })
  const rate = rows(hcOf(rates).rates).find((row) => row.id === "R1")
  if (!rate) throw new Error("Expected rate card")
  expect(rate.locs).toBe("Colombia")
  expect(rate.name).toBe("Employee")
  expect(rate.annual).toBe(120000)
  expect(Object.hasOwn(rate, "cur")).toBe(false)
  expect(rates.audit.map((entry) => entry.record)).toEqual(["v:rates:R1"])
  expect(rates.versions["v:rates:R1"]).toEqual({ version: 1, by: "hr" })
  expect(rates.versions["v:positions:sync"]).toEqual({ version: 5, by: "earlier" })
  expect(rates.sequences).toEqual({ cpx: 80 })
  expect(rates.notices).toEqual([])
  expect(rows(hcOf(rates).positions)[0]?.fte).toBeNull()

  const fxState = plan(false)
  expect(execute(fxState, admin, env, "FX rates", "save", "fx-eur", { collection: "fx", cur: "GBP" })).toMatchObject({
    ok: true,
  })
  const fx = rows(storedVersion(fxState).fx).find((row) => row.id === "fx-eur")
  if (!fx) throw new Error("Expected FX rate")
  expect(fx.cur).toBe("GBP")
  expect(fx.rate).toBe(1.234567891)
  expect(fxState.audit.map((entry) => entry.record)).toEqual(["v:fx:fx-eur"])
  expect(fxState.versions["v:fx:fx-eur"]).toEqual({ version: 1, by: "directory-admin" })
  expect(fxState.versions["sequences:cpx"]).toBeUndefined()
  expect(fxState.sequences).toEqual({ cpx: 80 })
  expect(fxState.notices).toEqual([])
})

test("AJ-PL-EMPTY-SAVE keeps new-row denial, invalid input and salary visibility unchanged", () => {
  const env = environment()
  const state = plan(true)
  const before = structuredClone(state)
  expect(execute(state, finance, env, "OPEX", "save", "L1", { collection: "lines", b0: 1 })).toMatchObject({
    ok: false,
    status: 403,
  })
  expect(execute(state, finance, env, "OPEX", "spread", "L1", { collection: "lines" })).toMatchObject({
    ok: false,
    status: 403,
  })
  expect(execute(state, finance, env, "OPEX", "reset", "L1", { collection: "lines" })).toMatchObject({
    ok: false,
    status: 403,
  })
  expect(
    execute(state, hr, env, "OPEX", "save", "L1", { collection: "lines", ...postedMonths("a", monthsOf(25, 0)) }),
  ).toMatchObject({ ok: false, status: 403 })
  expect(execute(state, finance, env, "Headcount", "save", "P1", { collection: "positions", fte: 2 })).toMatchObject({
    ok: false,
    status: 403,
  })
  expect(
    execute(state, finance, env, "CAPEX", "save", "PR1", { collection: "projects", code: "CPX-2027-999" }),
  ).toMatchObject({ ok: false, status: 403 })
  expect(execute(state, finance, env, "Headcount", "save", "R1", { collection: "rates", annual: 1 })).toMatchObject({
    ok: false,
    status: 403,
  })
  expect(
    execute(state, outsider, env, "OPEX", "save", "L2", { collection: "lines", ...postedMonths("f", monthsOf(6)) }),
  ).toMatchObject({ ok: false, status: 403 })
  expect(
    execute(state, finance, env, "OPEX", "save", "brand-new", {
      collection: "lines",
      name: "New",
      annual: 10,
      el: "licenses",
    }),
  ).toMatchObject({ ok: false, status: 403 })
  expect(
    execute(state, finance, env, "Headcount", "save", "brand-new", {
      collection: "positions",
      name: "Ghost",
      fte: 1,
    }),
  ).toMatchObject({ ok: false, status: 403 })
  expect(
    execute(state, hr, env, "Headcount", "save", "brand-new", { collection: "positions", name: "Ghost", fte: 1 }),
  ).toMatchObject({ ok: false, status: 403 })
  expect(execute(state, finance, env, "OPEX", "save", "L1", { collection: "lines", a0: "nope" })).toMatchObject({
    ok: false,
    status: 422,
  })
  expect(execute(state, admin, env, "OPEX", "save", "L1", { collection: "lines", notAField: 1 })).toMatchObject({
    ok: false,
    status: 422,
  })
  const hidden = JSON.stringify(domain.view(state, owned, env))
  expect(hidden).not.toContain("rateOverride")
  expect(hidden).not.toContain("654321")
  expect(hidden).not.toContain("120000")
  expect(JSON.stringify(domain.view(state, finance, env))).toContain("rateOverride")
  expect(state).toEqual(before)
})

test("AJ-PL-LOCK-ROSTER ignores a locked All Members sheet and still applies legal rows", async () => {
  const env = environment()
  const state = plan(true)
  const sheets = await combinedSheets(state, env)
  const before = structuredClone(state)
  const result = apply(state, admin, env, sheets)
  expect(result.ok).toBe(true)
  expect(rosterLocked(result)).toBe(true)
  const line = lineOf(state, "L1")
  expect(line.a).toEqual(monthsOf(25, 0))
  expect(line.f).toEqual(monthsOf(40, 2))
  expect(line.owner).toEqual({ id: "owner-2", name: "Ada Owner" })
  expect(line.name).toBe("Kept licences")
  expect(line.desc).toBe("Kept description")
  expectBudgetUntouched(line, NULL_BUDGET)
  expect(line.el).toBe("services")
  expect(line.cur).toBe("USD")
  expect(line.entity).toBe("entity-1")
  expect(line.alloc).toBe("alloc-1")
  expect(line.legacy).toEqual({ keep: true })
  const bare = lineOf(state, "L2")
  expect(bare.a).toEqual(monthsOf(8))
  expect(bare.name).toBe("Bare line")
  expect(bare.owner).toEqual({ id: "other-owner", name: "Other Owner" })
  expectBudgetUntouched(bare, undefined)
  expect(bare.legacy).toEqual({ keep: true })
  expect(viewedLine(state, admin, env, "L1").b).toEqual(NULL_BUDGET)
  expect(viewedLine(state, admin, env, "L1").a).toEqual(monthsOf(25, 0))
  expect(Object.hasOwn(viewedLine(state, admin, env, "L2"), "annual")).toBe(false)
  expectSamePeople(state, before)
  expect(state.audit.map((entry) => entry.record)).toEqual(["v:lines:L1", "v:lines:L2"])
  expect(Object.keys(state.versions).sort()).toEqual(["v:lines:L1", "v:lines:L2", "v:positions:sync"])
  expect(state.versions["roster:file"]).toBeUndefined()
  expect(state.versions["v:positions:sync"]).toEqual({ version: 5, by: "earlier" })
  expect(Object.keys(record(hcOf(state).hrAF, "hrAF"))).toEqual(["Existing"])
})

test("AJ-PL-LOCK-ROSTER HR import warns and leaves lines, roster and positions unchanged", async () => {
  const env = environment()
  const state = plan(true)
  const sheets = await combinedSheets(state, env)
  const before = structuredClone(state)
  const result = apply(state, hr, env, sheets)
  expect(result.ok).toBe(true)
  expect(rosterLocked(result)).toBe(true)
  expect(rows(storedVersion(state).lines)).toEqual(rows(storedVersion(before).lines))
  expectSamePeople(state, before)
  expect(state.audit).toEqual([])
  expect(state.versions).toEqual(before.versions)
  expect(Object.keys(record(hcOf(state).hrAF, "hrAF"))).toEqual(["Existing"])
})

test("AJ-PL-LOCK-ROSTER finance and budget owner All Members imports stay 403", async () => {
  const env = environment()
  const stale = plan(true)
  stale.versions["versions:v"] = { version: 2, by: "other" }
  const staleBefore = structuredClone(stale)
  const staleSheets = await combinedSheets(stale, env)
  expect(apply(stale, viewer, env, staleSheets, 0)).toMatchObject({ ok: false, status: 403 })
  expect(stale).toEqual(staleBefore)
  expect(apply(stale, finance, env, staleSheets, 0)).toMatchObject({ ok: false, status: 409 })
  expect(stale).toEqual(staleBefore)

  const state = plan(true)
  const sheets = await combinedSheets(state, env)
  for (const actor of [finance, owned, outsider]) {
    const sample = plan(true)
    const before = structuredClone(sample)
    expect(apply(sample, actor, env, sheets)).toMatchObject({ ok: false, status: 403 })
    expect(sample).toEqual(before)
  }
  const denied = plan(true)
  const before = structuredClone(denied)
  expect(apply(denied, viewer, env, sheets)).toMatchObject({ ok: false, status: 403 })
  expect(denied).toEqual(before)
})

test("AJ-PL-LOCK-ROSTER stale line token rolls the whole workbook back", async () => {
  const env = environment()
  const state = plan(true)
  state.versions["v:lines:L2"] = { version: 3, by: "other" }
  const sheets = await combinedSheets(state, env)
  const before = structuredClone(state)
  const postedVersions: Record<string, unknown> = structuredClone(state.versions)
  postedVersions["v:lines:L2"] = 2
  expect(apply(state, admin, env, sheets, 0, { versions: postedVersions })).toMatchObject({
    ok: false,
    status: 409,
  })
  expect(state).toEqual(before)
})

test("AJ-PL-LOCK-ROSTER unlocked admin and HR roster import succeeds and an official copy stays unlocked", async () => {
  const env = environment()
  const members = await memberSheets(env)
  const rosterSheets: Record<string, Record<string, unknown>[]> = {
    "All Members": members["All Members"] ?? [],
    "Summary by Leader": members["Summary by Leader"] ?? [],
  }
  for (const actor of [admin, hr]) {
    const state = plan(false)
    const result = apply(state, actor, env, rosterSheets)
    expect(result.ok).toBe(true)
    expect(state.data.roster).toEqual(adaRoster)
    expect(storedVersion(state).locked).toBe(false)
    expect(Object.keys(record(hcOf(state).hrAF, "hrAF"))).toEqual(["Existing"])
    expect(hcOf(state).leaderDomains).toEqual({ Marta: "IT" })
    expect(state.sequences).toEqual({ cpx: 80 })
    expect(state.notices).toEqual([])
    expect(rows(storedVersion(state).projects)[0]?.code).toBe("")
  }

  const blocked = plan(true)
  blocked.data.officials = { "2027": "v" }
  const blockedBefore = structuredClone(blocked)
  expect(apply(blocked, finance, env, rosterSheets, 0, { newVersion: true })).toMatchObject({ ok: false, status: 403 })
  expect(blocked).toEqual(blockedBefore)

  const copy = plan(true)
  copy.data.officials = { "2027": "v" }
  const sourcePositions = structuredClone(rows(hcOf(copy).positions))
  const sourceLines = structuredClone(rows(storedVersion(copy).lines))
  const result = apply(copy, admin, env, rosterSheets, 0, { newVersion: true })
  expect(result.ok).toBe(true)
  if (!result.ok) return
  const versions = rows(copy.data.versions)
  expect(versions).toHaveLength(2)
  expect(versions[0]?.locked).toBe(true)
  expect(versions[0]?.id).toBe("v")
  expect(rows(record(versions[0]?.hc, "source headcount").positions)).toEqual(sourcePositions)
  expect(rows(versions[0]?.lines)).toEqual(sourceLines)
  expect(versions[1]?.locked).toBe(false)
  expect(versions[1]?.id).toBe(result.value)
  expect(copy.data.officials).toEqual({ "2027": "v" })
  expect(copy.data.roster).toEqual(adaRoster)
  expect(copy.versions["roster:file"]).toEqual({ version: 1, by: "directory-admin" })
  expect(copy.versions["v:positions:sync"]).toEqual({ version: 5, by: "earlier" })
  expect(copy.versions["v:lines:L1"]).toBeUndefined()
  for (const version of versions)
    expect(Object.keys(record(record(version.hc, "headcount").hrAF, "hrAF"))).toEqual(["Existing"])
  expect(copy.sequences).toEqual({ cpx: 80 })
  expect(copy.notices).toEqual([])
})

test("AJ-PL-LOCK-ROSTER position, rate and FX sheets stay warned and do not replace the roster", async () => {
  const env = environment()
  const state = plan(true)
  const planner = await plannerSheets(state, env)
  const headcount = planner.Headcount ?? []
  const rates = planner["Rate cards"] ?? []
  const fx = planner["FX rates"] ?? []
  if (!headcount.length || !rates.length || !fx.length) throw new Error("Expected position, rate and FX sheets")
  expect(headcount[0]).toHaveProperty("FTE")
  expect(headcount[0]).toHaveProperty("Position ID")
  const before = structuredClone(state)
  const result = apply(state, admin, env, {
    Headcount: [{ ...headcount[0], FTE: 9, Name: "Injected" }],
    "Rate cards": [{ ...rates[0], "Annual cost per FTE": 1 }],
    "FX rates": [{ ...fx[0], "USD per 1 unit": 9 }],
  })
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.warnings).toEqual(
    expect.arrayContaining([
      "Headcount unchanged: budget or role is read-only",
      "Rate cards unchanged: budget or role is read-only",
      "FX rates unchanged: budget or role is read-only",
    ]),
  )
  expect(rows(storedVersion(state).lines)).toEqual(rows(storedVersion(before).lines))
  expectSamePeople(state, before)
  expect(state.versions).toEqual(before.versions)
  expect(state.audit).toEqual(before.audit)
  expect(state.versions["roster:file"]).toBeUndefined()
})

test("AJ-PL-EMPTY-SAVE treats valid empty budget markers as metadata and keeps invalid markers at 422", () => {
  for (const budgetEdited of ["[]", " [ ] "]) {
    const env = environment()
    const state = plan(false)
    state.versions["v:lines:L1"] = { version: 4, by: "other" }
    const before = structuredClone(state)
    const values = { collection: "lines", budgetEdited }
    expect(execute(state, admin, env, "OPEX", "save", "L1", values, 3)).toMatchObject({ ok: false, status: 409 })
    expect(state).toEqual(before)
    expect(execute(state, admin, env, "OPEX", "save", "L1", values, 4)).toMatchObject({ ok: false, status: 403 })
    expect(state).toEqual(before)
  }
  for (const budgetEdited of ["not-json", "[0]"]) {
    const env = environment()
    const state = plan(false)
    state.versions["v:lines:L1"] = { version: 4, by: "other" }
    const before = structuredClone(state)
    expect(execute(state, admin, env, "OPEX", "save", "L1", { collection: "lines", budgetEdited }, 4))
      .toMatchObject({ ok: false, status: 422 })
    expect(state).toEqual(before)
  }
})
