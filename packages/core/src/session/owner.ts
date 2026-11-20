export * as SessionOwner from "./owner"

import { and, eq, sql, type SQL } from "drizzle-orm"
import { Context, Effect, Layer, Option, Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { SessionAccess } from "@orchestra/schema/session-access"
import type { SessionOwnerEvent } from "@orchestra/schema/session-owner-event"
import { Database } from "../database/database"
import { makeGlobalNode } from "../effect/app-node"
import { AuthorityGeneration } from "./authority-generation"
import { AuthorityGenerationRuntime } from "./authority-generation-runtime"
import { SessionOwnerTable } from "./owner.sql"
import { SessionSchema } from "./schema"
import { SessionTable } from "./sql"
import { CredentialVault } from "../credential/vault"
import { ProviderAdmission } from "../provider/admission"
import { ProviderAccess } from "@orchestra/schema/provider-access"

export class Denied extends Schema.TaggedErrorClass<Denied>()("SessionOwner.Denied", {
  reason: Schema.Literals([
    "missing-admission", "stale-admission", "foreign-owner", "unmapped-session",
    "retired-session", "storage-unavailable", "invalid-recovery", "transaction-required", "forbidden-operation",
  ]),
}) {}

export interface Inspection {
  readonly authorized: boolean
  readonly excludedSessions: ReadonlyArray<SessionSchema.ID>
}
export interface InspectionOperation {
  readonly action: SessionAccess.Action
  readonly sessionID?: SessionSchema.ID
}
export interface Admission {
  readonly binding: TeamProfile.Binding
  /** One fresh policy observation may answer several checks at the same boundary; it is never cached across awaits. */
  readonly inspect?: (operations: ReadonlyArray<InspectionOperation>) => Effect.Effect<Inspection | undefined>
  /** Private current Team configuration; absence never permits directory/global fallback. */
  readonly configuration?: () => Effect.Effect<TeamProfile.ConfigurationSnapshot | undefined>
  readonly connections?: CredentialVault.Factory
  readonly providers?: ProviderAdmission.Factory
  readonly authorize: (action: SessionAccess.Action, sessionID?: SessionSchema.ID) => Effect.Effect<boolean>
  /** Current resource exceptions within this owner; evaluated before SQL pagination. */
  readonly excludedSessions: () => Effect.Effect<ReadonlyArray<SessionSchema.ID>>
  /** Revalidates the captured server decision, including its original auth epoch and effective rights. */
  readonly verifyCurrent: () => Effect.Effect<boolean>
}

export interface RecoveryMapping {
  readonly owner: TeamProfile.Owner
  readonly sessionIds: ReadonlyArray<SessionSchema.ID>
  /** The durable journal verifies this exact mapping and the restore effect frontier. */
  readonly verifyCurrent: () => Effect.Effect<boolean>
}

/** Only the issuing service recognizes this object. A decoded copy has no authority. */
export interface Lease { readonly _tag: "SessionOwner.Lease" }
export interface Scope { readonly _tag: "SessionOwner.Scope" }
/** A process-local cache partition and revocable constructor context; never a wire namespace. */
export interface LocationBinding {
  readonly key: object
  readonly bind: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
}
export type Operation = SessionAccess.Action | "replay"
type Failure = Denied | AuthorityGeneration.GenerationError

type LeaseData = Readonly<{
  database: Database.Interface
  owner: TeamProfile.Owner
  generation: number
  verifyCurrent: () => Effect.Effect<boolean>
  kind: "request" | "recovery"
  revisions?: TeamProfile.Revisions
  configuration?: Admission["configuration"]
  connections?: Admission["connections"]
  providers?: Admission["providers"]
  inspect?: Admission["inspect"]
  authorize?: Admission["authorize"]
  excludedSessions?: Admission["excludedSessions"]
  sessionIds?: ReadonlySet<SessionSchema.ID>
}>
type ScopeData = Readonly<{
  database: Database.Interface
  generation: AuthorityGeneration.Interface | undefined
  lease: LeaseData | undefined
  hasTable: boolean
}>

const leases = new WeakMap<Lease, LeaseData>()
const scopes = new WeakMap<Scope, ScopeData>()
const listed = new WeakMap<Scope, ReadonlyArray<SessionSchema.ID>>()
const locationBindings = new WeakMap<Lease, Map<string, LocationBinding>>()
const CurrentOperation = Context.Reference<Readonly<{ scope: Scope; sessionID: SessionSchema.ID; action: Operation }> | undefined>(
  "@orchestra/SessionOwner/Operation", { defaultValue: () => undefined },
)
const Current = Context.Reference<Lease | undefined>("@orchestra/SessionOwner/Current", {
  defaultValue: () => undefined,
})

export const withLease = <A, E, R>(lease: Lease, effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.provideService(Current, lease))

export interface Interface {
  readonly capture: (readCurrent: () => Effect.Effect<Admission | undefined>) => Effect.Effect<Lease | undefined, Failure>
  readonly captureRecovery: (readMapping: () => Effect.Effect<RecoveryMapping | undefined>) => Effect.Effect<Lease | undefined, Failure>
  readonly open: () => Effect.Effect<Scope, Failure>
  readonly bind: Effect.Effect<<A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>, Failure>
  /** Undefined means no request lease is installed; it does not prove that this is a technical store. */
  readonly active: Effect.Effect<Scope | undefined, Failure>
  readonly location: Effect.Effect<LocationBinding | undefined, Failure>
  readonly configuration: (scope: Scope) => Effect.Effect<TeamProfile.ConfigurationSnapshot | undefined, Failure>
  readonly connections: (scope: Scope) => Effect.Effect<CredentialVault.Interface | undefined, Failure>
  readonly providers: (scope: Scope) => Effect.Effect<ProviderAdmission.Interface | undefined, Failure>
  /** Requires the exact currently installed lease, not just an equal owner label. */
  readonly assertCurrent: (scope: Scope) => Effect.Effect<void, Failure>
  readonly verify: (scope: Scope) => Effect.Effect<void, Failure>
  readonly assert: (scope: Scope, sessionID: SessionSchema.ID, operation: Operation) => Effect.Effect<void, Failure>
  readonly authorize: (scope: Scope, operation: Operation, sessionID?: SessionSchema.ID) => Effect.Effect<void, Failure>
  readonly canRead: (scope: Scope, sessionID: SessionSchema.ID) => Effect.Effect<boolean, Failure>
  readonly predicate: (scope: Scope) => Effect.Effect<SQL | undefined, Failure>
  readonly owner: (scope: Scope) => TeamProfile.Owner | undefined
  readonly generation: (scope: Scope) => number | undefined
  readonly eventOperation: (scope: Scope, sessionID: SessionSchema.ID, fallback: Operation) => Effect.Effect<Operation>
  readonly bindNew: (scope: Scope, sessionID: SessionSchema.ID) => Effect.Effect<void, Failure>
  readonly confirmBound: (event: SessionOwnerEvent.Bound, replay: boolean) => Effect.Effect<void, Failure>
  readonly withWriter: <A, E, R>(scope: Scope, effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E | Failure, R>
}

export class Service extends Context.Service<Service, Interface>()("@orchestra/SessionOwner") {}

const sameOwner = (left: TeamProfile.Owner, right: TeamProfile.Owner) =>
  left.profile.installationId === right.profile.installationId &&
  left.profile.tenantId === right.profile.tenantId &&
  left.profile.teamObjectId === right.profile.teamObjectId &&
  left.principal.tenantId === right.principal.tenantId &&
  left.principal.principalObjectId === right.principal.principalObjectId

const freezeOwner = (owner: TeamProfile.Owner): TeamProfile.Owner => Object.freeze({
  profile: Object.freeze({ ...owner.profile }),
  principal: Object.freeze({ ...owner.principal }),
})

const layer = Layer.effect(Service, Effect.gen(function* () {
  const database = yield* Database.Service
  const db = database.db
  const provider = yield* AuthorityGeneration.Service
  const hasTable = (name: string) => db.get<{ name: string }>(
    sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ${name}`,
  ).pipe(Effect.orDie, Effect.map((row) => row !== undefined))
  const marked = Effect.gen(function* () {
    if (!(yield* hasTable("sf_authority_generation"))) return false
    // Even an empty or malformed marker denotes unavailable corporate storage.
    return true
  })
  const verifyProof = (proof: () => Effect.Effect<boolean>) => proof().pipe(
    Effect.catchCause(() => Effect.succeed(false)),
    Effect.flatMap((valid) => valid ? Effect.void : Effect.fail(new Denied({ reason: "stale-admission" }))),
  )
  const data = (scope: Scope) => {
    const retained = scopes.get(scope)
    if (!retained || retained.database !== database) throw new Denied({ reason: "missing-admission" })
    return retained
  }
  const exclusions = (retained: LeaseData) => Effect.gen(function* () {
    if (!retained.excludedSessions) return yield* new Denied({ reason: "missing-admission" })
    const values = yield* retained.excludedSessions().pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(SessionAccess.ExcludedSessions)),
      Effect.mapError(() => new Denied({ reason: "stale-admission" })),
    )
    if (new Set(values).size !== values.length) return yield* new Denied({ reason: "stale-admission" })
    return values.toSorted()
  })
  const inspect = (scope: Scope, additional?: Readonly<{ action: Operation; sessionID?: SessionSchema.ID }>) =>
    Effect.gen(function* () {
      const retained = data(scope)
      if (!retained.lease?.inspect || !retained.generation || retained.lease.kind !== "request")
        return yield* new Denied({ reason: "missing-admission" })
      if (!(yield* retained.generation.verifyGeneration(retained.lease.generation)))
        return yield* new Denied({ reason: "stale-admission" })
      const current = yield* CurrentOperation
      const operation = current && scopes.get(current.scope)?.database === database &&
        scopes.get(current.scope)?.lease === retained.lease ? current : undefined
      const operations: InspectionOperation[] = []
      for (const value of [operation, additional]) {
        if (!value) continue
        if (value.action === "replay") return yield* new Denied({ reason: "forbidden-operation" })
        if (!operations.some((entry) => entry.action === value.action && entry.sessionID === value.sessionID))
          operations.push(Object.freeze({ action: value.action, ...(value.sessionID ? { sessionID: value.sessionID } : {}) }))
      }
      const checked = yield* retained.lease.inspect(Object.freeze(operations)).pipe(Effect.catchCause(() => Effect.succeed(undefined)))
      if (!checked) return yield* new Denied({ reason: "stale-admission" })
      if (checked.authorized !== true) return yield* new Denied({ reason: "forbidden-operation" })
      const excluded = yield* Schema.decodeUnknownEffect(SessionAccess.ExcludedSessions)(checked.excludedSessions)
        .pipe(Effect.mapError(() => new Denied({ reason: "stale-admission" })))
      const ordered = excluded.toSorted()
      const observed = listed.get(scope)
      if (observed && JSON.stringify(ordered) !== JSON.stringify(observed))
        return yield* new Denied({ reason: "stale-admission" })
      if (!(yield* retained.generation.verifyGeneration(retained.lease.generation)))
        return yield* new Denied({ reason: "stale-admission" })
      return ordered
    })
  const verify: Interface["verify"] = (scope) => Effect.gen(function* () {
    const retained = data(scope)
    if (!retained.lease) {
      if ((retained.generation && (yield* retained.generation.current) !== undefined) || (yield* marked))
        return yield* new Denied({ reason: "missing-admission" })
      return
    }
    if (retained.lease.kind === "request" && retained.lease.inspect) { yield* inspect(scope); return }
    if (!retained.generation || !(yield* retained.generation.verifyGeneration(retained.lease.generation)))
      return yield* new Denied({ reason: "stale-admission" })
    yield* verifyProof(retained.lease.verifyCurrent)
    const operation = yield* CurrentOperation
    if (operation && scopes.get(operation.scope)?.database === database &&
        scopes.get(operation.scope)?.lease === retained.lease && retained.lease.kind === "request" &&
        (operation.action === "replay" || !retained.lease.authorize || !(yield* retained.lease.authorize(operation.action, operation.sessionID))))
      return yield* new Denied({ reason: "forbidden-operation" })
    const observed = listed.get(scope)
    if (observed && JSON.stringify(yield* exclusions(retained.lease)) !== JSON.stringify(observed))
      return yield* new Denied({ reason: "stale-admission" })
    if (!(yield* retained.generation.verifyGeneration(retained.lease.generation)))
      return yield* new Denied({ reason: "stale-admission" })
  })
  const open: Interface["open"] = () => Effect.gen(function* () {
    const handle = yield* Current
    const retained = handle ? leases.get(handle) : undefined
    if (handle && (!retained || retained.database !== database))
      return yield* new Denied({ reason: "missing-admission" })
    const scope = Object.freeze({ _tag: "SessionOwner.Scope" } satisfies Scope)
    scopes.set(scope, { database, generation: provider, lease: retained, hasTable: yield* hasTable("session_owner") })
    yield* verify(scope)
    if (retained && !data(scope).hasTable) return yield* new Denied({ reason: "storage-unavailable" })
    return scope
  })
  const readOwner = (sessionID: SessionSchema.ID) => Effect.gen(function* () {
    const row = yield* db.select().from(SessionOwnerTable).where(eq(SessionOwnerTable.session_id, sessionID)).get().pipe(Effect.orDie)
    if (!row) return undefined
    const owner = yield* Schema.decodeUnknownEffect(TeamProfile.Owner)({
      profile: { installationId: row.installation_id, tenantId: row.tenant_id, teamObjectId: row.team_object_id },
      principal: { tenantId: row.tenant_id, principalObjectId: row.principal_object_id },
    }).pipe(Effect.mapError(() => new Denied({ reason: "storage-unavailable" })))
    if (!Number.isSafeInteger(row.generation) || row.generation < 1)
      return yield* new Denied({ reason: "storage-unavailable" })
    return { owner, generation: row.generation }
  })
  const authorize: Interface["authorize"] = (scope, operation, sessionID) => Effect.gen(function* () {
    const retained = data(scope).lease
    if (retained?.kind === "request" && retained.inspect) {
      yield* inspect(scope, { action: operation, ...(sessionID ? { sessionID } : {}) })
      return
    }
    yield* verify(scope)
    if (!retained) return
    if (retained.kind === "recovery") {
      if ((operation !== "read" && operation !== "replay") || sessionID && !retained.sessionIds?.has(sessionID))
        return yield* new Denied({ reason: "invalid-recovery" })
      return
    }
    if (operation === "replay" || !retained.authorize || !(yield* retained.authorize(operation, sessionID)))
      return yield* new Denied({ reason: "forbidden-operation" })
    yield* verify(scope)
  })
  const assert: Interface["assert"] = (scope, sessionID, operation) => Effect.gen(function* () {
    yield* authorize(scope, operation, sessionID)
    const retained = data(scope)
    if (retained.lease?.kind === "recovery" &&
      (operation !== "read" && operation !== "replay" || !retained.lease.sessionIds?.has(sessionID)))
      return yield* new Denied({ reason: "invalid-recovery" })
    const recorded = retained.hasTable ? yield* readOwner(sessionID) : undefined
    if (!retained.lease) {
      if (recorded) return yield* new Denied({ reason: "foreign-owner" })
      yield* verify(scope)
      return
    }
    if (recorded && !sameOwner(recorded.owner, retained.lease.owner))
      return yield* new Denied({ reason: "foreign-owner" })
    if (recorded && operation !== "create") {
      yield* verify(scope)
      return
    }
    if (!recorded && operation !== "create")
      return yield* new Denied({ reason: "unmapped-session" })
    const existing = yield* db.select({ id: SessionTable.id }).from(SessionTable)
      .where(eq(SessionTable.id, sessionID)).get().pipe(Effect.orDie)
    if (recorded && !existing) return yield* new Denied({ reason: "retired-session" })
    if (!recorded && existing) return yield* new Denied({ reason: "unmapped-session" })
    yield* verify(scope)
  })
  const capture = (read: () => Effect.Effect<Admission | RecoveryMapping | undefined>, recovery: boolean) =>
    Effect.gen(function* () {
      if (!provider) return yield* new Denied({ reason: "missing-admission" })
      const generation = yield* provider.current
      if (generation === undefined || !Number.isSafeInteger(generation) || generation < 1)
        return yield* new Denied({ reason: "missing-admission" })
      const observed = yield* read()
      if (!observed) return undefined
      const binding = "binding" in observed
        ? yield* Schema.decodeUnknownEffect(TeamProfile.Binding)(observed.binding)
          .pipe(Effect.mapError(() => new Denied({ reason: "missing-admission" })))
        : undefined
      const owner = freezeOwner(binding?.owner ?? (yield* Schema.decodeUnknownEffect(TeamProfile.Owner)(
        "owner" in observed ? observed.owner : undefined,
      ).pipe(Effect.mapError(() => new Denied({ reason: "missing-admission" })))))
      const revisions = binding ? Object.freeze({ ...binding.revisions }) : undefined
      const sessionIds = "sessionIds" in observed
        ? yield* Schema.decodeUnknownEffect(Schema.Array(SessionSchema.ID))(observed.sessionIds)
          .pipe(Effect.mapError(() => new Denied({ reason: "invalid-recovery" })))
        : undefined
      if (recovery !== (sessionIds !== undefined) || sessionIds?.length === 0 ||
        sessionIds && new Set(sessionIds).size !== sessionIds.length)
        return yield* new Denied({ reason: "invalid-recovery" })
      if (!recovery && (!("binding" in observed) || typeof observed.authorize !== "function" || typeof observed.excludedSessions !== "function"))
        return yield* new Denied({ reason: "missing-admission" })
      const verifyCurrent = observed.verifyCurrent
      const inspection = "binding" in observed ? observed.inspect : undefined
      const configuration = "binding" in observed ? observed.configuration : undefined
      const connections = "binding" in observed ? observed.connections : undefined
      const providers = "binding" in observed ? observed.providers : undefined
      const authorize = "binding" in observed ? observed.authorize : undefined
      const excludedSessions = "binding" in observed ? observed.excludedSessions : undefined
      const mappedSessions = sessionIds ? new Set(sessionIds) : undefined
      if (inspection !== undefined && typeof inspection !== "function" ||
          configuration !== undefined && typeof configuration !== "function" ||
          connections !== undefined && typeof connections !== "function" ||
          providers !== undefined && typeof providers !== "function")
        return yield* new Denied({ reason: "missing-admission" })
      yield* verifyProof(verifyCurrent)
      if (!(yield* provider.verifyGeneration(generation))) return yield* new Denied({ reason: "stale-admission" })
      const lease = Object.freeze({ _tag: "SessionOwner.Lease" } satisfies Lease)
      leases.set(lease, {
        database, owner: freezeOwner(owner), generation, verifyCurrent,
        kind: recovery ? "recovery" : "request",
        ...(authorize && excludedSessions ? { authorize, excludedSessions } : {}),
        ...(inspection ? { inspect: inspection } : {}),
        ...(revisions ? { revisions } : {}),
        ...(configuration ? { configuration } : {}),
        ...(connections ? { connections } : {}),
        ...(providers ? { providers } : {}),
        ...(mappedSessions ? { sessionIds: mappedSessions } : {}),
      })
      return lease
    })
  const result: Interface = {
    capture: (readCurrent) => capture(readCurrent, false),
    captureRecovery: (readMapping) => capture(readMapping, true),
    open,
    bind: Effect.gen(function* () {
      const handle = yield* Current
      yield* open()
      return <A, E, R>(effect: Effect.Effect<A, E, R>) => effect.pipe(Effect.provideService(Current, handle))
    }),
    active: Effect.flatMap(Current, (lease) => lease ? open() : Effect.succeed(undefined)),
    location: Effect.gen(function* () {
      const scope = yield* open()
      const handle = yield* Current
      if (!handle) return undefined
      if (data(scope).lease?.kind !== "request") return yield* new Denied({ reason: "invalid-recovery" })
      const operation = yield* CurrentOperation
      const signature = JSON.stringify(operation ? [operation.action, operation.sessionID] : [])
      let entries = locationBindings.get(handle)
      if (!entries) { entries = new Map(); locationBindings.set(handle, entries) }
      const known = entries.get(signature)
      if (known) return known
      const binding: LocationBinding = Object.freeze({
        key: Object.freeze({}),
        bind: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.gen(function* () {
          yield* verify(scope).pipe(Effect.orDie)
          const value = yield* effect
          yield* verify(scope).pipe(Effect.orDie)
          return value
        }).pipe(Effect.provideService(Current, handle), Effect.provideService(CurrentOperation, operation)),
      })
      entries.set(signature, binding)
      return binding
    }),
    assertCurrent: (scope) => Effect.gen(function* () {
      const handle = yield* Current
      const retained = data(scope)
      if (!handle || !retained.lease || leases.get(handle) !== retained.lease || retained.lease.kind !== "request")
        return yield* new Denied({ reason: "missing-admission" })
      yield* verify(scope)
    }),
    providers: (scope) => Effect.gen(function* () {
      yield* verify(scope)
      const retained = data(scope)
      const lease = retained.lease
      if (!lease) return undefined
      if (lease.kind !== "request" || !lease.providers || !retained.generation)
        return yield* new Denied({ reason: "storage-unavailable" })
      const generation = retained.generation
      const fence = () => generation.verifyGeneration(lease.generation)
        .pipe(Effect.catchCause(() => Effect.succeed(false)))
      const client = yield* lease.providers(fence).pipe(Effect.catchCause(() => Effect.succeed(undefined)))
      const owner = yield* Schema.decodeUnknownEffect(TeamProfile.Owner)(client?.owner)
        .pipe(Effect.mapError(() => new Denied({ reason: "storage-unavailable" })))
      if (!client || !sameOwner(owner, lease.owner))
        return yield* new Denied({ reason: "stale-admission" })
      yield* verify(scope)
      const check = <A>(effect: Effect.Effect<A, ProviderAdmission.Denied>) => Effect.gen(function* () {
        yield* result.assertCurrent(scope)
        const value = yield* effect
        yield* result.assertCurrent(scope)
        return value
      }).pipe(Effect.mapError((error) => error instanceof ProviderAdmission.Denied ? error :
        new ProviderAdmission.Denied({ reason: "unavailable" })))
      const bound: ProviderAdmission.Interface = {
        owner: freezeOwner(owner),
        list: () => check(Effect.gen(function* () {
          const values = yield* client.list()
          const decoded = yield* Schema.decodeUnknownEffect(ProviderAccess.Bindings)(values)
            .pipe(Effect.mapError(() => new ProviderAdmission.Denied({ reason: "unavailable" })))
          if (!decoded.every((value) => value.profile.installationId === owner.profile.installationId &&
            value.profile.tenantId === owner.profile.tenantId && value.profile.teamObjectId === owner.profile.teamObjectId))
            return yield* new ProviderAdmission.Denied({ reason: "unavailable" })
          return Object.freeze(decoded.map((value) => Object.freeze({ ...value,
            profile: Object.freeze({ ...value.profile }), connection: Object.freeze({ ...value.connection }),
            models: Object.freeze(value.models.map((model) => Object.freeze({ ...model, limit: Object.freeze({ ...model.limit }) }))),
          })))
        })),
        verify: (value) => {
          const binding = Schema.decodeUnknownSync(ProviderAccess.Binding)(value)
          const selected = Object.freeze({ ...binding, profile: Object.freeze({ ...binding.profile }),
            connection: Object.freeze({ ...binding.connection }), models: Object.freeze(binding.models.map((model) =>
              Object.freeze({ ...model, limit: Object.freeze({ ...model.limit }) }))) })
          return check(client.verify(selected))
        },
      }
      return Object.freeze(bound)
    }),
    connections: (scope) => Effect.gen(function* () {
      yield* verify(scope)
      const retained = data(scope)
      const lease = retained.lease
      if (!lease) return undefined
      if (lease.kind !== "request" || !lease.connections || !retained.generation)
        return yield* new Denied({ reason: "storage-unavailable" })
      // Final policy is read by the vault inside its own locked SQL read scope.
      // This fence verifies the independent generation without opening a nested SF business transaction.
      const generation = retained.generation
      const fence = () => generation.verifyGeneration(lease.generation)
        .pipe(Effect.catchCause(() => Effect.succeed(false)))
      const client = yield* lease.connections(fence).pipe(Effect.catchCause(() => Effect.succeed(undefined)))
      const owner = yield* Schema.decodeUnknownEffect(TeamProfile.Owner)(client?.owner)
        .pipe(Effect.mapError(() => new Denied({ reason: "storage-unavailable" })))
      if (!client || !sameOwner(owner, lease.owner))
        return yield* new Denied({ reason: "stale-admission" })
      yield* verify(scope)
      const check = <A>(effect: Effect.Effect<A, CredentialVault.Denied>) => Effect.gen(function* () {
        yield* result.assertCurrent(scope)
        const value = yield* effect
        yield* result.assertCurrent(scope)
        return value
      }).pipe(Effect.mapError((error) => error instanceof CredentialVault.Denied ? error :
        new CredentialVault.Denied({ reason: "unavailable" })))
      const write = <A>(effect: Effect.Effect<A, CredentialVault.Denied>) =>
        result.withWriter(scope, check(effect)).pipe(Effect.mapError((error) =>
          error instanceof CredentialVault.Denied ? error : new CredentialVault.Denied({ reason: "unavailable" })))
      const bound: CredentialVault.Interface = {
        owner: freezeOwner(owner),
        check: (action, resource) => check(client.check(action, resource)),
        list: (category, resourceId) => check(client.list(category, resourceId)),
        inspect: (key) => check(client.inspect(key)),
        read: (key) => check(client.read(key)),
        write: (input) => write(client.write(input)),
        remove: (input) => write(client.remove(input)),
      }
      return Object.freeze(bound)
    }),
    configuration: (scope) => Effect.gen(function* () {
      yield* verify(scope)
      const retained = data(scope).lease
      if (!retained) return undefined
      if (retained.kind !== "request" || !retained.configuration || !retained.revisions)
        return yield* new Denied({ reason: "storage-unavailable" })
      const value = yield* retained.configuration().pipe(Effect.catchCause(() => Effect.succeed(undefined)))
      const snapshot = yield* Schema.decodeUnknownEffect(TeamProfile.ConfigurationSnapshot)(value)
        .pipe(Effect.mapError(() => new Denied({ reason: "storage-unavailable" })))
      if (snapshot.profile.installationId !== retained.owner.profile.installationId ||
          snapshot.profile.tenantId !== retained.owner.profile.tenantId ||
          snapshot.profile.teamObjectId !== retained.owner.profile.teamObjectId ||
          snapshot.configRevision !== retained.revisions.configRevision)
        return yield* new Denied({ reason: "stale-admission" })
      yield* verify(scope)
      return Object.freeze({
        ...snapshot, profile: Object.freeze({ ...snapshot.profile }),
        document: Object.freeze({ ...snapshot.document, settings: Object.freeze({
          ...snapshot.document.settings,
          ...(snapshot.document.settings.agents ? { agents: Object.freeze(Object.fromEntries(
            Object.entries(snapshot.document.settings.agents).map(([id, agent]) => [id, Object.freeze({ ...agent })]),
          )) } : {}),
        }) }),
      })
    }),
    verify,
    assert,
    authorize,
    canRead: (scope, sessionID) => assert(scope, sessionID, "read").pipe(
      Effect.as(true),
      Effect.catchTag("SessionOwner.Denied", (error) =>
        error.reason === "foreign-owner" || error.reason === "unmapped-session" || error.reason === "forbidden-operation"
          ? Effect.succeed(false) : Effect.fail(error)),
    ),
    predicate: (scope) => Effect.gen(function* () {
      const retained = data(scope)
      const inspected = retained.lease?.kind === "request" && retained.lease.inspect
        ? yield* inspect(scope, { action: "read" }) : undefined
      if (!inspected) yield* authorize(scope, "read")
      if (!retained.hasTable) return undefined
      if (!retained.lease) return sql`NOT EXISTS (SELECT 1 FROM session_owner WHERE session_owner.session_id = ${SessionTable.id})`
      const owner = retained.lease.owner
      const match = sql`EXISTS (SELECT 1 FROM session_owner
        WHERE session_owner.session_id = ${SessionTable.id}
        AND session_owner.installation_id = ${owner.profile.installationId}
        AND session_owner.tenant_id = ${owner.profile.tenantId}
        AND session_owner.team_object_id = ${owner.profile.teamObjectId}
        AND session_owner.principal_object_id = ${owner.principal.principalObjectId})`
      if (!retained.lease.sessionIds) {
        const excluded = inspected ?? (yield* exclusions(retained.lease))
        listed.set(scope, excluded)
        if (!inspected) yield* verify(scope)
        return excluded.length ? and(match, sql`${SessionTable.id} NOT IN (${sql.join(excluded.map((id) => sql`${id}`), sql`, `)})`) : match
      }
      return and(match, sql`${SessionTable.id} IN (${sql.join(Array.from(retained.lease.sessionIds).map((id) => sql`${id}`), sql`, `)})`)
    }),
    owner: (scope) => data(scope).lease?.owner,
    generation: (scope) => data(scope).lease?.generation,
    eventOperation: (scope, sessionID, fallback) => Effect.map(CurrentOperation, (operation) =>
      operation && operation.sessionID === sessionID && scopes.get(operation.scope)?.database === database &&
      scopes.get(operation.scope)?.lease === data(scope).lease ? operation.action : fallback),
    bindNew: (scope, sessionID) => Effect.gen(function* () {
      const retained = data(scope)
      if (!retained.lease) { yield* assert(scope, sessionID, "create"); return }
      if (!database.inTransaction || !(yield* database.inTransaction))
        return yield* new Denied({ reason: "transaction-required" })
      yield* assert(scope, sessionID, "create")
      const owner = retained.lease.owner
      const inserted = yield* db.insert(SessionOwnerTable).values({
        session_id: sessionID, installation_id: owner.profile.installationId,
        tenant_id: owner.profile.tenantId, team_object_id: owner.profile.teamObjectId,
        principal_object_id: owner.principal.principalObjectId, generation: retained.lease.generation,
      }).onConflictDoNothing().returning({ id: SessionOwnerTable.session_id }).get().pipe(Effect.orDie)
      if (!inserted) yield* assert(scope, sessionID, "create")
      yield* verify(scope)
    }),
    confirmBound: (event, replay) => Effect.gen(function* () {
      const scope = yield* open()
      yield* assert(scope, event.data.sessionID, replay ? "replay" : "create")
      const retained = data(scope)
      const recorded = yield* readOwner(event.data.sessionID)
      if (!retained.lease || !recorded || !sameOwner(recorded.owner, event.data.owner) ||
        recorded.generation !== event.data.generation)
        return yield* new Denied({ reason: "unmapped-session" })
      yield* verify(scope)
    }),
    withWriter: (scope, effect) => Effect.gen(function* () {
      yield* verify(scope)
      const retained = data(scope)
      return yield* (retained.lease && retained.generation
        ? retained.generation.withWriter(retained.lease.generation, effect)
        : effect)
    }),
  }
  return result
}))

/**
 * Core's defensive boundary retains each operation's existing typed domain
 * errors. HTTP admission translates Denied before invoking these services.
 */
export const guard = <A, E, R>(
  service: Interface,
  sessionID: SessionSchema.ID,
  operation: Operation,
  use: (scope: Scope) => Effect.Effect<A, E, R>,
) => Effect.gen(function* () {
  const scope = yield* service.open().pipe(Effect.orDie)
  yield* service.assert(scope, sessionID, operation).pipe(Effect.orDie)
  const value = yield* use(scope).pipe(Effect.provideService(CurrentOperation, Object.freeze({ scope, sessionID, action: operation })))
  yield* service.assert(scope, sessionID, operation).pipe(Effect.orDie)
  return value
})

/** A missing service is not proof that a storage is technical. */
export const ensureTechnical = (db: Database.Interface["db"]) => Effect.gen(function* () {
  const marker = yield* db.get(sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sf_authority_generation'`).pipe(Effect.orDie)
  if (marker)
    return yield* Effect.die(new Denied({ reason: "missing-admission" }))
  const table = yield* db.get(sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'session_owner'`).pipe(Effect.orDie)
  if (table && (yield* db.get(sql`SELECT 1 FROM session_owner LIMIT 1`).pipe(Effect.orDie)))
    return yield* Effect.die(new Denied({ reason: "missing-admission" }))
})

/** A service from another graph cannot authorize a naked SQL reader. */
export const scopeForDatabase = (service: Interface, db: Database.Interface["db"]) => Effect.gen(function* () {
  const scope = yield* service.open()
  if (scopes.get(scope)?.database.db !== db) return yield* new Denied({ reason: "missing-admission" })
  return scope
})

/** Bare technical consumers still refuse a marked store or a durable corporate owner. */
export const access = <A, E, R>(
  db: Database.Interface["db"],
  sessionID: SessionSchema.ID,
  operation: Operation,
  effect: Effect.Effect<A, E, R>,
) => Effect.gen(function* () {
  const service = Option.getOrUndefined(yield* Effect.serviceOption(Service))
  if (service) {
    yield* scopeForDatabase(service, db).pipe(Effect.orDie)
    return yield* guard(service, sessionID, operation, () => effect)
  }
  const check = Effect.gen(function* () {
    const marker = yield* db.get(sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sf_authority_generation'`).pipe(Effect.orDie)
    if (marker)
      return yield* Effect.die(new Denied({ reason: "missing-admission" }))
    const table = yield* db.get(sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'session_owner'`).pipe(Effect.orDie)
    if (table && (yield* db.get(sql`SELECT session_id FROM session_owner WHERE session_id = ${sessionID}`).pipe(Effect.orDie)))
      return yield* Effect.die(new Denied({ reason: "foreign-owner" }))
  })
  yield* check
  const value = yield* effect
  yield* check
  return value
})

export const node = makeGlobalNode({ service: Service, layer, deps: [Database.node, AuthorityGenerationRuntime.node] })
