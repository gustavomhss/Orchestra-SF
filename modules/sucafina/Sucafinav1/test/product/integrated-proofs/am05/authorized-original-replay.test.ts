import { expect, test } from "bun:test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { withMemoryIntegrityFixture } from "../../wp10/memory-integrity/fixture.ts"

/**
 * Reuses the C08/SQLite + real Gitleaks + Atlas/BCS/source fixture. These
 * assertions are about authentic SF receipts and read gates, not a separately
 * constructed ledger, synthetic scanner, model turn or native Session.
 */
test("AM05 settled Atlas outbox is single-effect across lost-response retry, historical read and revocation", async () => {
  expectSpawn(import.meta.path)
  await withMemoryIntegrityFixture(async (f) => {
    const before = await f.readAtlas()
    const admitted = await f.authority.human.admit(f.request(), "analysis.prepare", {
      request: f.analysis, selection: f.value,
    })
    if (admitted.status !== "ok") throw new Error(`Current human admission unavailable: ${admitted.reason}`)
    const call = admitted.value
    const caseRef = { id: f.caseRef.id, incarnation: f.caseRef.incarnation }
    try {
      // The initial write was committed through C08 and the real scanner during
      // fixture setup. Reopening the SAME settled outbox must not append again.
      const recovered = await f.business.context.emitFromLedger(f.eventRef, call)
      expect(recovered.status).toBe("already-committed")
      if (recovered.status !== "already-committed") throw new Error("Lost-response recovery was not idempotent")
      expect(recovered.scanner).toMatchObject({ status: "clean", name: f.scanner.spec.name, version: f.scanner.version })
      expect(await f.readAtlas()).toEqual(before)

      await f.edit(150)
      const historical = await f.business.context.resolve(f.original, call)
      expect(historical.state).toBe("historical")
      expect(historical.ref).toEqual(f.original)
      const recalled = await f.atlas.memory.recall(caseRef, call)
      expect(recalled.status).toBe("ok")
      if (recalled.status !== "ok") throw new Error("Authorized historical Atlas read unavailable")
      expect(recalled.records).toHaveLength(1)
      expect(recalled.records[0]?.resolutions.some((source) =>
        source.state === "historical" && source.ref.refDigest === f.original.refDigest)).toBe(true)
      expect(await f.atlas.memory.readOriginal(caseRef, f.original.refDigest, call)).toEqual(f.original)

      // Direct read, not discovery: a different incarnation cannot use a
      // valid owner, source digest or a settled receipt from this case.
      const foreign = { ...caseRef, incarnation: "am05-other-incarnation" }
      expect((await f.atlas.memory.recall(foreign, call)).status).not.toBe("ok")
      expect(await f.atlas.memory.readOriginal(foreign, f.original.refDigest, call)).toBeUndefined()

      f.access.allowed = false
      expect((await f.atlas.memory.recall(caseRef, call)).status).not.toBe("ok")
      expect(await f.atlas.memory.readOriginal(caseRef, f.original.refDigest, call)).toBeUndefined()
      expect((await f.business.context.emitFromLedger(f.eventRef, call)).status).not.toBe("already-committed")
      expect(await f.readAtlas()).toEqual(before)
    } finally {
      f.authority.human.finish(call)
    }
  }, "am05-authenticated-original-replay")
}, 120_000)
