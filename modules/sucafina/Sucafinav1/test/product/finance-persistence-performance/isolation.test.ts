import { expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { BlobTransaction } from "../../../runtime/assets.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import type { LocalStore } from "../../../runtime/local-contract.ts"
import { decodeSnapshot, encodeSnapshot, openLocalStore } from "../../../runtime/local-store.ts"

async function fixture(work: (directory: string, open: () => Promise<LocalStore>) => Promise<void>) {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-persistence-isolation-"))
  await chmod(directory, 0o700)
  const stores: LocalStore[] = []
  try {
    await work(directory, async () => {
      const store = await openLocalStore(directory)
      stores.push(store)
      return store
    })
  } finally {
    await Promise.all(stores.map((store) => store.dispose()))
    await rm(directory, { recursive: true, force: true })
  }
}

function read(store: LocalStore) {
  // Return the actual callback object: retaining a hidden shared snapshot would
  // let the mutations below contaminate later callbacks or persisted state.
  return store.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot }))
}

function replace(directory: string, payload: string | undefined) {
  const database = new Database(join(directory, "installation.sqlite"), { strict: true })
  try {
    if (payload === undefined) {
      database.query("DELETE FROM snapshots WHERE surface = ?").run("dashboard")
      return
    }
    database.query("INSERT INTO snapshots (surface, payload) VALUES (?, ?) ON CONFLICT (surface) DO UPDATE SET payload=excluded.payload").run("dashboard", payload)
  } finally { database.close() }
}

async function seed(store: LocalStore) {
  await store.transaction("dashboard", async (snapshot: Snapshot, blobs: BlobTransaction) => {
    snapshot.data.record = { name: "one", nested: { value: 1 }, optional: undefined }
    snapshot.versions.record = { version: 7, by: "original" }
    snapshot.sequences.record = 7
    snapshot.audit.push({ who: "original", at: "2026-11-14", record: "record", was: undefined, became: "one" })
    await blobs.put("document", new Uint8Array([1, 255, 0]), "binary")
    return { commit: true, value: undefined }
  })
  return read(store)
}

test("snapshot materialization preserves v1 values, property order and owned undefined across warm reads and reopen", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    const special = Object.create(null) as Record<string, unknown>
    special["10"] = "ten"
    special["2"] = "two"
    special[""] = undefined
    special["__proto__"] = { own: undefined, negative: -0 }
    Object.defineProperty(special, "constructor", { value: "ordinary-data", enumerable: true })
    special.toJSON = { ordinary: "not a hook" }
    special.prototype = [undefined, -0, ["undefined"], ["number", "-0"]]
    Object.defineProperty(special, "hidden", { value: undefined, enumerable: false })
    const holes = new Array<unknown>(3)
    holes[1] = -0
    await store.transaction("dashboard", async (snapshot) => {
      snapshot.data.special = special
      snapshot.data.holes = holes
      snapshot.data.protoUndefined = Object.fromEntries([["__proto__", undefined]])
      snapshot.data["escaped/key~"] = { "\u0000\"\\": undefined, text: "a\ud800b\u0000" }
      snapshot.audit.push({ who: "actor", at: "2026-11-14", record: "special", was: undefined, became: -0 })
      return { commit: true, value: undefined }
    })
    const first = await read(store)
    const payload = encodeSnapshot(first)
    const expected = decodeSnapshot(payload)
    for (let index = 0; index < 3; index++) {
      const current = await read(store)
      expect(current).not.toBe(first)
      expect(encodeSnapshot(current)).toBe(payload)
      expect(current).toEqual(expected)
      const value = current.data.special as Record<string, unknown>
      expect(Object.getPrototypeOf(value)).toBe(Object.prototype)
      expect(Object.keys(value)).toEqual(["2", "10", "", "__proto__", "constructor", "toJSON", "prototype", "hidden"])
      expect(Object.hasOwn(value, "__proto__")).toBe(true)
      expect(Object.hasOwn(value, "hidden")).toBe(true)
      expect(Object.hasOwn(value, "")).toBe(true)
      expect(value.hidden).toBeUndefined()
      expect(Object.is((value["__proto__"] as Record<string, unknown>).negative, -0)).toBe(true)
      expect(Object.hasOwn(value["__proto__"] as object, "own")).toBe(true)
      expect(Object.hasOwn(current.data.holes as object, "0")).toBe(true)
      expect(Object.hasOwn(current.data.holes as object, "2")).toBe(true)
      expect(Object.is((current.data.holes as unknown[])[1], -0)).toBe(true)
      expect(Object.is(current.audit[0]!.became, -0)).toBe(true)
      expect(Object.getPrototypeOf(current.data.protoUndefined)).toBe(Object.prototype)
      expect(Object.hasOwn(current.data.protoUndefined as object, "__proto__")).toBe(true)
      expect((current.data.protoUndefined as Record<string, unknown>)["__proto__"]).toBeUndefined()
    }
    await store.dispose()
    expect(encodeSnapshot(await read(await open()))).toBe(payload)
  })
})

test("warm snapshot outputs and declined callbacks never become the next observation", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    const before = encodeSnapshot(await seed(store))
    const retained = await read(store)
    ;(retained.data.record as Record<string, unknown>).name = "retained mutation"
    retained.audit[0]!.became = "retained mutation"
    retained.versions.record!.version = 99
    const declined = await store.transaction("dashboard", async (snapshot) => {
      expect(encodeSnapshot(snapshot)).toBe(before)
      snapshot.data.record = { name: "declined" }
      return { commit: false, value: snapshot }
    })
    declined.data.record = { name: "late declined mutation" }
    expect(encodeSnapshot(await read(store))).toBe(before)
    const committed = await store.transaction("dashboard", async (snapshot) => {
      snapshot.data.record = { name: "committed", optional: undefined }
      return { commit: true, value: snapshot }
    })
    const after = encodeSnapshot(await read(store))
    committed.data.record = { name: "late committed mutation" }
    expect(encodeSnapshot(await read(store))).toBe(after)
    await store.dispose()
    expect(encodeSnapshot(await read(await open()))).toBe(after)
  })
})

test("warm materialization observes changed SQL bytes with identical versions and payload length, deletion and restoration", async () => {
  await fixture(async (directory, open) => {
    const store = await open()
    const first = await seed(store)
    const original = encodeSnapshot(first)
    expect(encodeSnapshot(await read(store))).toBe(original)
    ;(first.data.record as Record<string, unknown>).name = "two"
    const changed = encodeSnapshot(first)
    expect(changed.length).toBe(original.length)
    expect(changed).not.toBe(original)
    replace(directory, changed)
    const observed = await read(store)
    expect(encodeSnapshot(observed)).toBe(changed)
    expect(observed.versions).toEqual({ record: { version: 7, by: "original" } })
    replace(directory, undefined)
    expect(await read(store)).toEqual({ data: {}, versions: {}, sequences: {}, audit: [], notices: [] })
    replace(directory, original)
    expect(encodeSnapshot(await read(store))).toBe(original)
  })
})

test("changed malformed payloads reject before callback after a valid warm observation", async () => {
  await fixture(async (directory, open) => {
    const store = await open()
    const original = encodeSnapshot(await seed(store))
    const duplicate = JSON.parse(original) as [string, number, [string, [string, unknown][]]]
    duplicate[2][1].push(duplicate[2][1][0]!)
    const invalid = decodeSnapshot(original)
    invalid.versions.record!.version = -1
    for (const payload of ["[", '["sucafina-snapshot",2,["null"]]', JSON.stringify(duplicate), encodeSnapshot(invalid)]) {
      expect(encodeSnapshot(await read(store))).toBe(original)
      replace(directory, payload)
      const calls: string[] = []
      await expect(store.transaction("dashboard", async () => {
        calls.push("unexpected")
        return { commit: false, value: undefined }
      })).rejects.toThrow()
      expect(calls).toEqual([])
      replace(directory, original)
    }
    expect(encodeSnapshot(await read(store))).toBe(original)
  })
})

for (const mode of ["abort", "throw", "invalid"] as const) {
  test(`warm snapshot ${mode} rolls back snapshot and blob mutations without publishing a materialization`, async () => {
    await fixture(async (_directory, open) => {
      const store = await open()
      const original = encodeSnapshot(await seed(store))
      const controller = new AbortController()
      await expect(store.transaction("dashboard", async (snapshot: Snapshot, blobs: BlobTransaction) => {
        snapshot.data.record = { name: "must roll back" }
        await blobs.remove("document")
        await blobs.put("orphan", new Uint8Array([9]), "binary")
        if (mode === "throw") throw new Error("callback failure")
        if (mode === "abort") controller.abort()
        if (mode === "invalid") snapshot.versions.record!.version = -1
        return { commit: true, value: undefined }
      }, { signal: controller.signal })).rejects.toThrow()
      expect(encodeSnapshot(await read(store))).toBe(original)
      await store.transaction("dashboard", async (_snapshot: Snapshot, blobs: BlobTransaction) => {
        expect(await blobs.get("document")).toEqual(new Uint8Array([1, 255, 0]))
        expect(await blobs.get("orphan")).toBeUndefined()
        return { commit: false, value: undefined }
      })
      await store.dispose()
      expect(encodeSnapshot(await read(await open()))).toBe(original)
    })
  })
}

test("warm nested reads copy staged values and nested write poison survives a caught child rejection", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    const original = encodeSnapshot(await seed(store))
    await store.transaction("dashboard", async (snapshot) => {
      snapshot.data.record = { name: "parent stage", optional: undefined }
      await store.transaction("dashboard", async (child) => {
        expect(child.data.record).toEqual({ name: "parent stage", optional: undefined })
        child.data.record = { name: "child mutation" }
        return { commit: false, value: child }
      })
      const copy = store.currentSnapshots!()
      expect(copy!.dashboard.data.record).toEqual({ name: "parent stage", optional: undefined })
      copy!.dashboard.data.record = { name: "current mutation" }
      expect(snapshot.data.record).toEqual({ name: "parent stage", optional: undefined })
      return { commit: false, value: undefined }
    })
    expect(encodeSnapshot(await read(store))).toBe(original)
    await expect(store.transaction("dashboard", async (snapshot) => {
      snapshot.data.record = { name: "poisoned parent" }
      await expect(store.transaction("dashboard", async (child) => {
        child.data.record = { name: "forbidden child" }
        return { commit: true, value: undefined }
      })).rejects.toThrow("Nested local writes")
      return { commit: true, value: undefined }
    })).rejects.toThrow("Nested local write attempted")
    expect(encodeSnapshot(await read(store))).toBe(original)
  })
})

test("warm observations cannot validate later accessor or inherited-prototype writes", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    const original = encodeSnapshot(await seed(store))
    const reads = { count: 0 }
    await expect(store.transaction("dashboard", async (snapshot) => {
      Object.defineProperty(snapshot.data, "record", { enumerable: true,
        get: () => { reads.count++; return { name: "must not execute" } } })
      return { commit: true, value: undefined }
    })).rejects.toThrow("accessor")
    expect(reads.count).toBe(0)
    await expect(store.transaction("dashboard", async (snapshot) => {
      snapshot.data.record = Object.assign(Object.create({ inherited: "not persistible" }), { own: "also rejected" })
      return { commit: true, value: undefined }
    })).rejects.toThrow("plain objects")
    expect(encodeSnapshot(await read(store))).toBe(original)
  })
})

test("independently warmed stores serialize fresh same-version CAS and never replay callbacks", async () => {
  await fixture(async (_directory, open) => {
    const first = await open()
    await seed(first)
    const second = await open()
    expect(encodeSnapshot(await read(second))).toBe(encodeSnapshot(await read(first)))
    const ready = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    const calls: string[] = []
    const one = first.transaction("dashboard", async (snapshot) => {
      calls.push("first")
      ready.resolve()
      await release.promise
      snapshot.versions.record = { version: 8, by: "first" }
      snapshot.data.record = { name: "winner" }
      return { commit: true, value: true }
    })
    await ready.promise
    const two = second.transaction("dashboard", async (snapshot) => {
      calls.push("second")
      if (snapshot.versions.record!.version !== 7) return { commit: false, value: false }
      snapshot.data.record = { name: "stale overwrite" }
      return { commit: true, value: true }
    })
    const finished = Promise.allSettled([one, two])
    try {
      await Bun.sleep(10)
      expect(calls).toEqual(["first"])
      release.resolve()
      expect(await one).toBe(true)
      expect(await two).toBe(false)
    } finally { release.resolve(); await finished }
    expect(calls).toEqual(["first", "second"])
    expect((await read(second)).data.record).toEqual({ name: "winner" })
    expect((await read(first)).versions.record).toEqual({ version: 8, by: "first" })
  })
})

test("warm snapshots do not cache credential reads, expiry or returned secret byte arrays", async () => {
  await fixture(async (_directory, open) => {
    const store = await open()
    await seed(store)
    await store.secrets.put("session", new Uint8Array([1]), 200)
    await store.transaction("dashboard", async () => {
      const value = await store.secrets.get("session", 199)
      expect(value).toEqual(new Uint8Array([1]))
      value![0] = 9
      expect(await store.secrets.get("session", 199)).toEqual(new Uint8Array([1]))
      expect(await store.secrets.get("session", 200)).toBeUndefined()
      return { commit: false, value: undefined }
    })
    const other = await open()
    await other.secrets.put("session", new Uint8Array([2]), 300)
    expect(await store.secrets.get("session", 299)).toEqual(new Uint8Array([2]))
    await other.secrets.remove("session")
    expect(await store.secrets.get("session", 0)).toBeUndefined()
  })
})
