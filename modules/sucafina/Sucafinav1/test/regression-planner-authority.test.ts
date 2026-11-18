// AJ-PL-IMPORT-HRDOM. Phantom HR domains are refused through domain.execute. Hosted CI only.
import { expect, test } from "bun:test"
import type { Actor, Result, Snapshot } from "../runtime/contract.ts"
import { domain } from "../runtime/planner.ts"

const at = "2026-11-12T12:00:00Z"
const environment = {
  at,
  id: () => "generated-id",
  directory: [
    { id: "owner-1", name: "Budget Owner" },
    { id: "other", name: "Other Owner" },
  ],
}
const finance: Actor = { id: "finance", canWrite: true, roles: ["finance"] }
const hr: Actor = { id: "hr", canWrite: true, roles: ["hr"] }
const admin: Actor = { id: "directory-admin", canWrite: true, roles: ["admin"] }
const owner: Actor = { id: "owner-1", canWrite: true, roles: ["budget owner"], domains: ["Apps"] }
const ghostOwner: Actor = { id: "owner-ghost", canWrite: true, roles: ["budget owner"], domains: ["Ghost"] }
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function repeat<T>(value: T): T[] {
  return Array.from({ length: 12 }, () => value)
}

function vector(first: number): (number | null)[] {
  return [first, ...repeat(null).slice(1)]
}

function plan(locked: boolean): Snapshot {
  return {
    data: {
      versions: [
        {
          id: "V1",
          name: "FY26",
          year: 2026,
          locked,
          closed: 0,
          lines: [
            {
              id: "owned-line",
              sec: "opex",
              el: "licenses",
              name: "Owned licenses",
              cur: "USD",
              annual: 1200,
              b: repeat(100),
              bm: repeat(false),
              a: repeat(null),
              f: repeat(null),
              owner: { id: "owner-1", name: "Budget Owner" },
            },
            {
              id: "domain-line",
              sec: "opex",
              el: "services",
              name: "Domain services",
              cur: "USD",
              annual: 600,
              b: repeat(50),
              bm: repeat(false),
              a: repeat(null),
              f: repeat(null),
              domain: "Apps",
              owner: { id: "other", name: "Other Owner" },
            },
          ],
          projects: [],
          hc: {
            positions: [
              {
                id: "pos-real",
                name: "Real person",
                title: "Analyst",
                type: "Employee",
                location: "Brazil",
                domain: "Real",
                include: true,
                fte: 1,
                start: 1,
                end: 12,
              },
            ],
            rates: [{ id: "rate-1", name: "Employee", locs: "Brazil", annual: 120000, cur: "USD" }],
            inc: 0,
            incMonth: 1,
            hrAF: {
              Kept: { a: vector(1), f: repeat(null) },
              Apps: { a: repeat(null), f: repeat(null) },
            },
          },
          fx: [],
          lists: {},
        },
      ],
      officials: {},
      entities: [],
      allocations: [],
      roster: [],
    },
    versions: {
      "versions:V1": { version: 4, by: "prior" },
      "V1:hrAF:HR:Kept": { version: 3, by: "prior" },
      "V1:hrAF:HR:Apps": { version: 2, by: "prior" },
      "V1:lines:owned-line": { version: 1, by: "prior" },
      "V1:lines:domain-line": { version: 1, by: "prior" },
      "V1:rates:rate-1": { version: 1, by: "prior" },
      "seed:marker": { version: 9, by: "prior" },
    },
    sequences: { cpx: 80 },
    audit: [{ who: "prior", at: "2026-01-01T00:00:00Z", record: "seed", was: null, became: "seed" }],
    notices: [{ kind: "pending", to: ["prior"], record: "seed", at: "2026-01-01T00:00:00Z" }],
  }
}

function opexRow(fields: Record<string, unknown>): Record<string, unknown> {
  return {
    "Line ID": "",
    "Cost element": "Licenses",
    "Vendor / item": "",
    Description: "",
    Currency: "USD",
    Measure: "Actual",
    ...Object.fromEntries(MONTHS.map((month) => [month, ""])),
    Total: "",
    ...fields,
  }
}

function executeSave(state: Snapshot, who: Actor, page: string, id: string, version: number, values: Record<string, unknown>) {
  return domain.execute(
    state,
    who,
    { page, action: "save", id, version, values: { versionId: "V1", ...values } },
    environment,
  )
}

function executeImport(state: Snapshot, who: Actor, sheets: Record<string, Record<string, unknown>[]>, versions?: Record<string, unknown>) {
  return domain.execute(
    state,
    who,
    {
      page: "Overview",
      action: "import-workbook",
      version: state.versions["versions:V1"].version,
      values: { versionId: "V1", sheets, versions: versions ?? state.versions },
    },
    environment,
  )
}

function storedVersion(state: Snapshot) {
  return (state.data.versions as {
    locked: boolean
    lines: Record<string, unknown>[]
    hc: {
      positions: Record<string, unknown>[]
      rates: Record<string, unknown>[]
      hrAF: Record<string, unknown>
    }
  }[])[0]
}

type HrLine = { id?: string; domain?: string; synthetic?: boolean; a?: (number | null)[]; f?: (number | null)[] }

function viewed(state: Snapshot) {
  return (domain.view(state, finance, environment).data.versions as {
    hr: HrLine[]
    summary: { hr: HrLine[]; lines: HrLine[] }
    hc: { hrAF: Record<string, unknown> }
  }[])[0]
}

function expectSnapshot(state: Snapshot, before: Snapshot) {
  expect(state.data).toEqual(before.data)
  expect(state.versions).toEqual(before.versions)
  expect(state.sequences).toEqual(before.sequences)
  expect(state.audit).toEqual(before.audit)
  expect(state.notices).toEqual(before.notices)
}

function expectGhostAbsent(state: Snapshot) {
  expect(Object.keys(storedVersion(state).hc.hrAF)).not.toContain("Ghost")
  const version = viewed(state)
  expect(Object.keys(version.hc.hrAF)).not.toContain("Ghost")
  const domains = version.hr.map((line) => line.domain)
  expect(domains).toEqual(expect.arrayContaining(["Real", "Kept", "Apps"]))
  expect(domains).not.toContain("Ghost")
  expect(version.summary.hr.map((line) => line.domain)).toEqual(expect.arrayContaining(["Real", "Kept", "Apps"]))
  expect(version.summary.hr.map((line) => line.domain)).not.toContain("Ghost")
  const synthetic = version.summary.lines.filter((line) => line.synthetic === true)
  expect(synthetic.map((line) => line.id)).toEqual(expect.arrayContaining(["HR:Real", "HR:Kept", "HR:Apps"]))
  expect(synthetic.map((line) => line.id)).not.toContain("HR:Ghost")
}

function expectForbidden(state: Snapshot, before: Snapshot, result: Result) {
  expect(result).toMatchObject({ ok: false, status: 403 })
  expectSnapshot(state, before)
  expectGhostAbsent(state)
}

function expectSentinels(state: Snapshot) {
  expect(state.sequences.cpx).toBe(80)
  expect(state.notices).toEqual([{ kind: "pending", to: ["prior"], record: "seed", at: "2026-01-01T00:00:00Z" }])
  expect(state.versions["seed:marker"]).toEqual({ version: 9, by: "prior" })
  expect(state.versions["versions:V1"]).toEqual({ version: 4, by: "prior" })
  expect(state.audit[0]).toEqual({ who: "prior", at: "2026-01-01T00:00:00Z", record: "seed", was: null, became: "seed" })
}

function lineField(state: Snapshot, id: string, field: string) {
  const line = storedVersion(state).lines.find((row) => row.id === id)
  return line?.[field]
}

function hrField(state: Snapshot, domainName: string, field: string): unknown {
  const row = storedVersion(state).hc.hrAF[domainName]
  if (row === null || typeof row !== "object" || Array.isArray(row)) return undefined
  return (row as Record<string, unknown>)[field]
}

const ghostActual = opexRow({
  "Line ID": "HR:Ghost",
  "Cost element": "HR Staff",
  "Vendor / item": "Ghost",
  Measure: "Actual",
  Jan: 5000,
})
const ghostVendorActual = opexRow({
  "Line ID": "",
  "Cost element": "HR Staff",
  "Vendor / item": "Ghost",
  Measure: "Actual",
  Jan: 5000,
})
const ghostBudget = opexRow({
  "Line ID": "HR:Ghost",
  "Cost element": "HR Staff",
  "Vendor / item": "Ghost",
  Measure: "Budget",
})
const ghostForecast = opexRow({
  "Line ID": "HR:Ghost",
  "Cost element": "HR Staff",
  "Vendor / item": "Ghost",
  Measure: "Forecast",
  Jan: 5000,
})

test("seeded plan shows position domain Real and existing hrAF keys and omits Ghost", () => {
  const state = plan(true)
  expect(storedVersion(state).locked).toBe(true)
  expect(storedVersion(state).hc.positions).toHaveLength(1)
  expect(storedVersion(state).hc.positions[0]).toMatchObject({ id: "pos-real", domain: "Real" })
  expect(Object.keys(storedVersion(state).hc.hrAF).sort()).toEqual(["Apps", "Kept"])
  expect(storedVersion(state).hc.positions.some((position) => position.domain === "Kept")).toBe(false)
  expectGhostAbsent(state)
})

test("locked finance direct save of missing HR:Ghost actual a[0]=5000 is forbidden", () => {
  const state = plan(true)
  const before = structuredClone(state)
  expectForbidden(
    state,
    before,
    executeSave(state, finance, "OPEX", "HR:Ghost", 0, { collection: "lines", a: vector(5000) }),
  )
})

test("unlocked finance direct save of missing HR:Ghost actual a[0]=5000 is forbidden", () => {
  const state = plan(false)
  const before = structuredClone(state)
  expectForbidden(
    state,
    before,
    executeSave(state, finance, "OPEX", "HR:Ghost", 0, { collection: "lines", a: vector(5000) }),
  )
})

test("locked admin direct save of missing HR:Ghost actual a[0]=5000 is forbidden", () => {
  const state = plan(true)
  const before = structuredClone(state)
  expectForbidden(
    state,
    before,
    executeSave(state, admin, "OPEX", "HR:Ghost", 0, { collection: "lines", a: vector(5000) }),
  )
})

test("HR metadata-only save does not insert a phantom hrAF key", () => {
  const state = plan(false)
  const before = structuredClone(state)
  expectForbidden(state, before, executeSave(state, hr, "OPEX", "HR:Ghost", 0, { collection: "lines" }))
})

test("HR empty-budget import does not insert an empty hrAF object", () => {
  const state = plan(false)
  const before = structuredClone(state)
  expectForbidden(state, before, executeImport(state, hr, { OPEX: [ghostBudget] }))
})

test("budget owner outside Ghost cannot create it by a metadata save", () => {
  const state = plan(false)
  const before = structuredClone(state)
  expectForbidden(state, before, executeSave(state, owner, "OPEX", "HR:Ghost", 0, { collection: "lines" }))
})

test("budget owner outside Ghost cannot create it by an empty-budget import", () => {
  const state = plan(false)
  const before = structuredClone(state)
  expectForbidden(state, before, executeImport(state, owner, { OPEX: [ghostBudget] }))
})

test("budget owner outside Ghost is refused a populated forecast save and import", () => {
  const saved = plan(false)
  const savedBefore = structuredClone(saved)
  expectForbidden(saved, savedBefore, executeSave(saved, owner, "OPEX", "HR:Ghost", 0, { collection: "lines", f0: 5000 }))
  const imported = plan(true)
  const importedBefore = structuredClone(imported)
  expectForbidden(imported, importedBefore, executeImport(imported, owner, { OPEX: [ghostForecast] }))
})

test("in-domain budget owner cannot manufacture missing Ghost by a forecast save", () => {
  const state = plan(true)
  const before = structuredClone(state)
  expectForbidden(
    state,
    before,
    executeSave(state, ghostOwner, "OPEX", "HR:Ghost", 0, { collection: "lines", f0: 5000 }),
  )
})

test("in-domain budget owner cannot manufacture missing Ghost by a forecast import", () => {
  const state = plan(true)
  const before = structuredClone(state)
  expectForbidden(state, before, executeImport(state, ghostOwner, { OPEX: [ghostForecast] }))
})

test("in-domain budget owner cannot manufacture missing Ghost by a metadata save", () => {
  const state = plan(false)
  const before = structuredClone(state)
  expectForbidden(state, before, executeSave(state, ghostOwner, "OPEX", "HR:Ghost", 0, { collection: "lines" }))
})

test("in-domain budget owner cannot manufacture missing Ghost by an empty-budget import", () => {
  const state = plan(false)
  const before = structuredClone(state)
  expectForbidden(state, before, executeImport(state, ghostOwner, { OPEX: [ghostBudget] }))
})

test("locked finance import of Line ID HR:Ghost rolls back a preceding permitted actual", () => {
  const state = plan(true)
  const before = structuredClone(state)
  expectForbidden(
    state,
    before,
    executeImport(state, finance, {
      OPEX: [
        opexRow({
          "Line ID": "owned-line",
          "Cost element": "Licenses",
          "Vendor / item": "Owned licenses",
          Measure: "Actual",
          Jan: 80,
        }),
        ghostActual,
      ],
    }),
  )
  expect(lineField(state, "owned-line", "a")).toEqual(repeat(null))
})

test("locked finance import of HR Staff vendor Ghost rolls back a preceding permitted hrAF actual", () => {
  const state = plan(true)
  const before = structuredClone(state)
  expectForbidden(
    state,
    before,
    executeImport(state, finance, {
      OPEX: [
        opexRow({
          "Line ID": "HR:Kept",
          "Cost element": "HR Staff",
          "Vendor / item": "Kept",
          Measure: "Actual",
          Jan: 5000,
        }),
        ghostVendorActual,
      ],
    }),
  )
  expect(hrField(state, "Kept", "a")).toEqual(vector(1))
  expect(state.versions["V1:hrAF:HR:Kept"]).toEqual({ version: 3, by: "prior" })
})

test("unlocked finance import of Line ID HR:Ghost is forbidden for the whole workbook", () => {
  const state = plan(false)
  const before = structuredClone(state)
  expectForbidden(state, before, executeImport(state, finance, { OPEX: [ghostActual] }))
})

test("finance actuals stay allowed on a locked version when a position domain exists and hrAF does not", () => {
  const state = plan(true)
  expect(storedVersion(state).hc.hrAF.Real).toBeUndefined()
  expect(
    executeSave(state, finance, "OPEX", "HR:Real", 0, { collection: "lines", a: vector(5000) }),
  ).toMatchObject({ ok: true })
  expect(hrField(state, "Real", "a")).toEqual(vector(5000))
  expect(state.versions["V1:hrAF:HR:Real"]).toEqual({ version: 1, by: "finance" })
  expect(storedVersion(state).hc.positions[0]).toMatchObject({ domain: "Real" })
  expect(storedVersion(state).locked).toBe(true)
  expect(viewed(state).hr.find((line) => line.domain === "Real")?.a?.[0]).toBe(5000)
  expect(state.audit.some((entry) => entry.record === "V1:hrAF:HR:Real" && entry.who === "finance")).toBe(true)
  expectSentinels(state)
  expectGhostAbsent(state)
})

test("finance actuals stay allowed on a locked version when the hrAF key exists and no position does", () => {
  const state = plan(true)
  expect(storedVersion(state).hc.positions.some((position) => position.domain === "Kept")).toBe(false)
  expect(
    executeSave(state, finance, "OPEX", "HR:Kept", 3, { collection: "lines", a: vector(5000) }),
  ).toMatchObject({ ok: true })
  expect(hrField(state, "Kept", "a")).toEqual(vector(5000))
  expect(state.versions["V1:hrAF:HR:Kept"]).toEqual({ version: 4, by: "finance" })
  expect(viewed(state).hr.find((line) => line.domain === "Kept")?.a?.[0]).toBe(5000)
  expect(state.audit.some((entry) => entry.record === "V1:hrAF:HR:Kept" && entry.who === "finance")).toBe(true)
  expectSentinels(state)
  expectGhostAbsent(state)
})

test("in-domain budget owner forecast on an existing HR domain stays allowed while locked", () => {
  const saved = plan(true)
  expect(executeSave(saved, owner, "OPEX", "HR:Apps", 2, { collection: "lines", f0: 40 })).toMatchObject({ ok: true })
  expect(hrField(saved, "Apps", "f")).toEqual(vector(40))
  expect(hrField(saved, "Apps", "a")).toEqual(repeat(null))
  expect(saved.versions["V1:hrAF:HR:Apps"]).toEqual({ version: 3, by: "owner-1" })
  expect(viewed(saved).hr.find((line) => line.domain === "Apps")?.f?.[0]).toBe(40)
  expectSentinels(saved)
  expectGhostAbsent(saved)

  const imported = plan(true)
  expect(
    executeImport(imported, owner, {
      OPEX: [
        opexRow({
          "Line ID": "HR:Apps",
          "Cost element": "HR Staff",
          "Vendor / item": "Apps",
          Measure: "Forecast",
          Jan: 40,
        }),
      ],
    }),
  ).toMatchObject({ ok: true })
  expect(hrField(imported, "Apps", "f")).toEqual(vector(40))
  expect(imported.versions["V1:hrAF:HR:Apps"]).toEqual({ version: 3, by: "owner-1" })
  expect(imported.audit.some((entry) => entry.record === "V1:hrAF:HR:Apps" && entry.who === "owner-1")).toBe(true)
  expectSentinels(imported)
  expectGhostAbsent(imported)
})

test("budget owner forecast on an owned line and an in-domain ordinary line stays allowed while locked", () => {
  const state = plan(true)
  expect(executeSave(state, owner, "OPEX", "owned-line", 1, { collection: "lines", f0: 25 })).toMatchObject({
    ok: true,
  })
  expect(executeSave(state, owner, "OPEX", "domain-line", 1, { collection: "lines", f0: 30 })).toMatchObject({
    ok: true,
  })
  expect(lineField(state, "owned-line", "f")).toEqual(vector(25))
  expect(lineField(state, "owned-line", "annual")).toBe(1200)
  expect(lineField(state, "owned-line", "owner")).toEqual({ id: "owner-1", name: "Budget Owner" })
  expect(lineField(state, "domain-line", "f")).toEqual(vector(30))
  expect(lineField(state, "domain-line", "domain")).toBe("Apps")
  expect(lineField(state, "domain-line", "annual")).toBe(600)
  expect(state.versions["V1:lines:owned-line"]).toEqual({ version: 2, by: "owner-1" })
  expect(state.versions["V1:lines:domain-line"]).toEqual({ version: 2, by: "owner-1" })
  expectSentinels(state)
  expectGhostAbsent(state)
})

test("unlocked admin direct save may create an explicit missing HR domain", () => {
  const state = plan(false)
  expect(executeSave(state, admin, "OPEX", "HR:Ghost", 0, { collection: "lines", a: vector(5000) })).toMatchObject({
    ok: true,
  })
  expect(hrField(state, "Ghost", "a")).toEqual(vector(5000))
  expect(state.versions["V1:hrAF:HR:Ghost"]).toEqual({ version: 1, by: "directory-admin" })
  expect(viewed(state).hr.find((line) => line.domain === "Ghost")?.a?.[0]).toBe(5000)
  expect(viewed(state).summary.lines.filter((line) => line.synthetic === true).map((line) => line.id)).toContain(
    "HR:Ghost",
  )
  expect(state.audit.some((entry) => entry.record === "V1:hrAF:HR:Ghost" && entry.who === "directory-admin")).toBe(true)
  expect(storedVersion(state).hc.rates[0]).toMatchObject({ annual: 120000 })
  expect(storedVersion(state).locked).toBe(false)
  expectSentinels(state)
})

test("unlocked admin workbook import may create an explicit missing HR domain", () => {
  const state = plan(false)
  expect(
    executeImport(state, admin, {
      OPEX: [
        opexRow({
          "Line ID": "HR:Mint",
          "Cost element": "HR Staff",
          "Vendor / item": "Mint",
          Measure: "Actual",
          Jan: 5000,
        }),
      ],
    }),
  ).toMatchObject({ ok: true })
  expect(hrField(state, "Mint", "a")).toEqual(vector(5000))
  expect(hrField(state, "Ghost", "a")).toBeUndefined()
  expect(state.versions["V1:hrAF:HR:Mint"]).toEqual({ version: 1, by: "directory-admin" })
  expect(viewed(state).hr.find((line) => line.domain === "Mint")?.a?.[0]).toBe(5000)
  expect(state.audit.some((entry) => entry.record === "V1:hrAF:HR:Mint" && entry.who === "directory-admin")).toBe(true)
  expectSentinels(state)
  expectGhostAbsent(state)
})

test("an existing hrAF key still rejects a stale token with 409 and writes nothing", () => {
  const saved = plan(true)
  const savedBefore = structuredClone(saved)
  expect(executeSave(saved, finance, "OPEX", "HR:Kept", 2, { collection: "lines", a: vector(5000) })).toMatchObject({
    ok: false,
    status: 409,
  })
  expectSnapshot(saved, savedBefore)

  const imported = plan(true)
  const importedBefore = structuredClone(imported)
  const revisions: Record<string, unknown> = { ...imported.versions, "V1:hrAF:HR:Kept": 2 }
  expect(
    executeImport(
      imported,
      finance,
      {
        OPEX: [
          opexRow({
            "Line ID": "HR:Kept",
            "Cost element": "HR Staff",
            "Vendor / item": "Kept",
            Measure: "Actual",
            Jan: 5000,
          }),
        ],
      },
      revisions,
    ),
  ).toMatchObject({ ok: false, status: 409 })
  expectSnapshot(imported, importedBefore)
  expect(hrField(imported, "Kept", "a")).toEqual(vector(1))
})

test("HR still cannot write actuals on an existing hrAF key", () => {
  const state = plan(false)
  const before = structuredClone(state)
  expect(executeSave(state, hr, "OPEX", "HR:Kept", 3, { collection: "lines", a: vector(5000) })).toMatchObject({
    ok: false,
    status: 403,
  })
  expectSnapshot(state, before)
  expect(hrField(state, "Kept", "a")).toEqual(vector(1))
  expectGhostAbsent(state)
})

test("budget owner still cannot write a rate card by save or import", () => {
  const saved = plan(false)
  const savedBefore = structuredClone(saved)
  expect(
    executeSave(saved, owner, "Headcount", "rate-1", 1, { collection: "rates", annual: 1 }),
  ).toMatchObject({ ok: false, status: 403 })
  expectSnapshot(saved, savedBefore)
  expect(storedVersion(saved).hc.rates[0]).toMatchObject({ annual: 120000 })

  const imported = plan(false)
  const importedBefore = structuredClone(imported)
  const importedResult = executeImport(imported, owner, {
    "Rate cards": [
      {
        "Rate ID": "rate-1",
        "Rate card": "Employee",
        Locations: "Brazil",
        Currency: "USD",
        "Annual cost per FTE": 1,
      },
    ],
  })
  expect(importedResult).toMatchObject({ ok: true })
  expect(importedResult.ok ? importedResult.warnings : []).toEqual([
    "Rate cards unchanged: budget or role is read-only",
  ])
  expectSnapshot(imported, importedBefore)
  expect(storedVersion(imported).hc.rates[0]).toMatchObject({ annual: 120000 })
})

test("HR may create a headcount position without an empty OPEX HR row inserting hrAF", () => {
  const state = plan(false)
  expect(
    executeSave(state, hr, "Headcount", "pos-new", 0, {
      collection: "positions",
      name: "New hire",
      domain: "Staffing",
      type: "Employee",
      fte: 1,
      start: 1,
      end: 12,
    }),
  ).toMatchObject({ ok: true })
  expect(storedVersion(state).hc.positions.some((position) => position.name === "New hire" && position.domain === "Staffing")).toBe(
    true,
  )
  expect(storedVersion(state).hc.hrAF.Staffing).toBeUndefined()
  expect(state.versions["V1:positions:pos-new"]).toEqual({ version: 1, by: "hr" })
  expectSentinels(state)
  expectGhostAbsent(state)
})

test("an unknown non-HR line is warning-skipped and does not refuse the workbook", () => {
  const alone = plan(true)
  const aloneBefore = structuredClone(alone)
  const skipped = executeImport(alone, finance, {
    OPEX: [
      opexRow({
        "Line ID": "missing-opex",
        "Cost element": "Licenses",
        "Vendor / item": "Unknown vendor",
        Measure: "Actual",
        Jan: 5000,
      }),
    ],
  })
  expect(skipped).toMatchObject({ ok: true })
  expect(skipped.ok ? skipped.warnings : []).toEqual(["Unknown line unchanged: Unknown vendor"])
  expectSnapshot(alone, aloneBefore)

  const mixed = plan(true)
  const mixedResult = executeImport(mixed, finance, {
    OPEX: [
      opexRow({
        "Line ID": "owned-line",
        "Cost element": "Licenses",
        "Vendor / item": "Owned licenses",
        Measure: "Actual",
        Jan: 80,
      }),
      opexRow({
        "Line ID": "missing-opex",
        "Cost element": "Licenses",
        "Vendor / item": "Unknown vendor",
        Measure: "Actual",
        Jan: 5000,
      }),
    ],
  })
  expect(mixedResult).toMatchObject({ ok: true })
  expect(mixedResult.ok ? mixedResult.warnings : []).toEqual(["Unknown line unchanged: Unknown vendor"])
  expect(lineField(mixed, "owned-line", "a")).toEqual(vector(80))
  expect(storedVersion(mixed).lines.some((line) => line.id === "missing-opex")).toBe(false)
  expect(mixed.versions["V1:lines:owned-line"]).toEqual({ version: 2, by: "finance" })
  expect(mixed.audit.some((entry) => entry.record === "V1:lines:owned-line" && entry.who === "finance")).toBe(true)
  expectSentinels(mixed)
  expectGhostAbsent(mixed)
})
