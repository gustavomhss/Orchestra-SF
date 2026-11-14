import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createSfBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { initialProcurementSettings } from "../../../../src/initial-settings.ts"

const period = { start: "2026-01-01", end: "2026-12-31" }
type Mode = "cold" | "without-preferences" | "ready"

test.each(["cold", "without-preferences", "ready"] as const)("real fresh Procurement evidence retains canonical fallthrough with C08 %s", async (mode) => {
  const fixture = await evidenceFixture(mode)
  const canonical = fixture.business.procurementDecisions.resolveEvidence
  const scopes: boolean[] = []
  fixture.business.procurementDecisions.resolveEvidence = async (ref, call) => {
    scopes.push(fixture.persistence.currentSnapshots?.() !== undefined)
    const value = await canonical(ref, call)
    expect(value).toBeUndefined()
    return value
  }
  try {
    const archive = await fixture.authority.state.read(fixture.request, "preferences", () => null)
    if (mode === "cold") expect(archive).toEqual({ status: "unavailable", reason: "product-state-uninitialized" })
    else if (mode === "without-preferences") expect(archive).toEqual({ status: "denied", reason: "product-access-unavailable" })
    else expect(archive.status).toBe("ok")
    const before = await fixture.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))
    const resolved = await fixture.business.context.resolve(fixture.source, fixture.call)
    expect(resolved.state).toBe("fresh")
    expect(resolved.ref).toEqual(fixture.source)
    expect(resolved.currentRef).toEqual(fixture.source)
    const projection = resolved.authorizedProjection
    if (!projection || !("values" in projection)) throw new Error("Actual Procurement projection unavailable")
    expect(projection.values).toContainEqual(expect.objectContaining({ id: "originalAmount", value: 100 }))
    expect(scopes).toEqual([mode === "ready"])
    expect(fixture.persistence.currentSnapshots?.()).toBeUndefined()
    expect(await fixture.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))).toBe(before)
  } finally {
    fixture.business.procurementDecisions.resolveEvidence = canonical
    await fixture.dispose()
  }
}, 120_000)

test("a canonical nested writer is refused once without retry or a durable side effect", async () => {
  const fixture = await evidenceFixture("ready")
  const canonical = fixture.business.procurementDecisions.resolveEvidence
  let calls = 0
  fixture.business.procurementDecisions.resolveEvidence = async (ref, call) => {
    calls++
    expect(fixture.persistence.currentSnapshots?.()).toBeDefined()
    const value = await canonical(ref, call)
    expect(value).toBeUndefined()
    // A real attempted writer must poison the owning LocalStore read scope.
    // It must never get a second unprotected execution after the refusal.
    await fixture.persistence.transaction("procurement", async (snapshot) => {
      snapshot.data.unexpectedEvidenceWrite = true
      return { commit: true, value: undefined }
    })
    return value
  }
  try {
    const before = await fixture.persistence.transaction("procurement", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))
    const resolved = await fixture.business.context.resolve(fixture.source, fixture.call)
    expect(resolved.state).toBe("unavailable")
    expect(resolved.authorizedProjection).toBeUndefined()
    expect(calls).toBe(1)
    expect(fixture.persistence.currentSnapshots?.()).toBeUndefined()
    expect(await fixture.persistence.transaction("procurement", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))).toBe(before)
  } finally {
    fixture.business.procurementDecisions.resolveEvidence = canonical
    await fixture.dispose()
  }
}, 120_000)

async function evidenceFixture(mode: Mode) {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-procurement-evidence-scope-"))
  await chmod(directory, 0o700)
  const driver = await openLocalStore(path.join(directory, "store"))
  let business: ReturnType<typeof createSfBusinessServices> | undefined
  try {
    const persistence = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, createId: randomUUID,
      projectScope: createSfSourceScopeProjector(() => "2026-11-14T00:00:00Z") })
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    await persistence.transaction("procurement", async (snapshot) => {
      snapshot.data.store = { requests: { "PR-1": { request: { number: "PR-1", createdBy: "person", status: "draft",
        pr: { title: "Real read-scope source", justification: "Canonical fixture", estAmount: 100 }, history: [], attachments: [] }, version: 0, by: "person" } },
        suppliers: [], settings: initialProcurementSettings(), issued: { pr: ["PR-1"], po: [] } }
      snapshot.versions["requests:PR-1"] = { version: 0, by: "person" }
      return { commit: true, value: undefined }
    })
    const request = new Request("https://example.test/procurement", { method: "POST", headers: { origin: "https://example.test", authorization: "person" } })
    const authority = createSfProductAuthority({ installationId: "installation", origin: "https://example.test", policyVersion: "policy", persistence,
      identity: () => ({ installationId: "installation", hostId: "evidence-read-scope", projectId: "project", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }),
      grants: [{ principalRef: "person", namespaces: mode === "without-preferences" ? ["cases"] : ["cases", "preferences"],
        operations: ["sf_work_list", "sf_request_read"] }],
      authenticate: async (incoming, selection) => incoming.headers.get("authorization") === "person" && selection
        ? { id: "person", canWrite: true, roles: [{ surface: selection.surface, role: selection.surface === "procurement" ? "requester" : "admin" }] } : null,
      environment: async () => ({ at: "2026-11-14T00:00:00Z", id: randomUUID, directory: [{ id: "person", name: "Person" }] }),
      commandIdentity: async (_request, operation, digest) => digestSfValue({ operation, digest }), createId: randomUUID, now: Date.now,
      inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false,
      providerGeneration: async () => undefined, authorizeDocument: async () => undefined })
    if (mode !== "cold") {
      // Initialize C08 through its actual authorized transaction; no namespace
      // grant or fake snapshot is supplied for the missing-preferences case.
      const seeded = await authority.state.transaction(request, { namespace: "cases", expectedStorageVersion: 0,
        targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation,
        idempotencyKey: "initialize-case-namespace", commandDigest: digestSfValue(mode) }, async () => ({ commit: true, value: true }))
      if (seeded.status !== "ok") throw new Error("Actual C08 initialization unavailable")
    }
    const active = createSfBusinessServices({ authority, persistence, proposalCoverageWrites: new WeakSet<object>(), procurementEvidenceWrites: new WeakSet<object>() })
    business = active
    active.initializeAtlas(undefined, { boundaryVersion: "fixture", schemaVersion: "fixture", manifestVersion: "fixture", skillVersion: "fixture" })
    const periodDigest = digestSfValue({ purpose: "work-selection", period })
    const selected = await authority.ui.admit(request, "sf_work_list", periodDigest)
    if (selected.status !== "ok") throw new Error(selected.reason)
    try {
      if (!await authority.ui.validate(selected.value, "sf_work_list", periodDigest)) throw new Error("Real period admission unavailable")
      const result = await active.procurementSelections.create(selected.value, period)
      if (result.status !== "ok") throw new Error(result.reason)
    } finally { authority.ui.finish(selected.value) }
    const digest = digestSfValue({ request: "PR-1" })
    const admitted = await authority.ui.admit(request, "sf_request_read", digest)
    if (admitted.status !== "ok") throw new Error(admitted.reason)
    if (!await authority.ui.validate(admitted.value, "sf_request_read", digest)) throw new Error("Real source admission unavailable")
    const issued = await active.individual.issue("procurement-request", "PR-1", admitted.value)
    if (issued.status !== "ok") throw new Error(issued.reason)
    const source = await active.individual.resolve(issued.value, admitted.value)
    if (source.status !== "ok") throw new Error(source.reason)
    return { persistence, authority, business: active, request, call: admitted.value, source: source.value.evidence,
      dispose: async () => { authority.ui.finish(admitted.value); active.dispose(); await driver.dispose(); await rm(directory, { recursive: true, force: true }) } }
  } catch (error) {
    business?.dispose()
    await driver.dispose()
    await rm(directory, { recursive: true, force: true })
    throw error
  }
}
