import { expect, test } from "bun:test"
import { createDashboardPort } from "../../../product/dashboard/port.ts"
import { createDashboardSourceHost, dashboardMetricSelector, dashboardSourceSelector } from "../../../product/dashboard/sources.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import { resolve } from "../../../src/identity.ts"
import { testPersistence } from "../../fixture/persistence.ts"

const period = { start: "2026-01-01", end: "2026-12-31" }
const binding = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "admin", requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedDomainContext

test("source host binds registry incarnation, authorized projection and metric", async () => {
  const storage = testPersistence({ dashboard: { data: { roleMap: [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "admin" }], opexOwners: [{ id: "o", budget: 1200 }], opexEntries: [] }, versions: {}, sequences: {}, audit: [], notices: [], sfSources: { schemaVersion: 1, records: { [JSON.stringify(["dashboard-page", "Budget Overview"])]: { incarnation: "inc", version: 1, alive: true, inputDigest: "a".repeat(64) } } } } })
  const access = { enabled: true }
  const host: DomainPortHost = { persistence: storage.persistence, authenticate: async (_request, context) => resolve("admin", [...context!.roleMap], (group) => group === "admins"), environment: async () => ({ at: "2026-11-13T00:00:00Z", id: () => "unused", directory: [] }), requestFor: () => new Request("https://example.test"), revalidate: async () => access.enabled }
  const sources = createDashboardSourceHost(host)
  const selection = dashboardSourceSelector("Budget Overview", "inc", 1, 2026)
  const port = createDashboardPort({ host, sources })
  expect(await port.read({ selectionRef: selection, period, fields: ["budgetMetrics"] }, binding)).toMatchObject({ status: "ok" })
  expect(await port.explain({ metricRef: dashboardMetricSelector(selection, "total-budget"), period }, binding)).toMatchObject({ status: "ok" })
  storage.state.dashboard.sfSources!.records[JSON.stringify(["dashboard-page", "Executive Dashboard"])] = { incarnation: "exec", version: 1, alive: true, inputDigest: "b".repeat(64) }
  const executive = dashboardSourceSelector("Executive Dashboard", "exec", 1, 2026)
  const ticket = await port.explain({ metricRef: dashboardMetricSelector(executive, "opened:02"), period }, binding)
  expect(ticket.status).toBe("ok")
  if (ticket.status === "ok") expect(ticket.value.values).toContainEqual(expect.objectContaining({ id: "executiveMonths.2026:2.opened", value: null, period: { start: "2026-02-01", end: "2026-02-28" }, evidenceState: "absent" }))
  const roleMap = structuredClone(storage.state.dashboard.data.roleMap)
  storage.state.dashboard.data.roleMap = []
  expect(await sources.resolveDashboardSource(selection, binding)).toMatchObject({ status: "denied" })
  storage.state.dashboard.data.roleMap = roleMap
  const identity = storage.state.dashboard.sfSources!.records[JSON.stringify(["dashboard-page", "Budget Overview"])]!
  identity.incarnation = "replacement"
  expect(await port.read({ selectionRef: selection, period, fields: ["budgetMetrics"] }, binding)).toMatchObject({ status: "stale" })
  access.enabled = false
  expect(await sources.resolveDashboardSource(selection, binding)).toMatchObject({ status: "denied" })
})
