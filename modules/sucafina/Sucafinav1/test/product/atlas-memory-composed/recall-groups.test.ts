import { expect, test } from "bun:test"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { revalidateSfAtlasRecall } from "../../../product/host-binding/atlas-memory.ts"
import { withComposedDocumentReplayFixture } from "./composed-document-fixture.ts"
import { readOriginalRaw, requireOriginalRecord, type DocumentFixture } from "./fixture-assertions.ts"
import { publishSecondDocumentCase } from "./second-case-fixture.ts"

type SecondCase = Awaited<ReturnType<typeof publishSecondDocumentCase>>
type RecallCall = Parameters<DocumentFixture["memory"]["recall"]>[1]
type Audit = Awaited<ReturnType<DocumentFixture["audit"]>>

/** Each split retains two real publications and both exact settled replays.
 * Each independent test keeps the original 180000ms ceiling.
 * F1's monolithic deadline remains failed; this split does not prove that
 * original whole sequence completed within its deadline. */
async function withTwoPublishedCases(marker: string, work: (
  fixture: DocumentFixture, second: SecondCase, before: Audit,
) => Promise<Record<string, boolean | number>>) {
  await withComposedDocumentReplayFixture(async (f) => {
    const second = await publishSecondDocumentCase(f)
    expect(second.caseRef).not.toEqual(f.caseRef)
    expect(second.receipt.eventId).not.toBe(f.receipt.eventId)
    const before = await f.audit()
    expect(before.counts).toMatchObject({ scans: 2, events: 2, envelopes: 2, outbox: 2, settled: 2 })
    const observations = await work(f, second, before)
    expect(await f.replay()).toEqual({ ...f.receipt, status: "already-committed" })
    expect(await second.replay()).toEqual({ ...second.receipt, status: "already-committed" })
    expect(await f.audit()).toEqual(before)
    console.info(marker, JSON.stringify({
      ...observations, sameDurableReceipts: true, counts: before.counts, nativeSessionWitness: false,
    }))
  })
}

async function readGroups(f: DocumentFixture, second: SecondCase, call: RecallCall) {
  const first = await readOriginalRaw(f, call)
  const another = await f.memory.recall(second.caseRef, call)
  expect(another.status).toBe("ok")
  if (another.status !== "ok") throw new Error("Second actual raw recall unavailable")
  expect(another.records).toHaveLength(1)
  expect(another.records[0]?.recordDigest).toBe(second.receipt.recordDigest)
  return [first, another.records]
}

test("M69 complete public recall preserves two real cases, authenticated empty selection and one-use original groups", async () => {
  expectSpawn(import.meta.path)
  await withTwoPublishedCases("SF_MEMORY_M69_MULTI_CASE_PUBLIC", async (f, second, before) => {
    const emptySelection = { caseRefs: [], query: "supplier" }
    await f.ui("sf_decision_recall", emptySelection, async (call) => {
      expect(await f.atlas.context.recall(emptySelection, call)).toEqual([])
    })
    expect(await f.audit()).toEqual(before)
    const selection = { caseRefs: [{ ...f.caseRef }, { ...second.caseRef }], query: "supplier" }
    await f.ui("sf_decision_recall", selection, async (call) => {
      const publicRecords = await f.atlas.context.recall(selection, call)
      expect(publicRecords).toHaveLength(2)
      expect(new Set(publicRecords.map((record) => record.envelope.eventId)))
        .toEqual(new Set([f.receipt.eventId, second.receipt.eventId]))
      requireOriginalRecord(f, publicRecords.filter((record) => record.envelope.eventId === f.receipt.eventId))
      const secondRecord = publicRecords.find((record) => record.envelope.eventId === second.receipt.eventId)
      if (!secondRecord) throw new Error("Public multi-case recall dropped the second actual record")
      expect(secondRecord.envelope.caseRef).toMatchObject(second.caseRef)
      expect(secondRecord.envelope.sourceEventId).toBe(second.eventRef.target.eventId)
      expect(secondRecord.envelope.scannerReceipt.digest).toBe(second.receipt.recordDigest)
      expect(digestSfValue({ kind: secondRecord.envelope.kind, owner: secondRecord.envelope.owner, entry: secondRecord.entry }))
        .toBe(second.receipt.recordDigest)
      const groups = await readGroups(f, second, call)
      expect(await revalidateSfAtlasRecall(groups, call)).toBe(true)
      expect(await revalidateSfAtlasRecall(groups, call)).toBe(false)
      expect(await f.audit()).toEqual(before)
    })
    return { publicRecords: 2, authenticatedEmptySelection: true, originalGroupsAccepted: true, replayedObservationDenied: true }
  })
}, 180_000)

async function proveLateGroupMutation(mutation: "order" | "membership") {
  const marker = mutation === "order" ? "SF_MEMORY_M69_GROUP_ORDER_FENCE" : "SF_MEMORY_M69_GROUP_MEMBERSHIP_FENCE"
  await withTwoPublishedCases(marker, async (f, second, before) => {
    const selection = { caseRefs: [{ ...f.caseRef }, { ...second.caseRef }], query: "supplier" }
    await f.ui("sf_decision_recall", selection, async (call) => {
      expect(await revalidateSfAtlasRecall(await readGroups(f, second, call), call)).toBe(true)
      const changingGroups = await readGroups(f, second, call)
      const originalGroups = [...changingGroups]
      const revalidate = f.authority.host.revalidate
      const observation = { calls: 0, changed: false }
      try {
        f.authority.host.revalidate = async (trusted) => {
          const permitted = await revalidate(trusted)
          if (trusted !== call) return permitted
          observation.calls += 1
          if (permitted && !observation.changed) {
            if (mutation === "order") changingGroups.reverse()
            else changingGroups.splice(1, 1)
            observation.changed = true
          }
          return permitted
        }
        const result = await revalidateSfAtlasRecall(changingGroups, call)
        f.authority.host.revalidate = revalidate
        expect(observation.calls).toBeGreaterThan(0)
        expect(observation.changed).toBe(true)
        if (mutation === "order") {
          expect(changingGroups).toHaveLength(2)
          expect(changingGroups[0]).toBe(originalGroups[1])
          expect(changingGroups[1]).toBe(originalGroups[0])
        } else {
          expect(changingGroups).toHaveLength(1)
          expect(changingGroups[0]).toBe(originalGroups[0])
        }
        expect(result).toBe(false)
        expect(await revalidateSfAtlasRecall(await readGroups(f, second, call), call)).toBe(true)
        expect(await f.audit()).toEqual(before)
      } finally { f.authority.host.revalidate = revalidate }
    })
    return { originalGroupsAccepted: true, changedDuringRealRevalidation: true, changedGroupDenied: true, intactGroupsAcceptedAfter: true }
  })
}

test("M69 complete recall rejects group order changed during real revalidation and preserves intact groups", async () => {
  expectSpawn(import.meta.path)
  await proveLateGroupMutation("order")
}, 180_000)

test("M69 complete recall rejects group membership changed during real revalidation and preserves intact groups", async () => {
  expectSpawn(import.meta.path)
  await proveLateGroupMutation("membership")
}, 180_000)

test("M69 complete recall binds observations to their original arrays, actual call and actual reader", async () => {
  expectSpawn(import.meta.path)
  await withTwoPublishedCases("SF_MEMORY_M69_OBSERVATION_BINDINGS", async (f, second, before) => {
    const selection = { caseRefs: [{ ...f.caseRef }, { ...second.caseRef }], query: "supplier" }
    await f.ui("sf_decision_recall", selection, async (call) => {
      const copied = await readOriginalRaw(f, call)
      expect(await revalidateSfAtlasRecall([structuredClone(copied)], call)).toBe(false)
      expect(await revalidateSfAtlasRecall([copied], call)).toBe(true)

      const wrongCall = await readOriginalRaw(f, call)
      await f.ui("sf_decision_recall", selection, async (other) => {
        expect(other).not.toBe(call)
        expect(await revalidateSfAtlasRecall([wrongCall], other)).toBe(false)
      })
      // An unsuccessful cross-call attempt consumes the private observation.
      expect(await revalidateSfAtlasRecall([wrongCall], call)).toBe(false)

      const firstReader = await readOriginalRaw(f, call)
      const otherReader = await f.atlas.memory.recall(f.caseRef, call)
      expect(otherReader.status).toBe("ok")
      if (otherReader.status !== "ok") throw new Error("Second real reader unavailable")
      requireOriginalRecord(f, otherReader.records)
      expect(await revalidateSfAtlasRecall([firstReader, otherReader.records], call)).toBe(false)
      expect(await revalidateSfAtlasRecall([await readOriginalRaw(f, call)], call)).toBe(true)
      expect(await f.audit()).toEqual(before)
    })
    return { copiedArrayDenied: true, originalArrayAccepted: true, otherActualCallDenied: true,
      crossCallObservationConsumed: true, mixedReadersDenied: true, intactReaderAcceptedAfter: true }
  })
}, 180_000)
