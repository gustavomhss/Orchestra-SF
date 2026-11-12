import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { chmod, chown, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"
import type { Surface } from "../src/identity.ts"
import type { Snapshot, TransactionOptions } from "../runtime/contract.ts"
import type { BlobTransaction } from "../runtime/assets.ts"
import type { LocalStore } from "../runtime/local-contract.ts"
import { createLocalBackups } from "../runtime/local-backups.ts"
import { decodeSnapshot, openLocalStore } from "../runtime/local-store.ts"
import { restoreBackup } from "../runtime/operations.ts"

const bytes = new Uint8Array([0, 255, 17, 128])
const key = "../../private/日本語/document"
const at = "2026-11-12T00:00:00.000Z"
const admin = { id: "admin", canWrite: true, roles: ["admin"] }

async function fixture(work: (root: string, store: LocalStore, target: LocalStore) => Promise<void>) {
  const root = await mkdtemp(join(await realpath(tmpdir()), "sucafina-backups-test-"))
  await chmod(root, 0o700)
  const store = await openLocalStore(join(root, "live"))
  const target = await openLocalStore(join(root, "target"))
  try {
    await work(root, store, target)
  } finally {
    await Promise.all([store.dispose(), target.dispose()])
    await rm(root, { recursive: true, force: true })
  }
}

async function seed(store: LocalStore, surface: Surface = "dashboard", assetKey = key) {
  await store.transaction(surface, async (snapshot: Snapshot, blobs: BlobTransaction) => {
    snapshot.data.value = { optional: undefined, negativeZero: -0, nested: [undefined] }
    snapshot.data.assets = [{ key: assetKey, bytes: bytes.length }]
    snapshot.audit.push({ who: "actor", at, record: "value", was: undefined, became: snapshot.data.value })
    snapshot.versions.dataset = { version: 1, by: "actor" }
    snapshot.sequences.record = 7
    await blobs.put(assetKey, bytes, "application/octet-stream")
    return { commit: true, value: null }
  })
}

async function read(store: LocalStore, surface: Surface = "dashboard") {
  return store.transaction(surface, async (snapshot: Snapshot, blobs: BlobTransaction) => ({
    commit: false,
    value: { snapshot: structuredClone(snapshot), blob: await blobs.get(key) },
  }))
}

// Inspect actual files without coupling the acceptance suite to a chosen directory layout.
async function files(directory: string): Promise<string[]> {
  return (await Promise.all((await readdir(directory)).map(async (name) => {
    const path = join(directory, name)
    return (await lstat(path)).isDirectory() ? files(path) : [path]
  }))).flat()
}

async function blobFile(directory: string) {
  const found = await Promise.all((await files(directory)).map(async (path) =>
    Buffer.from(await readFile(path)).equals(Buffer.from(bytes)) ? path : undefined,
  ))
  const path = found.find((value) => value !== undefined)
  if (!path) throw new Error("Retained blob file not found")
  return path
}

test("SQLite capture survives live deletion and reopens for actual atomic restore, preserving exact tagged state", async () => {
  await fixture(async (root, store, target) => {
    await seed(store)
    const before = await read(store)
    const directory = join(root, "archives")
    const backups = await createLocalBackups(directory)
    const saved = await backups.capture(store, "dashboard", at)
    expect(saved.id).toMatch(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)
    expect(saved.manifest.snapshotSha256).toBe(createHash("sha256").update(JSON.stringify(before.snapshot)).digest("hex"))
    expect(saved.manifest.blobs).toEqual([{ key, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }])
    expect(await read(store)).toEqual(before)
    await store.transaction("dashboard", async (snapshot: Snapshot, blobs: BlobTransaction) => {
      snapshot.data = {}
      await blobs.remove(key)
      return { commit: true, value: null }
    })
    const reopened = await createLocalBackups(directory)
    const loaded = await reopened.source.load("dashboard", saved.id)
    expect(loaded?.snapshot).toEqual(before.snapshot)
    expect(Object.hasOwn(loaded!.snapshot.audit[0]!, "was")).toBe(true)
    expect(Object.is((loaded!.snapshot.data.value as { negativeZero: number }).negativeZero, -0)).toBe(true)
    expect(await reopened.source.readBlob("dashboard", saved.id, key)).toEqual(bytes)
    expect(await reopened.list("dashboard")).toEqual([{ id: saved.id, at, assets: 1, bytes: bytes.length, tier: "daily" }])
    expect(await reopened.list("procurement")).toEqual([])
    expect(await reopened.source.load("procurement", saved.id)).toBeUndefined()
    expect(await restoreBackup(target, reopened.source, "dashboard", saved.id, admin, true, 0, at)).toEqual({ ok: true })
    expect((await read(target)).snapshot.data).toEqual(before.snapshot.data)
    expect((await read(target)).blob).toEqual(bytes)
    expect((await read(target)).snapshot.sequences.record).toBe(7)
    expect((await read(target)).snapshot.audit.at(-1)?.who).toBe("admin")
    const storedFiles = await files(directory)
    expect(storedFiles.some((path) => basename(path).includes("document"))).toBe(false)
    expect(basename(await blobFile(directory))).toContain(createHash("sha256").update(key).digest("hex"))
    for (const path of storedFiles) expect((await stat(path)).mode & 0o777).toBe(0o600)
    const directories = new Set([directory, ...storedFiles.map((path) => join(path, ".."))])
    for (const path of directories) expect((await stat(path)).mode & 0o777).toBe(0o700)
  })
})

for (const damage of ["missing", "corrupt", "symlink", "permissive"] as const) {
  test(`${damage} retained blob rejects restore without changing SQLite state or staged blobs`, async () => {
    await fixture(async (root, store, target) => {
      await seed(store)
      await seed(target)
      const directory = join(root, "archives")
      const backups = await createLocalBackups(directory)
      const saved = await backups.capture(store, "dashboard", at)
      const path = await blobFile(directory)
      const before = await read(target)
      if (damage === "missing") await rm(path)
      if (damage === "corrupt") await writeFile(path, new Uint8Array([1, 2, 3, 4]))
      if (damage === "permissive") await chmod(path, 0o644)
      if (damage === "symlink") {
        const outside = join(root, "outside")
        await writeFile(outside, bytes, { mode: 0o600 })
        await rm(path)
        await symlink(outside, path)
      }
      await expect(restoreBackup(target, backups.source, "dashboard", saved.id, admin, true, 1, at)).rejects.toThrow()
      expect(await read(target)).toEqual(before)
    })
  })
}

test("corrupt encoded snapshot rejects restore before target state changes", async () => {
  await fixture(async (root, store, target) => {
    await seed(store)
    const directory = join(root, "archives")
    const backups = await createLocalBackups(directory)
    const saved = await backups.capture(store, "dashboard", at)
    const before = await read(target)
    const payloads = await Promise.all((await files(directory)).map(async (path) => {
      try { decodeSnapshot(await readFile(path, "utf8")); return path } catch { return undefined }
    }))
    const payload = payloads.find((path) => path !== undefined)
    expect(payload).toBeDefined()
    await writeFile(payload!, "corrupted snapshot")
    await expect(restoreBackup(target, backups.source, "dashboard", saved.id, admin, true, 0, at)).rejects.toThrow()
    expect(await read(target)).toEqual(before)
  })
})

for (const surface of ["dashboard", "procurement", "planner"] as const) {
  test(`${surface} preserves supplied daily dates and applies the documented strict daily cutoff`, async () => {
    await fixture(async (root, store) => {
      await seed(store, surface)
      const backups = await createLocalBackups(join(root, "archives"))
      const expired = await backups.capture(store, surface, surface === "planner" ? "2026-10-28T23:59:59.999Z" : "2026-10-07T23:59:59.999Z")
      const boundary = await backups.capture(store, surface, surface === "planner" ? "2026-10-29T00:00:00.000Z" : "2026-10-08T00:00:00.000Z")
      const today = await backups.capture(store, surface, at)
      const listed = await backups.list(surface)
      expect(listed.find((item) => item.id === today.id)?.at).toBe(at)
      expect(listed.some((item) => item.id === boundary.id)).toBe(true)
      expect(listed.some((item) => item.id === expired.id)).toBe(false)
      expect(await backups.source.load(surface, expired.id)).toBeUndefined()
      const next = await backups.capture(store, surface, "2026-11-13T00:00:00.000Z")
      expect(next.id).not.toBe(today.id)
      expect((await backups.list(surface)).some((item) => item.id === today.id)).toBe(true)
    })
  })
}

for (const id of ["../live", "/etc/passwd", "..", "a/b", "a\\b", "%2e%2e", "", "x\u0000y"]) {
  test(`unsafe archive id ${JSON.stringify(id)} rejects before filesystem traversal`, async () => {
    await fixture(async (root) => {
      const backups = await createLocalBackups(join(root, "archives"))
      await expect(backups.source.load("dashboard", id)).rejects.toThrow()
      await expect(backups.source.readBlob("dashboard", id, key)).rejects.toThrow()
    })
  })
}

test("missing live blob prevents publication of an incomplete archive", async () => {
  await fixture(async (root, store) => {
    await seed(store)
    await store.transaction("dashboard", async (_snapshot: Snapshot, blobs: BlobTransaction) => {
      await blobs.remove(key)
      return { commit: true, value: null }
    })
    const backups = await createLocalBackups(join(root, "archives"))
    await expect(backups.capture(store, "dashboard", at)).rejects.toThrow()
    expect(await backups.list("dashboard")).toEqual([])
  })
})

test("relative roots, permissive existing roots and symlink ancestors reject without changing paths", async () => {
  await expect(createLocalBackups("relative-backups")).rejects.toThrow()
  await fixture(async (root) => {
    const directory = join(root, "archives")
    await mkdir(directory, { mode: 0o755 })
    await chmod(directory, 0o755)
    await expect(createLocalBackups(directory)).rejects.toThrow()
    expect((await stat(directory)).mode & 0o777).toBe(0o755)
    await chmod(directory, 0o700)
    await symlink(directory, join(root, "alias"))
    await expect(createLocalBackups(join(root, "alias"))).rejects.toThrow()
    await expect(createLocalBackups(join(root, "alias", "child"))).rejects.toThrow()
    expect(await readdir(directory)).toEqual([])
  })
})

test.skipIf(process.getuid?.() !== 0)("foreign-owned existing root rejects (requires root fixture privileges)", async () => {
  await fixture(async (root) => {
    const directory = join(root, "foreign")
    await mkdir(directory, { mode: 0o700 })
    await chown(directory, 65534, 65534)
    try { await expect(createLocalBackups(directory)).rejects.toThrow() }
    finally { await chown(directory, 0, 0) }
  })
})

test("pruning leaves unknown, incomplete and aliased paths untouched and never copies secrets", async () => {
  await fixture(async (root, store) => {
    await seed(store)
    await store.secrets.put("auth-token", new TextEncoder().encode("SECRET-DO-NOT-COPY"), Date.parse(at) + 1000)
    const directory = join(root, "archives")
    const backups = await createLocalBackups(directory)
    await backups.capture(store, "dashboard", "2026-10-01T00:00:00.000Z")
    const unknown = join(directory, "foreign-incomplete")
    await mkdir(unknown, { mode: 0o700 })
    await writeFile(join(unknown, "sentinel"), "untouched", { mode: 0o600 })
    const outside = join(root, "outside")
    await mkdir(outside, { mode: 0o700 })
    await writeFile(join(outside, "sentinel"), "untouched", { mode: 0o600 })
    await symlink(outside, join(directory, "foreign-alias"))
    await backups.capture(store, "dashboard", at)
    expect(await readFile(join(unknown, "sentinel"), "utf8")).toBe("untouched")
    expect(await readFile(join(outside, "sentinel"), "utf8")).toBe("untouched")
    expect((await lstat(join(directory, "foreign-alias"))).isSymbolicLink()).toBe(true)
    for (const path of await files(directory)) {
      if ((await lstat(path)).isSymbolicLink()) continue
      expect((await readFile(path)).includes(Buffer.from("SECRET-DO-NOT-COPY"))).toBe(false)
    }
  })
})


test("capture enters the real store exactly once and never nests a SQL transaction", async () => {
  await fixture(async (root, store) => {
    await seed(store)
    const calls: Surface[] = []
    const observed: LocalStore = {
      ...store,
      transaction: <T>(surface: Surface, work: (snapshot: Snapshot, blobs: BlobTransaction) => Promise<{ commit: boolean; value: T }>, options?: TransactionOptions) => {
        calls.push(surface)
        return store.transaction<T>(surface, work, options)
      },
    }
    const backups = await createLocalBackups(join(root, "archives"))
    await backups.capture(observed, "dashboard", at)
    expect(calls).toEqual(["dashboard"])
  })
})

test("invalid capture time cannot publish; archive blob reads never fall back to unrelated live keys", async () => {
  await fixture(async (root, store) => {
    await seed(store)
    await store.transaction("dashboard", async (_snapshot: Snapshot, blobs: BlobTransaction) => {
      await blobs.put("live-only", bytes, "binary")
      return { commit: true, value: null }
    })
    const directory = join(root, "archives")
    const backups = await createLocalBackups(directory)
    await expect(backups.capture(store, "dashboard", "invalid-date")).rejects.toThrow()
    expect(await backups.list("dashboard")).toEqual([])
    const saved = await backups.capture(store, "dashboard", at)
    expect(await backups.source.readBlob("dashboard", saved.id, "live-only")).toBeUndefined()
    expect((await files(directory)).filter((path) => basename(path).startsWith("blob-"))).toHaveLength(1)
  })
})
