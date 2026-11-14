import { expect, test } from "bun:test"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { withDocumentReplayFixture } from "./document-fixture.ts"

test("C17 original and settled replay with light case ACL revalidate bytes and immutable captures without effects", async () => {
  expectSpawn(import.meta.path)
  await withDocumentReplayFixture(async (f) => {
    const source = f.sources[0]!
    const baseline = await f.audit()
    expect(baseline.counts).toMatchObject({ events: 1, envelopes: 1, outbox: 1, settled: 1, scans: 1 })
    expect(f.receipt.scanner).toEqual({ name: "gitleaks", version: f.scannerPin.version, status: "clean" })
    expect(source.evidence).toMatchObject({ status: "confirmed", value: 42, unit: "USD" })
    expect(await f.resolve()).toMatchObject({ state: "fresh", currentRef: source.ref, authorizedProjection: source.evidence })
    expect(await f.original()).toEqual(source.ref)
    expect(await f.replay()).toEqual({ ...f.receipt, status: "already-committed" })
    expect(await f.audit()).toEqual(baseline)

    // Inject only capture projection corruption, preserving its committed hash.
    const intactCapture = await f.corruptCapture(source)
    const corrupted = await f.audit()
    expect(corrupted).not.toEqual(baseline)
    expect(corrupted.counts).toEqual(baseline.counts)
    expect(corrupted.versions).toEqual(baseline.versions)
    expect((await f.resolve()).state).toBe("fresh")
    const originalAfterCorruption = await f.original()
    const replayAfterCorruption = await f.replay()
    expect(await f.audit()).toEqual(corrupted)
    await f.restoreCapture(source, intactCapture)
    expect(await f.original()).toEqual(source.ref)
    expect(await f.replay()).toEqual({ ...f.receipt, status: "already-committed" })
    expect(await f.audit()).toEqual(baseline)

    // This other operator has a real credential and grant, but is not a case
    // participant. The authority decision is not a forged test callback.
    await f.ui("sf_evidence_get", { evidenceRef: f.eventRef }, async (call) => {
      expect(call.binding.principalRef).toBe(f.app.otherPrincipal.id)
      expect(await f.atlas.memory.readOriginal(f.caseRef, source.ref.refDigest, call)).toBeUndefined()
      const denied = await f.memory.emitFromLedger(f.eventRef, call)
      expect(denied.status).toBe("unavailable")
      expect(denied.eventId).toBeUndefined()
      expect(denied.recordDigest).toBeUndefined()
    }, f.replayRequest(f.app.otherCookie))
    expect(await f.original(source, { ...f.caseRef, id: "other-case" })).toBeUndefined()
    expect(await f.original(source, { ...f.caseRef, incarnation: "other-incarnation" })).toBeUndefined()
    expect(await f.original()).toEqual(source.ref)
    expect(await f.audit()).toEqual(baseline)

    // Equal-length real blob replacement retains ID, metadata and incarnation.
    // Both operations are observed before asserting, exposing each pre-fix leak.
    // Blob generations are monotonic: restoring bytes would not restore revision.
    await f.replaceBytes(source, new TextEncoder().encode("Price: 99"))
    const changed = await f.resolve()
    expect(changed.state).not.toBe("fresh")
    expect(changed.currentRef).toBeUndefined()
    expect(changed.authorizedProjection).toBeUndefined()
    const originalAfterBytes = await f.original()
    const replayAfterBytes = await f.replay()
    console.info("SF_MEMORY_ORIGINAL_C17_DISCRIMINATOR", JSON.stringify({ originalReturned: originalAfterBytes !== undefined,
      replayStatus: replayAfterBytes.status, corruptedCaptureOriginalReturned: originalAfterCorruption !== undefined,
      corruptedCaptureReplayStatus: replayAfterCorruption.status, sameOutboxKeyAndPayload: true, sameRequestKey: f.replayRequest().headers.get("Idempotency-Key") === f.replayKey,
      lightCaseAcl: true, scans: f.counts.scans, nativeSessionWitness: false }))
    expect({ bytes: { original: originalAfterBytes, replay: replayAfterBytes.status, eventId: replayAfterBytes.eventId, recordDigest: replayAfterBytes.recordDigest },
      capture: { original: originalAfterCorruption, replay: replayAfterCorruption.status, eventId: replayAfterCorruption.eventId, recordDigest: replayAfterCorruption.recordDigest } })
      .toEqual({ bytes: { original: undefined, replay: "unavailable", eventId: undefined, recordDigest: undefined },
        capture: { original: undefined, replay: "unavailable", eventId: undefined, recordDigest: undefined } })
    expect(await f.audit()).toEqual(baseline)
    console.info("SF_MEMORY_ORIGINAL_C17_PROOF", JSON.stringify({ scenario: "bytes-capture-principal", auditDigest: digestSfValue(baseline),
      counts: baseline.counts, intactCaptureRestored: true, lightCaseAcl: true, nativeSessionWitness: false }))
  })
}, 180_000)

test("C17 original A and light replay require every current dependency after B deletion and same-ID reincarnation", async () => {
  expectSpawn(import.meta.path)
  await withDocumentReplayFixture(async (f) => {
    const sourceA = f.sources[0]!
    const sourceB = f.sources[1]!
    const baseline = await f.audit()
    expect(f.eventRef.target.evidenceRefs).toEqual([sourceA.ref, sourceB.ref])
    expect(await f.original(sourceA)).toEqual(sourceA.ref)
    expect(await f.original(sourceB)).toEqual(sourceB.ref)
    expect(await f.replay()).toEqual({ ...f.receipt, status: "already-committed" })
    expect(await f.audit()).toEqual(baseline)

    // B is physically removed through the real attachment cleanup and lifecycle
    // persistence, while A's bytes and independently authorized read stay intact.
    await f.removeSource(sourceB)
    expect((await f.resolve(sourceA)).state).toBe("fresh")
    const removedB = await f.resolve(sourceB)
    expect(removedB.currentRef).toBeUndefined()
    expect(removedB.authorizedProjection).toBeUndefined()
    const originalWithoutB = await f.original(sourceA)
    const replayWithoutB = await f.replay()
    expect({ original: originalWithoutB, replay: replayWithoutB.status, eventId: replayWithoutB.eventId, recordDigest: replayWithoutB.recordDigest })
      .toEqual({ original: undefined, replay: "unavailable", eventId: undefined, recordDigest: undefined })
    expect(await f.audit()).toEqual(baseline)

    const recreated = await f.recreateSource(sourceB)
    expect(recreated).toBeDefined()
    expect(recreated?.incarnation).not.toBe(sourceB.ref.target.incarnation)
    expect((await f.resolve(sourceA)).state).toBe("fresh")
    const replacedB = await f.resolve(sourceB)
    expect(replacedB.currentRef).toBeUndefined()
    expect(replacedB.authorizedProjection).toBeUndefined()
    const originalAfterRecreation = await f.original(sourceA)
    const replayAfterRecreation = await f.replay()
    expect({ original: originalAfterRecreation, replay: replayAfterRecreation.status, eventId: replayAfterRecreation.eventId, recordDigest: replayAfterRecreation.recordDigest })
      .toEqual({ original: undefined, replay: "unavailable", eventId: undefined, recordDigest: undefined })
    expect(await f.audit()).toEqual(baseline)
    console.info("SF_MEMORY_ORIGINAL_ALL_DEPENDENCIES_PROOF", JSON.stringify({ requestedSource: "A", removedAndRecreatedSource: "B",
      sameAssetId: true, incarnationChanged: true, independentARead: "fresh", counts: baseline.counts,
      auditDigest: digestSfValue(baseline), lightCaseAcl: true, nativeSessionWitness: false }))
  }, 2)
}, 180_000)
