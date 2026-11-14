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
import type { SfProductStatePort } from "../../../../product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../../product/contracts/sf-execution.ts"
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

test("exact private participation repeats actual canonical reads without repeating the owner's full C08 witness", async () => {
  const fixture = await recordsFixture()
  try {
    const before = await fixture.snapshotDigest()
    const counts = { ...fixture.counts }
    let executions = 0
    const result = await fixture.observe(fixture.sources, fixture.call, async () => {
      const resolved: BusinessEvidenceResolution[] = []
      // Repeat an identical full ref and reenter with the same exact call:
      // neither a completed projection nor a pending producer may be reused.
      for (const ref of [fixture.sources[0]!, fixture.sources[0]!, fixture.sources[1]!]) {
        const child = await fixture.child([ref], fixture.call, async () => {
          const nested = await fixture.child([ref], fixture.call, async () => {
            executions++
            return fixture.business.context.resolve(ref, fixture.call)
          })
          expect(nested.kind).toBe("observed")
          if (nested.kind !== "observed") throw new Error("Actual reentrant producer unavailable")
          return nested.value
        })
        expect(child.kind).toBe("observed")
        if (child.kind !== "observed") throw new Error("Actual child producer unavailable")
        expect(child.value.state).toBe("fresh")
        expect(child.value.ref).toEqual(ref)
        expect(child.value.currentRef).toEqual(ref)
        resolved.push(child.value)
      }
      return resolved
    })
    expect(result.kind).toBe("observed")
    expect(executions).toBe(3)
    expect(fixture.counts.evidenceFences - counts.evidenceFences).toBe(2)
    expect(fixture.counts.contexts - counts.contexts).toBe(2)
    expect(fixture.counts.authentication).toBeGreaterThan(counts.authentication)
    expect(fixture.counts.environment).toBeGreaterThan(counts.environment)
    expect(fixture.persistence.currentSnapshots?.()).toBeUndefined()
    expect(await fixture.snapshotDigest()).toBe(before)
  } finally { await fixture.dispose() }
}, 120_000)

test.each(["reader", "headers", "authority", "day", "directory", "bank-key"] as const)(
  "a transient child %s change invalidates the owner even after restoration", async (mode) => {
    const fixture = await recordsFixture()
    const originalReader = fixture.childReader.current
    const original = structuredClone(fixture.controls)
    const restore = () => {
      fixture.childReader.current = originalReader
      fixture.request.headers.delete("x-child-observation")
      Object.assign(fixture.controls, original)
      if (original.bankKey === undefined) delete fixture.controls.bankKey
    }
    try {
      const before = await fixture.snapshotDigest()
      let executions = 0
      const observed = await fixture.observe(fixture.sources, fixture.call, async () => {
        const child = await fixture.child([fixture.sources[0]!], fixture.call, async () => {
          executions++
          const value = await fixture.business.context.resolve(fixture.sources[0]!, fixture.call)
          expect(value.state).toBe("fresh")
          if (mode === "reader") fixture.childReader.current = fixture.business.individual
          if (mode === "headers") fixture.request.headers.set("x-child-observation", "changed")
          if (mode === "authority") fixture.controls.active = false
          if (mode === "day") fixture.controls.at = "2026-11-15T00:00:00Z"
          if (mode === "directory") fixture.controls.directory = [{ id: "person", name: "Changed directory" }]
          if (mode === "bank-key") fixture.controls.bankKey = new Uint8Array([1, 2, 3])
          return value
        })
        expect(child).toEqual({ kind: "changed" })
        restore()
        return child
      })
      expect(observed).toEqual({ kind: "changed" })
      expect(executions).toBe(1)
      expect(fixture.persistence.currentSnapshots?.()).toBeUndefined()
      expect(await fixture.snapshotDigest()).toBe(before)
    } finally { restore(); await fixture.dispose() }
  }, 120_000)

test.each(["reader", "child-input"] as const)("a completed participant's %s remains pinned until its owner returns", async (mode) => {
  const fixture = await recordsFixture()
  const originalReader = fixture.childReader.current
  try {
    const before = await fixture.snapshotDigest()
    const childInput = [structuredClone(fixture.sources[0]!)]
    let executions = 0
    const observed = await fixture.observe(fixture.sources, fixture.call, async () => {
      const child = await fixture.child(childInput, fixture.call, async () => {
        executions++
        return fixture.business.context.resolve(childInput[0]!, fixture.call)
      })
      expect(child.kind).toBe("observed")
      if (child.kind !== "observed") throw new Error("Actual completed child unavailable")
      expect(child.value.state).toBe("fresh")
      if (mode === "reader") fixture.childReader.current = fixture.business.individual
      if (mode === "child-input") childInput[0] = structuredClone(fixture.sources[1]!)
      return child.value
    })
    expect(observed).toEqual({ kind: "changed" })
    expect(executions).toBe(1)
    expect(fixture.persistence.currentSnapshots?.()).toBeUndefined()
    expect(await fixture.snapshotDigest()).toBe(before)
  } finally { fixture.childReader.current = originalReader; await fixture.dispose() }
}, 120_000)

test.each(["second-record", "changed-complete-selector"] as const)(
  "a child outside the exact %s closure does no canonical work and cannot expand its owner", async (mode) => {
    const fixture = await recordsFixture()
    try {
      const before = await fixture.snapshotDigest()
      const outside = structuredClone(fixture.sources[mode === "second-record" ? 1 : 0]!)
      if (mode === "changed-complete-selector") outside.target.version++
      let executions = 0
      const observed = await fixture.observe([fixture.sources[0]!], fixture.call, async () => {
        const child = await fixture.child([outside], fixture.call, async () => {
          executions++
          return fixture.business.context.resolve(outside, fixture.call)
        })
        expect(child).toEqual({ kind: "changed" })
        return child
      })
      expect(observed).toEqual({ kind: "changed" })
      expect(executions).toBe(0)
      expect(fixture.persistence.currentSnapshots?.()).toBeUndefined()
      expect(await fixture.snapshotDigest()).toBe(before)
    } finally { await fixture.dispose() }
  }, 120_000)

test("a detached child cannot reopen a completed private owner or execute its canonical producer", async () => {
  const fixture = await recordsFixture()
  const released = Promise.withResolvers<void>()
  let detached: Promise<Awaited<ReturnType<typeof fixture.child>>> | undefined
  let executions = 0
  try {
    const before = await fixture.snapshotDigest()
    const observed = await fixture.observe(fixture.sources, fixture.call, async () => {
      detached = (async () => {
        await released.promise
        return fixture.child([fixture.sources[0]!], fixture.call, async () => {
          executions++
          return fixture.business.context.resolve(fixture.sources[0]!, fixture.call)
        })
      })()
      return fixture.business.context.resolve(fixture.sources[0]!, fixture.call)
    })
    expect(observed.kind).toBe("observed")
    released.resolve()
    if (!detached) throw new Error("Detached child was not scheduled")
    expect(await detached).toEqual({ kind: "changed" })
    expect(executions).toBe(0)
    expect(fixture.persistence.currentSnapshots?.()).toBeUndefined()
    expect(await fixture.snapshotDigest()).toBe(before)
  } finally { released.resolve(); await detached; await fixture.dispose() }
}, 120_000)

test("a completed child reader remains pinned through the actual transaction's asynchronous egress", async () => {
  const fixture = await recordsFixture()
  const originalReader = fixture.childReader.current
  let egressCalls = 0
  let closedAtEgress: boolean | undefined
  try {
    const before = await fixture.snapshotDigest()
    let executions = 0
    const observed = await fixture.observe(fixture.sources, fixture.call, async () => {
      const child = await fixture.child([fixture.sources[0]!], fixture.call, async () => {
        executions++
        return fixture.business.context.resolve(fixture.sources[0]!, fixture.call)
      })
      expect(child.kind).toBe("observed")
      if (child.kind !== "observed") throw new Error("Actual completed child unavailable")
      expect(child.value.state).toBe("fresh")
      // Arm only after canonical work, while the actual root is still open.
      // The forwarding wrapper fires after that protected root has closed but
      // before the helper's await of persistence.transaction has completed.
      fixture.egress.afterRoot = () => {
        egressCalls++
        closedAtEgress = fixture.persistence.currentSnapshots?.() === undefined
        fixture.childReader.current = fixture.business.individual
        fixture.egress.afterRoot = undefined
      }
      return child.value
    })
    expect(egressCalls).toBe(1)
    expect(closedAtEgress).toBe(true)
    expect(observed).toEqual({ kind: "changed" })
    expect(executions).toBe(1)
    expect(fixture.persistence.currentSnapshots?.()).toBeUndefined()
    expect(await fixture.snapshotDigest()).toBe(before)
  } finally { fixture.egress.afterRoot = undefined; fixture.childReader.current = originalReader; await fixture.dispose() }
}, 120_000)

test("an actual writer inside a participating canonical read poisons the owner once without retry", async () => {
  const fixture = await recordsFixture()
  try {
    const before = await fixture.snapshotDigest()
    let executions = 0
    const observed = await fixture.observe(fixture.sources, fixture.call, async () => {
      const child = await fixture.child([fixture.sources[0]!], fixture.call, async () => {
        executions++
        const value = await fixture.business.context.resolve(fixture.sources[0]!, fixture.call)
        expect(value.state).toBe("fresh")
        await fixture.persistence.transaction("procurement", async (snapshot) => {
          snapshot.data.unexpectedParticipationWrite = true
          return { commit: true, value: undefined }
        })
        return value
      })
      expect(child).toEqual({ kind: "changed" })
      return child
    })
    expect(observed).toEqual({ kind: "changed" })
    expect(executions).toBe(1)
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
    const engine = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, createId: randomUUID,
      projectScope: createSfSourceScopeProjector(() => "2026-11-14T00:00:00Z") })
    const egress: { afterRoot?: () => void } = {}
    const persistence: typeof engine = { ...engine, transaction: async (surface, work, options) => {
      const value = await engine.transaction(surface, work, options)
      if (!engine.currentSnapshots?.()) egress.afterRoot?.()
      return value
    } }
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
    const counts = { evidenceFences: 0, contexts: 0, authentication: 0, environment: 0 }
    const controls: { active: boolean; at: string; directory: { id: string; name: string }[]; bankKey?: Uint8Array } = {
      active: true, at: "2026-11-14T00:00:00Z", directory: [{ id: "person", name: "Person" }] }
    const authority = createSfProductAuthority({ installationId: "installation", origin: "https://example.test", policyVersion: "policy", persistence,
      identity: () => ({ installationId: "installation", hostId: "record-read-scope", projectId: "project", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }),
      grants: [{ principalRef: "person", namespaces: ["cases", "preferences"], operations: ["sf_work_list", "sf_request_read"] }],
      authenticate: async (incoming, selection) => {
        counts.authentication++
        return controls.active && incoming.headers.get("authorization") === "person" && selection
          ? { id: "person", canWrite: true, roles: [{ surface: selection.surface, role: selection.surface === "procurement" ? "requester" : "admin" }] } : null
      },
      environment: async () => { counts.environment++; return { at: controls.at, id: randomUUID,
        directory: structuredClone(controls.directory), bankKey: controls.bankKey ? new Uint8Array(controls.bankKey) : undefined } },
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
    // Count only callbacks carried through the real C08 reader. Namespace
    // authorization, snapshots, leases and final checks remain canonical.
    const state: SfProductStatePort = { ...authority.state,
      read: (incoming, namespace, work) => authority.state.read(incoming, namespace, async (value, actor) => {
        const result = await work(value, actor)
        if (typeof result === "object" && result !== null && "kind" in result && result.kind === "sf-procurement-evidence-fence") counts.evidenceFences++
        return result
      }) }
    const inputs = { host: authority.host, state,
      contextFor: async (call: TrustedDomainContext) => {
        counts.contexts++
        const value = await active.individual.resolve(first.refId, call)
        return value.status === "ok" ? { status: "ok" as const, value: value.value.context } : value
      }, selection: () => selection, lockedSourceFences: active.lockedSourceFences }
    const observe = createSfProcurementRecordReadScope({ ...inputs, readerIdentity: () => active.context })
    const childReader: { current: object | undefined } = { current: active.procurementDecisions.resolveEvidence }
    const child = createSfProcurementRecordReadScope({ ...inputs, readerIdentity: () => childReader.current })
    const snapshotDigest = async () => {
      if (!driver.transactionAll) throw new Error("Actual atomic LocalStore reader unavailable")
      return driver.transactionAll(async (snapshots) => ({ commit: false, value: digestSfValue(snapshots) }))
    }
    return { driver, persistence, authority, business: active, request, call: admitted.value, sources, observe, child, childReader, controls, counts, egress, snapshotDigest, issue,
      dispose: async () => { authority.ui.finish(admitted.value); active.dispose(); await driver.dispose(); await rm(directory, { recursive: true, force: true }) } }
  } catch (error) {
    business?.dispose()
    await driver.dispose()
    await rm(directory, { recursive: true, force: true })
    throw error
  }
}
