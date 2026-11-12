import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createLocalBackups } from "../runtime/local-backups.ts"
import type { Snapshot } from "../runtime/contract.ts"
import type { BlobTransaction } from "../runtime/assets.ts"
import { openLocalStore } from "../runtime/local-store.ts"

test("Planner daily retention is fourteen days and monthly archives survive for seven calendar years", async () => {
  const root = await mkdtemp(join(await realpath(tmpdir()), "sucafina-retention-"))
  const store = await openLocalStore(join(root, "business"))
  try {
    const backups = await createLocalBackups(join(root, "archives"))
    const old = await backups.capture(store, "planner", "2026-10-28T23:59:59.999Z")
    const boundary = await backups.capture(store, "planner", "2026-10-29T00:00:00.000Z")
    const monthly = await backups.capture(store, "planner", "2026-10-01T00:00:00.000Z", "monthly")
    await backups.capture(store, "planner", "2026-11-12T00:00:00.000Z")
    expect(await backups.source.load("planner", old.id)).toBeUndefined()
    expect(await backups.source.load("planner", boundary.id)).toBeDefined()
    expect((await backups.list("planner")).find((item) => item.id === monthly.id)?.tier).toBe("monthly")
    await backups.capture(store, "planner", "2033-10-01T00:00:00.000Z")
    expect(await backups.source.load("planner", monthly.id)).toBeDefined()
    await backups.capture(store, "planner", "2033-10-01T00:00:00.001Z")
    expect(await backups.source.load("planner", monthly.id)).toBeUndefined()
  } finally { await store.dispose(); await rm(root, { recursive: true, force: true }) }
})

test("restore drill restores retained bytes in isolation without changing live state", async () => {
  const root = await mkdtemp(join(await realpath(tmpdir()), "sucafina-drill-"))
  const store = await openLocalStore(join(root, "business"))
  try {
    await store.transaction("dashboard", async (snapshot: Snapshot, blobs: BlobTransaction) => {
      snapshot.data.assets = [{ key: "a", bytes: 3 }]
      snapshot.data.marker = "retained"
      await blobs.put("a", new Uint8Array([0, 255, 128]), "application/octet-stream")
      return { commit: true, value: undefined }
    })
    const backups = await createLocalBackups(join(root, "archives"))
    const archive = await backups.capture(store, "dashboard", "2026-11-12T00:00:00Z", "monthly")
    await store.transaction("dashboard", async (snapshot) => { snapshot.data.marker = "live"; return { commit: true, value: undefined } })
    const before = await store.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    expect(await backups.verify("dashboard", archive.id, "2026-11-12T01:00:00Z")).toMatchObject({ at: "2026-11-12T01:00:00Z" })
    expect(await store.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))).toEqual(before)
  } finally { await store.dispose(); await rm(root, { recursive: true, force: true }) }
})
