import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { openLocalStore } from "../../../../runtime/local-store.ts"

test("blob generations survive ABA, removal and restart while rollback and forgery fail", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-blob-generation-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const key = "__proto__"
  try {
    const write = (bytes: number[], commit = true, type = "binary") => store.transaction("procurement", async (snapshot, blobs) => {
      await blobs.put(key, new Uint8Array(bytes), type)
      return { commit, value: snapshot.sfBlobGenerations?.[key] }
    })
    expect(await write([1])).toBe(1)
    expect(await write([1])).toBe(1)
    expect(await write([2], false)).toBe(2)
    expect(await write([2])).toBe(2)
    expect(await write([1])).toBe(3)
    expect(await write([1], true, "other")).toBe(4)
    await expect(store.transaction("procurement", async (snapshot) => {
      snapshot.sfBlobGenerations = Object.fromEntries([[key, 1]])
      return { commit: true, value: true }
    })).rejects.toThrow("Private blob generations")
    await expect(store.transactionAll!(async (snapshots) => {
      snapshots.procurement.sfBlobGenerations = {}
      return { commit: true, value: true }
    })).rejects.toThrow("Private blob generations")
    expect(await store.transaction("procurement", async (snapshot, blobs) => {
      await blobs.remove(key)
      await blobs.remove(key)
      return { commit: true, value: snapshot.sfBlobGenerations?.[key] }
    })).toBe(5)
    expect(await write([1])).toBe(6)
    await store.dispose()
    const reopened = await openLocalStore(directory)
    try {
      expect(await reopened.transaction("procurement", async (snapshot, blobs) => ({ commit: false, value: { generation: snapshot.sfBlobGenerations?.[key], bytes: await blobs.get(key) } })))
        .toEqual({ generation: 6, bytes: new Uint8Array([1]) })
    } finally { await reopened.dispose() }
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})

test("caught generation overflow cannot commit blob changes", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-blob-overflow-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  try {
    await store.transaction("dashboard", async (_snapshot, blobs) => {
      await blobs.put("asset", new Uint8Array([1]), "binary")
      return { commit: true, value: true }
    })
    await store.dispose()
    const { Database } = await import("bun:sqlite")
    const { decodeSnapshot, encodeSnapshot } = await import("../../../../runtime/local-store.ts")
    const db = new Database(path.join(directory, "installation.sqlite"), { strict: true })
    try {
      const row = db.query<{ payload: string }, [string]>("SELECT payload FROM snapshots WHERE surface = ?").get("dashboard")
      if (!row) throw new Error("snapshot missing")
      const snapshot = decodeSnapshot(row.payload)
      snapshot.sfBlobGenerations = { asset: Number.MAX_SAFE_INTEGER }
      db.query("UPDATE snapshots SET payload = ? WHERE surface = ?").run(encodeSnapshot(snapshot), "dashboard")
    } finally { db.close() }
    const reopened = await openLocalStore(directory)
    try {
      const caught = await reopened.transaction("dashboard", async (_snapshot, blobs) => {
        const putFailed = await blobs.put("asset", new Uint8Array([2]), "binary").then(() => false, () => true)
        const removeFailed = await blobs.remove("asset").then(() => false, () => true)
        return { commit: true, value: { putFailed, removeFailed, bytes: await blobs.get("asset") } }
      })
      expect(caught).toEqual({ putFailed: true, removeFailed: true, bytes: new Uint8Array([1]) })
    } finally { await reopened.dispose() }
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
