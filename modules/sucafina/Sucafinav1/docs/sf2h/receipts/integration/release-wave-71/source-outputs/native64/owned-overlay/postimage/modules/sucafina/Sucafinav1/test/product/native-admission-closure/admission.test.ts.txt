import { expect, test } from "bun:test"
import { Cause, Deferred, Effect, Exit, Fiber, type Scope } from "effect"
import { EventV2 } from "@orchestra/core/event"
import { SessionMessageTable } from "@orchestra/core/session/sql"
import { ToolSafety } from "@orchestra/core/tool-safety"
import { MaestroEvent } from "@orchestra/schema/maestro-event"
import type { SfRoutineNativeAuthorityLease } from "../../../../../../apps/cli/src/sucafina-product/routine-native-governance.ts"
import { createSfRoutineNativeOwnerRegistry } from "../../../../../../apps/cli/src/sucafina-product/routine-native-registry.ts"
import { fixturePlan } from "../routine-native-admission/fixture.ts"
import { ids } from "../routine-native-owner-binding/fixture.ts"
import { withAdmissionFixture, type AdmissionFixture } from "./fixture.ts"

// Every test is COMPONENT evidence with a deliberately synthetic origin and original settlement.
// No Task, provider turn, Relay run, installed host, native admission or terminal return is claimed.
const resolve = (f: AdmissionFixture) => Effect.promise(() => f.registry.owners.resolve(f.state.context, f.state.request))
const refused = (exit: Exit.Exit<unknown, unknown>) => {
  expect(Exit.isFailure(exit)).toBe(true)
  if (Exit.isFailure(exit)) expect(Cause.hasInterruptsOnly(exit.cause) || Cause.squash(exit.cause) instanceof ToolSafety.Denied).toBe(true)
}
const deniedBeforeSettlement = (f: AdmissionFixture, options?: Parameters<AdmissionFixture["enter"]>[1]) =>
  Effect.gen(function* () {
    const calls = { original: 0 }
    refused(yield* f.enter(Effect.sync(() => ++calls.original), options).pipe(Effect.exit))
    expect(calls.original).toBe(0)
    expect(f.trace.binds).toBe(0)
    expect(f.registry.owners.available()).toBe(false)
    expect(yield* resolve(f)).toBeUndefined()
  })

test("component: exact POST/UI origin wraps one original settlement with the real plan lease and stable owner", () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    const beforeEvents = yield* f.database.db.select().from(EventV2.EventTable).all().pipe(Effect.orDie)
    const beforeMessages = yield* f.database.db.select().from(SessionMessageTable).all().pipe(Effect.orDie)
    const calls = { original: 0 }
    const originalResult = { value: "synthetic-settlement-result", executionProof: false }
    expect(f.admission.readiness()).toBe("ready")
    expect(f.state.request.method).toBe("POST")
    expect(f.registry.owners.available()).toBe(false)
    const result = yield* f.enter(Effect.gen(function* () {
      calls.original++
      const lease = f.trace.active.get(f.plan.id)
      if (!lease) return yield* Effect.die("Original settlement did not observe the real registered lease")
      expect(yield* Effect.promise(lease.current)).toBe(true)
      // Real governance's map must already hold this lease, independent of the observation map.
      expect(f.realGovernance.tryBind(f.plan.id, lease)).toBeUndefined()
      const owner = yield* resolve(f)
      expect(owner?.request).toBe(f.state.request)
      expect(owner?.authoritySessionID).toBe(ids.parent)
      expect(owner?.task).toEqual({ assistantMessageID: ids.task, toolCallID: ids.call })
      expect(yield* resolve(f)).toBe(owner)
      expect(Object.isFrozen(owner)).toBe(true)
      expect(f.registry.owners.available()).toBe(true)
      expect(yield* Effect.promise(() => f.registry.owners.resolve(f.ui(), f.state.request))).toBeUndefined()
      expect(yield* Effect.promise(() => f.registry.owners.resolve(f.uiContext, new Request(f.state.request)))).toBeUndefined()
      return originalResult
    }))
    expect(result).toBe(originalResult)
    expect(calls.original).toBe(1)
    expect(f.trace.bindAttempts).toBe(1)
    expect(f.trace.binds).toBe(1)
    expect(f.trace.releases).toBe(1)
    expect(f.trace.active.size).toBe(0)
    expect(f.trace.resolutions.length).toBeGreaterThan(1)
    expect(f.trace.resolutions.every((invocation) => invocation === f.invocation)).toBe(true)
    expect(f.trace.intents.length).toBeGreaterThan(0)
    f.trace.intents.forEach((intent) => expect(intent).toEqual(f.expectedIntent))
    expect(f.registry.owners.available()).toBe(false)
    expect(yield* resolve(f)).toBeUndefined()
    expect(yield* f.permission.list()).toEqual([])
    expect(yield* f.saved.list()).toEqual([])
    expect(yield* f.database.db.select().from(EventV2.EventTable).all().pipe(Effect.orDie)).toEqual(beforeEvents)
    expect(yield* f.database.db.select().from(SessionMessageTable).all().pipe(Effect.orDie)).toEqual(beforeMessages)
  })))

const unavailable: ReadonlyArray<[string, string, (f: AdmissionFixture) => void]> = [
  ["missing authenticated origin", "authenticated-native-origin-unavailable", (f) => { f.admissionState.origin = undefined }],
  ["unready authenticated origin", "authenticated-native-origin-unavailable", (f) => { f.admissionState.originReady = false }],
  ["missing publication", "publication-unavailable", (f) => { f.admissionState.publication = undefined }],
  ["fixture installation predicate false", "native-runtime-unavailable", (f) => { f.admissionState.installed = false }],
  ["fixture guard predicate false", "native-runtime-unavailable", (f) => { f.admissionState.guardsInstalled = false }],
  ["disposed admission", "disposed", (f) => { f.admission.dispose() }],
]
for (const [name, readiness, change] of unavailable) test(`component: ${name} exposes unavailability before original settlement`, () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    change(f)
    expect(f.admission.readiness()).toBe(readiness)
    yield* deniedBeforeSettlement(f)
  })))

const invalidBindings: ReadonlyArray<[string, (f: AdmissionFixture) => void]> = [
  ["missing mapping", (f) => { f.admissionState.binding = undefined }],
  ["different Request object", (f) => { Reflect.set(f.admissionBinding, "request", new Request(f.state.request)) }],
  ["different UI context object with equal claims", (f) => { Reflect.set(f.admissionBinding, "context", f.ui()) }],
  ["principal", (f) => { Reflect.set(f.uiContext.binding, "principalRef", "principal-forged") }],
  ["native authority session", (f) => { Reflect.set(f.admissionBinding, "authoritySessionID", "ses_forged") }],
  ["plan intent", (f) => { Reflect.set(f.admissionBinding.intent, "planRevisionId", "evt_maestro_plan_revision_forged") }],
  ["authorization intent", (f) => { Reflect.set(f.admissionBinding.intent, "authorizationId", "evt_authorization_forged") }],
  ["input digest", (f) => { Reflect.set(f.admissionBinding.intent, "inputDigest", "0".repeat(64)) }],
  ["case identity", (f) => { Reflect.set(f.admissionBinding.intent.caseRef, "id", "case-forged") }],
  ["case incarnation", (f) => { Reflect.set(f.admissionBinding.intent.caseRef, "incarnation", "incarnation-forged") }],
  ["case version", (f) => { Reflect.set(f.admissionBinding.intent.caseRef, "version", 2) }],
  ["revoked UI authority", (f) => { f.state.authorized = false }],
  ["denied exact human intent", (f) => { f.admissionState.intentAuthorized = false }],
  ["revoked native admission", (f) => { f.admissionState.nativeCurrent = false }],
  ["missing provider generation", (f) => { f.state.generation = undefined }],
  ["different provider generation", (f) => { f.state.generation = 3 }],
  ["expired UI lease", (f) => { Reflect.set(f.uiContext.binding, "expiresAt", new Date(f.state.now - 1).toISOString()) }],
  ["aborted Request", (f) => { f.controller.abort() }],
  ["aborted native admission", (f) => { f.nativeController.abort() }],
  ["GET instead of the admitted POST", (f) => {
    f.state.request = new Request(f.state.request.url, { signal: f.controller.signal })
    Reflect.set(f.admissionBinding, "request", f.state.request)
  }],
]
for (const [name, change] of invalidBindings) test(`component: ${name} cannot issue original settlement authority`, () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    change(f)
    yield* deniedBeforeSettlement(f)
  })))

test("component: a native sf_maestro context cannot replace the authenticated UI command", () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    f.state.context = f.nativeContext
    Reflect.set(f.admissionBinding, "context", f.nativeContext)
    expect(f.nativeContext.binding.profileId).toBe("sf_maestro")
    yield* deniedBeforeSettlement(f)
  })))

test("component: invocation identity must be resolved by the explicit origin, not copied IDs", () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    yield* deniedBeforeSettlement(f, { invocation: { ...f.invocation } })
  })))

test("component: a new binding object on each origin read is not a stable capability", () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    f.admissionState.origin = { ready: () => true, resolve: async () => ({ ...f.admissionBinding }) }
    yield* deniedBeforeSettlement(f)
  })))

test("component: a forged origin mapping cannot override the canonical core invocation", () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    f.admissionState.origin = { ready: () => true, resolve: async () => f.admissionBinding }
    yield* deniedBeforeSettlement(f, { invocation: { ...f.invocation, agent: "sf_maestro" } })
  })))

test("component: the explicit origin still needs the separately issued native core frame", () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    yield* deniedBeforeSettlement(f, { frame: null })
  })))

test("component: origin errors fail closed before original settlement", () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    f.admissionState.origin = { ready: () => true, resolve: async () => { throw new Error("synthetic-origin-unavailable") } }
    yield* deniedBeforeSettlement(f)
  })))

test("component: admission disposal interrupts an unresolved origin before any Request scope or original settlement", () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    const entered = yield* Deferred.make<void>()
    const release = yield* Deferred.make<void>()
    const calls = { original: 0 }
    f.admissionState.origin = { ready: () => true, resolve: async () => {
      await Effect.runPromise(Deferred.succeed(entered, undefined))
      await Effect.runPromise(Deferred.await(release))
      return undefined
    } }
    yield* Effect.addFinalizer(() => Deferred.succeed(release, undefined))
    const running = yield* f.enter(Effect.sync(() => ++calls.original)).pipe(Effect.exit, Effect.forkChild)
    yield* Effect.raceFirst(Deferred.await(entered), Fiber.join(running).pipe(
      Effect.flatMap(() => Effect.die("Component fixture exited before the origin wait"))))
    f.admission.dispose()
    refused(yield* Fiber.join(running).pipe(Effect.timeout("2 seconds")))
    expect(calls.original).toBe(0)
    expect(f.trace.bindAttempts).toBe(0)
    expect(f.registry.owners.available()).toBe(false)
  })))

for (const [phase, cancellation] of [
  ["generation", "revoke"], ["generation", "dispose"], ["authorization", "revoke"],
] as const) test(`component: real registry ${phase} pending during acquisition is interrupted by ${cancellation}`, () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    const entered = yield* Deferred.make<void>()
    const release = yield* Deferred.make<void>()
    const calls = { original: 0 }
    const waitForCancellation = async () => {
      await Effect.runPromise(Deferred.succeed(entered, undefined))
      await Effect.runPromise(Deferred.await(release))
    }
    // A second instance exercises the real registry's acquisition boundary directly; no native frame
    // or Task is used here, and the owner-binding fixture's production reader implementations stay intact.
    const registry = createSfRoutineNativeOwnerRegistry({
      resources: () => f.state.resources,
      requestFor: (context) => context === f.uiContext ? f.state.request : undefined,
      authorize: async (context) => {
        if (phase === "authorization") await waitForCancellation()
        return f.state.authorized && context === f.uiContext
      },
      generation: async () => {
        if (phase === "generation") await waitForCancellation()
        return f.state.generation
      },
      now: () => f.state.now,
    })
    yield* Effect.addFinalizer(() => Effect.sync(() => registry.dispose()))
    yield* Effect.addFinalizer(() => Deferred.succeed(release, undefined))
    const running = yield* registry.withRequest(f.uiContext, f.state.request,
      Effect.sync(() => ++calls.original)).pipe(Effect.exit, Effect.forkChild)
    yield* Effect.raceFirst(Deferred.await(entered), Fiber.join(running).pipe(
      Effect.flatMap(() => Effect.die("Component registry exited before the acquisition wait"))))
    if (cancellation === "revoke") registry.revoke(f.state.request)
    if (cancellation === "dispose") registry.dispose()
    refused(yield* Fiber.join(running).pipe(Effect.timeout("2 seconds")))
    expect(calls.original).toBe(0)
    expect(registry.owners.available()).toBe(false)
  })))

const sourceChanges: ReadonlyArray<[string, (f: AdmissionFixture) => Effect.Effect<unknown, never, Scope.Scope>]> = [
  ["selected case drift", (f) => Effect.sync(() => {
    f.admissionState.selectedCase = { status: "ok", value: { ...f.expectedIntent.caseRef, version: 2 } }
  })],
  ["resolved source set drift", (f) => Effect.sync(() => {
    f.admissionState.sources = { status: "ok", value: [{ surface: "planner", type: "synthetic-source",
      id: "source-added-after-plan", incarnation: "source-incarnation", version: 2, fields: ["amount"],
      period: { start: "2026-01-01", end: "2026-12-31" }, observedAt: "2026-11-15T00:00:00.000Z" }] }
  })],
  ["source revalidation denial", (f) => Effect.sync(() => { f.admissionState.sourcesCurrent = false })],
  ["publication authority denial", (f) => Effect.sync(() => { f.admissionState.publicationAuthorized = false })],
  ["real stored publication revocation", (f) => f.authoring.unpublish(f.draft.id).pipe(Effect.orDie)],
]
for (const [name, change] of sourceChanges) test(`component: ${name} is checked before binding`, () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    yield* change(f)
    yield* deniedBeforeSettlement(f)
  })))

for (const [name, cancel] of [
  ["Request abort", (f: AdmissionFixture) => f.controller.abort()],
  ["native admission abort", (f: AdmissionFixture) => f.nativeController.abort()],
  ["Request revoke", (f: AdmissionFixture) => f.admission.revoke(f.state.request)],
] as const) test(`component: ${name} interrupts a pending source read before binding or original settlement`, () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    const entered = yield* Deferred.make<void>()
    const release = yield* Deferred.make<void>()
    const calls = { original: 0 }
    f.admissionState.sourceReader = async () => {
      await Effect.runPromise(Deferred.succeed(entered, undefined))
      await Effect.runPromise(Deferred.await(release))
      return { status: "unavailable", reason: "synthetic-source-gate-released-after-cancellation" }
    }
    yield* Effect.addFinalizer(() => Deferred.succeed(release, undefined))
    const running = yield* f.enter(Effect.sync(() => ++calls.original)).pipe(Effect.exit, Effect.forkChild)
    yield* Effect.raceFirst(Deferred.await(entered), Fiber.join(running).pipe(
      Effect.flatMap(() => Effect.die("Component fixture exited before the source wait"))))
    cancel(f)
    refused(yield* Fiber.join(running).pipe(Effect.timeout("2 seconds")))
    expect(calls.original).toBe(0)
    expect(f.trace.bindAttempts).toBe(0)
    expect(f.registry.owners.available()).toBe(false)
  })))

const pendingChanges: ReadonlyArray<[string, (f: AdmissionFixture) => void]> = [
  ["UI revocation", (f) => { f.state.authorized = false }],
  ["human intent revocation", (f) => { f.admissionState.intentAuthorized = false }],
  ["native admission revocation", (f) => { f.admissionState.nativeCurrent = false }],
  ["provider generation drift", (f) => { f.state.generation = 3 }],
  ["runtime resource replacement", (f) => { f.state.resources = { ...f.resources } }],
  ["origin replacement", (f) => { f.admissionState.origin = { ...f.fixtureOrigin } }],
  ["origin readiness loss", (f) => { f.admissionState.originReady = false }],
  ["binding replacement", (f) => { f.admissionState.binding = { ...f.admissionBinding } }],
  ["binding intent mutation", (f) => { Reflect.set(f.admissionBinding.intent, "authorizationId", "evt_changed") }],
  ["Request headers mutation", (f) => { f.state.request.headers.set("x-sf-fixture-actor", "changed") }],
  ["publication host replacement", (f) => { f.admissionState.publication = { ...f.publicationHost } }],
  ["publication port replacement", (f) => { Reflect.set(f.publicationHost, "publication", { ...f.publication }) }],
  ["source revalidation drift", (f) => { f.admissionState.sourcesCurrent = false }],
  ["lease expiry", (f) => { f.state.now += 60_001 }],
]
for (const [name, change] of pendingChanges) test(`component: ${name} during an asynchronous settlement blocks egress`, () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    const entered = yield* Deferred.make<void>()
    const release = yield* Deferred.make<void>()
    const calls = { original: 0 }
    const running = yield* f.enter(Effect.gen(function* () {
      calls.original++
      yield* Deferred.succeed(entered, undefined)
      yield* Deferred.await(release)
      return "must-not-cross-egress"
    })).pipe(Effect.exit, Effect.forkChild)
    yield* Effect.raceFirst(Deferred.await(entered), Fiber.join(running).pipe(
      Effect.flatMap(() => Effect.die("Component fixture exited before original settlement"))))
    change(f)
    yield* Deferred.succeed(release, undefined)
    refused(yield* Fiber.join(running))
    expect(calls.original).toBe(1)
    expect(f.trace.releases).toBe(1)
    expect(f.trace.active.size).toBe(0)
    expect(f.registry.owners.available()).toBe(false)
  })))

test("component: real publication revocation while original settlement awaits blocks its result", () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    const entered = yield* Deferred.make<void>()
    const release = yield* Deferred.make<void>()
    const running = yield* f.enter(Effect.gen(function* () {
      yield* Deferred.succeed(entered, undefined)
      yield* Deferred.await(release)
      return "revoked-publication-result"
    })).pipe(Effect.exit, Effect.forkChild)
    yield* Effect.raceFirst(Deferred.await(entered), Fiber.join(running).pipe(
      Effect.flatMap(() => Effect.die("Component fixture exited before publication revocation"))))
    yield* f.authoring.unpublish(f.draft.id)
    yield* Deferred.succeed(release, undefined)
    refused(yield* Fiber.join(running))
    expect(f.trace.releases).toBe(1)
    expect(f.registry.owners.available()).toBe(false)
  })))

const cancellations: ReadonlyArray<[string, (f: AdmissionFixture) => Effect.Effect<unknown>]> = [
  ["Request revoke", (f) => Effect.sync(() => f.admission.revoke(f.state.request))],
  ["Request abort", (f) => Effect.sync(() => f.controller.abort())],
  ["native admission abort", (f) => Effect.sync(() => f.nativeController.abort())],
  ["generation invalidation", (f) => Effect.sync(() => f.admission.invalidateGeneration(2))],
  ["disposal", (f) => Effect.sync(() => f.admission.dispose())],
  ["expired registry lease observed on read", (f) => Effect.gen(function* () {
    f.state.now += 60_001
    expect(yield* resolve(f)).toBeUndefined()
  })],
]
for (const [name, cancel] of cancellations) test(`component: ${name} interrupts the pending scoped settlement`, () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    const entered = yield* Deferred.make<void>()
    const release = yield* Deferred.make<void>()
    const calls = { original: 0, interrupted: 0, afterWait: 0 }
    const running = yield* f.enter(Effect.gen(function* () {
      calls.original++
      yield* Deferred.succeed(entered, undefined)
      yield* Deferred.await(release)
      calls.afterWait++
    }).pipe(Effect.onInterrupt(() => Effect.sync(() => { calls.interrupted++ })))).pipe(Effect.exit, Effect.forkChild)
    yield* Effect.raceFirst(Deferred.await(entered), Fiber.join(running).pipe(
      Effect.flatMap(() => Effect.die("Component fixture exited before cancellation"))))
    yield* cancel(f)
    refused(yield* Fiber.join(running).pipe(Effect.timeout("2 seconds")))
    expect(calls).toEqual({ original: 1, interrupted: 1, afterWait: 0 })
    expect(f.trace.releases).toBe(1)
    expect(f.trace.active.size).toBe(0)
    expect(f.registry.owners.available()).toBe(false)
  })))

test("component: a concurrent duplicate cannot replace or release the first original caller's lease", () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    const entered = yield* Deferred.make<void>()
    const release = yield* Deferred.make<void>()
    const calls = { original: 0, duplicate: 0 }
    const running = yield* f.enter(Effect.gen(function* () {
      calls.original++
      yield* Deferred.succeed(entered, undefined)
      yield* Deferred.await(release)
      return "first-original-result"
    })).pipe(Effect.exit, Effect.forkChild)
    yield* Effect.raceFirst(Deferred.await(entered), Fiber.join(running).pipe(
      Effect.flatMap(() => Effect.die("Component fixture exited before duplicate"))))
    const owner = yield* resolve(f)
    const lease = f.trace.active.get(f.plan.id)
    if (!lease) return yield* Effect.die("First caller did not retain the real plan lease")
    const error = yield* f.enter(Effect.sync(() => ++calls.duplicate)).pipe(Effect.flip)
    expect(error).toBeInstanceOf(ToolSafety.Denied)
    expect(yield* resolve(f)).toBe(owner)
    expect(f.trace.active.get(f.plan.id)).toBe(lease)
    expect(yield* Effect.promise(lease.current)).toBe(true)
    expect(f.trace.bindAttempts).toBe(1)
    expect(f.trace.releases).toBe(0)
    yield* Deferred.succeed(release, undefined)
    const finished = yield* Fiber.join(running)
    expect(Exit.isSuccess(finished)).toBe(true)
    if (Exit.isSuccess(finished)) expect(finished.value).toBe("first-original-result")
    expect(calls).toEqual({ original: 1, duplicate: 0 })
    expect(f.trace.releases).toBe(1)
    expect(f.registry.owners.available()).toBe(false)
  })))

test("component: real tryBind refuses occupied or aborted leases and reopens only after release or abort", () =>
  withAdmissionFixture((f) => Effect.sync(() => {
    const first = new AbortController()
    const second = new AbortController()
    const aborted = new AbortController()
    aborted.abort()
    const authority: SfRoutineNativeAuthorityLease = { current: async () => true, signal: first.signal }
    expect(f.realGovernance.tryBind(f.plan.id, { ...authority, signal: aborted.signal })).toBeUndefined()
    const release = f.realGovernance.tryBind(f.plan.id, authority)
    expect(release).toBeDefined()
    expect(f.realGovernance.tryBind(f.plan.id, { ...authority, signal: second.signal })).toBeUndefined()
    first.abort()
    const next = f.realGovernance.tryBind(f.plan.id, { ...authority, signal: second.signal })
    expect(next).toBeDefined()
    release?.()
    expect(f.realGovernance.tryBind(f.plan.id, { ...authority, signal: second.signal })).toBeUndefined()
    next?.()
    next?.()
    const final = f.realGovernance.tryBind(f.plan.id, { ...authority, signal: second.signal })
    expect(final).toBeDefined()
    final?.()
  })))

test("component: an existing real governance lease is preserved when this admission cannot bind", () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    const authority: SfRoutineNativeAuthorityLease = { current: async () => true, signal: new AbortController().signal }
    const release = f.realGovernance.bind(f.plan.id, authority)
    yield* deniedBeforeSettlement(f)
    expect(f.trace.bindAttempts).toBe(1)
    expect(f.trace.releases).toBe(0)
    expect(f.realGovernance.tryBind(f.plan.id, authority)).toBeUndefined()
    release()
    const rebound = f.realGovernance.tryBind(f.plan.id, authority)
    expect(rebound).toBeDefined()
    rebound?.()
  })))

test("component: the original settlement error remains identical and both scopes finalize", () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    const originalError = { code: "SYNTHETIC_ORIGINAL_SETTLEMENT_ERROR" }
    const actual = yield* f.enter(Effect.fail(originalError)).pipe(Effect.flip)
    expect(actual).toBe(originalError)
    expect(f.trace.binds).toBe(1)
    expect(f.trace.releases).toBe(1)
    expect(f.trace.active.size).toBe(0)
    expect(f.registry.owners.available()).toBe(false)
    expect(yield* resolve(f)).toBeUndefined()
  })))

test("component: unrelated non-SF Task and other native tools retain their original settlement after SF disposal", () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    const plan = fixturePlan(ids.parent)
    yield* f.events.publish(MaestroEvent.PlanRevision.RecordedV3, plan, { id: plan.id })
    f.admissionState.origin = undefined
    f.admission.dispose()
    const calls = { original: 0 }
    const originalResult = { unrelated: true }
    const task = { ...f.invocation, args: { ...f.taskInput, workflow: {
      documentID: plan.workflowBinding.publication.documentID, planRevisionID: plan.id,
      parameters: plan.workflowBinding.parameters,
    } } }
    const taskResult = yield* f.enter(Effect.sync(() => { calls.original++; return originalResult }), { invocation: task })
    const toolResult = yield* f.enter(Effect.sync(() => { calls.original++; return originalResult }), {
      invocation: { ...f.invocation, tool: "read", args: {} },
    })
    expect(taskResult).toBe(originalResult)
    expect(toolResult).toBe(originalResult)
    expect(calls.original).toBe(2)
    expect(f.trace.resolutions).toEqual([])
    expect(f.trace.bindAttempts).toBe(0)
    expect(f.registry.owners.available()).toBe(false)
  })))
