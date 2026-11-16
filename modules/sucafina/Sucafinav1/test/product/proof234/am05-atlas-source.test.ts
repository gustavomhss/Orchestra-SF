import { expect, test } from "bun:test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { withMemoryIntegrityFixture } from "../wp10/memory-integrity/fixture.ts"

/**
 * Uses the original C08/SQLite -> SF C09 outbox -> C17 BCS -> Atlas
 * createMemoryEmit/createMemoryRead integration and the REAL pinned Gitleaks
 * binary. No test double for scanner, ledger, or memory store.
 * Existing native model/installed identity and process restart gates remain
 * independent and NOT_RUN until C is accepted and witnessed.
 */
test("proof234 AM05 original outbox identity survives historical source read and revocation without extra append", async () => {
  expectSpawn(import.meta.path)
  await withMemoryIntegrityFixture(async (fixture) => {
    const committed = await fixture.readAtlas()
    const admitted = await fixture.authority.human.admit(
      fixture.request(), "analysis.prepare", { request: fixture.analysis, selection: fixture.value },
    )
    if (admitted.status !== "ok") throw new Error("Original current human authority unavailable")
    const call = admitted.value
    try {
      const fresh = await fixture.business.context.resolve(fixture.original, call)
      expect(fresh.state).toBe("fresh")
      const initial = await fixture.atlas.memory.recall(fixture.caseRef, call)
      expect(initial.status).toBe("ok")
      if (initial.status !== "ok") throw new Error("Original authorized Atlas reader unavailable")
      expect(initial.records).toHaveLength(1)
      expect(await fixture.atlas.memory.readOriginal(
        fixture.caseRef, fixture.original.refDigest, call,
      )).toEqual(fixture.original)
      const same = await fixture.business.context.emitFromLedger(fixture.eventRef, call)
      expect(same.status).toBe("already-committed")
      expect(same.scanner).toMatchObject({
        status: "clean", name: fixture.scanner.spec.name, version: fixture.scanner.version,
      })
      expect(await fixture.readAtlas()).toEqual(committed)

      await fixture.edit(175)
      expect((await fixture.business.context.resolve(fixture.original, call)).state).toBe("historical")
      const historical = await fixture.atlas.memory.recall(fixture.caseRef, call)
      expect(historical.status).toBe("ok")
      if (historical.status !== "ok") throw new Error("Authorized historical Atlas reader unavailable")
      expect(historical.records).toHaveLength(1)
      expect(historical.records[0]?.resolutions.some((entry) =>
        entry.state === "historical" && entry.ref.refDigest === fixture.original.refDigest)).toBe(true)
      expect(await fixture.readAtlas()).toEqual(committed)

      fixture.access.allowed = false
      expect((await fixture.atlas.memory.recall(fixture.caseRef, call)).status).not.toBe("ok")
      expect(await fixture.atlas.memory.readOriginal(
        fixture.caseRef, fixture.original.refDigest, call,
      )).toBeUndefined()
      expect((await fixture.business.context.emitFromLedger(fixture.eventRef, call)).status)
        .not.toBe("already-committed")
      expect(await fixture.readAtlas()).toEqual(committed)
      console.info("SF_PROOF234_AM05_COMPONENT", JSON.stringify({
        sourceEventId: fixture.eventRef.target.eventId,
        scanner: fixture.scanner.spec.name,
        originalRead: true, revocationDenial: true, newAppends: 0,
        nativeModel: "NOT_RUN", installedPrincipal: "NOT_RUN", processRestart: "NOT_RUN",
      }))
    } finally {
      fixture.authority.human.finish(call)
    }
  }, "proof234-c17-real-source-scanner")
}, 120_000)
