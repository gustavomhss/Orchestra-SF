import { expect, test } from "bun:test"
import { createNativeGateway } from "../../src/native.ts"
import { createModule, type ModuleServices } from "../index.ts"
import { emptyMap, plugGroup, resolve } from "../src/identity.ts"
import { DashboardBudget } from "../runtime/dashboard-budget.ts"
import { PlannerModule } from "../runtime/planner.ts"
import type { Environment } from "../runtime/contract.ts"
import { empty, testPersistence } from "./fixture/persistence.ts"

const ORIGIN = "https://calendar.example"
const MOUNT = "/api/sucafina"
const USER = "calendar-admin"
const TOKEN = "calendar-session"
const GROUPS = ["calendar-dashboard-admins", "calendar-planner-admins"]
const DIRECTORY = [{ id: USER, name: "Calendar Admin" }]

function fixture(at: string, data: Record<string, unknown> = {}) {
  const dashboard = empty()
  const accessMap = plugGroup(
    plugGroup(emptyMap(), "dashboard", "admin", GROUPS[0]!),
    "planner",
    "admin",
    GROUPS[1]!,
  )
  dashboard.data.roleMap = accessMap
  Object.assign(dashboard.data, structuredClone(data))
  const planner = empty()
  planner.data.roleMap = accessMap
  const storage = testPersistence({ dashboard, planner })
  const services: ModuleServices = {
    authenticate: async (request, context) => {
      if (!context || request.headers.get("authorization") !== `Bearer ${TOKEN}`) return null
      return resolve(USER, context.roleMap.map((row) => ({ ...row })), (group) => GROUPS.includes(group))
    },
    environment: async () => ({ at, id: () => "calendar-generated-id", directory: DIRECTORY }),
    persistence: storage.persistence,
    maxJsonBytes: 500_000,
  }
  return {
    ...storage,
    native: createNativeGateway(MOUNT, services),
    legacy: createModule(MOUNT, services),
  }
}

async function nativePage(app: ReturnType<typeof fixture>, page: string, query: Record<string, string> = {}) {
  const url = new URL(`${ORIGIN}${MOUNT}/dashboard/state`)
  url.searchParams.set("page", page)
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value)
  const response = await app.native(new Request(url, { headers: { authorization: `Bearer ${TOKEN}` } }))
  expect(response?.status).toBe(200)
  return await response!.json() as {
    page: string
    year: number
    month: number
    actor: { id: string; name: string; roles: string[] }
    data: Record<string, unknown>
  }
}

async function legacyPage(app: ReturnType<typeof fixture>, page: string, query: Record<string, string> = {}) {
  const url = new URL(`${ORIGIN}${MOUNT}/dashboard`)
  url.searchParams.set("page", page)
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value)
  const response = await app.legacy(new Request(url, { headers: { authorization: `Bearer ${TOKEN}` } }))
  expect(response?.status).toBe(200)
  return await response!.text()
}

function selectedOption(html: string, select: RegExp) {
  const body = html.match(select)?.[1]
  const option = body?.match(/<option(?: value="([^"]*)")? selected>([^<]*)<\/option>/)
  return option?.[1] ?? option?.[2]
}

function yearAmountMonth(at: string, year: number, storedMonth?: unknown) {
  const snapshot = empty()
  const ids = { next: 0 }
  snapshot.data.opexOwners = [{ id: "owner-1", name: "Owner", budget: 1200 }]
  if (storedMonth !== undefined) snapshot.data.budgetCurrentMonth = { [year]: storedMonth }
  const environment: Environment = {
    at,
    id: () => `unused-${++ids.next}`,
    directory: DIRECTORY,
  }
  const result = DashboardBudget.domain.execute(
    snapshot,
    { id: USER, canWrite: true, roles: ["admin"], assigned: [], domains: [] },
    { page: "OPEX Detail", action: "year-amount", id: "owner-1", version: 0, values: { year, amount: 1200 } },
    environment,
  )
  expect(result.ok).toBe(true)
  return (snapshot.data.budgetYtd as { opex: Record<string, { months: number }> }).opex[`${year}:owner-1`]?.months
}

test("stored budget months accept valid integer numbers and legacy numeric strings", () => {
  const at = "2026-08-15T12:00:00Z"
  expect(yearAmountMonth(at, 2026, 7)).toBe(7)
  expect(yearAmountMonth(at, 2026, "9")).toBe(9)
})

test("invalid or absent budget months use local current, past-year twelve, or future-year one", () => {
  const at = "2026-03-01T00:30:00+02:00"
  expect(at.slice(5, 7)).toBe("03")
  for (const invalid of [0, 13, 2.5, "March"]) expect(yearAmountMonth(at, 2026, invalid)).toBe(2)
  expect(yearAmountMonth(at, 2026)).toBe(2)
  expect(yearAmountMonth(at, 2025)).toBe(12)
  expect(yearAmountMonth(at, 2027)).toBe(1)
})

test("first Planner fiscal year follows the supplied instant's local year and persists through the native gateway", async () => {
  // Hosted CI runs with UTC; this offset instant is 2027-01-01 locally although its ISO date begins 2026.
  const at = "2026-12-31T23:30:00-02:00"
  const snapshot = empty()
  const result = PlannerModule.domain.execute(
    snapshot,
    { id: USER, canWrite: true, roles: ["admin"], assigned: [], domains: [] },
    { page: "Versions", action: "save", id: "", version: 0, values: {} },
    { at, id: () => "first-fy", directory: DIRECTORY },
  )
  expect(result.ok).toBe(true)
  expect((snapshot.data.versions as { year: number }[])[0]?.year).toBe(2028)

  const app = fixture(at)
  const response = await app.native(new Request(`${ORIGIN}${MOUNT}/planner/commands`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${TOKEN}`,
      origin: ORIGIN,
      "content-type": "application/json",
    },
    body: JSON.stringify({ page: "Versions", action: "save", version: 0, values: {} }),
  }))
  expect(response?.status).toBe(200)
  expect((app.state.planner.data.versions as { year: number }[])[0]?.year).toBe(2028)
})

test("native gateway and legacy Executive defaults share the local year and month from an offset instant", async () => {
  // Hosted CI runs with UTC; local calendar is 2027-01-01, unlike the literal ISO prefix 2026-12.
  const app = fixture("2026-12-31T23:30:00-02:00")
  const before = structuredClone(app.state.dashboard)
  const native = await nativePage(app, "Executive Dashboard")
  expect(native.actor).toMatchObject({ id: USER, name: "Calendar Admin", roles: ["admin"] })
  expect(native.year).toBe(2027)
  expect(native.month).toBe(1)
  const legacy = await legacyPage(app, "Executive Dashboard")
  expect(legacy).toMatch(/name="execYear"[^>]*>[\s\S]*?<option value="2027" selected>/)
  expect(selectedOption(legacy, /name="executiveMonth"[^>]*>([\s\S]*?)<\/select>/)).toBe("1")
  const otherNativePage = await nativePage(app, "IT Operations")
  const otherLegacyPage = await legacyPage(app, "IT Operations")
  expect(otherNativePage.month).toBe(1)
  expect(selectedOption(otherLegacyPage, /data-month="own" data-query="operationsMonth">([\s\S]*?)<\/select>/)).toBe("1")
  expect(app.state.dashboard).toEqual(before)
})

test("Executive Dashboard defaults a noncurrent year to December and explicit month wins in both renderers", async () => {
  const app = fixture("2026-08-15T12:00:00Z")
  const nativeDefault = await nativePage(app, "Executive Dashboard", { year: "2026", execYear: "2025" })
  const legacyDefault = await legacyPage(app, "Executive Dashboard", { year: "2026", execYear: "2025" })
  expect(nativeDefault.year).toBe(2025)
  expect(nativeDefault.month).toBe(12)
  expect(selectedOption(legacyDefault, /name="executiveMonth"[^>]*>([\s\S]*?)<\/select>/)).toBe("12")
  const nativeExplicit = await nativePage(app, "Executive Dashboard", { year: "2026", execYear: "2025", executiveMonth: "4" })
  const legacyExplicit = await legacyPage(app, "Executive Dashboard", { year: "2026", execYear: "2025", executiveMonth: "4" })
  expect(nativeExplicit.month).toBe(4)
  expect(selectedOption(legacyExplicit, /name="executiveMonth"[^>]*>([\s\S]*?)<\/select>/)).toBe("4")
})

test("domain view selects the latest actual operations month and omits years without a valid row", () => {
  const snapshot = empty()
  snapshot.data.opsTickets = [
    { year: 2025, month: 3 }, { year: 2025, month: 11 },
    { year: 2026, month: 0 }, { year: 2026, month: 13 }, { year: 2026, month: 2 },
    { year: 2027, month: 2.5 },
  ]
  snapshot.data.opsSLA = [{ year: 2026, month: 8 }]
  const viewed = DashboardBudget.domain.view(
    snapshot,
    { id: USER, canWrite: false, roles: ["admin"], assigned: [], domains: [] },
    { at: "2026-06-15T12:00:00Z", id: () => "unused", directory: DIRECTORY },
  )
  expect(viewed.data.opsDefaultMonth).toEqual({ 2025: 11, 2026: 8 })
})

test("Executive operations uses stored latest month, explicit operations month, then executive month fallback", async () => {
  const app = fixture("2026-08-15T12:00:00Z", {
    opsTickets: [{ year: 2025, month: 4 }, { year: 2025, month: 10 }],
    opsSLA: [{ year: 2025, month: 7 }],
  })
  const stored = await nativePage(app, "Executive Dashboard", { year: "2026", execYear: "2025", executiveMonth: "3" })
  expect((stored.data.opsDefaultMonth as Record<string, number>)["2025"]).toBe(10)
  const storedHtml = await legacyPage(app, "Executive Dashboard", { year: "2026", execYear: "2025", executiveMonth: "3" })
  expect(selectedOption(storedHtml, /name="opsMonth"[^>]*>([\s\S]*?)<\/select>/)).toBe("10")
  const explicitHtml = await legacyPage(app, "Executive Dashboard", { year: "2026", execYear: "2025", executiveMonth: "3", opsMonth: "6" })
  expect(selectedOption(explicitHtml, /name="opsMonth"[^>]*>([\s\S]*?)<\/select>/)).toBe("6")
  const empty = fixture("2026-08-15T12:00:00Z")
  const emptyNative = await nativePage(empty, "Executive Dashboard", { year: "2026", execYear: "2025" })
  expect(emptyNative.month).toBe(12)
  expect(emptyNative.data.opsDefaultMonth).not.toHaveProperty("2025")
  const emptyHtml = await legacyPage(empty, "Executive Dashboard", { year: "2026", execYear: "2025" })
  expect(selectedOption(emptyHtml, /name="opsMonth"[^>]*>([\s\S]*?)<\/select>/)).toBe("12")
})

test("Security KPI defaults to latest valid month in selected year through native and legacy routes", async () => {
  const app = fixture("2026-08-15T12:00:00Z", {
    secKpi: [
      { year: 2025, month: 2, socCritical: 2 }, { year: 2025, month: 9, socCritical: 9 },
      { year: 2025, month: 13, socCritical: 13 }, { year: 2026, month: 11, socCritical: 11 },
    ],
  })
  const native = await nativePage(app, "IT Security KPIs", { year: "2026", secYear: "2025" })
  expect(native.year).toBe(2025)
  expect(native.month).toBe(9)
  const legacy = await legacyPage(app, "IT Security KPIs", { year: "2026", secYear: "2025" })
  expect(selectedOption(legacy, /data-month="own" data-query="securityMonth">([\s\S]*?)<\/select>/)).toBe("9")
})

test("Security KPI uses December without selected-year entries; explicit month wins in both routes", async () => {
  const app = fixture("2026-08-15T12:00:00Z", { secKpi: [{ year: 2026, month: 5 }] })
  const nativeDefault = await nativePage(app, "IT Security KPIs", { year: "2026", secYear: "2025" })
  const legacyDefault = await legacyPage(app, "IT Security KPIs", { year: "2026", secYear: "2025" })
  expect(nativeDefault.month).toBe(12)
  expect(selectedOption(legacyDefault, /data-month="own" data-query="securityMonth">([\s\S]*?)<\/select>/)).toBe("12")
  const nativeExplicit = await nativePage(app, "IT Security KPIs", { year: "2026", secYear: "2025", securityMonth: "4" })
  const legacyExplicit = await legacyPage(app, "IT Security KPIs", { year: "2026", secYear: "2025", securityMonth: "4" })
  expect(nativeExplicit.month).toBe(4)
  expect(selectedOption(legacyExplicit, /data-month="own" data-query="securityMonth">([\s\S]*?)<\/select>/)).toBe("4")
})

test("invalid explicit calendar months remain rejected without persisting state", async () => {
  const app = fixture("2026-08-15T12:00:00Z")
  const before = structuredClone(app.state.dashboard)
  for (const month of ["0", "13", "1.5", "March"]) {
    const url = new URL(`${ORIGIN}${MOUNT}/dashboard/state`)
    url.searchParams.set("page", "Executive Dashboard")
    url.searchParams.set("month", month)
    const response = await app.native(new Request(url, { headers: { authorization: `Bearer ${TOKEN}` } }))
    expect(response?.status).toBe(400)
  }
  expect(app.state.dashboard).toEqual(before)
})
