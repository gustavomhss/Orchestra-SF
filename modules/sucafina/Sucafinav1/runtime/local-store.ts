import { sfLocalStoreCost, sfLocalStoreBranch } from "../product/host-binding/recall-observation-cost.ts"
import { Database } from "bun:sqlite"
import { AsyncLocalStorage } from "node:async_hooks"
import { createHash, randomUUID } from "node:crypto"
import { types } from "node:util"
import { constants, lstatSync } from "node:fs"
import { lstat, mkdir, open, realpath } from "node:fs/promises"
import { isAbsolute, join, parse, resolve, sep } from "node:path"
import type { LocalStore } from "./local-contract.ts"
import { createTeamProfilePolicyStore, initializeTeamProfilePolicy, teamProfilePolicyInitialization } from "./team-profile-store.ts"
import type { TeamProfilePolicyInitialization } from "./team-profile-store.ts"
import { createTeamConnectionStore, initializeTeamConnections } from "./team-connection-store.ts"
import type { Snapshot, TransactionOptions } from "./contract.ts"
import type { BlobTransaction } from "./assets.ts"
import type { Surface } from "../src/identity.ts"

export type ReadonlyAuthorityData<S extends Surface> = Readonly<{
  snapshots: Record<S, Pick<Snapshot, "data">>
  current: (requirement?: "unpoisoned") => boolean
  scope?: Readonly<{ identity: object; bytesIdentity?: object }>
}>

type AuthorityDataReader = <S extends Surface>(surfaces: readonly S[]) => ReadonlyAuthorityData<S> | undefined
// Only openLocalStore can register its own closed reader. This is neither an
// adapter capability nor an authorization cache; unknown owners stay legacy.
const readonlyAuthorityReaders = new WeakMap<object, AuthorityDataReader>()
type LocalSnapshotStability = Readonly<{
  mutable?: { surface: Surface; snapshot: Snapshot }
  current: () => boolean
}>
const snapshotStabilityReaders = new WeakMap<object, () => LocalSnapshotStability | undefined>()

/** Attest which snapshots cannot change inside the same live LocalStore root. */
export function observeLocalSnapshotStability(owner: object): LocalSnapshotStability | undefined {
  return snapshotStabilityReaders.get(owner)?.()
}
const snapshotReadPairs = new WeakMap<object, { single: object; present: () => boolean }>()

/** Both detached readers must come from the same LocalStore. */
export function hasPairedLocalSnapshotReads(owner: object) {
  if (types.isProxy(owner) || Object.getPrototypeOf(owner) !== Object.prototype) return false
  const single = Object.getOwnPropertyDescriptor(owner, "currentSnapshot")?.value
  const all = Object.getOwnPropertyDescriptor(owner, "currentSnapshots")?.value
  return typeof single === "function" && typeof all === "function" && snapshotReadPairs.get(all)?.single === single
}

/** Lexical presence through exact original reader methods, including native spreads. */
export function hasLocalSnapshotScope(owner: object): boolean | undefined {
  if (types.isProxy(owner) || Object.getPrototypeOf(owner) !== Object.prototype) return undefined
  const all = Object.getOwnPropertyDescriptor(owner, "currentSnapshots")?.value
  const present = Object.getOwnPropertyDescriptor(owner, "hasCurrentSnapshots")?.value
  const pair = typeof all === "function" ? snapshotReadPairs.get(all) : undefined
  return pair && pair.present === present ? pair.present() : undefined
}

export function currentLocalReadonlyAuthorityData<S extends Surface>(owner: object, surfaces: readonly S[]): ReadonlyAuthorityData<S> | undefined {
  return readonlyAuthorityReaders.get(owner)?.(surfaces)
}

type LocalTransactionAbort = {
  storageIdentity: string
  transactionId: string
  phase: "callback" | "callback-failed" | "callback-completed" | "rolled-back"
  error?: unknown
  consumed: boolean
}
const localTransactions = new WeakMap<Snapshot, LocalTransactionAbort>()
const localAbortObservations = new WeakMap<object, LocalTransactionAbort>()

/** Observe only an actual live SQLite callback. The returned capability has no writable fields. */
export function observeLocalTransactionAbort(snapshot: Snapshot): object | undefined {
  const transaction = localTransactions.get(snapshot)
  if (transaction?.phase !== "callback") return undefined
  const observation = Object.freeze({})
  localAbortObservations.set(observation, transaction)
  return observation
}

/** Only the original callback error after a confirmed rollback can consume this capability. */
export function consumeLocalTransactionAbort(observation: object, error: unknown) {
  const transaction = localAbortObservations.get(observation)
  localAbortObservations.delete(observation)
  if (!transaction || transaction.consumed || transaction.phase !== "rolled-back" || transaction.error !== error) return undefined
  transaction.consumed = true
  return Object.freeze({ storageIdentity: transaction.storageIdentity, transactionId: transaction.transactionId })
}

export async function openLocalStore(directory: string, options: {
  lockTimeoutMs?: number
  teamProfilePolicy?: TeamProfilePolicyInitialization
} = {}): Promise<LocalStore> {
  const teamPolicy = options.teamProfilePolicy && teamProfilePolicyInitialization(options.teamProfilePolicy)
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
  const databaseFile = await file.stat({ bigint: true }).then(async (opened) => {
    if (!opened.isFile() || opened.uid !== BigInt(uid) || (opened.mode & 0o077n) !== 0n || await realpath(path) !== path)
      throw new Error("Local database must be owned by the current UID at its real path")
    return { dev: opened.dev, ino: opened.ino, invalid: false }
  }).finally(() => file.close())
  const requireDatabaseFile = () => {
    return sfLocalStoreCost("file-guard", () => {
    const installed = !databaseFile.invalid && lstatSync(path, { bigint: true, throwIfNoEntry: false })
    if (!installed || !installed.isFile() || installed.uid !== BigInt(uid) || (installed.mode & 0o077n) !== 0n ||
      installed.dev !== databaseFile.dev || installed.ino !== databaseFile.ino) {
      databaseFile.invalid = true
      throw new Error("Local database identity changed; reopen the store")
    }
    })
  }

  const storageIdentity = createHash("sha256").update(JSON.stringify([path, Number(databaseFile.dev), Number(databaseFile.ino)])).digest("hex")

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
  requireDatabaseFile()
  const initial = connect()
  try {
    await retryLock(() => initial.exec("PRAGMA journal_mode=WAL"), timeout)
    await retryLock(() => initial.exec("BEGIN IMMEDIATE"), timeout)
    try {
      initial.exec(`
        CREATE TABLE IF NOT EXISTS snapshots (surface TEXT PRIMARY KEY, payload TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS blobs (surface TEXT NOT NULL, key TEXT NOT NULL, payload BLOB NOT NULL, type TEXT NOT NULL, PRIMARY KEY (surface, key));
        CREATE TABLE IF NOT EXISTS authentication_payloads (key TEXT PRIMARY KEY, payload BLOB NOT NULL, expires_at REAL NOT NULL);
      `)
      if (teamPolicy) {
        initializeTeamProfilePolicy(initial, teamPolicy)
        initializeTeamConnections(initial, teamPolicy.binding)
      }
      requireDatabaseFile()
      initial.exec("COMMIT")
    } finally {
      if (initial.inTransaction) initial.exec("ROLLBACK")
    }
  } finally {
    initial.close()
  }

  // This is a memo of the pure v1 decoder, not of a transaction or authority.
  // Every caller still observes SQL under the existing lock. Only immutable
  // strings survive requests; each demanded surface gets a fresh object graph.
  const materializations = new Map<Surface, SnapshotMaterialization>()
  const emptySnapshotIdentity = {}
  const observeSnapshot = (surface: Surface, payload?: string): {
    materialize: () => Snapshot
    copy?: () => Snapshot
    freshPlan?: { units: number; copy: () => Snapshot }
    copyAcl?: () => Snapshot["data"] | undefined
    bytesIdentity?: object
  } => {
    return sfLocalStoreCost("observe-snapshot", () => {
    const prior = materializations.get(surface)
    const codecCurrent = snapshotDecoderCurrent()
    const fingerprint = codecCurrent && payload !== undefined && payload.length > SNAPSHOT_MATERIALIZATION_UNITS &&
      payload.length <= SNAPSHOT_MATERIALIZATION_UNITS * 4
      ? sfLocalStoreCost("payload-fingerprint", () => createHash("sha256").update(payload, "utf16le").digest("hex")) : undefined
    if (payload !== undefined && prior && codecCurrent &&
        (prior.payload === payload || fingerprint !== undefined && prior.fingerprint === fingerprint && prior.payloadUnits === payload.length)) {
      const materialize = () => materializeSnapshot(prior, payload)
      const acl = prior.acl
      return { materialize, bytesIdentity: prior.identity,
        ...(prior.fingerprint ? {} : { copy: materialize }),
        ...(acl === undefined ? {} : { copyAcl: () => aclCodecCurrent() ? decodeSnapshot(acl).data : undefined }) }
    }
    materializations.delete(surface)
    if (payload === undefined) {
      const empty = (): Snapshot => ({ data: {}, versions: {}, sequences: {}, audit: [], notices: [] })
      return { materialize: empty, copy: empty, bytesIdentity: emptySnapshotIdentity }
    }
    const snapshot = decodeSnapshot(payload)
    const plan = planSnapshotMaterialization(snapshot, payload, fingerprint)
    if (plan) {
      const retained = { units: [...materializations.values()].reduce((sum, entry) => sum + entry.units, 0) }
      for (const [name, entry] of materializations) {
        if (retained.units + plan.units <= SNAPSHOT_MATERIALIZATION_UNITS && materializations.size < 3) break
        materializations.delete(name)
        retained.units -= entry.units
      }
      materializations.set(surface, plan)
    }
    return { materialize: () => snapshot, bytesIdentity: plan?.identity,
      ...(plan && !plan.fingerprint ? { freshPlan: { units: plan.units, copy: () => materializeSnapshot(plan, payload) } } : {}),
    }
    })
  }
  const loadSnapshot = (surface: Surface, payload?: string) => observeSnapshot(surface, payload).materialize()

  type SnapshotCopies = Partial<Record<Surface, () => Snapshot>>
  type AclCopies = Partial<Record<Surface, () => Snapshot["data"] | undefined>>
  const byteIdentities = new WeakMap<object, WeakMap<object, WeakMap<object, object>>>()
  const snapshotBytesIdentity = (keys: Partial<Record<Surface, object>>) => {
    const { dashboard, planner, procurement } = keys
    if (!dashboard || !planner || !procurement) return undefined
    const planners = byteIdentities.get(dashboard) ?? new WeakMap<object, WeakMap<object, object>>()
    const procurements = planners.get(planner) ?? new WeakMap<object, object>()
    const identity = procurements.get(procurement) ?? {}
    procurements.set(procurement, identity)
    planners.set(planner, procurements)
    byteIdentities.set(dashboard, planners)
    return identity
  }
  type ReadScope = {
    root: { identity: object; db: Database; snapshots: Partial<Record<Surface, Snapshot>>; copies?: SnapshotCopies; aclCopies?: AclCopies; bytesIdentity?: object; preimage?: { surface: Surface; current: () => boolean; snapshot: () => Snapshot }; poisoned: boolean; readers: number; readOnly?: true; mutableSurface?: Surface }
    parent?: ReadScope
    open: boolean
    signal?: AbortSignal
  }
  const context = new AsyncLocalStorage<ReadScope>()
  const rootIdentities = new WeakMap<object, object>()
  const preimages = new WeakSet<() => boolean>()
  const requireDashboardSource = (scope: ReadScope, identity: object) => {
    const preimage = Object.hasOwn(scope.root, "preimage") ? scope.root.preimage : undefined
    if (scope.root.poisoned || rootIdentities.get(scope.root) !== identity ||
      !(Object.hasOwn(scope.root, "readOnly") && scope.root.readOnly === true || preimage?.current() === true)) throw new Error("Local Dashboard source root changed")
    return preimage?.surface === "dashboard" ? preimage.snapshot() : scope.root.snapshots.dashboard
  }
  const dashboardSourceSnapshot = (scope: ReadScope, identity: object) => {
    return sfLocalStoreCost("dashboard-source-snapshot", () => {
    const snapshot = requireDashboardSource(scope, identity)
    if (!snapshot || Object.hasOwn(Object.prototype, "__sfProductV1")) throw new Error("Local Dashboard source view unavailable")
    // Persisted v1 data has no getters or aliases. Private product state and
    // audit are outside the installed Dashboard source projector's input.
    return structuredClone({ data: Object.fromEntries(Object.entries(snapshot.data).filter(([key]) => key !== "__sfProductV1")),
      versions: snapshot.versions, sfSources: snapshot.sfSources, sequences: {}, audit: [], notices: [] }) satisfies Snapshot
    })
  }
  const requireScope = (scope: ReadScope) => {
    return sfLocalStoreCost("scope-guard", () => {
    let current: ReadScope | undefined = scope
    while (current) {
      if (!current.open) throw new Error("Local transaction scope has ended")
      current.signal?.throwIfAborted()
      current = current.parent
    }
    requireDatabaseFile()
    })
  }
  const currentCopy = (scope: ReadScope, surface: Surface) =>
    Object.hasOwn(scope.root, "preimage") && scope.root.preimage?.surface === surface && !scope.root.preimage.current()
      ? undefined : scope.root.copies?.[surface]
  const copyCurrentSnapshot = (scope: ReadScope, surface: Surface): Snapshot => {
    return sfLocalStoreCost("copy-current", () => {
    const materialize = currentCopy(scope, surface)
    if (materialize) return sfLocalStoreBranch(0, () => materialize())
    const snapshot = scope.root.snapshots[surface]
    if (!snapshot) throw new Error("Local transaction snapshots unavailable")
    return sfLocalStoreBranch(1, () => cloneSnapshot(snapshot))
    })
  }
  const lifecycle = { closed: false, disposing: undefined as Promise<void> | undefined }
  const active = new Set<Promise<unknown>>()
  const queue = { tail: undefined as Promise<void> | undefined }
  // Only the serialized top-level writer borrows this connection. Each use
  // still acquires a new SQL lock and finishes its own transaction.
  const writer: { db?: Database } = {}
  const closeWriter = () => {
    const db = writer.db
    delete writer.db
    db?.close()
  }
  const acquireWriter = () => {
    try {
      requireDatabaseFile()
      return writer.db ??= connect()
    } catch (error) {
      closeWriter()
      throw error
    }
  }
  // Credential lookups use a separate autocommit connection and still execute
  // SQL on every call, including authority checks inside a business snapshot.
  const authReader: { db?: Database } = {}
  const closeAuthReader = () => {
    const db = authReader.db
    delete authReader.db
    db?.close()
  }
  const acquireAuthReader = () => {
    try {
      requireDatabaseFile()
      return authReader.db ??= new Database(path, { readonly: true, strict: true })
    } catch (error) {
      closeAuthReader()
      throw error
    }
  }
  const abortRoots = new WeakMap<Database, LocalTransactionAbort>()
  const operation = <T>(write: boolean, work: (db: Database) => Promise<T>, signal?: AbortSignal): Promise<T> => {
    if (lifecycle.closed) {
      const scope = context.getStore()
      // An admitted readonly root may drain during disposal, but a rejected
      // write must not disappear when its caller catches the disposed error.
      if (write && scope?.root.readOnly) scope.root.poisoned = true
      return Promise.reject(new Error("Local store is disposed"))
    }
    const inherited = context.getStore()
    if (inherited) {
      try {
        requireScope(inherited)
        signal?.throwIfAborted()
        if (write) {
          inherited.root.poisoned = true
          throw new Error("Nested local writes are forbidden")
        }
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
      const db = write ? acquireWriter() : acquireAuthReader()
      const status = { completed: false }
      const failure: { failed: boolean; error?: unknown } = { failed: false }
      try {
        if (write) {
          await retryLock(() => db.exec("BEGIN IMMEDIATE"), Math.max(0, deadline - performance.now()), signal)
          requireDatabaseFile()
        }
        signal?.throwIfAborted()
        const value = await work(db)
        if (!write && db.inTransaction) throw new Error("Local authentication read opened a transaction")
        if (inherited) requireScope(inherited)
        requireDatabaseFile()
        status.completed = true
        return value
      } catch (error) {
        failure.failed = true
        failure.error = error
        throw error
      } finally {
        const rollback = { confirmed: false }
        try {
          try {
            if (write && db.inTransaction) {
              db.exec("ROLLBACK")
              rollback.confirmed = true
            }
          } catch (error) {
            status.completed = false
            throw error
          } finally {
            if (write && !status.completed) closeWriter()
            if (!write && !status.completed && authReader.db === db) closeAuthReader()
          }
          const transaction = abortRoots.get(db)
          // Serialization/COMMIT failures and errors thrown after the callback
          // returned never receive this provenance, even if SQL rolls back.
          if (rollback.confirmed && failure.failed && transaction?.phase === "callback-failed" && transaction.error === failure.error)
            transaction.phase = "rolled-back"
        } finally {
          abortRoots.delete(db)
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

  const hasCurrentSnapshots = () => {
    const scope = context.getStore()
    if (!scope) return false
    requireScope(scope)
    return true
  }
  const teamProfiles = teamPolicy && createTeamProfilePolicyStore({
    binding: teamPolicy.binding,
    read: (work) => operation(false, async (db) => work(db)),
    write: (work, signal) => operation(true, work, signal),
    commit: (db) => {
      requireDatabaseFile()
      db.exec("COMMIT")
    },
  })
  const teamConnections = teamPolicy && createTeamConnectionStore({
    binding: teamPolicy.binding,
    locked: (work, signal) => operation(true, work, signal),
    // Only current credential/policy reads are admitted here. Business authority is
    // observed by the session producer in the already-held, separate Team partition.
    authorityRead: async (db, work, signal) => {
      if (context.getStore() || !db.inTransaction) throw new Error("Invalid private connection authority scope")
      const scope: ReadScope = { root: { identity: {}, db, snapshots: {}, poisoned: false, readers: 0, readOnly: true }, open: true, signal }
      try {
        const result = await context.run(scope, work)
        requireScope(scope)
        if (scope.root.poisoned) throw new Error("Nested local write attempted")
        if (scope.root.readers) throw new Error("Nested local read still active")
        return result
      } finally { scope.open = false }
    },
    commit: (db) => {
      requireDatabaseFile()
      db.exec("COMMIT")
    },
  })
  const store: LocalStore = {
    ...(teamProfiles ? { teamProfiles } : {}),
    ...(teamConnections ? { teamConnections } : {}),
    hasSnapshotRoot: hasCurrentSnapshots,
    holdTargetPreimage: () => {
      const state = { active: true }
      const current = () => state.active
      preimages.add(current)
      return Object.freeze({ current, release: () => { state.active = false } })
    },
    observeAuthority: (surfaces) => {
      const scope = context.getStore()
      if (!scope) return undefined
      const fields = snapshotAclFields
      const absent = new Set<string>()
      const sealed = () => Object.hasOwn(scope.root, "readOnly") && scope.root.readOnly === true ||
        Object.hasOwn(scope.root, "preimage") && scope.root.preimage?.current() === true
      const active = () => {
        requireScope(scope)
        return context.getStore() === scope && !scope.root.poisoned && sealed()
      }
      requireScope(scope)
      if (!sealed()) return undefined
      if (scope.root.poisoned) throw new Error("Local transaction is poisoned")
      const entries = surfaces.map((surface) => {
        const preimage = Object.hasOwn(scope.root, "preimage") ? scope.root.preimage : undefined
        const copiedAcl = scope.root.aclCopies?.[surface]?.()
        const data = copiedAcl ?? (preimage?.surface === surface ? preimage.snapshot() : scope.root.snapshots[surface])?.data
        if (!data || Object.getPrototypeOf(data) !== Object.prototype) return undefined
        const selected = fields.map((name) => [name, Object.getOwnPropertyDescriptor(data, name)] as const)
        if (selected.some(([name, descriptor]) => descriptor ? !Object.hasOwn(descriptor, "value") : name in data)) return undefined
        return [surface, { data: Object.fromEntries(selected.flatMap(([name, descriptor]) => {
          if (descriptor) return [[name, copiedAcl ? descriptor.value : copyValue(descriptor.value)]]
          absent.add(name)
          return []
        })) }] as const
      })
      if (entries.some((entry) => !entry)) return undefined
      const snapshots = Object.fromEntries(entries.filter((entry) => entry !== undefined)) as Record<(typeof surfaces)[number], Pick<Snapshot, "data">>
      const identity = rootIdentities.get(scope.root) ?? {}
      rootIdentities.set(scope.root, identity)
      const validity = { current: true }
      const bytesIdentity = snapshotDecoderCurrent() ? scope.root.bytesIdentity : undefined
      return { snapshots, identity, bytesIdentity, current: () => {
        validity.current &&= active() && (!scope.root.bytesIdentity || snapshotDecoderCurrent()) && [...absent].every((name) => !Object.hasOwn(Object.prototype, name))
        return validity.current
      } }
    },
    readSnapshotRoot: <T>(work: () => Promise<T>, transactionOptions?: TransactionOptions) =>
      operation(true, async (db) => {
        const copies: SnapshotCopies = {}
        const aclCopies: AclCopies = {}
        const byteKeys: Partial<Record<Surface, object>> = {}
        // Initial memo hits can outlive eviction in this root. Reserve their
        // budget before taking fresh plans for repeated reads of cold surfaces.
        const budget = { remaining: SNAPSHOT_MATERIALIZATION_UNITS - [...materializations.values()].reduce((sum, plan) => sum + plan.units, 0) }
        const read = (surface: Surface) => {
          const row = sfLocalStoreCost("snapshot-sql", () => db.query<{ payload: string }, [string]>("SELECT payload FROM snapshots WHERE surface = ?").get(surface))
          // Keep the same SQL order and changed-payload admission as mutable
          // roots. No callback receives this root's authoritative graphs.
          const source = observeSnapshot(surface, row?.payload)
          byteKeys[surface] = source.bytesIdentity
          if (source.copy) copies[surface] = source.copy
          if (source.copyAcl) aclCopies[surface] = source.copyAcl
          const plan = source.freshPlan
          if (plan && plan.units <= budget.remaining) {
            budget.remaining -= plan.units
            // This path replaces cloneSnapshot, including its current shape checks.
            copies[surface] = () => validateSnapshot(plan.copy())
          }
          const observed: { materialize?: () => Snapshot; value?: Snapshot } = { materialize: source.materialize }
          return () => {
            if (observed.value) return observed.value
            observed.value = observed.materialize!()
            observed.materialize = undefined
            return observed.value
          }
        }
        const observed = { dashboard: read("dashboard"), planner: read("planner"), procurement: read("procurement") }
        const snapshots = {
          get dashboard() { return observed.dashboard() }, get planner() { return observed.planner() },
          get procurement() { return observed.procurement() },
        }
        const scope: ReadScope = { root: { identity: {}, db, snapshots, copies, aclCopies, bytesIdentity: snapshotBytesIdentity(byteKeys), poisoned: false, readers: 0, readOnly: true }, open: true, signal: transactionOptions?.signal }
        try {
          const value = await context.run(scope, work)
          requireScope(scope)
          if (scope.root.poisoned) throw new Error("Nested local write attempted")
          if (scope.root.readers) throw new Error("Nested local read still active")
          return value
        } finally {
          scope.open = false
          // This root never exposes its private observations. Closed descendants
          // need neither their graphs/getters nor the initial memo's copy plans.
          scope.root.snapshots = {}
          delete copies.dashboard
          delete copies.planner
          delete copies.procurement
          delete aclCopies.dashboard
          delete aclCopies.planner
          delete aclCopies.procurement
        }
      }, transactionOptions?.signal),
    currentSnapshotScope: () => {
      const scope = context.getStore()
      if (!scope) return undefined
      requireScope(scope)
      return { identity: scope.root.identity, bytesIdentity: snapshotDecoderCurrent() ? scope.root.bytesIdentity : undefined, readOnly: scope.root.readOnly === true, poisoned: scope.root.poisoned }
    },
    hasCurrentSnapshots,
    currentSnapshots: () => {
      return sfLocalStoreCost("current-snapshots", () => {
      const scope = context.getStore()
      if (!scope) return undefined
      requireScope(scope)
      return { dashboard: copyCurrentSnapshot(scope, "dashboard"), planner: copyCurrentSnapshot(scope, "planner"),
        procurement: copyCurrentSnapshot(scope, "procurement") }
      })
    },
    currentSnapshot: (surface) => {
      const scope = context.getStore()
      if (!scope) return undefined
      requireScope(scope)
      return copyCurrentSnapshot(scope, surface)
    },
    transaction: <T>(surface: Surface, work: (snapshot: Snapshot, blobs: BlobTransaction) => Promise<{ commit: boolean; value: T }>, transactionOptions?: TransactionOptions) => {
      const parent = context.getStore()
      if (parent) return (async () => {
        if (lifecycle.closed) {
          // No callback can be admitted after disposal to establish read-only
          // intent. Invalidate only the new readonly root, not mutable roots.
          if (parent.root.readOnly) parent.root.poisoned = true
          throw new Error("Local store is disposed")
        }
        requireScope(parent)
        transactionOptions?.signal?.throwIfAborted()
        const scope: ReadScope = { root: parent.root, parent, open: true, signal: transactionOptions?.signal }
        const sourceRoot = transactionOptions?.dashboardSourceRoot
        const aclRoot = transactionOptions?.dashboardAclRoot
        if ((sourceRoot || aclRoot) && surface !== "dashboard") throw new Error("Local Dashboard source surface changed")
        const materialize = sourceRoot || aclRoot ? undefined : currentCopy(parent, surface)
        const staged = sourceRoot || aclRoot || materialize ? undefined : parent.root.snapshots[surface]
        const row = sourceRoot || aclRoot || materialize || staged ? undefined : sfLocalStoreCost("snapshot-sql", () => parent.root.db.query<{ payload: string }, [string]>("SELECT payload FROM snapshots WHERE surface = ?").get(surface))
        if (aclRoot && (parent.root.poisoned || !parent.root.readOnly || rootIdentities.get(parent.root) !== aclRoot))
          throw new Error("Local Dashboard ACL root changed")
        // The callback obtains ACL fields separately via observeAuthority.
        const snapshot: Snapshot = sfLocalStoreCost("nested-snapshot", () => aclRoot ? sfLocalStoreBranch(2, () => ({ data: {}, versions: {}, sequences: {}, audit: [], notices: [] }))
          : sourceRoot ? sfLocalStoreBranch(3, () => dashboardSourceSnapshot(parent, sourceRoot))
          : materialize ? sfLocalStoreBranch(4, () => materialize()) : staged ? sfLocalStoreBranch(5, () => cloneSnapshot(staged)) : sfLocalStoreBranch(6, () => loadSnapshot(surface, row?.payload)))
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
          if (sourceRoot) requireDashboardSource(scope, sourceRoot)
          return result.value
        } finally {
          scope.open = false
          scope.root.readers--
        }
      })()
      return operation(true, async (db) => {
        const copies: SnapshotCopies = {}
        const aclCopies: AclCopies = {}
        const byteKeys: Partial<Record<Surface, object>> = {}
        if (transactionOptions?.dashboardSourceRoot || transactionOptions?.dashboardAclRoot) throw new Error("Local Dashboard source read needs a held root")
        const candidate = transactionOptions?.targetPreimageCurrent
        const currentPreimage = candidate && preimages.delete(candidate) && candidate() ? candidate : undefined
        const budget = currentPreimage && {
          remaining: SNAPSHOT_MATERIALIZATION_UNITS - [...materializations.values()].reduce((sum, plan) => sum + plan.units, 0),
        }
        const read = (name: Surface) => {
          const row = sfLocalStoreCost("snapshot-sql", () => db.query<{ payload: string }, [string]>("SELECT payload FROM snapshots WHERE surface = ?").get(name))
          // Ordinary single-surface transactions keep dev's lazy observation
          // of unrelated surfaces. A preimage additionally needs a full seal.
          const prior = materializations.get(name)
          if (!currentPreimage && name !== surface && (!prior || prior.payload !== row?.payload)) {
            const observed: { value?: Snapshot } = {}
            return () => observed.value ??= loadSnapshot(name, row?.payload)
          }
          const source = observeSnapshot(name, row?.payload)
          byteKeys[name] = source.bytesIdentity
          if (name !== surface || currentPreimage) {
            if (source.copy) copies[name] = source.copy
            if (source.copyAcl) aclCopies[name] = source.copyAcl
            const plan = source.freshPlan
            // Use the cold byte plan for sealed preimages, as in a read-only
            // root. Each callback still receives an independent detached copy.
            if (budget && !source.copy && plan && plan.units <= budget.remaining) {
              budget.remaining -= plan.units
              copies[name] = () => validateSnapshot(plan.copy())
            }
          }
          const observed: { materialize?: () => Snapshot; value?: Snapshot } = { materialize: source.materialize }
          return () => {
            if (observed.value) return observed.value
            observed.value = observed.materialize!()
            observed.materialize = undefined
            return observed.value
          }
        }
        const observed = { dashboard: read("dashboard"), planner: read("planner"), procurement: read("procurement") }
        // Only the target escapes to the callback and stays mutable.
        const snapshots = {
          get dashboard() { return observed.dashboard() }, get planner() { return observed.planner() },
          get procurement() { return observed.procurement() },
        }
        const snapshot = snapshots[surface]
        // If no byte plan is available, capture a private preimage before
        // handing the writable snapshot to its owner.
        const preimage = currentPreimage && (() => {
          const materialize = copies[surface]
          if (materialize) {
            const held: { snapshot?: Snapshot } = {}
            return () => held.snapshot ??= materialize()
          }
          const held = cloneSnapshot(snapshot)
          copies[surface] = () => cloneSnapshot(held)
          return () => held
        })()
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
        const scope: ReadScope = { root: { identity: {}, db, snapshots, copies, aclCopies, bytesIdentity: snapshotBytesIdentity(byteKeys), mutableSurface: surface, ...(currentPreimage && preimage ? { preimage: { surface, current: currentPreimage, snapshot: preimage } } : {}), poisoned: false, readers: 0 }, open: true, signal: transactionOptions?.signal }
        const requireOpen = () => {
          requireScope(scope)
          if (context.getStore() !== scope) throw new Error("Blob capability used outside its transaction scope")
        }
        const requireWritable = () => {
          requireScope(scope)
          if (transactionOptions?.sealedRead) {
            scope.root.poisoned = true
            throw new Error("Blob writes are forbidden in a sealed read")
          }
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
            requireDatabaseFile()
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
            requireDatabaseFile()
            db.query("DELETE FROM blobs WHERE surface = ? AND key = ?").run(surface, key)
            recordGeneration(key, generation)
          },
        }
        const result = await (async () => {
          try {
            return await context.run(scope, () => work(snapshot, blobs))
          } finally {
            scope.open = false
            scope.root.snapshots = {}
            delete scope.root.copies
            delete scope.root.preimage
            delete scope.root.aclCopies
          }
        })()
        transactionOptions?.signal?.throwIfAborted()
        if (scope.root.poisoned) throw new Error("Nested local write attempted")
        if (scope.root.readers) throw new Error("Nested local read still active")
        checkGenerations()
        if (result.commit) {
          requireDatabaseFile()
          if (transactionOptions?.sealedRead) throw new Error("Local sealed read attempted a write")
          if (currentPreimage?.()) throw new Error("Local target preimage must be released before publication")
          const payload = encodeSnapshot(snapshot)
          decodeSnapshot(payload)
          requireDatabaseFile()
          db.query("INSERT INTO snapshots (surface, payload) VALUES (?, ?) ON CONFLICT (surface) DO UPDATE SET payload=excluded.payload").run(surface, payload)
          transactionOptions?.signal?.throwIfAborted()
          requireDatabaseFile()
          db.exec("COMMIT")
        }
        return result.value
      }, transactionOptions?.signal)
    },
    transactionAll: <T>(work: (snapshots: Record<Surface, Snapshot>) => Promise<{ commit: boolean; value: T }>, transactionOptions?: TransactionOptions) =>
      operation(true, async (db) => {
        const surfaces: readonly Surface[] = ["dashboard", "planner", "procurement"]
        const read = (surface: Surface) => {
          const row = sfLocalStoreCost("snapshot-sql", () => db.query<{ payload: string }, [string]>("SELECT payload FROM snapshots WHERE surface = ?").get(surface))
          return loadSnapshot(surface, row?.payload)
        }
        const snapshots = { dashboard: read("dashboard"), planner: read("planner"), procurement: read("procurement") }
        const generations = Object.fromEntries(surfaces.map((surface) => [surface, structuredClone(snapshots[surface].sfBlobGenerations ?? {})]))
        const scope: ReadScope = { root: { identity: {}, db, snapshots, poisoned: false, readers: 0 }, open: true, signal: transactionOptions?.signal }
        const transaction: LocalTransactionAbort = { storageIdentity, transactionId: randomUUID(), phase: "callback", consumed: false }
        abortRoots.set(db, transaction)
        surfaces.forEach((surface) => localTransactions.set(snapshots[surface], transaction))
        const result = await (async () => {
          try {
            const result = await context.run(scope, () => work(snapshots))
            transaction.phase = "callback-completed"
            return result
          } catch (error) {
            transaction.phase = "callback-failed"
            transaction.error = error
            throw error
          } finally {
            scope.open = false
            surfaces.forEach((surface) => localTransactions.delete(snapshots[surface]))
            scope.root.snapshots = {}
          }
        })()
        transactionOptions?.signal?.throwIfAborted()
        if (scope.root.poisoned) throw new Error("Nested local write attempted")
        if (scope.root.readers) throw new Error("Nested local read still active")
        if (surfaces.some((surface) => !Bun.deepEquals(snapshots[surface].sfBlobGenerations ?? {}, generations[surface]))) throw new Error("Private blob generations changed outside storage")
        if (result.commit) {
          requireDatabaseFile()
          surfaces.forEach((surface) => {
            const payload = encodeSnapshot(snapshots[surface])
            decodeSnapshot(payload)
            requireDatabaseFile()
            db.query("INSERT INTO snapshots (surface, payload) VALUES (?, ?) ON CONFLICT (surface) DO UPDATE SET payload=excluded.payload").run(surface, payload)
          })
          transactionOptions?.signal?.throwIfAborted()
          requireDatabaseFile()
          db.exec("COMMIT")
        }
        return result.value
      }, transactionOptions?.signal),
    secrets: {
      put: (key, bytes, expiresAt) => operation(true, async (db) => {
        if (!Number.isFinite(expiresAt)) throw new Error("Invalid authentication expiry")
        db.query("INSERT INTO authentication_payloads (key, payload, expires_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET payload=excluded.payload, expires_at=excluded.expires_at").run(key, bytes, expiresAt)
        requireDatabaseFile()
        db.exec("COMMIT")
      }),
      // Authentication runs while the business writer owns the lock. This must never acquire a write lock, even for expired records.
      get: (key, at) => operation(false, async (db) => {
        if (!Number.isFinite(at)) throw new Error("Invalid authentication clock")
        const row = db.query<{ payload: Uint8Array }, [string, number]>("SELECT payload FROM authentication_payloads WHERE key = ? AND expires_at > ?").get(key, at)
        return row ? new Uint8Array(row.payload) : undefined
      }),
      getActive: (key, revokedKey, at) => operation(false, async (db) => {
        if (!Number.isFinite(at)) throw new Error("Invalid authentication clock")
        const row = db.query<{ payload: Uint8Array }, [string, number, string, number]>(`
          SELECT payload FROM authentication_payloads
          WHERE key = ? AND expires_at > ?
            AND NOT EXISTS (SELECT 1 FROM authentication_payloads WHERE key = ? AND expires_at > ?)
        `).get(key, at, revokedKey, at)
        return row ? new Uint8Array(row.payload) : undefined
      }),
      issueLogin: (namespace, key, bytes, at, expiresAt) => operation(true, async (db) => {
        if (!Number.isFinite(at) || !Number.isFinite(expiresAt) || expiresAt <= at) throw new Error("Invalid authentication expiry")
        const prefix = namespace + ":"
        db.query("DELETE FROM authentication_payloads WHERE key GLOB ? AND expires_at <= ?").run(prefix + "*", at)
        const result = db.query(`
          INSERT INTO authentication_payloads (key, payload, expires_at)
          SELECT ?, ?, ?
          WHERE (SELECT count(*) FROM authentication_payloads WHERE key GLOB ?) < 100
          ON CONFLICT (key) DO NOTHING
        `).run(key, bytes, expiresAt, prefix + "login:*")
        requireDatabaseFile()
        db.exec("COMMIT")
        return result.changes === 1
      }),
      retireSession: (key, revokedKey, at) => operation(true, async (db) => {
        if (!Number.isFinite(at)) throw new Error("Invalid authentication clock")
        const retired = db.query<{ expires_at: number }, [string, number]>(
          "DELETE FROM authentication_payloads WHERE key = ? AND expires_at > ? RETURNING expires_at",
        ).get(key, at)
        if (retired) db.query(`
          INSERT INTO authentication_payloads (key, payload, expires_at) VALUES (?, ?, ?)
          ON CONFLICT (key) DO UPDATE SET expires_at = max(authentication_payloads.expires_at, excluded.expires_at)
        `).run(revokedKey, new Uint8Array([1]), retired.expires_at)
        requireDatabaseFile()
        db.exec("COMMIT")
      }),
      refreshSession: (key, revokedKey, expected, bytes, at) => operation(true, async (db) => {
        if (!Number.isFinite(at)) throw new Error("Invalid authentication clock")
        db.query(`
          UPDATE authentication_payloads SET payload = ?
          WHERE key = ? AND payload = ? AND expires_at > ?
            AND NOT EXISTS (SELECT 1 FROM authentication_payloads WHERE key = ? AND expires_at > ?)
        `).run(bytes, key, expected, at, revokedKey, at)
        requireDatabaseFile()
        db.exec("COMMIT")
      }),
      take: (key, at) => operation(true, async (db) => {
        if (!Number.isFinite(at)) throw new Error("Invalid authentication clock")
        const row = db.query<{ payload: Uint8Array }, [string, number]>("SELECT payload FROM authentication_payloads WHERE key = ? AND expires_at > ?").get(key, at)
        db.query("DELETE FROM authentication_payloads WHERE key = ?").run(key)
        requireDatabaseFile()
        db.exec("COMMIT")
        return row ? new Uint8Array(row.payload) : undefined
      }),
      remove: (key) => operation(true, async (db) => {
        db.query("DELETE FROM authentication_payloads WHERE key = ?").run(key)
        requireDatabaseFile()
        db.exec("COMMIT")
      }),
    },
    dispose: () => {
      if (context.getStore()) return Promise.reject(new Error("Cannot dispose a store from its transaction scope"))
      lifecycle.closed = true
      lifecycle.disposing ??= Promise.allSettled([...active]).then(() => {
        try { closeWriter() } finally {
          try { closeAuthReader() } finally { materializations.clear() }
        }
      })
      return lifecycle.disposing
    },
  }
  if (store.currentSnapshots && store.currentSnapshot && store.hasCurrentSnapshots)
    snapshotReadPairs.set(store.currentSnapshots, { single: store.currentSnapshot, present: store.hasCurrentSnapshots })
  const methods = ["currentSnapshots", "currentSnapshot", "hasCurrentSnapshots", "transaction", "transactionAll", "readSnapshotRoot", "currentSnapshotScope"] as const
  const original = methods.map((name) => Object.getOwnPropertyDescriptor(store, name)?.value)
  const sameStore = () => !types.isProxy(store) && Object.getPrototypeOf(store) === Object.prototype &&
    methods.every((name, index) => {
      const descriptor = Object.getOwnPropertyDescriptor(store, name)
      return descriptor && Object.hasOwn(descriptor, "value") && descriptor.value === original[index]
    })
  snapshotStabilityReaders.set(store, () => {
    const scope = context.getStore()
    if (!scope) return undefined
    requireScope(scope)
    const root = scope.root
    const mutable = Object.hasOwn(root, "mutableSurface") ? root.mutableSurface : undefined
    const readonly = Object.hasOwn(root, "readOnly") && root.readOnly === true
    // transactionAll exposes all surfaces, and a target preimage may switch
    // the view of the owning callback. Keep both on the complete observation.
    if (!(readonly || mutable) || root.poisoned || Object.hasOwn(root, "preimage") || !sameStore() || !snapshotDecoderCurrent()) return undefined
    if (!root.snapshots.dashboard || !root.snapshots.planner || !root.snapshots.procurement)
      throw new Error("Local transaction snapshots unavailable")
    const current = () => {
      if (context.getStore() !== scope || scope.root !== root || root.poisoned || Object.hasOwn(root, "preimage") ||
          !sameStore() || !snapshotDecoderCurrent()) return false
      requireScope(scope)
      return true
    }
    return Object.freeze({ current, ...(mutable ? { mutable: { surface: mutable, snapshot: copyCurrentSnapshot(scope, mutable) } } : {}) })
  })
  readonlyAuthorityReaders.set(store, <S extends Surface>(surfaces: readonly S[]): ReadonlyAuthorityData<S> | undefined => {
    const scope = context.getStore()
    if (!scope) return undefined
    // Match currentSnapshots exactly: an ended/aborted known scope is an error,
    // not an unsupported optimization. Poison and dispose retain their original
    // transaction/root egress checks and do not suppress authentication callbacks.
    requireScope(scope)
    if (!Object.hasOwn(scope.root, "readOnly") || scope.root.readOnly !== true || !sameStore()) return undefined
    const fields = ["roleMap", "access"] as const
    const observed = surfaces.map((surface) => {
      const snapshot = scope.root.snapshots[surface]
      if (!snapshot) throw new Error("Local transaction snapshots unavailable")
      const data = snapshot.data
      if (Object.getPrototypeOf(data) !== Object.prototype) return undefined
      const descriptors = fields.map((field) => Object.getOwnPropertyDescriptor(data, field))
      // A getter inherited by an absent field would observe the full data
      // receiver. Keep that path on full copies, without invoking the getter here.
      if (descriptors.some((descriptor, index) => descriptor ? !(Object.hasOwn(descriptor, "value")) :
        Object.getOwnPropertyDescriptor(Object.prototype, fields[index]!) !== undefined)) return undefined
      return { surface, data, descriptors }
    })
    if (observed.some((entry) => !entry)) return undefined
    const admitted = observed.filter((entry) => entry !== undefined)
    // The private graph cannot be mutated by callbacks. Retain only absence
    // names for inherited-property drift; no data/descriptor value survives in
    // this closure independently of the scope that clears its graphs on close.
    const absent = fields.filter((_field, index) => admitted.some((entry) => !entry.descriptors[index]))
    const integrity = { failed: false }
    const bytesIdentity = snapshotDecoderCurrent() ? scope.root.bytesIdentity : undefined
    const current = (requirement?: "unpoisoned") => {
      requireScope(scope)
      if (integrity.failed) return false
      const valid = context.getStore() === scope && (requirement !== "unpoisoned" || !scope.root.poisoned) && sameStore() &&
        (!scope.root.bytesIdentity || snapshotDecoderCurrent()) && absent.every((field) => Object.getOwnPropertyDescriptor(Object.prototype, field) === undefined)
      if (!valid) integrity.failed = true
      return valid
    }
    const snapshots = Object.fromEntries(admitted.map((entry) => [entry.surface, {
      // The normalized private root never escapes. Every invocation copies the
      // complete ACL subtrees afresh, preserving absent fields and nested values.
      data: Object.fromEntries(fields.flatMap((field, index) => {
        const descriptor = entry.descriptors[index]
        return descriptor ? [[field, copyValue(descriptor.value, new Set())]] : []
      })),
    }])) as Record<S, Pick<Snapshot, "data">>
    return surfaces.length === 0
      ? { snapshots, current, scope: { identity: scope.root.identity, bytesIdentity } }
      : { snapshots, current }
  })
  return store
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
  return sfLocalStoreCost("decode-snapshot", () => {
  const envelope: unknown = JSON.parse(payload)
  if (!Array.isArray(envelope) || envelope.length !== 3 || envelope[0] !== "sucafina-snapshot" || envelope[1] !== 1)
    throw new Error("Unsupported local snapshot encoding")
  return validateSnapshot(decode(envelope[2]))
  })
}

/** Match the wire codec's normalized tree without allocating tagged nodes or JSON text. */
function cloneSnapshot(snapshot: Snapshot): Snapshot {
  return sfLocalStoreCost("clone-snapshot", () => {
  return validateSnapshot(sfLocalStoreCost("clone-tree", () => copyValue(snapshot)))
  })
}

function copyValue(value: unknown, ancestors = new Set<object>()): unknown {
  if (value === undefined || value === null || typeof value === "boolean" || typeof value === "string") return value
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value !== "object") throw new Error("Unsupported local snapshot value")
  if (ancestors.has(value)) throw new Error("Cyclic local snapshot")
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
    throw new Error("Local snapshots require plain objects")
  if (Object.getOwnPropertySymbols(value).length) throw new Error("Unsupported symbol properties")
  ancestors.add(value)
  try {
    // Array.from densifies holes; each path is copied separately, including shared aliases.
    if (Array.isArray(value)) return Array.from(value, (item) => copyValue(item, ancestors))
    const descriptors = Object.getOwnPropertyDescriptors(value)
    return Object.fromEntries(Object.keys(descriptors).map((key) => {
      const descriptor = descriptors[key]!
      if (!Object.hasOwn(descriptor, "value")) throw new Error("Unsupported snapshot accessor")
      return [key, copyValue(descriptor.value, ancestors)]
    }))
  } finally {
    ancestors.delete(value)
  }
}

function validateSnapshot(value: unknown): Snapshot {
  return sfLocalStoreCost("validate-snapshot", () => {
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
  })
}

export function encodeSnapshot(snapshot: Snapshot): string {
  return JSON.stringify(["sucafina-snapshot", 1, encode(snapshot)])
}

// The shared memo retains at most three entries and 16 MiB of UTF-16 strings.
// The plans held by a root stay within one additional memo budget after
// eviction. A readonly root reserves space for its initial hits and only uses
// the available space for fresh plans. Its copy factories are cleared on exit.
// The bound counts string content, not decoded graphs, overhead or total heap.
// A plan without room for a copy uses the original decoder. A larger SQL
// value can retain a SHA-256 fingerprint and its small ACL representation
// without retaining the value itself. Each root hashes its own observed bytes.
// Never retain an oversized SQL value in the memo or in a root copy plan.
// Active roots use the original decoder and independently detach their copies.
// No persisted format or acceptance limit changes.
const SNAPSHOT_MATERIALIZATION_UNITS = 8 * 1024 * 1024
const snapshotAclFields = ["roleMap", "access"] as const
const aclCodec = { stringify: JSON.stringify, parse: JSON.parse, map: Array.prototype.map }
const snapshotDecoder = {
  fromEntries: Object.fromEntries, keys: Object.keys, defineProperty: Object.defineProperty,
  isArray: Array.isArray, isFinite: Number.isFinite, Set, slice: String.prototype.slice, indexOf: String.prototype.indexOf,
}

function snapshotDecoderCurrent() {
  return aclCodecCurrent() && Object.fromEntries === snapshotDecoder.fromEntries && Object.keys === snapshotDecoder.keys &&
    Object.defineProperty === snapshotDecoder.defineProperty && Array.isArray === snapshotDecoder.isArray &&
    Number.isFinite === snapshotDecoder.isFinite && Set === snapshotDecoder.Set &&
    String.prototype.slice === snapshotDecoder.slice && String.prototype.indexOf === snapshotDecoder.indexOf
}
function aclCodecCurrent() {
  return JSON.stringify === aclCodec.stringify && JSON.parse === aclCodec.parse && Array.prototype.map === aclCodec.map &&
    !Object.getOwnPropertyDescriptor(Array.prototype, "toJSON") && !Object.getOwnPropertyDescriptor(Object.prototype, "toJSON")
}
type SnapshotMaterialization = Readonly<{
  identity: object
  payload?: string
  fingerprint?: string
  payloadUnits: number
  copy?: Readonly<{ json: string; missing: string; largeStrings: string }>
  acl?: string
  units: number
}>

function planSnapshotMaterialization(snapshot: Snapshot, payload: string, fingerprint?: string): SnapshotMaterialization | undefined {
  return sfLocalStoreCost("plan-materialization", () => {
  if (!snapshotDecoderCurrent() || (payload.length > SNAPSHOT_MATERIALIZATION_UNITS && !fingerprint)) return
  const parts: string[] = []
  const missing: string[] = []
  const largeStrings: string[] = []
  const path: string[] = []
  const budget = { units: payload.length + 4, nodes: 0 }
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
      if (typeof encoded !== "string") return false
      // Large immutable file strings already live in the retained SQLite
      // payload. Index that exact JSON literal instead of retaining it twice.
      if (typeof value === "string" && encoded.length >= 64 * 1024 && largeStrings.length < 16) {
        const offset = payload.indexOf(encoded)
        if (offset >= 0) {
          const escaped = encoded.length !== value.length + 2
          const pointer = JSON.stringify([offset, encoded.length, escaped, path])
          budget.units += pointer.length + (largeStrings.length ? 1 : 0)
          if (budget.units > SNAPSHOT_MATERIALIZATION_UNITS) return false
          largeStrings.push(pointer)
          return append("null")
        }
      }
      return append(encoded)
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
  // Exact stored bytes can still identify independently observed roots when
  // a second JSON representation would exceed the copy-plan budget.
  const copy = !fingerprint && visit(snapshot) ? {
    json: parts.join(""), missing: "[" + missing.join(",") + "]",
    largeStrings: "[" + largeStrings.join(",") + "]",
  } : undefined
  const units = (fingerprint?.length ?? payload.length) +
    (copy ? copy.json.length + copy.missing.length + copy.largeStrings.length : 0)
  const acl = aclCodecCurrent() ? encodeSnapshot({
    data: Object.fromEntries(snapshotAclFields.flatMap((name) => Object.hasOwn(snapshot.data, name) ? [[name, snapshot.data[name]]] : [])),
    versions: {}, sequences: {}, audit: [], notices: [],
  }) : undefined
  return Object.freeze({
    identity: {}, ...(fingerprint ? { fingerprint } : { payload }), payloadUnits: payload.length, copy,
    ...(acl && units + acl.length <= SNAPSHOT_MATERIALIZATION_UNITS
      ? { acl, units: units + acl.length } : { units }),
  })
  })
}

function materializeSnapshot(plan: SnapshotMaterialization, payload: string): Snapshot {
  return sfLocalStoreCost("materialize-snapshot", () => {
  const copy = plan.copy
  if (!copy) return decodeSnapshot(payload)
  const snapshot = JSON.parse(copy.json) as Snapshot
  // Null placeholders preserve property order and array density. Only these
  // known own paths need repair; -0 is preserved by its native JSON literal.
  const restore = (path: string[], value: string | undefined) => {
    let parent: Record<string, unknown> = snapshot
    for (let index = 0; index < path.length - 1; index++) parent = parent[path[index]!] as Record<string, unknown>
    Object.defineProperty(parent, path[path.length - 1]!, { value, enumerable: true, writable: true, configurable: true })
  }
  if (copy.missing !== "[]") {
    for (const path of JSON.parse(copy.missing) as string[][]) restore(path, undefined)
  }
  if (copy.largeStrings !== "[]") {
    for (const [offset, length, escaped, path] of JSON.parse(copy.largeStrings) as [number, number, boolean, string[]][]) {
      const value: string = escaped
        ? JSON.parse(payload.slice(offset, offset + length))
        : payload.slice(offset + 1, offset + length - 1)
      restore(path, value)
    }
  }
  return snapshot
  })
}
