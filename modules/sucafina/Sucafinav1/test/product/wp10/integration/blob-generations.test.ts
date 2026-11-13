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
