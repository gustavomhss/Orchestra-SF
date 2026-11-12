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

export async function createLocalBackups(directory: string): Promise<{
  capture: (store: LocalStore, surface: Surface, at: string, tier?: "daily" | "monthly") => Promise<{ id: string; manifest: BackupManifest }>
  list: (surface: Surface) => Promise<Array<{ id: string; at: string; assets: number; bytes: number; tier: "daily" | "monthly" }>>
  verify: (surface: Surface, id: string, at: string) => Promise<{ at: string; durationMs: number }>
  source: RestoreTransport
}> {
  if (!isAbsolute(directory) || resolve(directory) !== directory || directory === parse(directory).root)
    throw new Error("Backups require an absolute canonical private directory")
  await ancestors(directory, true)
  await privateDirectory(directory)
  const identity = await lstat(directory)
  const requireRoot = async () => {
    await ancestors(directory, false)
    await privateDirectory(directory)
    const current = await lstat(directory)
    if (current.dev !== identity.dev || current.ino !== identity.ino) throw new Error("Backup root changed")
  }
  const surfaceDirectory = async (surface: Surface, create = false) => {
    requireSurface(surface)
    await requireRoot()
    const path = join(directory, surface)
    if (create) {
      await makeDirectory(path)
      await syncDirectory(directory)
    }
    const info = await lstat(path).catch((error: unknown) => {
      if (hasCode(error, "ENOENT")) return undefined
      throw error
    })
    if (!info) return undefined
    await privateDirectory(path)
    return path
  }
  const load = async (surface: Surface, id: string) => {
    requireId(id)
    const parent = await surfaceDirectory(surface)
    if (!parent) return undefined
    const path = join(parent, id)
    const exists = await lstat(path).catch((error: unknown) => {
      if (hasCode(error, "ENOENT")) return undefined
      throw error
    })
    if (!exists) return undefined
    return verifyArchive(path, surface, id)
  }
  const source: RestoreTransport = {
    load: async (surface, id) => {
      const archive = await load(surface, id)
      return archive ? { snapshot: archive.snapshot, manifest: archive.manifest } : undefined
    },
    readBlob: async (surface, id, key) => {
      const archive = await load(surface, id)
      if (!archive || !archive.manifest.blobs.some((blob) => blob.key === key)) return undefined
      // Verification and retrieval use retained bytes only; no capability to the live store exists here.
      return archive.blobs.get(key)
    },
  }
  return {
    source,
    verify: async (surface, id, at) => {
      if (!Number.isFinite(Date.parse(at))) throw new Error("Invalid drill time")
      const started = performance.now()
      const archive = await load(surface, id)
      if (!archive) throw new Error("Restore drill archive is unavailable")
      await requireRoot()
      const scratch = await mkdtemp(join(directory, ".drill-"))
      const target = await openLocalStore(join(scratch, "business"))
      try {
        const result = await restoreBackup(target, source, surface, id, { id: "local-restore-drill", canWrite: true, roles: ["admin"] }, true, 0, at)
        if (!result.ok) throw new Error("Restore drill failed")
        await target.transaction(surface, async (snapshot: Snapshot, blobs: BlobTransaction) => {
          const expected = structuredClone(archive.snapshot.data)
          ;["noticeDelivery", "noticeClaims", "noticeSchedule", "localInbox", "localJobState"].forEach((key) => { delete expected[key] })
          const actual = structuredClone(snapshot.data)
          if (surface === "procurement") {
            // Restore keeps monotone issued identifiers; empty target has no extra values.
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
        })
        return { at, durationMs: Math.ceil(performance.now() - started) }
      } finally { await target.dispose(); await rm(scratch, { recursive: true, force: true }) }
    },
    list: async (surface) => {
      const parent = await surfaceDirectory(surface)
      if (!parent) return []
      const result: Array<{ id: string; at: string; assets: number; bytes: number; tier: "daily" | "monthly" }> = []
      for (const id of await readdir(parent)) {
        if (!archiveId.test(id)) continue
        const archive = await load(surface, id).catch(() => undefined)
        if (!archive) continue
        result.push({ id, at: archive.manifest.at, tier: archive.tier, assets: archive.manifest.blobs.length, bytes: archive.manifest.blobs.reduce((sum, blob) => sum + blob.bytes, 0) })
      }
      return result.sort((left, right) => right.at.localeCompare(left.at) || left.id.localeCompare(right.id))
    },
    capture: async (store, surface, at, tier = "daily") => {
      if (tier !== "daily" && tier !== "monthly") throw new Error("Invalid archive retention tier")
      requireSurface(surface)
      if (!Number.isFinite(Date.parse(at))) throw new Error("Invalid backup time")
      const parent = await surfaceDirectory(surface, true)
      if (!parent) throw new Error("Missing backup directory")
      // The only SQL transaction owns both snapshot and blob capabilities throughout capture.
      return store.transaction(surface, async (snapshot: Snapshot, blobs: BlobTransaction) => {
        const captured = structuredClone(snapshot)
        const persistence: Persistence = {
          transaction: async (requested, work) => {
            if (requested !== surface) throw new Error("Backup surface changed")
            const result = await work(structuredClone(captured))
            if (result.commit) throw new Error("Backup facade is read-only")
            return result.value
          },
        }
        const result = await backup(persistence, {
          save: async (requested, copy, instant) => {
            if (requested !== surface) throw new Error("Backup surface changed")
            await surfaceDirectory(surface)
            const id = `backup-${randomUUID()}`
            const staging = join(parent, `.stage-${randomUUID()}`)
            await mkdir(staging, { mode: 0o700 })
            const written: string[] = []
            const published = { value: false }
            try {
              const payload = encodeSnapshot(copy)
              if (!isDeepStrictEqual(decodeSnapshot(payload), captured)) throw new Error("Snapshot codec changed captured state")
              const assets = copy.data.assets === undefined ? [] : copy.data.assets
              if (!Array.isArray(assets)) throw new Error("Invalid backup assets")
              const retained: BackupManifest["blobs"][number][] = []
              for (const asset of assets) {
                if (!record(asset) || typeof asset.key !== "string" || !asset.key || !Number.isSafeInteger(asset.bytes) || Number(asset.bytes) < 0 || retained.some((blob) => blob.key === asset.key))
                  throw new Error("Invalid backup asset")
                const bytes = await blobs.get(asset.key)
                if (!bytes || bytes.byteLength !== asset.bytes) throw new Error("Missing or corrupt live blob")
                const name = blobName(asset.key)
                await durableWrite(join(staging, name), bytes)
                written.push(name)
                retained.push({ key: asset.key, bytes: bytes.byteLength, sha256: hash(bytes) })
              }
              const manifest: BackupManifest = { version: 1, surface, at: instant, snapshotSha256: hash(JSON.stringify(copy)), blobs: retained, integrity: "verified", private: true }
              await durableWrite(join(staging, "snapshot.json"), payload)
              written.push("snapshot.json")
              await durableWrite(join(staging, "manifest.json"), JSON.stringify({ format: "sucafina-local-backup-v1", id, tier, payloadSha256: hash(payload), manifest }))
              written.push("manifest.json")
              const verified = await verifyArchive(staging, surface, id)
              if (!isDeepStrictEqual(verified.snapshot, captured)) throw new Error("Stored snapshot differs from capture")
              await syncDirectory(staging)
              await surfaceDirectory(surface)
              await rename(staging, join(parent, id))
              published.value = true
              await syncDirectory(parent)
              return { id, manifest }
            } finally {
              if (!published.value) {
                // Never recursively remove an unvalidated directory or follow any supplied path.
                for (const name of written) await unlink(join(staging, name)).catch(() => undefined)
                await rmdir(staging).catch(() => undefined)
              }
            }
          },
          prune: async (requested, olderThan) => {
            const path = await surfaceDirectory(requested)
            if (!path) return
            for (const id of await readdir(path)) {
              if (!archiveId.test(id)) continue
              const archive = await load(requested, id).catch(() => undefined)
              if (!archive) continue
              const monthlyCutoff = new Date(at)
              monthlyCutoff.setUTCFullYear(monthlyCutoff.getUTCFullYear() - 7)
              const cutoff = archive.tier === "monthly" ? monthlyCutoff.getTime() : Date.parse(olderThan)
              if (Date.parse(archive.manifest.at) >= cutoff) continue
              const location = join(path, id)
              await surfaceDirectory(requested)
              await privateDirectory(location)
              // Only a complete, owned archive with the exact validated file set is eligible.
              for (const name of archive.files) {
                await privateFile(join(location, name))
                await unlink(join(location, name))
              }
              await rmdir(location)
              await syncDirectory(path)
            }
          },
        }, surface, { at })
        return { commit: false, value: result }
      })
    },
  }
}

const archiveId = /^backup-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/

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
}
async function privateFile(path: string) {
  const info = await lstat(path)
  const uid = process.getuid?.()
  if (uid === undefined || !info.isFile() || info.isSymbolicLink() || info.uid !== uid || (info.mode & 0o777) !== 0o600 || info.nlink !== 1)
    throw new Error("Backup file must be an owned private regular file (0600)")
  return info
}
async function privateRead(path: string) {
  const before = await privateFile(path)
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const info = await file.stat()
    if (info.dev !== before.dev || info.ino !== before.ino || info.uid !== before.uid || (info.mode & 0o777) !== 0o600 || info.nlink !== 1)
      throw new Error("Backup file changed while opening")
    return await file.readFile()
  } finally {
    await file.close()
  }
}
async function durableWrite(path: string, value: string | Uint8Array) {
  const file = await open(path, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600)
  try {
    await file.writeFile(value)
    await file.sync()
  } finally {
    await file.close()
  }
}
async function syncDirectory(path: string) {
  await privateDirectory(path)
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY)
  try { await file.sync() } finally { await file.close() }
}
async function verifyArchive(path: string, surface: Surface, id: string) {
  await privateDirectory(path)
  const envelope: unknown = JSON.parse((await privateRead(join(path, "manifest.json"))).toString("utf8"))
  if (!record(envelope) || envelope.format !== "sucafina-local-backup-v1" || envelope.id !== id || typeof envelope.payloadSha256 !== "string" || !record(envelope.manifest))
    throw new Error("Invalid local backup envelope")
  const payload = await privateRead(join(path, "snapshot.json"))
  if (hash(payload) !== envelope.payloadSha256) throw new Error("Corrupt encoded backup snapshot")
  const snapshot = decodeSnapshot(payload.toString("utf8"))
  const manifest = envelope.manifest
  if (manifest.version !== 1 || manifest.surface !== surface || typeof manifest.at !== "string" || !Number.isFinite(Date.parse(manifest.at)) || manifest.snapshotSha256 !== hash(JSON.stringify(snapshot)) || manifest.integrity !== "verified" || manifest.private !== true || !Array.isArray(manifest.blobs))
    throw new Error("Invalid backup manifest")
  const assets = snapshot.data.assets === undefined ? [] : snapshot.data.assets
  if (!Array.isArray(assets)) throw new Error("Invalid backup assets")
  const blobs = new Map<string, Uint8Array>()
  for (const blob of manifest.blobs) {
    if (!record(blob) || typeof blob.key !== "string" || !blob.key || !Number.isSafeInteger(blob.bytes) || Number(blob.bytes) < 0 || typeof blob.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(blob.sha256) || blobs.has(blob.key))
      throw new Error("Invalid backup blob manifest")
    const bytes = await privateRead(join(path, blobName(blob.key)))
    if (bytes.byteLength !== blob.bytes || hash(bytes) !== blob.sha256) throw new Error("Missing or corrupt retained blob")
    blobs.set(blob.key, new Uint8Array(bytes))
  }
  if (assets.length !== blobs.size || assets.some((asset) => !record(asset) || typeof asset.key !== "string" || !blobs.has(asset.key) || blobs.get(asset.key)!.byteLength !== asset.bytes) || new Set(assets.map((asset) => record(asset) ? asset.key : undefined)).size !== assets.length)
    throw new Error("Backup assets do not match retained blobs")
  const files = ["manifest.json", "snapshot.json", ...[...blobs.keys()].map(blobName)]
  if (!isDeepStrictEqual((await readdir(path)).sort(), [...files].sort())) throw new Error("Unknown or incomplete archive contents")
  if (envelope.tier !== undefined && envelope.tier !== "daily" && envelope.tier !== "monthly") throw new Error("Invalid archive retention tier")
  const tier: "daily" | "monthly" = envelope.tier === "monthly" ? "monthly" : "daily"
  return { snapshot, manifest: manifest as BackupManifest, blobs, files, tier }
}
