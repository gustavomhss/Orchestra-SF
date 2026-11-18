import { expect, test } from "bun:test"
import { object, rows } from "../runtime/contract.ts"
import type { Command } from "../runtime/contract.ts"
import { empty } from "./fixture/persistence.ts"
import { nativeWriteFlow } from "./fixture/native-write.ts"

function fixture() {
  const initial = empty()
  initial.data = {
    versions: [{
      id: "plan", name: "Fixture plan", year: 2027, locked: false, closed: 0,
      lines: [{ id: "scoped", sec: "opex", el: "licenses", name: "Scoped", cur: "USD", domain: "Finance", owner: { id: "owner", name: "Fixture Owner" }, annual: 120, b: Array(12).fill(10), bm: Array(12).fill(false), a: Array(12).fill(null), f: Array(12).fill(null) }],
      projects: [], hc: { positions: [], rates: [], inc: 0, incMonth: 1, hrAF: {} },
      fx: [{ id: "usd", cur: "USD", rate: 1 }], lists: {},
    }],
    officials: {}, entities: [], allocations: [], roster: [],
  }
  return nativeWriteFlow({
    initial: { planner: initial },
    people: [
      { token: "admin", id: "admin", name: "Fixture Admin", roles: [{ surface: "planner", role: "admin" }] },
      { token: "finance", id: "finance", name: "Fixture Finance", roles: [{ surface: "planner", role: "finance" }] },
      { token: "owner", id: "owner", name: "Fixture Owner", roles: [{ surface: "planner", role: "budget owner" }], access: { planner: { domains: ["Apps"] } } },
    ],
  })
}

async function write(app: ReturnType<typeof fixture>, command: Command, status = 200, token = "admin") {
  const response = await app.command("planner", command, token)
  expect(response?.status).toBe(status)
  const body = object(await response!.json())
  expect(body.ok).toBe(status === 200)
  return body
}

async function view(app: ReturnType<typeof fixture>, page = "OPEX") {
  const response = await app.read("planner", page, "admin")
  expect(response?.status).toBe(200)
  return object(await response!.json())
}

function plan(data: Record<string, unknown>, id = "plan") {
  return rows(object(data.data).versions).find((row) => row.id === id)!
}

test("native OPEX sparse monthly writes distinguish omitted, zero and null and reject stale revisions", async () => {
  const app = fixture()
  await write(app, { page: "OPEX", action: "save", id: "line", version: 0, values: { versionId: "plan", name: "Fixture line", el: "licenses", cur: "USD", annual: 120, a0: 25, a1: 42, f0: 45, f1: 30 } })
  await write(app, { page: "OPEX", action: "save", id: "line", version: 1, values: { versionId: "plan", b0: 0, a0: 0, f1: null } })
  const state = await view(app)
  const line = rows(plan(state).lines).find((row) => row.id === "line")!
  expect(line.name).toBe("Fixture line")
  expect((line.b as number[])[0]).toBe(0)
  expect((line.b as number[])[1]).toBe(10)
  expect((line.bm as boolean[])[0]).toBe(true)
  expect((line.a as (number | null)[]).slice(0, 2)).toEqual([0, 42])
  expect((line.f as (number | null)[]).slice(0, 2)).toEqual([45, null])
  expect(object(object(state.versions)["plan:lines:line"])).toMatchObject({ version: 2, by: "admin" })
  const before = structuredClone(app.storage.state.planner)
  await write(app, { page: "OPEX", action: "save", id: "line", version: 1, values: { versionId: "plan", a0: 999 } }, 409)
  expect(app.storage.state.planner).toEqual(before)
  expect(before.audit.filter((row) => row.record === "plan:lines:line")).toHaveLength(2)
})

test("native CAPEX project and line updates preserve omitted fields and zero/null months", async () => {
  const app = fixture()
  await write(app, { page: "CAPEX", action: "save", id: "project", version: 0, values: { versionId: "plan", collection: "projects", name: "Fixture project", code: "CPX-2027-080" } })
  await write(app, { page: "CAPEX", action: "save", id: "capex", version: 0, values: { versionId: "plan", proj: "project", name: "Fixture asset", el: "licenses", cls: "capex", cur: "USD", annual: 120, a1: 12, f0: 5 } })
  await write(app, { page: "CAPEX", action: "save", id: "capex", version: 1, values: { versionId: "plan", b0: 0, a1: null, f0: 0 } })
  const state = await view(app, "CAPEX")
  const version = plan(state)
  expect(rows(version.projects)[0]).toMatchObject({ id: "project", code: "CPX-2027-080" })
  const line = rows(version.lines).find((row) => row.id === "capex")!
  expect(line).toMatchObject({ proj: "project", name: "Fixture asset", cls: "capex", cur: "USD" })
  expect((line.b as number[]).slice(0, 2)).toEqual([0, 10])
  expect((line.a as (number | null)[])[1]).toBeNull()
  expect((line.f as (number | null)[]).slice(0, 2)).toEqual([0, null])
  expect(object(object(state.versions)["plan:lines:capex"])).toMatchObject({ version: 2, by: "admin" })
  expect(app.storage.state.planner.audit.filter((row) => row.record === "plan:lines:capex")).toHaveLength(2)
})

test("native reference deletion is denied while an OPEX line uses it", async () => {
  const app = fixture()
  await write(app, { page: "Entities & allocations", action: "save", id: "entity", version: 0, values: { collection: "entities", name: "Fixture entity", code: "FE" } })
  await write(app, { page: "OPEX", action: "save", id: "line", version: 0, values: { versionId: "plan", el: "licenses", entity: "entity", annual: 120, cur: "USD" } })
  const before = structuredClone(app.storage.state.planner)
  await write(app, { page: "Entities & allocations", action: "delete", id: "entity", version: 1, values: { collection: "entities" } }, 422)
  expect(app.storage.state.planner).toEqual(before)
  const state = await view(app, "Entities & allocations")
  expect(rows(object(state.data).entities)).toContainEqual({ id: "entity", name: "Fixture entity", code: "FE" })
  expect(rows(plan(state).lines).find((row) => row.id === "line")).toMatchObject({ entity: "entity" })
})

test("native version copy and official lock protect budget while finance can post actual and forecast", async () => {
  const app = fixture()
  await write(app, { page: "Versions", action: "copy", id: "plan", version: 0, values: { name: "Fixture copy" } })
  let state = await view(app, "Versions")
  const copy = rows(object(state.data).versions).find((row) => row.name === "Fixture copy")!
  expect(copy.id).toBe("fixture-generated-1")
  expect(copy.locked).toBe(false)
  expect(rows(copy.lines).find((row) => row.id === "scoped")).toMatchObject({ annual: 120, cur: "USD" })
  await write(app, { page: "Versions", action: "lock", id: "fixture-generated-1", version: 1, values: {} })
  expect(plan(await view(app, "Versions"), "fixture-generated-1").locked).toBe(true)
  const lockedBefore = structuredClone(app.storage.state.planner)
  await write(app, { page: "OPEX", action: "save", id: "scoped", version: 0, values: { versionId: "fixture-generated-1", annual: 1 } }, 403)
  expect(app.storage.state.planner).toEqual(lockedBefore)
  await write(app, { page: "Versions", action: "official", id: "plan", version: 0, values: {} })
  const before = structuredClone(app.storage.state.planner)
  await write(app, { page: "OPEX", action: "save", id: "scoped", version: 0, values: { versionId: "plan", annual: 1 } }, 403)
  await write(app, { page: "Versions", action: "unlock", id: "plan", version: 1, values: {} }, 403)
  expect(app.storage.state.planner).toEqual(before)
  await write(app, { page: "OPEX", action: "save", id: "scoped", version: 0, values: { versionId: "plan", a0: 20, f1: 0 } }, 200, "finance")
  state = await view(app)
  expect(object(object(state.data).officials)["2027"]).toBe("plan")
  expect(plan(state).locked).toBe(true)
  const line = rows(plan(state).lines).find((row) => row.id === "scoped")!
  expect(line.annual).toBe(120)
  expect((line.a as (number | null)[])[0]).toBe(20)
  expect((line.f as (number | null)[])[1]).toBe(0)
  expect(object(object(state.versions)["plan:lines:scoped"])).toMatchObject({ version: 1, by: "finance" })
})

test("native budget owner cannot write a line in another domain even when named as owner", async () => {
  const app = fixture()
  const before = structuredClone(app.storage.state.planner)
  await write(app, { page: "OPEX", action: "save", id: "scoped", version: 0, values: { versionId: "plan", f0: 5 } }, 403, "owner")
  await write(app, { page: "OPEX", action: "save", id: "scoped", version: 0, values: { versionId: "plan", annual: 999 } }, 403, "owner")
  expect(app.storage.state.planner).toEqual(before)
  const state = await view(app)
  expect(rows(plan(state).lines).find((row) => row.id === "scoped")).toMatchObject({ annual: 120, domain: "Finance" })
})
