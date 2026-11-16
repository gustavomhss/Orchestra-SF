import path from "node:path"
import { DateTime, Effect, Schema } from "effect"
import { AgentV2 } from "@orchestra/core/agent"
import { EventV2 } from "@orchestra/core/event"
import { ModelV2 } from "@orchestra/core/model"
import { ProviderV2 } from "@orchestra/core/provider"
import { RelayWorkflowBinding } from "@orchestra/core/relay-workflow-binding"
import { SessionMessage } from "@orchestra/core/session/message"
import { SessionMessageTable } from "@orchestra/core/session/sql"
import { AuthoringGraph } from "@orchestra/relay/authoring/graph"
import { MaestroEvent } from "@orchestra/schema/maestro-event"
import { SessionEvent } from "@orchestra/schema/session-event"
import { createResidentAiBundle } from "../../../product/ai/resident.ts"
import { createSfExecutionBindingRegistry } from "../../../product/host-binding/execution-context.ts"
import { loadSfSkill } from "../../../product/host-binding/skill-loader.ts"
import { registerSfResidentAgents, sfSourceFor } from "../../../product/host-binding/resident-agents.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { fixturePlan } from "../routine-native-admission/fixture.ts"
import { GovernanceRecordsV2 } from "../../../../../maestro/coordination/src/v2/governance/records.ts"
import { GovernanceDispatchV2 } from "../../../../../maestro/coordination/src/v2/governance/dispatch.ts"
import { MaestroReviewRecords } from "../../../../../maestro/coordination/src/v2/tools/review-records.ts"
import { WorkflowGateV2 } from "../../../../../maestro/coordination/src/v2/governance/workflow.ts"
import { taskHash } from "../../../../../maestro/coordination/src/task-hash.ts"
import type { PlanningLease } from "../../../../../../apps/cli/src/sucafina-product/routine-native-phase-bridge.ts"
import { SF_ROUTINE_INPUT_PARAMETER } from "../../../../../../apps/cli/src/sucafina-product/routine-native-input.ts"
import type { PhaseFixture } from "./fixture.ts"

/** Actual C11 registry and genuine skill loader/receipt, with fixture identity/role rights (not enterprise auth). */
export const nativeCaller = Effect.fn("PhaseFixture.nativeCaller")(function* (f: PhaseFixture) {
  const root = path.resolve(import.meta.dir, "../../../product/ai")
  const bundle = yield* Effect.promise(() => createResidentAiBundle({ root, manifestPath: path.join(root, "manifests/resident.json") }))
  const profile = bundle.profiles.find((profile) => profile.id === "sf_maestro")!
  const skill = bundle.skills.find((skill) => skill.allowedProfiles.includes(profile.id) && skill.allowedOperations.includes("sf_routine_catalog"))!
  const selected = { profile, skills: [skill], operationIds: skill.allowedOperations.filter((operation) => profile.allowedOperations.includes(operation)),
    manifestDigest: bundle.manifestDigest }
  const sourceCapability = yield* registerSfResidentAgents({ agents: f.resources.agents, skills: f.skills, selected: [selected], source: bundle.source })
  const resident = yield* f.sessions.create({ location: f.resources.identity.location, agent: AgentV2.ID.make(profile.id) })
  const runId = crypto.randomUUID()
  const receipt = yield* loadSfSkill({ session: f.sessions, skills: f.skills, sourceCapability, selected, sessionID: resident.id,
    profile, skill, runId, manifestDigest: bundle.manifestDigest })
  const request = f.state.request
  const registry = createSfExecutionBindingRegistry({
    authenticateAndResolve: async () => f.state.authorized ? { ...f.state.resources!.identity,
      locationId: digestSfValue(f.state.resources!.identity.location), principalRef: "phase-principal", policyVersion: "policy-1", accessRevision: "access-1",
      providerGeneration: f.state.generation, expiresAt: new Date(Date.now() + 60_000).toISOString() } : undefined,
    revalidateAdmission: async (value, binding) => {
      const session = await Effect.runPromise(f.resources.store.get(value.sessionID))
      return f.state.authorized && session?.agent === profile.id && binding.hostId === f.state.resources!.identity.hostId &&
        binding.providerGeneration === f.state.generation && digestSfValue(value.caseRef) === digestSfValue(f.state.caseRef) &&
        !!sfSourceFor(sourceCapability, f.skills, selected)
    },
  })
  f.state.native = registry
  const bound = yield* Effect.promise(() => registry.bind({ request, sessionID: resident.id, runId, caseRef: f.state.caseRef,
    selected, profile, skillReceipts: [receipt], manifestDigest: bundle.manifestDigest, entryMode: "interactive" }))
  if (bound.status !== "ok") return yield* Effect.die("Real C11 fixture binding failed")
  return { registry, resident, binding: bound.value,
    call: async (operation: string, payload: unknown) => {
      const digest = digestSfValue(payload)
      const leased = await registry.lease({ sessionID: resident.id, agent: AgentV2.ID.make(profile.id), assistantMessageID: SessionMessage.ID.create(), toolCallID: crypto.randomUUID() }, operation, digest)
      if (leased.status !== "ok" || !registry.consume(leased.value, operation, digest)) throw new Error("Real C11 fixture lease failed")
      return leased.value
    },
  }
})

/** Explicitly SYNTHETIC C15 approval/Task/arm facts in canonical SQLite. The phase parent and its original source
 * provenance are real API products. These records exercise read-only boundaries; they prove NO real approval,
 * Task execution, Relay completion or provider acceptance. No product writer fabricates these events.
 */
export const seedNativeAdmission = Effect.fn("PhaseFixture.seedNativeAdmission")(function* (f: PhaseFixture, lease: PlanningLease, purpose: string, settled: boolean) {
  const parent = (yield* f.resources.store.get(lease.authoritySessionID))!
  const id = (name: string) => EventV2.ID.make(`evt_phase_${name}_${parent.id}`)
  const message = (name: string) => SessionMessage.ID.make(`msg_phase_${name}_${parent.id}`)
  const draft = yield* Effect.gen(function* () {
    const graph = yield* AuthoringGraph.project("Synthetic history workflow", { work_packages: [{ id: "prepare", instructions: "Fixture only",
      checklist: [{ id: "fixture-check", cmd: "true" }] }] })
    const draft = yield* f.authoring.save({ body: graph }); yield* f.authoring.publish(draft.id, draft.versionId); return draft
  })
  const retained = { schema: "sf-routine-native-input-v1", purpose, owner: lease.owner, caseRef: f.state.caseRef,
    publishedRecipeRef: draft.id, inputRefs: [], parameters: {}, sourceRefs: [] }
  const acquired = yield* RelayWorkflowBinding.acquire({ port: f.state.publication!.publication, projectID: parent.projectID,
    documentID: draft.id, parameters: { [SF_ROUTINE_INPUT_PARAMETER]: JSON.stringify(retained) }, writePaths: ["review-output"] })
  const template = fixturePlan(parent.id)
  const { id: _id, revisionHash: _hash, createdAt: _created, ...body } = template
  const definition = { ...body, workflowBinding: acquired.definition }
  const hash = GovernanceRecordsV2.hash(definition)
  const plan = Schema.decodeUnknownSync(MaestroEvent.PlanRevision.RecordedV3.data)({ ...definition,
    id: `evt_maestro_plan_revision_${hash}`, revisionHash: hash, createdAt: Date.now() })
  yield* f.resources.events.publish(MaestroEvent.PlanRevision.RecordedV3, plan, { id: EventV2.ID.make(plan.id) })
  const context = { id: id("context"), sessionID: parent.id, planRevisionID: plan.id, projectID: parent.projectID,
    directory: parent.location.directory, mode: "UNGROUNDED" as const, branch: "fixture", headSHA: "a".repeat(40), changedPaths: [],
    currentEvidenceIdentityHash: "b".repeat(64), contextHash: "c".repeat(64), status: "CURRENT" as const, createdAt: Date.now() }
  yield* f.resources.events.publish(MaestroEvent.Context.Recorded, context, { id: context.id })
  const shared = { sessionID: parent.id, projectID: parent.projectID, workCardHash: MaestroReviewRecords.workCardHash("Synthetic history"),
    routedMemberID: "backend", rosterHash: "d".repeat(64), grantHash: "e".repeat(64), reviewPolicyHash: "f".repeat(64) }
  yield* f.resources.events.publish(MaestroEvent.Validation.RecordedV2, { ...shared,
    actor: MaestroReviewRecords.actor(parent, "maestro"), planRevisionID: plan.id, contextRecordID: context.id, contextHash: context.contextHash,
    workCardID: "synthetic-history", workCard: "Synthetic history", validatorID: "maestro", validatorVersion: "fixture",
    checks: [{ id: "synthetic", status: "PASS", detail: "Fixture input, not validation proof" }], outcome: "VALID" }, { id: id("validation") })
  const validation = (yield* GovernanceRecordsV2.readValidation(f.resources.database.db, id("validation")))!
  yield* f.resources.events.publish(MaestroEvent.Review.ReceivedV2, { ...shared, actor: MaestroReviewRecords.actor(parent, "lucy"),
    validationRecordID: validation.id, reviewerID: "lucy", reviewMethodVersion: "synthetic",
    artifact: { workCardHash: shared.workCardHash, sha256: "1".repeat(64), baseSHA: "2".repeat(40), headSHA: context.headSHA,
      worktree: parent.location.directory, changedPaths: [] }, verdict: "APPROVE", findings: [], stage: "plan" }, { id: id("review") })
  const intent = { subagentType: "backend", prompt: "Synthetic history intent" }
  const validationHash = MaestroReviewRecords.hash(validation)
  const approval = { sessionID: parent.id, projectID: parent.projectID, memberID: "maestro", planRevisionID: plan.id,
    validationRecordID: validation.id, revisionHash: hash, validationHash, contextHash: context.contextHash, policyHash: shared.reviewPolicyHash,
    taskHash: taskHash({ ...intent, planRevisionID: plan.id, revisionHash: hash, validationRecordID: validation.id, validationHash,
      contextHash: context.contextHash, policyHash: shared.reviewPolicyHash, workflowBinding: acquired.definition, writePaths: acquired.definition.writePaths }), methodVersion: "synthetic" }
  const presentation = `apr_phase_${parent.id}`
  yield* f.resources.events.publish(MaestroEvent.Approval.Presented, { ...approval, id: presentation, assistantMessageID: message("shown"), callID: "present",
    intent, plan: "Synthetic plan", provenance: "Fixture only", assumptions: [], validationLedger: validation.id, contextState: "CURRENT" }, { id: id("presentation") })
  yield* f.resources.events.publish(MaestroEvent.Approval.Decided, { ...approval, presentationID: presentation,
    presentationMessageID: message("shown"), approvalMessageID: message("human"), outcome: "APPROVED", decisionTime: Date.now() }, { id: id("approval") })
  yield* f.resources.events.publish(MaestroEvent.Authorization.Granted, { ...shared, actor: validation.actor,
    approvalMessageID: message("human"), validationRecordID: validation.id, reviewerID: "lucy",
    taskIntentHash: GovernanceDispatchV2.taskIntentHash(intent), methodVersion: "synthetic" }, { id: id("authorization") })
  const model = ModelV2.Ref.make({ providerID: ProviderV2.ID.make("phase-fixture"), id: ModelV2.ID.make("chat") })
  const time = { created: DateTime.makeUnsafe(Date.now()) }
  const messages: SessionMessage.Message[] = [SessionMessage.Assistant.make({ id: message("shown"), type: "assistant", agent: "maestro", model, time, content: [] }),
    SessionMessage.User.make({ id: message("human"), type: "user", text: "Explicit synthetic consent fixture, NOT real approval", time })]
  if (settled) {
    const childID = GovernanceDispatchV2.childSessionID(id("authorization")), token = "phase-synthetic-arm"
    yield* f.resources.events.publish(SessionEvent.Tool.Progress, { sessionID: parent.id, assistantMessageID: message("task"), callID: "arm", timestamp: time.created,
      structured: { nativeArsenal: { source: "native-host", version: 1, kind: "completion-arm", tool: "maestro_arsenal_execute", token,
        projectID: parent.projectID, directory: parent.location.directory } }, content: [] })
    yield* f.resources.events.publish(MaestroEvent.Dispatch.ReservedV2, { sessionID: parent.id, authorizationID: id("authorization"), childSessionID: childID,
      projectID: parent.projectID, routedMemberID: "backend", taskIntentHash: GovernanceDispatchV2.taskIntentHash(intent), permission: [] },
    { id: GovernanceDispatchV2.reservationID(id("authorization")) })
    yield* f.resources.events.publish(MaestroEvent.Task.WorkflowBound, { executionSessionID: childID, authorityMessageID: message("task"), authorityCallID: "task", token,
      binding: { definition: acquired.definition, planRevisionID: plan.id, executionSessionID: childID, authoritySessionID: parent.id, logicalTaskID: "synthetic-logical" } },
    { id: EventV2.ID.make(WorkflowGateV2.eventID(childID)) })
    messages.push(SessionMessage.Assistant.make({ id: message("task"), type: "assistant", agent: "maestro", model, time, content: [{ type: "tool", name: "task", id: "task",
      provider: { executed: false }, time, state: { status: "error", input: { description: "Synthetic history", prompt: intent.prompt, subagent_type: "backend",
        authorizationID: id("authorization"), workflow: { documentID: draft.id, planRevisionID: plan.id, parameters: acquired.definition.parameters },
        writePaths: acquired.definition.writePaths }, content: [], structured: {}, error: { type: "unknown", message: "Synthetic terminal failure" } } }] }))
  }
  yield* f.resources.database.db.insert(SessionMessageTable).values(messages.map((value, index) => ({ id: value.id, session_id: parent.id,
    type: value.type, seq: 1_000_000 + index, time_created: DateTime.toEpochMillis(value.time.created), data: Schema.encodeSync(SessionMessage.Message)(value) }))).run().pipe(Effect.orDie)
  return (yield* Effect.promise(() => f.resources.records.readAdmission(id("authorization"))))!
})
