import { expect, test } from "bun:test"
import { nativeWriteFlow } from "./fixture/native-write.ts"
import { empty } from "./fixture/persistence.ts"

const operations = "IT Operations"
const security = "IT Security KPIs"
const at = "2026-11-12T18:00:00Z"
const people = [
  {
    token: "admin-token",
    id: "fixture-operations-admin",
    name: "Synthetic Operations Admin",
    roles: [{ surface: "dashboard" as const, role: "admin" }],
  },
  {
    token: "operations-token",
    id: "fixture-operations-contributor",
    name: "Synthetic Operations Contributor",
    roles: [{ surface: "dashboard" as const, role: "contributor" }],
    access: { dashboard: { assigned: ["Operations"] } },
  },
  {
    token: "security-token",
    id: "fixture-security-contributor",
    name: "Synthetic Security Contributor",
    roles: [{ surface: "dashboard" as const, role: "contributor" }],
    access: { dashboard: { assigned: ["security"] } },
  },
  {
    token: "viewer-token",
    id: "fixture-operations-viewer",
    name: "Synthetic Operations Viewer",
    roles: [{ surface: "dashboard" as const, role: "viewer" }],
  },
  {
    token: "read-only-token",
    id: "fixture-read-only",
    name: "Synthetic Read Only",
    roles: [{ surface: "dashboard" as const, role: "admin" }],
    canWrite: false as const,
  },
]

test("native Operations admin writes ticket counters and SLA periods with audit and month isolation", async () => {
  const initial = empty()
  initial.data.opsTickets = [{ id: "2026-10", year: 2026, month: 10, "IT Operations|Incidents|Open": 6 }]
  initial.data.opsSLA = [{ id: "2026-10", year: 2026, month: 10, incSLA: 87, svcSLA: 89, avail: 99 }]
  const app = nativeWriteFlow({ people, at, initial: { dashboard: initial } })
  const tickets = await app.command(
    "dashboard",
    {
      page: operations,
      action: "save-tickets",
      version: 0,
      values: {
        year: 2026,
        month: 11,
        "IT Operations|Incidents|Initial Balance": 8,
        "IT Operations|Incidents|Open": 3,
        "IT Operations|Incidents|Closed": 5,
        "IT Operations|Service Requests|Open": 2,
      },
    },
    "admin-token",
  )
  expect(tickets?.status).toBe(200)
  expect(await tickets!.json()).toMatchObject({ ok: true })

  const sla = await app.command(
    "dashboard",
    {
      page: operations,
      action: "save-sla",
      version: 1,
      values: { year: 2026, month: 11, incSLA: 95, svcSLA: 90, avail: "" },
    },
    "admin-token",
  )
  expect(sla?.status).toBe(200)
  expect(await sla!.json()).toMatchObject({ ok: true })
  expect(app.storage.state.dashboard.data.opsTickets).toEqual([
    { id: "2026-10", year: 2026, month: 10, "IT Operations|Incidents|Open": 6 },
    {
      id: "2026-11",
      year: 2026,
      month: 11,
      "IT Operations|Incidents|Initial Balance": 8,
      "IT Operations|Incidents|Open": 3,
      "IT Operations|Incidents|Closed": 5,
      "IT Operations|Service Requests|Initial Balance": 0,
      "IT Operations|Service Requests|Open": 2,
      "IT Operations|Service Requests|Closed": 0,
      "IT Security|Incidents|Initial Balance": 0,
      "IT Security|Incidents|Open": 0,
      "IT Security|Incidents|Closed": 0,
      "IT Security|Service Requests|Initial Balance": 0,
      "IT Security|Service Requests|Open": 0,
      "IT Security|Service Requests|Closed": 0,
      "Infrastructure|Incidents|Initial Balance": 0,
      "Infrastructure|Incidents|Open": 0,
      "Infrastructure|Incidents|Closed": 0,
      "Infrastructure|Service Requests|Initial Balance": 0,
      "Infrastructure|Service Requests|Open": 0,
      "Infrastructure|Service Requests|Closed": 0,
      "Application|Incidents|Initial Balance": 0,
      "Application|Incidents|Open": 0,
      "Application|Incidents|Closed": 0,
      "Application|Service Requests|Initial Balance": 0,
      "Application|Service Requests|Open": 0,
      "Application|Service Requests|Closed": 0,
      "Others (Beyers OT)|Incidents|Initial Balance": 0,
      "Others (Beyers OT)|Incidents|Open": 0,
      "Others (Beyers OT)|Incidents|Closed": 0,
      "Others (Beyers OT)|Service Requests|Initial Balance": 0,
      "Others (Beyers OT)|Service Requests|Open": 0,
      "Others (Beyers OT)|Service Requests|Closed": 0,
    },
  ])
  expect(app.storage.state.dashboard.data.opsSLA).toEqual([
    { id: "2026-10", year: 2026, month: 10, incSLA: 87, svcSLA: 89, avail: 99 },
    { id: "2026-11", year: 2026, month: 11, incSLA: 95, svcSLA: 90, avail: 100 },
  ])
  const read = await app.read("dashboard", operations, "admin-token", {
    opsYear: "2026",
    operationsMonth: "11",
  })
  expect(read?.status).toBe(200)
  const state = (await read!.json()) as {
    data: { opsTickets: Record<string, unknown>[]; opsSLA: Record<string, unknown>[] }
    versions: Record<string, { version: number; by: string }>
    year: number
    month: number
  }
  expect(state).toMatchObject({ year: 2026, month: 11 })
  expect(state.data.opsTickets).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: "2026-11", "IT Operations|Incidents|Open": 3 }),
      expect.objectContaining({ id: "2026-10", "IT Operations|Incidents|Open": 6 }),
    ]),
  )
  expect(state.data.opsSLA).toEqual(
    expect.arrayContaining([
      { id: "2026-11", year: 2026, month: 11, incSLA: 95, svcSLA: 90, avail: 100 },
      { id: "2026-10", year: 2026, month: 10, incSLA: 87, svcSLA: 89, avail: 99 },
    ]),
  )
  expect(state.versions["ops:2026-11"]).toEqual({ version: 2, by: "fixture-operations-admin" })
  expect(app.storage.state.dashboard.versions["ops:2026-11"]).toEqual({
    version: 2,
    by: "fixture-operations-admin",
  })
  expect(app.storage.state.dashboard.audit.map((entry) => entry.record)).toEqual([
    "ops:2026-11",
    "ops:2026-11",
  ])
})

test("native Operations contributor writes only the assigned Operations page", async () => {
  const app = nativeWriteFlow({ people, at })
  const allowed = await app.command(
    "dashboard",
    {
      page: operations,
      action: "save-sla",
      version: 0,
      values: { year: 2026, month: 10, incSLA: 88 },
    },
    "operations-token",
  )
  expect(allowed?.status).toBe(200)
  expect(await allowed!.json()).toMatchObject({ ok: true })
  const beforeDenied = structuredClone(app.storage.state.dashboard)
  const crossAssignment = await app.command(
    "dashboard",
    {
      page: security,
      action: "save-kpi",
      version: 0,
      values: { year: 2026, month: 10, training: 91 },
    },
    "operations-token",
  )
  expect(crossAssignment?.status).toBe(403)
  expect(await crossAssignment!.json()).toMatchObject({ ok: false, status: 403 })
  expect(app.storage.state.dashboard).toEqual(beforeDenied)
})

test("native viewer and read-only admin cannot change Operations or security data", async () => {
  const app = nativeWriteFlow({ people, at })
  const before = structuredClone(app.storage.state.dashboard)
  for (const token of ["viewer-token", "read-only-token"]) {
    const response = await app.command(
      "dashboard",
      {
        page: operations,
        action: "save-tickets",
        version: 0,
        values: { year: 2026, month: 11, "IT Operations|Incidents|Open": 4 },
      },
      token,
    )
    expect(response?.status).toBe(403)
    if (token === "viewer-token") expect(await response!.text()).toBe("Access denied")
    if (token === "read-only-token") expect(await response!.json()).toMatchObject({ ok: false, status: 403 })
    expect(app.storage.state.dashboard).toEqual(before)
  }
  const securityResponse = await app.command(
    "dashboard",
    {
      page: security,
      action: "save-kpi",
      version: 0,
      values: { year: 2026, month: 11, training: 91 },
    },
    "viewer-token",
  )
  expect(securityResponse?.status).toBe(403)
  expect(await securityResponse!.text()).toBe("Access denied")
  expect(app.storage.state.dashboard).toEqual(before)
  const unknownAction = await app.command(
    "dashboard",
    {
      page: operations,
      action: "unknown-operations-action",
      version: 0,
      values: {},
    },
    "admin-token",
  )
  expect(unknownAction?.status).toBe(400)
  expect(await unknownAction!.json()).toMatchObject({ ok: false, status: 400 })
  expect(app.storage.state.dashboard).toEqual(before)
})

test("native security contributor saves selected-period KPIs with explicit zero and versioned audit", async () => {
  const initial = empty()
  initial.data.secKpi = [
    { id: "2026-10", year: 2026, month: 10, training: 90, patch: 80, notes: "Synthetic October KPI" },
  ]
  const app = nativeWriteFlow({ people, at, initial: { dashboard: initial } })
  const response = await app.command(
    "dashboard",
    {
      page: security,
      action: "save-kpi",
      version: 0,
      values: {
        year: 2026,
        month: 11,
        training: 96,
        patch: 0,
        socCritical: 10,
        socHigh: 5,
        socMedium: 2,
        socLow: 3,
        socPending: 4,
        notes: "Synthetic November KPI",
      },
    },
    "security-token",
  )
  expect(response?.status).toBe(200)
  expect(await response!.json()).toMatchObject({ ok: true })
  expect(app.storage.state.dashboard.data.secKpi).toEqual([
    { id: "2026-10", year: 2026, month: 10, training: 90, patch: 80, notes: "Synthetic October KPI" },
    {
      id: "2026-11",
      year: 2026,
      month: 11,
      training: 96,
      assessment: "",
      scan: "",
      patch: 0,
      patchEndpoint: "",
      patchServer: "",
      socCritical: 10,
      socHigh: 5,
      socMedium: 2,
      socLow: 3,
      socPending: 4,
      socTP: "",
      socFP: "",
      socEPS: "",
      socIPs: "",
      socClosure: "",
      notes: "Synthetic November KPI",
    },
  ])
  expect(app.storage.state.dashboard.versions["security:2026-11"]).toEqual({
    version: 1,
    by: "fixture-security-contributor",
  })
  expect(app.storage.state.dashboard.audit[0]).toMatchObject({
    who: "fixture-security-contributor",
    at,
    record: "security:2026-11",
  })
  const read = await app.read("dashboard", security, "security-token", {
    secYear: "2026",
    securityMonth: "11",
  })
  expect(read?.status).toBe(200)
  const state = (await read!.json()) as {
    data: { secKpi: Record<string, unknown>[] }
    versions: Record<string, { version: number; by: string }>
    year: number
    month: number
  }
  expect(state).toMatchObject({ year: 2026, month: 11 })
  expect(state.data.secKpi).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: "2026-11", training: 96, patch: 0 }),
      expect.objectContaining({ id: "2026-10", training: 90, patch: 80, notes: "Synthetic October KPI" }),
    ]),
  )
  expect(state.versions["security:2026-11"]).toEqual({ version: 1, by: "fixture-security-contributor" })
})

test("native Operations counters and security periods reject invalid and stale writes atomically", async () => {
  const app = nativeWriteFlow({ people, at })
  const initial = await app.command(
    "dashboard",
    {
      page: operations,
      action: "save-tickets",
      version: 0,
      values: { year: 2026, month: 11, "IT Operations|Incidents|Open": 3 },
    },
    "admin-token",
  )
  expect(initial?.status).toBe(200)
  await initial!.json()
  const beforeInvalid = structuredClone(app.storage.state.dashboard)
  const invalidCounter = await app.command(
    "dashboard",
    {
      page: operations,
      action: "save-tickets",
      version: 1,
      values: { year: 2026, month: 11, "IT Operations|Incidents|Open": -1 },
    },
    "admin-token",
  )
  expect(invalidCounter?.status).toBe(422)
  expect(await invalidCounter!.json()).toMatchObject({ ok: false, status: 422 })
  expect(app.storage.state.dashboard).toEqual(beforeInvalid)

  const stale = await app.command(
    "dashboard",
    {
      page: operations,
      action: "save-tickets",
      version: 0,
      values: { year: 2026, month: 11, "IT Operations|Incidents|Open": 7 },
    },
    "admin-token",
  )
  expect(stale?.status).toBe(409)
  expect(await stale!.json()).toMatchObject({ ok: false, status: 409, by: "fixture-operations-admin" })
  expect(app.storage.state.dashboard).toEqual(beforeInvalid)

  const invalidPeriod = await app.command(
    "dashboard",
    {
      page: security,
      action: "save-kpi",
      version: 0,
      values: { year: 2026, month: 13, training: 90 },
    },
    "admin-token",
  )
  expect(invalidPeriod?.status).toBe(422)
  expect(await invalidPeriod!.json()).toMatchObject({ ok: false, status: 422 })
  expect(app.storage.state.dashboard).toEqual(beforeInvalid)
})
