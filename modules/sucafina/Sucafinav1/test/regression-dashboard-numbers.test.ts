// INV-DASH-YTD-INPUT and INV-DASH-OPEX-ANNUAL.
// Calls domain.execute. Compares the snapshot that call stores.
// Year-amount arrays are the Desenho §7.4 split for the stored current month.
// An OPEX annual is the twelve stored month budgets, not a second importer.

import { expect, test } from "bun:test"
import { computeBudgetTotals } from "../src/dashboard-accounts.ts"
import type { Actor, Command, Environment, Snapshot } from "../runtime/contract.ts"
import { rows, text } from "../runtime/contract.ts"
import { domain, render } from "../runtime/dashboard-budget.ts"

const admin: Actor = { id: "directory-admin", canWrite: true, roles: ["admin"] }
const leader: Actor = { id: "leader", canWrite: true, roles: ["domain leader"] }
const at = "2026-11-11T12:00:00Z"
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const
const ELEVEN = [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 0]
const TWELVE = [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000]
const ZEROS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
const ROUNDED_100000 = [8333, 8333, 8333, 8333, 8333, 8333, 8333, 8333, 8333, 8333, 8333, 8333]

type Kind = "opex" | "capex"

function empty(): Snapshot {
  return { data: {}, versions: {}, sequences: {}, audit: [], notices: [] }
}
function environment(prefix: string): Environment {
  let serial = 0
  return { at, id: () => `${prefix}-${++serial}`, directory: [] }
}
function savedVersions(state: Snapshot): Record<string, number> {
  return Object.fromEntries(Object.entries(state.versions).map(([key, value]) => [key, value.version]))
}
function pageOf(kind: Kind): string {
  return kind === "opex" ? "OPEX Detail" : "CAPEX Projects"
}
function linesOf(kind: Kind): string {
  return kind === "opex" ? "opexOwners" : "capexProjects"
}
function entriesOf(kind: Kind): string {
  return kind === "opex" ? "opexEntries" : "capexEntries"
}
function refOf(kind: Kind): "ownerId" | "projId" {
  return kind === "opex" ? "ownerId" : "projId"
}
function ytdGroup(state: Snapshot, kind: Kind): Record<string, unknown> {
  const root = state.data.budgetYtd
  if (!root || typeof root !== "object" || Array.isArray(root)) return {}
  const group = (root as Record<string, unknown>)[kind]
  if (!group || typeof group !== "object" || Array.isArray(group)) return {}
  return group as Record<string, unknown>
}
function lineEntries(state: Snapshot, kind: Kind, id: string, year = 2026): Record<string, unknown>[] {
  const ref = refOf(kind)
  return rows(state.data[entriesOf(kind)])
    .filter((row) => String(row[ref] ?? row.projectId ?? "") === id && Number(row.year) === year)
    .sort((left, right) => Number(left.month) - Number(right.month))
}
function versionMap(state: Snapshot, prefix: string): Record<string, { version: number; by: string }> {
  return Object.fromEntries(Object.entries(state.versions).filter(([key]) => key.startsWith(prefix)))
}
function screen(state: Snapshot, page: string): string {
  const html = render(page, state.data, { actor: admin, year: 2026, month: 11, at, versions: state.versions })
  expect(html).toBeString()
  return html ?? ""
}
function formEnvelope(html: string, action: string, recordId?: string): { version: number; versions: Record<string, number> } {
  const form = html
    .split("<form ")
    .slice(1)
    .map((chunk) => chunk.split("</form>")[0] ?? "")
    .find((chunk) => chunk.startsWith(`data-command="${action}"`) && (recordId === undefined || chunk.includes(`data-record="${recordId}"`)))
  if (!form) throw new Error(`missing ${action} form`)
  const versionText = form.match(/data-version="(\d+)"/)?.[1]
  const encoded = form.match(/name="versions" value="([^"]*)"/)?.[1]
  if (versionText === undefined || encoded === undefined) throw new Error(`missing ${action} version map`)
  const parsed = JSON.parse(encoded.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")) as Record<string, unknown>
  const versions: Record<string, number> = {}
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== "number") throw new Error(`version ${key} is not a stored number`)
    versions[key] = value
  }
  return { version: Number(versionText), versions }
}
function envelope(state: Snapshot, page: string, action: string, recordId?: string): { version: number; versions: Record<string, number> } {
  const read = formEnvelope(screen(state, page), action, recordId)
  expect(read.versions).toEqual(savedVersions(state))
  return read
}
function run(state: Snapshot, env: Environment, actor: Actor, command: Command) {
  return domain.execute(state, actor, command, env)
}
function mustOk(state: Snapshot, env: Environment, command: Command) {
  expect(run(state, env, admin, command)).toMatchObject({ ok: true })
}
function addLine(state: Snapshot, env: Environment, kind: Kind, name: string, budget: number): string {
  mustOk(state, env, {
    page: pageOf(kind),
    action: "save",
    id: "",
    version: 0,
    values: { name, budget },
  })
  const row = rows(state.data[linesOf(kind)]).find((item) => text(item.name) === name)
  if (!row) throw new Error(`missing ${name}`)
  return String(row.id ?? "")
}
function setMonth(state: Snapshot, env: Environment, month: number) {
  const form = envelope(state, "Budget Overview", "save-month")
  mustOk(state, env, {
    page: "Budget Overview",
    action: "save-month",
    version: form.version,
    values: { year: 2026, month, versions: form.versions },
  })
}
function seedMonth(
  state: Snapshot,
  env: Environment,
  kind: Kind,
  lineId: string,
  year: number,
  month: number,
  amounts: { budget: number; actual: number; forecast: number },
) {
  mustOk(state, env, {
    page: pageOf(kind),
    action: "save-entry",
    id: "",
    version: 0,
    values: { [refOf(kind)]: lineId, year, month, ...amounts },
  })
}
function yearCommand(state: Snapshot, kind: Kind, id: string, amount: unknown): Command {
  const form = envelope(state, pageOf(kind), "year-amount", id)
  return {
    page: pageOf(kind),
    action: "year-amount",
    id,
    version: form.version,
    values: { year: 2026, month: 9, amount, versions: form.versions },
  }
}
function retouch(state: Snapshot, env: Environment, kind: Kind, lineId: string) {
  const entry = lineEntries(state, kind, lineId).find((row) => Number(row.month) === 1)
  const entryId = String(entry?.id ?? "")
  const form = envelope(state, pageOf(kind), "save-entry", entryId)
  mustOk(state, env, {
    page: pageOf(kind),
    action: "save-entry",
    id: entryId,
    version: form.version,
    values: {
      [refOf(kind)]: lineId,
      year: 2026,
      month: 1,
      budget: Number(entry?.budget ?? 0),
      actual: 90,
      forecast: 80,
      versions: form.versions,
    },
  })
}
function openYear(kind: Kind) {
  const state = empty()
  const env = environment(kind)
  const id = addLine(state, env, kind, "Apps", 12000)
  const other = addLine(state, env, kind, "Networks", 8000)
  setMonth(state, env, 3)
  seedMonth(state, env, kind, id, 2026, 1, { budget: 40, actual: 1, forecast: 1 })
  mustOk(state, env, yearCommand(state, kind, id, 100))
  mustOk(state, env, yearCommand(state, kind, other, 50))
  retouch(state, env, kind, id)
  retouch(state, env, kind, id)
  const entry = lineEntries(state, kind, id).find((row) => Number(row.month) === 1)
  const entryVersion = state.versions[`${entriesOf(kind)}:${String(entry?.id ?? "")}`]?.version
  expect(entryVersion).toBeGreaterThan(0)
  expect(entryVersion).not.toBe(state.versions.budgetYtd?.version)
  return { state, env, id, other }
}
function storedSum(entries: Record<string, unknown>[]): number {
  return entries.reduce((sum, row) => sum + (typeof row.budget === "number" ? row.budget : 0), 0)
}
function budgetRow(owner: string, months: readonly number[], columns: { Annual?: unknown; Total?: unknown } = {}) {
  const row: Record<string, unknown> = { Owner: owner }
  if ("Annual" in columns) row.Annual = columns.Annual
  if ("Total" in columns) row.Total = columns.Total
  MONTHS.forEach((name, index) => {
    row[name] = months[index]
  })
  return row
}
function importCommand(state: Snapshot, imported: Record<string, unknown>[]): Command {
  const form = envelope(state, "OPEX Detail", "import")
  return {
    page: "OPEX Detail",
    action: "import",
    id: "",
    version: form.version,
    values: { year: 2026, rows: imported, versions: form.versions },
  }
}
function opexFixture() {
  const state = empty()
  const env = environment("opex")
  const apps = addLine(state, env, "opex", "Apps", 12000)
  seedMonth(state, env, "opex", apps, 2026, 1, { budget: 40, actual: 90, forecast: 80 })
  seedMonth(state, env, "opex", apps, 2026, 12, { budget: 40, actual: 7, forecast: 8 })
  seedMonth(state, env, "opex", apps, 2025, 2, { budget: 6, actual: 4, forecast: 5 })
  return { state, env, apps }
}
function ownerRow(state: Snapshot, name: string): Record<string, unknown> {
  const row = rows(state.data.opexOwners).find((item) => text(item.name) === name)
  if (!row) throw new Error(`missing ${name}`)
  return row
}
function preserveActuals(before: Record<string, unknown>[], state: Snapshot) {
  for (const row of before) {
    const after = rows(state.data.opexEntries).find((item) => item.id === row.id)
    expect(after?.actual).toEqual(row.actual)
    expect(after?.forecast).toEqual(row.forecast)
  }
}
function effectiveCell(html: string, owner: string, month: number): string {
  const section = html.split(`<h2>${owner}</h2>`)[1]?.split("</section>")[0] ?? ""
  const row = section
    .split("<tr>")
    .map((part) => part.split("</tr>")[0] ?? "")
    .find((part) => part.startsWith(`<td>${month}</td>`))
  return row?.match(/^<td>\d+<\/td><td>([^<]*)<\/td>/)?.[1] ?? ""
}
function opexBudget(state: Snapshot, year: number): number {
  return computeBudgetTotals(
    {
      opexOwners: rows(state.data.opexOwners).map((row) => ({
        id: String(row.id ?? ""),
        budget: typeof row.budget === "number" ? row.budget : undefined,
      })),
      opexEntries: rows(state.data.opexEntries).map((row) => ({
        year: Number(row.year),
        month: Number(row.month),
        ownerId: typeof row.ownerId === "string" || typeof row.ownerId === "number" ? row.ownerId : "",
        budget: typeof row.budget === "number" ? row.budget : undefined,
        actual: typeof row.actual === "number" ? row.actual : undefined,
        forecast: typeof row.forecast === "number" ? row.forecast : undefined,
      })),
    },
    year,
  ).opexBudget
}

test("INV-DASH-YTD-INPUT negative and non-finite year amounts return 422 without mutation", () => {
  const amounts: unknown[] = [-100, "-100", " -100 ", "-0.01", "12.5.6", "-", ".", "-.", Number.NaN, Number.POSITIVE_INFINITY]
  for (const kind of ["opex", "capex"] as const) {
    for (const amount of amounts) {
      const opened = openYear(kind)
      const before = structuredClone(opened.state)
      expect(run(opened.state, opened.env, admin, yearCommand(opened.state, kind, opened.id, amount))).toMatchObject({
        ok: false,
        status: 422,
      })
      expect(opened.state).toEqual(before)
    }
  }
  const opened = openYear("opex")
  opened.state.data.budgetLineIds = { leader: [`opexOwners:${opened.id}`] }
  const before = structuredClone(opened.state)
  expect(run(opened.state, opened.env, leader, yearCommand(opened.state, "opex", opened.id, -100))).toMatchObject({
    ok: false,
    status: 422,
  })
  expect(opened.state).toEqual(before)
})

test("INV-DASH-YTD-INPUT empty and whitespace clear only that budgetYtd key", () => {
  for (const kind of ["opex", "capex"] as const) {
    for (const amount of ["", " ", "\t", " \n\t "]) {
      const opened = openYear(kind)
      const entries = structuredClone(rows(opened.state.data[entriesOf(kind)]))
      const entryVersions = structuredClone(versionMap(opened.state, `${entriesOf(kind)}:`))
      const sibling = structuredClone(ytdGroup(opened.state, kind)[`2026:${opened.other}`])
      expect(run(opened.state, opened.env, admin, yearCommand(opened.state, kind, opened.id, amount))).toMatchObject({
        ok: true,
      })
      expect(ytdGroup(opened.state, kind)[`2026:${opened.id}`]).toBeUndefined()
      expect(ytdGroup(opened.state, kind)[`2026:${opened.other}`]).toEqual(sibling)
      expect(rows(opened.state.data[entriesOf(kind)])).toEqual(entries)
      expect(versionMap(opened.state, `${entriesOf(kind)}:`)).toEqual(entryVersions)
    }
  }
})

test("INV-DASH-YTD-INPUT a token that strips to empty clears only that key and does not write zero", () => {
  for (const kind of ["opex", "capex"] as const) {
    for (const amount of ["n/a", "abc", "$$$", "—", "  n/a  ", "Infinity"]) {
      const opened = openYear(kind)
      const entries = structuredClone(rows(opened.state.data[entriesOf(kind)]))
      const entryVersions = structuredClone(versionMap(opened.state, `${entriesOf(kind)}:`))
      const sibling = structuredClone(ytdGroup(opened.state, kind)[`2026:${opened.other}`])
      const month = lineEntries(opened.state, kind, opened.id).find((row) => Number(row.month) === 1)
      expect(month?.actual).toBe(90)
      expect(run(opened.state, opened.env, admin, yearCommand(opened.state, kind, opened.id, amount))).toMatchObject({
        ok: true,
      })
      expect(ytdGroup(opened.state, kind)[`2026:${opened.id}`]).toBeUndefined()
      expect(ytdGroup(opened.state, kind)[`2026:${opened.other}`]).toEqual(sibling)
      expect(rows(opened.state.data[entriesOf(kind)])).toEqual(entries)
      expect(versionMap(opened.state, `${entriesOf(kind)}:`)).toEqual(entryVersions)
    }
  }
})

test("INV-DASH-YTD-INPUT positive cent splits stay on the stored current month", () => {
  const cases: [Kind, number, number, number[], number][] = [
    ["opex", 3, 100, [33.33, 33.33, 33.34, 0, 0, 0, 0, 0, 0, 0, 0, 0], 33.33],
    ["capex", 2, 10.5, [5.25, 5.25, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 5.25],
  ]
  for (const [kind, month, amount, actuals, per] of cases) {
    const state = empty()
    const env = environment(`split-${kind}`)
    const id = addLine(state, env, kind, "Line", 12000)
    setMonth(state, env, month)
    seedMonth(state, env, kind, id, 2026, 1, { budget: 40, actual: 1, forecast: 1 })
    const command = yearCommand(state, kind, id, amount)
    const seeded = lineEntries(state, kind, id).find((row) => Number(row.month) === 1)
    const seededKey = `${entriesOf(kind)}:${String(seeded?.id ?? "")}`
    expect(command.version).toBe(0)
    expect(command.values.versions).toMatchObject({ [seededKey]: state.versions[seededKey]?.version })
    expect(state.versions[seededKey]?.version).not.toBe(command.version)
    mustOk(state, env, command)
    const entries = lineEntries(state, kind, id)
    expect(entries.map((row) => row.actual)).toEqual(actuals)
    expect(entries.map((row) => row.forecast)).toEqual(Array<number>(12).fill(per))
    expect(ytdGroup(state, kind)[`2026:${id}`]).toMatchObject({ amount, months: month, perMonth: per, at })
    expect(state.data.budgetCurrentMonth).toEqual({ 2026: month })
  }
})

test("INV-DASH-YTD-INPUT a finite zero still spreads zeros and keeps the other line", () => {
  for (const [kind, amount] of [
    ["opex", 0],
    ["capex", "0"],
  ] as const) {
    const opened = openYear(kind)
    const siblingEntries = structuredClone(lineEntries(opened.state, kind, opened.other))
    const sibling = structuredClone(ytdGroup(opened.state, kind)[`2026:${opened.other}`])
    mustOk(opened.state, opened.env, yearCommand(opened.state, kind, opened.id, amount))
    const entries = lineEntries(opened.state, kind, opened.id)
    expect(entries.map((row) => row.actual)).toEqual(ZEROS)
    expect(entries.map((row) => row.forecast)).toEqual(ZEROS)
    expect(ytdGroup(opened.state, kind)[`2026:${opened.id}`]).toMatchObject({ amount: 0, months: 3, perMonth: 0 })
    expect(lineEntries(opened.state, kind, opened.other)).toEqual(siblingEntries)
    expect(ytdGroup(opened.state, kind)[`2026:${opened.other}`]).toEqual(sibling)
  }
})

test("INV-DASH-YTD-INPUT a rejected actor or a stale saved version writes nothing", () => {
  const opened = openYear("opex")
  const denied: Actor[] = [
    { id: "viewer", canWrite: true, roles: ["viewer"] },
    { id: "contributor", canWrite: true, roles: ["contributor"] },
    { ...admin, canWrite: false },
    leader,
  ]
  for (const actor of denied) {
    const before = structuredClone(opened.state)
    expect(run(opened.state, opened.env, actor, yearCommand(opened.state, "opex", opened.id, 100))).toMatchObject({
      ok: false,
      status: 403,
    })
    expect(opened.state).toEqual(before)
  }
  const stalePrimary = yearCommand(opened.state, "opex", opened.id, 100)
  expect(stalePrimary.version).toBeGreaterThan(0)
  stalePrimary.version -= 1
  const beforePrimary = structuredClone(opened.state)
  expect(run(opened.state, opened.env, admin, stalePrimary)).toMatchObject({ ok: false, status: 409 })
  expect(opened.state).toEqual(beforePrimary)
  const december = lineEntries(opened.state, "opex", opened.id).find((row) => Number(row.month) === 12)
  const decemberKey = `opexEntries:${String(december?.id ?? "")}`
  const staleEntry = yearCommand(opened.state, "opex", opened.id, 100)
  const versions = { ...(staleEntry.values.versions as Record<string, number>) }
  expect(versions[decemberKey]).toBe(opened.state.versions[decemberKey]?.version)
  expect(versions[decemberKey]).toBeGreaterThan(0)
  versions[decemberKey] = 0
  staleEntry.values = { ...staleEntry.values, versions }
  const beforeEntry = structuredClone(opened.state)
  expect(run(opened.state, opened.env, admin, staleEntry)).toMatchObject({ ok: false, status: 409 })
  expect(opened.state).toEqual(beforeEntry)
})

test("INV-DASH-OPEX-ANNUAL new and existing owners take the sum of the twelve stored months", () => {
  const fixture = opexFixture()
  const priorEntries = structuredClone(rows(fixture.state.data.opexEntries))
  const priorYear = structuredClone(priorEntries.find((row) => row.year === 2025))
  const appsKey = `opexEntries:${String(lineEntries(fixture.state, "opex", fixture.apps).find((row) => Number(row.month) === 1)?.id ?? "")}`
  const command = importCommand(fixture.state, [budgetRow("Apps", ELEVEN), budgetRow("Networks", TWELVE)])
  expect(command.values.versions).toMatchObject({ [appsKey]: fixture.state.versions[appsKey]?.version })
  expect(command.version).not.toBe((command.values.versions as Record<string, number>)[appsKey])
  mustOk(fixture.state, fixture.env, command)
  const apps = ownerRow(fixture.state, "Apps")
  const networks = ownerRow(fixture.state, "Networks")
  expect(apps.id).toBe(fixture.apps)
  expect(rows(fixture.state.data.opexOwners).map((row) => text(row.name)).sort()).toEqual(["Apps", "Networks"])
  const appsEntries = lineEntries(fixture.state, "opex", fixture.apps)
  const networksEntries = lineEntries(fixture.state, "opex", String(networks.id))
  expect(appsEntries.map((row) => row.budget)).toEqual(ELEVEN)
  expect(networksEntries.map((row) => row.budget)).toEqual(TWELVE)
  preserveActuals(priorEntries, fixture.state)
  expect(rows(fixture.state.data.opexEntries).find((row) => row.year === 2025)).toEqual(priorYear)
  const appsAnnual = storedSum(appsEntries)
  const networksAnnual = storedSum(networksEntries)
  expect(apps.budget).toBe(appsAnnual)
  expect(effectiveCell(screen(fixture.state, "OPEX Detail"), "Apps", 12)).toBe(`$${appsAnnual / 12}`)
  expect(networks.budget).toBe(networksAnnual)
  const month = networksEntries.find((row) => Number(row.month) === 4)
  const monthId = String(month?.id ?? "")
  const form = envelope(fixture.state, "OPEX Detail", "save-entry", monthId)
  mustOk(fixture.state, fixture.env, {
    page: "OPEX Detail",
    action: "save-entry",
    id: monthId,
    version: form.version,
    values: {
      ownerId: networks.id,
      year: 2026,
      month: 4,
      budget: 0,
      actual: Number(month?.actual ?? 0),
      forecast: Number(month?.forecast ?? 0),
      versions: form.versions,
    },
  })
  expect(ownerRow(fixture.state, "Networks").budget).toBe(networksAnnual)
  expect(lineEntries(fixture.state, "opex", String(networks.id)).find((row) => Number(row.month) === 4)?.budget).toBe(0)
  expect(effectiveCell(screen(fixture.state, "OPEX Detail"), "Networks", 4)).toBe(`$${networksAnnual / 12}`)
})

test("INV-DASH-OPEX-ANNUAL a populated Annual or Total does not replace a non-zero month sum", () => {
  const fixture = opexFixture()
  const priorEntries = structuredClone(rows(fixture.state.data.opexEntries))
  mustOk(
    fixture.state,
    fixture.env,
    importCommand(fixture.state, [
      budgetRow("Apps", ELEVEN, { Annual: 999, Total: 5 }),
      budgetRow("Networks", TWELVE, { Annual: 1, Total: 2 }),
    ]),
  )
  const appsEntries = lineEntries(fixture.state, "opex", fixture.apps)
  const networks = ownerRow(fixture.state, "Networks")
  expect(appsEntries.map((row) => row.budget)).toEqual(ELEVEN)
  expect(lineEntries(fixture.state, "opex", String(networks.id)).map((row) => row.budget)).toEqual(TWELVE)
  preserveActuals(priorEntries, fixture.state)
  expect(ownerRow(fixture.state, "Apps").budget).toBe(storedSum(appsEntries))
  expect(networks.budget).toBe(storedSum(lineEntries(fixture.state, "opex", String(networks.id))))
})

test("INV-DASH-OPEX-ANNUAL all-zero months with a blank Annual clear the previous annual", () => {
  const fixture = opexFixture()
  const priorEntries = structuredClone(rows(fixture.state.data.opexEntries))
  const priorYear = structuredClone(priorEntries.find((row) => row.year === 2025))
  mustOk(fixture.state, fixture.env, importCommand(fixture.state, [budgetRow("Apps", ZEROS, { Annual: "" })]))
  const apps = ownerRow(fixture.state, "Apps")
  const entries = lineEntries(fixture.state, "opex", fixture.apps)
  expect(entries.map((row) => row.budget)).toEqual(ZEROS)
  expect(apps.budget).toBe(storedSum(entries))
  expect(opexBudget(fixture.state, 2026)).toBe(0)
  expect(effectiveCell(screen(fixture.state, "OPEX Detail"), "Apps", 1)).toBe("$0")
  preserveActuals(priorEntries, fixture.state)
  expect(rows(fixture.state.data.opexEntries).find((row) => row.year === 2025)).toEqual(priorYear)
})

test("INV-DASH-OPEX-ANNUAL all-zero months set an existing owner's annual from Annual or Total", () => {
  const fixture = opexFixture()
  const tolls = addLine(fixture.state, fixture.env, "opex", "Tolls", 9000)
  const priorEntries = structuredClone(rows(fixture.state.data.opexEntries))
  mustOk(
    fixture.state,
    fixture.env,
    importCommand(fixture.state, [
      budgetRow("Apps", ZEROS, { Annual: 100000 }),
      budgetRow("Tolls", ZEROS, { Total: 100000 }),
    ]),
  )
  expect(lineEntries(fixture.state, "opex", fixture.apps).map((row) => row.budget)).toEqual(ROUNDED_100000)
  expect(lineEntries(fixture.state, "opex", tolls).map((row) => row.budget)).toEqual(ROUNDED_100000)
  preserveActuals(priorEntries, fixture.state)
  expect(ownerRow(fixture.state, "Apps").budget).toBe(100000)
  expect(ownerRow(fixture.state, "Tolls").budget).toBe(100000)
})

test("INV-DASH-OPEX-ANNUAL a new all-zero owner stores Annual or Total and the rounded months", () => {
  const state = empty()
  const env = environment("new-owner")
  mustOk(
    state,
    env,
    importCommand(state, [
      budgetRow("AnnualOwner", ZEROS, { Annual: 100000 }),
      budgetRow("TotalOwner", ZEROS, { Total: 100000 }),
    ]),
  )
  for (const name of ["AnnualOwner", "TotalOwner"]) {
    const owner = ownerRow(state, name)
    expect(owner.budget).toBe(100000)
    expect(lineEntries(state, "opex", String(owner.id)).map((row) => row.budget)).toEqual(ROUNDED_100000)
  }
})

test("INV-DASH-OPEX-ANNUAL a rejected importer or a stale saved entry version writes nothing", () => {
  const fixture = opexFixture()
  const denied: Actor[] = [leader, { id: "viewer", canWrite: true, roles: ["viewer"] }, { ...admin, canWrite: false }]
  fixture.state.data.budgetLineIds = { leader: [`opexOwners:${fixture.apps}`] }
  for (const actor of denied) {
    const before = structuredClone(fixture.state)
    expect(run(fixture.state, fixture.env, actor, importCommand(fixture.state, [budgetRow("Apps", TWELVE)]))).toMatchObject({
      ok: false,
      status: 403,
    })
    expect(fixture.state).toEqual(before)
  }
  const december = lineEntries(fixture.state, "opex", fixture.apps).find((row) => Number(row.month) === 12)
  const decemberKey = `opexEntries:${String(december?.id ?? "")}`
  const command = importCommand(fixture.state, [budgetRow("Apps", ELEVEN), budgetRow("Networks", TWELVE)])
  const versions = { ...(command.values.versions as Record<string, number>) }
  expect(versions[decemberKey]).toBeGreaterThan(0)
  versions[decemberKey] = versions[decemberKey] - 1
  command.values = { ...command.values, versions }
  const before = structuredClone(fixture.state)
  expect(run(fixture.state, fixture.env, admin, command)).toMatchObject({ ok: false, status: 409 })
  expect(fixture.state).toEqual(before)
})
