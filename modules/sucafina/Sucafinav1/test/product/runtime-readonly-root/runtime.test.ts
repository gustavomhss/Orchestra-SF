import { expect, test } from "bun:test"
import type { BlobTransaction } from "../../../runtime/assets.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import { bytes, current, read, record, seed, surfaces, warm, withStores } from "../runtime-fresh-copy-cost/fixture.ts"

for (const temperature of ["cold", "warm"] as const) {
  test(`${temperature} readonly root supplies no mutable target and detaches every surface observation`, async () => {
    await withStores(async (_directory, open) => {
      const writer = await open()
      await seed(writer)
      const before = await Promise.all(surfaces.map((surface) => read(writer, surface)))
      const store = await open()
      if (temperature === "warm") await warm(store)
      const calls = { root: 0, nested: 0, getters: 0 }
      expect(typeof store.readSnapshotRoot).toBe("function")
      expect(await store.readSnapshotRoot!(async (...args: unknown[]) => {
        calls.root++
        expect(args).toEqual([])
        const first = current(store)
        for (const [index, surface] of surfaces.entries()) {
          expect(first[surface]).toEqual(before[index]!.snapshot)
          expect(first[surface].data.left).not.toBe(first[surface].data.right)
          record(first[surface].data.left).count = 90
          first[surface].data.invalid = Object.defineProperty({}, "value", {
            get() { calls.getters++; throw new Error("detached getter must not run") }, enumerable: true,
          })
          await store.transaction(surface, async (snapshot) => {
            calls.nested++
            expect(snapshot).toEqual(before[index]!.snapshot)
            expect(snapshot).not.toBe(first[surface])
            record(snapshot.data.left).count = 70
            const cycle: Record<string, unknown> = {}
            cycle.self = cycle
            snapshot.data.discarded = cycle
            await store.transaction(surface, async (again) => {
              calls.nested++
              expect(again).toEqual(before[index]!.snapshot)
              expect(again).not.toBe(snapshot)
              record(again.data.right).count = 80
              return { commit: false, value: undefined }
            })
            expect(current(store)[surface]).toEqual(before[index]!.snapshot)
            return { commit: false, value: undefined }
          })
        }
        const second = current(store)
        for (const [index, surface] of surfaces.entries()) {
          expect(second[surface]).toEqual(before[index]!.snapshot)
          expect(second[surface]).not.toBe(first[surface])
          expect(Object.is(second[surface].data.minusZero, -0)).toBe(true)
          expect(Object.hasOwn(second[surface].data, "optional")).toBe(true)
        }
        return "read-complete"
      })).toBe("read-complete")
      expect(calls).toEqual({ root: 1, nested: 6, getters: 0 })
      expect(store.currentSnapshots?.()).toBeUndefined()
      expect(await Promise.all(surfaces.map((surface) => read(store, surface)))).toEqual(before)
    })
  })
}

for (const effect of ["commit", "transaction-all", "nested-root", "blob-put", "blob-remove", "secret-put", "secret-take", "secret-remove"] as const) {
  test(`readonly root refuses a swallowed ${effect} and leaves snapshots, blobs and secrets unchanged`, async () => {
    await withStores(async (_directory, open) => {
      const store = await open()
      await seed(store)
      await store.transaction("procurement", async (_snapshot: Snapshot, blobs: BlobTransaction) => {
        await blobs.put("document", bytes, "binary")
        return { commit: true, value: undefined }
      })
      await store.secrets.put("session", bytes, 1000)
      await warm(store)
      const before = await Promise.all(surfaces.map((surface) => read(store, surface)))
      const calls = { root: 0, nested: 0, forbidden: 0, caught: 0 }
      await expect(store.readSnapshotRoot!(async () => {
        calls.root++
        current(store)
        const attempt = effect === "commit" ? store.transaction("planner", async (snapshot) => {
          calls.nested++
          snapshot.data.attempt = "must not survive"
          return { commit: true, value: undefined }
        }) : effect === "transaction-all" ? store.transactionAll!(async () => {
          calls.forbidden++
          return { commit: true, value: undefined }
        }) : effect === "nested-root" ? store.readSnapshotRoot!(async () => {
          calls.forbidden++
          return undefined
        }) : effect === "blob-put" || effect === "blob-remove" ? store.transaction("procurement", async (_snapshot: Snapshot, blobs: BlobTransaction) => {
          calls.nested++
          await (effect === "blob-put" ? blobs.put("document", new Uint8Array([4]), "changed") : blobs.remove("document"))
            .catch(() => { calls.caught++ })
          return { commit: false, value: undefined }
        }) : effect === "secret-put" ? store.secrets.put("session", new Uint8Array([4]), 2000)
          : effect === "secret-take" ? store.secrets.take("session", 0)
            : store.secrets.remove("session")
        await attempt.catch(() => { calls.caught++ })
        expect(await store.secrets.get("session", 0)).toEqual(bytes)
        return "must-not-escape"
      })).rejects.toThrow("Nested local write attempted")
      expect(calls).toEqual({
        root: 1, nested: ["commit", "blob-put", "blob-remove"].includes(effect) ? 1 : 0,
        forbidden: 0, caught: effect === "blob-put" || effect === "blob-remove" ? 2 : 1,
      })
      expect(await Promise.all(surfaces.map((surface) => read(store, surface)))).toEqual(before)
      expect(await store.secrets.get("session", 0)).toEqual(bytes)
      await store.dispose()
      const reopened = await open()
      expect(await Promise.all(surfaces.map((surface) => read(reopened, surface)))).toEqual(before)
      expect(await reopened.secrets.get("session", 0)).toEqual(bytes)
    })
  })
}

test("a readonly root attempted inside a mutable transaction poisons the original writer even when caught", async () => {
  await withStores(async (_directory, open) => {
    const store = await open()
    await seed(store)
    const before = await read(store)
    const calls = { forbidden: 0, caught: 0 }
    await expect(store.transaction("dashboard", async (snapshot) => {
      snapshot.data.changed = "must roll back"
      await store.readSnapshotRoot!(async () => { calls.forbidden++ }).catch(() => { calls.caught++ })
      return { commit: true, value: undefined }
    })).rejects.toThrow("Nested local write attempted")
    expect(calls).toEqual({ forbidden: 0, caught: 1 })
    expect(await read(store)).toEqual(before)
  })
})

test("readonly roots reject pre-aborted work and a swallowed parent abort at the final fence", async () => {
  await withStores(async (_directory, open) => {
    const store = await open()
    await seed(store)
    const controller = new AbortController()
    const calls = { root: 0, nested: 0, preaborted: 0 }
    await expect(store.readSnapshotRoot!(async () => {
      calls.root++
      await expect(store.transaction("planner", async (_snapshot: Snapshot, blobs: BlobTransaction) => {
        calls.nested++
        controller.abort(new Error("readonly request revoked"))
        expect(() => current(store)).toThrow("readonly request revoked")
        await expect(blobs.get("document")).rejects.toThrow("readonly request revoked")
        return { commit: false, value: undefined }
      })).rejects.toThrow("readonly request revoked")
      return "must-not-escape"
    }, { signal: controller.signal })).rejects.toThrow("readonly request revoked")
    await expect(store.readSnapshotRoot!(async () => {
      calls.preaborted++
    }, { signal: controller.signal })).rejects.toThrow("readonly request revoked")
    expect(calls).toEqual({ root: 1, nested: 1, preaborted: 0 })
    expect(await store.readSnapshotRoot!(async () => record(current(store).planner.data.left).count)).toBe(1)
  })
})

test("a nested read abort does not revoke the still-open readonly parent", async () => {
  await withStores(async (_directory, open) => {
    const store = await open()
    await seed(store)
    const controller = new AbortController()
    expect(await store.readSnapshotRoot!(async () => {
      const before = current(store)
      await expect(store.transaction("planner", async (snapshot) => {
        record(snapshot.data.left).count = 9
        controller.abort(new Error("child revoked"))
        expect(() => current(store)).toThrow("child revoked")
        return { commit: false, value: undefined }
      }, { signal: controller.signal })).rejects.toThrow("child revoked")
      expect(current(store)).toEqual(before)
      return "parent-valid"
    })).toBe("parent-valid")
  })
})

test("a thrown readonly callback closes descendants and releases the store for a fresh root", async () => {
  await withStores(async (_directory, open) => {
    const store = await open()
    await seed(store)
    const before = await read(store)
    const release = Promise.withResolvers<void>()
    const retained: { observation?: Promise<unknown> } = {}
    await expect(store.readSnapshotRoot!(async () => {
      retained.observation = release.promise.then(() => current(store))
      void retained.observation.catch(() => undefined)
      record(current(store).dashboard.data.left).count = 90
      throw new Error("readonly callback failed")
    })).rejects.toThrow("readonly callback failed")
    await store.readSnapshotRoot!(async () => {
      release.resolve()
      await expect(retained.observation).rejects.toThrow("scope has ended")
      expect(current(store).dashboard).toEqual(before.snapshot)
    })
    expect(await read(store)).toEqual(before)
  })
})

test("an unjoined reader prevents readonly success and cannot observe a closed root", async () => {
  await withStores(async (_directory, open) => {
    const store = await open()
    await seed(store)
    const started = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const child: { pending?: Promise<void> } = {}
    try {
      await expect(store.readSnapshotRoot!(async () => {
        child.pending = store.transaction("planner", async () => {
          started.resolve()
          await release.promise
          expect(() => current(store)).toThrow("scope has ended")
          return { commit: false, value: undefined }
        })
        void child.pending.catch(() => undefined)
        await started.promise
        return "must-not-escape"
      })).rejects.toThrow("Nested local read still active")
      release.resolve()
      await expect(child.pending).rejects.toThrow("scope has ended")
      expect(await store.readSnapshotRoot!(async () => record(current(store).planner.data.left).count)).toBe(1)
    } finally {
      release.resolve()
      await child.pending?.catch(() => undefined)
    }
  })
})

test("captured readonly descendants and blob capabilities expire without borrowing a later root", async () => {
  await withStores(async (_directory, open) => {
    const store = await open()
    await seed(store)
    const release = Promise.withResolvers<void>()
    const retained: { observations?: Promise<unknown>; blobs?: BlobTransaction } = {}
    await store.readSnapshotRoot!(async () => {
      retained.observations = release.promise.then(() => current(store))
      void retained.observations.catch(() => undefined)
      await store.transaction("dashboard", async (_snapshot: Snapshot, blobs: BlobTransaction) => {
        retained.blobs = blobs
        return { commit: false, value: undefined }
      })
      await expect(retained.blobs!.get("document")).rejects.toThrow("scope has ended")
    })
    expect(await store.readSnapshotRoot!(async () => {
      const fresh = current(store)
      release.resolve()
      await expect(retained.observations).rejects.toThrow("scope has ended")
      await expect(retained.blobs!.get("document")).rejects.toThrow("scope has ended")
      await expect(retained.blobs!.put("document", bytes, "binary")).rejects.toThrow("scope has ended")
      await expect(retained.blobs!.remove("document")).rejects.toThrow("scope has ended")
      expect(current(store)).toEqual(fresh)
      return "new-root-valid"
    })).toBe("new-root-valid")
    expect((await read(store)).blob).toBeUndefined()
  })
})

test("dispose drains an admitted readonly root and refuses subsequent admissions", async () => {
  await withStores(async (_directory, open) => {
    const store = await open()
    await seed(store)
    const started = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const calls: string[] = []
    const running = store.readSnapshotRoot!(async () => {
      calls.push("admitted")
      const before = current(store)
      started.resolve()
      await release.promise
      expect(current(store)).toEqual(before)
      return "drained"
    })
    await started.promise
    const completions: string[] = []
    const disposing = store.dispose().then(() => { completions.push("disposed") })
    try {
      await expect(store.readSnapshotRoot!(async () => { calls.push("late") })).rejects.toThrow("disposed")
      expect(completions).toEqual([])
    } finally {
      release.resolve()
      expect(await running).toBe("drained")
      await disposing
    }
    expect(calls).toEqual(["admitted"])
    expect(completions).toEqual(["disposed"])
    expect(record((await read(await open())).snapshot.data.left).count).toBe(1)
  })
})

for (const effect of ["transaction", "transaction-all", "secret-put", "secret-take", "secret-remove"] as const) {
  test(`a ${effect} refused after concurrent dispose still poisons its admitted readonly root when caught`, async () => {
    await withStores(async (_directory, open) => {
      const store = await open()
      await seed(store)
      await store.secrets.put("session", bytes, 1000)
      const before = await read(store)
      const started = Promise.withResolvers<void>()
      const release = Promise.withResolvers<void>()
      const calls = { forbidden: 0, caught: 0 }
      const running = store.readSnapshotRoot!(async () => {
        started.resolve()
        await release.promise
        const attempt = effect === "transaction" ? store.transaction("dashboard", async (snapshot) => {
          calls.forbidden++
          snapshot.data.attempt = "must not survive"
          return { commit: true, value: undefined }
        }) : effect === "transaction-all" ? store.transactionAll!(async () => {
          calls.forbidden++
          return { commit: true, value: undefined }
        }) : effect === "secret-put" ? store.secrets.put("session", new Uint8Array([4]), 2000)
          : effect === "secret-take" ? store.secrets.take("session", 0)
            : store.secrets.remove("session")
        await attempt.catch(() => { calls.caught++ })
        return "must-not-escape"
      })
      const rejected = expect(running).rejects.toThrow("Nested local write attempted")
      await started.promise
      const disposing = store.dispose()
      try {
        release.resolve()
        await rejected
      } finally {
        release.resolve()
        await disposing
      }
      expect(calls).toEqual({ forbidden: 0, caught: 1 })
      const reopened = await open()
      expect(await read(reopened)).toEqual(before)
      expect(await reopened.secrets.get("session", 0)).toEqual(bytes)
    })
  })
}

test("readonly materialization never sanitizes invalid values inserted into a later mutable target", async () => {
  await withStores(async (_directory, open) => {
    const store = await open()
    await seed(store)
    await store.readSnapshotRoot!(async () => current(store))
    const before = await read(store)
    const calls = { getters: 0, nested: 0 }
    const cycle: Record<string, unknown> = {}
    cycle.self = cycle
    const accessor = Object.defineProperty({}, "hidden", { get() { calls.getters++; return 1 }, enumerable: true })
    for (const invalid of [Object.create({ inherited: true }), accessor, cycle, { fn: () => undefined }, { value: Symbol("invalid") }, { value: Infinity }]) {
      await store.transaction("dashboard", async (snapshot) => {
        snapshot.data.invalid = invalid
        expect(() => current(store)).toThrow()
        await expect(store.transaction("dashboard", async () => {
          calls.nested++
          return { commit: false, value: undefined }
        })).rejects.toThrow()
        return { commit: false, value: undefined }
      })
      expect(await read(store)).toEqual(before)
      expect(await store.readSnapshotRoot!(async () => current(store).dashboard)).toEqual(before.snapshot)
    }
    expect(calls).toEqual({ getters: 0, nested: 0 })
  })
})
