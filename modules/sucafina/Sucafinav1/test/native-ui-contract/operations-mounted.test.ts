import { expect, test } from "bun:test"
import path from "node:path"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { createSfOperationsProjectionHandlers } from "../../../../../apps/cli/src/sucafina-product/native-ui/operations.ts"
import { contributions } from "../../index.ts"
import { openLocalStore } from "../../runtime/local-store.ts"
import { createSfSourcePersistence } from "../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../product/integration/source-projections.ts"

const stamp = Object.freeze({ installationId: "installation", projectId: "project", hostId: "host",
  principalRef: "person", policyVersion: "policy", accessRevision: "revision" })

test("mounted operations pages use real source views and fence actor, stamp and versions", async () => {
  const dir = await mkdtemp(path.join(await realpath(tmpdir()), "sf-operations-mounted-"))
  const driver = await openLocalStore(path.join(dir, "business"))
  const store = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources,
    createId: () => crypto.randomUUID(), projectScope: createSfSourceScopeProjector(() => new Date().toISOString()) })
  try {
    await store.initializeSources("dashboard")
    await store.transaction("dashboard", async (snapshot) => {
      snapshot.data.opsCats = ["IT Operations"]
      snapshot.data.opsTickets = [{ year: 2026, month: 11, "IT Operations|Incidents|Open": 5, "IT Operations|Incidents|Closed": 2 }]
      snapshot.data.secKpi = [{ year: 2026, month: 11, training: 80 }]
      snapshot.versions["ops:2026-11"] = { version: 2, by: "person" }
      snapshot.versions["security:2026-11"] = { version: 3, by: "person" }
      return { commit: true, value: null }
    })
    const destinations = [{ capabilityId: "CAP11", surface: "dashboard", page: "IT Operations", canRead: true, allowedActionIds: [] },
      { capabilityId: "CAP12", surface: "dashboard", page: "IT Security KPIs", canRead: true, allowedActionIds: [] }]
    let role = "admin"
    let actor = "person"
    let revoke = false
    let stale = false
    let corrupt = false
    let reads = 0
    let contexts = 0
    let original = new Request("http://localhost/")
    const persistence = { ...store, transaction: async (...args: Parameters<typeof store.transaction>) => store.transaction(args[0], async (snapshot) => {
      reads++
      if (stale && reads === 2) snapshot.versions["ops:2026-11"] = { version: 99, by: "other" }
      if (corrupt) snapshot.data.opsTickets = "invalid"
      return args[1](snapshot)
    }, args[2]) }
    const application = { persistence, domains: contributions,
      authenticate: async (request: Request) => {
        expect(request).toBe(original)
        return { id: actor, canWrite: true, roles: [{ surface: "dashboard" as const, role }] }
      }, environment: async (request: Request) => {
        expect(request).toBe(original)
        return { at: "2026-11-15T00:00:00Z", id: () => "id", directory: [] }
      } }
    const deps = { origin: "http://localhost", mount: "/sucafina", application,
      readContext: async (request: Request) => {
        expect(request).toBe(original)
        contexts++
        return { status: "ok", value: { stamp: revoke && contexts > 1 ? { ...stamp, accessRevision: "revoked" } : stamp, destinations } }
      } }
    const handlers = createSfOperationsProjectionHandlers(deps as never)
    const call = async (cap: "CAP11" | "CAP12", query = "") => {
      reads = 0
      contexts = 0
      original = new Request(`http://localhost/sucafina/api/ui/pages/${cap}${query}`)
      return handlers.find((item) => item.operationId === `domain.page.${cap}`)!.handle(original)
    }
    const ops = await call("CAP11", "?opsYear=2026&operationsMonth=11")
    expect(ops.status).toBe(200)
    expect(await ops.json()).toMatchObject({ status: "ok", value: { selection: { year: 2026, month: 11 }, versions: { "ops:2026-11": 2 },
      data: { opsTickets: [{ "IT Operations|Incidents|Open": 5 }] } } })
    const security = await call("CAP12", "?secYear=2026&securityMonth=11")
    expect(security.status).toBe(200)
    expect(await security.json()).toMatchObject({ status: "ok", value: { versions: { "security:2026-11": 3 }, data: { secKpi: [{ training: 80 }] } } })
    expect((await call("CAP11", "?secYear=2026")).status).toBe(400)
    expect((await call("CAP11", "?month=13")).status).toBe(400)
    actor = "other"
    expect((await call("CAP11")).status).toBe(403)
    actor = "person"
    role = "unrelated"
    expect((await call("CAP11")).status).toBe(403)
    role = "admin"
    revoke = true
    expect((await call("CAP11")).status).toBe(409)
    revoke = false
    stale = true
    expect((await call("CAP11")).status).toBe(409)
    stale = false
    corrupt = true
    expect((await call("CAP11")).status).toBe(503)
  } finally { await driver.dispose(); await rm(dir, { recursive: true, force: true }) }
})
