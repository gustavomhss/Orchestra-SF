import { expect, test } from "bun:test"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { object } from "../../../runtime/contract.ts"
import { withDocumentReplayFixture } from "./document-fixture.ts"
import type { MemoryWriteReceipt } from "../../../product/contracts/business-context.ts"

test("Settled replay fences late headers, Request identity, abort and finished lease after real revalidation", async () => {
  expectSpawn(import.meta.path)
  await withDocumentReplayFixture(async (f) => {
    const before = await f.audit()
    const reference = f.eventRef
    const identity = digestSfValue(reference)
    const observations: { mutation: string; status: MemoryWriteReceipt["status"]; eventId?: string; recordDigest?: string }[] = []
    expect(before.counts).toMatchObject({ scans: 1, events: 1, envelopes: 1, outbox: 1, settled: 1 })

    // One real SQLite/document/scanner fixture serves these isolated admissions.
    // Each attack keeps the same registered call, Request, reference and key
    // used by its successful warmup and calibration; no grant is fabricated.
    for (const mutation of ["headers", "request", "abort", "finished-lease"] as const) {
      const controller = new AbortController()
      const request = new Request(f.replayRequest(), { signal: controller.signal })
      const replacement = new Request(request)
      const revalidate = f.authority.host.revalidate
      const requestFor = f.authority.host.requestFor
      const observation = { calls: 0, target: 0, changed: false }
      try {
        await f.ui("sf_evidence_get", { evidenceRef: reference }, async (call) => {
          expect(f.authority.host.requestFor(call)).toBe(request)
          expect(request.headers.get("Idempotency-Key")).toBe(f.replayKey)
          expect(await f.memory.emitFromLedger(reference, call)).toEqual({ ...f.receipt, status: "already-committed" })
          f.authority.host.requestFor = (trusted) =>
            observation.changed && mutation === "request" && trusted === call ? replacement : requestFor(trusted)
          f.authority.host.revalidate = async (trusted) => {
            const permitted = await revalidate(trusted)
            if (trusted !== call) return permitted
            observation.calls += 1
            if (permitted && observation.target > 0 && observation.calls === observation.target) {
              expect(requestFor(trusted)).toBe(request)
              if (mutation === "headers") request.headers.set("x-m40-replay-fence", "changed-after-revalidation")
              if (mutation === "abort") controller.abort()
              if (mutation === "finished-lease") f.authority.ui.finish(call)
              observation.changed = true
            }
            return permitted
          }
          expect(await f.memory.emitFromLedger(reference, call)).toEqual({ ...f.receipt, status: "already-committed" })
          expect(observation.calls).toBeGreaterThan(0)
          observation.target = observation.calls
          observation.calls = 0
          const result = await f.memory.emitFromLedger(reference, call)
          observations.push({ mutation, status: result.status, eventId: result.eventId, recordDigest: result.recordDigest })
          expect(observation.changed).toBe(true)
          expect(observation.calls).toBe(observation.target)
          expect(request.signal.aborted).toBe(mutation === "abort")
          expect(request.headers.get("Idempotency-Key")).toBe(f.replayKey)
          expect(digestSfValue(reference)).toBe(identity)
          if (mutation === "headers") expect(request.headers.get("x-m40-replay-fence")).toBe("changed-after-revalidation")
          if (mutation === "request") {
            expect(f.authority.host.requestFor(call)).toBe(replacement)
            expect([...replacement.headers.entries()]).toEqual([...request.headers.entries()])
          }
          if (mutation === "finished-lease") expect(requestFor(call)).toBeUndefined()
          expect(await f.audit()).toEqual(before)
          console.info("SF_MEMORY_REPLAY_LATE_FENCE", JSON.stringify({ mutation, result: result.status,
            realRevalidations: observation.calls, mutationAfterLastRevalidation: true,
            sameReferenceAndKey: true, counts: before.counts, nativeSessionWitness: false }))
        }, request)
      } finally {
        f.authority.host.revalidate = revalidate
        f.authority.host.requestFor = requestFor
      }
      // Faults belong to the old registered call. A new intact admission can
      // still recover the exact durable receipt, without scanning or appending.
      expect(await f.replay()).toEqual({ ...f.receipt, status: "already-committed" })
      expect(await f.audit()).toEqual(before)
    }
    expect(observations).toEqual(["headers", "request", "abort", "finished-lease"].map((mutation) =>
      ({ mutation, status: "unavailable", eventId: undefined, recordDigest: undefined })))
    expect(await f.audit()).toEqual(before)
  })
}, 180_000)

test("Settled replay refuses actual credential revocation after the last real document resolution", async () => {
  expectSpawn(import.meta.path)
  await withDocumentReplayFixture(async (f) => {
    const before = await f.audit()
    const reference = f.eventRef
    const identity = digestSfValue(reference)
    const request = f.replayRequest()
    const source = f.sources[0]!
    const resolve = f.atlas.context.resolve
    const observation = { reads: 0, target: 0, revoked: false, resolutionWasFresh: false }
    try {
      await f.ui("sf_evidence_get", { evidenceRef: reference }, async (call) => {
        expect(await f.memory.emitFromLedger(reference, call)).toEqual({ ...f.receipt, status: "already-committed" })
        f.atlas.context.resolve = async (incoming, trusted) => {
          // The production reader completes first. The hook changes the real
          // credential only after it produced an authorized current document.
          const resolved = await resolve(incoming, trusted)
          if (trusted !== call || incoming.refDigest !== source.ref.refDigest) return resolved
          observation.reads += 1
          if (observation.target > 0 && observation.reads === observation.target) {
            expect(resolved.state).toBe("fresh")
            expect(resolved.currentRef).toEqual(source.ref)
            expect(resolved.authorizedProjection).toEqual(source.evidence)
            expect(f.authority.host.requestFor(trusted)).toBe(request)
            observation.resolutionWasFresh = true
            const logout = await f.app.identity.handle(new Request(`${f.app.origin}/sucafina/auth/logout`, {
              method: "POST", headers: { cookie: f.app.cookie, origin: f.app.origin },
            }))
            expect(logout?.status).toBe(204)
            observation.revoked = true
          }
          return resolved
        }
        expect(await f.memory.emitFromLedger(reference, call)).toEqual({ ...f.receipt, status: "already-committed" })
        expect(observation.reads).toBeGreaterThan(0)
        observation.target = observation.reads
        observation.reads = 0
        const result = await f.memory.emitFromLedger(reference, call)
        expect(observation.revoked).toBe(true)
        expect(observation.resolutionWasFresh).toBe(true)
        expect(observation.reads).toBe(observation.target)
        expect(request.signal.aborted).toBe(false)
        expect(request.headers.get("Idempotency-Key")).toBe(f.replayKey)
        expect(digestSfValue(reference)).toBe(identity)
        expect(await f.authority.host.revalidate(call)).toBe(false)
        expect({ status: result.status, eventId: result.eventId, recordDigest: result.recordDigest })
          .toEqual({ status: "unavailable", eventId: undefined, recordDigest: undefined })
        expect(await f.audit()).toEqual(before)
        console.info("SF_MEMORY_REPLAY_LATE_CREDENTIAL_REVOCATION", JSON.stringify({ result: result.status,
          realDocumentResolutions: observation.reads, sourceWasFreshBeforeRevocation: true,
          credentialRevokedAfterLastResolution: true, sameReferenceAndKey: true,
          auditDigest: digestSfValue(before), counts: before.counts, nativeSessionWitness: false }))
      }, request)
    } finally { f.atlas.context.resolve = resolve }
    expect(await f.audit()).toEqual(before)
  })
}, 180_000)

test("Settled replay refuses capture corruption after the last real source resolution without repairing it", async () => {
  expectSpawn(import.meta.path)
  await withDocumentReplayFixture(async (f) => {
    const before = await f.audit()
    const reference = f.eventRef
    const identity = digestSfValue(reference)
    const request = f.replayRequest()
    const source = f.sources[0]!
    const resolve = f.atlas.context.resolve
    const observation = { reads: 0, target: 0, changed: false }
    const fault: { intact?: Record<string, unknown>; corrupted?: Awaited<ReturnType<typeof f.audit>> } = {}
    try {
      await f.ui("sf_evidence_get", { evidenceRef: reference }, async (call) => {
        expect(await f.memory.emitFromLedger(reference, call)).toEqual({ ...f.receipt, status: "already-committed" })
        f.atlas.context.resolve = async (incoming, trusted) => {
          const resolved = await resolve(incoming, trusted)
          if (trusted !== call || incoming.refDigest !== source.ref.refDigest) return resolved
          observation.reads += 1
          if (observation.target > 0 && observation.reads === observation.target) {
            expect(resolved.state).toBe("fresh")
            expect(resolved.currentRef).toEqual(source.ref)
            expect(resolved.authorizedProjection).toEqual(source.evidence)
            expect(f.authority.host.requestFor(trusted)).toBe(request)
            // The real reader has completed. Mutate only stored capture bytes;
            // committed captureDigests and namespace versions stay untouched.
            fault.intact = await f.corruptCapture(source)
            fault.corrupted = await f.audit()
            observation.changed = true
          }
          return resolved
        }
        expect(await f.memory.emitFromLedger(reference, call)).toEqual({ ...f.receipt, status: "already-committed" })
        expect(observation.reads).toBeGreaterThan(0)
        observation.target = observation.reads
        observation.reads = 0
        const result = await f.memory.emitFromLedger(reference, call)
        expect(observation.changed).toBe(true)
        expect(observation.reads).toBe(observation.target)
        expect(fault.intact).toBeDefined()
        expect(fault.corrupted).toBeDefined()
        if (!fault.intact || !fault.corrupted) throw new Error("Late capture fault was not injected")
        expect(fault.corrupted).not.toEqual(before)
        expect(fault.corrupted.counts).toEqual(before.counts)
        expect(fault.corrupted.versions).toEqual(before.versions)
        const originalPartition = Object.values(object(before.atlas)).map(object).find((partition) => object(partition.originals)[source.ref.refDigest])
        const corruptedPartition = Object.values(object(fault.corrupted.atlas)).map(object).find((partition) => object(partition.originals)[source.ref.refDigest])
        expect(originalPartition).toBeDefined()
        expect(corruptedPartition).toBeDefined()
        expect(object(corruptedPartition).captureDigests).toEqual(object(originalPartition).captureDigests)
        expect(object(object(object(corruptedPartition).originals)[source.ref.refDigest]).ref).toEqual(source.ref)
        expect(request.signal.aborted).toBe(false)
        expect(request.headers.get("Idempotency-Key")).toBe(f.replayKey)
        expect(digestSfValue(reference)).toBe(identity)
        expect({ status: result.status, eventId: result.eventId, recordDigest: result.recordDigest })
          .toEqual({ status: "unavailable", eventId: undefined, recordDigest: undefined })
        // The baseline here is the snapshot taken immediately after explicit
        // corruption. Runtime recovery must neither append nor silently repair.
        expect(await f.audit()).toEqual(fault.corrupted)
        f.atlas.context.resolve = resolve
        expect((await f.resolve(source)).state).toBe("fresh")
        await f.restoreCapture(source, fault.intact)
        expect(await f.memory.emitFromLedger(reference, call)).toEqual({ ...f.receipt, status: "already-committed" })
        expect(await f.audit()).toEqual(before)
        console.info("SF_MEMORY_REPLAY_LATE_CAPTURE_CORRUPTION", JSON.stringify({ result: result.status,
          realDocumentResolutions: observation.reads, corruptionAfterLastResolution: true,
          captureDigestsPreserved: true, noAutomaticRepair: true, restoredReplay: "already-committed",
          corruptedAuditDigest: digestSfValue(fault.corrupted), counts: before.counts, nativeSessionWitness: false }))
      }, request)
    } finally { f.atlas.context.resolve = resolve }
    expect(await f.audit()).toEqual(before)
  })
}, 180_000)
