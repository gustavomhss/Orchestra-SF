import { expect, test } from "bun:test"
import type { Actor, Environment, Result, Snapshot } from "../runtime/contract.ts"
import { domain, render } from "../runtime/planner.ts"
import { exportPlanner, parseWorkbook } from "../runtime/workbooks.ts"

const planId = "plan"
const at = "2026-11-12T12:00:00Z"
const actor: Actor = { id: "admin", canWrite: true, roles: ["admin"] }
const months = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100]
const fyCost = "FY cost USD (calculated)"

function environment(): Environment {
  let generated = 0
  return { at, directory: [], id: () => `generated-${++generated}` }
}

function planSnapshot(): Snapshot {
  return {
    data: {
      versions: [
        {
          id: planId,
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

function execute(
  state: Snapshot,
  env: Environment,
  page: string,
  action: string,
  id: string,
  values: Record<string, unknown>,
): Result {
  return domain.execute(
    state,
    actor,
    { page, action, id, version: 0, values: { versionId: planId, ...values } },
    env,
  )
}

function applyWorkbook(
  state: Snapshot,
  env: Environment,
  page: string,
  sheets: Record<string, Record<string, unknown>[]>,
): Result {
  return domain.execute(
    state,
    actor,
    {
      page,
      action: "import-workbook",
      version: state.versions[`versions:${planId}`]?.version ?? 0,
      values: { versionId: planId, sheets, versions: structuredClone(state.versions) },
    },
    env,
  )
}

function assertOk(result: Result): asserts result is { ok: true; value?: unknown; warnings?: string[] } {
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.errors?.join("; ") || "Expected success")
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>
  throw new Error(`Expected ${label}`)
}

function asRows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((row): row is Record<string, unknown> => row !== null && typeof row === "object" && !Array.isArray(row))
    : []
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function storedVersion(state: Snapshot): Record<string, unknown> {
  const version = asRows(state.data.versions)[0]
  if (!version) throw new Error("Expected a plan version")
  return version
}

function storedLine(state: Snapshot, id: string): Record<string, unknown> {
  const line = asRows(storedVersion(state).lines).find((row) => row.id === id)
  if (!line) throw new Error(`Expected line ${id}`)
  return line
}

function storedPosition(state: Snapshot, id: string): Record<string, unknown> {
  const position = asRows(asRecord(storedVersion(state).hc, "headcount").positions).find((row) => row.id === id)
  if (!position) throw new Error(`Expected position ${id}`)
  return position
}

function viewedVersion(state: Snapshot, env: Environment): Record<string, unknown> {
  const version = asRows(domain.view(state, actor, env).data.versions)[0]
  if (!version) throw new Error("Expected a viewed plan")
  return version
}

function summaryLine(state: Snapshot, env: Environment, id: string): Record<string, unknown> {
  const line = asRows(asRecord(viewedVersion(state, env).summary, "summary").lines).find((row) => row.id === id)
  if (!line) throw new Error(`Expected summary line ${id}`)
  return line
}

function screenMonths(state: Snapshot, env: Environment, id: string): number {
  const position = asRows(asRecord(viewedVersion(state, env).hc, "headcount").positions).find((row) => row.id === id)
  if (!position || !Array.isArray(position.months)) throw new Error(`Expected screen months for ${id}`)
  return position.months.reduce<number>((sum, value) => sum + (typeof value === "number" ? value : 0), 0)
}

function numbers(value: unknown, label: string): number[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "number")) throw new Error(`Expected ${label}`)
  return value
}

async function workbookSheets(
  state: Snapshot,
  env: Environment,
): Promise<Record<string, Record<string, unknown>[]>> {
  const exported = await exportPlanner(state, actor, env, planId)
  expect(exported.ok).toBe(true)
  if (!exported.ok) throw new Error(exported.errors?.join("; ") || "Expected planner workbook")
  const parsed = await parseWorkbook(exported.bytes)
  expect(parsed.ok).toBe(true)
  if (!parsed.ok) throw new Error(parsed.errors.join("; "))
  return parsed.sheets
}

function opexLine(sheets: Record<string, Record<string, unknown>[]>, id: string): Record<string, unknown>[] {
  const rows = (sheets.OPEX ?? []).filter((row) => row["Line ID"] === id)
  if (rows.length < 3) throw new Error(`Expected Budget, Actual and Forecast rows for ${id}`)
  return rows
}

function headcountRow(sheets: Record<string, Record<string, unknown>[]>, id: string): Record<string, unknown> {
  const row = (sheets.Headcount ?? []).find((item) => item["Position ID"] === id)
  if (!row) throw new Error(`Expected headcount row ${id}`)
  return row
}

function visibleFyCost(html: string, name: string): string {
  const row = html.split("</tr>").find((part) => part.includes(`>${name}<`))
  if (!row) throw new Error(`Headcount row not found for ${name}`)
  const cost = row.match(/\$[\d,]+\.\d{2}/)
  if (!cost) throw new Error(`FY cost not found for ${name}`)
  return cost[0]
}

function screenHtml(state: Snapshot, env: Environment, page: string): string {
  const html = render(page, domain.view(state, actor, env).data, {
    actor,
    year: 2026,
    month: 11,
    at: env.at,
    versions: state.versions,
  })
  if (!html) throw new Error(`Expected ${page} screen`)
  return html
}

test("PL-EXCEL-LISTS export writes current entity and allocation labels and no-edit apply keeps their ids", async () => {
  const env = environment()
  const state = planSnapshot()
  // Lists are saved only through the screen command. Seeding app.entities would hide the blank export.
  assertOk(execute(state, env, "Entities & allocations", "save", "entity-geneva", {
    collection: "entities",
    name: "Sucafina Geneva",
    code: "SFGVA",
  }))
  assertOk(execute(state, env, "Entities & allocations", "save", "alloc-headcount", {
    collection: "allocations",
    name: "By headcount",
    desc: "Split by people",
  }))
  expect(state.data.app).toBeUndefined()
  expect(asRows(state.data.entities)).toEqual([
    expect.objectContaining({ id: "entity-geneva", name: "Sucafina Geneva", code: "SFGVA" }),
  ])
  expect(asRows(state.data.allocations)).toEqual([
    expect.objectContaining({ id: "alloc-headcount", name: "By headcount" }),
  ])
  assertOk(execute(state, env, "OPEX", "save", "software-line", {
    name: "ServiceNow",
    el: "licenses",
    entity: "entity-geneva",
    alloc: "alloc-headcount",
    cur: "USD",
    b: Array.from({ length: 12 }, () => 20),
  }))

  const sheets = await workbookSheets(state, env)
  const info = Object.fromEntries((sheets.Info ?? []).map((row) => [String(row.Field), row.Value]))
  expect(String(info["Valid entities"])).toContain("Sucafina Geneva")
  expect(String(info["Valid entities"])).not.toContain("(none set up)")
  expect(String(info["Valid allocations"])).toContain("By headcount")
  for (const row of opexLine(sheets, "software-line")) {
    const entity = String(row.Entity ?? "")
    expect(entity === "Sucafina Geneva" || entity === "SFGVA").toBe(true)
    expect(row.Allocation).toBe("By headcount")
  }

  const codeState = structuredClone(state)
  const codeSheets = structuredClone(sheets)
  for (const row of opexLine(codeSheets, "software-line")) {
    row.Entity = "SFGVA"
    row.Allocation = "By headcount"
  }
  const byCode = applyWorkbook(codeState, env, "OPEX", codeSheets)
  assertOk(byCode)
  expect(byCode.warnings?.some((warning) => warning.includes("SFGVA") || warning.includes("By headcount")) ?? false).toBe(
    false,
  )
  expect(storedLine(codeState, "software-line").entity).toBe("entity-geneva")
  expect(storedLine(codeState, "software-line").alloc).toBe("alloc-headcount")

  const unknownState = structuredClone(state)
  const unknownSheets = structuredClone(sheets)
  for (const row of opexLine(unknownSheets, "software-line")) {
    row.Entity = "No Such Entity"
    row.Allocation = "No Such Allocation"
  }
  const unknown = applyWorkbook(unknownState, env, "OPEX", unknownSheets)
  assertOk(unknown)
  expect(unknown.warnings?.some((warning) => warning.includes("No Such Entity"))).toBe(true)
  expect(unknown.warnings?.some((warning) => warning.includes("No Such Allocation"))).toBe(true)
  expect(storedLine(unknownState, "software-line").entity).toBe("entity-geneva")
  expect(storedLine(unknownState, "software-line").alloc).toBe("alloc-headcount")

  const applied = applyWorkbook(state, env, "OPEX", sheets)
  assertOk(applied)
  expect(storedLine(state, "software-line").entity).toBe("entity-geneva")
  expect(storedLine(state, "software-line").alloc).toBe("alloc-headcount")
  expect(asRows(state.data.entities).map((row) => row.id)).toEqual(["entity-geneva"])
  expect(asRows(state.data.allocations).map((row) => row.id)).toEqual(["alloc-headcount"])
})

test("PL-FX-NULL blank CHF rate reimports, skips invalid rates, and keeps USD at 1", async () => {
  const env = environment()
  const state = planSnapshot()
  assertOk(execute(state, env, "FX rates", "save", "chf", { cur: "CHF", rate: "" }))
  assertOk(execute(state, env, "FX rates", "save", "eur", { cur: "EUR", rate: "1,123456" }))
  assertOk(execute(state, env, "OPEX", "save", "usd-software", {
    name: "USD software",
    el: "licenses",
    cur: "USD",
    b: months.slice(),
  }))
  assertOk(execute(state, env, "OPEX", "save", "chf-consulting", {
    name: "CHF consulting",
    el: "services",
    cur: "CHF",
    b: Array.from({ length: 12 }, () => 50),
  }))
  const eurRate = asRows(storedVersion(state).fx).find((row) => row.cur === "EUR")?.rate
  if (typeof eurRate !== "number" || !(eurRate > 0)) throw new Error("Expected the screen to save a positive EUR rate")
  expect(asRows(storedVersion(state).fx)).toEqual([
    expect.objectContaining({ id: "chf", cur: "CHF", rate: null }),
    expect.objectContaining({ id: "eur", cur: "EUR", rate: eurRate }),
  ])
  expect(summaryLine(state, env, "chf-consulting").total).toBe(0)
  expect(summaryLine(state, env, "usd-software").total).toBe(1200)
  expect(strings(asRecord(viewedVersion(state, env).summary, "summary").warnings)).toEqual(["CHF"])
  expect(screenHtml(state, env, "Overview")).toContain("Missing FX rate: CHF")

  const sheets = await workbookSheets(state, env)
  const chf = (sheets["FX rates"] ?? []).find((row) => row.Currency === "CHF")
  const eur = (sheets["FX rates"] ?? []).find((row) => row.Currency === "EUR")
  expect(chf).toMatchObject({ Currency: "CHF" })
  expect(chf?.["USD per 1 unit"] == null || chf?.["USD per 1 unit"] === "").toBe(true)
  expect(typeof eur?.["USD per 1 unit"]).toBe("number")
  expect(Number(eur?.["USD per 1 unit"])).toBeGreaterThan(0)
  const budget = opexLine(sheets, "usd-software").find((row) => String(row.Measure).startsWith("Budget"))
  if (!budget) throw new Error("Expected USD budget row")
  expect(budget.Jan).toBe(100)
  budget.Jan = 175
  sheets["FX rates"]?.push(
    { Currency: "AUD", "USD per 1 unit": "1,234567" },
    { Currency: "GBP", "USD per 1 unit": -4 },
    { Currency: "JPY", "USD per 1 unit": "pending" },
  )

  const applied = applyWorkbook(state, env, "FX rates", sheets)
  assertOk(applied)
  expect(applied.warnings?.some((warning) => warning.includes("GBP"))).toBe(true)
  expect(applied.warnings?.some((warning) => warning.includes("JPY"))).toBe(true)
  expect(applied.warnings?.some((warning) => warning.includes("AUD") || warning.includes("EUR")) ?? false).toBe(false)
  const fx = asRows(storedVersion(state).fx)
  const audRate = fx.find((row) => row.cur === "AUD")?.rate
  if (typeof audRate !== "number") throw new Error("Expected the six-decimal AUD rate to be saved")
  expect(fx.map((row) => row.cur).sort()).toEqual(["AUD", "CHF", "EUR"])
  expect(fx.find((row) => row.cur === "CHF")).toMatchObject({ id: "chf", rate: null })
  expect(fx.find((row) => row.cur === "EUR")?.rate).toBe(eurRate)
  expect(audRate).toBeCloseTo(1.234567, 6)
  expect(fx.some((row) => row.cur === "USD" || row.cur === "GBP" || row.cur === "JPY")).toBe(false)
  expect(storedLine(state, "usd-software").b).toEqual([175, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100])
  expect(storedLine(state, "chf-consulting").cur).toBe("CHF")
  expect(numbers(storedLine(state, "chf-consulting").b, "CHF budget").reduce((sum, value) => sum + value, 0)).toBe(600)
  expect(summaryLine(state, env, "chf-consulting").total).toBe(0)
  expect(summaryLine(state, env, "usd-software").total).toBe(
    numbers(storedLine(state, "usd-software").b, "USD budget").reduce((sum, value) => sum + value, 0),
  )
  expect(strings(asRecord(viewedVersion(state, env).summary, "summary").warnings)).toEqual(["CHF"])
  expect(asRecord(viewedVersion(state, env).summary, "summary").total).toBe(summaryLine(state, env, "usd-software").total)
  const overview = screenHtml(state, env, "Overview")
  expect(overview).toContain("Missing FX rate: CHF")
  expect(overview).not.toContain("Missing FX rate: USD")
})

test("PL-EXPORT-FTE missing FTE costs as 1 on screen and in the workbook", async () => {
  const env = environment()
  const state = planSnapshot()
  assertOk(execute(state, env, "Headcount", "save", "brazil-rate", {
    collection: "rates",
    name: "Brazil staff",
    locs: "Sao Paulo",
    annual: 120000,
    cur: "USD",
  }))
  // Save would clamp these values and hide the export gap. The stored rows are the screen's input.
  const specs: { id: string; name: string; fte?: number | null }[] = [
    { id: "ada-missing", name: "Ada Missing" },
    { id: "ana-null", name: "Ana Null", fte: null },
    { id: "ned-negative", name: "Ned Negative", fte: -1 },
    { id: "bea-one", name: "Bea One", fte: 1 },
    { id: "cid-zero", name: "Cid Zero", fte: 0 },
    { id: "dee-high", name: "Dee High", fte: 3 },
    { id: "eli-two", name: "Eli Two", fte: 2 },
  ]
  asRecord(storedVersion(state).hc, "headcount").positions = specs.map((spec) => {
    const position: Record<string, unknown> = {
      id: spec.id,
      name: spec.name,
      title: "Analyst",
      type: "Employee",
      location: "Sao Paulo",
      domain: "Application Management",
      include: true,
      start: 1,
      end: 12,
      rateId: "brazil-rate",
    }
    if (spec.fte !== undefined) position.fte = spec.fte
    return position
  })

  const before = screenHtml(state, env, "Headcount")
  expect(visibleFyCost(before, "Ada Missing")).toBe(visibleFyCost(before, "Bea One"))
  expect(visibleFyCost(before, "Ada Missing")).not.toBe("$0.00")
  expect(visibleFyCost(before, "Cid Zero")).toBe("$0.00")
  expect(screenMonths(state, env, "ada-missing")).toBe(screenMonths(state, env, "bea-one"))
  expect(screenMonths(state, env, "cid-zero")).toBe(0)
  expect(screenMonths(state, env, "bea-one")).toBeGreaterThan(0)

  const sheets = await workbookSheets(state, env)
  expect(headcountRow(sheets, "ana-null").FTE).toBe(1)
  expect(headcountRow(sheets, "ana-null")[fyCost]).toBe(headcountRow(sheets, "bea-one")[fyCost])
  expect(headcountRow(sheets, "ned-negative").FTE).toBe(0)
  expect(headcountRow(sheets, "ned-negative")[fyCost]).toBe(0)
  expect(headcountRow(sheets, "cid-zero").FTE).toBe(0)
  expect(headcountRow(sheets, "cid-zero")[fyCost]).toBe(0)
  expect(headcountRow(sheets, "bea-one").FTE).toBe(1)
  expect(headcountRow(sheets, "bea-one")[fyCost]).toBe(screenMonths(state, env, "bea-one"))
  expect(headcountRow(sheets, "eli-two").FTE).toBe(2)
  expect(headcountRow(sheets, "eli-two")[fyCost]).toBeGreaterThan(Number(headcountRow(sheets, "bea-one")[fyCost]))
  expect(headcountRow(sheets, "ada-missing")[fyCost]).toBe(headcountRow(sheets, "bea-one")[fyCost])
  expect(headcountRow(sheets, "ada-missing").FTE).toBe(1)
  expect(headcountRow(sheets, "dee-high").FTE).toBe(2)
  expect(headcountRow(sheets, "dee-high")[fyCost]).toBe(headcountRow(sheets, "eli-two")[fyCost])
  expect(visibleFyCost(before, "Dee High")).toBe(visibleFyCost(before, "Eli Two"))
  expect(screenMonths(state, env, "dee-high")).toBe(screenMonths(state, env, "eli-two"))

  const applied = applyWorkbook(state, env, "Headcount", sheets)
  assertOk(applied)
  expect(storedPosition(state, "ada-missing").fte).toBe(1)
  expect(storedPosition(state, "ana-null").fte).toBe(1)
  expect(storedPosition(state, "ned-negative").fte).toBe(0)
  expect(storedPosition(state, "bea-one").fte).toBe(1)
  expect(storedPosition(state, "cid-zero").fte).toBe(0)
  expect(storedPosition(state, "dee-high").fte).toBe(2)
  expect(storedPosition(state, "eli-two").fte).toBe(2)
  expect(storedPosition(state, "ada-missing").rateId).toBe("brazil-rate")
  expect(storedPosition(state, "ada-missing").include).toBe(true)
  const after = screenHtml(state, env, "Headcount")
  expect(visibleFyCost(after, "Ada Missing")).toBe(visibleFyCost(after, "Bea One"))
  expect(visibleFyCost(after, "Ada Missing")).not.toBe("$0.00")
  expect(visibleFyCost(after, "Cid Zero")).toBe("$0.00")
  expect(visibleFyCost(after, "Dee High")).toBe(visibleFyCost(after, "Eli Two"))
  expect(screenMonths(state, env, "ada-missing")).toBe(screenMonths(state, env, "bea-one"))
  expect(screenMonths(state, env, "cid-zero")).toBe(0)
  expect(screenMonths(state, env, "dee-high")).toBe(screenMonths(state, env, "eli-two"))
})
