import { expect, test } from "bun:test"
import { createMemoryEmit } from "@orchestra/atlas-boundary/business-memory-ports"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { createSfAtlasDurableMemory } from "../../../../product/host-binding/atlas-store.ts"
import { createSfAtlasScanner } from "../../../../product/host-binding/atlas-scanner.ts"
import { withMemoryIntegrityFixture } from "../../wp10/memory-integrity/fixture.ts"

/**
 * Test the REAL C08 transaction rollback with the REAL Atlas emit factory and
 * pinned binary. An append inside a rejected transaction is NOT a durable
 * commit, and cannot be presented as a recovered receipt. The existing
 * wp10/atlas-business/atlas-recovery test covers actual committed restart.
 */
test("AM05 a scanned append staged in a C08 transaction cannot leak after commit:false", async () => {
  expectSpawn(import.meta.path)
  await withMemoryIntegrityFixture(async (f) => {
    const before = await f.readAtlas()
    const verdict = await f.persistence.transaction("dashboard", async (snapshot) => {
      const stored = snapshot.data.__sfProductV1 as {
        atlas?: Record<string, { events: Parameters<typeof createSfAtlasDurableMemory>[0]["events"] }>
      } | undefined
      const owner = Object.keys(stored?.atlas ?? {})[0]
      const partition = owner && stored?.atlas?.[owner]
      if (!owner || !partition) throw new Error("Canonical Atlas partition absent from committed C08 snapshot")
      const durable = createSfAtlasDurableMemory(partition)
      const count = durable.read().store.length
      const emitted = createMemoryEmit({
        store: durable,
        actor: owner,
        scanner: createSfAtlasScanner({ scanners: [f.scanner.spec] }),
      }).emit({
        taskId: "sf-work:am05:rolled-back-c08",
        attempted: ["Check that uncommitted memory is not visible after a rolled-back SQLite transaction"],
        failedWith: [],
        stoppedAt: "transaction rollback",
        lesson: "A successful binary scan and in-transaction append do not constitute a durable receipt.",
      })
      if (!emitted.ok) throw new Error(`Real scanner or memory write refused the staging test: ${emitted.refusal}`)
      expect(durable.read().store).toHaveLength(count + 1)
      // No C09/outbox business receipt is issued for this deliberately rejected
      // transaction; this exercises the storage atomicity subcase only.
      return { commit: false, value: emitted.record }
    })
    expect(verdict).toBeDefined()
    expect(await f.readAtlas()).toEqual(before)
  }, "am05-sqlite-rollback")
}, 120_000)
