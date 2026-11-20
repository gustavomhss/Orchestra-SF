import { randomUUID } from "node:crypto"
import { types } from "node:util"
import { currentLocalReadonlyAuthorityData } from "../../runtime/local-store.ts"
import type { ReadonlyAuthorityData } from "../../runtime/local-store.ts"
import type { Persistence, Snapshot, TransactionOptions } from "../../runtime/contract.ts"
import type { AssetPersistence } from "../../runtime/assets.ts"
import type { Surface } from "../../src/identity.ts"
import { digestSfValue } from "../contracts/canonical.ts"

const sanctionedIdentity = new WeakSet<Snapshot>()

/** Allocate the incarnation a same-transaction correlation must name before finish() assigns it. */
export function bindCreatedSourceIdentity(snapshot: Snapshot, recordType: string, recordId: string) {
  requireSourceIdentities(snapshot)
  const records = snapshot.sfSources!.records
  const key = JSON.stringify([recordType, recordId])
  const existing = records[key]
  if (existing?.alive) return existing.incarnation
  const incarnation = randomUUID()
  records[key] = { incarnation, version: 1, alive: true, inputDigest: "0".repeat(64) }
  sanctionedIdentity.add(snapshot)
  return incarnation
}

export type SfSourceScope = NonNullable<NonNullable<Snapshot["sfSources"]>["scopes"]>[string]["scope"]
export type SfScopedSourcePort = {
  resolveScopedSource: (surface: Surface, incarnation: string, authorize: (snapshot: Snapshot, scope: SfSourceScope) => Promise<boolean>) => Promise<{ scope: SfSourceScope; projection: unknown; incarnation: string; version: number; inputDigest: string } | undefined>
  readScopedSource: (surface: Surface, scope: SfSourceScope, authorize: (snapshot: Snapshot) => Promise<boolean>) => Promise<{ projection: unknown; incarnation: string; version: number; inputDigest: string } | undefined>
  /** Prepare and observe one source in the same surface transaction; every call prepares afresh. */
  readScopedSourcePrepared?: (
    surface: Surface,
    prepare: (snapshot: Snapshot) => Promise<{ scope: SfSourceScope; authorize: (snapshot: Snapshot) => Promise<boolean> } | undefined>,
    options?: TransactionOptions,
  ) => Promise<{ projection: unknown; incarnation: string; version: number; inputDigest: string } | undefined>
  checkScopedSource?: (surface: Surface, scope: SfSourceScope, authorize: (snapshot: Snapshot) => Promise<boolean>, expected: { incarnation: string; version: number; inputDigest: string }) => Promise<boolean>
}

type CanonicalScopedSourceCheck = NonNullable<SfScopedSourcePort["checkScopedSource"]>
// Register only factory-owned code. No snapshot, observation or result is retained.
const canonicalSourceChecks = new WeakMap<object, CanonicalScopedSourceCheck>()

/** A wrapped/replaced method must keep its wrapper's existing authority path. */
export function canonicalScopedSourceCheck(port: SfScopedSourcePort): CanonicalScopedSourceCheck | undefined {
  const check = canonicalSourceChecks.get(port)
  return check && Object.getOwnPropertyDescriptor(port, "checkScopedSource")?.value === check ? check : undefined
}

const authorityMethods = ["currentSnapshots", "currentSnapshot", "transaction", "transactionAll", "readSnapshotRoot"] as const
const sourceAuthorityReaders = new WeakMap<object, { base: object; current: (owner: object) => boolean }>()

/** Recognize only factory-owned forwarders, including their canonical spread composition. */
export function currentSfReadonlyAuthorityData<S extends Surface>(owner: object, surfaces: readonly S[]): ReadonlyAuthorityData<S> | undefined {
  if (types.isProxy(owner) || Object.getPrototypeOf(owner) !== Object.prototype) return undefined
  const descriptor = Object.getOwnPropertyDescriptor(owner, "currentSnapshots")
  const registered = descriptor && "value" in descriptor && typeof descriptor.value === "function" ?
    sourceAuthorityReaders.get(descriptor.value) : undefined
  if (!registered) return currentLocalReadonlyAuthorityData(owner, surfaces)
  if (!registered.current(owner)) return undefined
  const observation = currentLocalReadonlyAuthorityData(registered.base, surfaces)
  if (!observation) return undefined
  const integrity = { failed: false }
  return { snapshots: observation.snapshots, current: () => {
    const valid = observation.current() && !integrity.failed && registered.current(owner)
    if (!valid) integrity.failed = true
    return valid
  } }
}

export type SfSourceIdentityInput = { recordType: string; recordId: string; inputDigest: string }

/** Wrap the installation's existing driver once, shared by HTTP, jobs and restore. No new store. */
export function createSfSourcePersistence(input: {
  persistence: AssetPersistence & Pick<Persistence, "transactionAll" | "currentSnapshots" | "currentSnapshot" | "readSnapshotRoot">
  enumerate: (surface: Surface, snapshot: Snapshot) => readonly SfSourceIdentityInput[]
  createId: () => string
  purpose?: "business-restore"
  projectScope?: (surface: Surface, snapshot: Snapshot, scope: SfSourceScope) => unknown | undefined
}): AssetPersistence & Pick<Persistence, "transactionAll" | "currentSnapshots" | "currentSnapshot" | "readSnapshotRoot"> & SfScopedSourcePort & { initializeSources: (surface: Surface) => Promise<void> } {
  const observe = async (surface: Surface, snapshot: Snapshot, requested: SfSourceScope, authorize: (snapshot: Snapshot) => Promise<boolean>) => {
    requireSourceIdentities(snapshot)
    const scope = structuredClone(requested)
    if (![scope.principalRef, scope.accessRevision, scope.policyVersion, scope.recordType, scope.recordId].every((value) => typeof value === "string" && value.trim())) throw new Error("SF_SOURCE_SCOPE_INVALID")
    if (!input.projectScope) throw new Error("SF_SOURCE_SCOPE_PROJECTOR_UNAVAILABLE")
    const before = digestSfValue(snapshot)
    if (!await authorize(snapshot)) return undefined
    const projection = input.projectScope(surface, structuredClone(snapshot), structuredClone(scope))
    const source = sfSourceIdentity(snapshot, scope.recordType, scope.recordId)
    if (projection === undefined || !source || !await authorize(snapshot)) return undefined
    if (digestSfValue(snapshot) !== before) throw new Error("SF_SOURCE_SCOPE_CALLBACK_MUTATION")
    return { scope, projection, source, inputDigest: digestSfValue(projection) }
  }
  const readScopedSnapshot = async (surface: Surface, snapshot: Snapshot, requested: SfSourceScope, authorize: (snapshot: Snapshot) => Promise<boolean>) => {
    const observed = await observe(surface, snapshot, requested, authorize)
    if (!observed) return { commit: false, value: undefined }
    const { scope, projection, source, inputDigest } = observed
    const key = digestSfValue(scope)
    const prior = snapshot.sfSources!.scopes?.[key]
    const entry = {
      scope, sourceIncarnation: source.incarnation, incarnation: prior?.sourceIncarnation === source.incarnation ? prior.incarnation : createScopedIncarnation(snapshot, input.createId), alive: true, inputDigest,
      version: !prior || prior.sourceIncarnation !== source.incarnation ? 1 : prior.version + Number(!prior.alive || prior.inputDigest !== inputDigest),
    }
    snapshot.sfSources!.scopes ??= {}
    snapshot.sfSources!.scopes[key] = entry
    requireSourceIdentities(snapshot)
    return { commit: digestSfValue(prior) !== digestSfValue(entry), value: { projection: structuredClone(projection), incarnation: entry.incarnation, version: entry.version, inputDigest } }
  }
  const guard = (surface: Surface, snapshot: Snapshot) => {
    const before = digestSfValue(snapshot.sfSources)
    const auditStart = snapshot.audit.length
    const auditPrefix = digestSfValue(snapshot.audit)
    const productState = input.purpose === "business-restore" ? structuredClone(snapshot.data.__sfProductV1) : undefined
    return () => {
      requireSourceIdentities(snapshot)
      if (before !== digestSfValue(snapshot.sfSources) && !sanctionedIdentity.has(snapshot)) throw new Error("SF_SOURCE_IDENTITY_MUTATION")
      if (snapshot.audit.length < auditStart || digestSfValue(snapshot.audit.slice(0, auditStart)) !== auditPrefix) throw new Error("SF_SOURCE_AUDIT_REWRITTEN")
      const replacement = snapshot.audit.slice(auditStart).some((event) => event.record === "dataset")
      if (input.purpose === "business-restore") {
        if (!replacement) throw new Error("SF_RESTORE_MARKER_MISSING")
        if (productState === undefined) delete snapshot.data.__sfProductV1
        if (productState !== undefined) snapshot.data.__sfProductV1 = productState
      }
      synchronizeSources(snapshot, input.enumerate(surface, snapshot), input.createId, replacement)
      synchronizeScopes(surface, snapshot, input.projectScope, input.createId)
      requireSourceIdentities(snapshot)
    }
  }
  const persistence: AssetPersistence & Pick<Persistence, "transactionAll" | "currentSnapshots" | "currentSnapshot" | "readSnapshotRoot"> & SfScopedSourcePort & { initializeSources: (surface: Surface) => Promise<void> } = {
    ...(input.persistence.currentSnapshots ? { currentSnapshots: () => input.persistence.currentSnapshots!() } : {}),
    ...(input.persistence.currentSnapshot ? { currentSnapshot: (surface: Surface) => input.persistence.currentSnapshot!(surface) } : {}),
    // Scope forwarding does not admit a source. Callers still enter transaction
    // below, preserving source guards and any underlying CurrentChoice fence.
    ...(input.persistence.readSnapshotRoot ? { readSnapshotRoot: <T>(work: () => Promise<T>, options?: TransactionOptions) =>
      input.persistence.readSnapshotRoot!(work, options) } : {}),
    resolveScopedSource: async (surface, incarnation, authorize) => {
      const scope = await input.persistence.transaction(surface, async (snapshot) => {
        requireSourceIdentities(snapshot)
        const entries = Object.values(snapshot.sfSources!.scopes ?? {}).filter((entry) => entry.alive && entry.incarnation === incarnation)
        const entry = entries.length === 1 ? entries[0] : undefined
        if (!entry || !await authorize(snapshot, structuredClone(entry.scope))) return { commit: false, value: undefined }
        return { commit: false, value: structuredClone(entry.scope) }
      })
      if (!scope) return undefined
      const value = await persistence.readScopedSource(surface, scope, (snapshot) => authorize(snapshot, structuredClone(scope)))
      return value?.incarnation === incarnation ? { ...value, scope } : undefined
    },
    readScopedSource: (surface, requested, authorize) => input.persistence.transaction(surface, (snapshot) =>
      readScopedSnapshot(surface, snapshot, requested, authorize)),
    readScopedSourcePrepared: (surface, prepare, options) => input.persistence.transaction(surface, async (snapshot) => {
      requireSourceIdentities(snapshot)
      // Preparation receives an isolated view. Its callback cannot alter the held
      // source snapshot before observe establishes its existing mutation guard.
      const prepared = await prepare(structuredClone(snapshot))
      if (!prepared) return { commit: false, value: undefined }
      return readScopedSnapshot(surface, snapshot, prepared.scope, prepared.authorize)
    }, options),
    ...(input.persistence.currentSnapshots ? { checkScopedSource: async (surface: Surface, scope: SfSourceScope, authorize: (snapshot: Snapshot) => Promise<boolean>, expected: { incarnation: string; version: number; inputDigest: string }) => {
      const check = async (snapshot: Snapshot) => {
        const observed = await observe(surface, snapshot, scope, authorize)
        if (!observed) return false
        const current = sfScopedSourceIdentity(snapshot, observed.scope)
        return !!current && current.incarnation === expected.incarnation && current.version === expected.version &&
          current.inputDigest === expected.inputDigest && observed.inputDigest === expected.inputDigest
      }
      const snapshots = input.persistence.currentSnapshots?.()
      if (snapshots) return check(snapshots[surface])
      return input.persistence.transaction(surface, async (snapshot) => ({ commit: false, value: await check(snapshot) }))
    } } : {}),
    initializeSources: (surface) => input.persistence.transaction(surface, async (snapshot) => {
      if (snapshot.sfSources) {
        requireSourceIdentities(snapshot)
        return { commit: false, value: undefined }
      }
      snapshot.sfSources = { schemaVersion: 1, records: {} }
      synchronizeSources(snapshot, input.enumerate(surface, snapshot), input.createId, false)
      return { commit: true, value: undefined }
    }),
    transaction: (surface, work, options) => input.persistence.transaction(surface, async (snapshot, blobs) => {
      requireSourceIdentities(snapshot)
      const finish = guard(surface, snapshot)
      const result = await work(snapshot, blobs)
      if (!result.commit) return result
      finish()
      return result
    }, options),
    ...(input.persistence.transactionAll ? { transactionAll: <T>(work: (snapshots: Record<Surface, Snapshot>) => Promise<{ commit: boolean; value: T }>, options?: TransactionOptions) =>
      input.persistence.transactionAll!(async (snapshots) => {
        const surfaces: readonly Surface[] = ["dashboard", "planner", "procurement"]
        const original = surfaces.map((surface) => snapshots[surface])
        const before = surfaces.map((surface) => digestSfValue(snapshots[surface]))
        const finish = surfaces.map((surface) => guard(surface, snapshots[surface]))
        const result = await work(snapshots)
        if (result.commit) {
          if (surfaces.some((surface, index) => Object.getOwnPropertyDescriptor(snapshots, surface)?.value !== original[index]))
            throw new Error("SF_SOURCE_SNAPSHOT_REPLACED")
          surfaces.forEach((surface, index) => { if (digestSfValue(snapshots[surface]) !== before[index]) finish[index]!() })
        }
        return result
      }, options) } : {}),
  }
  if (persistence.checkScopedSource) canonicalSourceChecks.set(persistence, persistence.checkScopedSource)
  // Registration accepts no external callback. Only these freshly constructed
  // forwarders can identify this factory, and their base remains independently
  // recognized by LocalStore. Inspecting a custom input must not call a getter.
  if (!types.isProxy(input) && Object.getPrototypeOf(input) === Object.prototype) {
    const descriptor = Object.getOwnPropertyDescriptor(input, "persistence")
    const key = Object.getOwnPropertyDescriptor(persistence, "currentSnapshots")?.value
    if (descriptor && "value" in descriptor && descriptor.value && typeof descriptor.value === "object" && typeof key === "function") {
      const base = descriptor.value
      const original = authorityMethods.map((name) => Object.getOwnPropertyDescriptor(persistence, name)?.value)
      sourceAuthorityReaders.set(key, { base, current: (owner) => {
        if (types.isProxy(owner) || Object.getPrototypeOf(owner) !== Object.prototype ||
          types.isProxy(input) || Object.getPrototypeOf(input) !== Object.prototype) return false
        const current = Object.getOwnPropertyDescriptor(input, "persistence")
        return !!current && "value" in current && current.value === base && authorityMethods.every((name, index) => {
          const method = Object.getOwnPropertyDescriptor(owner, name)
          return !!method && "value" in method && method.value === original[index]
        })
      } })
    }
  }
  return persistence
}

export function sfSourceIdentity(snapshot: Snapshot, recordType: string, recordId: string) {
  requireSourceIdentities(snapshot)
  const identity = snapshot.sfSources!.records[JSON.stringify([recordType, recordId])]
  return identity?.alive ? structuredClone(identity) : undefined
}

/** Host-private lookup for a prepared command inside the same serializable transaction. */
export function sfScopedSourceIdentity(snapshot: Snapshot, scope: SfSourceScope) {
  requireSourceIdentities(snapshot)
  const entry = snapshot.sfSources!.scopes?.[digestSfValue(scope)]
  const source = sfSourceIdentity(snapshot, scope.recordType, scope.recordId)
  return entry?.alive && source?.incarnation === entry.sourceIncarnation
    ? { incarnation: entry.incarnation, version: entry.version, inputDigest: entry.inputDigest }
    : undefined
}

function synchronizeSources(snapshot: Snapshot, entries: readonly SfSourceIdentityInput[], createId: () => string, replacement: boolean) {
  const keys = entries.map((entry) => JSON.stringify([entry.recordType, entry.recordId]))
  if (new Set(keys).size !== keys.length || entries.some((entry) => !entry.recordType.trim() || !entry.recordId.trim() || !/^[a-f0-9]{64}$/.test(entry.inputDigest))) throw new Error("SF_SOURCE_INPUT_INVALID")
  const records = snapshot.sfSources!.records
  for (const [key, identity] of Object.entries(records)) if (!keys.includes(key)) records[key] = { ...identity, alive: false }
  entries.forEach((entry, index) => {
    const prior = records[keys[index]!]
    if (!prior || !prior.alive || replacement) {
      const incarnation = createId()
      if (!incarnation.trim() || Object.values(records).some((identity) => identity.incarnation === incarnation)) throw new Error("SF_SOURCE_INCARNATION_INVALID")
      records[keys[index]!] = { incarnation, version: 1, alive: true, inputDigest: entry.inputDigest }
      return
    }
    records[keys[index]!] = { ...prior, inputDigest: entry.inputDigest, version: prior.version + Number(prior.inputDigest !== entry.inputDigest) }
  })
}

function requireSourceIdentities(snapshot: Snapshot) {
  const state = snapshot.sfSources
  if (!state || state.schemaVersion !== 1 || !state.records || Array.isArray(state.records) || Object.values(state.records).some((entry) => !entry || typeof entry.incarnation !== "string" || !entry.incarnation.trim() || !Number.isSafeInteger(entry.version) || entry.version < 1 || typeof entry.alive !== "boolean" || !/^[a-f0-9]{64}$/.test(entry.inputDigest))) throw new Error("SF_SOURCE_IDENTITIES_UNAVAILABLE")
  if (state.scopes !== undefined && (!state.scopes || typeof state.scopes !== "object" || Array.isArray(state.scopes) || Object.entries(state.scopes).some(([key, entry]) => !entry || !entry.scope || key !== digestSfValue(entry.scope) || ![entry.scope.principalRef, entry.scope.accessRevision, entry.scope.policyVersion, entry.scope.recordType, entry.scope.recordId, entry.incarnation, entry.sourceIncarnation].every((value) => typeof value === "string" && !!value.trim()) || !Number.isSafeInteger(entry.version) || entry.version < 1 || typeof entry.alive !== "boolean" || !/^[a-f0-9]{64}$/.test(entry.inputDigest)))) throw new Error("SF_SOURCE_SCOPES_UNAVAILABLE")
}

/** Recomputed at every durable write, including intermediate A→B→A writes without a reader. */
function synchronizeScopes(surface: Surface, snapshot: Snapshot, project: ((surface: Surface, snapshot: Snapshot, scope: SfSourceScope) => unknown | undefined) | undefined, createId: () => string) {
  const entries = Object.values(snapshot.sfSources!.scopes ?? {})
  if (entries.length && !project) throw new Error("SF_SOURCE_SCOPE_PROJECTOR_UNAVAILABLE")
  entries.forEach((entry) => {
    const source = sfSourceIdentity(snapshot, entry.scope.recordType, entry.scope.recordId)
    const projection = project!(surface, structuredClone(snapshot), structuredClone(entry.scope))
    if (!source || projection === undefined) {
      if (entry.alive) entry.version++
      entry.alive = false
      return
    }
    const inputDigest = digestSfValue(projection)
    if (entry.sourceIncarnation !== source.incarnation) {
      entry.version = 1
      entry.incarnation = createScopedIncarnation(snapshot, createId)
    }
    if (entry.sourceIncarnation === source.incarnation && (!entry.alive || inputDigest !== entry.inputDigest)) entry.version++
    entry.sourceIncarnation = source.incarnation
    entry.inputDigest = inputDigest
    entry.alive = true
  })
}

function createScopedIncarnation(snapshot: Snapshot, createId: () => string) {
  const incarnation = createId()
  if (!incarnation.trim() || [...Object.values(snapshot.sfSources!.records), ...Object.values(snapshot.sfSources!.scopes ?? {})].some((entry) => entry.incarnation === incarnation)) throw new Error("SF_SOURCE_INCARNATION_INVALID")
  return incarnation
}
