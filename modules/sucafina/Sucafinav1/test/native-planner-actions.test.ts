import { expect, test } from "bun:test"
import { object, rows } from "../runtime/contract.ts"
import type { NativeAction, NativeField, NativeScalar, Snapshot } from "../runtime/contract.ts"
import { empty } from "./fixture/persistence.ts"
import { nativeWriteFlow } from "./fixture/native-write.ts"

function fixture(options: { locked?: boolean; official?: boolean } = {}) {
  const initial = empty()
  initial.data = {
    versions: [{
      id: "plan", name: "Descriptor plan", year: 2027, locked: options.locked ?? false, closed: 0,
      lines: [{
        id: "line", sec: "opex", el: "licenses", name: "Existing line", desc: "Original description", cur: "USD",
        owner: { id: "owner", name: "Fixture Owner" }, domain: "Apps", annual: 1200,
        b: [1200, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], bm: Array(12).fill(true),
        a: [0.001, 2, null, null, null, null, null, null, null, null, null, null],
        f: [0.001, null, 3, null, null, null, null, null, null, null, null, null],
      }],
      projects: [], lists: {}, fx: [{ id: "eur", cur: "EUR", rate: 1.123456 }],
      hc: {
        positions: [{ id: "position", name: "Existing hire", title: "Analyst", type: "Employee", location: "Brazil", domain: "Apps", include: true, fte: 0.3333, start: 1, end: 12, rateId: "rate", rateOverride: 0.001, src: "new" }],
        rates: [{ id: "rate", name: "Existing rate", locs: "Brazil", cur: "EUR", annual: 1234.5678 }],
        inc: 0.001, incMonth: 1, hrAF: {}, leaderDomains: {},
      },
    }],
    officials: options.official ? { "2027": "plan" } : {}, entities: [], allocations: [],
    roster: [{ id: "private-person", name: "PRIVATE-ROSTER-NAME", leader: "PRIVATE-ROSTER-LEADER", salary: 987654.321 }],
  }
  initial.versions = {
    "plan:lines:line": { version: 4, by: "previous" },
    "plan:positions:position": { version: 3, by: "previous" },
    "plan:rates:rate": { version: 2, by: "previous" },
    "plan:fx:eur": { version: 5, by: "previous" },
  }
  return nativeWriteFlow({
    initial: { planner: initial },
    people: [
      { token: "admin", id: "admin", name: "Fixture Admin", roles: [{ surface: "planner", role: "admin" }] },
      { token: "finance", id: "finance", name: "Fixture Finance", roles: [{ surface: "planner", role: "finance" }] },
      { token: "hr", id: "hr", name: "Fixture HR", roles: [{ surface: "planner", role: "hr" }] },
      { token: "owner", id: "owner", name: "Fixture Owner", roles: [{ surface: "planner", role: "budget owner" }], access: { planner: { domains: ["Apps"] } } },
      { token: "viewer", id: "viewer", name: "Fixture Viewer", roles: [{ surface: "planner", role: "viewer" }] },
      { token: "readonly", id: "readonly", name: "Fixture Readonly", roles: [{ surface: "planner", role: "admin" }], canWrite: false },
    ],
  })
}

async function read(app: ReturnType<typeof fixture>, page = "OPEX", token = "admin") {
  const response = await app.read("planner", page, token, { version: "plan", year: "2027" })
  expect(response?.status).toBe(200)
  const body = await response!.json() as { actions: NativeAction[] }
  expect(Array.isArray(body.actions)).toBe(true)
  return body.actions
}

function action(actions: NativeAction[], label: string, id?: string) {
  const found = actions.filter((item) => item.label.en.startsWith(label) && item.command.id === id)
  expect(found).toHaveLength(1)
  return found[0]!
}

function fields(input: readonly NativeField[]): NativeScalar[] {
  return input.flatMap((field) => field.kind === "group" || field.kind === "list" ? fields(field.fields) : [field])
}

function plan(state: Snapshot) {
  const found = rows(state.data.versions).find((row) => row.id === "plan")
  expect(found).toBeDefined()
  return found!
}

function line(app: ReturnType<typeof fixture>) {
  const found = rows(plan(app.storage.state.planner).lines).find((row) => row.id === "line")
  expect(found).toBeDefined()
  return found!
}

async function submit(app: ReturnType<typeof fixture>, descriptor: NativeAction, values: Record<string, unknown>, token = "admin", status = 200) {
  const response = await app.command("planner", { ...descriptor.command, values: { ...descriptor.command.values, ...values } }, token)
  expect(response?.status).toBe(status)
  expect(object(await response!.json()).ok).toBe(status === 200)
}

test("native metadata save preserves manual annual/b/bm; annual adjustment is a separate explicit command", async () => {
  const app = fixture()
  const original = structuredClone(line(app))
  const metadata = action(await read(app), "Save line:", "line")
  expect(metadata.command.version).toBe(4)
  expect(metadata.target).toEqual({ collection: "lines", id: "line" })
  expect(Object.keys(metadata.command.values).sort()).toEqual(["alloc", "collection", "cur", "desc", "el", "entity", "name", "owner", "versionId"])
  expect(fields(metadata.fields).map((field) => field.path[0])).not.toContain("annual")
  expect(fields(metadata.fields).some((field) => /^(?:b\d*|bm|month|value|budgetEdited)$/.test(String(field.path[0])))).toBe(false)
  await submit(app, metadata, { desc: "Edited description" })
  expect(line(app).desc).toBe("Edited description")
  expect(JSON.stringify([line(app).annual, line(app).b, line(app).bm])).toBe(JSON.stringify([original.annual, original.b, original.bm]))
  const annual = action(await read(app), "Adjust annual budget:", "line")
  expect(annual.command.version).toBe(5)
  expect(annual.command.values).toEqual({ versionId: "plan", collection: "lines", annual: 1200 })
  expect(fields(annual.fields).filter((field) => !field.readOnly).map((field) => field.path)).toEqual([["annual"]])
  await submit(app, annual, { annual: 2400 })
  expect(line(app)).toMatchObject({ annual: 2400, b: Array(12).fill(200), bm: Array(12).fill(false) })
})

test("native budget months carry fixed zero-based identity and a January edit preserves the other flags", async () => {
  const app = fixture()
  line(app).bm = [false, true, false, true, false, true, false, true, false, true, false, true]
  const original = structuredClone(line(app))
  const actions = (await read(app)).filter((item) => item.command.id === "line" && Object.hasOwn(item.command.values, "month"))
  expect(actions).toHaveLength(12)
  expect(new Set(actions.map((item) => item.key)).size).toBe(12)
  expect(actions.map((item) => item.command.values.month)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  for (const descriptor of actions) {
    expect(Object.keys(descriptor.command.values).sort()).toEqual(["collection", "month", "value", "versionId"])
    expect(descriptor.command).toMatchObject({ page: "OPEX", action: "save", id: "line", version: 4 })
    expect(fields(descriptor.fields).map((field) => field.path)).toEqual([["versionId"], ["collection"], ["value"]])
    expect(fields(descriptor.fields).filter((field) => !field.readOnly).map((field) => field.path)).toEqual([["value"]])
  }
  const january = actions[0]!
  expect(january.key).toBe('["planner","OPEX","save","lines","line","month-0"]')
  expect(january.label).toEqual({ en: "Save January budget: Existing line (line)", br: "Salvar orçamento de Janeiro: Existing line (line)" })
  expect(fields(january.fields).find((field) => field.path[0] === "value")?.label).toEqual({ en: "January budget", br: "Orçamento de Janeiro" })
  await submit(app, january, { value: 1250 })
  expect(line(app).b).toEqual([1250, ...(original.b as number[]).slice(1)])
  expect(line(app).bm).toEqual([true, ...(original.bm as boolean[]).slice(1)])
  expect([line(app).a, line(app).f]).toEqual([original.a, original.f])
})

test("native actual/forecast accept sub-cent defaults and preserve untouched values with stale CAS protection", async () => {
  const app = fixture()
  const original = structuredClone(line(app))
  const descriptors = await read(app, "OPEX", "finance")
  const actual = action(descriptors, "Save actual:", "line")
  const forecast = action(descriptors, "Save forecast:", "line")
  for (const [descriptor, prefix] of [[actual, "a"], [forecast, "f"]] as const) {
    expect(descriptor.command.version).toBe(4)
    expect(descriptor.command.values[`${prefix}0`]).toBe(0.001)
    expect(Object.keys(descriptor.command.values).sort()).toEqual(["collection", "versionId", ...Array.from({ length: 12 }, (_, index) => `${prefix}${index}`)].sort())
    expect(fields(descriptor.fields).filter((field) => !field.readOnly)).toHaveLength(12)
    for (const field of fields(descriptor.fields).filter((field) => !field.readOnly)) {
      expect(field.kind).toBe("number")
      expect(field.blank).toBe("null")
      expect(field.step).toBeUndefined()
    }
  }
  await submit(app, actual, { a0: 0.0012 }, "finance")
  expect(line(app).a).toEqual([0.0012, ...(original.a as (number | null)[]).slice(1)])
  expect([line(app).annual, line(app).b, line(app).bm, line(app).f]).toEqual([original.annual, original.b, original.bm, original.f])
  const before = structuredClone(app.storage.state.planner)
  await submit(app, actual, { a0: 99 }, "finance", 409)
  expect(app.storage.state.planner).toEqual(before)
  await submit(app, action(await read(app, "OPEX", "finance"), "Save forecast:", "line"), { f0: 0.0012 }, "finance")
  expect(line(app).f).toEqual([0.0012, ...(original.f as (number | null)[]).slice(1)])
  expect([line(app).annual, line(app).b, line(app).bm]).toEqual([original.annual, original.b, original.bm])
})

test("native descriptor permissions honor read-only, lock and official rules without private roster defaults", async () => {
  const app = fixture()
  for (const token of ["viewer", "readonly"]) {
    for (const page of ["OPEX", "Headcount", "FX rates", "Versions"]) expect(await read(app, page, token)).toEqual([])
  }
  const owner = await read(app, "Headcount", "owner")
  expect(owner).toEqual([])
  expect(await read(app, "FX rates", "hr")).toEqual([])
  for (const page of ["OPEX", "Headcount", "FX rates"]) {
    expect(JSON.stringify(await read(app, page, "owner"))).not.toMatch(/PRIVATE-ROSTER|987654\.321|rateOverride/)
  }
  for (const official of [false, true]) {
    const protectedPlan = fixture({ locked: true, official })
    expect(await read(protectedPlan, "Headcount", "hr")).toEqual([])
    expect(await read(protectedPlan, "FX rates", "finance")).toEqual([])
    const actions = await read(protectedPlan)
    expect(actions.some((item) => item.label.en.startsWith("Adjust annual budget:") || Object.hasOwn(item.command.values, "month"))).toBe(false)
    expect(action(actions, "Save actual:", "line").command.version).toBe(4)
    expect(action(actions, "Save forecast:", "line").command.version).toBe(4)
    const versions = await read(protectedPlan, "Versions")
    expect(versions.some((item) => item.command.action === "unlock")).toBe(!official)
    expect(versions.some((item) => item.command.action === "delete")).toBe(!official)
  }
})

test("native Headcount and FX descriptors retain CAS/options/precision and reads allocate no record IDs", async () => {
  const app = fixture()
  const before = structuredClone(app.storage.state)
  const headcount = await read(app, "Headcount", "hr")
  const fx = await read(app, "FX rates", "finance")
  expect(app.storage.state).toEqual(before)
  const position = action(headcount, "Save position:", "position")
  expect(position.command).toMatchObject({ version: 3, values: { versionId: "plan", collection: "positions", fte: 0.3333, rateOverride: 0.001, rateId: "rate" } })
  expect(fields(position.fields).find((field) => field.path[0] === "rateId")?.options).toContainEqual({ value: "rate", label: { en: "Existing rate", br: "Existing rate" } })
  expect(fields(position.fields).find((field) => field.path[0] === "type")?.options?.map((option) => option.value)).toEqual(["Employee", "Contractor"])
  const rate = action(headcount, "Save rate card:", "rate")
  expect(rate.command).toMatchObject({ version: 2, values: { annual: 1234.5678, cur: "EUR" } })
  expect(fields(rate.fields).find((field) => field.path[0] === "cur")?.options?.map((option) => option.value)).toEqual(["USD", "EUR"])
  const currency = action(fx, "Save currency:", "eur")
  expect(currency.command).toMatchObject({ version: 5, values: { versionId: "plan", collection: "fx", cur: "EUR", rate: 1.123456 } })
  for (const [descriptor, names] of [[position, ["fte", "rateOverride"]], [rate, ["annual"]], [currency, ["rate"]]] as const) {
    for (const name of names) {
      const field = fields(descriptor.fields).find((field) => field.path[0] === name)
      expect(field?.kind).toBe("number")
      expect(field?.step).toBeUndefined()
    }
  }
  const create = action(headcount, "Add new hire:")
  expect(Object.hasOwn(create.command, "id")).toBe(false)
  expect(create.command).toMatchObject({ version: 0, values: { versionId: "plan", collection: "positions", name: "", domain: "", fte: 1, start: 1, end: 12 } })
  expect(fields(create.fields).find((field) => field.path[0] === "fte")?.step).toBeUndefined()
  const addRate = action(headcount, "Add rate card:")
  const addFx = action(fx, "Add currency:")
  for (const descriptor of [addRate, addFx]) {
    expect(Object.hasOwn(descriptor.command, "id")).toBe(false)
    expect(descriptor.command.version).toBe(0)
  }
  expect(addRate.command.values).toEqual({ versionId: "plan", collection: "rates", name: "", locs: "", cur: "USD", annual: 0 })
  expect(addFx.command.values).toEqual({ versionId: "plan", collection: "fx", cur: "", rate: null })
  await submit(app, rate, { annual: 1234.5679 }, "hr")
  expect(rows(object(plan(app.storage.state.planner).hc).rates).find((row) => row.id === "rate")?.annual).toBe(1234.5679)
  await submit(app, position, { fte: 0.3334, rateOverride: 0.0012 }, "hr")
  expect(rows(object(plan(app.storage.state.planner).hc).positions).find((row) => row.id === "position")).toMatchObject({ fte: 0.3334, rateOverride: 0.0012 })
  await submit(app, currency, { rate: 1.123457 }, "finance")
  expect(rows(plan(app.storage.state.planner).fx).find((row) => row.id === "eur")?.rate).toBe(1.123457)
  await submit(app, create, { name: "Created after reads" }, "hr")
  expect(rows(object(plan(app.storage.state.planner).hc).positions)).toContainEqual(expect.objectContaining({ id: "fixture-generated-1", name: "Created after reads", fte: 1, start: 1, end: 12, include: true, type: "Employee", src: "new" }))
})
