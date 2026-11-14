import { expect, test } from "bun:test"
import { Deferred, Effect, Exit, Fiber } from "effect"
import { eq } from "drizzle-orm"
import { AgentV2 } from "@orchestra/core/agent"
import { EventV2 } from "@orchestra/core/event"
import { SessionMessageTable } from "@orchestra/core/session/sql"
import { ids, nonExecutingTask, withOwnerFixture, type OwnerFixture } from "./fixture.ts"

const resolve = (f: OwnerFixture) => Effect.promise(() => f.registry.owners.resolve(f.state.context, f.state.request))

const initialForgeries: ReadonlyArray<[string, (f: OwnerFixture) => void]> = [
  ["principal", (f) => { f.binding.principalRef = "forged-principal" }],
  ["project", (f) => { Reflect.set(f.binding, "projectId", "forged-project") }],
  ["host", (f) => { f.binding.hostId = "forged-host" }],
  ["Location", (f) => { f.binding.locationId = "forged-location" }],
  ["native Maestro session", (f) => { Reflect.set(f.binding, "nativeSessionId", "ses_forged") }],
  ["case incarnation", (f) => { f.binding.caseIncarnation = "forged-incarnation" }],
  ["case version", (f) => { f.binding.caseVersion = 2 }],
  ["policy revision", (f) => { f.binding.policyVersion = "policy-other" }],
  ["access revision", (f) => { f.binding.accessRevision = "access-other" }],
  ["older provider generation", (f) => { f.state.generation = 1; f.binding.providerGeneration = 1 }],
  ["expired context", (f) => { f.binding.expiresAt = new Date(f.state.now - 1).toISOString() }],
  ["revoked authenticated Request", (f) => { f.state.authorized = false }],
  ["missing provider generation", (f) => { f.state.generation = undefined }],
]
for (const [name, forge] of initialForgeries) test(`owner acquisition refuses ${name}`, () =>
  withOwnerFixture((f) => Effect.gen(function* () {
    forge(f)
    let calls = 0
    const exit = yield* f.enter(Effect.sync(() => ++calls)).pipe(Effect.exit)
    expect(Exit.isFailure(exit)).toBe(true)
    expect(calls).toBe(0)
    expect(yield* resolve(f)).toBeUndefined()
    expect(f.adapter.available()).toBe(false)
  })))

const liveFences: ReadonlyArray<[string, (f: OwnerFixture) => void]> = [
  ["Request headers", (f) => { f.state.request.headers.set("x-sf-fixture-actor", "changed") }],
  ["Request identity", (f) => { f.state.request = new Request(f.state.request) }],
  ["principal", (f) => { f.binding.principalRef = "changed-principal" }],
  ["project", (f) => { Reflect.set(f.binding, "projectId", "changed-project") }],
  ["policyVersion", (f) => { f.binding.policyVersion = "policy-2" }],
  ["accessRevision", (f) => { f.binding.accessRevision = "access-2" }],
  ["lease identity", (f) => { Reflect.set(f.state.context, "lease", {}) }],
  ["binding identity", (f) => { Reflect.set(f.state.context, "binding", { ...f.state.context.binding }) }],
  ["provider generation", (f) => { f.state.generation = 3 }],
  ["resource object identity", (f) => { f.state.resources = { ...f.resources } }],
  ["resource identity facts", (f) => { Reflect.set(f.resources.identity, "hostId", "changed-host") }],
  ["runtime lifetime", (f) => { f.state.live = false }],
  ["authentication", (f) => { f.state.authorized = false }],
  ["lease expiry", (f) => { f.state.now += 60_001 }],
  ["explicit Request revocation", (f) => { f.registry.revoke(f.state.request) }],
  ["Request abort", (f) => { f.controller.abort() }],
  ["generation invalidation", (f) => { f.registry.invalidateGeneration(2) }],
  ["registry disposal", (f) => { f.registry.dispose(); f.registry.dispose() }],
]
for (const [name, change] of liveFences) test(`a live owner is fenced when ${name} changes`, () =>
  withOwnerFixture((f) => Effect.gen(function* () {
    let calls = 0
    const result = yield* f.enter(Effect.gen(function* () {
      calls++
      expect(yield* resolve(f)).toBeDefined()
      change(f)
      expect(yield* resolve(f)).toBeUndefined()
      return "cannot-cross-final-fence"
    })).pipe(Effect.exit)
    expect(Exit.isFailure(result)).toBe(true)
    expect(calls).toBe(1)
    expect(f.registry.owners.available()).toBe(false)
    expect(f.adapter.available()).toBe(false)
  })))

test("canonical human approval revocation invalidates a previously captured owner", () =>
  withOwnerFixture((f) => Effect.gen(function* () {
    const result = yield* f.enter(Effect.gen(function* () {
      expect(yield* resolve(f)).toBeDefined()
      yield* f.database.db.delete(SessionMessageTable).where(eq(SessionMessageTable.id, ids.human)).run().pipe(Effect.orDie)
      expect(yield* resolve(f)).toBeUndefined()
    })).pipe(Effect.exit)
    expect(Exit.isFailure(result)).toBe(true)
    expect(f.registry.owners.available()).toBe(false)
  })))

for (const [name, eventID] of [
  ["validation", ids.validation],
  ["context", ids.context],
  ["review", EventV2.ID.make("evt_sf_m41_review_fixture")],
  ["approval", EventV2.ID.make("evt_sf_m41_approval_fixture")],
  ["presentation", ids.presentationRow],
] as const) test(`removing the canonical ${name} receipt revokes the already captured binding`, () =>
  withOwnerFixture((f) => Effect.gen(function* () {
    const result = yield* f.enter(Effect.gen(function* () {
      expect(yield* resolve(f)).toBeDefined()
      yield* f.database.db.delete(EventV2.EventTable).where(eq(EventV2.EventTable.id, eventID)).run().pipe(Effect.orDie)
      expect(yield* resolve(f)).toBeUndefined()
    })).pipe(Effect.exit)
    expect(Exit.isFailure(result)).toBe(true)
    expect(f.registry.owners.available()).toBe(false)
  })))

test("native Permission changes are re-read after capture without creating an approval", () =>
  withOwnerFixture((f) => Effect.gen(function* () {
    const result = yield* f.enter(Effect.gen(function* () {
      expect(yield* resolve(f)).toBeDefined()
      yield* f.agents.transform((editor) => editor.update(AgentV2.defaultID, (agent) => {
        agent.permissions = [{ action: "task", resource: "backend", effect: "deny" }]
      }))
      expect(yield* resolve(f)).toBeUndefined()
    })).pipe(Effect.exit)
    expect(Exit.isFailure(result)).toBe(true)
    expect(yield* f.permission.list()).toEqual([])
    expect(yield* f.saved.list()).toEqual([])
  })))

test("replacing the real Task registration invalidates ownership even after the old registration returns", () =>
  withOwnerFixture((f) => Effect.scoped(Effect.gen(function* () {
    const original = f.resources.taskRegistration
    const result = yield* f.enter(Effect.scoped(Effect.gen(function* () {
      expect(yield* resolve(f)).toBeDefined()
      yield* f.toolRegistry.register({ task: nonExecutingTask() })
      expect(f.toolRegistry.currentRegistrationIdentity("task")).not.toBe(original)
      expect(yield* resolve(f)).toBeUndefined()
    }))).pipe(Effect.exit)
    expect(Exit.isFailure(result)).toBe(true)
    expect(f.toolRegistry.currentRegistrationIdentity("task")).toBe(original)
    expect(yield* resolve(f)).toBeUndefined()
  }))))

test("mutating the original invocation after capture cannot retain authority", () =>
  withOwnerFixture((f) => Effect.gen(function* () {
    const result = yield* f.enter(Effect.gen(function* () {
      expect(yield* resolve(f)).toBeDefined()
      Reflect.set(f.invocation, "callID", "call_mutated_after_capture")
      expect(yield* resolve(f)).toBeUndefined()
    })).pipe(Effect.exit)
    expect(Exit.isFailure(result)).toBe(true)
  })))

test("a duplicate concurrent Task call is refused without replacing the first owner's identity", () =>
  withOwnerFixture((f) => Effect.gen(function* () {
    const entered = yield* Deferred.make<void>()
    const release = yield* Deferred.make<void>()
    let firstCalls = 0, duplicateCalls = 0
    const first = yield* f.enter(Effect.gen(function* () {
      firstCalls++
      yield* Deferred.succeed(entered, undefined)
      yield* Deferred.await(release)
      return "first-original-result"
    })).pipe(Effect.forkChild)
    yield* Effect.raceFirst(Deferred.await(entered), Fiber.join(first).pipe(Effect.flatMap(() => Effect.die("Fixture exited before native callback"))))
    const owner = yield* resolve(f)
    expect(owner).toBeDefined()
    const duplicate = yield* f.enter(Effect.sync(() => ++duplicateCalls)).pipe(Effect.exit)
    expect(Exit.isFailure(duplicate)).toBe(true)
    expect(duplicateCalls).toBe(0)
    expect(yield* resolve(f)).toBe(owner)
    yield* Deferred.succeed(release, undefined)
    expect(yield* Fiber.join(first)).toBe("first-original-result")
    expect(firstCalls).toBe(1)
    expect(yield* resolve(f)).toBeUndefined()
    const replay = yield* f.enter(Effect.sync(() => ++duplicateCalls)).pipe(Effect.exit)
    expect(Exit.isFailure(replay)).toBe(true)
    expect(duplicateCalls).toBe(0)
  })))

for (const change of ["headers", "revoke"] as const) test(`Request ${change} while settlement awaits prevents a successful result`, () =>
  withOwnerFixture((f) => Effect.gen(function* () {
    const entered = yield* Deferred.make<void>()
    const release = yield* Deferred.make<void>()
    let calls = 0
    const running = yield* f.enter(Effect.gen(function* () {
      calls++
      yield* Deferred.succeed(entered, undefined)
      yield* Deferred.await(release)
      return "stale-settlement-result"
    })).pipe(Effect.exit, Effect.forkChild)
    yield* Effect.raceFirst(Deferred.await(entered), Fiber.join(running).pipe(Effect.flatMap(() => Effect.die("Fixture exited before native callback"))))
    expect(yield* resolve(f)).toBeDefined()
    if (change === "headers") f.state.request.headers.set("x-sf-fixture-actor", "changed-during-await")
    else f.registry.revoke(f.state.request)
    expect(yield* resolve(f)).toBeUndefined()
    yield* Deferred.succeed(release, undefined)
    expect(Exit.isFailure(yield* Fiber.join(running))).toBe(true)
    expect(calls).toBe(1)
    expect(f.registry.owners.available()).toBe(false)
  })))

test("interrupting an in-flight settlement clears ownership and permanently fences that call's replay", () =>
  withOwnerFixture((f) => Effect.gen(function* () {
    const before = yield* f.database.db.select().from(EventV2.EventTable).all().pipe(Effect.orDie)
    const entered = yield* Deferred.make<void>()
    const neverReleased = yield* Deferred.make<void>()
    let calls = 0
    const running = yield* f.enter(Effect.gen(function* () {
      calls++
      yield* Deferred.succeed(entered, undefined)
      yield* Deferred.await(neverReleased)
    })).pipe(Effect.forkChild)
    yield* Effect.raceFirst(Deferred.await(entered), Fiber.join(running).pipe(Effect.flatMap(() => Effect.die("Fixture exited before native callback"))))
    expect(yield* resolve(f)).toBeDefined()
    yield* Fiber.interrupt(running)
    expect(yield* resolve(f)).toBeUndefined()
    expect(f.registry.owners.available()).toBe(false)
    const replay = yield* f.enter(Effect.sync(() => ++calls)).pipe(Effect.exit)
    expect(Exit.isFailure(replay)).toBe(true)
    expect(calls).toBe(1)
    expect(yield* f.database.db.select().from(EventV2.EventTable).all().pipe(Effect.orDie)).toEqual(before)
  })))

for (const cancellation of ["Request abort", "registry revoke", "lease expiry"] as const) test(`${cancellation} interrupts a blocked settlement before its next effect`, () =>
  withOwnerFixture((f) => Effect.gen(function* () {
    if (cancellation === "lease expiry") f.binding.expiresAt = new Date(f.state.now + 1_000).toISOString()
    const entered = yield* Deferred.make<void>()
    const blocked = yield* Deferred.make<void>()
    let delegations = 0, interruptions = 0, laterEffects = 0
    const running = yield* f.enter(Effect.gen(function* () {
      delegations++
      yield* Deferred.succeed(entered, undefined)
      yield* Deferred.await(blocked)
      laterEffects++
    }).pipe(Effect.onInterrupt(() => Effect.sync(() => { interruptions++ })))).pipe(Effect.exit, Effect.forkChild)
    yield* Effect.raceFirst(Deferred.await(entered), Fiber.join(running).pipe(Effect.flatMap(() => Effect.die("Fixture exited before native callback"))))
    expect(yield* resolve(f)).toBeDefined()
    if (cancellation === "Request abort") f.controller.abort()
    else if (cancellation === "registry revoke") f.registry.revoke(f.state.request)
    // No release of blocked: only cancellation of this exact scoped operation can complete the fiber.
    const exited = yield* Fiber.join(running).pipe(Effect.timeout("2 seconds"))
    expect(Exit.isFailure(exited)).toBe(true)
    expect(delegations).toBe(1)
    expect(interruptions).toBe(1)
    expect(laterEffects).toBe(0)
    expect(yield* resolve(f)).toBeUndefined()
    expect(f.registry.owners.available()).toBe(false)
  })))

test("an unrelated tool and a nested rejected Request scope cannot mint or overwrite an owner", () =>
  withOwnerFixture((f) => Effect.gen(function* () {
    let unrelated = 0, nested = 0
    expect(yield* f.registry.withRequest(f.state.context, f.state.request,
      f.registry.run({ ...f.invocation, tool: "read" }, Effect.sync(() => ++unrelated)))).toBe(1)
    expect(yield* resolve(f)).toBeUndefined()
    yield* f.enter(Effect.gen(function* () {
      const owner = yield* resolve(f)
      const rejected = yield* f.registry.withRequest(f.state.context, f.state.request,
        Effect.sync(() => ++nested)).pipe(Effect.exit)
      expect(Exit.isFailure(rejected)).toBe(true)
      expect(nested).toBe(0)
      expect(yield* resolve(f)).toBe(owner)
    }))
    expect(unrelated).toBe(1)
    expect(yield* resolve(f)).toBeUndefined()
  })))

test("an invalidated old generation cannot be resurrected by restoring its number", () =>
  withOwnerFixture((f) => Effect.gen(function* () {
    f.registry.invalidateGeneration(2)
    f.state.generation = 3
    f.state.generation = 2
    let calls = 0
    const result = yield* f.enter(Effect.sync(() => ++calls)).pipe(Effect.exit)
    expect(Exit.isFailure(result)).toBe(true)
    expect(calls).toBe(0)
    expect(f.registry.owners.available()).toBe(false)
  })))
