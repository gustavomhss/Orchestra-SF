import { expect, test } from "bun:test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { createSfRunStore } from "../../../../product/ai/run-store.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { object } from "../../../../runtime/contract.ts"
import { withMemoryIntegrityFixture } from "./fixture.ts"

test("Memory integrity preflight rejects a corrupted Atlas original without rewriting the capture", async () => {
  expectSpawn(import.meta.path)
  await withMemoryIntegrityFixture(async (f) => {
    const call = await f.admit()
    try {
      expect((await f.business.context.resolve(f.original, call)).state).toBe("fresh")
      expect((await f.stale.preflight(f.record, call, f.output)).status).toBe("ok")
      await f.edit(150)
      const historical = await f.business.context.resolve(f.original, call)
      expect(historical.state).toBe("historical")
      expect(historical.ref).toEqual(f.original)
      expect(historical.currentRef?.refDigest).not.toBe(f.original.refDigest)
      expect(historical.differences).toContainEqual({ field: "originalAmount", before: 100, after: 150 })
      expect((await f.stale.preflight(f.record, call, f.output)).status).toBe("ok")
      const intact = await f.readAtlas()
      expect((await f.atlas.memory.recall(f.caseRef, call)).status).toBe("ok")
      expect(await f.readAtlas()).toEqual(intact)

      await f.mutateAtlas((_partition, capture) => { capture.projection = { damaged: true } })
      const corrupted = await f.readAtlas()
      expect(corrupted).not.toEqual(intact)
      const before = Object.values(object(intact)).find((partition) => object(object(partition).originals)[f.original.refDigest])
      const after = Object.values(object(corrupted)).find((partition) => object(object(partition).originals)[f.original.refDigest])
      expect(object(after).captureDigests).toEqual(object(before).captureDigests)
      expect(object(object(object(after).originals)[f.original.refDigest]).ref).toEqual(f.original)
      expect((await f.atlas.memory.recall(f.caseRef, call)).status).toBe("unavailable")
      // The C12 resolver may independently authorize the source. That is not a
      // grant to use a damaged Atlas capture in this Memory lifecycle settlement.
      expect((await f.business.context.resolve(f.original, call)).state).toBe("historical")
      expect((await f.stale.preflight(f.record, call, f.output)).status).toBe("denied")
      expect(await f.readAtlas()).toEqual(corrupted)
      expect((await f.stale.preflight(f.record, call, f.output)).status).toBe("denied")
      expect(await f.readAtlas()).toEqual(corrupted)
      console.info("SF_MEMORY_INTEGRITY_PROOF", JSON.stringify({ scenario: "corrupted-original", source: "real-procurement",
        intact: "accepted", historical: "accepted", corrupted: "denied", recall: "unavailable", captureDigestRewritten: false,
        persistedCorruptionDigest: digestSfValue(corrupted), scanner: f.scanner.version, nativeExecution: false }))
    } finally { f.authority.human.finish(call) }
  }, "corrupted-original")
}, 120_000)

test("Memory integrity keeps authorized metadata-only stale preservation and rejects a later source change", async () => {
  expectSpawn(import.meta.path)
  await withMemoryIntegrityFixture(async (f) => {
    await f.seedRun()
    await f.edit(150)
    const call = await f.admit()
    const outputDigest = digestSfValue(f.output)
    const beforeAtlas = await f.readAtlas()
    const runs = f.stale.wrapStore(createSfRunStore({ state: f.authority.state, requestFor: f.authority.host.requestFor,
      revalidate: f.authority.host.revalidate, preflight: f.stale.preflight, revalidateForCommit: f.stale.commit, now: () => f.at }))
    try {
      expect((await runs.preserveStale(f.run.runRef, "source-changed", f.output, call)).status).toBe("ok")
      const stored = await f.authority.state.read(f.staleRequest, "contributions", (state) => ({ run: state.nativeRuns?.[f.run.runRef], output: state.contributions[f.output.id] }))
      if (stored.status !== "ok") throw new Error("Preserved lifecycle fixture unavailable")
      expect(stored.value.run).toMatchObject({ state: "stale", version: f.run.version + 1, outputRef: f.output.id })
      expect(digestSfValue(stored.value.output)).toBe(outputDigest)
      expect(await f.readAtlas()).toEqual(beforeAtlas)
      expect((await f.stale.preflight(f.record, call, f.output)).status).toBe("ok")
      await f.edit(175)
      if (!f.persistence.transactionAll) throw new Error("Real C08 scope unavailable")
      expect(await f.persistence.transactionAll(async (snapshots) => ({ commit: false,
        value: await f.stale.commit(f.record, call, snapshots.dashboard, f.output) })))
        .toEqual({ status: "stale", reason: "analysis-stale-source-changed" })
      const unchanged = await f.authority.state.read(f.staleRequest, "contributions", (state) => state.contributions[f.output.id])
      if (unchanged.status !== "ok") throw new Error("Preserved contribution unavailable")
      expect(digestSfValue(unchanged.value)).toBe(outputDigest)
      expect(await f.readAtlas()).toEqual(beforeAtlas)
    } finally { f.authority.human.finish(call) }
  }, "metadata-preserve")
}, 120_000)
