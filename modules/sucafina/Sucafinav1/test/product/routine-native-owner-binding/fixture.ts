import { DateTime, Effect, Layer, Schema } from "effect"
import { eq } from "drizzle-orm"
import { AgentV2 } from "@orchestra/core/agent"
import { CapabilityInvocation } from "@orchestra/core/capability/invocation"
import { Database } from "@orchestra/core/database/database"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { EventV2 } from "@orchestra/core/event"
import { Location } from "@orchestra/core/location"
import { ModelV2 } from "@orchestra/core/model"
import { PermissionV2 } from "@orchestra/core/permission"
import { PermissionSaved } from "@orchestra/core/permission/saved"
import { Project } from "@orchestra/core/project"
import { ProviderV2 } from "@orchestra/core/provider"
import { RelayWorkflowBinding } from "@orchestra/core/relay-workflow-binding"
import { AbsolutePath } from "@orchestra/core/schema"
import { SessionMessage } from "@orchestra/core/session/message"
import { SessionSchema } from "@orchestra/core/session/schema"
import { SessionMessageTable, SessionTable } from "@orchestra/core/session/sql"
import { SessionStore } from "@orchestra/core/session/store"
import { ToolOutputStore } from "@orchestra/core/tool-output-store"
import { ToolSafety } from "@orchestra/core/tool-safety"
import { ToolRegistry } from "@orchestra/core/tool/registry"
import { TaskTool } from "@orchestra/core/tool/task"
import { Tool } from "@orchestra/core/tool/tool"
import { AuthoringGraph } from "@orchestra/relay/authoring/graph"
import { AuthoringStore } from "@orchestra/relay/authoring/store"
import { MaestroEvent } from "@orchestra/schema/maestro-event"
import { SessionEvent } from "@orchestra/schema/session-event"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { TrustedCallContext, TrustedDomainContext, TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import type { RoutinePublicationHost } from "../../../product/routines/publication.ts"
import { taskHash } from "../../../../../maestro/coordination/src/task-hash.ts"
import { GovernanceDispatchV2 } from "../../../../../maestro/coordination/src/v2/governance/dispatch.ts"
import { GovernanceInputV2 } from "../../../../../maestro/coordination/src/v2/governance/input.ts"
import { GovernanceRecordsV2 } from "../../../../../maestro/coordination/src/v2/governance/records.ts"
import { WorkflowGateV2 } from "../../../../../maestro/coordination/src/v2/governance/workflow.ts"
import { MaestroReviewRecords } from "../../../../../maestro/coordination/src/v2/tools/review-records.ts"
import { createSfRoutineNativeAdapter } from "../../../../../../apps/cli/src/sucafina-product/routine-native-adapter.ts"
import { createSfRoutineNativeGovernance } from "../../../../../../apps/cli/src/sucafina-product/routine-native-governance.ts"
import { SF_ROUTINE_INPUT_PARAMETER } from "../../../../../../apps/cli/src/sucafina-product/routine-native-input.ts"
import { createSfRoutineNativeRecords, type NativePlan } from "../../../../../../apps/cli/src/sucafina-product/routine-native-records.ts"
import { createSfRoutineNativeOwnerRegistry } from "../../../../../../apps/cli/src/sucafina-product/routine-native-registry.ts"
import type { SfRoutineNativeRuntimeResources } from "../../../../../../apps/cli/src/sucafina-product/routine-native-runtime.ts"
import { fixturePlan, seedSession, withNativeRecords } from "../routine-native-admission/fixture.ts"

/**
 * Fixture boundary: SQLite, EventV2, SessionStore, AgentV2, PermissionV2, PermissionSaved,
 * ToolRegistry, publication storage, compiler and native record readers are real implementations.
 * All sessions/messages/approval/arm records below are explicitly synthetic persisted test data.
 * The host Request lease and core CapabilityInvocation frame are deliberately injected fixtures:
 * no HTTP-to-Maestro producer, model turn, permission answer, Task dispatch, Relay run or Schedule
 * admission is exercised. A green result is component evidence only, never AM02 or AM06.
 */
export const ids = {
  parent: SessionSchema.ID.make("ses_sf_m41_owner_fixture"),
  context: EventV2.ID.make("evt_sf_m41_context_fixture"),
  validation: EventV2.ID.make("evt_sf_m41_validation_fixture"),
  authorization: EventV2.ID.make("evt_sf_m41_authorization_fixture"),
  presentationRow: EventV2.ID.make("evt_maestro_approval_m41_fixture"),
  presentation: "apr_m41_fixture",
  armRow: EventV2.ID.make("evt_sf_m41_arm_fixture"),
  human: SessionMessage.ID.make("msg_sf_m41_human_fixture"),
  shown: SessionMessage.ID.make("msg_sf_m41_shown_fixture"),
  task: SessionMessage.ID.make("msg_sf_m41_task_fixture"),
  call: "call_sf_m41_task_fixture",
}
const model = { id: ModelV2.ID.make("fixture-model"), providerID: ProviderV2.ID.make("fixture-provider") }
const time = { created: DateTime.makeUnsafe(1_700_000_000_000) }
export const taskRules: PermissionV2.Ruleset = [{ action: "task", resource: "backend", effect: "ask" }]

// Registration identity is exercised through the real scoped registry; executing this fixture is an error.
export const nonExecutingTask = () => Tool.make({
  description: "Synthetic Task registration for owner-binding reader tests; never execute",
  input: Schema.Struct({ ...TaskTool.Input.fields, ...GovernanceInputV2.fields }),
  output: Schema.String,
  execute: () => Effect.die("SYNTHETIC_TASK_MUST_NOT_DISPATCH"),
})

function unavailable<T>(label: string): T {
  return new Proxy({}, { get: () => { throw new Error(`UNEXERCISED_FIXTURE_SERVICE:${label}`) } }) as T
}

const completeAdmission = Effect.fn("SfOwnerFixture.completeAdmission")(function* (directory: string) {
  const database = yield* Database.Service
  const events = yield* EventV2.Service
  const store = yield* SessionStore.Service
  yield* seedSession({ id: ids.parent, directory, agent: "maestro" })
  yield* database.db.update(SessionTable).set({ model }).where(eq(SessionTable.id, ids.parent)).run().pipe(Effect.orDie)
  const parent = yield* store.get(ids.parent)
  if (!parent) return yield* Effect.die("Synthetic Maestro session missing")
  const authoring = yield* AuthoringStore.open(directory, Project.ID.global)
  const graph = yield* AuthoringGraph.project("Synthetic selected review", { work_packages: [{
    id: "prepare", instructions: "Prepare fixture facts", checklist: [{ id: "fixture-check", cmd: "true" }],
  }] })
  const draft = yield* authoring.save({ body: graph })
  yield* authoring.publish(draft.id, draft.versionId)
  const publication: RelayWorkflowBinding.PublicationPort = {
    projectID: Project.ID.global, use: (read) => read(authoring),
    skills: () => Effect.fail(new AuthoringGraph.Refusal({ status: 404, code: "skill-unavailable", message: "No skill selected in synthetic fixture" })),
    acceptance: [{ id: "package-verification", host_check: "package-verification" }, { id: "cold-review", host_check: "cold-review" }],
  }
  const retained = {
    schema: "sf-routine-native-input-v1", purpose: "Prepare selected review",
    owner: { installationId: "installation-fixture", hostId: "host-fixture", projectId: Project.ID.global,
      locationId: digestSfValue(parent.location), authoritySessionId: ids.parent,
      principalRef: "principal-fixture", policyVersion: "policy-1", accessRevision: "access-1", providerGeneration: 2 },
    caseRef: { id: "case-fixture", incarnation: "case-incarnation-fixture", version: 1 },
    publishedRecipeRef: draft.id, inputRefs: [], parameters: {}, sourceRefs: [],
  }
  const acquired = yield* RelayWorkflowBinding.acquire({ port: publication, projectID: Project.ID.global,
    documentID: draft.id, parameters: { [SF_ROUTINE_INPUT_PARAMETER]: JSON.stringify(retained) }, writePaths: ["review-output"] })
  const source = fixturePlan(ids.parent)
  const { id: _id, revisionHash: _hash, createdAt: _created, ...body } = source
  const planBody = { ...body, workflowBinding: acquired.definition }
  const revisionHash = GovernanceRecordsV2.hash(planBody)
  const decoded = Schema.decodeUnknownSync(MaestroEvent.PlanRevision.RecordedV3.data)({ ...planBody,
    id: `evt_maestro_plan_revision_${revisionHash}`, revisionHash, createdAt: 1_700_000_000_000 })
  if (!decoded.workflowBinding) return yield* Effect.die("Synthetic workflow definition missing")
  const plan: NativePlan = { ...decoded, id: EventV2.ID.make(decoded.id), workflowBinding: decoded.workflowBinding }
  yield* events.publish(MaestroEvent.PlanRevision.RecordedV3, plan, { id: plan.id })
  const context = { id: ids.context, sessionID: ids.parent, planRevisionID: plan.id, projectID: Project.ID.global,
    directory, mode: "UNGROUNDED" as const, branch: "fixture", headSHA: "a".repeat(40), changedPaths: [],
    currentEvidenceIdentityHash: "b".repeat(64), contextHash: "c".repeat(64), status: "CURRENT" as const, createdAt: 1_700_000_000_000 }
  yield* events.publish(MaestroEvent.Context.Recorded, context, { id: ids.context })
  const workCard = "Synthetic owner binding coverage for the selected case"
  const shared = { sessionID: ids.parent, projectID: Project.ID.global,
    workCardHash: MaestroReviewRecords.workCardHash(workCard), routedMemberID: "backend",
    rosterHash: "d".repeat(64), grantHash: "e".repeat(64), reviewPolicyHash: "f".repeat(64) }
  yield* events.publish(MaestroEvent.Validation.RecordedV2, {
    ...shared, actor: MaestroReviewRecords.actor({ id: ids.parent, projectID: Project.ID.global }, "maestro"),
    planRevisionID: plan.id, contextRecordID: ids.context, contextHash: context.contextHash,
    workCardID: "workcard-m41-fixture", workCard, validatorID: "maestro", validatorVersion: "synthetic-fixture",
    checks: [{ id: "owner-fixture", status: "PASS", detail: "Synthetic persisted test input" }], outcome: "VALID",
  }, { id: ids.validation })
  const validation = yield* GovernanceRecordsV2.readValidation(database.db, ids.validation)
  if (!validation) return yield* Effect.die("Synthetic native validation missing")
  yield* events.publish(MaestroEvent.Review.ReceivedV2, {
    ...shared, actor: MaestroReviewRecords.actor({ id: ids.parent, projectID: Project.ID.global }, "lucy"),
    validationRecordID: ids.validation, reviewerID: "lucy", reviewMethodVersion: "synthetic-reader-review",
    artifact: { workCardHash: shared.workCardHash, sha256: "1".repeat(64), baseSHA: "2".repeat(40),
      headSHA: context.headSHA, worktree: directory, changedPaths: [] }, verdict: "APPROVE", findings: [], stage: "plan",
  }, { id: EventV2.ID.make("evt_sf_m41_review_fixture") })
  const intent = { subagentType: "backend", prompt: "Prepare the selected review" }
  const validationHash = MaestroReviewRecords.hash(validation)
  const approval = { sessionID: ids.parent, projectID: Project.ID.global, memberID: "maestro", planRevisionID: plan.id,
    validationRecordID: ids.validation, revisionHash: plan.revisionHash, validationHash, contextHash: context.contextHash,
    policyHash: shared.reviewPolicyHash, taskHash: taskHash({ ...intent, planRevisionID: plan.id,
      revisionHash: plan.revisionHash, validationRecordID: ids.validation, validationHash, contextHash: context.contextHash,
      policyHash: shared.reviewPolicyHash, workflowBinding: plan.workflowBinding, writePaths: plan.workflowBinding.writePaths }),
    methodVersion: "synthetic-reader-approval" }
  yield* events.publish(MaestroEvent.Approval.Presented, { ...approval, id: ids.presentation,
    assistantMessageID: ids.shown, callID: "call_m41_present_fixture", intent, plan: "Synthetic plan presentation",
    provenance: "Synthetic owner-binding fixture", assumptions: [], validationLedger: ids.validation, contextState: "CURRENT",
  }, { id: ids.presentationRow })
  yield* events.publish(MaestroEvent.Approval.Decided, { ...approval, presentationID: ids.presentation,
    presentationMessageID: ids.shown, approvalMessageID: ids.human, outcome: "APPROVED", decisionTime: 1_700_000_000_001,
  }, { id: EventV2.ID.make("evt_sf_m41_approval_fixture") })
  const intentHash = GovernanceDispatchV2.taskIntentHash(intent)
  yield* events.publish(MaestroEvent.Authorization.Granted, { ...shared, actor: validation.actor,
    approvalMessageID: ids.human, validationRecordID: ids.validation, reviewerID: "lucy", taskIntentHash: intentHash,
    methodVersion: "synthetic-reader-authorization",
  }, { id: ids.authorization })
  const token = "sf-m41-synthetic-arm-fixture"
  yield* events.publish(SessionEvent.Tool.Progress, { sessionID: ids.parent, assistantMessageID: ids.task,
    callID: "call_m41_native_arm_fixture", timestamp: time.created, structured: { nativeArsenal: {
      source: "native-host", version: 1, kind: "completion-arm", tool: "maestro_arsenal_execute", token,
      projectID: Project.ID.global, directory,
    } }, content: [],
  }, { id: ids.armRow })
  const childID = GovernanceDispatchV2.childSessionID(ids.authorization)
  yield* events.publish(MaestroEvent.Dispatch.ReservedV2, { sessionID: ids.parent,
    authorizationID: ids.authorization, childSessionID: childID, projectID: Project.ID.global,
    routedMemberID: "backend", taskIntentHash: intentHash, permission: [],
  }, { id: GovernanceDispatchV2.reservationID(ids.authorization) })
  yield* events.publish(MaestroEvent.Task.WorkflowBound, { executionSessionID: childID,
    authorityMessageID: ids.task, authorityCallID: ids.call, token,
    binding: { definition: plan.workflowBinding, planRevisionID: plan.id, executionSessionID: childID,
      authoritySessionID: ids.parent, logicalTaskID: "logical-m41-synthetic-fixture" },
  }, { id: WorkflowGateV2.eventID(childID) })
  const taskInput = { description: "Selected review", prompt: intent.prompt, subagent_type: intent.subagentType,
    authorizationID: ids.authorization, workflow: { documentID: draft.id, planRevisionID: plan.id,
      parameters: plan.workflowBinding.parameters }, writePaths: plan.workflowBinding.writePaths }
  const taskMessage = SessionMessage.Assistant.make({ id: ids.task, type: "assistant", agent: "maestro", model, time,
    content: [{ type: "tool", id: ids.call, name: "task", provider: { executed: false }, time,
      state: { status: "running", input: taskInput, structured: {}, content: [] } }] })
  const messages = [
    SessionMessage.Assistant.make({ id: ids.shown, type: "assistant", agent: "maestro", model, time, content: [] }),
    SessionMessage.User.make({ id: ids.human, type: "user", text: "Synthetic human approval fixture", time }), taskMessage,
  ]
  yield* database.db.insert(SessionMessageTable).values(messages.map((message, index) => ({ id: message.id,
    session_id: ids.parent, type: message.type, seq: index + 1, time_created: DateTime.toEpochMillis(message.time.created),
    data: Schema.encodeSync(SessionMessage.Message)(message),
  }))).run().pipe(Effect.orDie)
  return { plan, retained, childID, taskInput, taskMessage, publication, authoring, draft, nativeLocation: parent.location }
})

const setup = Effect.fn("SfOwnerFixture.setup")(function* (directory: string) {
  const database = yield* Database.Service
  const events = yield* EventV2.Service
  const store = yield* SessionStore.Service
  const location = Location.Service.of({ directory: AbsolutePath.make(directory),
    project: { id: Project.ID.global, directory: AbsolutePath.make(directory) } })
  const native = AppNodeBuilder.build(LayerNode.group([
    AgentV2.node, PermissionSaved.node, PermissionV2.node, ToolRegistry.node, ToolSafety.node,
  ]), [
    [Database.node, Layer.succeed(Database.Service, database)],
    [EventV2.node, Layer.succeed(EventV2.Service, events)],
    [SessionStore.node, Layer.succeed(SessionStore.Service, store)],
    [Location.node, Layer.succeed(Location.Service, location)],
    // Registration does not use output retention or native settlement. Any unexpected call rejects.
    [ToolOutputStore.node, Layer.mock(ToolOutputStore.Service, {})],
    [ToolSafety.node, Layer.mock(ToolSafety.Service, {})],
  ])
  return { database, events, store, location, native }
})

const build = Effect.fn("SfOwnerFixture.build")(function* (directory: string, base: {
  database: Database.Interface; events: EventV2.Interface; store: SessionStore.Interface; location: Location.Interface
}) {
  const agents = yield* AgentV2.Service
  const permission = yield* PermissionV2.Service
  const saved = yield* PermissionSaved.Service
  const toolRegistry = yield* ToolRegistry.Service
  const safety = yield* ToolSafety.Service
  yield* agents.transform((editor) => editor.update(AgentV2.defaultID, (agent) => {
    agent.mode = "primary"; agent.hidden = false; agent.permissions = [...taskRules]
  }))
  yield* toolRegistry.register({ task: nonExecutingTask() })
  const seeded = yield* completeAdmission(directory)
  const controller = new AbortController()
  const request = new Request("https://sf-fixture.invalid/routines", { signal: controller.signal,
    headers: { "x-sf-fixture-actor": seeded.retained.owner.principalRef } })
  const binding = { installationId: "installation-fixture", hostId: "host-fixture", projectId: Project.ID.global,
    locationId: seeded.retained.owner.locationId, nativeSessionId: ids.parent, runId: seeded.childID,
    caseId: seeded.retained.caseRef.id, caseVersion: 1, caseIncarnation: seeded.retained.caseRef.incarnation,
    principalRef: "principal-fixture", profileId: "sf_maestro", profileVersion: "fixture-v1", manifestDigest: "f".repeat(64),
    skillReceipts: [], policyVersion: "policy-1", accessRevision: "access-1", providerGeneration: 2,
    expiresAt: new Date(Date.now() + 60_000).toISOString(), entryMode: "interactive" }
  // Explicit host-issuance substitute. The registry must additionally match this exact object and Request.
  const nativeContext = { kind: "native", binding, lease: {} } as unknown as TrustedCallContext
  const state: { resources: SfRoutineNativeRuntimeResources | undefined; request: Request;
    context: TrustedDomainContext; authorized: boolean; generation: number | undefined; now: number; live: boolean } = {
    resources: undefined, request, context: nativeContext, authorized: true, generation: 2, now: Date.now(), live: true,
  }
  const records = createSfRoutineNativeRecords({ database: base.database, store: base.store, relayFor: async () => undefined })
  const taskRegistration = toolRegistry.currentRegistrationIdentity("task")
  if (!taskRegistration) return yield* Effect.die("Synthetic Task registration missing")
  const resources: SfRoutineNativeRuntimeResources = { ...base, agents, permission, registry: toolRegistry, safety,
    identity: { installationId: "installation-fixture", hostId: "host-fixture", projectId: Project.ID.global,
      location: seeded.nativeLocation },
    governance: unavailable("TaskGovernance"), relay: unavailable("Relay"), execution: unavailable("SessionExecution"),
    config: unavailable("Config"), records, taskRegistration,
    governanceInstallation: { epoch: 1, projectId: Project.ID.global, directory }, current: () => state.live,
  }
  state.resources = resources
  const guards = createSfRoutineNativeGovernance({ records: () => records })
  const registry = createSfRoutineNativeOwnerRegistry({ resources: () => state.resources,
    requestFor: (context) => context === state.context ? state.request : undefined,
    authorize: async (context) => state.authorized && context === state.context,
    generation: async () => state.generation, now: () => state.now,
  })
  yield* Effect.addFinalizer(() => Effect.sync(() => { registry.dispose(); guards.dispose(); state.live = false }))
  const host: RoutinePublicationHost = { publication: seeded.publication,
    authorize: async (context) => state.authorized && context === state.context,
    authorSession: async () => ids.parent }
  const adapter = createSfRoutineNativeAdapter({ resources: () => state.resources, owners: () => registry.owners,
    requestFor: (context) => context === state.context ? state.request : undefined,
    authorize: async (context) => state.authorized && context === state.context, generation: async () => state.generation,
    publication: () => host,
    // No real guards are installed here. This fixture predicate allows ONLY read-only adapter queries.
    governance: { ...guards, installed: (service) => service === resources.governance && state.live },
    resolveCase: async () => ({ status: "ok", value: seeded.retained.caseRef }),
    resolveInputs: async () => ({ status: "ok", value: [] }), revalidateSources: async () => true,
  })
  const invocation: ToolSafety.Invocation = { tool: "task", args: seeded.taskInput, sessionID: ids.parent,
    assistantMessageID: ids.task, callID: ids.call, agent: "maestro", directory, projectID: Project.ID.global,
    projectDirectory: directory }
  const frame: CapabilityInvocation.HostInput = { issuer: "core", rootToolName: "task",
    owner: { projectID: Project.ID.global, location: resources.identity.location, sessionID: ids.parent, agentID: AgentV2.defaultID },
    invocation: { sessionID: ids.parent, agentID: AgentV2.defaultID, assistantMessageID: ids.task, callID: ids.call },
    effectiveRules: taskRules, nativeDenyFloor: [] }
  const enter = <A, E, R>(effect: Effect.Effect<A, E, R>, options: {
    context?: TrustedDomainContext; request?: Request; invocation?: ToolSafety.Invocation;
    frame?: CapabilityInvocation.HostInput | null
  } = {}) => {
    const settled = registry.run(options.invocation ?? invocation, effect)
    return registry.withRequest(options.context ?? state.context, options.request ?? state.request,
      options.frame === null ? settled : CapabilityInvocation.withContext(options.frame ?? frame, settled))
  }
  const writeTask = (message: SessionMessage.Assistant) => base.database.db.update(SessionMessageTable)
    .set({ data: Schema.encodeSync(SessionMessage.Message)(message) }).where(eq(SessionMessageTable.id, ids.task))
    .run().pipe(Effect.orDie)
  const ui = () => ({ kind: "ui", binding: { installationId: binding.installationId, projectId: binding.projectId,
    principalRef: binding.principalRef, policyVersion: binding.policyVersion, accessRevision: binding.accessRevision,
    expiresAt: binding.expiresAt, requestId: "synthetic-ui-request" }, lease: {} }) as unknown as TrustedUiContext
  return { ...base, ...seeded, directory, resources, state, controller, nativeContext, binding, agents, permission, saved,
    toolRegistry, registry, adapter, invocation, frame, enter, writeTask, ui }
})

export type OwnerFixture = Effect.Success<ReturnType<typeof build>>

export const withOwnerFixture = <A, E>(body: (fixture: OwnerFixture) => Effect.Effect<A, E>) =>
  withNativeRecords((directory) => Effect.scoped(Effect.gen(function* () {
    const base = yield* setup(directory)
    return yield* Effect.gen(function* () {
      const fixture = yield* build(directory, base)
      return yield* body(fixture)
    }).pipe(Effect.provide(base.native))
  })))
