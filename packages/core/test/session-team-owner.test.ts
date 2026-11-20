import { expect, test } from "bun:test"
import { Cause, DateTime, Deferred, Effect, Exit, Fiber, Schema, Stream } from "effect"
import { Database } from "../src/database/database"
import { EventV2 } from "../src/event"
import { Location } from "../src/location"
import { AbsolutePath } from "../src/schema"
import { SessionV2 } from "../src/session"
import { AgentV2 } from "../src/agent"
import { SessionArchive } from "../src/session/archive"
import { SessionEvent } from "../src/session/event"
import { SessionMessage } from "../src/session/message"
import { SessionOwner } from "../src/session/owner"
import { AuthorityGeneration } from "../src/session/authority-generation"
import { SessionRunCoordinator } from "../src/session/run-coordinator"
import { SessionStore } from "../src/session/store"
import { SessionOwnerEvent } from "@orchestra/schema/session-owner-event"
import { SessionAccess } from "@orchestra/schema/session-access"
import { Prompt } from "../src/session/prompt"
import { teamSessionFixture, profileA, profileB, oid, other } from "./fixture/team-session"
import { barrier } from "../../../modules/sucafina/Sucafinav1/test/teams-profile/installation-fixture"

const denied = <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.gen(function* () {
  const exit = yield* effect.pipe(Effect.exit)
  expect(Exit.isFailure(exit)).toBe(true)
  if (Exit.isSuccess(exit)) return yield* Effect.die("Corporate operation unexpectedly succeeded")
  const error = Cause.squash(exit.cause)
  if (!(error instanceof SessionOwner.Denied) && !(error instanceof AuthorityGeneration.GenerationError))
    return yield* Effect.die(error)
  return error
})

test("owner-01: signed principal and explicit grants bind Created plus private owner event atomically and survive reopening", async () => {
  await using f = await teamSessionFixture()
  const id = SessionV2.ID.make("ses_owned_reopen")
  const first = await f.run(Effect.gen(function* () {
    const sessions = yield* SessionV2.Service
    const lease = yield* f.capture()
    const created = yield* SessionOwner.withLease(lease, sessions.create({ id, location: f.location }))
    return { created, lease }
  }))
  expect(f.business.all("SELECT session_id, installation_id, tenant_id, team_object_id, principal_object_id, generation FROM session_owner"))
    .toEqual([{ session_id: id, installation_id: profileA.installationId, tenant_id: profileA.tenantId,
      team_object_id: profileA.teamObjectId, principal_object_id: oid, generation: 1 }])
  expect(f.business.all("SELECT type FROM event WHERE aggregate_id = ? ORDER BY seq", [id]))
    .toEqual([{ type: EventV2.versionedType(SessionEvent.Created.type, 1) }, { type: EventV2.versionedType(SessionOwnerEvent.Bound.type, 1) }])
  expect(f.business.all("SELECT writer_permit FROM sf_authority_generation")).toEqual([{ writer_permit: null }])
  expect(f.control.pendingWriters(f.storage)).toEqual([])
  await f.run(Effect.gen(function* () {
    const sessions = yield* SessionV2.Service
    yield* denied(SessionOwner.withLease(first.lease, sessions.get(id)))
    const request = f.businessRequest()
    expect(yield* f.admitted(request, sessions.get(id))).toEqual(first.created)
    const lease = yield* f.capture(f.businessRequest())
    yield* denied(SessionOwner.withLease({ ...lease }, sessions.get(id)))
  }))
})

test("owner-02: same physical project never joins different Teams or different people; exact retries preserve the original", async () => {
  await using f = await teamSessionFixture()
  const secondCookie = await f.login(other)
  await f.run(Effect.gen(function* () {
    const sessions = yield* SessionV2.Service
    const store = yield* SessionStore.Service
    const firstLease = yield* f.capture(f.businessRequest(profileA))
    const secondTeam = yield* f.capture(f.businessRequest(profileB))
    const secondPerson = yield* f.capture(f.businessRequest(profileA, secondCookie))
    const id = SessionV2.ID.make("ses_private_tuple")
    const first = yield* SessionOwner.withLease(firstLease, sessions.create({ id, location: f.location }))
    expect(yield* SessionOwner.withLease(firstLease, sessions.create({
      id, location: Location.Ref.make({ directory: AbsolutePath.make("/never-resolve") }), agent: AgentV2.ID.make("maestro"),
    }))).toEqual(first)
    const before = f.calls.projects
    for (const foreign of [secondTeam, secondPerson]) {
      const operations: ReadonlyArray<Effect.Effect<void, unknown>> = [
        sessions.get(id).pipe(Effect.asVoid),
        sessions.create({ id, location: f.location }).pipe(Effect.asVoid),
        sessions.messages({ sessionID: id }).pipe(Effect.asVoid),
        sessions.context(id).pipe(Effect.asVoid),
        sessions.history({ sessionID: id, limit: 20 }).pipe(Effect.asVoid),
        sessions.events({ sessionID: id }).pipe(Stream.runHead, Effect.asVoid),
        store.scope(id).pipe(Effect.asVoid),
        sessions.prompt({ sessionID: id, prompt: Prompt.make({ text: "forbidden" }), resume: false }).pipe(Effect.asVoid),
        sessions.rename({ sessionID: id, title: "forbidden" }),
        sessions.remove(id),
      ]
      for (const operation of operations) yield* denied(SessionOwner.withLease(foreign, operation))
      expect(yield* SessionOwner.withLease(foreign, sessions.list())).toEqual([])
    }
    expect(f.calls.projects).toBe(before)
    const sharedPlacement = yield* SessionOwner.withLease(secondTeam, sessions.create({ location: f.location }))
    expect(sharedPlacement.projectID).toBe(first.projectID)
    expect(sharedPlacement.location).toEqual(first.location)
    expect(sharedPlacement.id).not.toBe(first.id)
    expect((yield* SessionOwner.withLease(firstLease, sessions.list())).map((s) => s.id)).toEqual([id])
    expect((yield* SessionOwner.withLease(secondTeam, sessions.list())).map((s) => s.id)).toEqual([sharedPlacement.id])
  }))
  expect(f.business.all("SELECT id FROM session_input")).toEqual([])
  expect(f.business.all("SELECT session_id FROM session_owner")).toHaveLength(2)
})

test("owner-03: two exact concurrent retries converge once with one owner and one Created/Bound pair", async () => {
  await using f = await teamSessionFixture()
  const together = Promise.withResolvers<void>()
  let entered = 0
  f.hooks.beforeProject = async () => { if (++entered === 2) together.resolve(); await together.promise }
  const id = SessionV2.ID.make("ses_owned_concurrent_retry")
  await f.run(Effect.gen(function* () {
    const sessions = yield* SessionV2.Service
    const lease = yield* f.capture()
    const values = yield* Effect.all([
      SessionOwner.withLease(lease, sessions.create({ id, location: f.location })),
      SessionOwner.withLease(lease, sessions.create({ id, location: f.location })),
    ], { concurrency: "unbounded" })
    expect(values[1]).toEqual(values[0])
  }))
  expect(entered).toBe(2)
  expect(f.business.all("SELECT id FROM session WHERE id = ?", [id])).toEqual([{ id }])
  expect(f.business.all("SELECT session_id FROM session_owner WHERE session_id = ?", [id])).toEqual([{ session_id: id }])
  expect(f.business.all("SELECT type FROM event WHERE aggregate_id = ? ORDER BY seq", [id])).toHaveLength(2)
})

test("owner-04: a racing foreign Team cannot adopt the winner or publish its second identity", async () => {
  await using f = await teamSessionFixture()
  const together = Promise.withResolvers<void>()
  let entered = 0
  f.hooks.beforeProject = async () => { if (++entered === 2) together.resolve(); await together.promise }
  const id = SessionV2.ID.make("ses_owned_foreign_race")
  await f.run(Effect.gen(function* () {
    const sessions = yield* SessionV2.Service
    const a = yield* f.capture(f.businessRequest(profileA))
    const b = yield* f.capture(f.businessRequest(profileB))
    const outcomes = yield* Effect.all([a, b].map((lease) =>
      SessionOwner.withLease(lease, sessions.create({ id, location: f.location })).pipe(Effect.exit)), { concurrency: "unbounded" })
    expect(outcomes.filter(Exit.isSuccess)).toHaveLength(1)
    expect(outcomes.filter(Exit.isFailure)).toHaveLength(1)
    for (const outcome of outcomes) if (Exit.isFailure(outcome)) {
      const error = Cause.squash(outcome.cause)
      expect(error).toBeInstanceOf(SessionOwner.Denied)
      if (!(error instanceof SessionOwner.Denied)) throw error
      expect(error.reason).toBe("foreign-owner")
    }
  }))
  expect(f.business.all("SELECT id FROM session WHERE id = ?", [id])).toHaveLength(1)
  expect(f.business.all("SELECT session_id FROM session_owner WHERE session_id = ?", [id])).toHaveLength(1)
  expect(f.business.all("SELECT type FROM event WHERE aggregate_id = ?", [id])).toHaveLength(2)
})

test("owner-05: a projector failure rolls back the owner and Created together and keeps the ID available for a real retry", async () => {
  await using f = await teamSessionFixture()
  const id = SessionV2.ID.make("ses_owned_rollback")
  await f.run(Effect.gen(function* () {
    const events = yield* EventV2.Service
    const sessions = yield* SessionV2.Service
    const failure = new Error("deliberate failure after private owner projection")
    let inject = true
    yield* events.project(SessionOwnerEvent.Bound, () => inject ? Effect.die(failure) : Effect.void)
    const lease = yield* f.capture()
    const exit = yield* SessionOwner.withLease(lease, sessions.create({ id, location: f.location })).pipe(Effect.exit)
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) expect(Cause.squash(exit.cause)).toBe(failure)
    expect(f.business.all("SELECT session_id FROM session_owner WHERE session_id = ?", [id])).toEqual([])
    expect(f.business.all("SELECT id FROM session WHERE id = ?", [id])).toEqual([])
    expect(f.business.all("SELECT id FROM event WHERE aggregate_id = ?", [id])).toEqual([])
    inject = false
    expect((yield* SessionOwner.withLease(lease, sessions.create({ id, location: f.location }))).id).toBe(id)
  }))
})

test("owner-06: deletion retains an immutable owner tombstone; reuse and raw replay cannot resurrect its content", async () => {
  await using f = await teamSessionFixture()
  const id = SessionV2.ID.make("ses_owned_retired")
  await f.run(Effect.gen(function* () {
    const sessions = yield* SessionV2.Service
    const owners = yield* SessionOwner.Service
    const lease = yield* f.capture()
    yield* SessionOwner.withLease(lease, sessions.create({ id, location: f.location }))
    yield* SessionOwner.withLease(lease, sessions.remove(id))
    const retired = yield* denied(SessionOwner.withLease(lease, sessions.create({ id, location: f.location })))
    expect(retired.reason).toBe("retired-session")
    yield* denied(SessionOwner.withLease(lease, Effect.gen(function* () {
      const scope = yield* owners.open()
      yield* owners.assert(scope, id, "replay")
    })))
    const foreign = yield* f.capture(f.businessRequest(profileB))
    yield* denied(SessionOwner.withLease(foreign, sessions.create({ id, location: f.location })))
  }))
  expect(f.business.all("SELECT id FROM session WHERE id = ?", [id])).toEqual([])
  expect(f.business.all("SELECT session_id, principal_object_id, team_object_id FROM session_owner WHERE session_id = ?", [id]))
    .toEqual([{ session_id: id, principal_object_id: oid, team_object_id: profileA.teamObjectId }])
})

test("owner-07: a legacy unbound ID and an owner event payload never become authority", async () => {
  const id = SessionV2.ID.make("ses_legacy_unmapped")
  await using f = await teamSessionFixture({ legacyID: id })
  const request = f.businessRequest()
  const authority = await f.authority.readCoreSessionAdmission(request)
  if (!authority) throw new Error("Current installed admission required")
  await f.run(Effect.gen(function* () {
    const sessions = yield* SessionV2.Service
    const events = yield* EventV2.Service
    const lease = yield* f.capture(request)
    yield* denied(SessionOwner.withLease(lease, sessions.get(id)))
    yield* denied(SessionOwner.withLease(lease, sessions.create({ id, location: f.location })))
    const newID = SessionV2.ID.make("ses_payload_is_not_authority")
    yield* denied(SessionOwner.withLease(lease, events.publish(SessionOwnerEvent.Bound, {
      sessionID: newID, timestamp: yield* DateTime.now, owner: authority.binding.owner, generation: 1,
    })))
    expect(yield* SessionOwner.withLease(lease, sessions.list())).toEqual([])
  }))
  expect(f.business.all("SELECT session_id FROM session_owner")).toEqual([])
  expect(f.business.all("SELECT id FROM session")).toEqual([{ id }])
})

test("owner-08: missing session grants and roleMap[] deny independently of Team membership and administration", async () => {
  await using noActions = await teamSessionFixture({ actions: [] })
  await noActions.run(Effect.gen(function* () {
    const sessions = yield* SessionV2.Service
    const lease = yield* noActions.capture()
    yield* denied(SessionOwner.withLease(lease, sessions.create({ location: noActions.location })))
    yield* denied(SessionOwner.withLease(lease, sessions.list()))
  }))
  expect(noActions.business.all("SELECT id FROM session")).toEqual([])
  const admin = await noActions.resolver.list(noActions.request(undefined, noActions.cookie))
  expect(admin.status).toBe("ok")
  await using noRoles = await teamSessionFixture({ roles: false })
  expect(await noRoles.authority.readCoreSessionAdmission(noRoles.businessRequest())).toBeUndefined()
  for (const surface of ["dashboard", "planner", "procurement"] as const)
    expect(await noRoles.store.transaction(surface, async (snapshot) => ({ commit: false, value: snapshot.data.roleMap }))).toEqual([])
  expect(noRoles.business.all("SELECT id FROM session")).toEqual([])
})

test("owner-09: recording a prompt does not imply run or model permission and default execution is refused before writing", async () => {
  await using f = await teamSessionFixture({ actions: ["read", "create", "prompt"] })
  await f.run(Effect.gen(function* () {
    const sessions = yield* SessionV2.Service
    const lease = yield* f.capture()
    const created = yield* SessionOwner.withLease(lease, sessions.create({ location: f.location }))
    const before = f.calls.projects
    yield* denied(SessionOwner.withLease(lease, sessions.create({ location: f.location, agent: AgentV2.ID.make("maestro") })))
    expect(f.calls.projects).toBe(before)
    yield* denied(SessionOwner.withLease(lease, sessions.switchAgent({ sessionID: created.id, agent: "maestro" })))
    yield* denied(SessionOwner.withLease(lease, sessions.prompt({ sessionID: created.id, prompt: Prompt.make({ text: "no run" }) })))
    yield* denied(SessionOwner.withLease(lease, sessions.synthetic({ sessionID: created.id, text: "no run" })))
    expect(f.business.all("SELECT id FROM session_input")).toEqual([])
    expect(f.business.all("SELECT type FROM event WHERE aggregate_id = ?", [created.id])).toHaveLength(2)
    const recorded = yield* SessionOwner.withLease(lease, sessions.prompt({
      sessionID: created.id, prompt: Prompt.make({ text: "record only" }), resume: false,
    }))
    expect(recorded.sessionID).toBe(created.id)
    expect(f.calls.wakes).toBe(0)
    expect(f.calls.resumes).toBe(0)
  }))
})

test("owner-10: grant removal and selection mutation invalidate a captured lease without silently reopening it", async () => {
  await using f = await teamSessionFixture()
  await f.run(Effect.gen(function* () {
    const sessions = yield* SessionV2.Service
    const request = f.businessRequest()
    const lease = yield* f.capture(request)
    request.headers.set("x-sf-team-profile", JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team", profile: profileB }))
    yield* denied(SessionOwner.withLease(lease, sessions.create({ location: f.location })))
    const fresh = yield* f.capture(f.businessRequest())
    yield* Effect.promise(() => f.writeGrants(f.grants.map((grant) => ({ ...grant, sessionActions: [] }))))
    yield* denied(SessionOwner.withLease(fresh, sessions.create({ location: f.location })))
  }))
  expect(f.calls.projects).toBe(0)
  expect(f.business.all("SELECT session_id FROM session_owner")).toEqual([])
})

test("owner-11: logout during project resolution prevents owner, Session, event and execution effects", async () => {
  await using f = await teamSessionFixture()
  const gate = barrier()
  f.hooks.beforeProject = gate.hold
  const id = SessionV2.ID.make("ses_logout_wait")
  await f.run(Effect.gen(function* () {
    const sessions = yield* SessionV2.Service
    const lease = yield* f.capture()
    const creating = yield* SessionOwner.withLease(lease, sessions.create({ id, location: f.location })).pipe(Effect.forkScoped)
    yield* Effect.promise(() => gate.entered)
    yield* Effect.promise(() => f.logout(f.cookie))
    gate.release()
    const outcome = yield* Fiber.await(creating)
    expect(Exit.isFailure(outcome)).toBe(true)
    if (Exit.isFailure(outcome)) expect(Cause.squash(outcome.cause)).toBeInstanceOf(SessionOwner.Denied)
  }))
  expect(f.business.all("SELECT session_id FROM session_owner")).toEqual([])
  expect(f.business.all("SELECT id FROM session")).toEqual([])
  expect(f.business.all("SELECT id FROM event WHERE aggregate_id = ?", [id])).toEqual([])
  expect(f.calls.wakes + f.calls.resumes).toBe(0)
})

test("owner-12: generation changes revoke old leases; current admission reads the same immutable owner", async () => {
  await using f = await teamSessionFixture()
  await f.run(Effect.gen(function* () {
    const sessions = yield* SessionV2.Service
    const lease = yield* f.capture()
    const session = yield* SessionOwner.withLease(lease, sessions.create({ location: f.location }))
    f.advance()
    yield* denied(SessionOwner.withLease(lease, sessions.get(session.id)))
    const current = yield* f.capture(f.businessRequest())
    expect(yield* SessionOwner.withLease(current, sessions.get(session.id))).toEqual(session)
    expect(f.business.all("SELECT generation FROM session_owner")).toEqual([{ generation: 1 }])
    expect(f.marker()?.generation).toBe(2)
  }))
})

test("owner-13: bare technical SQL APIs cannot read a marked corporate store without the owner service", async () => {
  await using f = await teamSessionFixture()
  await Effect.runPromise(Effect.gen(function* () {
    const { db } = yield* Database.Service
    yield* denied(SessionArchive.list(db))
  }).pipe(Effect.provide(Database.layerFromPath(f.filename)), Effect.scoped))
  expect(f.business.all("SELECT id FROM session")).toEqual([])
})

test("owner-14: private worker binding reaches the global coordinator and a revoked pending wake never drains", async () => {
  await using f = await teamSessionFixture()
  await f.run(Effect.gen(function* () {
    const sessions = yield* SessionV2.Service
    const owners = yield* SessionOwner.Service
    const lease = yield* f.capture()
    const session = yield* SessionOwner.withLease(lease, sessions.create({ location: f.location }))
    const entered = yield* Deferred.make<void>()
    const release = yield* Deferred.make<void>()
    const drained: SessionV2.ID[] = []
    const coordinator = yield* SessionRunCoordinator.make({
      bind: owners.bind.pipe(Effect.orDie),
      drain: (sessionID: SessionV2.ID) => SessionOwner.guard(owners, sessionID, "run", () => Effect.gen(function* () {
        drained.push(sessionID)
        yield* Deferred.succeed(entered, undefined)
        yield* Deferred.await(release)
      })),
    })
    const running = yield* SessionOwner.withLease(lease, coordinator.run(session.id)).pipe(Effect.forkScoped)
    yield* Deferred.await(entered)
    yield* SessionOwner.withLease(lease, coordinator.wake(session.id))
    yield* Effect.promise(() => f.logout(f.cookie))
    yield* Deferred.succeed(release, undefined)
    const outcome = yield* Fiber.await(running)
    expect(Exit.isFailure(outcome)).toBe(true)
    expect(drained).toEqual([session.id])
    // Observe the queued successor ending; scope teardown is not our denial proof.
    yield* Effect.gen(function* () {
      while ((yield* coordinator.active).size) yield* Effect.sleep("1 millis")
    }).pipe(Effect.timeout("2 seconds"))
    expect(drained).toEqual([session.id])
  }))
})

test("owner-15: actual Case ACL and Team predicates precede LIMIT in both directions, and a foreign cursor is rejected", async () => {
  await using f = await teamSessionFixture()
  await f.run(Effect.gen(function* () {
    const sessions = yield* SessionV2.Service
    const a = yield* f.capture(f.businessRequest(profileA))
    const b = yield* f.capture(f.businessRequest(profileB))
    const first = yield* SessionOwner.withLease(a, sessions.create({ location: f.location }))
    const foreignFirst = yield* SessionOwner.withLease(b, sessions.create({ location: f.location }))
    const allowed = yield* SessionOwner.withLease(a, sessions.create({ location: f.location }))
    yield* SessionOwner.withLease(b, sessions.create({ location: f.location }))
    const last = yield* SessionOwner.withLease(a, sessions.create({ location: f.location }))
    const firstCase = yield* Effect.promise(() => f.linkCaseResource(first.id))
    const lastCase = yield* Effect.promise(() => f.linkCaseResource(last.id))
    expect((yield* SessionOwner.withLease(a, sessions.get(first.id))).id).toBe(first.id)
    yield* Effect.promise(() => firstCase.participants([]))
    yield* Effect.promise(() => lastCase.participants([]))
    for (const order of ["asc", "desc"] as const)
      expect((yield* SessionOwner.withLease(a, sessions.list({ order, limit: 1 }))).map((value) => value.id)).toEqual([allowed.id])
    yield* denied(SessionOwner.withLease(a, sessions.get(first.id)))
    yield* denied(SessionOwner.withLease(a, sessions.list({
      limit: 1, order: "asc", anchor: { id: foreignFirst.id, time: DateTime.toEpochMillis(foreignFirst.time.created), direction: "next" },
    })))
    expect((yield* SessionOwner.withLease(a, sessions.list({ order: "asc" }))).map((value) => value.id)).toEqual([allowed.id])
  }))
}, 60000)

test("owner-16: Case access revoked after the SQL predicate was captured closes the page before egress", async () => {
  await using f = await teamSessionFixture()
  await f.run(Effect.gen(function* () {
    const sessions = yield* SessionV2.Service
    const owners = yield* SessionOwner.Service
    const { db } = yield* Database.Service
    const lease = yield* f.capture()
    const session = yield* SessionOwner.withLease(lease, sessions.create({ location: f.location }))
    const resource = yield* Effect.promise(() => f.linkCaseResource(session.id))
    const gate = barrier()
    // Only delay the real private predicate; no identity, ACL or SQL result is fabricated.
    const delayed = { ...owners, predicate: (scope: SessionOwner.Scope) => owners.predicate(scope).pipe(
      Effect.tap(() => Effect.promise(gate.hold)),
    ) }
    const listing = yield* SessionOwner.withLease(lease, SessionArchive.list(db).pipe(
      Effect.provideService(SessionOwner.Service, delayed),
    )).pipe(Effect.forkScoped)
    yield* Effect.promise(() => gate.entered)
    yield* Effect.promise(() => resource.participants([]))
    gate.release()
    const result = yield* Fiber.await(listing)
    expect(Exit.isFailure(result)).toBe(true)
    if (Exit.isFailure(result)) expect(Cause.squash(result.cause)).toBeInstanceOf(SessionOwner.Denied)
    yield* denied(SessionOwner.withLease(lease, sessions.get(session.id)))
  }))
})

test("owner-17: oversized or malformed current resource exceptions fail closed instead of truncating a visible page", async () => {
  await using f = await teamSessionFixture()
  await f.run(Effect.gen(function* () {
    const sessions = yield* SessionV2.Service
    const lease = yield* f.capture()
    yield* SessionOwner.withLease(lease, sessions.create({ location: f.location }))
    yield* Effect.promise(() => f.store.transaction("dashboard", async (snapshot) => {
      const runs = Object.fromEntries(Array.from({ length: 501 }, (_, index) => [
        "synthetic-linked-run-" + index,
        { principalRef: oid, caseRef: { id: "missing-case", incarnation: "gone" },
          native: { sessionID: SessionV2.ID.make("ses_denied_resource_" + index) } },
      ]))
      const product = Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.Unknown))(snapshot.data.__sfProductV1 ?? {})
      snapshot.data.__sfProductV1 = { ...product, nativeRuns: runs }
      return { commit: true, value: undefined }
    }))
    yield* denied(SessionOwner.withLease(lease, sessions.list({ limit: 1 })))
    yield* Effect.promise(() => f.store.transaction("dashboard", async (snapshot) => {
      const product = Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.Unknown))(snapshot.data.__sfProductV1)
      snapshot.data.__sfProductV1 = { ...product, nativeRuns: [] }
      return { commit: true, value: undefined }
    }))
    yield* denied(SessionOwner.withLease(lease, sessions.list({ limit: 1 })))
  }))
})

test("owner-18: an empty corporate generation marker is never mistaken for a technical store", async () => {
  await using f = await teamSessionFixture()
  // Explicit corruption injection in synthetic storage, after the real cut fixture.
  f.business.execute("DELETE FROM sf_authority_generation")
  const result = await Effect.runPromise(Effect.gen(function* () {
    const { db } = yield* Database.Service
    return yield* SessionArchive.list(db)
  }).pipe(Effect.provide(Database.layerFromPath(f.filename)), Effect.scoped, Effect.exit))
  expect(Exit.isFailure(result)).toBe(true)
  if (Exit.isFailure(result)) {
    const error = Cause.squash(result.cause)
    expect(error instanceof SessionOwner.Denied || error instanceof AuthorityGeneration.GenerationError ||
      error !== null && typeof error === "object" && "cause" in error &&
      error.cause instanceof AuthorityGeneration.GenerationError).toBe(true)
  }
  expect(f.business.all("SELECT id FROM session")).toEqual([])
})
