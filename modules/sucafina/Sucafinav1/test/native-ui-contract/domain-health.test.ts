import { expect, test } from "bun:test"
import path from "node:path"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import { observeSfDomainHealth } from "../../../../../apps/cli/src/sucafina-product/native-ui/domain-health.ts"
import { createSfDomainProjectionHandlers } from "../../../../../apps/cli/src/sucafina-product/native-ui/domain.ts"
import { createSfPeopleProjectionHandlers } from "../../../../../apps/cli/src/sucafina-product/native-ui/people.ts"
import { createSfOperationsProjectionHandlers } from "../../../../../apps/cli/src/sucafina-product/native-ui/operations.ts"
import { createSfProcurementProjectionHandlers } from "../../../../../apps/cli/src/sucafina-product/native-ui/procurement.ts"
import { contributions } from "../../index.ts"
import { openLocalStore } from "../../runtime/local-store.ts"
import { createSfSourcePersistence } from "../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../product/integration/source-projections.ts"

const stamp = Object.freeze({ installationId: "installation", projectId: "project", hostId: "host",
  principalRef: "person", policyVersion: "policy", accessRevision: "revision" })

test("page health uses mounted sources and original actor without private member reads or writes", async () => {
  const dir = await mkdtemp(path.join(await realpath(tmpdir()), "sf-domain-health-"))
  const driver = await openLocalStore(path.join(dir, "business"))
  const store = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources,
    createId: () => crypto.randomUUID(), projectScope: createSfSourceScopeProjector(() => new Date().toISOString()) })
  try {
    await store.initializeSources("dashboard")
    await store.initializeSources("procurement")
    await store.transaction("dashboard", async (snapshot) => { snapshot.data.members = [{ id: "private" }]; return { commit: true, value: null } })
    const original = new Request("http://localhost/sucafina/api/ui/context")
    let principal = "person"
    let enabled = true
    let privateReads = 0
    const persistence = { ...store, transaction: async (...args: Parameters<typeof store.transaction>) => store.transaction(args[0], async (snapshot, control) => {
      if (args[0] === "dashboard" && Array.isArray(snapshot.data.members))
        Object.defineProperty(snapshot.data.members, "0", { enumerable: true, configurable: true, get: () => { privateReads++; throw new Error("private row read") } })
      return args[1](snapshot, control)
    }, args[2]) }
    const application = { persistence, domains: contributions,
      authenticate: async (request: Request, options: { surface: "dashboard" | "procurement" }) => {
        expect(request).toBe(original)
        return enabled ? { id: principal, canWrite: true, roles: [{ surface: options.surface, role: "admin" }] } : null
      }, environment: async (request: Request) => {
        expect(request).toBe(original)
        return { at: "2026-01-01T00:00:00Z", id: () => "id", directory: [] }
      } }
    const deps = { application, runtime: () => undefined, readContext: async () => { throw new Error("recursive context") } }
    const handlers = [...createSfDomainProjectionHandlers(deps as never), ...createSfPeopleProjectionHandlers(deps as never),
      ...createSfOperationsProjectionHandlers(deps as never), ...createSfProcurementProjectionHandlers(deps as never)]
    const before = await store.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    const observed = await observeSfDomainHealth(deps as never, handlers, original, stamp)
    const ids = observed.map((entry) => entry.operationId)
    expect(ids).toContain("domain.page.CAP01")
    expect(ids).toContain("domain.page.CAP08")
    expect(ids).toContain("domain.page.CAP24")
    expect(ids).toContain("domain.page.CAP11")
    expect(ids).toContain("domain.page.CAP12")
    expect(ids).not.toContain("domain.page.CAP25")
    if (Object.hasOwn(SfOperationRegistry, "files.export.members")) expect(ids.some((id) => String(id) === "files.export.members")).toBe(true)
    expect(privateReads).toBe(0)
    expect(await store.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot }))).toEqual(before)
    principal = "other"
    expect(await observeSfDomainHealth(deps as never, handlers, original, stamp)).toEqual([])
    principal = "person"
    enabled = false
    expect(await observeSfDomainHealth(deps as never, handlers, original, stamp)).toEqual([])
    enabled = true
    expect((await observeSfDomainHealth(deps as never, [], original, stamp))
      .filter((entry) => entry.operationId.startsWith("domain.page."))).toEqual([])
  } finally { await driver.dispose(); await rm(dir, { recursive: true, force: true }) }
})
