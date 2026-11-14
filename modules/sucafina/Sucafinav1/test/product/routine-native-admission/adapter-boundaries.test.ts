import { expect, test } from "bun:test"
import { Cause, Deferred, Effect, Exit, Fiber, Option } from "effect"
import { AgentV2 } from "@orchestra/core/agent"
import { Project } from "@orchestra/core/project"
import { AbsolutePath } from "@orchestra/core/schema"
import { SessionSchema } from "@orchestra/core/session/schema"
import { SessionMessage } from "@orchestra/core/session/message"
import { SessionRunCoordinator } from "@orchestra/core/session/run-coordinator"
import { TaskGovernance } from "@orchestra/core/tool/task-governance"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import type { RoutinePublicationHost } from "../../../product/routines/publication.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createSfRoutineNativeAdapter, type SfRoutineNativeOwnerBinding, type SfRoutineNativeOwnerPort } from "../../../../../../apps/cli/src/sucafina-product/routine-native-adapter.ts"
import { createSfRoutineNativeGovernance } from "../../../../../../apps/cli/src/sucafina-product/routine-native-governance.ts"
import { dispatchSfRoutineNativeTask, withSfRoutineNativeAbort } from "../../../../../../apps/cli/src/sucafina-product/routine-native-dispatch.ts"
import type { SfRoutineNativeRuntimeResources } from "../../../../../../apps/cli/src/sucafina-product/routine-native-runtime.ts"
import { createSfRoutineServices, type SfRoutineServicesInput } from "../../../../../../apps/cli/src/sucafina-product/routine-services.ts"

type Mode = "allowed" | "not-authorized" | "aborted" | "wrong-request" | "owner-replaced" | "generation-changed"
  | "revoked-during-owner" | "resource-replaced" | "old-native-generation"

/**
 * Boundary-only doubles deliberately cannot read a native record or execute a Task. They exercise gating and
 * descriptor removal, not admission/Relay evidence. plan/admission-records tests use real DB/EventV2 separately.
 */
function boundaryFixture(mode: Mode = "allowed") {
  const counter = { reads: 0, effects: 0 }
  const controller = new AbortController()
  const request = new Request("https://sf.invalid/native-boundary-fixture", { signal: controller.signal })
  const identity = Object.freeze({ installationId: "fixture-installation", hostId: "fixture-host",
    projectId: Project.ID.global, location: { directory: AbsolutePath.make("/fixture/native-routine") } })
  const binding = { installationId: identity.installationId, projectId: identity.projectId, principalRef: "fixture-principal",
    requestId: "fixture-request", policyVersion: "fixture-policy", accessRevision: "fixture-access", expiresAt: "2099-01-01T00:00:00Z" }
  const context = (mode === "old-native-generation" ? {
    kind: "native", lease: {}, binding: { ...binding, hostId: identity.hostId, locationId: digestSfValue(identity.location),
      providerGeneration: 1, nativeSessionId: "ses_fixture_resident", runId: "fixture-resident-run", caseId: "fixture-case",
      caseVersion: 1, caseIncarnation: "fixture-case-incarnation", profileId: "routine-reader", profileVersion: "1",
      manifestDigest: "1".repeat(64), skillReceipts: [], entryMode: "foreground" },
  } : { kind: "ui", binding, lease: {} }) as unknown as TrustedDomainContext
  const owner: SfRoutineNativeOwnerBinding = Object.freeze({ request,
    authoritySessionID: SessionSchema.ID.make("ses_fixture_native_maestro") })
  const original = createSfRoutineNativeGovernance({ records: () => undefined })
  let installed = true
  let resourceCurrent = true
  let generationCalls = 0
  let ownerCalls = 0
  let authorized = mode !== "not-authorized"
  const governanceService = TaskGovernance.allowAll
  const governance = { ...original,
    installed: (candidate: TaskGovernance.Interface) => installed && candidate === governanceService,
    bind: () => { counter.effects++; throw new Error("Boundary fixture cannot bind execution authority") },
  }
  const unreachable = new Proxy({}, { get() { counter.reads++; throw new Error("Boundary fixture cannot read native records") } })
  const resources = {
    identity, governance: governanceService, current: () => resourceCurrent,
    store: { get: () => { counter.reads++; return Effect.die("Boundary fixture cannot read native Sessions") } },
    records: unreachable,
    execution: { exclusive: () => { counter.effects++; throw new Error("Boundary fixture cannot dispatch") } },
    registry: { materialize: () => { counter.effects++; throw new Error("Boundary fixture cannot materialize Task") } },
  } as unknown as SfRoutineNativeRuntimeResources
  let currentResources: SfRoutineNativeRuntimeResources | undefined = resources
  let owners: SfRoutineNativeOwnerPort | undefined = {
    resolve: async () => {
      ownerCalls++
      if (mode === "revoked-during-owner") authorized = false
      if (mode === "resource-replaced") currentResources = { ...resources }
      if (mode === "wrong-request") return { ...owner, request: new Request(request.url) }
      return mode === "owner-replaced" && ownerCalls > 1 ? { ...owner } : owner
    },
  }
  let publication: RoutinePublicationHost | undefined = {
    publication: { projectID: identity.projectId }, authorize: async () => true,
  } as unknown as RoutinePublicationHost
  const resolveCase: SfRoutineServicesInput["resolveCase"] = async () => ({ status: "unavailable", reason: "boundary-fixture-has-no-case" })
  const resolveInputs: SfRoutineServicesInput["resolveInputs"] = async () => ({ status: "unavailable", reason: "boundary-fixture-has-no-source" })
  const revalidateSources = async () => false
  const adapter = createSfRoutineNativeAdapter({
    resources: () => currentResources, owners: () => owners, requestFor: () => request,
    authorize: async () => authorized,
    generation: async () => mode === "generation-changed" ? 2 + generationCalls++ : 2,
    publication: () => publication, governance, resolveCase, resolveInputs, revalidateSources,
  })
  const services = createSfRoutineServices({
    authority: { revalidateDomainContext: async () => authorized } as unknown as SfRoutineServicesInput["authority"],
    native: adapter.native, publication: () => publication, resolveCase, resolveInputs, revalidateSources,
    prepareWatch: async () => ({ status: "unavailable", reason: "no-native-schedule-admission" }),
  })
  if (mode === "aborted") controller.abort()
  return {
    adapter, services, context, counter,
    remove: (part: "resources" | "owners" | "publication" | "installation" | "scope") => {
      if (part === "resources") currentResources = undefined
      else if (part === "owners") owners = undefined
      else if (part === "publication") publication = undefined
      else if (part === "installation") installed = false
      else resourceCurrent = false
    },
  }
}

test("operation descriptors follow the live native binding and never advertise a watch function that only returns unavailable", () => {
  for (const missing of ["resources", "owners", "publication", "installation", "scope"] as const) {
    const fixture = boundaryFixture()
    expect(fixture.adapter.available()).toBe(true)
    expect(fixture.adapter.native()).toBe(fixture.adapter.port)
    expect(fixture.adapter.native()).toBe(fixture.adapter.native())
    expect(fixture.services.descriptors.map((descriptor) => descriptor.id).sort()).toEqual([
      "sf_routine_catalog", "sf_routine_prepare", "sf_routine_result", "sf_routine_run", "sf_routine_status",
    ])
    fixture.remove(missing)
    expect(fixture.adapter.available()).toBe(false)
    expect(fixture.adapter.native()).toBeUndefined()
    expect(fixture.services.descriptors).toEqual([])
    expect(fixture.counter).toEqual({ reads: 0, effects: 0 })
  }
})

test("owner identity, request cancellation, revocation and generation changes fail before native reads or side effects", async () => {
  for (const mode of ["not-authorized", "aborted", "wrong-request", "owner-replaced", "generation-changed",
    "revoked-during-owner", "resource-replaced", "old-native-generation"] as const) {
    const fixture = boundaryFixture(mode)
    const result = await fixture.adapter.port.start({
      admissionRef: "evt_fixture_admission", expectedAdmissionVersion: 1, inputDigest: "1".repeat(64),
      caseRef: { id: "fixture-case", incarnation: "fixture-case-incarnation", version: 1 },
    }, fixture.context)
    expect(result.status).toBe(mode === "wrong-request" ? "unavailable" : "denied")
    expect(fixture.counter).toEqual({ reads: 0, effects: 0 })
  }
  const fixture = boundaryFixture()
  const retainedPort = fixture.adapter.native()
  if (!retainedPort) throw new Error("Boundary fixture port was not present")
  fixture.remove("resources")
  expect(await retainedPort.readRun("ses_fixture_cannot_run", fixture.context)).toEqual({
    status: "unavailable", reason: "native-routine-binding-unavailable",
  })
  expect(fixture.counter).toEqual({ reads: 0, effects: 0 })
})

// These are real Effect fibers and the actual Session coordinator, with synthetic work and no provider or Task execution.
test("an already cancelled request interrupts before its synchronous operation can run", () =>
  Effect.runPromise(Effect.gen(function* () {
    const controller = new AbortController()
    controller.abort()
    let effects = 0
    const exit = yield* withSfRoutineNativeAbort(Effect.sync(() => effects++), controller.signal).pipe(Effect.exit)
    expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(true)
    expect(effects).toBe(0)
  })))

test("abort reaches the real coordinator's owned exclusive fiber while a busy retry never executes", () =>
  Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    const entered = yield* Deferred.make<void>()
    const stopped = yield* Deferred.make<void>()
    const controller = new AbortController()
    let starts = 0
    let retries = 0
    const coordinator = yield* SessionRunCoordinator.make<string, never>({ drain: () => Effect.void })
    yield* Effect.addFinalizer(() => Effect.sync(() => controller.abort()))
    const work = Effect.sync(() => starts++).pipe(
      Effect.andThen(Deferred.succeed(entered, undefined)),
      Effect.andThen(Effect.never),
      Effect.onInterrupt(() => Deferred.succeed(stopped, undefined)),
    )
    const waiting = yield* coordinator.exclusive("fixture-session", withSfRoutineNativeAbort(work, controller.signal), { wait: false })
      .pipe(Effect.forkChild)
    yield* Deferred.await(entered)
    const retry = yield* coordinator.exclusive("fixture-session", Effect.sync(() => retries++), { wait: false })
    expect(Option.isNone(retry)).toBe(true)
    expect(starts).toBe(1)
    expect(retries).toBe(0)
    controller.abort()
    yield* Deferred.await(stopped)
    const exit = yield* Fiber.await(waiting)
    expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(true)
    yield* Effect.yieldNow
    expect((yield* coordinator.active).size).toBe(0)
  }))))

test("aborting one owned operation preserves a queued successor and cannot stop that new owner", () =>
  Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    const entered = yield* Deferred.make<void>()
    const successorStarted = yield* Deferred.make<void>()
    const successorGate = yield* Deferred.make<void>()
    const controller = new AbortController()
    let successorInterruptions = 0
    let drains = 0
    const coordinator = yield* SessionRunCoordinator.make<string, never>({
      drain: () => Effect.sync(() => drains++).pipe(
        Effect.andThen(Deferred.succeed(successorStarted, undefined)),
        Effect.andThen(Deferred.await(successorGate)),
        Effect.onInterrupt(() => Effect.sync(() => successorInterruptions++)),
      ),
    })
    yield* Effect.addFinalizer(() => Deferred.succeed(successorGate, undefined).pipe(
      Effect.andThen(Effect.sync(() => controller.abort())), Effect.asVoid,
    ))
    const waiting = yield* coordinator.exclusive("fixture-session", withSfRoutineNativeAbort(
      Deferred.succeed(entered, undefined).pipe(Effect.andThen(Effect.never)), controller.signal,
    ), { wait: false }).pipe(Effect.forkChild)
    yield* Deferred.await(entered)
    yield* coordinator.wake("fixture-session")
    controller.abort()
    const exit = yield* Fiber.await(waiting)
    expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(true)
    yield* Deferred.await(successorStarted)
    expect(drains).toBe(1)
    expect(successorInterruptions).toBe(0)
    expect((yield* coordinator.active).has("fixture-session")).toBe(true)
    // Joining and completing the successor is independent of the cancelled request's waiter and AbortSignal.
    const joiner = yield* coordinator.run("fixture-session").pipe(Effect.forkChild)
    yield* Effect.yieldNow
    yield* Deferred.succeed(successorGate, undefined)
    yield* Fiber.join(joiner)
    expect(successorInterruptions).toBe(0)
    expect((yield* coordinator.active).size).toBe(0)
  }))))

test("a busy native dispatch cannot bind authority, inspect resources, or interrupt the current owner and its successor", () =>
  Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    const entered = yield* Deferred.make<void>()
    const ownerGate = yield* Deferred.make<void>()
    const successorStarted = yield* Deferred.make<void>()
    const successorGate = yield* Deferred.make<void>()
    const retry = new AbortController()
    const counter = { binds: 0, reads: 0, ownerInterruptions: 0, successorInterruptions: 0 }
    const key = SessionSchema.ID.make("ses_busy_dispatch_fixture")
    const coordinator = yield* SessionRunCoordinator.make<SessionSchema.ID, never>({
      drain: () => Deferred.succeed(successorStarted, undefined).pipe(
        Effect.andThen(Deferred.await(successorGate)),
        Effect.onInterrupt(() => Effect.sync(() => counter.successorInterruptions++)),
      ),
    })
    yield* Effect.addFinalizer(() => Deferred.succeed(ownerGate, undefined).pipe(
      Effect.andThen(Deferred.succeed(successorGate, undefined)), Effect.andThen(Effect.sync(() => retry.abort())), Effect.asVoid,
    ))
    const owner = yield* coordinator.exclusive(key, Deferred.succeed(entered, undefined).pipe(
      Effect.andThen(Deferred.await(ownerGate)),
      Effect.onInterrupt(() => Effect.sync(() => counter.ownerInterruptions++)),
    )).pipe(Effect.forkChild)
    yield* Deferred.await(entered)
    // Only execution ownership is real here. Every other resource is a rejecting boundary double.
    const resources = new Proxy({ execution: { exclusive: coordinator.exclusive } }, {
      get(target, property) {
        if (property === "execution") return target.execution
        counter.reads++
        throw new Error("Busy dispatcher must not inspect native resources")
      },
    }) as unknown as SfRoutineNativeRuntimeResources
    const result = yield* Effect.promise(() => dispatchSfRoutineNativeTask({
      resources, signal: retry.signal,
      current: async () => { counter.reads++; return true },
      bindAuthority: () => { counter.binds++; return () => undefined },
      invocation: { sessionID: key, agent: AgentV2.defaultID,
        assistantMessageID: SessionMessage.ID.make("msg_busy_dispatch_fixture"),
        call: { type: "tool-call", id: "call_busy_fixture", name: "task", input: {} } },
    }))
    expect(result).toEqual({ status: "conflict", reason: "native-routine-session-busy" })
    expect(counter).toEqual({ binds: 0, reads: 0, ownerInterruptions: 0, successorInterruptions: 0 })
    expect((yield* coordinator.active).has(key)).toBe(true)
    yield* coordinator.wake(key)
    yield* Deferred.succeed(ownerGate, undefined)
    expect(Option.isSome(yield* Fiber.join(owner))).toBe(true)
    yield* Deferred.await(successorStarted)
    retry.abort()
    yield* Effect.yieldNow
    expect(counter).toEqual({ binds: 0, reads: 0, ownerInterruptions: 0, successorInterruptions: 0 })
    expect((yield* coordinator.active).has(key)).toBe(true)
    const joiner = yield* coordinator.run(key).pipe(Effect.forkChild)
    yield* Effect.yieldNow
    yield* Deferred.succeed(successorGate, undefined)
    yield* Fiber.join(joiner)
    expect((yield* coordinator.active).size).toBe(0)
  }))))
