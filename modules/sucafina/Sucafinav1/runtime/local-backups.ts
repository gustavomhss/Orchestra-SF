import { createHash, randomUUID } from "node:crypto"
import { constants } from "node:fs"
import { lstat, mkdir, mkdtemp, open, readdir, realpath, rename, rm, rmdir, unlink } from "node:fs/promises"
import { isDeepStrictEqual } from "node:util"
import { isAbsolute, join, parse, resolve, sep } from "node:path"
import type { Surface } from "../src/identity.ts"
import type { BlobTransaction } from "./assets.ts"
import type { Persistence, Snapshot } from "./contract.ts"
import type { LocalStore } from "./local-contract.ts"
import { decodeSnapshot, encodeSnapshot, openLocalStore } from "./local-store.ts"
import { backup, restoreBackup } from "./operations.ts"
import type { BackupManifest, RestoreTransport } from "./operations.ts"

export type BackupOperationOptions = { signal?: AbortSignal }
export type BackupDependencies = {
  orphanStageAgeMs?: number
  io?: { beforeDurableWrite?: (path: string, signal?: AbortSignal) => Promise<void> }
}
type ArchiveMetadata = {
  manifest: BackupManifest
  payloadSha256: string
  files: string[]
  tier: "daily" | "monthly"
  snapshot?: Snapshot
}

const surfaces: readonly Surface[] = ["dashboard", "planner", "procurement"]
const defaultOrphanStageAgeMs = 24 * 60 * 60 * 1000

export async function createLocalBackups(directory: string, dependencies: BackupDependencies = {}): Promise<{
  capture: (store: LocalStore, surface: Surface, at: string, tier?: "daily" | "monthly", options?: BackupOperationOptions) => Promise<{ id: string; manifest: BackupManifest }>
  list: (surface: Surface, options?: BackupOperationOptions) => Promise<Array<{ id: string; at: string; assets: number; bytes: number; tier: "daily" | "monthly" }>>
  verify: (surface: Surface, id: string, at: string, options?: BackupOperationOptions) => Promise<{ at: string; durationMs: number }>
  source: RestoreTransport
}> {
  if (!isAbsolute(directory) || resolve(directory) !== directory || directory === parse(directory).root)
    throw new Error("Backups require an absolute canonical private directory")
  const orphanStageAgeMs = dependencies.orphanStageAgeMs ?? defaultOrphanStageAgeMs
  if (!Number.isSafeInteger(orphanStageAgeMs) || orphanStageAgeMs < 0) throw new Error("Invalid orphan backup stage age")
  await ancestors(directory, true)
  await privateDirectory(directory)
  const identity = await lstat(directory)
  const activeStages = new Set<string>()
  const requireRoot = async (signal?: AbortSignal) => {
    signal?.throwIfAborted()
    await ancestors(directory, false)
    await privateDirectory(directory)
    const current = await lstat(directory)
    if (current.dev !== identity.dev || current.ino !== identity.ino) throw new Error("Backup root changed")
    signal?.throwIfAborted()
  }
  const surfaceDirectory = async (surface: Surface, create = false, signal?: AbortSignal) => {
    requireSurface(surface)
    await requireRoot(signal)
    const path = join(directory, surface)
    if (create) {
      await makeDirectory(path)
      await syncDirectory(directory, signal)
    }
    const info = await lstat(path).catch((error: unknown) => {
      if (hasCode(error, "ENOENT")) return undefined
      throw error
    })
    if (!info) return undefined
    await privateDirectory(path)
    signal?.throwIfAborted()
    return path
  }
  const archivePath = async (surface: Surface, id: string, signal?: AbortSignal) => {
    requireId(id)
    const parent = await surfaceDirectory(surface, false, signal)
    if (!parent) return undefined
    const path = join(parent, id)
    const exists = await lstat(path).catch((error: unknown) => {
      if (hasCode(error, "ENOENT")) return undefined
      throw error
    })
    if (!exists) return undefined
    await privateDirectory(path)
    signal?.throwIfAborted()
    return path
  }
  const cleanup = async (parent: string, signal?: AbortSignal) => cleanupStages(parent, activeStages, orphanStageAgeMs, signal)
  const load = async (surface: Surface, id: string, signal?: AbortSignal, retainBlobs = false) => {
    const path = await archivePath(surface, id, signal)
    return path ? verifyArchive(path, surface, id, signal, retainBlobs) : undefined
  }
  for (const surface of surfaces) {
    const parent = await surfaceDirectory(surface)
    if (parent) await cleanup(parent)
  }

  const source: RestoreTransport = {
    load: async (surface, id) => {
      const archive = await load(surface, id)
      return archive ? { snapshot: archive.snapshot, manifest: archive.manifest } : undefined
    },
    readBlob: async (surface, id, key) => {
      const path = await archivePath(surface, id)
      if (!path) return undefined
      const metadata = await readArchiveMetadata(path, surface, id, undefined, false)
      const expected = metadata.manifest.blobs.find((blob) => blob.key === key)
      if (!expected) return undefined
      const bytes = await privateRead(join(path, blobName(key)))
      if (bytes.byteLength !== expected.bytes || hash(bytes) !== expected.sha256) throw new Error("Missing or corrupt retained blob")
      return new Uint8Array(bytes)
    },
  }

  return {
    source,
    verify: async (surface, id, at, options = {}) => {
      if (!Number.isFinite(Date.parse(at))) throw new Error("Invalid drill time")
      options.signal?.throwIfAborted()
      const started = performance.now()
      const archive = await load(surface, id, options.signal, true)
      if (!archive) throw new Error("Restore drill archive is unavailable")
      await requireRoot(options.signal)
      const scratch = await mkdtemp(join(directory, ".drill-"))
      const target = await openLocalStore(join(scratch, "business"))
      const drillSource: RestoreTransport = {
        load: async (requestedSurface, requestedId) => requestedSurface === surface && requestedId === id
          ? { snapshot: structuredClone(archive.snapshot), manifest: structuredClone(archive.manifest) }
          : undefined,
        readBlob: async (requestedSurface, requestedId, key) => {
          if (requestedSurface !== surface || requestedId !== id) return undefined
          const bytes = archive.blobs.get(key)
          return bytes ? new Uint8Array(bytes) : undefined
        },
      }
      try {
        const result = await restoreBackup(target, drillSource, surface, id, { id: "local-restore-drill", canWrite: true, roles: ["admin"] }, true, 0, at)
        if (!result.ok) throw new Error("Restore drill failed")
        options.signal?.throwIfAborted()
        await target.transaction(surface, async (snapshot: Snapshot, blobs: BlobTransaction) => {
          const expected = structuredClone(archive.snapshot.data)
          ;["noticeDelivery", "noticeClaims", "noticeSchedule", "localInbox", "localJobState"].forEach((key) => { delete expected[key] })
          const actual = structuredClone(snapshot.data)
          if (surface === "procurement") {
            const store = record(expected.store) ? expected.store : {}
            const issued = record(store.issued) ? store.issued : {}
            expected.store = { ...store, sup: Array.isArray(store.sup) ? store.sup : [], issued: { pr: Array.isArray(issued.pr) ? issued.pr : [], po: Array.isArray(issued.po) ? issued.po : [] } }
          }
          if (!isDeepStrictEqual(actual, expected)) throw new Error("Restored business state differs from archive")
          for (const [key, bytes] of archive.blobs) {
            const restored = await blobs.get(key)
            if (!restored || hash(restored) !== hash(bytes)) throw new Error("Restore drill blob mismatch")
          }
          return { commit: false, value: undefined }
        }, { signal: options.signal })
        return { at, durationMs: Math.ceil(performance.now() - started) }
      } finally {
        await target.dispose()
        await rm(scratch, { recursive: true, force: true })
      }
    },
    list: async (surface, options = {}) => {
      const parent = await surfaceDirectory(surface, false, options.signal)
      if (!parent) return []
      await cleanup(parent, options.signal)
      const result: Array<{ id: string; at: string; assets: number; bytes: number; tier: "daily" | "monthly" }> = []
      for (const id of await readdir(parent)) {
        options.signal?.throwIfAborted()
        if (!archiveId.test(id)) continue
        const metadata = await readArchiveMetadata(join(parent, id), surface, id, options.signal)
        const bytes = metadata.manifest.blobs.reduce((sum, blob) => sum + blob.bytes, 0)
        if (!Number.isSafeInteger(bytes)) throw new Error("Backup inventory byte count overflow")
        result.push({ id, at: metadata.manifest.at, tier: metadata.tier, assets: metadata.manifest.blobs.length, bytes })
      }
      return result.sort((left, right) => right.at.localeCompare(left.at) || left.id.localeCompare(right.id))
    },
    capture: async (store, surface, at, tier = "daily", options = {}) => {
      if (tier !== "daily" && tier !== "monthly") throw new Error("Invalid archive retention tier")
      requireSurface(surface)
      if (!Number.isFinite(Date.parse(at))) throw new Error("Invalid backup time")
      options.signal?.throwIfAborted()
      const parent = await surfaceDirectory(surface, true, options.signal)
      if (!parent) throw new Error("Missing backup directory")
      await cleanup(parent, options.signal)

      // Capture the logical snapshot quickly, then read each referenced generation in short
      // transactions. Filesystem writes, fsync, verification and pruning happen with no SQL owner.
      const captured = await store.transaction(surface, async (snapshot: Snapshot) => ({
        commit: false,
        value: structuredClone(snapshot),
      }), { signal: options.signal })
      const readCapturedBlob = (key: string) => store.transaction(surface, async (snapshot: Snapshot, blobs: BlobTransaction) => {
        if (blobGeneration(snapshot, key) !== blobGeneration(captured, key)) throw new Error("Live blob changed during backup capture")
        return { commit: false, value: await blobs.get(key) }
      }, { signal: options.signal })
      const verifyCapturedGenerations = (keys: readonly string[]) => store.transaction(surface, async (snapshot: Snapshot) => {
        if (keys.some((key) => blobGeneration(snapshot, key) !== blobGeneration(captured, key)))
          throw new Error("Live blobs changed before backup publication")
        return { commit: false, value: undefined }
      }, { signal: options.signal })
      const persistence: Persistence = {
        transaction: async (requested, work) => {
          options.signal?.throwIfAborted()
          if (requested !== surface) throw new Error("Backup surface changed")
          const result = await work(structuredClone(captured))
          if (result.commit) throw new Error("Backup facade is read-only")
          return result.value
        },
      }

      return backup(persistence, {
        save: async (requested, copy, instant) => {
          if (requested !== surface) throw new Error("Backup surface changed")
          await surfaceDirectory(surface, false, options.signal)
          const id = `backup-${randomUUID()}`
          const staging = join(parent, `.stage-${randomUUID()}`)
          await mkdir(staging, { mode: 0o700 })
          activeStages.add(staging)
          const written: string[] = []
          const published = { value: false }
          try {
            options.signal?.throwIfAborted()
            const payload = encodeSnapshot(copy)
            if (!isDeepStrictEqual(decodeSnapshot(payload), captured)) throw new Error("Snapshot codec changed captured state")
            const assets = copy.data.assets === undefined ? [] : copy.data.assets
            if (!Array.isArray(assets)) throw new Error("Invalid backup assets")
            const retained: BackupManifest["blobs"][number][] = []
            for (const asset of assets) {
              options.signal?.throwIfAborted()
              if (!record(asset) || typeof asset.key !== "string" || !asset.key || !Number.isSafeInteger(asset.bytes) || Number(asset.bytes) < 0 || retained.some((blob) => blob.key === asset.key))
                throw new Error("Invalid backup asset")
              const bytes = await readCapturedBlob(asset.key)
              if (!bytes || bytes.byteLength !== asset.bytes) throw new Error("Missing or corrupt live blob")
              const name = blobName(asset.key)
              written.push(name)
              await durableWrite(join(staging, name), bytes, options.signal, dependencies.io)
              retained.push({ key: asset.key, bytes: bytes.byteLength, sha256: hash(bytes) })
            }
            const manifest: BackupManifest = { version: 1, surface, at: instant, snapshotSha256: hash(JSON.stringify(copy)), blobs: retained, integrity: "verified", private: true }
            written.push("snapshot.json")
            await durableWrite(join(staging, "snapshot.json"), payload, options.signal, dependencies.io)
            written.push("manifest.json")
            await durableWrite(join(staging, "manifest.json"), JSON.stringify({ format: "sucafina-local-backup-v1", id, tier, payloadSha256: hash(payload), manifest }), options.signal, dependencies.io)
            const verified = await verifyArchive(staging, surface, id, options.signal)
            if (!isDeepStrictEqual(verified.snapshot, captured)) throw new Error("Stored snapshot differs from capture")
            await verifyCapturedGenerations(retained.map((blob) => blob.key))
            await syncDirectory(staging, options.signal)
            options.signal?.throwIfAborted()
            await surfaceDirectory(surface, false, options.signal)
            await rename(staging, join(parent, id))
            published.value = true
            // Rename is the publication boundary. Once crossed, finish directory durability even if shutdown begins.
            await syncDirectory(parent)
            return { id, manifest }
          } finally {
            activeStages.delete(staging)
            if (!published.value) {
              for (const name of written) await unlink(join(staging, name)).catch(() => undefined)
              await rmdir(staging).catch(() => undefined)
            }
          }
        },
        prune: async (requested, olderThan) => {
          const path = await surfaceDirectory(requested, false, options.signal)
          if (!path) return
          await cleanup(path, options.signal)
          for (const id of await readdir(path)) {
            options.signal?.throwIfAborted()
            if (!archiveId.test(id)) continue
            const archive = await readArchiveMetadata(join(path, id), requested, id, options.signal)
            const monthlyCutoff = new Date(at)
            monthlyCutoff.setUTCFullYear(monthlyCutoff.getUTCFullYear() - 7)
            const cutoff = archive.tier === "monthly" ? monthlyCutoff.getTime() : Date.parse(olderThan)
            if (Date.parse(archive.manifest.at) >= cutoff) continue
            const location = join(path, id)
            await surfaceDirectory(requested, false, options.signal)
            await privateDirectory(location)
            // Retention must never erase the only evidence that an archive has corrupted.
            const verified = await verifyArchive(location, requested, id, options.signal)
            options.signal?.throwIfAborted()
            // Do not let cancellation turn one valid archive into a partial corrupt directory.
            for (const name of verified.files) {
              await privateFile(join(location, name))
              await unlink(join(location, name))
            }
            await rmdir(location)
            await syncDirectory(path)
          }
        },
      }, surface, { at })
    },
  }
}

const archiveId = /^backup-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
const stageId = /^\.stage-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
const stageFile = /^(?:manifest\.json|snapshot\.json|blob-[a-f0-9]{64})$/

function requireId(id: string) {
  if (typeof id !== "string" || !archiveId.test(id)) throw new Error("Unsafe backup archive ID")
}
function requireSurface(surface: Surface) {
  if (!["dashboard", "procurement", "planner"].includes(surface)) throw new Error("Invalid backup surface")
}
function hash(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex")
}
function blobName(key: string) {
  return `blob-${hash(key)}`
}
function blobGeneration(snapshot: Snapshot, key: string) {
  const value = snapshot.sfBlobGenerations?.[key]
  if (value === undefined) return 0
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid live blob generation")
  return value
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
function hasCode(error: unknown, code: string) {
  return record(error) && error.code === code
}
async function makeDirectory(path: string) {
  await mkdir(path, { mode: 0o700 }).catch((error: unknown) => {
    if (!hasCode(error, "EEXIST")) throw error
  })
  await privateDirectory(path)
}
async function ancestors(path: string, create: boolean) {
  const location = { path: parse(path).root }
  for (const part of path.slice(location.path.length).split(sep).filter(Boolean)) {
    location.path = join(location.path, part)
    const info = await lstat(location.path).catch(async (error: unknown) => {
      if (!create || !hasCode(error, "ENOENT")) throw error
      await makeDirectory(location.path)
      return lstat(location.path)
    })
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Backup path contains an alias")
  }
  if (await realpath(path) !== path) throw new Error("Backup path is not canonical")
}
async function privateDirectory(path: string) {
  const info = await lstat(path)
  const uid = process.getuid?.()
  if (uid === undefined || !info.isDirectory() || info.isSymbolicLink() || info.uid !== uid || (info.mode & 0o777) !== 0o700)
    throw new Error("Backup directory must be owned and private (0700)")
  return info
}
async function privateFile(path: string) {
  const info = await lstat(path)
  const uid = process.getuid?.()
  if (uid === undefined || !info.isFile() || info.isSymbolicLink() || info.uid !== uid || (info.mode & 0o777) !== 0o600 || info.nlink !== 1)
    throw new Error("Backup file must be an owned private regular file (0600)")
  return info
}
async function privateRead(path: string, signal?: AbortSignal) {
  signal?.throwIfAborted()
  const before = await privateFile(path)
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const info = await file.stat()
    if (info.dev !== before.dev || info.ino !== before.ino || info.uid !== before.uid || (info.mode & 0o777) !== 0o600 || info.nlink !== 1)
      throw new Error("Backup file changed while opening")
    const value = await file.readFile()
    signal?.throwIfAborted()
    return value
  } finally { await file.close() }
}
async function durableWrite(path: string, value: string | Uint8Array, signal?: AbortSignal, io?: BackupDependencies["io"]) {
  signal?.throwIfAborted()
  await io?.beforeDurableWrite?.(path, signal)
  signal?.throwIfAborted()
  const file = await open(path, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600)
  try {
    await file.writeFile(value)
    signal?.throwIfAborted()
    await file.sync()
    signal?.throwIfAborted()
  } finally { await file.close() }
}
async function syncDirectory(path: string, signal?: AbortSignal) {
  signal?.throwIfAborted()
  await privateDirectory(path)
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY)
  try {
    await file.sync()
    signal?.throwIfAborted()
  } finally { await file.close() }
}
async function cleanupStages(parent: string, active: ReadonlySet<string>, minimumAgeMs: number, signal?: AbortSignal) {
  let changed = false
  for (const name of await readdir(parent)) {
    signal?.throwIfAborted()
    if (!stageId.test(name)) continue
    const location = join(parent, name)
    if (active.has(location)) continue
    const info = await privateDirectory(location)
    if (Date.now() - info.mtimeMs < minimumAgeMs) continue
    const files = await readdir(location)
    if (files.some((file) => !stageFile.test(file))) throw new Error("Unsafe orphan backup staging directory")
    signal?.throwIfAborted()
    // Once cleanup starts, finish this one private stage atomically with respect to cancellation.
    for (const file of files) {
      await privateFile(join(location, file))
      await unlink(join(location, file))
    }
    await rmdir(location)
    changed = true
  }
  if (changed) await syncDirectory(parent, signal)
}

async function readArchiveMetadata(path: string, surface: Surface, id: string, signal?: AbortSignal, verifySnapshot = true): Promise<ArchiveMetadata> {
  await privateDirectory(path)
  let envelope: unknown
  try { envelope = JSON.parse((await privateRead(join(path, "manifest.json"), signal)).toString("utf8")) }
  catch { throw new Error(`Local backup archive ${id} failed integrity inspection`) }
  if (!record(envelope) || envelope.format !== "sucafina-local-backup-v1" || envelope.id !== id || typeof envelope.payloadSha256 !== "string" || !/^[a-f0-9]{64}$/.test(envelope.payloadSha256) || !record(envelope.manifest))
    throw new Error(`Local backup archive ${id} failed integrity inspection`)
  const raw = envelope.manifest
  if (raw.version !== 1 || raw.surface !== surface || typeof raw.at !== "string" || !Number.isFinite(Date.parse(raw.at)) || typeof raw.snapshotSha256 !== "string" || !/^[a-f0-9]{64}$/.test(raw.snapshotSha256) || raw.integrity !== "verified" || raw.private !== true || !Array.isArray(raw.blobs))
    throw new Error(`Local backup archive ${id} failed integrity inspection`)
  const blobs: { key: string; bytes: number; sha256: string }[] = []
  for (const value of raw.blobs) {
    if (!record(value) || typeof value.key !== "string" || !value.key || typeof value.bytes !== "number" || !Number.isSafeInteger(value.bytes) || value.bytes < 0 || typeof value.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.sha256) || blobs.some((blob) => blob.key === value.key))
      throw new Error(`Local backup archive ${id} failed integrity inspection`)
    blobs.push({ key: value.key, bytes: value.bytes, sha256: value.sha256 })
  }
  if (envelope.tier !== undefined && envelope.tier !== "daily" && envelope.tier !== "monthly")
    throw new Error(`Local backup archive ${id} failed integrity inspection`)
  const tier: "daily" | "monthly" = envelope.tier === "monthly" ? "monthly" : "daily"
  const manifest: BackupManifest = { version: 1, surface, at: raw.at, snapshotSha256: raw.snapshotSha256, blobs, integrity: "verified", private: true }
  const files = ["manifest.json", "snapshot.json", ...blobs.map((blob) => blobName(blob.key))]
  if (new Set(files).size !== files.length || !isDeepStrictEqual((await readdir(path)).sort(), [...files].sort()))
    throw new Error(`Local backup archive ${id} failed integrity inspection`)
  for (const file of files) await privateFile(join(path, file))
  let snapshot: Snapshot | undefined
  if (verifySnapshot) {
    const payload = await privateRead(join(path, "snapshot.json"), signal)
    if (hash(payload) !== envelope.payloadSha256) throw new Error("Corrupt encoded backup snapshot")
    try { snapshot = decodeSnapshot(payload.toString("utf8")) }
    catch { throw new Error("Corrupt encoded backup snapshot") }
    if (manifest.snapshotSha256 !== hash(JSON.stringify(snapshot))) throw new Error("Invalid backup manifest")
    const assets = snapshot.data.assets === undefined ? [] : snapshot.data.assets
    if (!Array.isArray(assets) || assets.length !== manifest.blobs.length || assets.some((asset) => !record(asset) || typeof asset.key !== "string" || !manifest.blobs.some((blob) => blob.key === asset.key && blob.bytes === asset.bytes)) || new Set(assets.map((asset) => record(asset) ? asset.key : undefined)).size !== assets.length)
      throw new Error("Backup assets do not match retained blobs")
  }
  signal?.throwIfAborted()
  return { manifest, payloadSha256: envelope.payloadSha256, files, tier, ...(snapshot ? { snapshot } : {}) }
}

async function verifyArchive(path: string, surface: Surface, id: string, signal?: AbortSignal, retainBlobs = false) {
  const metadata = await readArchiveMetadata(path, surface, id, signal)
  if (!metadata.snapshot) throw new Error("Backup snapshot inspection unavailable")
  const snapshot = metadata.snapshot
  const blobs = new Map<string, Uint8Array>()
  for (const blob of metadata.manifest.blobs) {
    signal?.throwIfAborted()
    const bytes = await privateRead(join(path, blobName(blob.key)), signal)
    if (bytes.byteLength !== blob.bytes || hash(bytes) !== blob.sha256) throw new Error("Missing or corrupt retained blob")
    if (retainBlobs) blobs.set(blob.key, new Uint8Array(bytes))
  }
  return { snapshot, manifest: metadata.manifest, blobs, files: metadata.files, tier: metadata.tier }
}
