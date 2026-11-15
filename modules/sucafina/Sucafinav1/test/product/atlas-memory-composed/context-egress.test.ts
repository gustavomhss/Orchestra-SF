import { expect, test } from "bun:test"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { withDocumentReplayFixture } from "../memory-original-reauthorization/document-fixture.ts"
import { readOriginalRaw, requireNestedWriteFence, requireOnlyCaptureFault, requireOriginalRecord, requireRecallDenied, settleRecall } from "./fixture-assertions.ts"
import type { BusinessEvidenceResolution } from "../../../product/contracts/business-context.ts"

test("M69 public recall rejects capture corruption after its real context returned authorized sources", async () => {
  expectSpawn(import.meta.path)
  await withDocumentReplayFixture(async (f) => {
    const before = await f.audit()
    const source = f.sources[0]!
    const request = f.replayRequest()
    const selection = { caseRefs: [{ ...f.caseRef }], query: "supplier" }
    const context = f.atlas.context.context
    const observation = { reads: 0, target: 0, attempted: false, sameRequest: false, committed: false }
    const fault: { intact?: Record<string, unknown>; error?: unknown; resolutions?: readonly BusinessEvidenceResolution[] } = {}
    try {
      await f.ui("sf_decision_recall", selection, async (call) => {
        requireOriginalRecord(f, await f.atlas.context.recall(selection, call))
        f.atlas.context.context = async (incoming, trusted) => {
          const resolved = await context(incoming, trusted)
          if (trusted !== call) return resolved
          observation.reads += 1
          if (observation.target > 0 && observation.reads === observation.target) {
            observation.attempted = true
            observation.sameRequest = f.authority.host.requestFor(trusted) === request
            fault.resolutions = structuredClone(resolved)
            try {
              fault.intact = await f.corruptCapture(source)
              observation.committed = true
            } catch (error: unknown) { fault.error = error }
          }
          return resolved
        }
        requireOriginalRecord(f, await f.atlas.context.recall(selection, call))
        expect(observation.reads).toBeGreaterThan(0)
        observation.target = observation.reads
        observation.reads = 0
        const result = await settleRecall(f.atlas.context.recall(selection, call))
        f.atlas.context.context = context
        expect(observation.attempted).toBe(true)
        expect(observation.sameRequest).toBe(true)
        expect(observation.reads).toBe(observation.target)
        expect(fault.resolutions?.length).toBeGreaterThan(0)
        expect(fault.resolutions?.every((item) => item.state === "fresh")).toBe(true)
        expect(fault.resolutions?.some((item) => item.ref.refDigest === source.ref.refDigest &&
          digestSfValue(item.authorizedProjection) === digestSfValue(source.evidence))).toBe(true)
        const after = await f.audit()
        if (observation.committed) {
          expect(fault.error).toBeUndefined()
          if (!fault.intact) throw new Error("Public recall corruption did not retain its actual capture")
          requireOnlyCaptureFault(f, before, after, fault.intact)
          await f.restoreCapture(source, fault.intact)
        } else {
          requireNestedWriteFence(fault.error)
          expect(fault.intact).toBeUndefined()
          expect(after).toEqual(before)
        }
        requireOriginalRecord(f, await f.atlas.context.recall(selection, call))
        await readOriginalRaw(f, call)
        expect(await f.audit()).toEqual(before)
        console.info("SF_MEMORY_M69_PUBLIC_POST_CONTEXT_CAPTURE", JSON.stringify({
          result: result.kind, returnedRecords: result.kind === "returned" ? result.value.length : 0,
          realContextReads: observation.reads, sourceWasFresh: true,
          fault: observation.committed ? "committed-capture-corruption" : "nested-write-blocked",
          originalRestored: true, eventId: f.receipt.eventId, recordDigest: f.receipt.recordDigest,
          auditDigest: digestSfValue(before), counts: before.counts, nativeSessionWitness: false,
        }))
        requireRecallDenied(result)
      }, request)
    } finally { f.atlas.context.context = context }
  })
}, 180_000)

test("M69 public recall binds its selection across real source context and preserves an intact retry", async () => {
  expectSpawn(import.meta.path)
  await withDocumentReplayFixture(async (f) => {
    const before = await f.audit()
    const selection = { caseRefs: [{ ...f.caseRef }], query: "supplier" }
    const selectionDigest = digestSfValue(selection)
    const context = f.atlas.context.context
    const observation = { reads: 0, target: 0, changed: false, sourcesWereFresh: false }
    try {
      await f.ui("sf_decision_recall", selection, async (call) => {
        requireOriginalRecord(f, await f.atlas.context.recall(selection, call))
        f.atlas.context.context = async (incoming, trusted) => {
          const resolved = await context(incoming, trusted)
          if (trusted !== call) return resolved
          observation.reads += 1
          if (observation.target > 0 && observation.reads === observation.target) {
            observation.sourcesWereFresh = resolved.length > 0 && resolved.every((item) => item.state === "fresh")
            selection.caseRefs[0]!.incarnation = `${f.caseRef.incarnation}:changed-after-context`
            observation.changed = true
          }
          return resolved
        }
        // Case authorization also calls context. Calibrate the complete public
        // read on this same call, then mutate only its final real context.
        requireOriginalRecord(f, await f.atlas.context.recall(selection, call))
        expect(observation.reads).toBeGreaterThan(0)
        observation.target = observation.reads
        observation.reads = 0
        const result = await settleRecall(f.atlas.context.recall(selection, call))
        f.atlas.context.context = context
        expect(observation.changed).toBe(true)
        expect(observation.sourcesWereFresh).toBe(true)
        expect(observation.reads).toBe(observation.target)
        expect(digestSfValue(selection)).not.toBe(selectionDigest)
        expect(await f.audit()).toEqual(before)
        selection.caseRefs[0]!.incarnation = f.caseRef.incarnation
        expect(digestSfValue(selection)).toBe(selectionDigest)
        requireOriginalRecord(f, await f.atlas.context.recall(selection, call))
        expect(await f.audit()).toEqual(before)
        console.info("SF_MEMORY_M69_PUBLIC_SELECTION_FENCE", JSON.stringify({
          result: result.kind, returnedRecords: result.kind === "returned" ? result.value.length : 0,
          realContextReads: observation.reads, selectionChangedAfterLastRealContext: true, originalRestored: true,
          eventId: f.receipt.eventId, recordDigest: f.receipt.recordDigest,
          auditDigest: digestSfValue(before), counts: before.counts, nativeSessionWitness: false,
        }))
        requireRecallDenied(result, "SF_MEMORY_AUTHORITY_UNAVAILABLE")
      })
    } finally { f.atlas.context.context = context }
  })
}, 180_000)
