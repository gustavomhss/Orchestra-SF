import { expect, test } from "bun:test"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { object } from "../../../runtime/contract.ts"
import { withDocumentReplayFixture } from "../memory-original-reauthorization/document-fixture.ts"
import { readOriginalRaw, requireNestedWriteFence, requireOnlyCaptureFault } from "./fixture-assertions.ts"
import type { BusinessEvidenceResolution } from "../../../product/contracts/business-context.ts"

test("M69 raw recall fences capture corruption during its last real authority revalidation", async () => {
  expectSpawn(import.meta.path)
  await withDocumentReplayFixture(async (f) => {
    const before = await f.audit()
    const source = f.sources[0]!
    const request = f.replayRequest()
    const selection = { caseRefs: [f.caseRef], query: "supplier" }
    const revalidate = f.authority.host.revalidate
    const observation = { calls: 0, target: 0, attempted: false, sameRequest: false, committed: false }
    const fault: { intact?: Record<string, unknown>; error?: unknown } = {}
    expect(before.counts).toMatchObject({ scans: 1, events: 1, envelopes: 1, outbox: 1, settled: 1 })
    try {
      await f.ui("sf_decision_recall", selection, async (call) => {
        await readOriginalRaw(f, call)
        f.authority.host.revalidate = async (trusted) => {
          const permitted = await revalidate(trusted)
          if (trusted !== call) return permitted
          observation.calls += 1
          if (permitted && observation.target > 0 && observation.calls === observation.target) {
            observation.attempted = true
            observation.sameRequest = f.authority.host.requestFor(trusted) === request
            // This is a real C08 write after the real authority returned. On the
            // protected implementation its nested-write guard must reject it.
            try {
              fault.intact = await f.corruptCapture(source)
              observation.committed = true
            } catch (error: unknown) { fault.error = error }
          }
          return permitted
        }
        await readOriginalRaw(f, call)
        expect(observation.calls).toBeGreaterThan(0)
        observation.target = observation.calls
        observation.calls = 0
        const result = await f.memory.recall(f.caseRef, call)
        f.authority.host.revalidate = revalidate
        expect(observation.attempted).toBe(true)
        expect(observation.sameRequest).toBe(true)
        expect(observation.calls).toBe(observation.target)
        expect(f.authority.host.requestFor(call)).toBe(request)
        expect(request.headers.get("Idempotency-Key")).toBe(f.replayKey)
        expect(request.signal.aborted).toBe(false)
        const after = await f.audit()
        if (observation.committed) {
          expect(fault.error).toBeUndefined()
          if (!fault.intact) throw new Error("Capture corruption did not retain its actual prior value")
          requireOnlyCaptureFault(f, before, after, fault.intact)
          await f.restoreCapture(source, fault.intact)
        } else {
          requireNestedWriteFence(fault.error)
          expect(fault.intact).toBeUndefined()
          expect(after).toEqual(before)
        }
        await readOriginalRaw(f, call)
        expect(await f.audit()).toEqual(before)
        console.info("SF_MEMORY_M69_RAW_LAST_AUTHORITY_CAPTURE", JSON.stringify({
          result: result.status, returnedRecords: result.status === "ok" ? result.records.length : 0,
          lastRealRevalidation: observation.calls, sameCallAndRequest: true,
          fault: observation.committed ? "committed-capture-corruption" : "nested-write-blocked",
          originalRestored: true, auditDigest: digestSfValue(before), counts: before.counts,
          nativeSessionWitness: false,
        }))
        // No rejected Promise or generic exception is an acceptable denial.
        expect(result).toEqual({ status: "unavailable" })
      }, request)
    } finally { f.authority.host.revalidate = revalidate }
  })
}, 180_000)

test("M69 raw recall fences a real case change after its last authorized document resolution", async () => {
  expectSpawn(import.meta.path)
  await withDocumentReplayFixture(async (f) => {
    const before = await f.audit()
    const source = f.sources[0]!
    const request = f.replayRequest()
    const selection = { caseRefs: [f.caseRef], query: "supplier" }
    const resolve = f.atlas.context.resolve
    const observation = { reads: 0, target: 0, attempted: false, sameRequest: false, committed: false }
    const fault: { error?: unknown; resolution?: BusinessEvidenceResolution } = {}
    try {
      await f.ui("sf_decision_recall", selection, async (call) => {
        const stored = await f.authority.state.read(request, "cases", (state) => state.cases[f.caseRef.id])
        if (stored.status !== "ok" || !stored.value) throw new Error("Actual accepted case unavailable")
        const intact = structuredClone(stored.value)
        const changed = { ...intact, version: intact.version + 1, objective: "M69 concurrent revision of the same case" }
        expect(intact.id).toBe(f.caseRef.id)
        expect(intact.incarnation).toBe(f.caseRef.incarnation)
        await readOriginalRaw(f, call)
        f.atlas.context.resolve = async (incoming, trusted) => {
          const resolved = await resolve(incoming, trusted)
          if (trusted !== call || incoming.refDigest !== source.ref.refDigest) return resolved
          observation.reads += 1
          if (observation.target > 0 && observation.reads === observation.target) {
            observation.attempted = true
            observation.sameRequest = f.authority.host.requestFor(trusted) === request
            fault.resolution = structuredClone(resolved)
            try {
              await f.app.store.transaction("dashboard", async (snapshot) => {
                object(object(snapshot.data.__sfProductV1).cases)[f.caseRef.id] = structuredClone(changed)
                return { commit: true, value: undefined }
              })
              observation.committed = true
            } catch (error: unknown) { fault.error = error }
          }
          return resolved
        }
        await readOriginalRaw(f, call)
        expect(observation.reads).toBeGreaterThan(0)
        observation.target = observation.reads
        observation.reads = 0
        const result = await f.memory.recall(f.caseRef, call)
        f.atlas.context.resolve = resolve
        expect(observation.attempted).toBe(true)
        expect(observation.sameRequest).toBe(true)
        expect(observation.reads).toBe(observation.target)
        expect(fault.resolution?.state).toBe("fresh")
        expect(fault.resolution?.currentRef).toEqual(source.ref)
        expect(fault.resolution?.authorizedProjection).toEqual(source.evidence)
        const current = await f.app.store.transaction("dashboard", async (snapshot) => ({
          commit: false, value: structuredClone(object(object(snapshot.data.__sfProductV1).cases)[f.caseRef.id]),
        }))
        if (observation.committed) {
          expect(fault.error).toBeUndefined()
          expect(current).toEqual(changed)
        } else {
          requireNestedWriteFence(fault.error)
          expect(current).toEqual(intact)
        }
        expect(digestSfValue(object(current).ledger)).toBe(digestSfValue(intact.ledger))
        // The actual case is the only changed source: Atlas, receipt, outbox,
        // namespace versions and scanner count are byte-for-byte unchanged.
        expect(await f.audit()).toEqual(before)
        if (observation.committed) await f.app.store.transaction("dashboard", async (snapshot) => {
          object(object(snapshot.data.__sfProductV1).cases)[f.caseRef.id] = structuredClone(intact)
          return { commit: true, value: undefined }
        })
        await readOriginalRaw(f, call)
        expect(await f.audit()).toEqual(before)
        console.info("SF_MEMORY_M69_RAW_LAST_DOCUMENT_CASE", JSON.stringify({
          result: result.status, returnedRecords: result.status === "ok" ? result.records.length : 0,
          lastRealDocumentResolution: observation.reads, sourceWasFresh: true,
          fault: observation.committed ? "committed-case-revision" : "nested-write-blocked",
          ledgerDigest: digestSfValue(intact.ledger), originalRestored: true,
          auditDigest: digestSfValue(before), counts: before.counts, nativeSessionWitness: false,
        }))
        expect(result).toEqual({ status: "unavailable" })
      }, request)
    } finally { f.atlas.context.resolve = resolve }
  })
}, 180_000)
