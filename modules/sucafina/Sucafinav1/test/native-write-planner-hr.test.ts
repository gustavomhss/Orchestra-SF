import { expect, test } from "bun:test"
import { object, rows } from "../runtime/contract.ts"
import { empty } from "./fixture/persistence.ts"
import { nativeWriteFlow } from "./fixture/native-write.ts"

const people = [
  { token: "admin", id: "admin-id", name: "Admin Example", roles: [{ surface: "planner" as const, role: "admin" }] },
  { token: "hr", id: "hr-id", name: "HR Example", roles: [{ surface: "planner" as const, role: "hr" }] },
  { token: "finance", id: "finance-id", name: "Finance Example", roles: [{ surface: "planner" as const, role: "finance" }] },
  { token: "owner", id: "owner-id", name: "Owner Example", roles: [{ surface: "planner" as const, role: "budget owner" }], access: { planner: { domains: ["IT"] } } },
]

function flow() {
  const initial = empty()
  initial.data = {
    versions: [{ id: "v", name: "Plan", year: 2027, locked: false, closed: 0, lines: [], projects: [], hc: { positions: [], rates: [], inc: 0, incMonth: 1, hrAF: {} }, fx: [], lists: {} }],
    officials: {}, entities: [], allocations: [],
    roster: [
      { name: "Current Example", leader: "Leader Example", status: "Active", start: "2027-01-01" },
      { name: "Future Example", leader: "Leader Example", start: "2028-01-01" },
      { name: "Former Example", leader: "Leader Example", status: "Terminated" },
    ],
  }
  return nativeWriteFlow({ people, initial: { planner: initial } })
}

async function write(app: ReturnType<typeof flow>, token: string, page: string, action: string, id: string | undefined, version: number, values: Record<string, unknown>) {
  const response = await app.command("planner", { page, action, id, version, values }, token)
  expect(response).toBeDefined()
  const body = await response!.json()
  return { status: response!.status, body }
}

async function read(app: ReturnType<typeof flow>, token: string, page = "Headcount") {
  const response = await app.read("planner", page, token, { year: "2027" })
  expect(response?.status).toBe(200)
  return object(await response!.json())
}

function plan(body: Record<string, unknown>) {
  return rows(object(body.data).versions)[0]!
}

test("first version is admitted over HTTP once with revisions and audit", async () => {
  const app = nativeWriteFlow({ people })
  expect(await write(app, "admin", "Versions", "save", undefined, 0, {})).toMatchObject({ status: 200, body: { ok: true } })
  const version = plan(await read(app, "admin", "Versions"))
  expect(version).toMatchObject({ id: "fixture-generated-1", year: 2027, locked: false })
  expect(app.storage.state.planner.versions["versions:first"]).toEqual({ version: 1, by: "admin-id" })
  expect(app.storage.state.planner.audit).toContainEqual(expect.objectContaining({ record: "versions:first", who: "admin-id" }))
  const before = structuredClone(app.storage.state.planner)
  expect(await write(app, "admin", "Versions", "save", undefined, 0, {})).toMatchObject({ status: 400, body: { ok: false } })
  expect(app.storage.state.planner).toEqual(before)
})

test("HR rate and position writes produce private detail and permitted owner aggregates", async () => {
  const app = flow()
  expect((await write(app, "hr", "Headcount", "save", "rate", 0, { versionId: "v", collection: "rates", name: "Employee", locs: "Brazil", annual: 120000, cur: "USD" })).status).toBe(200)
  expect((await write(app, "hr", "Headcount", "save", "person", 0, { versionId: "v", name: "Private Example", location: "Brazil", domain: "IT", fte: 1, start: 12, end: 1, rateId: "rate", rateOverride: 240000 })).status).toBe(200)
  expect((await write(app, "hr", "Headcount", "save", undefined, 0, { versionId: "v", collection: "increase", inc: 10, incMonth: 12 })).status).toBe(200)
  for (const token of ["admin", "hr", "finance"]) {
    const body = await read(app, token)
    expect(object(body.data).headcountMappingVisible).toBe(true)
    const version = plan(body)
    expect(object(version.summary).hrTotal).toBe(242000)
    expect(rows(object(version.hc).positions)[0]).toMatchObject({ start: 1, end: 12, rateId: "rate", rateOverride: 240000 })
    expect(rows(object(version.hc).rates)[0]).toMatchObject({ id: "rate", annual: 120000 })
  }
  const body = await read(app, "owner")
  expect(object(body.data).headcountMappingVisible).toBe(false)
  expect(object(plan(body).summary).hrTotal).toBe(242000)
  expect(JSON.stringify(body.data)).not.toMatch(/"(?:rates|rateId|rateOverride|cost|inc|salary)":/)
  expect(app.storage.state.planner.versions["v:positions:person"]).toEqual({ version: 1, by: "hr-id" })
  expect(app.storage.state.planner.audit).toContainEqual(expect.objectContaining({ record: "v:rates:rate", who: "hr-id" }))
})

test("leader mapping and roster sync preserve a manually assigned domain and exclude ineligible people", async () => {
  const app = flow()
  expect((await write(app, "hr", "Headcount", "save", undefined, 0, { versionId: "v", collection: "leaderDomains", leader: "Leader Example", domain: "Finance" })).status).toBe(200)
  expect((await write(app, "hr", "Headcount", "save", "p", 0, { versionId: "v", name: "Current Example", domain: "IT" })).status).toBe(200)
  expect((await write(app, "hr", "Headcount", "sync", undefined, 1, { versionId: "v" })).status).toBe(200)
  const version = plan(await read(app, "hr"))
  expect(object(object(version.hc).leaderDomains)).toEqual({ "Leader Example": "Finance" })
  expect(rows(object(version.hc).positions)).toHaveLength(1)
  expect(rows(object(version.hc).positions)[0]).toMatchObject({ id: "p", name: "Current Example", domain: "IT", domainManual: true })
  expect(app.storage.state.planner.versions["v:positions:sync"]).toEqual({ version: 2, by: "hr-id" })
  expect(app.storage.state.planner.audit).toContainEqual(expect.objectContaining({ record: "v:leaderDomains", who: "hr-id" }))
  const before = structuredClone(app.storage.state.planner)
  expect((await write(app, "hr", "Headcount", "sync", undefined, 1, { versionId: "v" })).status).toBe(409)
  expect(app.storage.state.planner).toEqual(before)
})

test("HR domain actuals and forecasts preserve sparse zero and null with field and CAS guards", async () => {
  const app = flow()
  expect((await write(app, "hr", "Headcount", "save", "p", 0, { versionId: "v", name: "Example", domain: "IT" })).status).toBe(200)
  expect((await write(app, "finance", "OPEX", "save", "HR:IT", 0, { versionId: "v", a0: 0, f1: 25 })).status).toBe(200)
  expect((await write(app, "finance", "OPEX", "save", "HR:IT", 1, { versionId: "v", f1: null, a11: 42 })).status).toBe(200)
  const hr = rows(plan(await read(app, "finance", "OPEX")).hr).find((row) => row.id === "HR:IT")!
  expect(hr.a).toEqual([0, ...Array(10).fill(null), 42])
  expect(hr.f).toEqual(Array(12).fill(null))
  expect(app.storage.state.planner.versions["v:hrAF:HR:IT"]).toEqual({ version: 2, by: "finance-id" })
  const before = structuredClone(app.storage.state.planner)
  expect((await write(app, "finance", "OPEX", "save", "HR:IT", 1, { versionId: "v", a0: 99 })).status).toBe(409)
  expect((await write(app, "finance", "OPEX", "save", "HR:IT", 2, { versionId: "v", annual: 99 })).status).toBe(403)
  expect((await write(app, "finance", "OPEX", "save", "HR:Ghost", 0, { versionId: "v", a0: 99 })).status).toBe(403)
  expect(app.storage.state.planner).toEqual(before)
})

test("official and locked version reject HR changes and phantom domains while finance can update an existing domain", async () => {
  const app = flow()
  expect((await write(app, "hr", "Headcount", "save", "p", 0, { versionId: "v", name: "Example", domain: "IT", rateOverride: 123456 })).status).toBe(200)
  const stale = await write(app, "owner", "Headcount", "save", "p", 0, { versionId: "v", name: "Changed" })
  expect(stale.status).toBe(409)
  expect(JSON.stringify(stale.body)).not.toContain("rateOverride")
  expect((await write(app, "admin", "Versions", "official", "v", 0, {})).status).toBe(200)
  const before = structuredClone(app.storage.state.planner)
  expect((await write(app, "hr", "Headcount", "save", "p", 1, { versionId: "v", name: "Changed" })).status).toBe(403)
  expect((await write(app, "admin", "OPEX", "save", "HR:Ghost", 0, { versionId: "v", a0: 20 })).status).toBe(403)
  expect((await write(app, "admin", "Versions", "unlock", "v", 1, {})).status).toBe(403)
  expect(app.storage.state.planner).toEqual(before)
  expect((await write(app, "finance", "OPEX", "save", "HR:IT", 0, { versionId: "v", a0: 20 })).status).toBe(200)
  const version = plan(await read(app, "finance", "OPEX"))
  expect(version.locked).toBe(true)
  expect(rows(version.hr).find((row) => row.id === "HR:IT")?.a).toEqual([20, ...Array(11).fill(null)])
  expect(app.storage.state.planner.audit).toContainEqual(expect.objectContaining({ record: "v:hrAF:HR:IT", who: "finance-id" }))
})
