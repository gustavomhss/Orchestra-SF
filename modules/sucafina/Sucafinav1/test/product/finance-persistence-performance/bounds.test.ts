import { expect, spyOn, test } from "bun:test"
import { Database } from "bun:sqlite"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { LocalStore } from "../../../runtime/local-contract.ts"
import { encodeSnapshot, openLocalStore } from "../../../runtime/local-store.ts"

async function fixture(work: (store: LocalStore, reopen: () => Promise<LocalStore>, directory: string) => Promise<void>) {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-persistence-bounds-"))
  const stores: LocalStore[] = []
  await chmod(directory, 0o700)
  const reopen = async () => {
    const store = await openLocalStore(directory)
    stores.push(store)
    return store
  }
  try { await work(await reopen(), reopen, directory) }
  finally {
    await Promise.all(stores.map((store) => store.dispose()))
    await rm(directory, { recursive: true, force: true })
  }
}

function rows(directory: string) {
  const database = new Database(join(directory, "installation.sqlite"), { readonly: true, strict: true })
  try { return database.query<{ surface: string; payload: string }, []>("SELECT surface, payload FROM snapshots ORDER BY surface").all() }
  finally { database.close() }
}

async function countedRead(store: LocalStore) {
  const parse = spyOn(JSON, "parse")
  try {
    const snapshot = await store.transaction("dashboard", async (value) => ({ commit: false, value }))
    const tagged = parse.mock.calls.filter((call) => call[0].startsWith('["sucafina-snapshot",'))
    return { snapshot, taggedParseCalls: tagged.length, taggedCharacters: tagged.reduce((sum, call) => sum + call[0].length, 0) }
  } finally { parse.mockRestore() }
}

test("snapshot materialization bypasses oversized payloads without changing their bytes or special values", async () => {
  await fixture(async (store, reopen, directory) => {
    await store.transaction("dashboard", async (snapshot) => {
      snapshot.data.large = "x".repeat(9 * 1024 * 1024)
      snapshot.data.optional = undefined
      snapshot.data.negativeZero = -0
      return { commit: true, value: undefined }
    })
    const payload = rows(directory)[0]!.payload
    const fresh = await reopen()
    const observed = []
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await countedRead(fresh)
      expect(encodeSnapshot(result.snapshot)).toBe(payload)
      expect(Object.hasOwn(result.snapshot.data, "optional")).toBe(true)
      expect(result.snapshot.data.optional).toBeUndefined()
      expect(Object.is(result.snapshot.data.negativeZero, -0)).toBe(true)
      expect(result.taggedParseCalls).toBe(1)
      expect(result.taggedCharacters).toBe(payload.length)
      observed.push({ taggedParseCalls: result.taggedParseCalls, taggedCharacters: result.taggedCharacters })
      result.snapshot.data.large = "retained output only"
    }
    expect(rows(directory)[0]!.payload).toBe(payload)
    console.log("FIN_PERSISTENCE_OVERSIZE " + JSON.stringify({ payloadCharacters: payload.length, reads: observed }))
  })
}, 30000)

test("snapshot materialization enforces its aggregate bound across all three SQLite surfaces", async () => {
  await fixture(async (store, reopen, directory) => {
    if (!store.transactionAll) throw new Error("All-surface transactions unavailable")
    await store.transactionAll(async (snapshots) => {
      for (const surface of ["dashboard", "planner", "procurement"] as const) {
        snapshots[surface].data.large = surface + ":" + "y".repeat(2 * 1024 * 1024)
        snapshots[surface].data.optional = undefined
      }
      return { commit: true, value: undefined }
    })
    const persisted = rows(directory)
    expect(persisted).toHaveLength(3)
    const dashboard = persisted.find((row) => row.surface === "dashboard")!.payload
    const total = persisted.reduce((sum, row) => sum + row.payload.length, 0)
    const fresh = await reopen()
    const observed = []
    // One admission reads dashboard/planner/procurement in that order. Their
    // combined immutable strings exceed the total bound: cycling all three
    // must evict, even though each individual snapshot fits by itself.
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await countedRead(fresh)
      expect(encodeSnapshot(result.snapshot)).toBe(dashboard)
      expect(result.taggedParseCalls).toBe(3)
      expect(result.taggedCharacters).toBe(total)
      observed.push({ taggedParseCalls: result.taggedParseCalls, taggedCharacters: result.taggedCharacters })
    }
    expect(rows(directory)).toEqual(persisted)
    console.log("FIN_PERSISTENCE_AGGREGATE_BOUND " + JSON.stringify({
      surfaces: persisted.map((row) => ({ surface: row.surface, payloadCharacters: row.payload.length })), reads: observed,
    }))
  })
}, 30000)

for (const mode of ["depth", "fixups", "nodes"] as const) {
  test(`snapshot materialization ${mode} limit falls back to the valid legacy decoder`, async () => {
    await fixture(async (store, reopen, directory) => {
      await store.transaction("dashboard", async (snapshot) => {
        if (mode === "depth") {
          const root: Record<string, unknown> = {}
          const current = { node: root }
          for (let index = 0; index < 140; index++) {
            const child: Record<string, unknown> = {}
            current.node.next = child
            current.node = child
          }
          current.node.optional = undefined
          current.node.negativeZero = -0
          snapshot.data.value = root
        }
        if (mode === "fixups") snapshot.data.value = Array.from({ length: 4100 }, () => undefined)
        if (mode === "nodes") snapshot.data.value = Array.from({ length: 200010 }, () => 1)
        snapshot.data.optional = undefined
        snapshot.data.negativeZero = -0
        return { commit: true, value: undefined }
      })
      const payload = rows(directory)[0]!.payload
      const fresh = await reopen()
      const observed = []
      for (let attempt = 0; attempt < 2; attempt++) {
        const result = await countedRead(fresh)
        expect(encodeSnapshot(result.snapshot)).toBe(payload)
        expect(Object.hasOwn(result.snapshot.data, "optional")).toBe(true)
        expect(result.snapshot.data.optional).toBeUndefined()
        expect(Object.is(result.snapshot.data.negativeZero, -0)).toBe(true)
        expect(result.taggedParseCalls).toBe(1)
        expect(result.taggedCharacters).toBe(payload.length)
        observed.push({ taggedParseCalls: result.taggedParseCalls, taggedCharacters: result.taggedCharacters })
      }
      expect(rows(directory)[0]!.payload).toBe(payload)
      console.log("FIN_PERSISTENCE_TRAVERSAL_BOUND " + JSON.stringify({ mode, payloadCharacters: payload.length, reads: observed }))
    })
  }, 30000)
}
