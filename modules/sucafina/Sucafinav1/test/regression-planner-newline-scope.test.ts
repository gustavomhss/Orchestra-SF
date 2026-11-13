import { expect, test } from "bun:test"
import { createApplication } from "../runtime/application.ts"
import type { Snapshot } from "../runtime/contract.ts"
import { domain, pages, render } from "../runtime/planner.ts"
import { parseWorkbook } from "../runtime/workbooks.ts"
import type { ResolvedActor } from "../src/identity.ts"
import { empty, testPersistence } from "./fixture/persistence.ts"

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const origin = "https://installation.example"

function fixture() {
  const initial: Snapshot = {
    ...empty(),
    data: {
      access: { "owner-1": { domains: ["Apps"] } },
      versions: [{
        id: "V1",
        name: "FY26",
        year: 2026,
        locked: false,
        closed: 0,
        lines: [],
        projects: [],
        hc: { positions: [], rates: [], inc: 0, incMonth: 1, hrAF: {} },
        fx: [],
        lists: {},
      }],
      entities: [{ id: "1", name: "Default entity", code: "DEFAULT" }],
      allocations: [{ id: "2", name: "Direct", desc: "" }],
    },
    versions: { "versions:V1": { version: 4, by: "prior" } },
    sequences: { cpx: 80 },
    audit: [{ who: "prior", at: "2026-11-12T12:00:00Z", record: "seed", was: null, became: "seed" }],
    notices: [{ kind: "pending", to: ["prior"], record: "seed", at: "2026-11-12T12:00:00Z" }],
  }
  const storage = testPersistence({ planner: initial })
  const identity: { principal: ResolvedActor | null } = {
    principal: {
      id: "owner-1",
      canWrite: true,
      roles: [{ surface: "planner", role: "budget owner" }],
    },
  }
  const handler = createApplication("/sucafina", {
    authenticate: async () => identity.principal,
    persistence: storage.persistence,
    environment: async () => ({
      at: "2026-11-12T12:00:00Z",
      id: () => "created-line",
      directory: [
        { id: "owner-1", name: "Budget Owner" },
        { id: "other-owner", name: "Other Owner" },
      ],
    }),
    domains: {
      dashboard: [],
      planner: [{ pages, domain, render }],
      procurement: [],
    },
    maxJsonBytes: 1_000_000,
  })
  return { ...storage, handler, identity }
}

async function workbook(rows: (string | number | null)[][]) {
  const { Workbook } = await import("exceljs")
  const book = new Workbook()
  book.addWorksheet("OPEX").addRows([
    ["Line ID", "Cost element", "Vendor / item", "Measure", "Owner", ...months],
    ...rows,
  ])
  const parsed = await parseWorkbook(new Uint8Array(await book.xlsx.writeBuffer()))
  expect(parsed.ok).toBe(true)
  if (!parsed.ok) throw new Error(parsed.errors.join("; "))
  return parsed.sheets
}

async function importSheets(app: ReturnType<typeof fixture>, sheets: Awaited<ReturnType<typeof workbook>>) {
  const response = await app.handler(new Request(`${origin}/sucafina/planner?page=OPEX`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({
      page: "OPEX",
      action: "import-workbook",
      version: app.state.planner.versions["versions:V1"]!.version,
      values: {
        versionId: "V1",
        versions: structuredClone(app.state.planner.versions),
        sheets,
      },
    }),
  }))
  if (!response) throw new Error("Planner application did not handle its import request")
  return response
}

test("new blank-ID line never leaves the importing owner's scope when a later Actual row posts another owner", async () => {
  const app = fixture()
  const before = structuredClone(app.state.planner)
  const sheets = await workbook([
    ["", "Licenses", "Shared cost", "Budget", "Budget Owner", 500, ...Array(11).fill(null)],
    ["", "Licenses", "Shared cost", "Actual", "Other Owner", 25, ...Array(11).fill(null)],
  ])

  const response = await importSheets(app, sheets)

  if (!response.ok) {
    expect(response.status).toBeGreaterThanOrEqual(400)
    expect(app.state.planner).toEqual(before)
    return
  }

  const state = app.state.planner
  const plan = (state.data.versions as { lines: Record<string, unknown>[]; projects: unknown[]; hc: unknown; fx: unknown[] }[])[0]!
  expect(plan.lines).toHaveLength(1)
  expect(plan.lines[0]).toMatchObject({
    id: "created-line",
    sec: "opex",
    name: "Shared cost",
    owner: { id: "owner-1", name: "Budget Owner" },
    b: [500, ...Array(11).fill(0)],
    a: Array(12).fill(null),
    annual: 500,
  })
  expect((plan.lines[0]!.domain as string | undefined) ?? "").toBe("")
  expect(plan.lines.every((line) => (line.owner as { id?: string } | undefined)?.id === "owner-1")).toBe(true)
  expect(plan.projects).toEqual((before.data.versions as { projects: unknown[] }[])[0]!.projects)
  expect(plan.hc).toEqual((before.data.versions as { hc: unknown }[])[0]!.hc)
  expect(plan.fx).toEqual((before.data.versions as { fx: unknown[] }[])[0]!.fx)
  expect(state.data.entities).toEqual(before.data.entities)
  expect(state.data.allocations).toEqual(before.data.allocations)
  expect(state.sequences).toEqual(before.sequences)
  expect(state.notices).toEqual(before.notices)
  expect(state.audit.slice(before.audit.length).every((entry) => entry.who === "owner-1")).toBe(true)
})

test("new blank-ID line accepts same-owner Budget and Forecast rows from a real workbook", async () => {
  const app = fixture()
  const sheets = await workbook([
    ["", "Licenses", "Shared cost", "Budget", "Budget Owner", 500, ...Array(11).fill(null)],
    ["", "Licenses", "Shared cost", "Forecast", "Budget Owner", 30, ...Array(11).fill(null)],
  ])

  const response = await importSheets(app, sheets)

  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ ok: true })
  const lines = (app.state.planner.data.versions as { lines: Record<string, unknown>[] }[])[0]!.lines
  expect(lines).toHaveLength(1)
  expect(lines[0]).toMatchObject({
    id: "created-line",
    sec: "opex",
    name: "Shared cost",
    owner: { id: "owner-1", name: "Budget Owner" },
    b: [500, ...Array(11).fill(0)],
    f: [30, ...Array(11).fill(null)],
    annual: 500,
  })
})


;(["Actual", "Forecast"] as const).forEach((measure) => {
  test(`a standalone ${measure} blank-ID workbook cannot create a budget owner's line`, async () => {
    const app = fixture()
    const before = structuredClone(app.state.planner)
    const sheets = await workbook([
      ["", "Licenses", `${measure}-only`, measure, "Budget Owner", 25, ...Array(11).fill(null)],
    ])
    const response = await importSheets(app, sheets)
    expect(response.status).toBeLessThan(500)
    expect(app.state.planner).toEqual(before)
  })
})

;(["Actual", "Forecast"] as const).forEach((measure) => {
  test(`foreign owner forgery on ${measure} rolls back an earlier authorized Forecast`, async () => {
    const app = fixture()
    const version = (app.state.planner.data.versions as { lines: Record<string, unknown>[] }[])[0]!
    version.lines = ["owned", "foreign"].map((id) => ({
      id, sec: "opex", el: "licenses", name: id, cur: "USD", annual: 1200,
      b: Array(12).fill(100), bm: Array(12).fill(false),
      a: Array(12).fill(null), f: Array(12).fill(null),
      domain: id === "owned" ? "" : "Other",
      owner: id === "owned" ? { id: "owner-1", name: "Budget Owner" } : { id: "other-owner", name: "Other Owner" },
    }))
    app.state.planner.versions["V1:lines:owned"] = { version: 1, by: "prior" }
    app.state.planner.versions["V1:lines:foreign"] = { version: 3, by: "prior" }
    const before = structuredClone(app.state.planner)
    const sheets = await workbook([
      ["owned", "Licenses", "owned", "Forecast", "Budget Owner", 77, ...Array(11).fill(null)],
      ["foreign", "Licenses", "foreign", measure, "Budget Owner", measure === "Actual" ? 25 : null, ...Array(11).fill(null)],
    ])
    const response = await importSheets(app, sheets)
    expect(response.status).toBe(403)
    expect(app.state.planner).toEqual(before)
  })
})


test("finance plus budget-owner membership retains Actual authority with an unchanged out-of-domain owner", async () => {
  const app = fixture()
  app.identity.principal = {
    ...app.identity.principal!,
    roles: [{ surface: "planner", role: "budget owner" }, { surface: "planner", role: "finance" }],
  }
  const plan = (app.state.planner.data.versions as { lines: Record<string, unknown>[] }[])[0]!
  plan.lines = [{
    id: "finance-line", sec: "opex", el: "licenses", name: "Finance entry", cur: "USD", annual: 1200,
    b: Array(12).fill(100), bm: Array(12).fill(false), a: Array(12).fill(null), f: Array(12).fill(null),
    domain: "Other", owner: { id: "owner-1", name: "Budget Owner" },
  }]
  app.state.planner.versions["V1:lines:finance-line"] = { version: 2, by: "prior" }
  const sheets = await workbook([
    ["finance-line", "Licenses", "Finance entry", "Actual", "Budget Owner", 75, ...Array(11).fill(null)],
  ])
  const response = await importSheets(app, sheets)
  expect(response.status).toBe(200)
  const updated = (app.state.planner.data.versions as { lines: Record<string, unknown>[] }[])[0]!.lines[0]!
  expect(updated).toMatchObject({
    id: "finance-line", name: "Finance entry", domain: "Other",
    owner: { id: "owner-1", name: "Budget Owner" },
    annual: 1200, b: Array(12).fill(100), a: [75, ...Array(11).fill(null)],
  })
})
