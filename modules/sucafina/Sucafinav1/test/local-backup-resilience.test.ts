import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { basename, join } from "node:path"
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import type { BlobTransaction } from "../runtime/assets.ts"
import type { Snapshot } from "../runtime/contract.ts"
import { createLocalBackups } from "../runtime/local-backups.ts"
import { openLocalStore } from "../runtime/local-store.ts"

const at = "2026-11-12T00:00:00.000Z"
const key = "document"
const bytes = new Uint8Array([1, 2, 3, 4])

async function fixture(work: (root: string, store: Awaited<ReturnType<typeof openLocalStore>>) => Promise<void>, lockTimeoutMs = 5_000) {
  const root = await mkdtemp(join(await realpath(tmpdir()), "sucafina-backup-resilience-"))
  await chmod(root, 0o700)
  const store = await openLocalStore(join(root, "business"), { lockTimeoutMs })
  try { await work(root, store) }
  finally {
    await store.dispose()
    await rm(root, { recursive: true, force: true })
  }
}

async function seed(store: Awaited<ReturnType<typeof openLocalStore>>) {
  await store.transaction("dashboard", async (snapshot: Snapshot, blobs: BlobTransaction) => {
    snapshot.data.assets = [{ key, bytes: bytes.byteLength }]
    snapshot.data.baseline = "captured"
    await blobs.put(key, bytes, "application/octet-stream")
    return { commit: true, value: undefined }
  })
}

test("durable backup I/O runs outside the SQLite writer scope and retains the captured point in time", async () => {
  await fixture(async (root, store) => {
    await seed(store)
    let enter!: () => void
    let release!: () => void
    const entered = new Promise<void>((resolve) => { enter = resolve })
    const blocked = new Promise<void>((resolve) => { release = resolve })
    let paused = false
    const backups = await createLocalBackups(join(root, "backups"), {
      io: { beforeDurableWrite: async (path) => {
        if (paused || !basename(path).startsWith("blob-")) return
        paused = true
        enter()
        await blocked
      } },
    })

    const capture = backups.capture(store, "dashboard", at)
    await entered
    try {
      await store.transaction("dashboard", async (snapshot) => {
        snapshot.data.concurrent = "committed-while-backup-waits-on-filesystem"
        return { commit: true, value: undefined }
      })
    } finally { release() }

    const saved = await capture
    const archive = await backups.source.load("dashboard", saved.id)
    expect(archive?.snapshot.data.baseline).toBe("captured")
    expect(archive?.snapshot.data.concurrent).toBeUndefined()
    const live = await store.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.data.concurrent }))
    expect(live).toBe("committed-while-backup-waits-on-filesystem")
  }, 75)
})

test("snapshot corruption is visible to inventory instead of disappearing from maintenance health", async () => {
  await fixture(async (root, store) => {
    await seed(store)
    const directory = join(root, "backups")
    const backups = await createLocalBackups(directory)
    const saved = await backups.capture(store, "dashboard", at)
    await writeFile(join(directory, "dashboard", saved.id, "snapshot.json"), "corrupt", { mode: 0o600 })
    await expect(backups.list("dashboard")).rejects.toThrow("Corrupt encoded backup snapshot")
  })
})

test("retention preserves a corrupt expired archive and reports the integrity failure", async () => {
  await fixture(async (root, store) => {
    await seed(store)
    const directory = join(root, "backups")
    const backups = await createLocalBackups(directory)
    const expired = await backups.capture(store, "dashboard", "2026-10-01T00:00:00.000Z")
    const archiveDirectory = join(directory, "dashboard", expired.id)
    const blob = (await readdir(archiveDirectory)).find((name) => name.startsWith("blob-"))
    if (!blob) throw new Error("backup blob fixture missing")
    await writeFile(join(archiveDirectory, blob), new Uint8Array([9, 9, 9, 9]), { mode: 0o600 })

    await expect(backups.capture(store, "dashboard", at)).rejects.toThrow("Missing or corrupt retained blob")
    expect((await lstat(archiveDirectory)).isDirectory()).toBe(true)
    expect(await readFile(join(archiveDirectory, blob))).toEqual(Buffer.from([9, 9, 9, 9]))
  })
})

test("startup inventory scavenges only structurally safe orphan staging directories", async () => {
  await fixture(async (root) => {
    const directory = join(root, "backups")
    const backups = await createLocalBackups(directory, { orphanStageAgeMs: 0 })
    const surface = join(directory, "dashboard")
    await mkdir(surface, { mode: 0o700 })
    const stage = join(surface, `.stage-${randomUUID()}`)
    await mkdir(stage, { mode: 0o700 })
    await writeFile(join(stage, "snapshot.json"), "partial", { mode: 0o600 })

    expect(await backups.list("dashboard")).toEqual([])
    await expect(lstat(stage)).rejects.toThrow()
  })
})

test("aborting maintenance removes unpublished staging bytes and never publishes a partial archive", async () => {
  await fixture(async (root, store) => {
    await seed(store)
    let enter!: () => void
    const entered = new Promise<void>((resolve) => { enter = resolve })
    let paused = false
    const backups = await createLocalBackups(join(root, "backups"), {
      io: { beforeDurableWrite: async (_path, signal) => {
        if (paused) return
        paused = true
        enter()
        if (!signal) throw new Error("backup test signal missing")
        await new Promise<void>((_resolve, reject) => {
          const abort = () => reject(signal.reason)
          signal.addEventListener("abort", abort, { once: true })
          if (signal.aborted) abort()
        })
      } },
    })
    const controller = new AbortController()
    const capture = backups.capture(store, "dashboard", at, "daily", { signal: controller.signal })
    await entered
    controller.abort(new Error("maintenance cancelled"))
    await expect(capture).rejects.toThrow("maintenance cancelled")

    const entries = await readdir(join(root, "backups", "dashboard"))
    expect(entries.some((name) => name.startsWith(".stage-"))).toBe(false)
    expect(entries.some((name) => name.startsWith("backup-"))).toBe(false)
  })
})
