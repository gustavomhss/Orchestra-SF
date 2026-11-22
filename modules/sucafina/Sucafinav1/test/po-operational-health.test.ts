import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { AbsolutePath } from "@orchestra/core/schema"
import { createModule } from "../index.ts"
import { openLocalStore } from "../runtime/local-store.ts"
import { resolve } from "../src/identity.ts"
import type { RoleRow } from "../src/identity.ts"
import { createSfProductAuthority } from "../product/integration/product-authority.ts"
import { initializeAbsentSfProductState } from "../product/host-binding/state-provider.ts"
import { createSfSourcePersistence } from "../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../product/integration/source-projections.ts"
import { mountSfFilesOriginalRoutes } from "../runtime/native-files/routing.ts"
import { createSfLiveContext, sfContextDestinationsFromPages, sfHasOperationalResource } from "../../../../apps/cli/src/sucafina-product/native-ui/live-context.ts"

const at = "2026-11-22T00:00:00.000Z"
const origin = "https://po.example"
type Change = "none" | "recipient" | "missing" | "access" | "source"

/** Original SQLite, authority, Files router, application and PO renderer.
 * Authentication, directory and scheduled faults are explicit fixture inputs.
 * This is product composition proof, not an installed Microsoft/Teams qualification. */
async function fixture(change: Change = "none") {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-po-health-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const original = createSfSourcePersistence({ persistence: store, createId: randomUUID,
    enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) })
  for (const surface of ["dashboard", "planner", "procurement"] as const) await original.initializeSources(surface)
  const roles: RoleRow[] = [{ surface: "procurement", role: "requester", entra: "people", version: 1, by: "fixture" }]
  const records = {
    settings: { currency: "USD" },
    requests: { request1: { version: 1, request: {
      id: "request1", number: 41, createdBy: "po-owner", status: "po_issued",
      ...(change === "missing" ? {} : { po: {
        number: "PO-00041", description: "Authorized purchase order", currency: "USD",
        supplier: "Supplier <private>", issuedAt: at,
        lines: [{ desc: "Selected item", qty: 2, uom: "ea", unitPrice: 25 }],
      } }),
    } } },
  }
  await original.transaction("procurement", async (snapshot) => {
    snapshot.data.store = structuredClone(records)
    snapshot.data.roleMap = roles
    snapshot.versions.store = { version: 1, by: "fixture" }
    return { commit: true, value: undefined }
  })
  const gate = { allowed: true, installed: true, exporting: false, transactions: 0,
    exportCommits: 0, producerCalls: 0, admissions: 0, originalRequests: [] as Request[] }
  const persistence: typeof original = { ...original,
    async transaction(surface, work, options) {
      if (gate.exporting) {
        gate.transactions += 1
        if (change === "source" && gate.transactions === 2) await original.transaction("procurement", async (snapshot) => {
          snapshot.data.store = { ...structuredClone(records), settings: { currency: "EUR" } }
          snapshot.versions.store = { version: 2, by: "source-change" }
          return { commit: true, value: undefined }
        })
      }
      return original.transaction(surface, async (snapshot, blobs) => {
        const result = await work(snapshot, blobs)
        if (gate.exporting && result.commit) gate.exportCommits += 1
        return result
      }, options)
    },
  }
  await initializeAbsentSfProductState(persistence, randomUUID)
  const people = [{ id: "po-owner", name: "PO owner" }, { id: "another-person", name: "Another person" }]
  const authenticate: Parameters<typeof createSfProductAuthority>[0]["authenticate"] = async (request, context) => {
    if (!gate.allowed || change === "access" && gate.exporting && gate.transactions > 1) return null
    const id = request.headers.get("x-fixture-actor")
    return context && id && people.some((person) => person.id === id) ? resolve(id, [...context.roleMap], (group) => group === "people") : null
  }
  const environment = async () => ({ at, id: randomUUID, directory: people })
  const identity = { installationId: "po-installation", projectId: "po-project", hostId: "po-host",
    location: { directory: AbsolutePath.make(directory) } }
  const authority = createSfProductAuthority({
    identity: () => identity, installationId: identity.installationId, origin, policyVersion: "po-policy",
    persistence, authenticate, environment,
    grants: people.map((person) => ({ principalRef: person.id, namespaces: ["preferences"] as const,
      operations: ["sf_work_list", "sf_request_read"], humanActions: [] })),
    createId: randomUUID, now: () => Date.parse(at), commandIdentity: async () => randomUUID(),
    inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false,
    providerGeneration: async () => undefined, authorizeDocument: async () => undefined,
  })
  const services = { persistence, authenticate, environment, maxJsonBytes: 65_536,
    product: async (request: Request) => {
      gate.exporting = true
      gate.producerCalls += 1
      gate.originalRequests.push(request)
      return undefined
    },
  }
  const business = createModule("/sf", services)
  const bindings = { application: business }
  const routes = mountSfFilesOriginalRoutes({ origin, mount: "/sf", sources: bindings })
  const source = { routes, authority }
  const input = { source: () => gate.installed ? source : undefined }
  const request = (actor = "po-owner", signal?: AbortSignal) => new Request(
    origin + "/sf/api/ui/context?installationId=po-installation&projectId=po-project&hostId=po-host",
    { headers: { "x-fixture-actor": actor }, signal })
  const originalAdmission = authority.readContextAdmission
  const admitted = await originalAdmission(request())
  if (admitted.status !== "ok") throw new Error("Original PO context admission failed: " + JSON.stringify(admitted))
  const stamp = admitted.stamp
  const hooks: { afterAdmission?: (count: number) => Promise<void> } = {}
  authority.readContextAdmission = async (candidate) => {
    const result = await originalAdmission(candidate)
    gate.admissions += 1
    await hooks.afterAdmission?.(gate.admissions)
    return result
  }
  // Kept lazy so the same index regression executes on the unchanged preimage.
  const { observeSfPoHealth } = await import("../../../../apps/cli/src/sucafina-product/native-ui/po-health.ts")
  const health = (candidate = request(), expected = stamp) => observeSfPoHealth(input, candidate, expected)
  const live = createSfLiveContext({ origin, mount: "/sf", currentBinding: () => identity,
    operational: (candidate, expected) => health(candidate, expected),
    admit: async (candidate) => {
      const result = await authority.readContextAdmission(candidate)
      if (result.status !== "ok") return result
      const destinations = sfContextDestinationsFromPages(result.pages)
      if (!destinations) return { status: "unavailable", reason: "contract-mismatch" } as const
      return { status: "ok", stamp: result.stamp, authMode: "local-operator", destinations } as const
    },
  })
  return {
    store, persistence, original, authority, services, bindings, source, input, gate, hooks, stamp, identity, live, request, health, routes,
    exportRequest: (signal?: AbortSignal) => new Request(origin + "/sf/procurement?download=po&request=41", {
      headers: { "x-fixture-actor": change === "recipient" ? "another-person" : "po-owner" }, signal,
    }),
    snapshot: () => original.transaction("procurement", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) })),
    dispose: async () => { await store.dispose(); await rm(directory, { recursive: true, force: true }) },
  }
}

test("PO export availability is indexed for native Imports", () => {
  expect(sfHasOperationalResource("files.export.po")).toBe(true)
  expect(sfHasOperationalResource("files.export.members")).toBe(true)
})

test("native context observes the mounted original PO source without exporting or mutating it", async () => {
  const value = await fixture()
  try {
    const before = await value.snapshot()
    expect(await value.health()).toEqual([{ operationId: "files.export.po", state: "ready", reason: null, operational: true }])
    const result = await value.live.readContext(value.request(), value.identity)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") throw new Error("Native PO context failed")
    expect(result.value.availability.flatMap((resource) => resource.operations).find((operation) =>
      operation.operationId === "files.export.po")).toEqual({
      operationId: "files.export.po", state: "ready", reason: null, operational: true,
    })
    expect(value.gate.producerCalls).toBe(0)
    expect(value.gate.exportCommits).toBe(0)
    expect(await value.snapshot()).toEqual(before)
    // There are deliberately no assets, signing keys, scanner or selected-order grant.
    expect("assets" in value.services).toBe(false)
  } finally { await value.dispose() }
})

test.each([
  { change: "none" as const, status: 200 },
  { change: "recipient" as const, status: 404 },
  { change: "missing" as const, status: 404 },
  { change: "access" as const, status: 403 },
  { change: "source" as const, status: 409 },
])("PO availability preserves real $change admission and egress", async ({ change, status }) => {
  const value = await fixture(change)
  try {
    expect(await value.health()).toHaveLength(1)
    const before = await value.snapshot()
    const request = value.exportRequest()
    const response = await value.routes(request)
    expect(value.gate.originalRequests).toEqual([request])
    expect(value.gate.producerCalls).toBe(1)
    expect(value.gate.transactions).toBe(2)
    expect(response?.status).toBe(status)
    expect(response?.headers.get("cache-control")).toBe("no-store")
    const body = await response!.text()
    expect(before.data.__sfProductV1).toBeDefined()
    expect(body).not.toContain(JSON.stringify(before.data.__sfProductV1))
    expect(value.gate.exportCommits).toBe(0)
    const after = await value.snapshot()
    expect(after.audit).toEqual(before.audit)
    if (change !== "source") expect(after).toEqual(before)
    if (status === 200) {
      expect(response?.headers.get("content-type")).toBe("text/html; charset=utf-8")
      expect(response?.headers.get("content-disposition")).toContain("PO-00041.html")
      for (const expected of ["PURCHASE ORDER", "PO-00041", "Authorized purchase order", "Supplier &lt;private&gt;", "Selected item", "50.00"])
        expect(body).toContain(expected)
    } else {
      for (const hidden of ["PO-00041", "Authorized purchase order", "Selected item"]) expect(body).not.toContain(hidden)
    }
  } finally { await value.dispose() }
})

test("PO discovery rejects missing or unowned routes and delegates", async () => {
  const value = await fixture()
  try {
    value.gate.installed = false
    expect(await value.health()).toEqual([])
    value.gate.installed = true
    value.source.routes = async () => new Response("unowned")
    expect(await value.health()).toEqual([])
    value.source.routes = value.routes
    value.bindings.application = async () => new Response("unowned")
    expect(await value.health()).toEqual([])
    value.bindings.application = createModule("/sf", { ...value.services, persistence: { ...value.persistence } })
    expect(await value.health()).toEqual([])
    expect(value.gate.producerCalls).toBe(0)
  } finally { await value.dispose() }
})

for (const fault of ["unmount", "producer", "authority", "transaction", "source", "revocation", "stamp", "abort"] as const) {
  test("PO discovery rejects late " + fault + " changes", async () => {
    const value = await fixture()
    try {
      const controller = new AbortController()
      const stamp = { ...value.stamp }
      value.hooks.afterAdmission = async (count) => {
        if (count !== 2) return
        if (fault === "unmount") value.gate.installed = false
        if (fault === "producer") value.bindings.application = createModule("/sf", value.services)
        if (fault === "authority") {
          const original = value.authority.readContextAdmission
          value.authority.readContextAdmission = (request) => original(request)
        }
        if (fault === "transaction") {
          const original = value.persistence.transaction
          value.persistence.transaction = (surface, work, options) => original(surface, work, options)
        }
        if (fault === "source") await value.original.transaction("procurement", async (snapshot) => {
          snapshot.data.store = { currency: "changed source" }
          snapshot.versions.store = { version: 2, by: "fault" }
          return { commit: true, value: undefined }
        })
        if (fault === "revocation") value.gate.allowed = false
        if (fault === "stamp") stamp.accessRevision = "changed-stamp"
        if (fault === "abort") controller.abort()
      }
      expect(await value.health(value.request("po-owner", controller.signal), stamp)).toEqual([])
      expect(value.gate.producerCalls).toBe(0)
      expect(value.gate.exportCommits).toBe(0)
    } finally { await value.dispose() }
  })
}

test("PO context refuses revoked admission and missing original application without exporting bytes", async () => {
  const value = await fixture()
  try {
    value.gate.allowed = false
    expect(await value.health()).toEqual([])
    const result = await value.live.readContext(value.request(), value.identity)
    expect(result.status).not.toBe("ok")
    const controller = new AbortController()
    controller.abort()
    const missing = mountSfFilesOriginalRoutes({ origin, mount: "/sf", sources: {} })
    expect((await missing(value.exportRequest()))?.status).toBe(503)
    expect((await value.routes(value.exportRequest(controller.signal)))?.status).toBe(503)
    expect(value.gate.producerCalls).toBe(0)
    expect(value.gate.exportCommits).toBe(0)
  } finally { await value.dispose() }
})
