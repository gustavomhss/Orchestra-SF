import { expect, test } from "bun:test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { digestSfEvidenceRef } from "../../../../product/contracts/canonical.ts"
import { object } from "../../../../runtime/contract.ts"
import { withMemoryIntegrityFixture } from "./fixture.ts"

for (const mutation of ["owner", "capture-source", "case-incarnation"] as const) {
  test(`Memory integrity rejects divergent ${mutation} in a persisted capture`, async () => {
    expectSpawn(import.meta.path)
    await withMemoryIntegrityFixture(async (f) => {
      const call = await f.admit()
      try {
        expect((await f.stale.preflight(f.record, call, f.output)).status).toBe("ok")
        await f.mutateAtlas((partition, capture) => {
          if (mutation === "capture-source") {
            const changed = { ...f.original, refId: `${f.original.refId}-other` }
            capture.ref = { ...changed, refDigest: digestSfEvidenceRef(changed) }
            return
          }
          const envelope = object(Object.values(object(partition.envelopes))[0])
          if (!envelope.eventId) throw new Error("Real capture envelope missing")
          if (mutation === "owner") envelope.owner = `${envelope.owner}-other`
          if (mutation === "case-incarnation") object(envelope.caseRef).incarnation = `${f.caseRef.incarnation}-other`
        })
        const corrupted = await f.readAtlas()
        expect((await f.atlas.memory.recall(f.caseRef, call)).status).toBe("unavailable")
        expect((await f.stale.preflight(f.record, call, f.output)).status).toBe("denied")
        expect(await f.readAtlas()).toEqual(corrupted)
      } finally { f.authority.human.finish(call) }
    }, mutation)
  }, 120_000)
}

test("Memory integrity refuses physical source replacement despite the old fingerprint", async () => {
  expectSpawn(import.meta.path)
  await withMemoryIntegrityFixture(async (f) => {
    const call = await f.admit()
    try {
      expect((await f.stale.preflight(f.record, call, f.output)).status).toBe("ok")
      const oldFingerprint = f.proof.contextFingerprint
      const captured = await f.readAtlas()
      const saved = await f.persistence.transaction("procurement", async (snapshot) => {
        const requests = object(object(snapshot.data.store).requests)
        const value = structuredClone(requests["PR-1"])
        delete requests["PR-1"]
        delete snapshot.versions["requests:PR-1"]
        return { commit: true, value }
      })
      await f.persistence.transaction("procurement", async (snapshot) => {
        object(object(snapshot.data.store).requests)["PR-1"] = saved
        snapshot.versions["requests:PR-1"] = { version: 0, by: "alice" }
        return { commit: true, value: undefined }
      })
      expect((await f.business.context.resolve(f.original, call)).state).toBe("unavailable")
      expect((await f.stale.preflight(f.record, call, f.output)).status).toBe("denied")
      expect(f.proof.contextFingerprint).toBe(oldFingerprint)
      expect(await f.readAtlas()).toEqual(captured)
    } finally { f.authority.human.finish(call) }
  }, "source-replacement")
}, 120_000)

test("Memory integrity refuses an empty recall after the capture partition moves to another owner", async () => {
  expectSpawn(import.meta.path)
  await withMemoryIntegrityFixture(async (f) => {
    await f.edit(150)
    const call = await f.admit()
    try {
      expect(f.proof.evidenceRefs).toHaveLength(1)
      expect((await f.business.context.resolve(f.original, call)).state).toBe("historical")
      expect((await f.stale.preflight(f.record, call, f.output)).status).toBe("ok")
      const before = await f.atlas.memory.recall(f.caseRef, call)
      if (before.status !== "ok") throw new Error("Intact Atlas capture unavailable")
      expect(before.records).toHaveLength(1)
      await f.persistence.transaction("dashboard", async (snapshot) => {
        const atlas = object(object(snapshot.data.__sfProductV1).atlas)
        const entry = Object.entries(atlas).find(([, partition]) => object(object(partition).originals)[f.original.refDigest])
        if (!entry) throw new Error("Canonical capture partition missing")
        delete atlas[entry[0]]
        atlas[`${entry[0]}-other-owner`] = entry[1]
        return { commit: true, value: undefined }
      })
      const moved = await f.readAtlas()
      // Source access remains legitimate through C12, while the required capture
      // is absent from this owner. Empty recall cannot authorize the old refs.
      expect((await f.business.context.resolve(f.original, call)).state).toBe("historical")
      expect(await f.atlas.memory.recall(f.caseRef, call)).toEqual({ status: "ok", records: [] })
      expect((await f.stale.preflight(f.record, call, f.output)).status).toBe("denied")
      expect(await f.readAtlas()).toEqual(moved)
    } finally { f.authority.human.finish(call) }
  }, "partition-owner-substitution")
}, 120_000)
