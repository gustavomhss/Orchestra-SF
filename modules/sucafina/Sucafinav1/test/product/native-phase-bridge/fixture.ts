import path from "node:path"
import { mkdir } from "node:fs/promises"
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
import { SkillV2 } from "@orchestra/core/skill"
import { TaskGovernance } from "@orchestra/core/tool/task-governance"
import { Tool } from "@orchestra/core/tool/tool"
import { ToolRegistry } from "@orchestra/core/tool/registry"
import { ToolSafety } from "@orchestra/core/tool-safety"
import { AuthoringStore } from "@orchestra/relay/authoring/store"
import { Context, Deferred, Effect, Layer, Schema, Stream, type Scope } from "effect"
import { tmpdir } from "../../../../../../packages/core/test/fixture/tmpdir.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import type { SfDomainValidation } from "../../../product/contracts/runtime.ts"
import type { RoutinePublicationHost } from "../../../product/routines/publication.ts"
import { createSfRoutineNativePhaseComposition } from "../../../../../../apps/cli/src/sucafina-product/routine-native-phase-composition.ts"
import { createSfRoutineNativeGovernance } from "../../../../../../apps/cli/src/sucafina-product/routine-native-governance.ts"
import { createSfRoutineNativeRecords } from "../../../../../../apps/cli/src/sucafina-product/routine-native-records.ts"
import { createSfRoutineNativeOwnerRegistry } from "../../../../../../apps/cli/src/sucafina-product/routine-native-registry.ts"
import type { createSfExecutionBindingRegistry } from "../../../product/host-binding/execution-context.ts"
import { SF_ROUTINE_PHASE_SCOPE } from "../../../../../../apps/cli/src/sucafina-product/routine-native-phase-scope.ts"
import type { SfRoutineNativeRuntimeResources } from "../../../../../../apps/cli/src/sucafina-product/routine-native-runtime.ts"
import { WriteRootsV2 } from "../../../../../../modules/maestro/coordination/src/v2/governance/write-roots.ts"
import { phaseResidentLocationNode } from "./native-fixture.ts"

/** COMPONENT ONLY: real public Session/runner/coordinator/Task/Scope/skill loader and source adapters; deterministic
 * in-process LLM stream. UI identity and installation predicates are fixtures. Non-Task Maestro registrations below
 * are explicitly nonexecuting fixtures, NOT proof of native C15 plan/review/approval, a real provider or Relay run.
 * The exact shipped governed playbook is loaded by the actual native skill API, not a fabricated held receipt.
 */
function prepare(directory: string) {
  const state: { request: Request; context?: TrustedUiContext; authorized: boolean; generation: number;
    native?: ReturnType<typeof createSfExecutionBindingRegistry>;
    resources?: SfRoutineNativeRuntimeResources; sessions?: SessionV2.Interface; publication?: RoutinePublicationHost;
    caseRef: { id: string; incarnation: string; version: number } } = {
    request: new Request("https://phase-fixture.invalid/routines/catalog", { method: "POST", body: JSON.stringify({ purpose: "plan only" }) }),
    authorized: true, generation: 2, caseRef: { id: "phase-case", incarnation: "phase-incarnation", version: 1 },
  }
  const ui = (): TrustedUiContext => ({ kind: "ui", binding: { installationId: "phase-fixture", projectId: state.resources!.identity.projectId,
    principalRef: "phase-principal", policyVersion: "policy-1", accessRevision: "access-1", requestId: crypto.randomUUID(),
    expiresAt: new Date(Date.now() + 60_000).toISOString() }, lease: {} }) as unknown as TrustedUiContext
  const original = createSfRoutineNativeGovernance({ records: () => state.resources?.records })
  const input = { resources: () => state.resources, sessions: () => state.sessions, originDirectory: path.join(directory, "..", "phase-origins"),
    requestFor: (call: TrustedDomainContext) => call.kind === "native" ? state.native?.requestFor(call) : call === state.context ? state.request : undefined,
    authorize: async (call: TrustedDomainContext) => call.kind === "native" ? state.native?.revalidate(call) ?? false : state.authorized && call === state.context,
    generation: async () => state.generation, publication: () => state.publication,
    governance: { ...original, installed: (service: TaskGovernance.Interface) => service === state.resources?.governance,
      guardsInstalled: (safety: ToolSafety.Interface, relay: Relay.Interface) => safety === state.resources?.safety && relay === state.resources?.relay },
    authorizeRun: async () => false,
    resolveCase: async () => ({ status: "ok" as const, value: structuredClone(state.caseRef) }),
    resolveInputs: async () => ({ status: "ok" as const, value: [] }), revalidateSources: async () => true }
  const registry = createSfRoutineNativeOwnerRegistry(input)
  const authority: SfDomainValidation = {
    revalidateDomainContext: input.authorize,
    validateDomainContext: async (context, operation, digest) => context.kind === "native" && !!state.native &&
      await state.native.revalidate(context) && state.native.consume(context, operation, digest),
    receiptFor: (context, operation, digest, resultDigest) => context.kind === "native"
      ? state.native?.receiptFor(context, operation, digest, resultDigest) : undefined,
  }
  const composition = createSfRoutineNativePhaseComposition({ ...input, registry, authority })
  return { state, input, bridge: composition.phase, composition, ui }
}
type Trace = { requests: LLMRequest[]; issuers: string[]; holdChild: boolean; childStarted: Deferred.Deferred<void> }
export type PhaseFixture = Effect.Success<ReturnType<typeof setup>> & { trace: Trace }
export function withPhaseFixture<A, E>(use: (fixture: PhaseFixture) => Effect.Effect<A, E, Scope.Scope>) {
  return Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    const temporary = yield* Effect.acquireRelease(Effect.promise(() => tmpdir()), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()))
    const directory = path.join(temporary.path, "workspace")
    const prepared = prepare(directory)
    yield* Effect.addFinalizer(() => Effect.sync(() => { prepared.composition.admission.dispose(); prepared.bridge.dispose() }))
    const trace: Trace = { requests: [], issuers: [], holdChild: false, childStarted: yield* Deferred.make<void>() }
    yield* Effect.promise(async () => {
      await mkdir(path.join(temporary.path, ".global"), { recursive: true })
      await Bun.write(path.join(temporary.path, ".global", "orchestra.json"), JSON.stringify({ trusted_projects: [directory] }))
      await mkdir(path.join(directory, ".orchestra", "skills", "maestro-run-governed"), { recursive: true })
      const entry = path.resolve(import.meta.dir, "../../../../../maestro/coordination/playbooks/maestro-run/governed/SKILL.md")
      await Bun.write(path.join(directory, ".orchestra", "skills", "maestro-run-governed", "SKILL.md"), await Bun.file(entry).text())
      await Bun.write(path.join(directory, ".orchestra", "orchestra.json"), JSON.stringify({ snapshots: false,
        providers: { "phase-fixture": { api: { type: "aisdk", package: "@ai-sdk/openai", settings: { apiKey: "fixture-not-a-key" } },
          models: { chat: { disabled: false, capabilities: { tools: true, input: ["text"], output: ["text"] }, limit: { context: 100_000, output: 1_000 } } } } },
      }))
      await Bun.write(path.join(directory, "orchestra.json"), JSON.stringify({ agents: {
        maestro: { mode: "primary", model: "phase-fixture/chat", engine: "orchestra", permissions: [{ action: "task", resource: "*", effect: "allow" }] },
        archie: { mode: "subagent", description: "Component planning worker", engine: "orchestra" },
      } }))
    })
    const client = LLMClient.Service.of({ prepare: () => Effect.die("unexpected prepare"), generate: () => Effect.die("unexpected generate"),
      stream: (request: LLMRequest) => Stream.suspend((): Stream.Stream<LLMEvent> => {
        trace.requests.push(request)
        const text = request.messages.filter((message) => message.role === "user").at(-1)?.content.flatMap((part) => part.type === "text" ? [part.text] : []).join("\n")
        if (!text?.endsWith("planning-child") && request.system.some((part) => part.text.includes("Original source context DATA")) &&
          !request.messages.some((message) => message.role === "tool")) return Stream.fromIterable([
          LLMEvent.stepStart({ index: 0 }), LLMEvent.toolCall({ id: "planning-call", name: "task",
            input: { description: "Plan", prompt: "planning-child", subagent_type: "archie" } }),
          LLMEvent.stepFinish({ index: 0, reason: "tool-calls" }), LLMEvent.finish({ reason: "tool-calls" })])
        if (text?.endsWith("planning-child") && trace.holdChild) return Stream.fromEffect(Deferred.succeed(trace.childStarted, undefined)).pipe(Stream.flatMap(() => Stream.never))
        return Stream.fromIterable([LLMEvent.stepStart({ index: 0 }), LLMEvent.textStart({ id: "answer" }),
          LLMEvent.textDelta({ id: "answer", text: "component answer" }), LLMEvent.textEnd({ id: "answer" }),
          LLMEvent.stepFinish({ index: 0, reason: "stop" }), LLMEvent.finish({ reason: "stop" })])
      }) }
    )
    const safety: typeof WriteRootsV2.safetyNode = {
      ...WriteRootsV2.safetyNode,
      implementation: Layer.effect(ToolSafety.Service, Effect.gen(function* () {
        const original = yield* ToolSafety.Service
        const location = yield* Location.Service
        return ToolSafety.Service.of({ ...original, run: (invocation, effect, observe, outcome) => {
          const inspect = Effect.gen(function* () {
            if (invocation.tool === "task") {
              const frame = yield* CapabilityInvocation.require({ sessionID: SessionSchema.ID.make(invocation.sessionID), agent: AgentV2.ID.make(invocation.agent ?? "missing"),
                assistantMessageID: SessionMessage.ID.make(invocation.assistantMessageID ?? "missing"), toolCallID: invocation.callID },
              { projectID: location.project.id, location: Location.Ref.make({ directory: location.directory, workspaceID: location.workspaceID }) })
                .pipe(Effect.mapError(() => new ToolSafety.Denied({ reason: "fixture-core-frame-missing" })))
              trace.issuers.push(frame.issuer)
            }
            return yield* effect
          })
          return prepared.bridge.withInvocation(invocation, original.run(invocation, inspect, observe, outcome))
        } })
      })).pipe(Layer.provide(WriteRootsV2.safetyNode.implementation!)),
    }
    const governance = { ...TaskGovernance.node, implementation: Layer.succeed(TaskGovernance.Service, {
      ...TaskGovernance.allowAll, beforeTurn: prepared.bridge.beforeTurn,
      admit: (request) => TaskGovernance.allowAll.admit(request).pipe(Effect.flatMap((admitted) => prepared.bridge.admitted(request, admitted))),
    }) }
    const application = AppNodeBuilder.build(LayerNode.group([
      Database.node, EventV2.node, SessionStore.node, SessionV2.node, SessionExecution.node, LocationServiceMap.node,
    ]), [[SessionExecution.node, SessionExecutionLocal.node], [ToolSafety.node, safety], [TaskGovernance.node, governance],
      ...(prepared.bridge.contribution.replacements ?? []),
      [LayerNodePlatform.llmClient, Layer.succeed(LLMClient.Service, client)], [Snapshot.node, Snapshot.noopLayer],
      [Global.node, Global.layerWith({ home: temporary.path, config: path.join(temporary.path, ".global"), data: path.join(temporary.path, ".data") })]],
    [...(prepared.bridge.contribution.locationNodes ?? []), phaseResidentLocationNode(), ToolSafety.node])
    return yield* Effect.gen(function* () { const f = yield* setup(directory, prepared); return yield* use({ ...f, trace }) }).pipe(Effect.provide(application))
  })))
}

const setup = Effect.fn("PhaseFixture.setup")(function* (directory: string, prepared: ReturnType<typeof prepare>) {
  const sessions = yield* SessionV2.Service, execution = yield* SessionExecution.Service
  const database = yield* Database.Service, events = yield* EventV2.Service, store = yield* SessionStore.Service
  const locations = yield* LocationServiceMap.Service
  const location = Location.Ref.make({ directory: AbsolutePath.make(directory) })
  const opened = yield* locations.contextEffect(location)
  const nativeLocation = Context.get(opened, Location.Service), registry = Context.get(opened, ToolRegistry.Service)
  // Nonexecuting names are NOT native governance evidence. The deterministic provider calls only real core Task.
  yield* registry.register(Object.fromEntries(SF_ROUTINE_PHASE_SCOPE.tools.filter((name) => name !== "task").map((name) => [name,
    Tool.make({ description: "Nonexecuting component registration", input: Schema.Unknown, output: Schema.String,
      execute: () => Effect.die("COMPONENT_MUST_NOT_EXECUTE_FAKE_NATIVE_TOOL") })])))
  const taskRegistration = registry.currentRegistrationIdentity("task")
  if (!taskRegistration) return yield* Effect.die("Real Task registration missing")
  const records = createSfRoutineNativeRecords({ database, store, relayFor: async () => undefined })
  const resources: SfRoutineNativeRuntimeResources = { identity: { installationId: "phase-fixture", hostId: "phase-host", projectId: nativeLocation.project.id, location },
    database, events, store, execution, sessions, registry, records, location: nativeLocation,
    agents: Context.get(opened, AgentV2.Service), permission: Context.get(opened, PermissionV2.Service), governance: Context.get(opened, TaskGovernance.Service),
    safety: Context.getUnsafe(opened, ToolSafety.Service), relay: Context.get(opened, Relay.Service), config: Context.get(opened, Config.Service), taskRegistration,
    governanceInstallation: { epoch: 1, projectId: nativeLocation.project.id, directory }, current: () => true }
  prepared.state.resources = resources; prepared.state.sessions = sessions; prepared.state.context = prepared.ui()
  const authoring = yield* AuthoringStore.open(directory, nativeLocation.project.id)
  prepared.state.publication = { publication: { projectID: nativeLocation.project.id, use: (read) => read(authoring),
    skills: () => Effect.die("no workflow skills in component fixture"), acceptance: [] }, authorize: async () => prepared.state.authorized, authorSession: async () => undefined }
  return { ...prepared, sessions, execution, resources, directory, authoring, skills: Context.get(opened, SkillV2.Service) }
})
