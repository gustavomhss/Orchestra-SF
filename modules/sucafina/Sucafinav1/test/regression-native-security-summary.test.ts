import { expect, test } from "bun:test"
import { createNativeGateway } from "../../src/native.ts"
import type { ModuleServices } from "../index.ts"
import { emptyMap, plugGroup, resolve } from "../src/identity.ts"
import { empty, testPersistence } from "./fixture/persistence.ts"

const noData = [
  { key: "training", value: null, status: "No data" },
  { key: "patch", value: null, status: "No data" },
  { key: "patchEndpoint", value: null, status: "No data" },
  { key: "patchServer", value: null, status: "No data" },
  { key: "scan", value: null, status: "No data" },
  { key: "assessment", value: null, status: "No data" },
  { key: "socPending", value: null, status: "No data" },
  { key: "socClosure", value: null, status: "No data" },
]
type State = {
  actor: { canWrite: boolean }
  pages: string[]
  data: {
    secKpi?: unknown
    nativeSecuritySummaryByYear?: Record<string, Record<string, { tiles: { key: string; value: number | string | null; status: string }[] }>>
  }
  versions: Record<string, { version: number; by: string }>
}

function fixture(collection: { secKpi?: unknown } = { secKpi: [] }, summaries = ["IT Security KPIs"]) {
  const snapshot = empty()
  snapshot.data = {
    ...collection,
    roleMap: ["admin", "domain leader", "contributor", "viewer"].reduce(
      (map, role) => plugGroup(map, "dashboard", role, `synthetic-${role}`),
      emptyMap(),
    ),
    summaries,
    access: { "synthetic-contributor": { assigned: ["Operations"] } },
    opsTickets: [],
    members: [{ name: "PRIVATE-MEMBER-SENTINEL" }],
    privateSecurityMetadata: "PRIVATE-SECURITY-METADATA-SENTINEL",
  }
  snapshot.versions = {
    "security:2026-03": { version: 3, by: "synthetic-editor" },
    "secActions:action-one": { version: 2, by: "synthetic-editor" },
    "secIncidents:incident-one": { version: 4, by: "synthetic-editor" },
    "secPhishing:campaign-one": { version: 5, by: "synthetic-editor" },
    "ops:2026-03": { version: 7, by: "synthetic-editor" },
    "ops-list:opsCats": { version: 8, by: "synthetic-editor" },
    "members:private": { version: 99, by: "PRIVATE-VERSION-SENTINEL" },
  }
  const storage = testPersistence({ dashboard: snapshot })
  const services: ModuleServices = {
    authenticate: async (request, context) => {
      if (!context) return null
      const token = request.headers.get("authorization")?.replace(/^Bearer /, "")
      const role = token === "readonly" ? "admin" : token
      if (!role || !["admin", "domain leader", "contributor", "viewer"].includes(role)) return null
      const principal = resolve(`synthetic-${role}`, context.roleMap.map((row) => ({ ...row })), (group) => group === `synthetic-${role}`)
      return token === "readonly" ? { ...principal, canWrite: false } : principal
    },
    persistence: storage.persistence,
    environment: async () => ({
      at: "2026-11-13T12:00:00Z",
      id: () => "synthetic-generated",
      directory: ["admin", "domain leader", "contributor", "viewer"].map((role) => ({ id: `synthetic-${role}`, name: `Synthetic ${role}` })),
    }),
    maxJsonBytes: 100000,
  }
  return { ...storage, handle: createNativeGateway("/api/sucafina", services) }
}

async function read(app: ReturnType<typeof fixture>, token = "admin", page = "IT Security KPIs", year = "2026", month = "3") {
  const response = await app.handle(new Request(`http://localhost:4111/api/sucafina/dashboard/state?${new URLSearchParams({ page, secYear: year, securityMonth: month })}`, {
    headers: { authorization: `Bearer ${token}` },
  }))
  expect(response?.status).toBe(200)
  const raw = await response!.text()
  expect(raw).not.toContain("PRIVATE-MEMBER-SENTINEL")
  expect(raw).not.toContain("PRIVATE-SECURITY-METADATA-SENTINEL")
  expect(raw).not.toContain("PRIVATE-VERSION-SENTINEL")
  return JSON.parse(raw) as State
}

test("authorized empty collection emits every year/month and exactly eight ordered No data tiles", async () => {
  const app = fixture()
  const before = structuredClone(app.state)
  const body = await read(app)
  const map = body.data.nativeSecuritySummaryByYear
  expect(map).toBeDefined()
  expect(Object.keys(map!)).toEqual(["2024", "2025", "2026", "2027"])
  for (const year of ["2024", "2025", "2026", "2027"]) {
    expect(Object.keys(map![year]!)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"])
    for (const month of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]) {
      expect(map![year]![month]).toEqual({ tiles: noData })
    }
  }
  expect(app.state).toEqual(before)
})

test("unsorted multi-year HTTP data carries latest valid values independently per KPI and never future/prior-year rows", async () => {
  const app = fixture({ secKpi: [
    { year: 2026, month: 4, training: 99, patch: 99, scan: 99 },
    { year: 2024, month: 12, training: 80 },
    { year: 2026, month: 3, training: "Infinity", patch: "94", patchEndpoint: "bad", patchServer: "93", scan: "abc" },
    { year: 2025, month: 2, training: 95 },
    { year: 2026, month: 1, training: 0, patch: "91", patchEndpoint: "80", patchServer: "70" },
    { year: 2027, month: 1, training: " 95 " },
    { year: 2026, month: 2, training: "", patch: "", patchEndpoint: "94", patchServer: "", scan: "96", assessment: "72", socPending: "5" },
  ] })
  const map = (await read(app)).data.nativeSecuritySummaryByYear!
  expect(map).toBeDefined()
  expect(map["2026"]!["3"]).toEqual({ tiles: [
    { key: "training", value: 0, status: "High risk" },
    { key: "patch", value: "94", status: "Moderate" },
    { key: "patchEndpoint", value: "94", status: "Moderate" },
    { key: "patchServer", value: "93", status: "Moderate" },
    { key: "scan", value: "96", status: "Good" },
    { key: "assessment", value: "72", status: "Moderate" },
    { key: "socPending", value: "5", status: "Moderate" },
    { key: "socClosure", value: null, status: "No data" },
  ] })
  expect(map["2024"]!["11"]).toEqual({ tiles: noData })
  expect(map["2024"]!["12"]!.tiles[0]).toEqual({ key: "training", value: 80, status: "Moderate" })
  expect(map["2025"]!["1"]).toEqual({ tiles: noData })
  expect(map["2025"]!["12"]!.tiles[0]).toEqual({ key: "training", value: 95, status: "Good" })
  expect(map["2026"]!["1"]!.tiles[0]).toEqual({ key: "training", value: 0, status: "High risk" })
  expect(map["2026"]!["4"]!.tiles[0]).toEqual({ key: "training", value: 99, status: "Good" })
  expect(map["2027"]!["1"]!.tiles[0]).toEqual({ key: "training", value: " 95 ", status: "Good" })
  expect((await read(app, "admin", "IT Security KPIs", "2027", "12")).data.nativeSecuritySummaryByYear).toEqual(map)
})

test("invalid periods and invalid values cannot hide earlier valid readings or synthesize zeros", async () => {
  const body = await read(fixture({ secKpi: [
    { year: 2026, month: 2, training: 81 },
    { year: "2026", month: 3, training: 99 },
    { year: 2026, month: "3", training: 99 },
    { year: 2026, month: 0, training: 99 },
    { year: 2026, month: 13, training: 99 },
    { year: 2026, month: 3.5, training: 99 },
    { year: 2026, month: null, training: 99 },
    { year: 2026, month: 3, training: " ", patch: Infinity, patchEndpoint: "NaN", patchServer: null, scan: "bad", assessment: false },
    { year: 2026, month: 4, patch: -Infinity, scan: "Infinity", assessment: {}, socClosure: " " },
  ] }))
  const map = body.data.nativeSecuritySummaryByYear!
  expect(map).toBeDefined()
  expect(map["2026"]!["12"]).toEqual({ tiles: [
    { key: "training", value: 81, status: "Moderate" },
    { key: "patch", value: null, status: "No data" },
    { key: "patchEndpoint", value: null, status: "No data" },
    { key: "patchServer", value: null, status: "No data" },
    { key: "scan", value: null, status: "No data" },
    { key: "assessment", value: null, status: "No data" },
    { key: "socPending", value: null, status: "No data" },
    { key: "socClosure", value: null, status: "No data" },
  ] })
})

test("SOC closure uses severity derivation, manual zero, and older valid fallback with exact statuses", async () => {
  const map = (await read(fixture({ secKpi: [
    { year: 2026, month: 5, socCritical: 2, socPending: 0, socClosure: 12 },
    { year: 2026, month: 1, socCritical: 1, socHigh: 2, socPending: 1, socClosure: 99 },
    { year: 2026, month: 2, socCritical: 0, socHigh: 0, socMedium: 0, socLow: 0, socClosure: 97 },
    { year: 2026, month: 3, socClosure: 0 },
    { year: 2026, month: 4, socClosure: "not numeric", socPending: "bad" },
    { year: 2026, month: 6, socClosure: " " },
  ] }))).data.nativeSecuritySummaryByYear!
  expect(map).toBeDefined()
  expect(map["2026"]!["1"]!.tiles.slice(6)).toEqual([
    { key: "socPending", value: 1, status: "Moderate" }, { key: "socClosure", value: 66.7, status: "High risk" },
  ])
  expect(map["2026"]!["2"]!.tiles[7]).toEqual({ key: "socClosure", value: 97, status: "Moderate" })
  expect(map["2026"]!["3"]!.tiles[7]).toEqual({ key: "socClosure", value: 0, status: "High risk" })
  expect(map["2026"]!["4"]!.tiles[7]).toEqual({ key: "socClosure", value: 0, status: "High risk" })
  expect(map["2026"]!["6"]!.tiles.slice(6)).toEqual([
    { key: "socPending", value: 0, status: "Good" }, { key: "socClosure", value: 100, status: "Good" },
  ])
})

test("existing permissive read roles and enabled viewer summary retain exact authorized version maps", async () => {
  const app = fixture()
  for (const token of ["admin", "domain leader", "contributor", "readonly", "viewer"]) {
    const body = await read(app, token)
    expect(body.data.nativeSecuritySummaryByYear?.["2026"]?.["3"]).toEqual({ tiles: noData })
    expect(body.actor.canWrite).toBe(token !== "readonly" && token !== "viewer")
    expect(body.pages).toContain("IT Security KPIs")
    expect(body.versions).toEqual({
      ...(token === "viewer" ? {} : {
        "ops:2026-03": { version: 7, by: "synthetic-editor" },
        "ops-list:opsCats": { version: 8, by: "synthetic-editor" },
      }),
      "security:2026-03": { version: 3, by: "synthetic-editor" },
      "secActions:action-one": { version: 2, by: "synthetic-editor" },
      "secIncidents:incident-one": { version: 4, by: "synthetic-editor" },
      "secPhishing:campaign-one": { version: 5, by: "synthetic-editor" },
    })
  }
})

test("viewer without security summary receives neither map, records, security versions nor private metadata", async () => {
  const app = fixture({ secKpi: [{ year: 2026, month: 3, training: 99, secret: "DENIED-SECURITY-SENTINEL" }] }, ["IT Operations"])
  const body = await read(app, "viewer", "IT Operations")
  expect(body.data).not.toHaveProperty("nativeSecuritySummaryByYear")
  expect(body.data).not.toHaveProperty("secKpi")
  expect(body.versions).toEqual({
    "ops:2026-03": { version: 7, by: "synthetic-editor" },
    "ops-list:opsCats": { version: 8, by: "synthetic-editor" },
  })
  expect(JSON.stringify(body)).not.toContain("DENIED-SECURITY-SENTINEL")
  const denied = await app.handle(new Request("http://localhost:4111/api/sucafina/dashboard/state?page=IT%20Security%20KPIs", { headers: { authorization: "Bearer viewer" } }))
  expect(denied?.status).toBe(403)
  expect(await denied!.text()).not.toContain("DENIED-SECURITY-SENTINEL")
})

test("authorized absent or malformed collections omit the map while valid arrays expose only tile fields", async () => {
  for (const collection of [{}, { secKpi: null }, { secKpi: {} }, { secKpi: "malformed" }]) {
    const body = await read(fixture(collection))
    expect(body.data).not.toHaveProperty("nativeSecuritySummaryByYear")
  }
  const body = await read(fixture({ secKpi: [{ year: 2026, month: 3, training: 95, extra: { marker: "ROW-EXTRA-SENTINEL" } }] }))
  const map = body.data.nativeSecuritySummaryByYear
  expect(map).toBeDefined()
  expect(map?.["2026"]?.["3"]?.tiles[0]).toEqual({ key: "training", value: 95, status: "Good" })
  expect(JSON.stringify(map)).not.toContain("ROW-EXTRA-SENTINEL")
  expect(JSON.stringify(map)).not.toContain("synthetic-editor")
})

test("all eight status boundaries use literal Good, Moderate and High risk oracles including numeric-string zero", async () => {
  const map = (await read(fixture({ secKpi: [
    { year: 2026, month: 1, training: 95, patch: 95, patchEndpoint: 95, patchServer: 95, scan: 95, assessment: 80, socPending: 0, socClosure: 100 },
    { year: 2026, month: 2, training: 80, patch: 70, patchEndpoint: 70, patchServer: 70, scan: 85, assessment: 70, socPending: 5, socClosure: 95 },
    { year: 2026, month: 3, training: 79, patch: "0", patchEndpoint: 69, patchServer: 69, scan: 84, assessment: 69, socPending: 6, socClosure: 94 },
  ] }))).data.nativeSecuritySummaryByYear!
  expect(map).toBeDefined()
  expect(map["2026"]!["1"]).toEqual({ tiles: [
    { key: "training", value: 95, status: "Good" },
    { key: "patch", value: 95, status: "Good" },
    { key: "patchEndpoint", value: 95, status: "Good" },
    { key: "patchServer", value: 95, status: "Good" },
    { key: "scan", value: 95, status: "Good" },
    { key: "assessment", value: 80, status: "Good" },
    { key: "socPending", value: 0, status: "Good" },
    { key: "socClosure", value: 100, status: "Good" },
  ] })
  expect(map["2026"]!["2"]).toEqual({ tiles: [
    { key: "training", value: 80, status: "Moderate" },
    { key: "patch", value: 70, status: "Moderate" },
    { key: "patchEndpoint", value: 70, status: "Moderate" },
    { key: "patchServer", value: 70, status: "Moderate" },
    { key: "scan", value: 85, status: "Moderate" },
    { key: "assessment", value: 70, status: "Moderate" },
    { key: "socPending", value: 5, status: "Moderate" },
    { key: "socClosure", value: 95, status: "Moderate" },
  ] })
  expect(map["2026"]!["3"]).toEqual({ tiles: [
    { key: "training", value: 79, status: "High risk" },
    { key: "patch", value: "0", status: "High risk" },
    { key: "patchEndpoint", value: 69, status: "High risk" },
    { key: "patchServer", value: 69, status: "High risk" },
    { key: "scan", value: 84, status: "High risk" },
    { key: "assessment", value: 69, status: "High risk" },
    { key: "socPending", value: 6, status: "High risk" },
    { key: "socClosure", value: 94, status: "High risk" },
  ] })
})
