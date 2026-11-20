import { expect, test } from "bun:test"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { retainSfAtlasRecallResult, revalidateSfAtlasRecall } from "../../../product/host-binding/atlas-memory.ts"
import { withComposedDocumentReplayFixture } from "./composed-document-fixture.ts"
import { requireOriginalRecord } from "./fixture-assertions.ts"

test("Atlas renews a consumed canonical observation without resurrecting its array or accepting a mutated alias", async () => {
  expectSpawn(import.meta.path)
  await withComposedDocumentReplayFixture(async (f) => {
    const before = await f.audit()
    const selection = { caseRefs: [f.caseRef], query: "supplier" }
    await f.ui("sf_decision_recall", selection, async (call) => {
      const original = await f.memory.recall(f.caseRef, call)
      expect(original.status).toBe("ok")
      if (original.status !== "ok") throw new Error("Actual canonical Atlas recall unavailable")
      requireOriginalRecord(f, original.records)
      const fingerprint = digestSfValue(original)
      const reobserve = retainSfAtlasRecallResult(original, call)
      if (!reobserve) throw new Error("Actual canonical Atlas observation unavailable")
      expect(retainSfAtlasRecallResult(structuredClone(original), call)).toBeUndefined()
      const active = await reobserve()
      expect(active).toEqual(original)
      expect(active?.records).toBe(original.records)
      expect(await revalidateSfAtlasRecall([original.records], call)).toBe(true)
      expect(await revalidateSfAtlasRecall([original.records], call)).toBe(false)

      const pending = reobserve()
      expect(await reobserve()).toBeUndefined()
      const renewed = await pending
      if (!renewed) throw new Error("Consumed canonical observation was not renewed")
      expect(renewed).toEqual(original)
      expect(digestSfValue(renewed)).toBe(fingerprint)
      expect(renewed.records).not.toBe(original.records)
      requireOriginalRecord(f, renewed.records)
      expect(await revalidateSfAtlasRecall([original.records], call)).toBe(false)
      expect(await revalidateSfAtlasRecall([renewed.records], call)).toBe(true)
      expect(await revalidateSfAtlasRecall([renewed.records], call)).toBe(false)

      const again = await reobserve()
      if (!again) throw new Error("Second canonical observation was not renewed")
      expect(again.records).not.toBe(renewed.records)
      expect(digestSfValue(again)).toBe(fingerprint)
      expect(await revalidateSfAtlasRecall([again.records], call)).toBe(true)
      // A caller never acquires the private retained copy. Mutation of any issued
      // array still poisons that observation instead of being hidden by the copy.
      again.records.splice(0, 1)
      expect(await reobserve()).toBeUndefined()
      expect(await revalidateSfAtlasRecall([again.records], call)).toBe(false)
      const intact = await f.memory.recall(f.caseRef, call)
      expect(intact.status).toBe("ok")
      if (intact.status !== "ok") throw new Error("Independent canonical recall unavailable after alias mutation")
      requireOriginalRecord(f, intact.records)
    })
    expect(await f.audit()).toEqual(before)
  })
}, 180_000)

test("Atlas renewal rejects a changed captured source and cannot outlive its admitted call", async () => {
  expectSpawn(import.meta.path)
  await withComposedDocumentReplayFixture(async (f) => {
    const before = await f.audit()
    const selection = { caseRefs: [f.caseRef], query: "supplier" }
    const saved: { reobserve?: () => Promise<unknown> } = {}
    await f.ui("sf_decision_recall", selection, async (call) => {
      const original = await f.memory.recall(f.caseRef, call)
      expect(original.status).toBe("ok")
      if (original.status !== "ok") throw new Error("Actual canonical Atlas recall unavailable")
      const reobserve = retainSfAtlasRecallResult(original, call)
      if (!reobserve) throw new Error("Actual canonical Atlas observation unavailable")
      expect(await revalidateSfAtlasRecall([original.records], call)).toBe(true)
      const source = f.sources[0]!
      const capture = await f.corruptCapture(source)
      try {
        expect(await reobserve()).toBeUndefined()
        expect(await revalidateSfAtlasRecall([original.records], call)).toBe(false)
      } finally { await f.restoreCapture(source, capture) }
      const intact = await f.memory.recall(f.caseRef, call)
      expect(intact.status).toBe("ok")
      if (intact.status !== "ok") throw new Error("Restored canonical Atlas recall unavailable")
      requireOriginalRecord(f, intact.records)
      saved.reobserve = retainSfAtlasRecallResult(intact, call)
      if (!saved.reobserve) throw new Error("Restored canonical observation unavailable")
      expect(await revalidateSfAtlasRecall([intact.records], call)).toBe(true)
    })
    if (!saved.reobserve) throw new Error("Closed-call negative control did not retain a real observation")
    expect(await saved.reobserve()).toBeUndefined()
    expect(await f.audit()).toEqual(before)
  })
}, 180_000)

test("Atlas renewal rejects authority closed during its real protected revalidation", async () => {
  expectSpawn(import.meta.path)
  await withComposedDocumentReplayFixture(async (f) => {
    const before = await f.audit()
    const selection = { caseRefs: [f.caseRef], query: "supplier" }
    const revalidate = f.authority.host.revalidate
    try {
      await f.ui("sf_decision_recall", selection, async (call) => {
        const original = await f.memory.recall(f.caseRef, call)
        expect(original.status).toBe("ok")
        if (original.status !== "ok") throw new Error("Actual canonical Atlas recall unavailable")
        const reobserve = retainSfAtlasRecallResult(original, call)
        if (!reobserve) throw new Error("Actual canonical Atlas observation unavailable")
        expect(await revalidateSfAtlasRecall([original.records], call)).toBe(true)
        const observed = { closed: false }
        f.authority.host.revalidate = async (trusted) => {
          const permitted = await revalidate(trusted)
          if (trusted === call && permitted && !observed.closed) {
            f.authority.ui.finish(call)
            observed.closed = true
          }
          return permitted
        }
        expect(await reobserve()).toBeUndefined()
        expect(observed.closed).toBe(true)
        expect(await revalidateSfAtlasRecall([original.records], call)).toBe(false)
      })
    } finally { f.authority.host.revalidate = revalidate }
    expect(await f.audit()).toEqual(before)
  })
}, 180_000)
