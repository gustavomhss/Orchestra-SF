import type { Persistence, Snapshot, TransactionOptions } from "../../runtime/contract.ts"
import type { AssetPersistence } from "../../runtime/assets.ts"
import type { Surface } from "../../src/identity.ts"
import { digestSfValue } from "../contracts/canonical.ts"

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

export type SfSourceIdentityInput = { recordType: string; recordId: string; inputDigest: string }

/** Wrap the installation's existing driver once, shared by HTTP, jobs and restore. No new store. */
export function createSfSourcePersistence(input: {
  persistence: AssetPersistence & Pick<Persistence, "transactionAll" | "currentSnapshots">
  enumerate: (surface: Surface, snapshot: Snapshot) => readonly SfSourceIdentityInput[]
  createId: () => string
  purpose?: "business-restore"
  projectScope?: (surface: Surface, snapshot: Snapshot, scope: SfSourceScope) => unknown | undefined
}): AssetPersistence & Pick<Persistence, "transactionAll" | "currentSnapshots"> & SfScopedSourcePort & { initializeSources: (surface: Surface) => Promise<void> } {
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
      if (before !== digestSfValue(snapshot.sfSources)) throw new Error("SF_SOURCE_IDENTITY_MUTATION")
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
  const persistence: AssetPersistence & Pick<Persistence, "transactionAll" | "currentSnapshots"> & SfScopedSourcePort & { initializeSources: (surface: Surface) => Promise<void> } = {
    ...(input.persistence.currentSnapshots ? { currentSnapshots: () => input.persistence.currentSnapshots!() } : {}),
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
