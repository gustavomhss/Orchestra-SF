import { types } from "node:util"
import { currentLocalReadonlyAuthorityData, hasLocalSnapshotScope, hasPairedLocalSnapshotReads } from "../../runtime/local-store.ts"
import type { ReadonlyAuthorityData } from "../../runtime/local-store.ts"
import { currentChoiceReadonlyAuthorityData } from "../decisions/current-choice-preview.ts"
import { AsyncLocalStorage } from "node:async_hooks"
import type { HoldTargetPreimage, Persistence, SealedSnapshotRead, Snapshot, SnapshotAuthorityRead, TransactionOptions } from "../../runtime/contract.ts"
import type { AssetPersistence } from "../../runtime/assets.ts"
import type { Surface } from "../../src/identity.ts"
import { digestSfValue, sfCanonicalSerializerUnhooked } from "../contracts/canonical.ts"
import { sfOriginalStructuredCloneCurrent } from "../contracts/canonical-clone.ts"

// An identity reservation exists only while the source producer owns this snapshot.
const creationBinders = new WeakMap<Snapshot, (recordType: string, recordId: string) => string>()
const canonicalPrimitives = { stringify: JSON.stringify, parse: JSON.parse, keys: Object.keys, map: Array.prototype.map, sort: Array.prototype.sort }

function sealedDigestsCurrent() {
  return JSON.stringify === canonicalPrimitives.stringify && JSON.parse === canonicalPrimitives.parse && Object.keys === canonicalPrimitives.keys &&
    Object.getPrototypeOf(Array.prototype) === Object.prototype &&
    Array.prototype.map === canonicalPrimitives.map && Array.prototype.sort === canonicalPrimitives.sort &&
    !Object.getOwnPropertyDescriptor(Array.prototype, "toJSON") && !Object.getOwnPropertyDescriptor(Object.prototype, "toJSON") &&
    !Object.getOwnPropertyDescriptor(Object.prototype, "sfSources") && !Object.getOwnPropertyDescriptor(Object.prototype, "sfBlobGenerations")
}

/** Reserve a real source incarnation without allowing a caller to mutate source metadata. */
export function bindCreatedSourceIdentity(snapshot: Snapshot, recordType: string, recordId: string) {
  const bind = creationBinders.get(snapshot)
  if (!bind) throw new Error("SF_SOURCE_CREATION_OUTSIDE_TRANSACTION")
  return bind(recordType, recordId)
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

type ScopedSourceCheckScope = { owner: object; request: Request; open: boolean; failed: boolean; pins: Set<() => boolean>; producers: WeakMap<object, (() => boolean) | null> }
const scopedSourceChecks = new AsyncLocalStorage<ScopedSourceCheckScope>()
const dashboardAclReaders = new WeakSet<object>()

/** These installed Dashboard callbacks consume ACL data only. */
export function dashboardScopeAuthority<Args extends unknown[]>(authorize: (snapshot: Pick<Snapshot, "data">, ...args: Args) => Promise<boolean>) {
  dashboardAclReaders.add(authorize)
  return authorize
}
const currentSourceChecks = (scope: ScopedSourceCheckScope) => {
  try { return !scope.failed && !scope.request.signal.aborted && [...scope.pins].every((pin) => pin()) } catch { return false }
}
const requireSourceChecks = (scope: ScopedSourceCheckScope) => {
  if (!scope.open || scopedSourceChecks.getStore() !== scope || !currentSourceChecks(scope)) {
    scope.failed = true
    throw new Error("SF_SOURCE_CHECK_SCOPE_CLOSED")
  }
}

/** Reobserve sources under the current authenticated read/commit group. This
 * never supplies source authority: observe invokes the actual projector and
 * both authorizations. Opaque factories keep their original read/materialization;
 * the real enclosing C08 still rejects nested writes. An admitted factory can
 * never fall back after its identity changes. The returned check pins identity;
 * the asynchronous producer must run again for each dependency authorization. */
export async function withSfScopedSourceChecks<Value>(binding: { owner: object; request: Request; current: () => boolean },
  work: () => Promise<Value>): Promise<{ value: Value; current: () => boolean }> {
  const { owner, request, current } = binding
  const pin = () => binding.owner === owner && binding.request === request && binding.current === current && current()
  const inherited = scopedSourceChecks.getStore()
  if (inherited) {
    requireSourceChecks(inherited)
    if (inherited.owner !== owner || inherited.request !== request) {
      inherited.failed = true
      throw new Error("SF_SOURCE_CHECK_SCOPE_MISMATCH")
    }
    inherited.pins.add(pin)
    requireSourceChecks(inherited)
    const value = await work()
    requireSourceChecks(inherited)
    return { value, current: () => currentSourceChecks(inherited) }
  }
  const scope: ScopedSourceCheckScope = { owner, request, open: true, failed: false, pins: new Set([pin]), producers: new WeakMap() }
  return scopedSourceChecks.run(scope, async () => {
    try {
      requireSourceChecks(scope)
      const value = await work()
      requireSourceChecks(scope)
      return { value, current: () => currentSourceChecks(scope) }
    } finally { scope.open = false }
  })
}

type CanonicalScopedSourceCheck = NonNullable<SfScopedSourcePort["checkScopedSource"]>
// Register only factory-owned code. No snapshot, observation or result is retained.
const canonicalSourceChecks = new WeakMap<object, CanonicalScopedSourceCheck>()
const installedSourceResolvers = new WeakSet<object>()

export function isInstalledSfSourceResolver(resolve: SfScopedSourcePort["resolveScopedSource"]) {
  return installedSourceResolvers.has(resolve)
}

const plannerAclReaders = new WeakSet<object>()
const plannerAclPreparers = new WeakSet<object>()
const preparationHas = WeakSet.prototype.has, preparationAdd = WeakSet.prototype.add, preparationApply = Reflect.apply

/** The installed Planner preparer reads ACL only; wrapped/unknown callbacks
 * retain a full Snapshot. Registration changes no callback identity or result. */
export function plannerScopePreparation(prepare: (snapshot: Pick<Snapshot, "data">) =>
  ReturnType<Parameters<NonNullable<SfScopedSourcePort["readScopedSourcePrepared"]>>[1]>) {
  preparationApply(preparationAdd, plannerAclPreparers, [prepare])
  return prepare
}

/** The canonical Planner source authorizer needs the current role map only. */
export function plannerScopeAuthority(authorize: (snapshot: Pick<Snapshot, "data">) => Promise<boolean>) {
  plannerAclReaders.add(authorize)
  return authorize
}

/** A wrapped/replaced method must keep its wrapper's existing authority path. */
export function canonicalScopedSourceCheck(port: SfScopedSourcePort): CanonicalScopedSourceCheck | undefined {
  const check = canonicalSourceChecks.get(port)
  const method = check && Object.getOwnPropertyDescriptor(port, "checkScopedSource")
  return method && Object.hasOwn(method, "value") && method.value === check ? check : undefined
}

const authorityMethods = ["currentSnapshots", "currentSnapshot", "hasCurrentSnapshots", "transaction", "transactionAll", "currentSnapshotScope"] as const
const sourceAuthorityReaders = new WeakMap<object, { base: object; current: (owner: object) => boolean }>()

function currentDriverReadonlyAuthorityData<S extends Surface>(owner: object, surfaces: readonly S[]) {
  return currentLocalReadonlyAuthorityData(owner, surfaces) ?? currentChoiceReadonlyAuthorityData(owner, surfaces)
}

/** Read lexical presence without copying data for a registered local adapter. */
export function hasSfLocalSnapshotScope(owner: object) {
  const all = !types.isProxy(owner) && Object.getOwnPropertyDescriptor(owner, "currentSnapshots")
  const registered = all && Object.hasOwn(all, "value") && typeof all.value === "function" ? sourceAuthorityReaders.get(all.value) : undefined
  if (!registered) return hasLocalSnapshotScope(owner)
  return registered.current(owner) ? hasLocalSnapshotScope(registered.base) : undefined
}

/** Observe the other two surfaces when Dashboard is already observed by its transaction. */
export function currentSfSiblingSnapshots(owner: Pick<Persistence, "currentSnapshot" | "currentSnapshots">) {
  const all = !types.isProxy(owner) && Object.getOwnPropertyDescriptor(owner, "currentSnapshots")
  const registered = all && Object.hasOwn(all, "value") && typeof all.value === "function" ? sourceAuthorityReaders.get(all.value) : undefined
  const paired = registered ? registered.current(owner) && hasPairedLocalSnapshotReads(registered.base) : hasPairedLocalSnapshotReads(owner)
  if (!paired || !owner.currentSnapshot) return owner.currentSnapshots?.()
  const planner = owner.currentSnapshot("planner")
  const procurement = owner.currentSnapshot("procurement")
  return planner && procurement ? { planner, procurement } : undefined
}

/** Recognize only factory-owned forwarders, including their canonical spread composition. */
export function currentSfReadonlyAuthorityData<S extends Surface>(owner: object, surfaces: readonly S[]): ReadonlyAuthorityData<S> | undefined {
  if (types.isProxy(owner) || Object.getPrototypeOf(owner) !== Object.prototype) return undefined
  const descriptor = Object.getOwnPropertyDescriptor(owner, "currentSnapshots")
  const registered = descriptor && Object.hasOwn(descriptor, "value") && typeof descriptor.value === "function" ?
    sourceAuthorityReaders.get(descriptor.value) : undefined
  if (!registered) return currentDriverReadonlyAuthorityData(owner, surfaces)
  const root = Object.getOwnPropertyDescriptor(owner, "readSnapshotRoot")
  if (!root || !Object.hasOwn(root, "value") || typeof root.value !== "function" || !registered.current(owner)) return undefined
  // A caller may bracket the root callback. The admitted snapshot methods
  // and the actual underlying LocalStore scope still determine its data.
  const observation = currentDriverReadonlyAuthorityData(registered.base, surfaces)
  if (!observation) return undefined
  const integrity = { failed: false }
  return { snapshots: observation.snapshots, scope: observation.scope, current: (requirement) => {
    const method = Object.getOwnPropertyDescriptor(owner, "readSnapshotRoot")
    const valid = observation.current(requirement) && !integrity.failed && registered.current(owner) &&
      !!method && Object.hasOwn(method, "value") && method.value === root.value
    if (!valid) integrity.failed = true
    return valid
  } }
}

/** A known read root seals the full snapshot set while its live callbacks run. */
export function currentSfReadonlySnapshotScope(owner: Pick<Persistence, "currentSnapshotScope">) {
  const method = !types.isProxy(owner) && Object.getOwnPropertyDescriptor(owner, "currentSnapshotScope")
  if (!method || !Object.hasOwn(method, "value") || typeof method.value !== "function") return undefined
  const observed = currentSfReadonlyAuthorityData(owner, [])
  if (!observed?.scope) return undefined
  const optionalFields = ["sfSources", "sfBlobGenerations"]
  const plain = () => sfCanonicalSerializerUnhooked() && sealedDigestsCurrent() &&
    optionalFields.every((field) => !Object.getOwnPropertyDescriptor(Object.prototype, field))
  if (!plain()) return undefined
  return { identity: observed.scope.identity, bytesIdentity: observed.scope.bytesIdentity,
    current: () => observed.current("unpoisoned") && plain() }
}

export type SfSourceIdentityInput = { recordType: string; recordId: string; inputDigest: string }

type SourceDriver = AssetPersistence & Pick<Persistence, "transactionAll" | "currentSnapshots" | "currentSnapshot" | "hasCurrentSnapshots" | "readSnapshotRoot" | "currentSnapshotScope">

/** Wrap the installation's existing driver once, shared by HTTP, jobs and restore. No new store. */
export function createSfSourcePersistence(input: {
  persistence: SourceDriver
  enumerate: (surface: Surface, snapshot: Snapshot) => readonly SfSourceIdentityInput[]
  createId: () => string
  purpose?: "business-restore"
  bootstrapOnWrite?: boolean
  projectScope?: (surface: Surface, snapshot: Snapshot, scope: SfSourceScope) => unknown | undefined
  observeAuthority?: SnapshotAuthorityRead
  hasSnapshotRoot?: () => boolean
  holdTargetPreimage?: HoldTargetPreimage
  /** The shipped Dashboard projector consumes domain fields, sources and ACL only. */
  installedDashboardProjector?: (surface: Surface, snapshot: Snapshot, scope: SfSourceScope, heldSource?: object) => unknown | undefined
}): SourceDriver & SfScopedSourcePort & {
  observeAuthority?: SnapshotAuthorityRead
  hasSnapshotRoot?: () => boolean
  readDashboardAuthority?: <T>(work: () => Promise<T>, signal: AbortSignal) => Promise<T>
  initializeSources: (surface: Surface) => Promise<void>
  readSealed?: SealedSnapshotRead
} {
  const dashboardSourceProofs = new WeakSet<object>()
  const requireObservationSources = (snapshot: Snapshot, sourceRoot?: object) => {
    // Root identities are minted by LocalStore only for validated durable
    // preimages. The callback can inspect ACL only and the projector receives
    // its own copy. Every observation still looks up both live source entries.
    if (sourceRoot && dashboardSourceProofs.has(sourceRoot)) return
    requireSourceIdentities(snapshot)
    if (sourceRoot) dashboardSourceProofs.add(sourceRoot)
  }
  const admitSourceChecks = (scope: ScopedSourceCheckScope) => {
    if (scope.producers.has(input)) return scope.producers.get(input) !== null
    const opaque = () => { scope.producers.set(input, null); return false }
    if (types.isProxy(input) || Object.getPrototypeOf(input) !== Object.prototype) return opaque()
    const inputPrototype = Object.getPrototypeOf(input)
    const descriptors = (["persistence", "projectScope"] as const)
      .map((name) => [name, Object.getOwnPropertyDescriptor(input, name)] as const)
    if (descriptors.some(([, descriptor]) => !descriptor || !Object.hasOwn(descriptor, "value"))) return opaque()
    const persistence = input.persistence
    if (!persistence || types.isProxy(persistence) || Object.getPrototypeOf(persistence) !== Object.prototype) return opaque()
    const driverPrototype = Object.getPrototypeOf(persistence)
    const methods = (["transaction", "transactionAll", "currentSnapshots", "currentSnapshot", "readSnapshotRoot"] as const)
      .map((name) => [name, Object.getOwnPropertyDescriptor(persistence, name)] as const)
    if (methods.some(([name, descriptor]) => descriptor ? !Object.hasOwn(descriptor, "value") : name in persistence)) return opaque()
    const pin = () => Object.getPrototypeOf(input) === inputPrototype && Object.getPrototypeOf(persistence) === driverPrototype &&
      descriptors.every(([name, descriptor]) => {
        const live = Object.getOwnPropertyDescriptor(input, name)
        return !!live && Object.hasOwn(live, "value") && live.value === descriptor?.value
      }) && methods.every(([name, descriptor]) => {
        const live = Object.getOwnPropertyDescriptor(persistence, name)
        return descriptor ? !!live && Object.hasOwn(live, "value") && live.value === descriptor.value : live === undefined && !(name in persistence)
      })
    scope.producers.set(input, pin)
    scope.pins.add(pin)
    return true
  }
  const observe = async (surface: Surface, snapshot: Snapshot, requested: SfSourceScope, authorize: (snapshot: Snapshot) => Promise<boolean>, sourceRoot?: object, plannerAcl?: ReadonlyAuthorityData<"planner">) => {
    const checking = scopedSourceChecks.getStore()
    if (checking) {
      requireSourceChecks(checking)
      admitSourceChecks(checking)
      requireSourceChecks(checking)
    }
    if (!sourceRoot) requireSourceIdentities(snapshot)
    const scope = structuredClone(requested)
    if (![scope.principalRef, scope.accessRevision, scope.policyVersion, scope.recordType, scope.recordId].every((value) => typeof value === "string" && value.trim())) throw new Error("SF_SOURCE_SCOPE_INVALID")
    if (!input.projectScope) throw new Error("SF_SOURCE_SCOPE_PROJECTOR_UNAVAILABLE")
    const protectedAcl = surface === "dashboard" && checking && admitSourceChecks(checking) && dashboardAclReaders.has(authorize) && authorityCurrent()
      ? readAuthority?.(["dashboard"]) : undefined
    if (sourceRoot && (!protectedAcl || protectedAcl.identity !== sourceRoot || !dashboardProjectorCurrent())) throw new Error("SF_DASHBOARD_SOURCE_ROOT_CHANGED")
    if (sourceRoot) requireObservationSources(snapshot, protectedAcl?.bytesIdentity ?? sourceRoot)
    const detachedAcl = protectedAcl ? undefined : detachedDashboardAcl(surface, snapshot, authorize)
    const before = protectedAcl || detachedAcl || plannerAcl ? undefined : digestSfValue(snapshot)
    const authenticate = () => {
      if (plannerAcl) {
        if (!plannerAcl.current()) return Promise.resolve(false)
        return authorize({ data: structuredClone(plannerAcl.snapshots.planner.data), versions: {}, sequences: {}, audit: [], notices: [] })
      }
      if (!protectedAcl && !detachedAcl) return authorize(snapshot)
      if (protectedAcl && !protectedAcl.current() || !authorityCurrent() || detachedAcl && !dashboardProjectorCurrent()) return Promise.resolve(false)
      // The real callback runs against a fresh ACL copy. Neither it nor the
      // projector receives the protected source graph in this path.
      const data = protectedAcl?.snapshots.dashboard.data ?? detachedAcl!
      return authorize({ data: structuredClone(data), versions: {}, sequences: {}, audit: [], notices: [] })
    }
    if (!await authenticate()) return undefined
    if (checking) requireSourceChecks(checking)
    const projectorSnapshot = detachedAcl ? dashboardDomainView(snapshot) : snapshot
    const projection = sourceRoot && protectedAcl?.current() && dashboardProjectorCurrent() && dashboardProjector
      ? dashboardProjector(surface, projectorSnapshot, structuredClone(scope), protectedAcl.bytesIdentity ?? sourceRoot)
      : input.projectScope(surface, structuredClone(projectorSnapshot), structuredClone(scope))
    const source = sourceRoot ? readSourceIdentity(snapshot, scope.recordType, scope.recordId) : sfSourceIdentity(snapshot, scope.recordType, scope.recordId)
    if (projection === undefined || !source || !await authenticate()) return undefined
    if (checking) requireSourceChecks(checking)
    if (protectedAcl ? !protectedAcl.current() || !authorityCurrent() || sourceRoot && !dashboardProjectorCurrent()
      : detachedAcl ? !authorityCurrent() || !dashboardProjectorCurrent()
      : plannerAcl ? !plannerAcl.current() : digestSfValue(snapshot) !== before)
      throw new Error("SF_SOURCE_SCOPE_CALLBACK_MUTATION")
    return { scope, projection, source, inputDigest: digestSfValue(projection) }
  }
  const readScopedSnapshot = async (surface: Surface, snapshot: Snapshot, requested: SfSourceScope, authorize: (snapshot: Snapshot) => Promise<boolean>, sourceRoot?: object, plannerAcl?: ReadonlyAuthorityData<"planner">) => {
    const checkScope = scopedSourceChecks.getStore()
    if (checkScope) requireSourceChecks(checkScope)
    const observed = await observe(surface, snapshot, requested, authorize, sourceRoot, plannerAcl)
    if (checkScope) requireSourceChecks(checkScope)
    if (!observed) return { commit: false, value: undefined }
    const { scope, projection, source, inputDigest } = observed
    if (checkScope && admitSourceChecks(checkScope)) {
      // The same physical/scoped identity and projection must already exist.
      // Return the newly observed projection, never a cached projection or grant.
      const current = sourceRoot ? readScopedIdentity(snapshot, scope) : sfScopedSourceIdentity(snapshot, scope)
      return { commit: false, value: current && current.inputDigest === inputDigest
        ? { projection: structuredClone(projection), ...current } : undefined }
    }
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
  const guard = (surface: Surface, snapshot: Snapshot, sealedPreimage?: () => Snapshot | undefined) => {
    const before = sealedPreimage ? undefined : digestSfValue(snapshot.sfSources)
    const auditStart = snapshot.audit.length
    const auditPrefix = sealedPreimage ? undefined : digestSfValue(snapshot.audit)
    const productState = input.purpose === "business-restore" ? structuredClone(snapshot.data.__sfProductV1) : undefined
    const reserved = new Map<string, { incarnation: string; inputDigest: string }>()
    const previous = creationBinders.get(snapshot)
    const bind = (recordType: string, recordId: string) => {
      requireSourceIdentities(snapshot)
      const original = sealedPreimage?.()
      if (input.purpose === "business-restore" || (sealedPreimage && !original) ||
        (sealedPreimage ? digestSfValue(original?.sfSources) : before) !== digestSfValue(snapshot.sfSources))
        throw new Error("SF_SOURCE_IDENTITY_MUTATION")
      if (!recordType.trim() || !recordId.trim()) throw new Error("SF_SOURCE_INPUT_INVALID")
      const key = JSON.stringify([recordType, recordId])
      if (snapshot.sfSources!.records[key]?.alive) throw new Error("SF_SOURCE_CREATION_ALREADY_EXISTS")
      const entries = input.enumerate(surface, snapshot).filter((entry) => entry.recordType === recordType && entry.recordId === recordId)
      if (entries.length !== 1 || !/^[a-f0-9]{64}$/.test(entries[0]!.inputDigest))
        throw new Error("SF_SOURCE_CREATION_UNAVAILABLE")
      const prior = reserved.get(key)
      if (prior) {
        if (prior.inputDigest !== entries[0]!.inputDigest) throw new Error("SF_SOURCE_CREATION_CHANGED")
        return prior.incarnation
      }
      const incarnation = createScopedIncarnation(snapshot, input.createId)
      if ([...reserved.values()].some((entry) => entry.incarnation === incarnation))
        throw new Error("SF_SOURCE_INCARNATION_INVALID")
      reserved.set(key, { incarnation, inputDigest: entries[0]!.inputDigest })
      return incarnation
    }
    creationBinders.set(snapshot, bind)
    return {
      finish: () => {
        // The native store must see commit:true so it can poison the read root.
        if (sealedPreimage) return
        requireSourceIdentities(snapshot)
        if (before !== digestSfValue(snapshot.sfSources)) throw new Error("SF_SOURCE_IDENTITY_MUTATION")
        if (snapshot.audit.length < auditStart || digestSfValue(snapshot.audit.slice(0, auditStart)) !== auditPrefix) throw new Error("SF_SOURCE_AUDIT_REWRITTEN")
        const replacement = snapshot.audit.slice(auditStart).some((event) => event.record === "dataset")
        if (input.purpose === "business-restore") {
          if (!replacement) throw new Error("SF_RESTORE_MARKER_MISSING")
          if (productState === undefined) delete snapshot.data.__sfProductV1
          if (productState !== undefined) snapshot.data.__sfProductV1 = productState
        }
        const entries = input.enumerate(surface, snapshot)
        for (const [key, identity] of reserved) {
          const matches = entries.filter((entry) => JSON.stringify([entry.recordType, entry.recordId]) === key)
          if (replacement || matches.length !== 1 || matches[0]!.inputDigest !== identity.inputDigest)
            throw new Error("SF_SOURCE_CREATION_CHANGED")
        }
        synchronizeSources(snapshot, entries, input.createId, replacement, reserved)
        const projectionInput = surface === "dashboard" && dashboardProjectorCurrent() && authorityCurrent()
          ? dashboardDomainView(snapshot) : snapshot
        synchronizeScopes(surface, snapshot, input.projectScope, input.createId, projectionInput)
        requireSourceIdentities(snapshot)
      },
      dispose: () => {
        if (creationBinders.get(snapshot) !== bind) return
        if (previous) creationBinders.set(snapshot, previous)
        else creationBinders.delete(snapshot)
      },
    }
  }
  const readCheckScope = () => {
    const scope = scopedSourceChecks.getStore()
    if (scope) { requireSourceChecks(scope); admitSourceChecks(scope); requireSourceChecks(scope) }
    return scope
  }
  const checkReadCommit = (scope: ScopedSourceCheckScope | undefined, commit: boolean) => {
    if (!scope) return
    requireSourceChecks(scope)
    if (commit && admitSourceChecks(scope)) { scope.failed = true; throw new Error("SF_SOURCE_CHECK_WRITE_FORBIDDEN") }
  }
  const driver = input.persistence
  const readAuthority = input.observeAuthority
  const ownValue = (owner: object, name: string): unknown => {
    const descriptor = Object.getOwnPropertyDescriptor(owner, name)
    return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined
  }
  const rootReaders = readAuthority ? (["currentSnapshots", "currentSnapshot", "transaction"] as const).map((name) => ({
    name, method: ownValue(driver, name),
  })) : []
  const authorityCurrent = () => ownValue(input, "persistence") === driver && ownValue(input, "observeAuthority") === readAuthority &&
    rootReaders.every(({ name, method }) => typeof method === "function" && ownValue(driver, name) === method)
  const holdTargetPreimage = input.holdTargetPreimage
  const dashboardProjector = input.installedDashboardProjector
  const dashboardProjectorCurrent = () => !!dashboardProjector && ownValue(input, "projectScope") === dashboardProjector &&
    ownValue(input, "installedDashboardProjector") === dashboardProjector && sealedDigestsCurrent()
  const detachedDashboardAcl = (surface: Surface, snapshot: Snapshot, authorize: object) => {
    if (surface !== "dashboard" || !dashboardAclReaders.has(authorize) || !readAuthority || !authorityCurrent() || !dashboardProjectorCurrent()) return undefined
    if (types.isProxy(snapshot.data) || Object.getPrototypeOf(snapshot.data) !== Object.prototype) return undefined
    const fields = ["roleMap", "access"].map((name) => [name, Object.getOwnPropertyDescriptor(snapshot.data, name)] as const)
    if (fields.some(([name, descriptor]) => descriptor ? !Object.hasOwn(descriptor, "value") : name in snapshot.data)) return undefined
    return Object.fromEntries(fields.flatMap(([name, descriptor]) => descriptor ? [[name, descriptor.value]] : []))
  }
  const dashboardSourceOptions = (surface: Surface, checking: ScopedSourceCheckScope | undefined, authorize: object) => {
    if (surface !== "dashboard" || !checking || !admitSourceChecks(checking) || !dashboardAclReaders.has(authorize) ||
      !dashboardProjectorCurrent() || !authorityCurrent() || !sealedDigestsCurrent()) return undefined
    const root = readAuthority?.([])
    return root?.current() ? { dashboardSourceRoot: root.identity } : undefined
  }
  const observeAuthority: SnapshotAuthorityRead = (surfaces) => {
    if (!readAuthority || !authorityCurrent()) return undefined
    const observed = readAuthority(surfaces)
    if (!observed) return undefined
    readCheckScope()
    // A partial read replaces two single-surface forwarders. Both original
    // scope checks still run before the product authorizes the selected data.
    if (surfaces.length === 2) readCheckScope()
    const integrity = { current: true }
    return { snapshots: observed.snapshots, identity: observed.identity, bytesIdentity: observed.bytesIdentity, current: () => {
      integrity.current &&= observed.current() && authorityCurrent()
      return integrity.current
    } }
  }
  const rootPresence = input.hasSnapshotRoot
  const readRoot = driver.readSnapshotRoot
  const persistence: ReturnType<typeof createSfSourcePersistence> = {
    ...(input.persistence.hasCurrentSnapshots ? { hasCurrentSnapshots: () => { readCheckScope(); return input.persistence.hasCurrentSnapshots!() } } : {}),
    ...(input.persistence.currentSnapshotScope ? { currentSnapshotScope: () => { readCheckScope(); return input.persistence.currentSnapshotScope!() } } : {}),
    ...(rootPresence ? { hasSnapshotRoot: () => {
      readCheckScope()
      if (authorityCurrent() && ownValue(input, "hasSnapshotRoot") === rootPresence) return rootPresence()
      return !!input.persistence.currentSnapshots?.()
    } } : {}),
    ...(readRoot && rootPresence && readAuthority ? { readDashboardAuthority: <T>(work: () => Promise<T>, signal: AbortSignal) => {
      const checking = readCheckScope()
      const current = () => authorityCurrent() && sealedDigestsCurrent() && ownValue(driver, "readSnapshotRoot") === readRoot &&
        ownValue(input, "hasSnapshotRoot") === rootPresence
      const full = () => persistence.transaction("dashboard", async () => ({ commit: false, value: await work() }), { signal })
      if (!current()) throw new Error("SF_DASHBOARD_AUTHORITY_ROOT_CHANGED")
      if (rootPresence() || input.purpose === "business-restore") return full()
      return readRoot.call(driver, async () => {
        const root = current() && readAuthority([])
        if (!root || !root.current()) throw new Error("SF_DASHBOARD_AUTHORITY_ROOT_CHANGED")
        const identity = root.bytesIdentity ?? root.identity
        const value = !dashboardSourceProofs.has(identity)
          ? await persistence.transaction("dashboard", async () => ({ commit: false, value: await work() }), { signal, sealedRead: true })
          : await driver.transaction("dashboard", async () => {
            if (checking) requireSourceChecks(checking)
            if (!current()) throw new Error("SF_DASHBOARD_AUTHORITY_ROOT_CHANGED")
            const observed = readAuthority([])
            if (!observed || observed.identity !== root.identity || !observed.current()) throw new Error("SF_DASHBOARD_AUTHORITY_ROOT_CHANGED")
            const value = await work()
            checkReadCommit(checking, false)
            if (!current() || !observed.current()) throw new Error("SF_DASHBOARD_AUTHORITY_ROOT_CHANGED")
            return { commit: false, value }
          }, { signal, dashboardAclRoot: root.identity, sealedRead: true })
        if (!current() || !root.current()) throw new Error("SF_DASHBOARD_AUTHORITY_ROOT_CHANGED")
        return value
      }, { signal }) as Promise<T>
    } } : {}),
    ...(readAuthority ? { observeAuthority, readSealed: () => {
      if (!sealedDigestsCurrent()) return undefined
      const observed = observeAuthority([])
      if (!observed) return undefined
      const integrity = { current: true }
      const current = () => {
        integrity.current &&= observed.current() && sealedDigestsCurrent()
        return integrity.current
      }
      return { identity: observed.identity, bytesIdentity: observed.bytesIdentity, current, read: () => current() ? driver.currentSnapshots?.() : undefined }
    } } : {}),
    ...(input.persistence.currentSnapshots ? { currentSnapshots: () => { readCheckScope(); return input.persistence.currentSnapshots!() } } : {}),
    ...(input.persistence.currentSnapshot ? { currentSnapshot: (surface: Surface) => { readCheckScope(); return input.persistence.currentSnapshot!(surface) } } : {}),
    // Scope forwarding does not admit a source. Callers still enter transaction
    // below, preserving source guards and any underlying CurrentChoice fence.
    ...(input.persistence.readSnapshotRoot ? { readSnapshotRoot: <T>(work: () => Promise<T>, options?: TransactionOptions) =>
      { readCheckScope(); return input.persistence.readSnapshotRoot!(work, options) } } : {}),
    resolveScopedSource: async (surface, incarnation, authorize) => {
      const checking = readCheckScope()
      const options = dashboardSourceOptions(surface, checking, authorize)
      const lookupPreimage = !options && surface === "dashboard" && dashboardAclReaders.has(authorize) &&
        authorityCurrent() && dashboardProjectorCurrent() && ownValue(input, "holdTargetPreimage") === holdTargetPreimage
        ? holdTargetPreimage?.() : undefined
      const read = persistence.readScopedSource
      const scope = await input.persistence.transaction(surface, async (snapshot) => {
        const root = (options || lookupPreimage) && readAuthority?.([])
        if (options && (!root?.current() || root.identity !== options.dashboardSourceRoot || !authorityCurrent() || !dashboardProjectorCurrent()))
          throw new Error("SF_DASHBOARD_SOURCE_ROOT_CHANGED")
        // Each lookup observes the actual scoped entry. Its validated metadata
        // can be reused only for the same bytes in the held SQLite snapshot.
        requireObservationSources(snapshot, root?.current() ? root.bytesIdentity ?? root.identity : undefined)
        const entries = Object.values(snapshot.sfSources!.scopes ?? {}).filter((entry) => entry.alive && entry.incarnation === incarnation)
        const entry = entries.length === 1 ? entries[0] : undefined
        const acl = root && readAuthority?.(["dashboard"])
        if (root && (!acl || acl.identity !== root.identity || !acl.current())) throw new Error("SF_DASHBOARD_SOURCE_ROOT_CHANGED")
        const detachedAcl = acl ? undefined : detachedDashboardAcl(surface, snapshot, authorize)
        const data = acl?.snapshots.dashboard.data ?? detachedAcl
        const authorizationSnapshot = data ? { data: structuredClone(data), versions: {}, sequences: {}, audit: [], notices: [] } : snapshot
        if (!entry || !await authorize(authorizationSnapshot, structuredClone(entry.scope))) return { commit: false, value: undefined }
        if (root && (!root.current() || !acl?.current()) || data && (!authorityCurrent() || !dashboardProjectorCurrent()))
          throw new Error("SF_DASHBOARD_SOURCE_ROOT_CHANGED")
        return { commit: false, value: structuredClone(entry.scope) }
      }, options ?? (lookupPreimage ? { targetPreimageCurrent: lookupPreimage.current, sealedRead: true } : undefined))
      if (checking) requireSourceChecks(checking)
      if (!scope) return undefined
      const reauthorize = (snapshot: Snapshot) => authorize(snapshot, structuredClone(scope))
      if (dashboardAclReaders.has(authorize)) dashboardAclReaders.add(reauthorize)
      if (options && (ownValue(persistence, "readScopedSource") !== read || !authorityCurrent() || !dashboardProjectorCurrent()))
        throw new Error("SF_DASHBOARD_SOURCE_ROOT_CHANGED")
      const value = options
        ? await input.persistence.transaction(surface, (snapshot) => readScopedSnapshot(surface, snapshot, scope, reauthorize, options.dashboardSourceRoot), options)
        : await persistence.readScopedSource(surface, scope, reauthorize)
      if (checking) requireSourceChecks(checking)
      if (options && (ownValue(persistence, "readScopedSource") !== read || !authorityCurrent() || !dashboardProjectorCurrent()))
        throw new Error("SF_DASHBOARD_SOURCE_ROOT_CHANGED")
      return value?.incarnation === incarnation ? { ...value, scope } : undefined
    },
    readScopedSource: (surface, requested, authorize) => {
      const checking = readCheckScope()
      const options = dashboardSourceOptions(surface, checking, authorize)
      return input.persistence.transaction(surface, (snapshot) => readScopedSnapshot(surface, snapshot, requested, authorize, options?.dashboardSourceRoot), options)
    },
    readScopedSourcePrepared: (surface, prepare, options) => {
      const checking = readCheckScope()
      const driver = input.persistence
      const method = surface === "planner" && !types.isProxy(driver) && Object.getOwnPropertyDescriptor(driver, "transaction")
      return driver.transaction(surface, async (snapshot) => {
        if (checking) requireSourceChecks(checking)
        requireSourceIdentities(snapshot)
        const active = method && Object.getOwnPropertyDescriptor(driver, "transaction")
        const provider = !types.isProxy(input) && Object.getPrototypeOf(input) === Object.prototype &&
          Object.getOwnPropertyDescriptor(input, "persistence")
        const owned = method && Object.hasOwn(method, "value") && active && Object.hasOwn(active, "value") &&
          active.value === method.value && provider && Object.hasOwn(provider, "value") && provider.value === driver ?
          currentDriverReadonlyAuthorityData(driver, ["planner"]) : undefined
        // The installed preparer consumes ACL only. Its copy must remain separate
        // from the held ACL used by both later, fresh authorizations. All other
        // callbacks and changed copy operations retain the complete original view.
        const prepared = await prepare(owned && sfOriginalStructuredCloneCurrent() &&
          preparationApply(preparationHas, plannerAclPreparers, [prepare])
          ? { data: structuredClone(owned.snapshots.planner.data), versions: {}, sequences: {}, audit: [], notices: [] }
          : structuredClone(snapshot))
        if (checking) requireSourceChecks(checking)
        if (!prepared) return { commit: false, value: undefined }
        const acl = owned && plannerAclReaders.has(prepared.authorize) ? {
          snapshots: owned.snapshots,
          current: () => {
            const current = Object.getOwnPropertyDescriptor(input, "persistence")
            return Object.getPrototypeOf(input) === Object.prototype && !!current && Object.hasOwn(current, "value") &&
              current.value === driver && owned.current()
          },
        } : undefined
        if (acl && !acl.current()) return { commit: false, value: undefined }
        return readScopedSnapshot(surface, snapshot, prepared.scope, prepared.authorize, undefined, acl)
      }, options)
    },
    ...(input.persistence.currentSnapshots ? { checkScopedSource: async (surface: Surface, scope: SfSourceScope, authorize: (snapshot: Snapshot) => Promise<boolean>, expected: { incarnation: string; version: number; inputDigest: string }) => {
      readCheckScope()
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
    initializeSources: (surface) => {
      const checking = readCheckScope()
      return input.persistence.transaction(surface, async (snapshot) => {
        if (checking) requireSourceChecks(checking)
        if (snapshot.sfSources) {
          requireSourceIdentities(snapshot)
          return { commit: false, value: undefined }
        }
        checkReadCommit(checking, true)
        snapshot.sfSources = { schemaVersion: 1, records: {} }
        synchronizeSources(snapshot, input.enumerate(surface, snapshot), input.createId, false)
        return { commit: true, value: undefined }
      })
    },
    transaction: (surface, work, options) => {
      const checking = readCheckScope()
      const driver = input.persistence
      const method = !types.isProxy(driver) && Object.getOwnPropertyDescriptor(driver, "transaction")
      return driver.transaction(surface, async (snapshot, blobs) => {
        if (checking) requireSourceChecks(checking)
        const seal = options?.sealedRead && input.purpose !== "business-restore" && authorityCurrent() && readAuthority?.([])
        if (seal && seal.current()) {
          // Only the Dashboard snapshot covered by the held durable preimage
          // can reuse its pure source-metadata validation.
          const identity = surface === "dashboard" && sealedDigestsCurrent() ? seal.bytesIdentity ?? seal.identity : undefined
          requireObservationSources(snapshot, identity)
          const result = await work(snapshot, blobs)
          if (result.commit) {
            if (checking && admitSourceChecks(checking)) checking.failed = true
            // Let LocalStore reject the write and poison an inherited root.
            return result
          }
          checkReadCommit(checking, false)
          if (!seal.current() || !authorityCurrent() || identity && !sealedDigestsCurrent()) throw new Error("SF_SEALED_READ_CHANGED")
          return result
        }
        // A Team can predate the source catalog. Regular business reads remain
        // read-only; its first authorized write enrolls the sources atomically.
        if (snapshot.sfSources === undefined && input.bootstrapOnWrite) {
          const result = await work(snapshot, blobs)
          checkReadCommit(checking, result.commit)
          if (result.commit) {
            snapshot.sfSources = { schemaVersion: 1, records: {} }
            synchronizeSources(snapshot, input.enumerate(surface, snapshot), input.createId, false)
          }
          return result
        }
        requireSourceIdentities(snapshot)
        const active = method && Object.getOwnPropertyDescriptor(driver, "transaction")
        // A writable or opaque driver still needs the full preflight before work.
        const sealed = input.purpose !== "business-restore" && method && Object.hasOwn(method, "value") &&
          active && Object.hasOwn(active, "value") && active.value === method.value ?
          currentLocalReadonlyAuthorityData(driver, []) : undefined
        const sealedPreimage = sealed ? () => sealed.current() ? driver.currentSnapshot?.(surface) : undefined : undefined
        const guarded = guard(surface, snapshot, sealedPreimage)
        try {
          const result = await work(snapshot, blobs)
          if (result.commit && sealed) {
            if (checking && admitSourceChecks(checking)) checking.failed = true
          } else {
            checkReadCommit(checking, result.commit)
          }
          if (result.commit) guarded.finish()
          return result
        } finally { guarded.dispose() }
      }, options)
    },
    ...(input.persistence.transactionAll ? { transactionAll: <T>(work: (snapshots: Record<Surface, Snapshot>) => Promise<{ commit: boolean; value: T }>, options?: TransactionOptions) => {
      const checking = readCheckScope()
      return input.persistence.transactionAll!(async (snapshots) => {
        if (checking) requireSourceChecks(checking)
        const surfaces: readonly Surface[] = ["dashboard", "planner", "procurement"]
        const original = surfaces.map((surface) => snapshots[surface])
        const before = surfaces.map((surface) => digestSfValue(snapshots[surface]))
        const guarded = surfaces.map((surface) => guard(surface, snapshots[surface]))
        try {
          const result = await work(snapshots)
          checkReadCommit(checking, result.commit)
          if (result.commit) {
            if (surfaces.some((surface, index) => Object.getOwnPropertyDescriptor(snapshots, surface)?.value !== original[index]))
              throw new Error("SF_SOURCE_SNAPSHOT_REPLACED")
            surfaces.forEach((surface, index) => { if (digestSfValue(snapshots[surface]) !== before[index]) guarded[index]!.finish() })
          }
          return result
        } finally { guarded.forEach((entry) => entry.dispose()) }
      }, options)
    } } : {}),
  }
  if (persistence.checkScopedSource) canonicalSourceChecks.set(persistence, persistence.checkScopedSource)
  // Registration accepts no external callback. Only these freshly constructed
  // forwarders can identify this factory, and their base remains independently
  // recognized by LocalStore. Inspecting a custom input must not call a getter.
  if (!types.isProxy(input) && Object.getPrototypeOf(input) === Object.prototype) {
    const descriptor = Object.getOwnPropertyDescriptor(input, "persistence")
    const key = Object.getOwnPropertyDescriptor(persistence, "currentSnapshots")?.value
    if (descriptor && Object.hasOwn(descriptor, "value") && descriptor.value && typeof descriptor.value === "object" && typeof key === "function") {
      const base = descriptor.value
      const original = authorityMethods.map((name) => Object.getOwnPropertyDescriptor(persistence, name)?.value)
      sourceAuthorityReaders.set(key, { base, current: (owner) => {
        if (types.isProxy(owner) || Object.getPrototypeOf(owner) !== Object.prototype ||
          types.isProxy(input) || Object.getPrototypeOf(input) !== Object.prototype) return false
        const current = Object.getOwnPropertyDescriptor(input, "persistence")
        return !!current && Object.hasOwn(current, "value") && current.value === base && authorityMethods.every((name, index) => {
          const method = Object.getOwnPropertyDescriptor(owner, name)
          if (original[index] === undefined) return !method && !Object.getOwnPropertyDescriptor(Object.prototype, name)
          return !!method && Object.hasOwn(method, "value") && method.value === original[index]
        })
      } })
    }
  }
  if (input.installedDashboardProjector && readAuthority && holdTargetPreimage) installedSourceResolvers.add(persistence.resolveScopedSource)
  return persistence
}

export function sfSourceIdentity(snapshot: Snapshot, recordType: string, recordId: string) {
  requireSourceIdentities(snapshot)
  return readSourceIdentity(snapshot, recordType, recordId)
}

function readSourceIdentity(snapshot: Snapshot, recordType: string, recordId: string) {
  const identity = snapshot.sfSources!.records[JSON.stringify([recordType, recordId])]
  return identity?.alive ? structuredClone(identity) : undefined
}

/** Host-private lookup for a prepared command inside the same serializable transaction. */
export function sfScopedSourceIdentity(snapshot: Snapshot, scope: SfSourceScope) {
  requireSourceIdentities(snapshot)
  return readScopedIdentity(snapshot, scope, sfSourceIdentity)
}

function readScopedIdentity(snapshot: Snapshot, scope: SfSourceScope, read = readSourceIdentity) {
  const entry = snapshot.sfSources!.scopes?.[digestSfValue(scope)]
  const source = read(snapshot, scope.recordType, scope.recordId)
  return entry?.alive && source?.incarnation === entry.sourceIncarnation
    ? { incarnation: entry.incarnation, version: entry.version, inputDigest: entry.inputDigest }
    : undefined
}

function synchronizeSources(snapshot: Snapshot, entries: readonly SfSourceIdentityInput[], createId: () => string, replacement: boolean, reserved?: ReadonlyMap<string, { incarnation: string; inputDigest: string }>) {
  const keys = entries.map((entry) => JSON.stringify([entry.recordType, entry.recordId]))
  if (new Set(keys).size !== keys.length || entries.some((entry) => !entry.recordType.trim() || !entry.recordId.trim() || !/^[a-f0-9]{64}$/.test(entry.inputDigest))) throw new Error("SF_SOURCE_INPUT_INVALID")
  const records = snapshot.sfSources!.records
  for (const [key, identity] of Object.entries(records)) if (!keys.includes(key)) records[key] = { ...identity, alive: false }
  entries.forEach((entry, index) => {
    const prior = records[keys[index]!]
    if (!prior || !prior.alive || replacement) {
      const incarnation = reserved?.get(keys[index]!)?.incarnation ?? createId()
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
function dashboardDomainView(snapshot: Snapshot): Snapshot {
  // The exact installed Dashboard projector consumes the business domain.
  // Each source still receives its own clone before projection.
  return { data: Object.fromEntries(Object.entries(snapshot.data).filter(([key]) => key !== "__sfProductV1")),
    versions: snapshot.versions, sfSources: snapshot.sfSources, sequences: {}, audit: [], notices: [] }
}

function synchronizeScopes(surface: Surface, snapshot: Snapshot, project: ((surface: Surface, snapshot: Snapshot, scope: SfSourceScope) => unknown | undefined) | undefined, createId: () => string, projectionInput: Snapshot) {
  const entries = Object.values(snapshot.sfSources!.scopes ?? {})
  if (entries.length && !project) throw new Error("SF_SOURCE_SCOPE_PROJECTOR_UNAVAILABLE")
  entries.forEach((entry) => {
    const source = sfSourceIdentity(snapshot, entry.scope.recordType, entry.scope.recordId)
    const projection = project!(surface, structuredClone(projectionInput), structuredClone(entry.scope))
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
