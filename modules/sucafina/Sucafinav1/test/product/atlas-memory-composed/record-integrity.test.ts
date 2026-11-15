import { expect, test } from "bun:test"
import { versioned } from "@orchestra/atlas-boundary/business-memory-ports"
import type { MemoryRecord } from "@orchestra/atlas-boundary/business-memory-ports"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { readSfMemoryCaptureIntegrity } from "../../../product/host-binding/business-context.ts"
import { createSfAtlasDurableMemory } from "../../../product/host-binding/atlas-store.ts"
import { object } from "../../../runtime/contract.ts"
import { withDocumentReplayFixture } from "../memory-original-reauthorization/document-fixture.ts"
import { readOriginalRaw, requireOriginalRecord, requireRecallDenied, settleRecall } from "./fixture-assertions.ts"
import type { DocumentFixture } from "./fixture-assertions.ts"
import type { BusinessMemoryEnvelope } from "../../../product/contracts/business-context.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

type RawRecall = Awaited<ReturnType<DocumentFixture["memory"]["recall"]>>
type PublicRecall = Awaited<ReturnType<DocumentFixture["atlas"]["context"]["recall"]>>
type RecallOutcome = { kind: "returned"; value: PublicRecall } | { kind: "rejected"; error: unknown }

async function consumeCapturedDocument(fixture: DocumentFixture, call: TrustedDomainContext) {
  const sources = await fixture.atlas.context.context({ refs: [fixture.sources[0]!.ref] }, call)
  expect(sources).toHaveLength(1)
  expect(sources[0]?.state).toBe("fresh")
  return fixture.app.store.transaction("dashboard", async () => ({
    commit: false,
    value: await readSfMemoryCaptureIntegrity(sources, { caseRefs: [fixture.caseRef], query: "supplier" }, call),
  }))
}

test("M69 raw public and private-consumer recall reject scanner and ledger projection tampering", async () => {
  expectSpawn(import.meta.path)
  await withDocumentReplayFixture(async (f) => {
    const before = await f.audit()
    const eventId = f.receipt.eventId
    if (!eventId) throw new Error("Actual Atlas publication has no event id")
    const selection = { caseRefs: [{ ...f.caseRef }], query: "supplier" }
    const observations: { fault: string; raw: RawRecall; public: RecallOutcome; consumed: boolean }[] = []
    await f.ui("sf_decision_recall", selection, async (call) => {
      await readOriginalRaw(f, call)
      requireOriginalRecord(f, await f.atlas.context.recall(selection, call))
      expect(await consumeCapturedDocument(f, call)).toBe(true)
      for (const fault of ["scanner-receipt-digest", "content-addressed-entry-without-ledger-change"] as const) {
        const changed = await f.app.store.transaction("dashboard", async (snapshot) => {
          const state = object(snapshot.data.__sfProductV1)
          const atlas = object(state.atlas)
          const owner = Object.keys(atlas).find((key) => object(object(atlas[key]).envelopes)[eventId])
          if (!owner) throw new Error("Real committed Atlas partition unavailable for explicit integrity fault")
          const partition = object(atlas[owner])
          const intact = structuredClone(partition)
          const envelopes = object(partition.envelopes)
          const envelope = envelopes[eventId] as BusinessMemoryEnvelope
          const events = partition.events as Parameters<typeof createSfAtlasDurableMemory>[0]["events"]
          const index = events.findIndex(([id]) => id === eventId)
          const stored = events[index]
          if (!stored || !envelope) throw new Error("Actual event/envelope pair unavailable for integrity fault")
          const record = stored[1].payload as MemoryRecord
          if (record.kind !== "task" || !("taskId" in record.entry)) throw new Error("Fixture published an unexpected record kind")
          if (fault === "scanner-receipt-digest") {
            envelopes[eventId] = { ...envelope, scannerReceipt: { ...envelope.scannerReceipt,
              digest: digestSfValue({ fault: "M69 scanner digest differs from the actual committed record" }) } }
          } else {
            // Explicit storage corruption, never a publication: produce a valid
            // content-addressed Atlas event so the remaining oracle is its
            // relationship with the unchanged authorized case ledger.
            const replacement: MemoryRecord = { ...record, entry: { ...record.entry,
              lesson: "M69 corrupted lesson absent from the accepted case ledger" } }
            const generated = [...versioned([replacement])][0]
            if (!generated) throw new Error("Real Atlas versioning did not produce the replacement fault")
            const [replacementId, replacementEvent] = generated
            events[index] = [replacementId, { ...replacementEvent, seq: stored[1].seq }]
            delete envelopes[eventId]
            envelopes[replacementId] = { ...envelope, eventId: replacementId,
              projectionDigest: digestSfValue({ kind: replacement.kind, owner: replacement.owner, entry: replacement.entry,
                sourceEventId: envelope.sourceEventId, evidenceRefs: envelope.evidenceRefs }),
              scannerReceipt: { ...envelope.scannerReceipt, digest: digestSfValue(replacement) } }
            const captureDigests = object(partition.captureDigests)
            captureDigests[replacementId] = captureDigests[eventId]
            delete captureDigests[eventId]
          }
          return { commit: true, value: { owner, intact, corrupted: structuredClone(partition),
            ledger: structuredClone(object(object(state.cases)[f.caseRef.id]).ledger) } }
        })
        const corrupted = await f.audit()
        expect(corrupted).not.toEqual(before)
        expect(corrupted.counts).toEqual(before.counts)
        expect(corrupted.versions).toEqual(before.versions)
        expect(changed.corrupted.originals).toEqual(changed.intact.originals)
        const normalized = structuredClone(corrupted)
        object(normalized.atlas)[changed.owner] = changed.intact
        expect(normalized).toEqual(before)
        const events = changed.corrupted.events as Parameters<typeof createSfAtlasDurableMemory>[0]["events"]
        const loaded = createSfAtlasDurableMemory({ events }).read()
        expect(loaded.rejected).toBe(0)
        expect(loaded.log.size).toBe(1)
        const raw = await f.memory.recall(f.caseRef, call)
        const publicRecall = await settleRecall(f.atlas.context.recall(selection, call))
        const consumed = await consumeCapturedDocument(f, call)
        observations.push({ fault, raw, public: publicRecall, consumed })
        expect(await f.audit()).toEqual(corrupted)
        const ledger = await f.app.store.transaction("dashboard", async (snapshot) => ({
          commit: false, value: structuredClone(object(object(object(snapshot.data.__sfProductV1).cases)[f.caseRef.id]).ledger),
        }))
        expect(ledger).toEqual(changed.ledger)
        await f.app.store.transaction("dashboard", async (snapshot) => {
          object(object(snapshot.data.__sfProductV1).atlas)[changed.owner] = structuredClone(changed.intact)
          return { commit: true, value: undefined }
        })
        await readOriginalRaw(f, call)
        requireOriginalRecord(f, await f.atlas.context.recall(selection, call))
        expect(await consumeCapturedDocument(f, call)).toBe(true)
        expect(await f.audit()).toEqual(before)
        console.info("SF_MEMORY_M69_RECORD_INTEGRITY", JSON.stringify({
          fault, raw: raw.status, public: publicRecall.kind, privateConsumer: consumed,
          returnedRawRecords: raw.status === "ok" ? raw.records.length : 0,
          returnedPublicRecords: publicRecall.kind === "returned" ? publicRecall.value.length : 0,
          atlasWireRemainsValid: true, ledgerDigest: digestSfValue(ledger), originalsPreserved: true,
          restoredEventId: f.receipt.eventId, restoredRecordDigest: f.receipt.recordDigest,
          counts: before.counts, nativeSessionWitness: false,
        }))
      }
    })
    // Both explicit faults and both restoration positives run before the
    // baseline counterexample is asserted, so one escape cannot hide the other.
    expect(observations).toHaveLength(2)
    for (const observation of observations) {
      expect(observation.raw).toEqual({ status: "unavailable" })
      requireRecallDenied(observation.public)
      expect(observation.consumed).toBe(false)
    }
    expect(await f.audit()).toEqual(before)
  })
}, 180_000)
