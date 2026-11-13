import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import type { LocalStore } from "../../../../runtime/local-contract.ts"
import type { BlobTransaction } from "../../../../runtime/assets.ts"

async function fixture(work: (store: LocalStore, second: LocalStore) => Promise<void>) {
  const root = await mkdtemp(join(await realpath(tmpdir()), "sf-read-scope-"))
  await chmod(root, 0o700)
  const store = await openLocalStore(join(root, "one"), { lockTimeoutMs: 2000 })
  const second = await openLocalStore(join(root, "two"), { lockTimeoutMs: 2000 })
  try {
    await work(store, second)
  } finally {
    await Promise.all([store.dispose(), second.dispose()])
    await rm(root, { recursive: true, force: true })
  }
}

test("nested reads see staged same-surface state and the same transaction's cross-surface blobs without sharing snapshot writes", async () => {
  await fixture(async (store) => {
    await store.transaction("procurement", async (snapshot, blobs) => {
      snapshot.data.saved = "other"
      await blobs.put("item", new Uint8Array([1, 2]), "binary")
      return { commit: true, value: undefined }
    })
    await store.transaction("dashboard", async (outer, outerBlobs) => {
      outer.data.staged = { value: "uncommitted" }
      await outerBlobs.put("item", new Uint8Array([3, 4]), "binary")
      const same = await store.transaction("dashboard", async (snapshot, blobs) => {
        expect(snapshot.data.staged).toEqual({ value: "uncommitted" })
        expect(await blobs.get("item")).toEqual(new Uint8Array([3, 4]))
        snapshot.data.staged = "local-only"
        return { commit: false, value: "read" }
      })
      expect(same).toBe("read")
      expect(outer.data.staged).toEqual({ value: "uncommitted" })
      await store.transaction("procurement", async (snapshot, blobs) => {
        expect(snapshot.data.saved).toBe("other")
        expect(await blobs.get("item")).toEqual(new Uint8Array([1, 2]))
        return { commit: false, value: undefined }
      })
      return { commit: true, value: undefined }
    })
    await store.transaction("dashboard", async (snapshot) => {
      expect(snapshot.data.staged).toEqual({ value: "uncommitted" })
      return { commit: false, value: undefined }
    })
  })
})

for (const mode of ["commit", "blob", "outer-blob", "secret"] as const) {
  test(`nested ${mode} write is refused and poisons the outer commit even when caught`, async () => {
    await fixture(async (store) => {
      await expect(store.transaction("dashboard", async (snapshot, outerBlobs) => {
        snapshot.data.mustRollback = true
        await outerBlobs.put("outer", new Uint8Array([7]), "binary")
        await expect(store.transaction("dashboard", async (_nested, blobs) => {
          if (mode === "blob") await blobs.put("bad", new Uint8Array([1]), "binary")
          if (mode === "outer-blob") await outerBlobs.remove("outer")
          if (mode === "secret") await store.secrets.put("bad", new Uint8Array([1]), 100)
          return { commit: true, value: undefined }
        })).rejects.toThrow()
        return { commit: true, value: undefined }
      })).rejects.toThrow("Nested local write attempted")
      await store.transaction("dashboard", async (snapshot, blobs) => {
        expect(snapshot.data.mustRollback).toBeUndefined()
        expect(await blobs.get("outer")).toBeUndefined()
        expect(await blobs.get("bad")).toBeUndefined()
        return { commit: false, value: undefined }
      })
      expect(await store.secrets.get("bad", 0)).toBeUndefined()
    })
  })
}

test("aborted nested work rolls back outer state and inherited closed scopes cannot reenter", async () => {
  await fixture(async (store) => {
    const release = Promise.withResolvers<void>()
    const entered = Promise.withResolvers<void>()
    const controller = new AbortController()
    const pending = store.transaction("dashboard", async (outer) => {
      outer.data.rollback = true
      await store.transaction("dashboard", async () => {
        entered.resolve()
        await release.promise
        return { commit: false, value: undefined }
      }, { signal: controller.signal })
      return { commit: true, value: undefined }
    })
    await entered.promise
    controller.abort()
    release.resolve()
    await expect(pending).rejects.toThrow()
    const later = Promise.withResolvers<void>()
    const captured: { promise?: Promise<unknown> } = {}
    await store.transaction("dashboard", async () => {
      captured.promise = later.promise.then(() => store.transaction("dashboard", async () => ({ commit: false, value: "unexpected" })))
      return { commit: false, value: undefined }
    })
    later.resolve()
    await expect(captured.promise!).rejects.toThrow("scope has ended")
    await store.transaction("dashboard", async (snapshot) => {
      expect(snapshot.data.rollback).toBeUndefined()
      return { commit: false, value: undefined }
    })
  })
})

test("independent stores retain independent scopes while another outer writer waits", async () => {
  await fixture(async (store, second) => {
    const entered = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const events: string[] = []
    const first = store.transaction("dashboard", async (snapshot) => {
      snapshot.data.order = "first"
      entered.resolve()
      await second.transaction("dashboard", async (other) => {
        other.data.separate = true
        return { commit: true, value: undefined }
      })
      await release.promise
      events.push("first")
      return { commit: true, value: undefined }
    })
    await entered.promise
    const next = store.transaction("dashboard", async (snapshot) => {
      expect(snapshot.data.order).toBe("first")
      events.push("second")
      return { commit: false, value: undefined }
    })
    try {
      expect(events).toEqual([])
      release.resolve()
      await Promise.all([first, next])
      expect(events).toEqual(["first", "second"])
      await second.transaction("dashboard", async (snapshot) => {
        expect(snapshot.data.separate).toBe(true)
        return { commit: false, value: undefined }
      })
    } finally {
      release.resolve()
      await Promise.allSettled([first, next])
    }
  })
})

test("outer commit refuses an unjoined nested read and closes the inherited scope", async () => {
  await fixture(async (store) => {
    const release = Promise.withResolvers<void>()
    const nested: { outcome?: Promise<unknown> } = {}
    await expect(store.transaction("dashboard", async (snapshot) => {
      snapshot.data.mustRollback = true
      nested.outcome = store.transaction("dashboard", async () => {
        await release.promise
        return { commit: false, value: undefined }
      }).then(() => "unexpected", (error: unknown) => error)
      return { commit: true, value: undefined }
    })).rejects.toThrow("Nested local read still active")
    release.resolve()
    expect(await nested.outcome).toBeInstanceOf(Error)
    await store.transaction("dashboard", async (snapshot) => {
      expect(snapshot.data.mustRollback).toBeUndefined()
      return { commit: false, value: undefined }
    })
  })
})

test("nested blob capability expires at its callback boundary even while its parent remains open", async () => {
  await fixture(async (store) => {
    await store.transaction("dashboard", async (_snapshot, outerBlobs) => {
      await outerBlobs.put("visible", new Uint8Array([8]), "binary")
      const escaped = await store.transaction("dashboard", async (_nested, blobs) => {
        expect(await blobs.get("visible")).toEqual(new Uint8Array([8]))
        return { commit: false, value: blobs }
      })
      await expect(escaped.get("visible")).rejects.toThrow("scope has ended")
      expect(await outerBlobs.get("visible")).toEqual(new Uint8Array([8]))
      return { commit: true, value: undefined }
    })
  })
})

test("a nested callback cannot turn a caught write refusal into a successful read", async () => {
  await fixture(async (store) => {
    await expect(store.transaction("dashboard", async () => {
      await expect(store.transaction("dashboard", async (_snapshot, blobs) => {
        await blobs.put("forbidden", new Uint8Array([1]), "binary").catch(() => undefined)
        return { commit: false, value: "must not escape" }
      })).rejects.toThrow("Nested local write attempted")
      return { commit: true, value: undefined }
    })).rejects.toThrow("Nested local write attempted")
  })
})

test("an external async caller cannot mutate captured outer blobs during a nested read", async () => {
  await fixture(async (store) => {
    const trigger = Promise.withResolvers<void>()
    const captured: { blobs?: BlobTransaction } = {}
    // This continuation is registered before the outer transaction establishes its async scope.
    const external = trigger.promise.then(async () => {
      await expect(captured.blobs!.put("forbidden", new Uint8Array([9]), "binary")).rejects.toThrow("Nested blob writes")
    })
    await expect(store.transaction("dashboard", async (snapshot, blobs) => {
      captured.blobs = blobs
      snapshot.data.mustRollback = true
      await expect(store.transaction("dashboard", async () => {
        trigger.resolve()
        await external
        return { commit: false, value: undefined }
      })).rejects.toThrow("Nested local write attempted")
      return { commit: true, value: undefined }
    })).rejects.toThrow("Nested local write attempted")
    await store.transaction("dashboard", async (snapshot, blobs) => {
      expect(snapshot.data.mustRollback).toBeUndefined()
      expect(await blobs.get("forbidden")).toBeUndefined()
      return { commit: false, value: undefined }
    })
  })
})
