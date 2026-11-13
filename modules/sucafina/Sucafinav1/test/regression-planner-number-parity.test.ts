import { expect, test } from "bun:test"
import { createApplication } from "../runtime/application.ts"
import { domain, pages, render } from "../runtime/planner.ts"
import type { Actor, Environment, Snapshot } from "../runtime/contract.ts"
import { exportPlanner, parseWorkbook } from "../runtime/workbooks.ts"
import { testPersistence } from "./fixture/persistence.ts"
import type { ResolvedActor } from "../src/identity.ts"

const versionId = "plan"
const at = "2026-11-12T12:00:00Z"
const actor: Actor = { id: "admin", canWrite: true, roles: ["admin"] }
const principal: ResolvedActor = {
  id: "admin",
  canWrite: true,
  roles: [{ surface: "planner", role: "admin" }],
}

function environment(): Environment {
  let generated = 0
  return { at, directory: [{ id: "admin", name: "Planner Admin" }], id: () => `generated-${++generated}` }
}

function planSnapshot(): Snapshot {
  return {
    data: {
      versions: [
        {
          id: versionId,
          name: "FY2026",
          year: 2026,
          locked: false,
          closed: 0,
          lines: [],
          projects: [],
          hc: { positions: [], rates: [], inc: 0, incMonth: 1, hrAF: {} },
          fx: [],
          lists: {},
        },
      ],
    },
    versions: {},
    sequences: {},
    audit: [],
    notices: [],
  }
}

function fixture() {
  const storage = testPersistence({ planner: planSnapshot() })
  const env = environment()
  const handler = createApplication("/sucafina", {
    authenticate: async () => principal,
    persistence: storage.persistence,
    environment: async () => env,
    domains: {
      dashboard: [],
      planner: [{ pages, domain, render }],
      procurement: [],
    },
    maxJsonBytes: 2_000_000,
  })
  const post = (body: Record<string, unknown>) =>
    handler(
      new Request("https://installation.example/sucafina/planner", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://installation.example",
        },
        body: JSON.stringify(body),
      }),
    )
  return { ...storage, env, post }
}

function seed(state: Snapshot, env: Environment, page: string, id: string, values: Record<string, unknown>) {
  const result = domain.execute(
    state,
    actor,
    { page, action: "save", id, version: 0, values: { versionId, ...values } },
    env,
  )
  expect(result.ok).toBe(true)
}

function asRows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((row): row is Record<string, unknown> => row !== null && typeof row === "object" && !Array.isArray(row))
    : []
}

function version(state: Snapshot) {
  const found = asRows(state.data.versions).find((row) => row.id === versionId)
  if (!found) throw new Error("Expected planner version")
  return found
}

function line(state: Snapshot, id: string) {
  const found = asRows(version(state).lines).find((row) => row.id === id)
  if (!found) throw new Error(`Expected planner line ${id}`)
  return found
}

function headcountRows(state: Snapshot, key: "positions" | "rates") {
  return asRows((version(state).hc as Record<string, unknown>)[key])
}

function rowsForLine(sheets: Record<string, Record<string, unknown>[]>, sheet: string, id: string) {
  const found = (sheets[sheet] ?? []).filter((row) => row["Line ID"] === id)
  if (found.length !== 3) throw new Error(`Expected budget, actual and forecast workbook rows for ${id}`)
  return found
}

async function exportedSheets(app: ReturnType<typeof fixture>) {
  const exported = await exportPlanner(app.state.planner, actor, app.env, versionId)
  expect(exported.ok).toBe(true)
  if (!exported.ok) throw new Error(exported.errors?.join("; ") || "Expected planner XLSX")
  const parsed = await parseWorkbook(exported.bytes)
  expect(parsed.ok).toBe(true)
  if (!parsed.ok) throw new Error(parsed.errors.join("; "))
  return parsed.sheets
}

async function apply(app: ReturnType<typeof fixture>, page: string, sheets: Record<string, Record<string, unknown>[]>, revisions = app.state.planner.versions) {
  const { Workbook } = await import("exceljs")
  const workbook = new Workbook()
  for (const [name, rows] of Object.entries(sheets)) {
    const sheet = workbook.addWorksheet(name)
    const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))]
    if (headers.length) sheet.addRow(headers)
    for (const row of rows) sheet.addRow(headers.map((header) => row[header] ?? null))
  }
  const parsed = await parseWorkbook(new Uint8Array(await workbook.xlsx.writeBuffer()))
  expect(parsed.ok).toBe(true)
  if (!parsed.ok) throw new Error(parsed.errors.join("; "))
  const response = await app.post({
    page,
    action: "import-workbook",
    id: versionId,
    version: app.state.planner.versions[`versions:${versionId}`]?.version ?? 0,
    values: { versionId, sheets: parsed.sheets, versions: structuredClone(revisions) },
  })
  if (!response) throw new Error("Expected planner application response")
  return response
}

test("INV-PL-WB-NUM accepts parseNum formats across planner workbook numeric fields", async () => {
  const app = fixture()
  seed(app.state.planner, app.env, "CAPEX", "capex-project", {
    collection: "projects",
    name: "Planner project",
  })
  for (const page of ["OPEX", "CAPEX"]) {
    seed(app.state.planner, app.env, page, `${page}-line`, {
      collection: "lines",
      name: `${page} line`,
      el: "services",
      ...(page === "CAPEX" ? { proj: "capex-project" } : {}),
      cur: "USD",
      b: Array.from({ length: 12 }, () => 10),
    })
  }
  seed(app.state.planner, app.env, "Headcount", "position", {
    collection: "positions",
    name: "Planner position",
    fte: 1,
    start: 1,
    end: 12,
  })
  seed(app.state.planner, app.env, "Headcount", "rate", {
    collection: "rates",
    name: "Planner rate",
    annual: 100,
    cur: "USD",
  })
  seed(app.state.planner, app.env, "Headcount", "precision-rate", {
    collection: "rates",
    name: "Fractional rate",
    annual: 100,
    cur: "USD",
  })
  seed(app.state.planner, app.env, "FX rates", "EUR", { collection: "fx", cur: "EUR", rate: 1 })

  const sheets = await exportedSheets(app)
  const opex = rowsForLine(sheets, "OPEX", "OPEX-line")
  const capex = rowsForLine(sheets, "CAPEX", "CAPEX-line")
  opex[0].Jan = "1,234"
  opex[0].Feb = "1 234"
  opex[0].Mar = "1'234"
  opex[1].Jan = 1.005
  opex[2].Jan = "(1,234)"
  capex[0].Jan = "1.25k"
  capex[0].Feb = "0.002m"
  const position = (sheets.Headcount ?? []).find((row) => row["Position ID"] === "position")
  if (!position) throw new Error("Expected headcount workbook row")
  position.FTE = "1,234"
  position["Rate override"] = "1,234"
  const rate = (sheets["Rate cards"] ?? []).find((row) => row["Rate ID"] === "rate")
  if (!rate) throw new Error("Expected rate card workbook row")
  rate["Annual cost per FTE"] = "1,234.50"
  const precisionRate = (sheets["Rate cards"] ?? []).find((row) => row["Rate ID"] === "precision-rate")
  if (!precisionRate) throw new Error("Expected fractional rate card workbook row")
  precisionRate["Annual cost per FTE"] = 1.005
  const response = await apply(app, "OPEX", sheets)
  expect(response.status).toBe(200)

  expect(line(app.state.planner, "OPEX-line").b).toEqual([1234, 1234, 1234, ...Array<number>(9).fill(10)])
  expect(line(app.state.planner, "OPEX-line").a).toEqual([1, ...Array<null>(11).fill(null)])
  expect(line(app.state.planner, "OPEX-line").f).toEqual([-1234, ...Array<null>(11).fill(null)])
  expect(line(app.state.planner, "OPEX-line").annual).toBe(3792)
  expect(line(app.state.planner, "CAPEX-line").b).toEqual([1250, 2000, ...Array<number>(10).fill(10)])
  expect(line(app.state.planner, "CAPEX-line").annual).toBe(3350)
  expect(headcountRows(app.state.planner, "positions").find((row) => row.id === "position")).toMatchObject({
    fte: 2,
    rateOverride: 1234,
  })
  expect(headcountRows(app.state.planner, "rates").find((row) => row.id === "rate")).toMatchObject({ annual: 1234.5 })
  expect(headcountRows(app.state.planner, "rates").find((row) => row.id === "precision-rate")).toMatchObject({ annual: 1 })
})

test("INV-PL-WB-NUM parses a diagnostic thousands separator in FTE before the domain clamp", async () => {
  const app = fixture()
  seed(app.state.planner, app.env, "Headcount", "position", {
    collection: "positions",
    name: "FTE diagnostic",
    fte: 1,
    start: 1,
    end: 12,
  })
  const sheets = await exportedSheets(app)
  const position = (sheets.Headcount ?? []).find((row) => row["Position ID"] === "position")
  if (!position) throw new Error("Expected headcount workbook row")
  position.FTE = "1,234"
  expect((await apply(app, "Headcount", sheets)).status).toBe(200)
  expect(headcountRows(app.state.planner, "positions").find((row) => row.id === "position")?.fte).toBe(2)
})

test("INV-PL-WB-NUM parses a diagnostic thousands separator in rate override independently", async () => {
  const app = fixture()
  seed(app.state.planner, app.env, "Headcount", "position", {
    collection: "positions",
    name: "Override diagnostic",
    fte: 1,
    start: 1,
    end: 12,
  })
  const sheets = await exportedSheets(app)
  const position = (sheets.Headcount ?? []).find((row) => row["Position ID"] === "position")
  if (!position) throw new Error("Expected headcount workbook row")
  position["Rate override"] = "1,234"
  expect((await apply(app, "Headcount", sheets)).status).toBe(200)
  expect(headcountRows(app.state.planner, "positions").find((row) => row.id === "position")?.rateOverride).toBe(1234)
})

test("INV-PL-WB-NUM keeps comma-decimal parsing scoped to FX and preserves blank FX as null", async () => {
  const app = fixture()
  seed(app.state.planner, app.env, "OPEX", "line", {
    collection: "lines",
    name: "FX boundary line",
    el: "services",
    cur: "USD",
    b: Array.from({ length: 12 }, () => 10),
  })
  seed(app.state.planner, app.env, "FX rates", "CHF", { collection: "fx", cur: "CHF", rate: 1 })
  const sheets = await exportedSheets(app)
  rowsForLine(sheets, "OPEX", "line")[0].Jan = "1,13"
  const fx = (sheets["FX rates"] ?? []).find((row) => row.Currency === "CHF")
  if (!fx) throw new Error("Expected CHF FX workbook row")
  fx["USD per 1 unit"] = null
  fx.Currency = "EUR"
  fx["USD per 1 unit"] = "1,13"
  sheets["FX rates"]?.push({ Currency: "CHF", "USD per 1 unit": null })
  const response = await apply(app, "OPEX", sheets)
  expect(response.status).toBe(200)
  expect(line(app.state.planner, "line").b).toEqual([113, ...Array<number>(11).fill(10)])
  expect(asRows(version(app.state.planner).fx)).toEqual([
    expect.objectContaining({ cur: "CHF", rate: null }),
    expect.objectContaining({ cur: "EUR", rate: 1.13 }),
  ])
})

test("INV-PL-WB-NUM rejects unparseable numeric tokens atomically after valid workbook rows", async () => {
  const app = fixture()
  seed(app.state.planner, app.env, "OPEX", "line", {
    collection: "lines",
    name: "Rollback line",
    el: "services",
    cur: "USD",
    b: Array.from({ length: 12 }, () => 10),
  })
  const sheets = await exportedSheets(app)
  const rows = rowsForLine(sheets, "OPEX", "line")
  rows[0].Jan = "2,000"
  rows[1].Jan = "not a number"
  const before = structuredClone(app.state.planner)
  const response = await apply(app, "OPEX", sheets)
  expect(response.status).toBe(422)
  expect(app.state.planner).toEqual(before)
})

test("INV-PL-WB-NUM rejects stale workbook revisions without overwriting newer values", async () => {
  const app = fixture()
  seed(app.state.planner, app.env, "OPEX", "line", {
    collection: "lines",
    name: "Stale line",
    el: "services",
    cur: "USD",
    b: Array.from({ length: 12 }, () => 10),
  })
  const sheets = await exportedSheets(app)
  rowsForLine(sheets, "OPEX", "line")[0].Jan = "1,234"
  const oldRevisions = structuredClone(app.state.planner.versions)
  expect((await apply(app, "OPEX", sheets)).status).toBe(200)
  const beforeStale = structuredClone(app.state.planner)
  rowsForLine(sheets, "OPEX", "line")[0].Jan = "9,999"
  const stale = await apply(app, "OPEX", sheets, oldRevisions)
  expect(stale.status).toBe(409)
  expect(app.state.planner).toEqual(beforeStale)
  expect(line(app.state.planner, "line").b).toEqual([1234, ...Array<number>(11).fill(10)])
})

test("INV-PL-WB-NUM preserves blank-cell semantics and rounds values to cents", async () => {
  const app = fixture()
  seed(app.state.planner, app.env, "OPEX", "line", {
    collection: "lines",
    name: "Blank line",
    el: "services",
    cur: "USD",
    b: Array.from({ length: 12 }, () => 10),
  })
  const sheets = await exportedSheets(app)
  const rows = rowsForLine(sheets, "OPEX", "line")
  rows[0].Jan = null
  rows[1].Jan = null
  rows[2].Jan = null
  rows[0].Feb = "0.005"
  rows[1].Feb = "1.005"
  rows[2].Feb = "2.345"
  const response = await apply(app, "OPEX", sheets)
  expect(response.status).toBe(200)
  expect(line(app.state.planner, "line").b).toEqual([0, 0.01, ...Array<number>(10).fill(10)])
  expect(line(app.state.planner, "line").a).toEqual([null, 1, ...Array<null>(10).fill(null)])
  expect(line(app.state.planner, "line").f).toEqual([null, 2.35, ...Array<null>(10).fill(null)])
  expect(line(app.state.planner, "line").annual).toBe(100.01)
})
