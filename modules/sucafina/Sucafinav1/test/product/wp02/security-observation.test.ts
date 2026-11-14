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
import { createDashboardSourceHost } from "../../../product/dashboard/sources.ts"
import { createDashboardPort } from "../../../product/dashboard/port.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

test("security state is a current observation and cannot be reissued as historical data", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-security-observation-"))
  const store = await openLocalStore(directory)
  try {
    const clock = { at: "2026-11-13T00:00:00Z" }
    const period = { start: "2026-01-01", end: "2026-12-31" }
    const historical = { start: "2024-01-01", end: "2024-12-31" }
    const binding = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "admin", requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedDomainContext
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => clock.at) })
    await persistence.initializeSources("dashboard")
    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "admin" }]
      snapshot.data.secActions = [{ id: "action", text: "Review access", done: false }]
      snapshot.data.secIncidents = [{ id: "incident", title: "Current investigation", date: "2026-09-03", contained: false }]
      snapshot.data.secPhishing = [{ id: "campaign", name: "Current campaign", start: "2026-10-01", targeted: 100 }]
      snapshot.data.secKpi = [{ id: "historical-kpi", year: 2024, month: 1, training: 95 }]
      return { commit: true, value: undefined }
    })
    const host: DomainPortHost = { persistence, authenticate: async (_request, context) => resolve("admin", [...context!.roleMap], (group) => group === "admins"), environment: async () => ({ at: clock.at, id: randomUUID, directory: [] }), requestFor: () => new Request("https://example.test"), revalidate: async () => true }
    const issuer = createDashboardSourceIssuer({ host, scopedSources: persistence })
    const dashboard = createDashboardPort({ host, sources: createDashboardSourceHost({ host, scopedSources: persistence }) })
    const historicalKpi = await issuer({ page: "IT Security KPIs", fields: ["secKpi"], period: historical }, binding)
    expect(historicalKpi.status).toBe("ok")
    if (historicalKpi.status !== "ok") throw new Error("Expected dated security KPI source")
    const historicalRead = await dashboard.read({ selectionRef: historicalKpi.value.selectionRef, fields: ["secKpi"], period: historical }, binding)
    expect(historicalRead.status).toBe("ok")
    if (historicalRead.status === "ok") expect(historicalRead.value.values).toContainEqual(expect.objectContaining({ id: "secKpi[id:historical-kpi].training", value: 95, period: { start: "2024-01-01", end: "2024-01-31" }, granularity: "month" }))
    const references: { field: string; selectionRef: string }[] = []
    for (const field of ["secActions", "secIncidents", "secPhishing"]) {
      expect((await issuer({ page: "IT Security KPIs", fields: [field], period: historical }, binding)).status).not.toBe("ok")
      const source = await issuer({ page: "IT Security KPIs", fields: [field], period }, binding)
      expect(source.status).toBe("ok")
      if (source.status !== "ok") throw new Error("Expected current security source")
      const result = await dashboard.read({ selectionRef: source.value.selectionRef, fields: [field], period }, binding)
      expect(result.status).toBe("ok")
      if (result.status !== "ok") throw new Error("Expected current security projection")
      expect(result.value.values.length).toBeGreaterThan(1)
      if (field === "secActions") expect(result.value.values).toContainEqual(expect.objectContaining({ id: "secActions[id:action].text", value: "Review access" }))
      if (field === "secIncidents") expect(result.value.values).toContainEqual(expect.objectContaining({ id: "secIncidents[id:incident].contained", value: false }))
      if (field === "secPhishing") expect(result.value.values).toContainEqual(expect.objectContaining({ id: "secPhishing[id:campaign].targeted", value: 100 }))
      expect(result.value.values.every((value) => value.period.start === "2026-11-13" && value.period.end === "2026-11-13" && value.granularity === "record")).toBe(true)
      references.push({ field, selectionRef: source.value.selectionRef })
    }
    clock.at = "2026-11-14T00:00:00Z"
    for (const reference of references) {
      expect((await dashboard.read({ selectionRef: reference.selectionRef, fields: [reference.field], period }, binding)).status).not.toBe("ok")
      const source = await issuer({ page: "IT Security KPIs", fields: [reference.field], period }, binding)
      expect(source.status).toBe("ok")
      if (source.status !== "ok") throw new Error("Expected freshly observed source")
      expect(source.value.selectionRef).not.toBe(reference.selectionRef)
      const result = await dashboard.read({ selectionRef: source.value.selectionRef, fields: [reference.field], period }, binding)
      expect(result.status).toBe("ok")
      if (result.status === "ok") expect(result.value.values.every((value) => value.period.start === "2026-11-14" && value.period.end === "2026-11-14")).toBe(true)
    }
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
