import { expect, test } from "bun:test"
import path from "node:path"
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { LLMClient, LLMEvent, type LLMRequest } from "@orchestra/llm"
import { AgentV2 } from "@orchestra/core/agent"
import { CapabilityInvocation } from "@orchestra/core/capability/invocation"
import { Config } from "@orchestra/core/config"
import { Database } from "@orchestra/core/database/database"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNodePlatform } from "@orchestra/core/effect/app-node-platform"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { EventV2 } from "@orchestra/core/event"
import { Global } from "@orchestra/core/global"
import { Location } from "@orchestra/core/location"
import { LocationServiceMap } from "@orchestra/core/location-service-map"
import { PermissionV2 } from "@orchestra/core/permission"
import { Relay } from "@orchestra/core/relay"
import { AbsolutePath } from "@orchestra/core/schema"
import { SessionV2 } from "@orchestra/core/session"
import { SessionExecution } from "@orchestra/core/session/execution"
import { SessionExecutionLocal } from "@orchestra/core/session/execution/local"
import { SessionMessage } from "@orchestra/core/session/message"
import { SessionSchema } from "@orchestra/core/session/schema"
import { SessionStore } from "@orchestra/core/session/store"
import { Snapshot } from "@orchestra/core/snapshot"
import { TaskGovernance } from "@orchestra/core/tool/task-governance"
import { ToolRegistry } from "@orchestra/core/tool/registry"
import { ToolSafety } from "@orchestra/core/tool-safety"
import { AuthoringStore } from "@orchestra/relay/authoring/store"
import { Cause, Context, Deferred, Effect, Exit, Fiber, Layer, Stream, type Scope } from "effect"
import { tmpdir } from "../../../../../../packages/core/test/fixture/tmpdir.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import type { RoutinePublicationHost } from "../../../product/routines/publication.ts"
import { createSfRoutineNativePhaseBridge } from "../../../../../../apps/cli/src/sucafina-product/routine-native-phase-bridge.ts"
import { createSfRoutineNativeGovernance } from "../../../../../../apps/cli/src/sucafina-product/routine-native-governance.ts"
import { createSfRoutineNativeRecords } from "../../../../../../apps/cli/src/sucafina-product/routine-native-records.ts"
import type { SfRoutineNativeRuntimeResources } from "../../../../../../apps/cli/src/sucafina-product/routine-native-runtime.ts"

/** COMPONENT ONLY, following core/tool-task-cold.test.ts: real Session create/admit, coordinator,
 * Location runner, core CapabilityInvocation, Task and child drain; deterministic in-process LLM stream.
 * UI identity/lease and governance installation predicates are fixtures, not corporate authentication.
 * No SF workflow plan/review/approval/Relay execution or real provider acceptance is claimed here.
 */
type Trace = { requests: LLMRequest[]; issuers: string[]; holdChild: boolean; childStarted: Deferred.Deferred<void> }
function fixture<A, E>(use: (fixture: Effect.Success<ReturnType<typeof setup>> & { trace: Trace }) => Effect.Effect<A, E, Scope.Scope>) {
  return Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    const directory = yield* Effect.acquireRelease(Effect.promise(() => tmpdir()),
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()))
    const workspace = path.join(directory.path, "workspace")
    const trace: Trace & { bridge?: ReturnType<typeof createSfRoutineNativePhaseBridge> } = {
      requests: [], issuers: [], holdChild: false, childStarted: yield* Deferred.make<void>(),
    }
    yield* Effect.promise(async () => {
      await mkdir(path.join(directory.path, ".global"), { recursive: true })
      await Bun.write(path.join(directory.path, ".global", "orchestra.json"), JSON.stringify({ trusted_projects: [workspace] }))
      await mkdir(path.join(workspace, ".orchestra"), { recursive: true })
      await Bun.write(path.join(workspace, ".orchestra", "orchestra.json"), JSON.stringify({ snapshots: false,
        model: "phase-fixture/chat", providers: { "phase-fixture": {
          api: { type: "aisdk", package: "@ai-sdk/openai", settings: { apiKey: "fixture-not-a-key" } },
          models: { chat: { disabled: false, capabilities: { tools: true, input: ["text"], output: ["text"] },
            limit: { context: 100_000, output: 1_000 } } },
        } },
      }))
      await Bun.write(path.join(workspace, "orchestra.json"), JSON.stringify({ agents: {
        maestro: { mode: "primary", model: "phase-fixture/chat", permissions: [{ action: "task", resource: "*", effect: "allow" }] },
        worker: { mode: "subagent", description: "Planning worker" },
      } }))
    })
    const client = LLMClient.Service.of({ prepare: () => Effect.die("unexpected prepare"), generate: () => Effect.die("unexpected generate"),
      stream: (request) => Stream.suspend((): Stream.Stream<LLMEvent> => {
        trace.requests.push(request)
        const text = request.messages.filter((message) => message.role === "user").at(-1)?.content
          .flatMap((part) => part.type === "text" ? [part.text] : []).join("\n")
        if (text?.startsWith("Original authenticated") && !request.messages.some((message) => message.role === "tool") &&
          !request.system.some((part) => part.text.startsWith("You are a title generator")))
          return Stream.fromIterable([LLMEvent.stepStart({ index: 0 }), LLMEvent.toolCall({ id: "planning-call", name: "task",
            input: { description: "Plan", prompt: "planning-child", subagent_type: "worker" } }),
          LLMEvent.stepFinish({ index: 0, reason: "tool-calls" }), LLMEvent.finish({ reason: "tool-calls" })])
        if (text === "planning-child" && trace.holdChild)
          return Stream.fromEffect(Deferred.succeed(trace.childStarted, undefined)).pipe(Stream.flatMap(() => Stream.never))
        return Stream.fromIterable([LLMEvent.stepStart({ index: 0 }), LLMEvent.textStart({ id: "answer" }),
          LLMEvent.textDelta({ id: "answer", text: "component planning answer" }), LLMEvent.textEnd({ id: "answer" }),
          LLMEvent.stepFinish({ index: 0, reason: "stop" }), LLMEvent.finish({ reason: "stop" })])
      }),
    })
    const safety = { ...ToolSafety.node, dependencies: [...ToolSafety.node.dependencies, Location.node], implementation: Layer.effect(ToolSafety.Service, Effect.gen(function* () {
      const original = yield* ToolSafety.Service
      const location = yield* Location.Service
      return ToolSafety.Service.of({ ...original, run: (invocation, effect, observe, outcome) => {
        const inspect = Effect.gen(function* () {
          if (invocation.tool === "task") {
            const frame = yield* CapabilityInvocation.require({ sessionID: SessionSchema.ID.make(invocation.sessionID), agent: invocation.agent ?? "missing",
              assistantMessageID: SessionMessage.ID.make(invocation.assistantMessageID ?? "missing"), toolCallID: invocation.callID },
            { projectID: location.project.id, location: Location.Ref.make({ directory: location.directory, workspaceID: location.workspaceID }) })
              .pipe(Effect.mapError(() => new ToolSafety.Denied({ reason: "fixture-core-frame-missing" })))
            trace.issuers.push(frame.issuer)
          }
          return yield* effect
        })
        const settle = original.run(invocation, inspect, observe, outcome)
        return trace.bridge ? trace.bridge.withInvocation(invocation, settle) : settle
      } })
    })).pipe(Layer.provide(ToolSafety.node.implementation!)) }
    const application = AppNodeBuilder.build(LayerNode.group([
      Database.node, EventV2.node, SessionStore.node, SessionV2.node, SessionExecution.node, LocationServiceMap.node,
    ]), [[SessionExecution.node, SessionExecutionLocal.node], [ToolSafety.node, safety],
      [LayerNodePlatform.llmClient, Layer.succeed(LLMClient.Service, client)], [Snapshot.node, Snapshot.noopLayer],
      [Global.node, Global.layerWith({ home: directory.path, config: path.join(directory.path, ".global"), data: path.join(directory.path, ".data") })]])
    return yield* Effect.gen(function* () {
      const f = yield* setup(workspace)
      trace.bridge = f.bridge
      yield* Effect.addFinalizer(() => Effect.sync(f.bridge.dispose))
      return yield* use({ ...f, trace })
    }).pipe(Effect.provide(application))
  })))
}

const setup = Effect.fn("NativePhaseFixture.setup")(function* (directory: string) {
  const sessions = yield* SessionV2.Service, execution = yield* SessionExecution.Service
  const database = yield* Database.Service, events = yield* EventV2.Service, store = yield* SessionStore.Service
  const locations = yield* LocationServiceMap.Service
  const location = Location.Ref.make({ directory: AbsolutePath.make(directory) })
  // Resolve through the real Location map; no replacement runner or direct tool settlement is installed.
  const opened = yield* locations.contextEffect(location)
  const nativeLocation = Context.get(opened, Location.Service)
  const registry = Context.get(opened, ToolRegistry.Service)
  const taskRegistration = registry.currentRegistrationIdentity("task")
  if (!taskRegistration) return yield* Effect.die("Real Task registration missing")
  const records = createSfRoutineNativeRecords({ database, store, relayFor: async () => undefined })
  const resources: SfRoutineNativeRuntimeResources = { identity: { installationId: "phase-fixture", hostId: "phase-host",
    projectId: nativeLocation.project.id, location }, database, events, store, execution, registry, records, location: nativeLocation,
    agents: Context.get(opened, AgentV2.Service), permission: Context.get(opened, PermissionV2.Service),
    governance: Context.get(opened, TaskGovernance.Service), safety: Context.get(opened, ToolSafety.Service),
    relay: Context.get(opened, Relay.Service), config: Context.get(opened, Config.Service), taskRegistration,
    governanceInstallation: { epoch: 1, projectId: nativeLocation.project.id, directory }, current: () => true }
  const state = { request: new Request("https://phase-fixture.invalid/routines/prepare", { method: "POST", body: JSON.stringify({ purpose: "plan only" }) }),
    context: undefined as TrustedUiContext | undefined, authorized: true, generation: 2 }
  const context = () => ({ kind: "ui", binding: { installationId: "phase-fixture", projectId: nativeLocation.project.id,
    principalRef: "phase-principal", policyVersion: "policy-1", accessRevision: "access-1",
    expiresAt: new Date(Date.now() + 60_000).toISOString() }, lease: {} }) as unknown as TrustedUiContext
  state.context = context()
  const authoring = yield* AuthoringStore.open(directory, nativeLocation.project.id)
  const publication: RoutinePublicationHost = { publication: { projectID: nativeLocation.project.id, use: (read) => read(authoring),
    skills: () => Effect.die("no workflow skills in planning fixture"), acceptance: [] },
  authorize: async () => state.authorized, authorSession: async () => undefined }
  const original = createSfRoutineNativeGovernance({ records: () => records })
  const input = { resources: () => resources, sessions: () => sessions, originDirectory: path.join(directory, "..", "phase-origins"),
    requestFor: (call: TrustedDomainContext) => call === state.context ? state.request : undefined,
    authorize: async (call: TrustedDomainContext) => state.authorized && call === state.context,
    generation: async () => state.generation, publication: () => publication,
    // Component installation predicates only; native governance is not being certified by this fixture.
    governance: { ...original, installed: (service: TaskGovernance.Interface) => service === resources.governance,
      guardsInstalled: (safety: ToolSafety.Interface, relay: Relay.Interface) => safety === resources.safety && relay === resources.relay },
    owners: { available: () => false, resolve: async () => undefined }, admission: () => undefined,
    authorizeRun: async () => false,
    resolveCase: async () => ({ status: "ok" as const, value: { id: "phase-case", incarnation: "phase-incarnation", version: 1 } }),
    resolveInputs: async () => ({ status: "ok" as const, value: [] }), revalidateSources: async () => true }
  const bridge = createSfRoutineNativePhaseBridge(input)
  return { bridge, input, state, context, sessions, execution, directory }
})

test("component: source-backed planning runs a real core Task without a preexisting execution owner", () => fixture((f) => Effect.gen(function* () {
  yield* Effect.promise(() => f.state.request.text())
  expect(f.state.request.bodyUsed).toBe(true)
  const source = yield* f.bridge.issue(f.state.context!, { operation: "catalog", purpose: "plan only" })
  yield* f.bridge.withPlanning(source, (lease) => Effect.gen(function* () {
    const owner = yield* Effect.promise(() => f.bridge.owners.resolve(f.state.context!, f.state.request))
    expect(owner?.authoritySessionID).toBe(lease.authoritySessionID)
    expect(owner?.task).toBeUndefined()
    expect(yield* lease.resume()).toBe("settled")
    const children = (yield* f.sessions.list()).filter((session) => session.parentID === lease.authoritySessionID)
    expect(children).toHaveLength(1)
    expect(children[0]?.agent).toBe("worker")
    expect(f.trace.issuers).toEqual(["core"])
    expect(yield* f.execution.active).toEqual(new Set())
  }))
  expect(yield* Effect.promise(() => f.bridge.historical(source))).toBeUndefined()
})), 30_000)

test("component: a copied source cannot issue planning authority; reload reissues only independent durable provenance", () => fixture((f) => Effect.gen(function* () {
  const source = yield* f.bridge.issue(f.state.context!, { operation: "catalog", purpose: "plan only" })
  const forged = yield* f.bridge.withPlanning({ ...source }, () => Effect.void).pipe(Effect.exit)
  expect(Exit.isFailure(forged)).toBe(true)
  yield* f.bridge.withPlanning(source, () => Effect.void)
  f.state.request = new Request("https://phase-fixture.invalid/routines/results")
  f.state.context = f.context()
  const reloaded = createSfRoutineNativePhaseBridge(f.input)
  yield* Effect.addFinalizer(() => Effect.sync(reloaded.dispose))
  const fresh = yield* reloaded.issue(f.state.context)
  const evidence = yield* Effect.promise(() => reloaded.historical(fresh))
  expect(evidence).toBeDefined()
  expect(yield* Effect.promise(() => evidence!.current(f.state.context!, f.state.request))).toBe(true)
  const names = yield* Effect.promise(() => readdir(f.input.originDirectory))
  expect(names).toHaveLength(1)
  const file = path.join(f.input.originDirectory, names[0]!)
  const previous = yield* Effect.promise(() => readFile(file, "utf8"))
  yield* Effect.promise(() => writeFile(file, previous.replace("phase-principal", "forged-principal")))
  expect(yield* Effect.promise(() => evidence!.current(f.state.context!, f.state.request)).pipe(Effect.catch(() => Effect.succeed(false)))).toBe(false)
})), 30_000)

test("component: Request revoke interrupts its own original runner and Task child", () => fixture((f) => Effect.gen(function* () {
  f.trace.holdChild = true
  const source = yield* f.bridge.issue(f.state.context!, { operation: "catalog", purpose: "plan only" })
  const running = yield* Effect.forkDetach(f.bridge.withPlanning(source, (lease) => lease.resume()).pipe(Effect.exit))
  yield* Deferred.await(f.trace.childStarted)
  f.bridge.revoke(f.state.request)
  const exit = yield* Fiber.join(running)
  expect(Exit.isFailure(exit)).toBe(true)
  if (Exit.isFailure(exit)) expect(Cause.hasInterrupts(exit.cause)).toBe(true)
  expect(yield* f.execution.active).toEqual(new Set())
})), 30_000)

test("component: a busy planner cannot adopt or revoke another exclusive owner", () => fixture((f) => Effect.gen(function* () {
  const source = yield* f.bridge.issue(f.state.context!, { operation: "catalog", purpose: "plan only" })
  yield* f.bridge.withPlanning(source, (lease) => Effect.gen(function* () {
    const entered = yield* Deferred.make<void>(), release = yield* Deferred.make<void>()
    const observed = { completed: false }
    const owner = yield* Effect.forkDetach(f.execution.exclusive(lease.authoritySessionID,
      Deferred.succeed(entered, undefined).pipe(Effect.andThen(Deferred.await(release)),
        Effect.tap(() => Effect.sync(() => { observed.completed = true }))), { wait: false }))
    yield* Deferred.await(entered)
    expect(yield* lease.resume()).toBe("busy")
    expect(f.trace.issuers).toEqual([])
    expect(observed.completed).toBe(false)
    yield* Deferred.succeed(release, undefined)
    yield* Fiber.join(owner)
    expect(observed.completed).toBe(true)
  }))
})), 30_000)
