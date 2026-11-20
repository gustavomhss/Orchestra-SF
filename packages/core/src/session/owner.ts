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

export class Denied extends Schema.TaggedErrorClass<Denied>()("SessionOwner.Denied", {
  reason: Schema.Literals([
    "missing-admission", "stale-admission", "foreign-owner", "unmapped-session",
    "retired-session", "storage-unavailable", "invalid-recovery", "transaction-required", "forbidden-operation",
  ]),
}) {}

export interface Admission {
  readonly binding: TeamProfile.Binding
  readonly authorize: (action: Operation, sessionID?: SessionSchema.ID) => Effect.Effect<boolean>
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
export type Operation = SessionAccess.Action
type Failure = Denied | AuthorityGeneration.GenerationError

type LeaseData = Readonly<{
  database: Database.Interface
  owner: TeamProfile.Owner
  generation: number
  verifyCurrent: () => Effect.Effect<boolean>
  kind: "request" | "recovery"
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
    // An unknown/nonempty marker is never interpreted as a technical store.
    const row = yield* db.get(sql`SELECT 1 FROM sf_authority_generation LIMIT 1`).pipe(Effect.orDie)
    return row !== undefined
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
  const verify: Interface["verify"] = (scope) => Effect.gen(function* () {
    const retained = data(scope)
    if (!retained.lease) {
      if ((retained.generation && (yield* retained.generation.current) !== undefined) || (yield* marked))
        return yield* new Denied({ reason: "missing-admission" })
      return
    }
    if (!retained.generation || !(yield* retained.generation.verifyGeneration(retained.lease.generation)))
      return yield* new Denied({ reason: "stale-admission" })
    yield* verifyProof(retained.lease.verifyCurrent)
    const operation = yield* CurrentOperation
    if (operation && scopes.get(operation.scope)?.database === database &&
        scopes.get(operation.scope)?.lease === retained.lease && retained.lease.kind === "request" &&
        (!retained.lease.authorize || !(yield* retained.lease.authorize(operation.action, operation.sessionID))))
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
    yield* verify(scope)
    const retained = data(scope).lease
    if (!retained) return
    if (retained.kind === "recovery") {
      if ((operation !== "read" && operation !== "replay") || sessionID && !retained.sessionIds?.has(sessionID))
        return yield* new Denied({ reason: "invalid-recovery" })
      return
    }
    if (!retained.authorize || !(yield* retained.authorize(operation, sessionID)))
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
      const owner = yield* ("binding" in observed
        ? Schema.decodeUnknownEffect(TeamProfile.Binding)(observed.binding).pipe(Effect.map((binding) => binding.owner))
        : Schema.decodeUnknownEffect(TeamProfile.Owner)(observed.owner)
      ).pipe(Effect.mapError(() => new Denied({ reason: "missing-admission" })))
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
      yield* verifyProof(verifyCurrent)
      if (!(yield* provider.verifyGeneration(generation))) return yield* new Denied({ reason: "stale-admission" })
      const lease = Object.freeze({ _tag: "SessionOwner.Lease" } satisfies Lease)
      leases.set(lease, {
        database, owner: freezeOwner(owner), generation, verifyCurrent,
        kind: recovery ? "recovery" : "request",
        ...("binding" in observed ? { authorize: observed.authorize, excludedSessions: observed.excludedSessions } : {}),
        ...(sessionIds ? { sessionIds: new Set(sessionIds) } : {}),
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
      yield* authorize(scope, "read")
      const retained = data(scope)
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
        const excluded = yield* exclusions(retained.lease)
        listed.set(scope, excluded)
        yield* verify(scope)
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
  if (marker && (yield* db.get(sql`SELECT 1 FROM sf_authority_generation LIMIT 1`).pipe(Effect.orDie)))
    return yield* Effect.die(new Denied({ reason: "missing-admission" }))
  const table = yield* db.get(sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'session_owner'`).pipe(Effect.orDie)
  if (table && (yield* db.get(sql`SELECT 1 FROM session_owner LIMIT 1`).pipe(Effect.orDie)))
    return yield* Effect.die(new Denied({ reason: "missing-admission" }))
})

/** Bare technical consumers still refuse a marked store or a durable corporate owner. */
export const access = <A, E, R>(
  db: Database.Interface["db"],
  sessionID: SessionSchema.ID,
  operation: Operation,
  effect: Effect.Effect<A, E, R>,
) => Effect.gen(function* () {
  const service = Option.getOrUndefined(yield* Effect.serviceOption(Service))
  if (service) return yield* guard(service, sessionID, operation, () => effect)
  const check = Effect.gen(function* () {
    const marker = yield* db.get(sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sf_authority_generation'`).pipe(Effect.orDie)
    if (marker && (yield* db.get(sql`SELECT 1 FROM sf_authority_generation LIMIT 1`).pipe(Effect.orDie)))
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
