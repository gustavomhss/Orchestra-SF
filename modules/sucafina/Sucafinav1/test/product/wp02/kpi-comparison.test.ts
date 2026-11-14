import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { resolve } from "../../../src/identity.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createDashboardSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createDashboardSourceHost, dashboardMetricSelector } from "../../../product/dashboard/sources.ts"
import { createDashboardPort } from "../../../product/dashboard/port.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

test("KPI comparison reauthorizes both registered metrics and keeps separate evidence", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-kpi-comparison-"))
  const store = await openLocalStore(directory)
  try {
    const at = "2026-11-13T00:00:00Z"
    const period = { start: "2026-01-01", end: "2026-12-31" }
    const binding = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "admin", requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedDomainContext
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) })
    await persistence.initializeSources("dashboard")
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "admin" }]; snapshot.data.members = [{ id: "m", status: "Active" }]; return { commit: true, value: undefined } })
    const host: DomainPortHost = { persistence, authenticate: async (_request, context) => resolve("admin", [...context!.roleMap], (group) => group === "admins"), environment: async () => ({ at, id: randomUUID, directory: [] }), requestFor: () => new Request("https://example.test"), revalidate: async () => true }
    const sources = createDashboardSourceHost({ host, scopedSources: persistence })
    const issued = await createDashboardSourceIssuer({ host, scopedSources: persistence })({ page: "Executive Dashboard", fields: ["executive"], period }, binding)
    expect(issued.status).toBe("ok")
    if (issued.status !== "ok") return
    const metric = dashboardMetricSelector(issued.value.selectionRef, "active-headcount")
    const port = createDashboardPort({ host, sources })
    const result = await port.explain({ metricRef: metric, comparisonRef: metric, period }, binding)
    expect(result.status).toBe("ok")
    if (result.status === "ok") expect(result.value).toMatchObject({ comparison: { metricRef: metric, comparisonRef: metric, context: { period }, values: [expect.objectContaining({ id: "executive.active" })] } })
    const budget = await createDashboardSourceIssuer({ host, scopedSources: persistence })({ page: "Budget Overview", fields: ["budgetMetrics"], period }, binding)
    expect(budget.status).toBe("ok")
    if (budget.status === "ok") expect(await port.explain({ metricRef: metric, comparisonRef: dashboardMetricSelector(budget.value.selectionRef, "total-budget"), period }, binding)).toMatchObject({ status: "unavailable", reason: "incompatible-comparison-metric" })
    expect((await port.explain({ metricRef: metric, comparisonRef: "invalid", period }, binding)).status).not.toBe("ok")
    expect(await port.explain({ metricRef: metric, comparisonRef: "", period }, binding)).toMatchObject({ status: "needs-input", reason: "comparison-reference-required" })
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.roleMap = []; return { commit: true, value: undefined } })
    expect((await port.explain({ metricRef: metric, comparisonRef: metric, period }, binding)).status).not.toBe("ok")
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
