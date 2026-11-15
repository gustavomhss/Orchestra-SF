import { expect, test } from "bun:test"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { revalidateSfAtlasRecall } from "../../../product/host-binding/atlas-memory.ts"
import { withComposedDocumentReplayFixture } from "./composed-document-fixture.ts"
import { readOriginalRaw, requireOriginalRecord } from "./fixture-assertions.ts"
import { publishSecondDocumentCase } from "./second-case-fixture.ts"

test("M69 complete recall preserves two real cases and consumes only original same-call reader observations", async () => {
  expectSpawn(import.meta.path)
  await withComposedDocumentReplayFixture(async (f) => {
    const second = await publishSecondDocumentCase(f)
    expect(second.caseRef).not.toEqual(f.caseRef)
    expect(second.receipt.eventId).not.toBe(f.receipt.eventId)
    const before = await f.audit()
    expect(before.counts).toMatchObject({ scans: 2, events: 2, envelopes: 2, outbox: 2, settled: 2 })
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

      const readGroups = async () => {
        const first = await readOriginalRaw(f, call)
        const another = await f.memory.recall(second.caseRef, call)
        expect(another.status).toBe("ok")
        if (another.status !== "ok") throw new Error("Second actual raw recall unavailable")
        expect(another.records).toHaveLength(1)
        expect(another.records[0]?.recordDigest).toBe(second.receipt.recordDigest)
        return [first, another.records]
      }
      const groups = await readGroups()
      expect(await revalidateSfAtlasRecall(groups, call)).toBe(true)
      expect(await revalidateSfAtlasRecall(groups, call)).toBe(false)

      for (const mutation of ["order", "membership"] as const) {
        const changingGroups = await readGroups()
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
          expect(await revalidateSfAtlasRecall(await readGroups(), call)).toBe(true)
          expect(await f.audit()).toEqual(before)
        } finally { f.authority.host.revalidate = revalidate }
      }

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
    expect(await f.replay()).toEqual({ ...f.receipt, status: "already-committed" })
    expect(await second.replay()).toEqual({ ...second.receipt, status: "already-committed" })
    expect(await f.audit()).toEqual(before)
    console.info("SF_MEMORY_M69_MULTI_CASE_COMPLETION", JSON.stringify({
      publicRecords: 2, authenticatedEmptySelection: true, originalGroupsAccepted: true, replayedObservationDenied: true,
      copiedArrayDenied: true, otherActualCallDenied: true, mixedReadersDenied: true,
      groupOrderChangedDuringRealRevalidationDenied: true, groupMembershipChangedDuringRealRevalidationDenied: true,
      sameDurableReceipts: true, counts: before.counts, nativeSessionWitness: false,
    }))
  })
}, 180_000)
