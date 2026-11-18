import { expect, test } from "bun:test"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { deriveAuthorizedRecallFeatures } from "../../../product/decision-memory/case-features.ts"
import { rankSfAtlasRecall } from "../../../product/host-binding/atlas-memory.ts"
import type { BusinessMemoryEnvelope, MemoryWriteReceipt, SfAtlasProjection } from "../../../product/contracts/business-context.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { withDocumentReplayFixture } from "../memory-original-reauthorization/document-fixture.ts"
import { readOriginalRaw } from "./fixture-assertions.ts"
import type { DocumentFixture } from "./fixture-assertions.ts"
import { prepareDocumentRankCase } from "./rank-tail-fixture.ts"

type RecallResult = Awaited<ReturnType<DocumentFixture["memory"]["recall"]>>
type RecallRecord = Extract<RecallResult, { status: "ok" }>["records"][number]
type RankResult = Awaited<ReturnType<typeof rankSfAtlasRecall>>
const runtimeVersions = () => ({ boundaryVersion: "1", schemaVersion: "1", manifestVersion: "1", skillVersion: "1" })

function requirePublishedRecords(records: readonly { envelope: BusinessMemoryEnvelope; entry: SfAtlasProjection["entry"]; recordDigest: string }[], receipts: readonly MemoryWriteReceipt[]) {
  expect(records).toHaveLength(receipts.length)
  expect(new Set(records.map((record) => record.envelope.eventId))).toEqual(new Set(receipts.map((receipt) => receipt.eventId)))
  for (const receipt of receipts) {
    const matches = records.filter((record) => record.envelope.eventId === receipt.eventId)
    expect(matches).toHaveLength(1)
    const record = matches[0]
    if (!record) throw new Error("Rank omitted an actual published record")
    expect(record.envelope.sourceEventId).toBe(receipt.sourceEventId)
    expect(record.recordDigest).toBe(receipt.recordDigest)
    expect(digestSfValue({ owner: record.envelope.owner, kind: record.envelope.kind, entry: record.entry })).toBe(receipt.recordDigest)
    expect(record.envelope.scannerReceipt).toEqual({ ...receipt.scanner, digest: receipt.recordDigest })
  }
}

function requireRank(result: RankResult, receipts: readonly MemoryWriteReceipt[]) {
  expect(result.status).toBe("ok")
  if (result.status !== "ok") throw new Error("Actual documentary rank was unavailable")
  expect(result.cases).toHaveLength(receipts.length)
  expect(result.cases.every((match) => match.matchedCriteria.includes("decision-type"))).toBe(true)
  requirePublishedRecords(result.records, receipts)
  return result
}

function rankInput(fixture: DocumentFixture, call: TrustedDomainContext, record: RecallRecord) {
  const features = deriveAuthorizedRecallFeatures(record.case, call)
  if (!features) throw new Error("Actual authorized case did not yield documentary recall features")
  expect(features).toMatchObject({ decisionType: "supplier-document-review", resultAvailable: false })
  return { memory: fixture.memory, caseRefs: [{ ...fixture.caseRef }], features,
    featuresForCase: async (value: Parameters<typeof deriveAuthorizedRecallFeatures>[0], trusted: TrustedDomainContext) => deriveAuthorizedRecallFeatures(value, trusted),
    runtimeVersions: runtimeVersions(), call, proveContinuity: fixture.atlas.proveContinuity,
    revalidate: (trusted: TrustedDomainContext) => fixture.authority.host.revalidate(trusted) }
}

test("M69 rank returns both real event records from the final case group after an older egress object changes", async () => {
  expectSpawn(import.meta.path)
  await withDocumentReplayFixture(async (f) => {
    const second = await prepareDocumentRankCase(f, true)
    if (!second) throw new Error("Actual second publication missing")
    const receipts = [f.receipt, second.receipt]
    expect(second.eventRef.target.caseId).toBe(f.caseRef.id)
    expect(second.eventRef.target.caseIncarnation).toBe(f.caseRef.incarnation)
    expect(second.receipt.eventId).not.toBe(f.receipt.eventId)
    const before = await f.audit()
    expect(before.counts).toMatchObject({ scans: 2, events: 2, envelopes: 2, outbox: 2, settled: 2 })
    const selection = { caseRefs: [{ ...f.caseRef }], query: "supplier" }
    await f.ui("sf_decision_recall", selection, async (call) => {
      const initial = await f.memory.recall(f.caseRef, call)
      if (initial.status !== "ok" || !initial.records[0]) throw new Error("Actual two-event recall unavailable")
      requirePublishedRecords(initial.records, receipts)
      const input = rankInput(f, call, initial.records[0])
      const recall = f.memory.recall
      const observed: { reads: number; firstEvent?: string; older?: RecallRecord; changed: boolean; latest?: readonly RecallRecord[] } = { reads: 0, changed: false }
      try {
        f.memory.recall = async (ref, trusted) => {
          const returned = await recall(ref, trusted)
          if (trusted !== call) return returned
          observed.reads += 1
          if (returned.status !== "ok") throw new Error("Real rank reread failed before the in-memory fault")
          requirePublishedRecords(returned.records, receipts)
          if (observed.reads === 1) observed.firstEvent = returned.records[0]?.envelope.eventId
          if (observed.reads === 2) observed.older = returned.records.find((record) => record.envelope.eventId === observed.firstEvent)
          if (observed.reads === 3) {
            if (!observed.older || !("lesson" in observed.older.entry)) throw new Error("Earlier actual egress record unavailable for the fault")
            observed.latest = returned.records
            // Fault only the object obtained from the preceding real read. The
            // durable event, capture, receipt and final real reader stay intact.
            Object.assign(observed.older.entry, { lesson: "M69 explicit mutation of an older completed egress object" })
            observed.changed = true
          }
          return returned
        }
        const ranked = await rankSfAtlasRecall(input)
        f.memory.recall = recall
        expect(observed.reads).toBe(3)
        expect(observed.changed).toBe(true)
        if (!observed.older || !observed.latest) throw new Error("Rank did not reach the intended stale-prefix boundary")
        expect(digestSfValue({ owner: observed.older.envelope.owner, kind: observed.older.envelope.kind, entry: observed.older.entry }))
          .not.toBe(observed.older.recordDigest)
        expect(observed.latest.includes(observed.older)).toBe(false)
        requirePublishedRecords(observed.latest, receipts)
        const result = requireRank(ranked, receipts)
        expect(await f.audit()).toEqual(before)
        console.info("SF_MEMORY_M69_RANK_FINAL_GROUP", JSON.stringify({ realEvents: 2, sameCase: true,
          realReads: observed.reads, olderEgressMutated: observed.changed, returnedOriginalRecords: result.records.length,
          latestReadIntact: true, counts: before.counts, syntheticDocumentClassification: true,
          acceptedLedgerPremise: true, financialCapture: false, nativeSessionWitness: false }))
      } finally { f.memory.recall = recall }
    })
    expect(await f.audit()).toEqual(before)
  })
}, 180_000)

// Each fault has its own real fixture and the existing 180 s ceiling. Counting
// actual authorizations selects the last await without replacing its decision.
for (const mutation of ["features", "runtimeVersions"] as const) {
  test(`M69 rank denies ${mutation} changed during its last real authority await and accepts the restored input`, async () => {
    expectSpawn(import.meta.path)
    await withDocumentReplayFixture(async (f) => {
      await prepareDocumentRankCase(f, false)
      const before = await f.audit()
      expect(before.counts).toMatchObject({ scans: 1, events: 1, envelopes: 1, outbox: 1, settled: 1 })
      const selection = { caseRefs: [{ ...f.caseRef }], query: "supplier" }
      await f.ui("sf_decision_recall", selection, async (call) => {
        const original = await readOriginalRaw(f, call)
        if (!original[0]) throw new Error("Actual rank feature source missing")
        const input = rankInput(f, call, original[0])
        const features = structuredClone(input.features)
        const versions = structuredClone(input.runtimeVersions)
        const request = f.authority.host.requestFor(call)
        const revalidate = f.authority.host.revalidate
        const observed = { checks: 0, target: 0, armed: false, changed: false, allowedAtFault: false, sameRequest: false }
        try {
          f.authority.host.revalidate = async (trusted) => {
            const permitted = await revalidate(trusted)
            if (trusted !== call) return permitted
            observed.checks += 1
            if (observed.armed && observed.checks === observed.target) {
              observed.allowedAtFault = permitted
              observed.sameRequest = f.authority.host.requestFor(trusted) === request
              if (mutation === "features") input.features.decisionType = "different-documentary-question"
              else input.runtimeVersions.boundaryVersion = "changed-after-ranking"
              observed.changed = true
            }
            return permitted
          }
          requireRank(await rankSfAtlasRecall(input), [f.receipt])
          observed.target = observed.checks
          expect(observed.target).toBeGreaterThan(0)
          observed.checks = 0
          observed.armed = true
          const denied = await rankSfAtlasRecall(input)
          f.authority.host.revalidate = revalidate
          expect(observed.checks).toBe(observed.target)
          expect(observed.changed).toBe(true)
          expect(observed.allowedAtFault).toBe(true)
          expect(observed.sameRequest).toBe(true)
          expect(mutation === "features" ? input.features.decisionType : input.runtimeVersions.boundaryVersion)
            .toBe(mutation === "features" ? "different-documentary-question" : "changed-after-ranking")
          Object.assign(input.features, features)
          Object.assign(input.runtimeVersions, versions)
          requireRank(await rankSfAtlasRecall(input), [f.receipt])
          expect(await f.audit()).toEqual(before)
          console.info("SF_MEMORY_M69_RANK_SELECTION_TAIL", JSON.stringify({ mutation,
            lastRealAuthorization: observed.target, authorityAllowedAtFault: observed.allowedAtFault,
            sameActualRequest: observed.sameRequest, denied: denied.status, restoredRecords: 1,
            counts: before.counts, syntheticDocumentClassification: true, financialCapture: false,
            nativeSessionWitness: false }))
          expect(denied).toEqual({ status: "unavailable" })
        } finally {
          f.authority.host.revalidate = revalidate
          Object.assign(input.features, features)
          Object.assign(input.runtimeVersions, versions)
        }
      })
      expect(await f.audit()).toEqual(before)
    })
  }, 180_000)
}
