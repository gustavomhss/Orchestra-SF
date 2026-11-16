import { expect, test } from "bun:test"
import path from "node:path"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { observeSfDashboardPages } from "../../../../../apps/cli/src/sucafina-product/native-ui/dashboard-operational.ts"
import { createSfDomainProjectionHandlers } from "../../../../../apps/cli/src/sucafina-product/native-ui/domain.ts"
import { contributions } from "../../index.ts"
import { openLocalStore } from "../../runtime/local-store.ts"
import { createSfSourcePersistence } from "../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../product/integration/source-projections.ts"

const stamp = Object.freeze({ installationId: "installation", projectId: "project", hostId: "host",
  principalRef: "person", policyVersion: "policy", accessRevision: "revision" })

test("Portfolio readiness uses the mounted real view, actor ACL and unchanged read-only source", async () => {
  const dir = await mkdtemp(path.join(await realpath(tmpdir()), "sf-dashboard-probe-"))
  const driver = await openLocalStore(path.join(dir, "business"))
  const store = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources,
    createId: () => crypto.randomUUID(), projectScope: createSfSourceScopeProjector(() => new Date().toISOString()) })
  try {
    await store.initializeSources("dashboard")
    await store.transaction("dashboard", async (snapshot) => {
      Object.assign(snapshot.data, { projects: [], risks: [], contracts: [], stakeholders: [], itperf: { items: [] } })
      return { commit: true, value: null }
    })
    const original = new Request("http://localhost/sucafina/api/ui/context")
    let expectedRequest = original
    let actor = "person"
    let permitted = true
    const application = { persistence: store, domains: contributions,
      authenticate: async (request: Request) => {
        expect(request).toBe(expectedRequest)
        return { id: actor, canWrite: true, roles: permitted ? [{ surface: "dashboard" as const, role: "admin" }] : [] }
      }, environment: async (request: Request) => {
        expect(request).toBe(expectedRequest)
        return { at: "2026-01-01T00:00:00.000Z", id: () => "id", directory: [] }
      } }
    const before = await store.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    const actual = await observeSfDashboardPages(application as never, original, stamp)
    expect(actual.map((entry) => entry.operationId)).toContain("domain.page.CAP09")
    expect(actual.map((entry) => entry.operationId)).toContain("domain.page.CAP10")
    const after = await store.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    expect(after).toEqual(before)
    const pages = { CAP09: "Portfolio Dashboard", CAP10: "All Projects", CAP13: "IT Risks", CAP14: "Vendor Contracts",
      CAP15: "Stakeholder Management", CAP16: "IT Performance Contract" } as const
    const destinations = Object.entries(pages).map(([capabilityId, page]) => ({ capabilityId, page, surface: "dashboard", canRead: true, allowedActionIds: [] }))
    const handlers = createSfDomainProjectionHandlers({ origin: "http://localhost", mount: "/sucafina", application,
      readContext: async () => ({ status: "ok", value: { stamp, destinations } }) } as never)
    for (const entry of actual) {
      const cap = entry.operationId.slice("domain.page.".length)
      expectedRequest = new Request(`http://localhost/sucafina/api/ui/pages/${cap}`)
      const response = await handlers.find((handler) => handler.operationId === entry.operationId)!.handle(expectedRequest)
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ status: "ok", context: stamp, value: { capabilityId: cap, allowedActionIds: [] } })
    }
    expectedRequest = original
    actor = "other"
    expect(await observeSfDashboardPages(application as never, original, stamp)).toEqual([])
    actor = "person"
    permitted = false
    expect(await observeSfDashboardPages(application as never, original, stamp)).toEqual([])
    permitted = true
    expect(await observeSfDashboardPages({ ...application, domains: { ...contributions, dashboard: [] } } as never, original, stamp)).toEqual([])
  } finally {
    await driver.dispose()
    await rm(dir, { recursive: true, force: true })
  }
})
