import { expect, test } from "bun:test"
import type { BlobTransaction } from "../../../runtime/assets.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import { bytes, current, read, record, seed, warm, withStores } from "./fixture.ts"

for (const mode of ["false", "throw", "abort"] as const) {
  test(`fresh copies preserve staged blob generations and ${mode} rollback across reopen`, async () => {
    await withStores(async (_directory, open) => {
      const store = await open()
      await seed(store)
      await warm(store)
      const before = await read(store)
      const controller = new AbortController()
      const calls = { root: 0, nested: 0 }
      const running = store.transaction("dashboard", async (snapshot: Snapshot, blobs: BlobTransaction) => {
        calls.root++
        const old = current(store)
        record(snapshot.data.left).count = 10
        await blobs.put("document", bytes, "binary")
        const staged = current(store)
        expect(staged.dashboard.sfBlobGenerations?.document).toBe(1)
        expect(old.dashboard.sfBlobGenerations).toBeUndefined()
        expect(record(old.dashboard.data.left).count).toBe(1)
        await store.transaction("procurement", async (nested) => {
          calls.nested++
          record(nested.data.left).count = 99
          expect(record(current(store).procurement.data.left).count).toBe(1)
          return { commit: false, value: undefined }
        })
        if (mode === "throw") throw new Error("fresh-copy callback failed")
        if (mode === "abort") {
          controller.abort(new Error("fresh-copy request revoked"))
          expect(() => current(store)).toThrow("fresh-copy request revoked")
          await expect(blobs.get("document")).rejects.toThrow("fresh-copy request revoked")
        }
        return { commit: mode !== "false", value: "observed" }
      }, { signal: controller.signal })
      if (mode === "false") expect(await running).toBe("observed")
      if (mode === "throw") await expect(running).rejects.toThrow("fresh-copy callback failed")
      if (mode === "abort") await expect(running).rejects.toThrow("fresh-copy request revoked")
      expect(calls).toEqual({ root: 1, nested: 1 })
      expect(await read(store)).toEqual(before)
      await store.dispose()
      expect(await read(await open())).toEqual(before)
    })
  })
}

for (const effect of ["nested-commit", "nested-blob", "captured-parent-blob", "secret-write"] as const) {
  test(`fresh non-target reads cannot hide a caught ${effect} and the root rolls back`, async () => {
    await withStores(async (_directory, open) => {
      const store = await open()
      await seed(store)
      await warm(store)
      const before = await read(store)
      const calls = { root: 0, nested: 0, caught: 0 }
      await expect(store.transaction("dashboard", async (snapshot: Snapshot, blobs: BlobTransaction) => {
        calls.root++
        current(store)
        snapshot.data.attempt = "must roll back"
        await blobs.put("document", bytes, "binary")
        await store.transaction("procurement", async (_nested: Snapshot, nestedBlobs: BlobTransaction) => {
          calls.nested++
          current(store)
          if (effect === "nested-commit") return { commit: true, value: undefined }
          const attempt = effect === "nested-blob" ? nestedBlobs.put("document", bytes, "binary")
            : effect === "captured-parent-blob" ? blobs.put("captured", bytes, "binary")
              : store.secrets.put("nested-secret", bytes, 1000)
          await attempt.catch(() => { calls.caught++ })
          return { commit: false, value: undefined }
        }).catch(() => { calls.caught++ })
        return { commit: true, value: undefined }
      })).rejects.toThrow("Nested local write attempted")
      expect(calls).toEqual({ root: 1, nested: 1, caught: effect === "nested-commit" ? 1 : 2 })
      expect(await read(store)).toEqual(before)
      expect(await store.secrets.get("nested-secret", 0)).toBeUndefined()
      expect(await store.transaction("dashboard", async (_snapshot: Snapshot, blobs: BlobTransaction) => ({
        commit: false, value: await blobs.get("captured"),
      }))).toBeUndefined()
      await store.dispose()
      expect(await read(await open())).toEqual(before)
    })
  })
}

test("an outstanding non-target reader prevents commit and cannot complete through a closed root", async () => {
  await withStores(async (_directory, open) => {
    const store = await open()
    await seed(store)
    await warm(store)
    const before = await read(store)
    const started = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const child: { pending?: Promise<void> } = {}
    try {
      await expect(store.transaction("dashboard", async (snapshot: Snapshot, blobs: BlobTransaction) => {
        current(store)
        snapshot.data.pending = "must roll back"
        await blobs.put("document", bytes, "binary")
        child.pending = store.transaction("planner", async () => {
          current(store)
          started.resolve()
          await release.promise
          return { commit: false, value: undefined }
        })
        void child.pending.catch(() => undefined)
        await started.promise
        return { commit: true, value: undefined }
      })).rejects.toThrow("Nested local read still active")
      release.resolve()
      await expect(child.pending).rejects.toThrow("scope has ended")
      expect(await read(store)).toEqual(before)
      await store.dispose()
      expect(await read(await open())).toEqual(before)
    } finally {
      release.resolve()
      await child.pending?.catch(() => undefined)
    }
  })
})

test("aborting a nested read closes its observations while the unrevoked parent remains usable", async () => {
  await withStores(async (_directory, open) => {
    const store = await open()
    await seed(store)
    await warm(store)
    const controller = new AbortController()
    const calls = { nested: 0, preaborted: 0 }
    await store.transaction("dashboard", async (snapshot) => {
      const before = current(store)
      await expect(store.transaction("planner", async (nested) => {
        calls.nested++
        const copy = current(store)
        record(nested.data.left).count = 99
        controller.abort(new Error("nested read revoked"))
        expect(() => current(store)).toThrow("nested read revoked")
        expect(copy).toEqual(before)
        return { commit: false, value: undefined }
      }, { signal: controller.signal })).rejects.toThrow("nested read revoked")
      await expect(store.transaction("procurement", async () => {
        calls.preaborted++
        return { commit: false, value: undefined }
      }, { signal: controller.signal })).rejects.toThrow("nested read revoked")
      expect(current(store)).toEqual(before)
      snapshot.data.parent = "committed"
      return { commit: true, value: undefined }
    })
    expect(calls).toEqual({ nested: 1, preaborted: 0 })
    expect((await read(store)).snapshot.data.parent).toBe("committed")
    expect(record((await read(store, "planner")).snapshot.data.left).count).toBe(1)
  })
})

test("closed readers and captured handles cannot borrow a later root generation", async () => {
  await withStores(async (_directory, open) => {
    const store = await open()
    await seed(store)
    await warm(store)
    const release = Promise.withResolvers<void>()
    const retained: { observations?: Promise<unknown>; blobs?: BlobTransaction } = {}
    await store.transaction("dashboard", async (_snapshot: Snapshot, blobs: BlobTransaction) => {
      current(store)
      retained.blobs = blobs
      retained.observations = release.promise.then(() => current(store))
      void retained.observations.catch(() => undefined)
      return { commit: false, value: undefined }
    })
    await store.transaction("planner", async () => {
      const fresh = current(store)
      release.resolve()
      await expect(retained.observations).rejects.toThrow("scope has ended")
      if (!retained.blobs) throw new Error("Captured capability missing")
      await expect(retained.blobs.get("document")).rejects.toThrow("scope has ended")
      await expect(retained.blobs.put("document", bytes, "binary")).rejects.toThrow("scope has ended")
      await expect(retained.blobs.remove("document")).rejects.toThrow("scope has ended")
      expect(current(store)).toEqual(fresh)
      return { commit: true, value: undefined }
    })
    expect((await read(store)).blob).toBeUndefined()
    expect(store.currentSnapshots?.()).toBeUndefined()
  })
})

test("dispose drains an admitted root with retained plans and refuses later admissions", async () => {
  await withStores(async (_directory, open) => {
    const store = await open()
    await seed(store)
    await warm(store)
    const started = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const calls: string[] = []
    const running = store.transaction("dashboard", async (snapshot) => {
      calls.push("admitted")
      const before = current(store)
      started.resolve()
      await release.promise
      expect(current(store)).toEqual(before)
      snapshot.data.drained = true
      return { commit: true, value: undefined }
    })
    await started.promise
    const completions: string[] = []
    const disposing = store.dispose().then(() => { completions.push("disposed") })
    try {
      await expect(store.transaction("dashboard", async () => {
        calls.push("late")
        return { commit: false, value: undefined }
      })).rejects.toThrow("disposed")
      expect(completions).toEqual([])
    } finally {
      release.resolve()
      await running
      await disposing
    }
    expect(calls).toEqual(["admitted"])
    expect(completions).toEqual(["disposed"])
    expect((await read(await open())).snapshot.data.drained).toBe(true)
  })
})
