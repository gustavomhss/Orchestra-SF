import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { observeMemoryPersistence } from "./persistence-observer.ts"

function latch() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => { release = resolve })
  return { promise, release }
}

test("Memory persistence observer preserves real nested, queued, cancelled and expired LocalStore work", async () => {
  const outcomes = []
  for (const mode of ["snapshots", "callback-scope"] as const) {
    const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-memory-observer-"))
    await chmod(directory, 0o700)
    const source = await openLocalStore(directory)
    const observer = observeMemoryPersistence(source, { persistenceCalls: 0, rootPersistenceCalls: 0, nestedPersistenceCalls: 0 }, mode)
    const driver = observer.driver
    const before = observer.snapshot()
    const releases: (() => void)[] = []
    const pending: Promise<unknown>[] = []
    try {
      const value = { identity: "retained" }
      expect(await driver.transaction("dashboard", async (snapshot, blobs) => {
        snapshot.data.amount = 1
        await blobs.put("real", new Uint8Array([1, 2, 3]), "application/octet-stream")
        return { commit: true, value }
      })).toBe(value)
      if (!driver.transactionAll) throw new Error("Real cross-surface transactions unavailable")
      expect(await driver.transactionAll(async (snapshots) => {
        snapshots.planner.data.amount = 2
        snapshots.procurement.data.amount = 3
        expect(await driver.transaction("dashboard", async (snapshot, blobs) => {
          expect(snapshot.data.amount).toBe(1)
          expect(await blobs.get("real")).toEqual(new Uint8Array([1, 2, 3]))
          return { commit: false, value: "nested" }
        })).toBe("nested")
        return { commit: true, value: "all" }
      })).toBe("all")
      const expected = new Error("actual callback failure")
      await expect(driver.transaction("dashboard", async (snapshot) => {
        snapshot.data.amount = 99
        throw expected
      })).rejects.toBe(expected)

      const entered = latch(), release = latch()
      releases.push(release.release)
      const holding = driver.transaction("dashboard", async (snapshot) => {
        entered.release()
        await release.promise
        expect(snapshot.data.amount).toBe(1)
        snapshot.data.amount = 4
        return { commit: true, value: "held" }
      })
      pending.push(holding)
      await entered.promise
      const cancellation = new AbortController()
      const cancelled = driver.transaction("dashboard", async () => {
        throw new Error("Cancelled queued callback must not execute")
      }, { signal: cancellation.signal }).then(() => undefined, (error: unknown) => error)
      const aborted = new Error("queued request cancelled")
      cancellation.abort(aborted)
      expect(await cancelled).toBe(aborted)
      const queued = driver.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.data.amount }))
      pending.push(queued)
      release.release()
      expect(await holding).toBe("held")
      expect(await queued).toBe(4)

      const late = latch()
      releases.push(late.release)
      const detached = await driver.transaction("dashboard", async () => ({ commit: false, value: {
        result: (async () => {
          await late.promise
          try { await driver.transaction("dashboard", async () => ({ commit: false, value: undefined })) }
          catch (error) { return error }
          throw new Error("Expired scope was incorrectly admitted")
        })(),
      } }))
      pending.push(detached.result)
      late.release()
      const expired = await detached.result
      expect(expired).toBeInstanceOf(Error)
      expect((expired as Error).message).toBe("Local transaction scope has ended")
      const counts = observer.snapshot()
      expect(counts.scopeInspectionErrors).toBe(1)
      expect(counts.rootRejectedBeforeCallback).toBe(1)
      expect(counts.rootCallbackErrors).toBe(1)
      expect(counts.nestedPersistenceCalls).toBe(1)
      expect(counts.persistenceCalls).toBe(counts.rootPersistenceCalls + counts.nestedPersistenceCalls + counts.scopeInspectionErrors)
      expect(observer.delta(before)).toEqual(counts)
      expect(Object.values(counts).every((entry) => Number.isFinite(entry) && entry >= 0)).toBe(true)
      outcomes.push({ calls: counts.persistenceCalls, root: counts.rootPersistenceCalls, nested: counts.nestedPersistenceCalls,
        rootCallbacks: counts.rootCallbackCalls, nestedCallbacks: counts.nestedCallbackCalls, errors: counts.rootErrors,
        snapshotInspections: counts.scopeInspectionCalls })
    } finally {
      releases.forEach((release) => release())
      await Promise.allSettled(pending)
      await source.dispose()
      await rm(directory, { recursive: true, force: true })
    }
  }
  expect(outcomes[1]!.snapshotInspections).toBe(outcomes[0]!.snapshotInspections - 1)
  expect({ ...outcomes[1], snapshotInspections: 0 }).toEqual({ ...outcomes[0], snapshotInspections: 0 })
}, 30_000)
