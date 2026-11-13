import { expect, test } from "bun:test"
import { createDashboardPort } from "../../../product/dashboard/port.ts"
import { createDashboardSourceHost, dashboardMetricSelector, dashboardSourceSelector } from "../../../product/dashboard/sources.ts"
import { projectDashboardScope } from "../../../product/dashboard/scope.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import { resolve } from "../../../src/identity.ts"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"

const period = { start: "2026-01-01", end: "2026-12-31" }
const binding = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "admin", requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedDomainContext

test("scoped source binds fields, period and current authenticated authority", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "dashboard-source-"))
  const store = await openLocalStore(directory)
  try {
  const actor = { id: "admin", roles: ["admin"], canWrite: true, assigned: [], domains: [] }
  const selector = { page: "Budget Overview", fields: ["budgetMetrics"], period, actor }
  const scope = { principalRef: "admin", accessRevision: "1", policyVersion: "1", recordType: "dashboard-page", recordId: selector.page, selector }
  const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: (_surface, snapshot) => projectDashboardScope(snapshot, actor, selector, "2026-11-13T00:00:00Z") })
  await persistence.initializeSources("dashboard")
  await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "admin" }]; snapshot.data.opexOwners = [{ id: "o", budget: 1200 }]; snapshot.data.opexEntries = []; return { commit: true, value: undefined } })
  const issued = await persistence.readScopedSource("dashboard", scope, async () => true)
  expect(issued).toBeDefined()
  if (!issued) return
  const access = { enabled: true }
  const host: DomainPortHost = { persistence, authenticate: async (_request, context) => resolve("admin", [...context!.roleMap], (group) => group === "admins"), environment: async () => ({ at: "2026-11-13T00:00:00Z", id: () => "unused", directory: [] }), requestFor: () => new Request("https://example.test"), revalidate: async () => access.enabled }
  const sources = createDashboardSourceHost({ host, scopedSources: persistence })
  const selection = dashboardSourceSelector(issued.incarnation, issued.version)
  const port = createDashboardPort({ host, sources })
  expect(await port.read({ selectionRef: selection, period, fields: ["budgetMetrics"] }, binding)).toMatchObject({ status: "ok" })
  expect(await port.explain({ metricRef: dashboardMetricSelector(selection, "total-budget"), period }, binding)).toMatchObject({ status: "ok" })
  expect(await port.read({ selectionRef: selection, period, fields: ["opexEntries"] }, binding)).toMatchObject({ status: "denied" })
  await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.members = [{ id: "private", notes: "changed" }]; return { commit: true, value: undefined } })
  expect(await sources.resolveDashboardSource(selection, binding)).toMatchObject({ status: "ok" })
  await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.opexOwners = [{ id: "o", budget: 1300 }]; return { commit: true, value: undefined } })
  await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.opexOwners = [{ id: "o", budget: 1200 }]; return { commit: true, value: undefined } })
  expect(await sources.resolveDashboardSource(selection, binding)).toMatchObject({ status: "stale" })
  const revised = await persistence.readScopedSource("dashboard", scope, async () => true)
  expect(revised).toMatchObject({ incarnation: issued.incarnation, version: issued.version + 2 })
  const reopened = await openLocalStore(directory)
  try {
    const reloaded = createSfSourcePersistence({ persistence: reopened, createId: randomUUID, enumerate: enumerateSfSources, projectScope: (_surface, snapshot) => projectDashboardScope(snapshot, actor, selector, "2026-11-13T00:00:00Z") })
    await reloaded.initializeSources("dashboard")
    expect(await reloaded.readScopedSource("dashboard", scope, async () => true)).toMatchObject({ incarnation: issued.incarnation, version: issued.version + 2 })
  } finally { await reopened.dispose() }

  await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.roleMap = []; return { commit: true, value: undefined } })
  expect(await sources.resolveDashboardSource(selection, binding)).toMatchObject({ status: "denied" })
  access.enabled = false
  expect(await sources.resolveDashboardSource(selection, binding)).toMatchObject({ status: "denied" })
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
