import { Database } from "bun:sqlite"
import { AsyncLocalStorage } from "node:async_hooks"
import { constants } from "node:fs"
import { lstat, mkdir, open, realpath } from "node:fs/promises"
import { isAbsolute, join, parse, resolve, sep } from "node:path"
import type { LocalStore } from "./local-contract.ts"
import type { Snapshot, TransactionOptions } from "./contract.ts"
import type { BlobTransaction } from "./assets.ts"
import type { Surface } from "../src/identity.ts"

export async function openLocalStore(directory: string, options: { lockTimeoutMs?: number } = {}): Promise<LocalStore> {
  if (!isAbsolute(directory)) throw new Error("Local storage requires an absolute dedicated directory")
  const timeout = options.lockTimeoutMs ?? 5000
  if (!Number.isFinite(timeout) || timeout < 0) throw new Error("Invalid lock timeout")
  if (resolve(directory) !== directory) throw new Error("Local storage requires a canonical directory path")
  // Check each ancestor before creating descendants; never traverse an alias or chmod user folders.
  const components = directory.slice(parse(directory).root.length).split(sep).filter(Boolean)
  const location = { path: parse(directory).root }
  for (const component of components) {
    location.path = join(location.path, component)
    const ancestor = await lstat(location.path).catch(async (error: unknown) => {
      if (!hasCode(error, "ENOENT")) throw error
      await mkdir(location.path, { mode: 0o700 }).catch((creationError: unknown) => {
        if (!hasCode(creationError, "EEXIST")) throw creationError
      })
      return lstat(location.path)
    })
    if (!ancestor.isDirectory() || ancestor.isSymbolicLink()) throw new Error("Local storage path contains a directory alias")
  }
  if (await realpath(directory) !== directory) throw new Error("Local storage directory must use its real path")
  const uid = process.getuid?.()
  if (uid === undefined) throw new Error("Local storage requires filesystem UID ownership checks")
  const info = await lstat(directory)
  if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== uid || (info.mode & 0o077) !== 0)
    throw new Error("Local storage directory must be private (0700)")
  const path = join(directory, "installation.sqlite")
  // Exclusive creation avoids changing permissions on an unrelated pre-existing file.
  const file = await open(path, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR, 0o600).catch(async (error: unknown) => {
    if (!hasCode(error, "EEXIST")) throw error
    const existing = await lstat(path)
    if (!existing.isFile() || existing.isSymbolicLink() || existing.uid !== uid || (existing.mode & 0o077) !== 0)
      throw new Error("Local database must be a private regular file")
    return open(path, constants.O_RDWR | constants.O_NOFOLLOW)
  })
  try {
    const opened = await file.stat()
    if (!opened.isFile() || opened.uid !== uid || (opened.mode & 0o077) !== 0 || await realpath(path) !== path)
      throw new Error("Local database must be owned by the current UID at its real path")
  } finally {
    await file.close()
  }

  const connect = () => {
    const db = new Database(path, { strict: true })
    try {
      db.exec("PRAGMA busy_timeout=0; PRAGMA synchronous=FULL")
      return db
    } catch (error) {
      db.close()
      throw error
    }
  }
  const initial = connect()
  try {
    await retryLock(() => initial.exec("PRAGMA journal_mode=WAL"), timeout)
    await retryLock(() => initial.exec("BEGIN IMMEDIATE"), timeout)
    try {
      initial.exec(`
        CREATE TABLE IF NOT EXISTS snapshots (surface TEXT PRIMARY KEY, payload TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS blobs (surface TEXT NOT NULL, key TEXT NOT NULL, payload BLOB NOT NULL, type TEXT NOT NULL, PRIMARY KEY (surface, key));
        CREATE TABLE IF NOT EXISTS authentication_payloads (key TEXT PRIMARY KEY, payload BLOB NOT NULL, expires_at REAL NOT NULL);
        COMMIT;
      `)
    } finally {
      if (initial.inTransaction) initial.exec("ROLLBACK")
    }
  } finally {
    initial.close()
  }

  // This is a memo of the pure v1 decoder, not of a transaction or authority.
  // Every caller still observes SQL under the existing lock. Only immutable
  // strings survive a call; each hit parses a new, fully detached object graph.
  const materializations = new Map<Surface, SnapshotMaterialization>()
  const loadSnapshot = (surface: Surface, payload?: string): Snapshot => {
    const prior = materializations.get(surface)
    if (payload !== undefined && prior?.payload === payload) return materializeSnapshot(prior)
    materializations.delete(surface)
    if (payload === undefined) return { data: {}, versions: {}, sequences: {}, audit: [], notices: [] }
    const snapshot = decodeSnapshot(payload)
    const plan = planSnapshotMaterialization(snapshot, payload)
    if (plan) {
      const retained = { units: [...materializations.values()].reduce((sum, entry) => sum + entry.units, 0) }
      for (const [name, entry] of materializations) {
        if (retained.units + plan.units <= SNAPSHOT_MATERIALIZATION_UNITS && materializations.size < 3) break
        materializations.delete(name)
        retained.units -= entry.units
      }
      materializations.set(surface, plan)
    }
    return snapshot
  }

  type ReadScope = {
    root: { db: Database; snapshots: Partial<Record<Surface, Snapshot>>; poisoned: boolean; readers: number }
    parent?: ReadScope
    open: boolean
    signal?: AbortSignal
  }
  const context = new AsyncLocalStorage<ReadScope>()
  const requireScope = (scope: ReadScope) => {
    let current: ReadScope | undefined = scope
    while (current) {
      if (!current.open) throw new Error("Local transaction scope has ended")
      current.signal?.throwIfAborted()
      current = current.parent
    }
  }
  const lifecycle = { closed: false, disposing: undefined as Promise<void> | undefined }
  const active = new Set<Promise<unknown>>()
  const queue = { tail: undefined as Promise<void> | undefined }
  const operation = <T>(write: boolean, work: (db: Database) => Promise<T>, signal?: AbortSignal): Promise<T> => {
    if (lifecycle.closed) return Promise.reject(new Error("Local store is disposed"))
    const inherited = context.getStore()
    if (inherited) {
      try {
        requireScope(inherited)
        signal?.throwIfAborted()
        if (write) {
          inherited.root.poisoned = true
          throw new Error("Nested local writes are forbidden")
        }
        return work(inherited.root.db).then((value) => {
          requireScope(inherited)
          signal?.throwIfAborted()
          return value
        })
      } catch (error) {
        return Promise.reject(error)
      }
    }
    const previous = write ? queue.tail : undefined
    const deadline = performance.now() + timeout
    const pending = (async () => {
      // Serialize writers within this instance instead of making maintenance
      // contend with its own business transaction in WAL. Credential reads
      // remain independent because authentication awaits them inside that transaction.
      if (previous) await waitForAdmission(previous, Math.max(0, deadline - performance.now()), signal)
      signal?.throwIfAborted()
      const db = connect()
      try {
        if (write) await retryLock(() => db.exec("BEGIN IMMEDIATE"), Math.max(0, deadline - performance.now()), signal)
        signal?.throwIfAborted()
        return await work(db)
      } finally {
        try {
          if (db.inTransaction) db.exec("ROLLBACK")
        } finally {
          db.close()
        }
      }
    })()
    const settled = pending.then(() => undefined, () => undefined)
    // A cancelled waiter cannot let later work overtake an earlier active owner.
    const tail = previous ? previous.then(() => settled) : settled
    if (write) {
      queue.tail = tail
      void tail.then(() => { if (queue.tail === tail) queue.tail = undefined })
    }
    active.add(pending)
    // Register both handlers without creating an unobserved rejecting cleanup promise.
    void pending.then(() => active.delete(pending), () => active.delete(pending))
    return pending
  }

  return {
    currentSnapshots: () => {
      const scope = context.getStore()
      if (!scope) return undefined
      requireScope(scope)
      const snapshots = scope.root.snapshots
      if (!snapshots.dashboard || !snapshots.planner || !snapshots.procurement) throw new Error("Local transaction snapshots unavailable")
      return { dashboard: decodeSnapshot(encodeSnapshot(snapshots.dashboard)), planner: decodeSnapshot(encodeSnapshot(snapshots.planner)),
        procurement: decodeSnapshot(encodeSnapshot(snapshots.procurement)) }
    },
    transaction: <T>(surface: Surface, work: (snapshot: Snapshot, blobs: BlobTransaction) => Promise<{ commit: boolean; value: T }>, transactionOptions?: TransactionOptions) => {
      const parent = context.getStore()
      if (parent) return (async () => {
        if (lifecycle.closed) throw new Error("Local store is disposed")
        requireScope(parent)
        transactionOptions?.signal?.throwIfAborted()
        const scope: ReadScope = { root: parent.root, parent, open: true, signal: transactionOptions?.signal }
        const staged = parent.root.snapshots[surface]
        const row = staged ? undefined : parent.root.db.query<{ payload: string }, [string]>("SELECT payload FROM snapshots WHERE surface = ?").get(surface)
        const snapshot = staged ? decodeSnapshot(encodeSnapshot(staged)) :
          loadSnapshot(surface, row?.payload)
        const blobs: BlobTransaction = {
          get: async (key) => {
            requireScope(scope)
            if (context.getStore() !== scope) throw new Error("Blob capability used outside its transaction scope")
            const blob = scope.root.db.query<{ payload: Uint8Array }, [string, string]>("SELECT payload FROM blobs WHERE surface = ? AND key = ?").get(surface, key)
            return blob ? new Uint8Array(blob.payload) : undefined
          },
          put: async () => { requireScope(scope); scope.root.poisoned = true; throw new Error("Nested blob writes are forbidden") },
          remove: async () => { requireScope(scope); scope.root.poisoned = true; throw new Error("Nested blob writes are forbidden") },
        }
        scope.root.readers++
        try {
          const result = await context.run(scope, () => work(snapshot, blobs))
          requireScope(scope)
          if (result.commit) {
            scope.root.poisoned = true
            throw new Error("Nested local writes are forbidden")
          }
          if (scope.root.poisoned) throw new Error("Nested local write attempted")
          return result.value
        } finally {
          scope.open = false
          scope.root.readers--
        }
      })()
      return operation(true, async (db) => {
        const read = (name: Surface) => {
          const row = db.query<{ payload: string }, [string]>("SELECT payload FROM snapshots WHERE surface = ?").get(name)
          return loadSnapshot(name, row?.payload)
        }
        const snapshots = { dashboard: read("dashboard"), planner: read("planner"), procurement: read("procurement") }
        const snapshot = snapshots[surface]
        const generations = new Map(Object.entries(snapshot.sfBlobGenerations ?? {}))
        const checkGenerations = () => {
          if (!Bun.deepEquals(snapshot.sfBlobGenerations ?? {}, Object.fromEntries(generations))) throw new Error("Private blob generations changed outside storage")
        }
        const nextGeneration = (key: string) => {
          const current = generations.get(key) ?? 0
          if (!Number.isSafeInteger(current) || current < 0 || current >= Number.MAX_SAFE_INTEGER) throw new Error("Blob generation overflow")
          return current + 1
        }
        const recordGeneration = (key: string, generation: number) => {
          generations.set(key, generation)
          snapshot.sfBlobGenerations = Object.fromEntries(generations)
        }
        const scope: ReadScope = { root: { db, snapshots, poisoned: false, readers: 0 }, open: true, signal: transactionOptions?.signal }
        const requireOpen = () => {
          requireScope(scope)
          if (context.getStore() !== scope) throw new Error("Blob capability used outside its transaction scope")
        }
        const requireWritable = () => {
          requireScope(scope)
          if (context.getStore() !== scope || scope.root.readers > 0) {
            scope.root.poisoned = true
            throw new Error("Nested blob writes are forbidden")
          }
        }
        const blobs: BlobTransaction = {
          put: async (key, bytes, type) => {
            requireWritable()
            checkGenerations()
            const previous = db.query<{ payload: Uint8Array; type: string }, [string, string]>("SELECT payload, type FROM blobs WHERE surface = ? AND key = ?").get(surface, key)
            if (previous && previous.type === type && Bun.deepEquals(new Uint8Array(previous.payload), bytes)) return
            const generation = nextGeneration(key)
            db.query("INSERT INTO blobs (surface, key, payload, type) VALUES (?, ?, ?, ?) ON CONFLICT (surface, key) DO UPDATE SET payload=excluded.payload, type=excluded.type").run(surface, key, bytes, type)
            recordGeneration(key, generation)
          },
          get: async (key) => {
            requireOpen()
            const blob = db.query<{ payload: Uint8Array }, [string, string]>("SELECT payload FROM blobs WHERE surface = ? AND key = ?").get(surface, key)
            return blob ? new Uint8Array(blob.payload) : undefined
          },
          remove: async (key) => {
            requireWritable()
            checkGenerations()
            const existing = db.query<{ present: number }, [string, string]>("SELECT 1 AS present FROM blobs WHERE surface = ? AND key = ?").get(surface, key)
            if (!existing) return
            const generation = nextGeneration(key)
            db.query("DELETE FROM blobs WHERE surface = ? AND key = ?").run(surface, key)
            recordGeneration(key, generation)
          },
        }
        const result = await (async () => {
          try {
            return await context.run(scope, () => work(snapshot, blobs))
          } finally {
            scope.open = false
          }
        })()
        transactionOptions?.signal?.throwIfAborted()
        if (scope.root.poisoned) throw new Error("Nested local write attempted")
        if (scope.root.readers) throw new Error("Nested local read still active")
        checkGenerations()
        if (result.commit) {
          const payload = encodeSnapshot(snapshot)
          decodeSnapshot(payload)
          db.query("INSERT INTO snapshots (surface, payload) VALUES (?, ?) ON CONFLICT (surface) DO UPDATE SET payload=excluded.payload").run(surface, payload)
          transactionOptions?.signal?.throwIfAborted()
          db.exec("COMMIT")
        }
        return result.value
      }, transactionOptions?.signal)
    },
    transactionAll: <T>(work: (snapshots: Record<Surface, Snapshot>) => Promise<{ commit: boolean; value: T }>, transactionOptions?: TransactionOptions) =>
      operation(true, async (db) => {
        const surfaces: readonly Surface[] = ["dashboard", "planner", "procurement"]
        const read = (surface: Surface) => {
          const row = db.query<{ payload: string }, [string]>("SELECT payload FROM snapshots WHERE surface = ?").get(surface)
          return loadSnapshot(surface, row?.payload)
        }
        const snapshots = { dashboard: read("dashboard"), planner: read("planner"), procurement: read("procurement") }
        const generations = Object.fromEntries(surfaces.map((surface) => [surface, structuredClone(snapshots[surface].sfBlobGenerations ?? {})]))
        const scope: ReadScope = { root: { db, snapshots, poisoned: false, readers: 0 }, open: true, signal: transactionOptions?.signal }
        const result = await (async () => {
          try { return await context.run(scope, () => work(snapshots)) }
          finally { scope.open = false }
        })()
        transactionOptions?.signal?.throwIfAborted()
        if (scope.root.poisoned) throw new Error("Nested local write attempted")
        if (scope.root.readers) throw new Error("Nested local read still active")
        if (surfaces.some((surface) => !Bun.deepEquals(snapshots[surface].sfBlobGenerations ?? {}, generations[surface]))) throw new Error("Private blob generations changed outside storage")
        if (result.commit) {
          surfaces.forEach((surface) => {
            const payload = encodeSnapshot(snapshots[surface])
            decodeSnapshot(payload)
            db.query("INSERT INTO snapshots (surface, payload) VALUES (?, ?) ON CONFLICT (surface) DO UPDATE SET payload=excluded.payload").run(surface, payload)
          })
          transactionOptions?.signal?.throwIfAborted()
          db.exec("COMMIT")
        }
        return result.value
      }, transactionOptions?.signal),
    secrets: {
      put: (key, bytes, expiresAt) => operation(true, async (db) => {
        if (!Number.isFinite(expiresAt)) throw new Error("Invalid authentication expiry")
        db.query("INSERT INTO authentication_payloads (key, payload, expires_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET payload=excluded.payload, expires_at=excluded.expires_at").run(key, bytes, expiresAt)
        db.exec("COMMIT")
      }),
      // Authentication runs while the business writer owns the lock. This must never acquire a write lock, even for expired records.
      get: (key, at) => operation(false, async (db) => {
        if (!Number.isFinite(at)) throw new Error("Invalid authentication clock")
        const row = db.query<{ payload: Uint8Array }, [string, number]>("SELECT payload FROM authentication_payloads WHERE key = ? AND expires_at > ?").get(key, at)
        return row ? new Uint8Array(row.payload) : undefined
      }),
      take: (key, at) => operation(true, async (db) => {
        if (!Number.isFinite(at)) throw new Error("Invalid authentication clock")
        const row = db.query<{ payload: Uint8Array }, [string, number]>("SELECT payload FROM authentication_payloads WHERE key = ? AND expires_at > ?").get(key, at)
        db.query("DELETE FROM authentication_payloads WHERE key = ?").run(key)
        db.exec("COMMIT")
        return row ? new Uint8Array(row.payload) : undefined
      }),
      remove: (key) => operation(true, async (db) => {
        db.query("DELETE FROM authentication_payloads WHERE key = ?").run(key)
        db.exec("COMMIT")
      }),
    },
    dispose: () => {
      if (context.getStore()) return Promise.reject(new Error("Cannot dispose a store from its transaction scope"))
      lifecycle.closed = true
      lifecycle.disposing ??= Promise.allSettled([...active]).then(() => { materializations.clear() })
      return lifecycle.disposing
    },
  }
}

function waitForAdmission(previous: Promise<void>, timeout: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const finish = (error?: unknown) => {
      clearTimeout(timer)
      signal?.removeEventListener("abort", aborted)
      if (error !== undefined) { reject(error); return }
      resolve()
    }
    const aborted = () => finish(signal?.reason ?? new Error("Local storage operation aborted"))
    const timer = setTimeout(() => finish(new Error("Local storage lock timeout")), timeout)
    signal?.addEventListener("abort", aborted, { once: true })
    if (signal?.aborted) { aborted(); return }
    void previous.then(() => finish(), finish)
  })
}

function hasCode(error: unknown, code: string) {
  return typeof error === "object" && error !== null && "code" in error && error.code === code
}

async function retryLock(work: () => unknown, timeout: number, signal?: AbortSignal) {
  const deadline = performance.now() + timeout
  for (;;) {
    signal?.throwIfAborted()
    try {
      work()
      return
    } catch (error) {
      if (!hasCode(error, "SQLITE_BUSY") && !hasCode(error, "SQLITE_LOCKED") && !hasCode(error, "SQLITE_PROTOCOL")) throw error
      const remaining = deadline - performance.now()
      if (remaining <= 0) throw new Error("Local storage lock timeout", { cause: error })
      // Yield to the lock owner's awaited callback; SQLite's synchronous busy wait would block it.
      await new Promise<void>((resolve, reject) => {
        const aborted = () => {
          clearTimeout(timer)
          signal?.removeEventListener("abort", aborted)
          reject(signal?.reason ?? new Error("Local storage operation aborted"))
        }
        const timer = setTimeout(() => {
          signal?.removeEventListener("abort", aborted)
          resolve()
        }, Math.min(10, remaining))
        signal?.addEventListener("abort", aborted, { once: true })
        if (signal?.aborted) aborted()
      })
    }
  }
}

function encode(value: unknown, ancestors = new Set<object>()): unknown {
  if (value === undefined) return ["undefined"]
  if (value === null) return ["null"]
  if (typeof value === "boolean") return ["boolean", value]
  if (typeof value === "string") return ["string", value]
  if (typeof value === "number" && Number.isFinite(value)) return ["number", Object.is(value, -0) ? "-0" : value]
  if (typeof value !== "object") throw new Error("Unsupported local snapshot value")
  if (ancestors.has(value)) throw new Error("Cyclic local snapshot")
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
    throw new Error("Local snapshots require plain objects")
  if (Object.getOwnPropertySymbols(value).length) throw new Error("Unsupported symbol properties")
  ancestors.add(value)
  try {
    if (Array.isArray(value)) return ["array", Array.from(value, (item) => encode(item, ancestors))]
    return ["object", Object.entries(Object.getOwnPropertyDescriptors(value)).map(([key, descriptor]) => {
      if (!Object.hasOwn(descriptor, "value")) throw new Error("Unsupported snapshot accessor")
      return [key, encode(descriptor.value, ancestors)]
    })]
  } finally {
    ancestors.delete(value)
  }
}

function decode(value: unknown): unknown {
  if (!Array.isArray(value)) throw new Error("Corrupt local snapshot node")
  if (value.length === 1 && value[0] === "undefined") return undefined
  if (value.length === 1 && value[0] === "null") return null
  if (value.length !== 2) throw new Error("Corrupt local snapshot tuple")
  if (value[0] === "string" && typeof value[1] === "string") return value[1]
  if (value[0] === "boolean" && typeof value[1] === "boolean") return value[1]
  if (value[0] === "number" && value[1] === "-0") return -0
  if (value[0] === "number" && typeof value[1] === "number" && Number.isFinite(value[1])) return value[1]
  if (value[0] === "array" && Array.isArray(value[1])) return value[1].map((child: unknown) => decode(child))
  if (value[0] === "object" && Array.isArray(value[1])) {
    const entries: [string, unknown][] = value[1].map((entry: unknown) => {
      if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== "string") throw new Error("Corrupt local snapshot object")
      return [entry[0], decode(entry[1])]
    })
    if (new Set(entries.map(([key]) => key)).size !== entries.length) throw new Error("Duplicate local snapshot key")
    return Object.fromEntries(entries)
  }
  throw new Error("Corrupt local snapshot tag")
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

export function decodeSnapshot(payload: string): Snapshot {
  const envelope: unknown = JSON.parse(payload)
  if (!Array.isArray(envelope) || envelope.length !== 3 || envelope[0] !== "sucafina-snapshot" || envelope[1] !== 1)
    throw new Error("Unsupported local snapshot encoding")
  const value = decode(envelope[2])
  if (!record(value) || !record(value.data) || !record(value.versions) || !record(value.sequences) || !Array.isArray(value.audit) || !Array.isArray(value.notices))
    throw new Error("Corrupt local snapshot shape")
  if (value.sfBlobGenerations !== undefined && (!record(value.sfBlobGenerations) || !Object.values(value.sfBlobGenerations).every((generation) => Number.isSafeInteger(generation) && Number(generation) >= 0)))
    throw new Error("Corrupt local blob generations")
  if (!Object.values(value.versions).every((version) => record(version) && Number.isSafeInteger(version.version) && Number(version.version) >= 0 && typeof version.by === "string") ||
      !Object.values(value.sequences).every((sequence) => typeof sequence === "number" && Number.isFinite(sequence)) ||
      !value.audit.every((audit: unknown) => record(audit) && typeof audit.who === "string" && typeof audit.at === "string" && typeof audit.record === "string" && Object.hasOwn(audit, "was") && Object.hasOwn(audit, "became")) ||
      !value.notices.every((notice: unknown) => record(notice) && ["pending", "approved", "rejected", "supplier-pending"].includes(String(notice.kind)) && typeof notice.record === "string" && typeof notice.at === "string" && Array.isArray(notice.to) && notice.to.every((to: unknown) => typeof to === "string")))
    throw new Error("Corrupt local snapshot contents")
  return value as Snapshot
}

export function encodeSnapshot(snapshot: Snapshot): string {
  return JSON.stringify(["sucafina-snapshot", 1, encode(snapshot)])
}

// At most three entries and 16 MiB of UTF-16 string content per open store.
// These are optimization limits only: larger/deeper valid v1 snapshots keep
// using the original decoder. No new persisted format or acceptance limit.
const SNAPSHOT_MATERIALIZATION_UNITS = 8 * 1024 * 1024
type SnapshotMaterialization = Readonly<{ payload: string; json: string; missing: string; units: number }>

function planSnapshotMaterialization(snapshot: Snapshot, payload: string): SnapshotMaterialization | undefined {
  if (payload.length > SNAPSHOT_MATERIALIZATION_UNITS) return
  const parts: string[] = []
  const missing: string[] = []
  const path: string[] = []
  const budget = { units: payload.length + 2, nodes: 0 }
  const append = (text: string) => {
    budget.units += text.length
    if (budget.units > SNAPSHOT_MATERIALIZATION_UNITS) return false
    parts.push(text)
    return true
  }
  // The input has just passed decodeSnapshot: all nodes are normalized own
  // data, with no getters, custom prototypes, functions, aliases or cycles.
  // Emit JSON directly so a data property called toJSON is never invoked.
  const visit = (value: unknown): boolean => {
    if (++budget.nodes > 200000 || path.length > 128) return false
    if (value === undefined) {
      if (missing.length >= 4096) return false
      const location = JSON.stringify(path)
      budget.units += location.length + (missing.length ? 1 : 0)
      if (budget.units > SNAPSHOT_MATERIALIZATION_UNITS) return false
      missing.push(location)
      return append("null")
    }
    if (Object.is(value, -0)) return append("-0")
    if (value === null || typeof value !== "object") {
      const encoded = JSON.stringify(value)
      return typeof encoded === "string" && append(encoded)
    }
    const array = Array.isArray(value)
    if (!append(array ? "[" : "{")) return false
    const keys = Object.keys(value)
    for (let index = 0; index < keys.length; index++) {
      const key = keys[index]!
      if (index && !append(",")) return false
      if (!array && (!append(JSON.stringify(key)) || !append(":"))) return false
      path.push(key)
      const accepted = visit((value as Record<string, unknown>)[key])
      path.pop()
      if (!accepted) return false
    }
    return append(array ? "]" : "}")
  }
  if (!visit(snapshot)) return
  const json = parts.join("")
  const absent = "[" + missing.join(",") + "]"
  return Object.freeze({ payload, json, missing: absent, units: payload.length + json.length + absent.length })
}

function materializeSnapshot(plan: SnapshotMaterialization): Snapshot {
  const snapshot = JSON.parse(plan.json) as Snapshot
  // Null placeholders preserve property order and array density. Only these
  // known own paths need repair; -0 is preserved by its native JSON literal.
  if (plan.missing !== "[]") {
    const paths = JSON.parse(plan.missing) as string[][]
    for (const path of paths) {
      let parent: Record<string, unknown> = snapshot
      for (let index = 0; index < path.length - 1; index++) parent = parent[path[index]!] as Record<string, unknown>
      Object.defineProperty(parent, path[path.length - 1]!, { value: undefined, enumerable: true, writable: true, configurable: true })
    }
  }
  return snapshot
}
