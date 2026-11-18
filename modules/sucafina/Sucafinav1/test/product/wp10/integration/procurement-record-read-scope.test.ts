import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createSfBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfProcurementRecordReadScope } from "../../../../../../../apps/cli/src/sucafina-product/procurement-record-read-scope.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../../product/contracts/business-context.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { initialProcurementSettings } from "../../../../src/initial-settings.ts"

const period = { start: "2026-01-01", end: "2026-12-31" }
type RecordRef = Extract<BusinessEvidenceRef, { kind: "record" }>

test("one real record scope performs both canonical BCS reads without a durable write", async () => {
  const fixture = await recordsFixture()
  try {
    const refs = structuredClone(fixture.sources)
    const before = await fixture.snapshotDigest()
    let executions = 0
    const observed = await fixture.observe(refs, fixture.call, async () => {
      executions++
      expect(fixture.persistence.currentSnapshots?.()).toBeDefined()
      const results: BusinessEvidenceResolution[] = []
      for (const ref of refs) results.push(await fixture.business.context.resolve(ref, fixture.call))
      return results
    })
    expect(executions).toBe(1)
    expect(observed.kind).toBe("observed")
    if (observed.kind !== "observed") throw new Error("Actual record read scope unavailable")
    expect(observed.value).toHaveLength(2)
    for (const [index, value] of observed.value.entries()) {
      expect(value.state).toBe("fresh")
      expect(value.ref).toEqual(refs[index])
      expect(value.currentRef).toEqual(refs[index])
      const projection = value.authorizedProjection
      if (!projection || !("values" in projection)) throw new Error("Actual canonical Procurement projection unavailable")
      expect(projection.values).toContainEqual(expect.objectContaining({ id: "originalAmount", value: (index + 1) * 100 }))
    }
    expect(fixture.persistence.currentSnapshots?.()).toBeUndefined()
    expect(await fixture.snapshotDigest()).toBe(before)
  } finally { await fixture.dispose() }
}, 120_000)

test("a missing current scope for the second real record refuses grouping before canonical work", async () => {
  const fixture = await recordsFixture()
  try {
    const second = fixture.sources[1]!
    // Remove actual persisted metadata through the raw driver as a negative
    // storage probe. No positive source proof or successful verifier is forged.
    await fixture.driver.transaction("procurement", async (snapshot) => {
      const entries = Object.entries(snapshot.sfSources?.scopes ?? {}).filter(([, value]) => value.incarnation === second.target.incarnation)
      expect(entries).toHaveLength(1)
      if (!snapshot.sfSources?.scopes || !entries[0]) throw new Error("Actual second source scope unavailable")
      delete snapshot.sfSources.scopes[entries[0][0]]
      return { commit: true, value: undefined }
    })
    const before = await fixture.snapshotDigest()
    let executions = 0
    const observed = await fixture.observe(fixture.sources, fixture.call, async () => {
      executions++
      const results: BusinessEvidenceResolution[] = []
      for (const ref of fixture.sources) results.push(await fixture.business.context.resolve(ref, fixture.call))
      return results
    })
    expect(observed).toEqual({ kind: "unsupported" })
    expect(executions).toBe(0)
    expect(fixture.persistence.currentSnapshots?.()).toBeUndefined()
    expect(await fixture.snapshotDigest()).toBe(before)
    // A writer remains possible after the pre-work refusal, on the canonical
    // path outside the grouped root. This is not an automatic retry.
    const issued = await fixture.issue(second.target.recordId)
    expect(issued.status).toBe("ok")
    expect(await fixture.snapshotDigest()).not.toBe(before)
  } finally { await fixture.dispose() }
}, 120_000)

test("changing the second complete record reference during canonical work closes the whole observation without retry", async () => {
  const fixture = await recordsFixture()
  try {
    const refs = structuredClone(fixture.sources)
    const original = digestSfValue(fixture.sources)
    const before = await fixture.snapshotDigest()
    let executions = 0
    let canonicalReads = 0
    const observed = await fixture.observe(refs, fixture.call, async () => {
      executions++
      const results: BusinessEvidenceResolution[] = []
      for (const ref of refs) {
        results.push(await fixture.business.context.resolve(ref, fixture.call))
        canonicalReads++
      }
      // The first ref remains byte-identical. Pinning just it or just refId
      // would miss this mutation of a later source's complete selector.
      refs[1]!.target.version++
      return results
    })
    expect(observed).toEqual({ kind: "changed" })
    expect(executions).toBe(1)
    expect(canonicalReads).toBe(2)
    expect(digestSfValue(refs)).not.toBe(original)
    expect(digestSfValue(fixture.sources)).toBe(original)
    expect(fixture.persistence.currentSnapshots?.()).toBeUndefined()
    expect(await fixture.snapshotDigest()).toBe(before)
  } finally { await fixture.dispose() }
}, 120_000)

async function recordsFixture() {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-procurement-record-scope-"))
  await chmod(directory, 0o700)
  const driver = await openLocalStore(path.join(directory, "store"))
  let business: ReturnType<typeof createSfBusinessServices> | undefined
  try {
    const persistence = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, createId: randomUUID,
      projectScope: createSfSourceScopeProjector(() => "2026-11-14T00:00:00Z") })
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    await persistence.transaction("procurement", async (snapshot) => {
      snapshot.data.store = { requests: Object.fromEntries(["PR-1", "PR-2"].map((id, index) => [id, {
        request: { number: id, createdBy: "person", status: "draft", pr: { title: `Real source ${id}`, justification: "Canonical record scope", estAmount: (index + 1) * 100 },
          history: [], attachments: [] }, version: 0, by: "person" }])),
        suppliers: [], settings: initialProcurementSettings(), issued: { pr: ["PR-1", "PR-2"], po: [] } }
      for (const id of ["PR-1", "PR-2"]) snapshot.versions[`requests:${id}`] = { version: 0, by: "person" }
      return { commit: true, value: undefined }
    })
    const request = new Request("https://example.test/procurement", { method: "POST", headers: { origin: "https://example.test", authorization: "person" } })
    const authority = createSfProductAuthority({ installationId: "installation", origin: "https://example.test", policyVersion: "policy", persistence,
      identity: () => ({ installationId: "installation", hostId: "record-read-scope", projectId: "project", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }),
      grants: [{ principalRef: "person", namespaces: ["cases", "preferences"], operations: ["sf_work_list", "sf_request_read"] }],
      authenticate: async (incoming, selection) => incoming.headers.get("authorization") === "person" && selection
        ? { id: "person", canWrite: true, roles: [{ surface: selection.surface, role: selection.surface === "procurement" ? "requester" : "admin" }] } : null,
      environment: async () => ({ at: "2026-11-14T00:00:00Z", id: randomUUID, directory: [{ id: "person", name: "Person" }] }),
      commandIdentity: async (_request, operation, digest) => digestSfValue({ operation, digest }), createId: randomUUID, now: Date.now,
      inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false,
      providerGeneration: async () => undefined, authorizeDocument: async () => undefined })
    const initialized = await authority.state.transaction(request, { namespace: "cases", expectedStorageVersion: 0,
      targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation,
      idempotencyKey: "initialize-case-namespace", commandDigest: digestSfValue({ purpose: "record-scope" }) }, async () => ({ commit: true, value: true }))
    if (initialized.status !== "ok") throw new Error("Actual C08 initialization unavailable")
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
    const issue = async (id: string) => {
      const digest = digestSfValue({ request: id })
      const admitted = await authority.ui.admit(request, "sf_request_read", digest)
      if (admitted.status !== "ok") return admitted
      try {
        if (!await authority.ui.validate(admitted.value, "sf_request_read", digest)) throw new Error("Real source admission unavailable")
        const issued = await active.individual.issue("procurement-request", id, admitted.value)
        if (issued.status !== "ok") return issued
        return await active.individual.resolve(issued.value, admitted.value)
      } finally { authority.ui.finish(admitted.value) }
    }
    const sources: RecordRef[] = []
    for (const id of ["PR-1", "PR-2"]) {
      const source = await issue(id)
      if (source.status !== "ok") throw new Error(source.reason)
      sources.push(source.value.evidence)
    }
    const digest = digestSfValue({ request: "PR-1" })
    const admitted = await authority.ui.admit(request, "sf_request_read", digest)
    if (admitted.status !== "ok") throw new Error(admitted.reason)
    if (!await authority.ui.validate(admitted.value, "sf_request_read", digest)) throw new Error("Real retained read admission unavailable")
    const first = sources[0]
    if (!first) throw new Error("Actual first source unavailable")
    const current = await active.individual.resolve(first.refId, admitted.value)
    if (current.status !== "ok") throw new Error(current.reason)
    // This fixture-owned selector comes from the real admitted period and real
    // canonical context. It grants nothing: context, source and C08 readers
    // below all retain their actual host authorization and private lease.
    const selection = { period: structuredClone(current.value.context.period), expiresAt: Date.now() + 5 * 60_000 }
    const observe = createSfProcurementRecordReadScope({ host: authority.host, state: authority.state,
      contextFor: async (call) => {
        const value = await active.individual.resolve(first.refId, call)
        return value.status === "ok" ? { status: "ok", value: value.value.context } : value
      }, selection: () => selection, readerIdentity: () => active.context, lockedSourceFences: active.lockedSourceFences })
    const snapshotDigest = async () => {
      if (!driver.transactionAll) throw new Error("Actual atomic LocalStore reader unavailable")
      return driver.transactionAll(async (snapshots) => ({ commit: false, value: digestSfValue(snapshots) }))
    }
    return { driver, persistence, authority, business: active, request, call: admitted.value, sources, observe, snapshotDigest, issue,
      dispose: async () => { authority.ui.finish(admitted.value); active.dispose(); await driver.dispose(); await rm(directory, { recursive: true, force: true }) } }
  } catch (error) {
    business?.dispose()
    await driver.dispose()
    await rm(directory, { recursive: true, force: true })
    throw error
  }
}
