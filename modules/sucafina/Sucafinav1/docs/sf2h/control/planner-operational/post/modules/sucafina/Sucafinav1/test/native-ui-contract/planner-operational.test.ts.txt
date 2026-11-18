import { expect, test } from "bun:test"
import path from "node:path"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { observeSfPlannerPages } from "../../../../../apps/cli/src/sucafina-product/native-ui/planner.ts"
import { openLocalStore } from "../../runtime/local-store.ts"
import { createSfSourcePersistence } from "../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../product/integration/source-projections.ts"

const stamp = Object.freeze({ installationId: "installation", projectId: "project", hostId: "host",
  principalRef: "person", policyVersion: "policy", accessRevision: "revision" })

test("mounted Planner producer observes real views without writing and requires the current actor", async () => {
  const dir = await mkdtemp(path.join(await realpath(tmpdir()), "sf-planner-probe-"))
  const driver = await openLocalStore(path.join(dir, "business"))
  const store = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources,
    createId: () => crypto.randomUUID(), projectScope: createSfSourceScopeProjector(() => new Date().toISOString()) })
  try {
    await store.initializeSources("planner")
    const original = new Request("http://localhost/sucafina/api/ui/context")
    let actor = "person"
    const application = {
      persistence: store,
      authenticate: async (request: Request) => {
        expect(request).toBe(original)
        return { id: actor, canWrite: true, roles: [{ surface: "planner" as const, role: "admin" }] }
      },
      environment: async (request: Request) => {
        expect(request).toBe(original)
        return { at: "2026-01-01T00:00:00.000Z", id: () => "id", directory: [] }
      },
    }
    const before = await store.transaction("planner", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    const actual = await observeSfPlannerPages(application as never, original, stamp)
    expect(actual.map((entry) => entry.operationId)).toEqual(["domain.page.CAP17", "domain.page.CAP23"])
    const after = await store.transaction("planner", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    expect(after).toEqual(before)
    actor = "revoked-person"
    expect(await observeSfPlannerPages(application as never, original, stamp)).toEqual([])
  } finally {
    await driver.dispose()
    await rm(dir, { recursive: true, force: true })
  }
})

test("failed environment produces no positive observation", async () => {
  const application = { environment: async () => { throw new Error("environment unavailable") } }
  await expect(observeSfPlannerPages(application as never, new Request("http://localhost/"), stamp)).rejects.toThrow()
})
