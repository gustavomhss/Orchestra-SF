import { expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { chmod, chown, mkdir, mkdtemp, realpath, rm, stat, symlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { decodeSnapshot, encodeSnapshot, openLocalStore } from "../runtime/local-store.ts"
import type { LocalStore } from "../runtime/local-contract.ts"
import type { BlobTransaction } from "../runtime/assets.ts"
import type { Snapshot } from "../runtime/contract.ts"
import { object } from "../runtime/contract.ts"

const bytes = new Uint8Array([0, 255, 17, 128])
const empty: Snapshot = { data: {}, versions: {}, sequences: {}, audit: [], notices: [] }

test("current snapshots are isolated copies in a live transaction and expire with its scope", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    if (!store.currentSnapshots) throw new Error("currentSnapshots unavailable")
    expect(store.currentSnapshots()).toBeUndefined()
    await store.transaction("planner", async (snapshot) => { snapshot.data.value = "persisted"; return { commit: true, value: undefined } })
    const release = Promise.withResolvers<void>()
    const late: { pending?: Promise<unknown> } = {}
    await store.transaction("dashboard", async (snapshot) => {
      snapshot.data.value = "staged"
      const current = store.currentSnapshots!()
      expect(current?.dashboard.data.value).toBe("staged")
      expect(current?.planner.data.value).toBe("persisted")
      if (!current) throw new Error("missing current snapshots")
      current.dashboard.data.value = "copy-only"
      current.planner.data.value = "copy-only"
      expect(store.currentSnapshots!()?.dashboard.data.value).toBe("staged")
      expect(store.currentSnapshots!()?.planner.data.value).toBe("persisted")
      late.pending = release.promise.then(() => store.currentSnapshots!())
      void late.pending.catch(() => undefined)
      return { commit: true, value: undefined }
    })
    release.resolve()
    await expect(late.pending).rejects.toThrow("scope has ended")
    expect(store.currentSnapshots()).toBeUndefined()
    expect(await store.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot.data.value }))).toBe("persisted")
    expect(await store.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.data.value }))).toBe("staged")
  })
})

test("current and nested snapshot copies preserve codec normalization and isolate staged mutations", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    if (!store.currentSnapshots) throw new Error("currentSnapshots unavailable")
    const expected = await store.transaction("dashboard", async (snapshot) => {
      const shared = { value: "original" }
      const sparse: unknown[] = []
      sparse.length = 3
      sparse[1] = undefined
      sparse[2] = shared
      Object.defineProperty(sparse, "extra", { value: "ignored by the array codec", enumerable: true })
      const hidden = Object.defineProperty({ visible: true }, "nonEnumerable", { value: undefined, enumerable: false })
      const nullPrototype: Record<string, unknown> = Object.create(null)
      nullPrototype.value = "plain after decoding"
      Object.defineProperty(nullPrototype, "__proto__", { value: { value: "ordinary own property" }, enumerable: true })
      snapshot.data.copyFixture = { left: shared, right: shared, sparse, hidden, nullPrototype, minusZero: -0, optional: undefined, text: "\ud800" }
      const wire = decodeSnapshot(encodeSnapshot(snapshot))
      const copies = store.currentSnapshots!()
      if (!copies) throw new Error("missing current snapshots")
      expect(copies.dashboard).toEqual(wire)
      const copied = object(copies.dashboard.data.copyFixture)
      expect(Object.is(copied.minusZero, -0)).toBe(true)
      expect(Object.hasOwn(copied, "optional")).toBe(true)
      expect(copied.optional).toBeUndefined()
      expect(Object.getOwnPropertyDescriptor(object(copied.hidden), "nonEnumerable")).toMatchObject({ value: undefined, enumerable: true, writable: true, configurable: true })
      expect(Object.getPrototypeOf(copied.nullPrototype)).toBe(Object.prototype)
      expect(Object.hasOwn(object(copied.nullPrototype), "__proto__")).toBe(true)
      expect(object(copied.nullPrototype).__proto__).toEqual({ value: "ordinary own property" })
      expect(copied.text).toBe("\ud800")
      expect(copied.left).not.toBe(copied.right)
      expect(copied.left).not.toBe(shared)
      const copiedArray = copied.sparse
      if (!Array.isArray(copiedArray)) throw new Error("array projection unavailable")
      expect(copiedArray).toHaveLength(3)
      expect(Object.hasOwn(copiedArray, 0)).toBe(true)
      expect(Object.hasOwn(copiedArray, 1)).toBe(true)
      expect(copiedArray[0]).toBeUndefined()
      expect(Object.hasOwn(copiedArray, "extra")).toBe(false)
      expect(copiedArray[2]).not.toBe(copied.left)
      object(copied.left).value = "copy only"
      copies.dashboard.data.extra = "copy only"
      expect(shared.value).toBe("original")
      expect(snapshot.data).not.toHaveProperty("extra")
      expect(store.currentSnapshots!()?.dashboard).toEqual(wire)
      await store.transaction("dashboard", async (nested) => {
        expect(nested).toEqual(wire)
        const value = object(nested.data.copyFixture)
        expect(value.left).not.toBe(value.right)
        object(value.left).value = "nested only"
        nested.data.extra = "nested only"
        expect(shared.value).toBe("original")
        expect(store.currentSnapshots!()?.dashboard).toEqual(wire)
        return { commit: false, value: undefined }
      })
      expect(shared.value).toBe("original")
      expect(snapshot.data).not.toHaveProperty("extra")
      return { commit: true, value: wire }
    })
    expect(await store.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot }))).toEqual(expected)
  })
})

test("current and nested snapshot copies retain codec rejection and snapshot validation", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    if (!store.currentSnapshots) throw new Error("currentSnapshots unavailable")
    const getters = { calls: 0 }
    const cycle: Record<string, unknown> = {}
    cycle.self = cycle
    const unsupported: unknown[] = [NaN, Infinity, -Infinity, 1n, () => true]
    const cases: { install: (snapshot: Snapshot) => void; reason: string }[] = [
      ...unsupported.map((value) => ({ install: (snapshot: Snapshot) => { snapshot.data.value = value }, reason: "Unsupported local snapshot value" })),
      { install: (snapshot) => { snapshot.data.value = cycle }, reason: "Cyclic local snapshot" },
      { install: (snapshot) => { snapshot.data.value = new Date(0) }, reason: "Local snapshots require plain objects" },
      { install: (snapshot) => { snapshot.data.value = { [Symbol("private")]: true } }, reason: "Unsupported symbol properties" },
      { install: (snapshot) => { snapshot.data.value = Object.defineProperty({}, "accessor", { get: () => { getters.calls++; return "not read" } }) }, reason: "Unsupported snapshot accessor" },
      { install: (snapshot) => { Object.assign(snapshot, { data: [] }) }, reason: "Corrupt local snapshot shape" },
      { install: (snapshot) => { snapshot.versions.record = { version: -1, by: "actor" } }, reason: "Corrupt local snapshot contents" },
      { install: (snapshot) => { snapshot.sfBlobGenerations = { file: -1 } }, reason: "Corrupt local blob generations" },
    ]
    for (const invalid of cases) {
      await store.transaction("dashboard", async (snapshot) => {
        const generations = snapshot.sfBlobGenerations
        try {
          invalid.install(snapshot)
          expect(() => store.currentSnapshots!()).toThrow(invalid.reason)
          await expect(store.transaction("dashboard", async () => ({ commit: false, value: undefined }))).rejects.toThrow(invalid.reason)
        } finally {
          // The invalid-map case tests decoding; leave the independent private-write guard intact.
          if (generations === undefined) delete snapshot.sfBlobGenerations
          else snapshot.sfBlobGenerations = generations
        }
        return { commit: false, value: undefined }
      })
    }
    expect(getters.calls).toBe(0)
    expect(await store.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot }))).toEqual(empty)
  })
})

test("all-surface transaction exposes staged nested reads and rejects nested writes", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    expect(store.transactionAll).toBeDefined()
    if (!store.transactionAll) return
    await store.transactionAll(async (snapshots) => {
      snapshots.dashboard.data.value = "dashboard-staged"
      snapshots.planner.data.value = "planner-staged"
      expect(await store.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot.data.value }))).toBe("planner-staged")
      return { commit: true, value: undefined }
    })
    await expect(store.transactionAll(async (snapshots) => {
      snapshots.dashboard.data.value = "should-rollback"
      await expect(store.transaction("planner", async () => ({ commit: true, value: undefined }))).rejects.toThrow("Nested local writes")
      return { commit: true, value: undefined }
    })).rejects.toThrow("Nested local write attempted")
    expect(await store.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.data.value }))).toBe("dashboard-staged")
    expect(await store.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot.data.value }))).toBe("planner-staged")
    const release = Promise.withResolvers<void>()
    const started = Promise.withResolvers<void>()
    const child: { pending?: Promise<unknown> } = {}
    await expect(store.transactionAll(async (snapshots) => {
      snapshots.dashboard.data.value = "detached-rollback"
      child.pending = store.transaction("planner", async () => {
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
    expect(await store.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.data.value }))).toBe("dashboard-staged")
  })
})

async function fixture(work: (directory: string, open: (options?: { lockTimeoutMs?: number }) => Promise<LocalStore>) => Promise<void>) {
  const root = await mkdtemp(join(await realpath(tmpdir()), "sucafina-store-test-"))
  const stores: LocalStore[] = []
  await chmod(root, 0o700)
  try {
    await work(join(root, "private"), async (options) => {
      const store = await openLocalStore(join(root, "private"), options)
      stores.push(store)
      return store
    })
  } finally {
    await Promise.all(stores.map((store) => store.dispose()))
    await rm(root, { recursive: true, force: true })
  }
}

function barrier() {
  const ready = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  return { ready, release }
}

async function read(store: LocalStore) {
  return store.transaction("dashboard", async (snapshot: Snapshot, blobs: BlobTransaction) => ({
    commit: false,
    value: { snapshot: structuredClone(snapshot), blob: await blobs.get("document") },
  }))
}

async function populate(snapshot: Snapshot) {
  snapshot.data.record = { name: "created", optional: undefined }
  snapshot.versions.record = { version: 1, by: "actor" }
  snapshot.sequences.record = 1
  snapshot.audit.push({ who: "actor", at: "2026-11-11", record: "record", was: undefined, became: snapshot.data.record })
  snapshot.notices.push({ kind: "pending", to: ["reviewer"], record: "record", at: "2026-11-11" })
}

test("real SQLite persists the entire snapshot, binary blobs and undefined across reopen", async () => {
  await fixture(async (directory, open) => {
    const store = await open()
    expect(await read(store)).toEqual({ snapshot: empty, blob: undefined })
    await store.transaction("dashboard", async (snapshot: Snapshot, blobs: BlobTransaction) => {
      await populate(snapshot)
      await blobs.put("document", bytes, "application/octet-stream")
      return { commit: true, value: "saved" }
    })
    const before = await read(store)
    await store.dispose()
    const reopened = await open()
    expect(await read(reopened)).toEqual(before)
    expect(before.blob).toEqual(bytes)
    expect(Object.hasOwn(before.snapshot.audit[0]!, "was")).toBe(true)
    expect(before.snapshot.audit[0]!.was).toBeUndefined()
    expect((await stat(directory)).mode & 0o777).toBe(0o700)
    expect((await stat(join(directory, "installation.sqlite"))).mode & 0o777).toBe(0o600)
    const db = new Database(join(directory, "installation.sqlite"), { readonly: true })
    try {
      expect(db.query("PRAGMA journal_mode").get()).toEqual({ journal_mode: "wal" })
    } finally {
      db.close()
    }
  })
})

test("codec preserves sentinel-shaped objects, tagged-looking arrays and nested undefined", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    const value = {
      $undefined: true, __type: "undefined", $type: "number", value: null,
      nested: [undefined, ["undefined"], ["object", [["x", ["undefined"]]]], false, 0, ""],
      object: { constructor: "data", prototype: "data", missing: undefined },
    }
    await store.transaction("dashboard", async (snapshot) => {
      snapshot.data.value = value
      return { commit: true, value: null }
    })
    await store.dispose()
    expect((await read(await open())).snapshot.data.value).toEqual(value)
  })
})

for (const mode of ["false", "throw", "abort"] as const) {
  test(`${mode} rolls back state, versions, sequences, audit, notices and blob additions/removals`, async () => {
    await fixture(async (_directory, open) => {
      const store = await open()
      await store.transaction("dashboard", async (_snapshot: Snapshot, blobs: BlobTransaction) => {
        await blobs.put("document", bytes, "binary")
        return { commit: true, value: null }
      })
      const before = await read(store)
      const controller = new AbortController()
      const result = store.transaction("dashboard", async (snapshot: Snapshot, blobs: BlobTransaction) => {
        await populate(snapshot)
        await blobs.remove("document")
        await blobs.put("orphan", bytes, "binary")
        if (mode === "throw") throw new Error("callback failed")
        if (mode === "abort") controller.abort()
        return { commit: mode !== "false", value: "declined" }
      }, { signal: controller.signal })
      if (mode === "false") expect(await result).toBe("declined")
      if (mode !== "false") await expect(result).rejects.toThrow()
      await store.dispose()
      const reopened = await open()
      expect(await read(reopened)).toEqual(before)
      await reopened.transaction("dashboard", async (_snapshot: Snapshot, blobs: BlobTransaction) => {
        expect(await blobs.get("orphan")).toBeUndefined()
        return { commit: false, value: null }
      })
    })
  })
}

for (const value of [NaN, Infinity, -Infinity, () => 1, { nested: () => 2 }]) {
  test(`unsupported codec value ${String(value)} rejects without modifying persisted state`, async () => {
    await fixture(async (_directory, open) => {
      const store = await open()
      await expect(store.transaction("dashboard", async (snapshot: Snapshot, blobs: BlobTransaction) => {
        snapshot.data.invalid = value
        await blobs.put("document", bytes, "binary")
        return { commit: true, value: null }
      })).rejects.toThrow()
      expect(await read(store)).toEqual({ snapshot: empty, blob: undefined })
    })
  })
}

test("cyclic state rejects atomically", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    const cycle: Record<string, unknown> = {}
    cycle.self = cycle
    await expect(store.transaction("dashboard", async (snapshot) => {
      snapshot.data.cycle = cycle
      return { commit: true, value: null }
    })).rejects.toThrow()
    expect((await read(store)).snapshot).toEqual(empty)
  })
})

for (const same of [false, true]) {
  test(`independent instances serialize ${same ? "same-record CAS" : "different-record"} writes without replay`, async () => {
    await fixture(async (_directory, open) => {
      const first = await open()
      const second = await open()
      const held = barrier()
      const calls: string[] = []
      const one = first.transaction("dashboard", async (snapshot) => {
        calls.push("first")
        held.ready.resolve()
        await held.release.promise
        snapshot.data.first = "one"
        snapshot.versions.first = { version: 1, by: "one" }
        return { commit: true, value: true }
      })
      await held.ready.promise
      try {
        const two = second.transaction("dashboard", async (snapshot) => {
          calls.push("second")
          const key = same ? "first" : "second"
          if (snapshot.versions[key]) return { commit: false, value: false }
          snapshot.data[key] = "two"
          snapshot.versions[key] = { version: 1, by: "two" }
          return { commit: true, value: true }
        })
        await Bun.sleep(30)
        expect(calls).toEqual(["first"])
        held.release.resolve()
        expect(await one).toBe(true)
        expect(await two).toBe(!same)
        expect(calls).toEqual(["first", "second"])
        expect((await read(first)).snapshot.data).toEqual(same ? { first: "one" } : { first: "one", second: "two" })
      } finally {
        held.release.resolve()
        await one
      }
    })
  })
}

test("surface namespaces isolate identical blob keys and snapshots", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    await store.transaction("dashboard", async (snapshot: Snapshot, blobs: BlobTransaction) => {
      snapshot.data.private = true
      await blobs.put("document", bytes, "binary")
      return { commit: true, value: null }
    })
    await store.transaction("procurement", async (snapshot: Snapshot, blobs: BlobTransaction) => {
      expect(snapshot).toEqual(empty)
      expect(await blobs.get("document")).toBeUndefined()
      await blobs.put("document", new Uint8Array([9]), "binary")
      snapshot.data.other = true
      return { commit: true, value: null }
    })
    expect(await read(store)).toEqual({ snapshot: { ...empty, data: { private: true }, sfBlobGenerations: { document: 1 } }, blob: bytes })
    expect(await store.transaction("procurement", async (snapshot, blobs) => ({
      commit: false,
      value: { snapshot, blob: await blobs.get("document") },
    }))).toEqual({ snapshot: { ...empty, data: { other: true }, sfBlobGenerations: { document: 1 } }, blob: new Uint8Array([9]) })
  })
})

for (const abort of [true, false]) {
  test(`pending lock ${abort ? "cancellation" : "timeout"} never invokes work`, async () => {
    await fixture(async (_directory, open) => {
      const first = await open()
      const second = await open({ lockTimeoutMs: 80 })
      const held = barrier()
      const calls: string[] = []
      const one = first.transaction("dashboard", async () => {
        held.ready.resolve()
        await held.release.promise
        return { commit: true, value: null }
      })
      await held.ready.promise
      try {
        const controller = new AbortController()
        const pending = second.transaction("dashboard", async () => {
          calls.push("unexpected")
          return { commit: true, value: null }
        }, { signal: controller.signal })
        const rejected = expect(pending).rejects.toThrow()
        if (abort) controller.abort()
        await rejected
        expect(calls).toEqual([])
      } finally {
        held.release.resolve()
        await one
      }
    })
  })
}

test("secrets get is read-only inside a business write; expiry, atomic take and removal persist", async () => {
  await fixture(async (_directory, open) => {
    const store = await open({ lockTimeoutMs: 100 })
    const other = await open({ lockTimeoutMs: 100 })
    await store.secrets.put("token", bytes, 200)
    await store.transaction("dashboard", async (snapshot) => {
      expect(await store.secrets.get("token", 199)).toEqual(bytes)
      expect(await store.secrets.get("token", 200)).toBeUndefined()
      expect(await store.secrets.get("token", 199)).toEqual(bytes)
      snapshot.data.saved = true
      return { commit: true, value: null }
    })
    const taken = await Promise.all([store.secrets.take("token", 199), other.secrets.take("token", 199)])
    expect(taken.filter((item) => item !== undefined)).toEqual([bytes])
    expect(await store.secrets.get("token", 199)).toBeUndefined()
    await store.secrets.put("expired", bytes, 100)
    expect(await store.secrets.take("expired", 100)).toBeUndefined()
    await store.secrets.put("removed", bytes, 300)
    await store.secrets.remove("removed")
    await store.secrets.put("durable", bytes, 300)
    await store.dispose()
    const reopened = await open()
    expect(await reopened.secrets.get("removed", 0)).toBeUndefined()
    expect(await reopened.secrets.get("durable", 299)).toEqual(bytes)
    expect((await read(reopened)).snapshot.data).toEqual({ saved: true })
  })
})

test("blob capabilities expire after callback and dispose drains work while prohibiting new operations", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    const leaked = await store.transaction("dashboard", async (_snapshot: Snapshot, blobs: BlobTransaction) => ({ commit: true, value: blobs }))
    await expect(leaked.get("document")).rejects.toThrow()
    await expect(leaked.put("document", bytes, "binary")).rejects.toThrow()
    await expect(leaked.remove("document")).rejects.toThrow()
    const held = barrier()
    const running = store.transaction("dashboard", async (snapshot) => {
      held.ready.resolve()
      await held.release.promise
      snapshot.data.drained = true
      return { commit: true, value: null }
    })
    await held.ready.promise
    const completed: string[] = []
    const disposing = store.dispose().then(() => { completed.push("disposed") })
    try {
      await expect(store.transaction("dashboard", async () => ({ commit: false, value: null }))).rejects.toThrow()
      await expect(store.secrets.get("x", 0)).rejects.toThrow()
      await expect(store.secrets.put("x", bytes, 1)).rejects.toThrow()
      await expect(store.secrets.take("x", 0)).rejects.toThrow()
      await expect(store.secrets.remove("x")).rejects.toThrow()
      expect(completed).toEqual([])
    } finally {
      held.release.resolve()
      await running
      await disposing
    }
    expect((await read(await open())).snapshot.data).toEqual({ drained: true })
  })
})

test("relative and memory paths are rejected before opening storage", async () => {
  await expect(openLocalStore("relative-directory")).rejects.toThrow()
  await expect(openLocalStore(":memory:")).rejects.toThrow()
})

test("an existing accessible directory is rejected without changing its permissions", async () => {
  await fixture(async (directory, open) => {
    const store = await open()
    await store.dispose()
    await chmod(directory, 0o755)
    await expect(open()).rejects.toThrow()
    expect((await stat(directory)).mode & 0o777).toBe(0o755)
  })
})

test("a corrupt existing SQLite file rejects rather than returning an empty installation", async () => {
  await fixture(async (directory, open) => {
    const store = await open()
    await store.dispose()
    await Bun.write(join(directory, "installation.sqlite"), "not a SQLite database")
    await expect((async () => read(await open()))()).rejects.toThrow()
  })
})

test("corrupt stored snapshot payload rejects before callback instead of synthesizing empty state", async () => {
  await fixture(async (directory, open) => {
    const store = await open()
    const db = new Database(join(directory, "installation.sqlite"))
    try {
      db.query("INSERT INTO snapshots (surface, payload) VALUES (?, ?)").run("dashboard", '{"data":{}}')
    } finally {
      db.close()
    }
    const calls: string[] = []
    await expect(store.transaction("dashboard", async () => {
      calls.push("unexpected")
      return { commit: true, value: null }
    })).rejects.toThrow()
    expect(calls).toEqual([])
  })
})

test("already aborted transactions never invoke callback", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    const controller = new AbortController()
    controller.abort()
    const calls: string[] = []
    await expect(store.transaction("dashboard", async () => {
      calls.push("unexpected")
      return { commit: true, value: null }
    }, { signal: controller.signal })).rejects.toThrow()
    expect(calls).toEqual([])
    expect((await read(store)).snapshot).toEqual(empty)
  })
})

for (const target of ["directory", "ancestor", "database"] as const) {
  test(`rejects ${target} symlinks without creating storage through an alias`, async () => {
    await fixture(async (directory, open) => {
      const parent = join(directory, "..")
      const actual = join(parent, "actual")
      await mkdir(actual, { mode: 0o700 })
      if (target === "database") {
        const store = await open()
        await store.dispose()
        await rm(join(directory, "installation.sqlite"))
        await Bun.write(join(actual, "other.sqlite"), "untouched")
        await chmod(join(actual, "other.sqlite"), 0o600)
        await symlink(join(actual, "other.sqlite"), join(directory, "installation.sqlite"))
        await expect(open()).rejects.toThrow()
        expect(await Bun.file(join(actual, "other.sqlite")).text()).toBe("untouched")
        return
      }
      await symlink(actual, directory, "dir")
      await expect(openLocalStore(target === "ancestor" ? join(directory, "child") : directory)).rejects.toThrow()
      expect(await Bun.file(join(actual, "installation.sqlite")).exists()).toBe(false)
      await expect(stat(join(actual, "child"))).rejects.toThrow()
    })
  })
}

test("creating nested private directories preserves existing parent permissions", async () => {
  await fixture(async (directory) => {
    await mkdir(directory, { mode: 0o755 })
    await chmod(directory, 0o755)
    const store = await openLocalStore(join(directory, "new", "private"))
    try {
      expect((await stat(directory)).mode & 0o777).toBe(0o755)
      expect((await stat(join(directory, "new"))).mode & 0o777).toBe(0o700)
      expect((await stat(join(directory, "new", "private"))).mode & 0o777).toBe(0o700)
    } finally {
      await store.dispose()
    }
  })
})

for (const target of ["directory", "database"] as const) {
  test.skipIf(process.getuid?.() !== 0)(`rejects foreign UID ${target} (requires root fixture privileges)`, async () => {
    await fixture(async (directory, open) => {
      const store = await open()
      await store.dispose()
      const path = target === "directory" ? directory : join(directory, "installation.sqlite")
      await chown(path, 65534, 65534)
      try {
        await expect(open()).rejects.toThrow()
      } finally {
        await chown(path, 0, 0)
      }
    })
  })
}

test("malformed but encodable snapshot rejects before commit and rolls back staged bytes", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    await expect(store.transaction("dashboard", async (snapshot: Snapshot, blobs: BlobTransaction) => {
      snapshot.versions.invalid = { version: -1, by: "actor" }
      await blobs.put("document", bytes, "binary")
      return { commit: true, value: "must not return" }
    })).rejects.toThrow()
    expect(await read(store)).toEqual({ snapshot: empty, blob: undefined })
  })
})

test("one SQLite store survives a mixed concurrent burst across surfaces, secrets and binary assets without lost or replayed writes", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    const surfaces = ["dashboard", "planner", "procurement"] as const
    const indices = Array.from({ length: 12 }, (_, index) => index)
    await store.secrets.put("session", bytes, 1000)
    await Promise.all(indices.flatMap((index) => [
      store.secrets.put(`take:${index}`, new Uint8Array([index, 255]), 1000),
      store.secrets.put(`remove:${index}`, bytes, 1000),
    ]))
    const held = barrier()
    const running = store.transaction("dashboard", async () => {
      held.ready.resolve()
      await held.release.promise
      return { commit: false, value: null }
    })
    await held.ready.promise
    const calls: string[] = []
    const operations = indices.flatMap((index) => [
      ...surfaces.map((surface, position) => store.transaction(surface, async (snapshot: Snapshot, blobs: BlobTransaction) => {
        const key = `asset:${index}`
        calls.push(`${surface}:${index}`)
        // Authentication reads use the same store while the business writer owns its connection.
        expect(await store.secrets.get("session", 999)).toEqual(bytes)
        expect(await store.secrets.get("session", 1000)).toBeUndefined()
        // Await actual BLOB work while holding the transaction, as business asset writes do.
        await blobs.put(key, new Uint8Array([index, position, 255, 0]), "application/octet-stream")
        expect(await blobs.get(key)).toEqual(new Uint8Array([index, position, 255, 0]))
        snapshot.sequences.accepted = (snapshot.sequences.accepted ?? 0) + 1
        snapshot.data[key] = index
        snapshot.versions[key] = { version: 1, by: "local-operator" }
        snapshot.audit.push({ who: "local-operator", at: "2026-11-12", record: key, was: null, became: index })
        return { commit: true, value: key }
      })),
      store.secrets.put(`durable:${index}`, new Uint8Array([index, 128]), 1000),
      store.secrets.get("session", 999).then((value) => { expect(value).toEqual(bytes) }),
      store.secrets.take(`take:${index}`, 999).then((value) => { expect(value).toEqual(new Uint8Array([index, 255])) }),
      store.secrets.remove(`remove:${index}`),
    ])
    const completed = Promise.allSettled(operations)
    try {
      held.release.resolve()
      await running
      const results = await completed
      expect(results.filter((result) => result.status === "rejected")).toEqual([])
      expect(results).toHaveLength(84)
      expect(calls.toSorted()).toEqual(surfaces.flatMap((surface) => indices.map((index) => `${surface}:${index}`)).toSorted())
      await store.dispose()
      const reopened = await open()
      for (const [position, surface] of surfaces.entries()) {
        await reopened.transaction(surface, async (snapshot: Snapshot, blobs: BlobTransaction) => {
          expect(snapshot.sequences.accepted).toBe(12)
          expect(snapshot.audit).toHaveLength(12)
          expect(Object.keys(snapshot.versions)).toHaveLength(12)
          expect(Object.keys(snapshot.data)).toHaveLength(12)
          for (const index of indices) {
            expect(snapshot.data[`asset:${index}`]).toBe(index)
            expect(snapshot.versions[`asset:${index}`]).toEqual({ version: 1, by: "local-operator" })
            expect(await blobs.get(`asset:${index}`)).toEqual(new Uint8Array([index, position, 255, 0]))
          }
          return { commit: false, value: null }
        })
      }
      await Promise.all(indices.map(async (index) => {
        expect(await reopened.secrets.get(`durable:${index}`, 999)).toEqual(new Uint8Array([index, 128]))
        expect(await reopened.secrets.get(`take:${index}`, 999)).toBeUndefined()
        expect(await reopened.secrets.get(`remove:${index}`, 999)).toBeUndefined()
      }))
    } finally {
      held.release.resolve()
      await running
      await completed
    }
  })
}, 15000)

test("dispose drains already admitted mixed operations and cancelled work without admitting late writes", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    await store.secrets.put("take-before-close", bytes, 1000)
    await store.secrets.put("remove-before-close", bytes, 1000)
    const held = barrier()
    const running = store.transaction("dashboard", async (snapshot) => {
      held.ready.resolve()
      await held.release.promise
      snapshot.data.running = true
      return { commit: true, value: null }
    })
    await held.ready.promise
    const controller = new AbortController()
    const calls: string[] = []
    const cancelled = store.transaction("dashboard", async () => {
      calls.push("cancelled")
      return { commit: true, value: null }
    }, { signal: controller.signal })
    const cancellation = expect(cancelled).rejects.toThrow()
    controller.abort()
    const admitted = Promise.allSettled([
      ...(["dashboard", "planner", "procurement"] as const).map((surface) => store.transaction(surface, async (snapshot: Snapshot, blobs: BlobTransaction) => {
        calls.push(surface)
        snapshot.data.admitted = true
        await blobs.put("admitted", bytes, "application/octet-stream")
        return { commit: true, value: surface }
      })),
      store.secrets.put("put-before-close", bytes, 1000),
      store.secrets.take("take-before-close", 999),
      store.secrets.remove("remove-before-close"),
    ])
    const drained: string[] = []
    const disposing = store.dispose().then(() => { drained.push("disposed") })
    try {
      await expect(store.transaction("dashboard", async () => {
        calls.push("late")
        return { commit: true, value: null }
      })).rejects.toThrow()
      await expect(store.secrets.put("late-secret", bytes, 1000)).rejects.toThrow()
      expect(drained).toEqual([])
    } finally {
      held.release.resolve()
      await running
      await cancellation
      await admitted
      await disposing
    }
    expect(drained).toEqual(["disposed"])
    expect(calls.toSorted()).toEqual(["dashboard", "planner", "procurement"])
    const results = await admitted
    expect(results.filter((result) => result.status === "rejected")).toEqual([])
    expect(results[4]).toMatchObject({ status: "fulfilled", value: bytes })
    const reopened = await open()
    for (const surface of ["dashboard", "planner", "procurement"] as const) {
      await reopened.transaction(surface, async (snapshot: Snapshot, blobs: BlobTransaction) => {
        expect(snapshot.data).toEqual(surface === "dashboard" ? { running: true, admitted: true } : { admitted: true })
        expect(await blobs.get("admitted")).toEqual(bytes)
        return { commit: false, value: null }
      })
    }
    expect(await reopened.secrets.get("put-before-close", 999)).toEqual(bytes)
    expect(await reopened.secrets.get("take-before-close", 999)).toBeUndefined()
    expect(await reopened.secrets.get("remove-before-close", 999)).toBeUndefined()
    expect(await reopened.secrets.get("late-secret", 999)).toBeUndefined()
  })
}, 15000)

for (const mode of ["abort", "timeout"] as const) {
  test(`same-instance ${mode} before admission never invokes work or lets a later operation overtake its active predecessor`, async () => {
    await fixture(async (_directory, open) => {
      const store = await open({ lockTimeoutMs: 100 })
      const held = barrier()
      const calls: string[] = []
      const running = store.transaction("dashboard", async (snapshot) => {
        calls.push("first")
        held.ready.resolve()
        await held.release.promise
        snapshot.data.first = "committed"
        return { commit: true, value: null }
      })
      await held.ready.promise
      const controller = new AbortController()
      const pending = store.transaction("dashboard", async (snapshot) => {
        calls.push("must not run")
        snapshot.data.cancelled = true
        return { commit: true, value: null }
      }, { signal: controller.signal })
      const rejected = mode === "timeout"
        ? expect(pending).rejects.toThrow("Local storage lock timeout")
        : expect(pending).rejects.toThrow()
      const completions: Promise<unknown>[] = [running, pending]
      try {
        if (mode === "abort") controller.abort()
        await rejected
        expect(calls).toEqual(["first"])
        const third = store.transaction("dashboard", async (snapshot: Snapshot, blobs: BlobTransaction) => {
          calls.push("third")
          expect(snapshot.data).toEqual({ first: "committed" })
          snapshot.data.third = "committed"
          await blobs.put("third", bytes, "application/octet-stream")
          return { commit: true, value: null }
        })
        completions.push(third)
        // Give an incorrectly released waiter a turn while the predecessor is still held.
        await Bun.sleep(10)
        expect(calls).toEqual(["first"])
        held.release.resolve()
        await running
        await third
        expect(calls).toEqual(["first", "third"])
        await store.dispose()
        const reopened = await open()
        await reopened.transaction("dashboard", async (snapshot: Snapshot, blobs: BlobTransaction) => {
          expect(snapshot.data).toEqual({ first: "committed", third: "committed" })
          expect(await blobs.get("third")).toEqual(bytes)
          return { commit: false, value: null }
        })
      } finally {
        held.release.resolve()
        await Promise.allSettled(completions)
        await rejected
      }
    })
  }, 10000)
}
