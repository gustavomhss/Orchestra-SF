import { isDeepStrictEqual } from "node:util"
import { Effect, Option, Schema } from "effect"
import { AgentV2 } from "@orchestra/core/agent"
import { CapabilityInvocation } from "@orchestra/core/capability/invocation"
import { PermissionV2 } from "@orchestra/core/permission"
import { Project } from "@orchestra/core/project"
import { SessionMessage } from "@orchestra/core/session/message"
import { SessionSchema } from "@orchestra/core/session/schema"
import { TaskTool } from "@orchestra/core/tool/task"
import type { Tool } from "@orchestra/core/tool/tool"
import { ToolSafety } from "@orchestra/core/tool-safety"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { GovernanceDispatchV2 } from "../../../../modules/maestro/coordination/src/v2/governance/dispatch.ts"
import { GovernanceInputV2 } from "../../../../modules/maestro/coordination/src/v2/governance/input.ts"
import { readSfRoutineNativeInput, type SfRoutineNativeInput } from "./routine-native-input.ts"
import type { NativePlan } from "./routine-native-records.ts"
import type { SfRoutineNativeRuntimeResources } from "./routine-native-runtime.ts"

export type SfRoutineNativeOwnerWitness = Readonly<{
  authoritySessionID: SessionSchema.ID
  task: Readonly<{ assistantMessageID: SessionMessage.ID; toolCallID: string }>
  plan: NativePlan
  retained: SfRoutineNativeInput
  /** Rechecks canonical facts only. The installing hook must separately fence this witness's lifetime. */
  current: () => Promise<boolean>
}>

/**
 * Observe a real Task settlement; never mint a native frame or accept a Request/session selector as authority.
 * SF identity in the approved parameters is consistency data. The caller must supply a separate authenticated
 * Request capability and revoke the resulting binding when this hook finishes or its native services close.
 */
export const captureSfRoutineNativeOwner = Effect.fn("SfRoutineNativeOwner.capture")(function* (
  resources: SfRoutineNativeRuntimeResources,
  invocation: ToolSafety.Invocation,
) {
  const sessionID = Schema.decodeUnknownOption(SessionSchema.ID)(invocation.sessionID)
  const messageID = Schema.decodeUnknownOption(SessionMessage.ID)(invocation.assistantMessageID)
  if (invocation.tool !== TaskTool.name || invocation.agent !== AgentV2.defaultID || typeof invocation.callID !== "string" || !invocation.callID.trim() ||
    Option.isNone(sessionID) || Option.isNone(messageID) || invocation.projectID !== resources.identity.projectId ||
    invocation.directory !== resources.identity.location.directory ||
    invocation.projectDirectory !== (Project.isRoot(resources.location.project.directory)
      ? resources.location.directory : resources.location.project.directory)) return yield* denied("INVOCATION_INVALID")
  const context: Tool.Context = { sessionID: sessionID.value, agent: AgentV2.defaultID,
    assistantMessageID: messageID.value, toolCallID: invocation.callID }
  const frame = yield* CapabilityInvocation.require(context, {
    projectID: resources.location.project.id, location: resources.identity.location,
  }).pipe(Effect.mapError(() => denied("NATIVE_FRAME_REQUIRED")))
  if (frame.issuer !== "core" || frame.rootToolName !== TaskTool.name || frame.lineage.length !== 0 ||
    !isDeepStrictEqual(frame.invocation, frame.rootInvocation)) return yield* denied("NATIVE_FRAME_INVALID")
  const captured = yield* Effect.try({ try: () => freeze(structuredClone(invocation)), catch: () => denied("INVOCATION_INVALID") })
  const snapshot = freeze(structuredClone(yield* readSnapshot(resources, context, captured.args, frame)))
  const current = async () => {
    if (!isDeepStrictEqual(invocation, captured) || !live(resources)) return false
    const latest = await Effect.runPromise(readSnapshot(resources, context, captured.args, frame)).catch(() => undefined)
    return !!latest && isDeepStrictEqual(latest, snapshot) && isDeepStrictEqual(invocation, captured) && live(resources)
  }
  // An asynchronous reader may have observed a resource replacement or mutation between its own reads.
  if (!(yield* Effect.promise(current))) return yield* denied("AUTHORITY_CHANGED")
  return Object.freeze({ authoritySessionID: context.sessionID,
    task: Object.freeze({ assistantMessageID: context.assistantMessageID, toolCallID: context.toolCallID }),
    plan: snapshot.plan, retained: snapshot.retained, current } satisfies SfRoutineNativeOwnerWitness)
})

const readSnapshot = Effect.fn("SfRoutineNativeOwner.readSnapshot")(function* (
  resources: SfRoutineNativeRuntimeResources,
  context: Tool.Context,
  args: unknown,
  frame: CapabilityInvocation.Binding,
) {
  if (!live(resources)) return yield* denied("RUNTIME_UNAVAILABLE")
  const parent = yield* resources.store.get(context.sessionID)
  if (!parent || parent.time.archived || parent.projectID !== resources.identity.projectId ||
    parent.projectID !== resources.location.project.id ||
    (parent.agent !== undefined && parent.agent !== AgentV2.defaultID) ||
    !isDeepStrictEqual(parent.location, resources.identity.location) ||
    parent.location.directory !== resources.location.directory || parent.location.workspaceID !== resources.location.workspaceID)
    return yield* denied("SESSION_UNBOUND")
  const selected = yield* resources.agents.select(parent.agent)
  if (selected.id !== AgentV2.defaultID || !selected.info || selected.info.hidden || selected.info.mode === "subagent")
    return yield* denied("ACTOR_UNBOUND")
  const entry = yield* resources.store.message(context.assistantMessageID)
  if (entry?.sessionID !== parent.id || entry.message.type !== "assistant" || entry.message.agent !== AgentV2.defaultID ||
    entry.message.error || !entry.message.model || (parent.model && !sameModel(parent.model, entry.message.model)))
    return yield* denied("MESSAGE_UNBOUND")
  const parts = entry.message.content.filter((part): part is SessionMessage.AssistantTool =>
    part.type === "tool" && part.id === context.toolCallID)
  const part = parts[0]
  if (parts.length !== 1 || !part || part.name !== TaskTool.name || part.provider?.executed ||
    part.state.status !== "running" || !isDeepStrictEqual(part.state.input, args)) return yield* denied("TASK_UNBOUND")
  const decoded = Schema.decodeUnknownOption(Schema.Struct({ ...TaskTool.Input.fields, ...GovernanceInputV2.fields }))(
    part.state.input, { onExcessProperty: "error" })
  if (Option.isNone(decoded)) return yield* denied("TASK_INPUT_INVALID")
  const called = decoded.value
  if (!called.workflow || !called.authorizationID || called.background === true || called.worktree === true ||
    (called.directory !== undefined && called.directory !== parent.location.directory)) return yield* denied("TASK_INPUT_UNSUPPORTED")
  const plan = yield* Effect.tryPromise({ try: () => resources.records.readPlan(called.workflow!.planRevisionID),
    catch: () => denied("PLAN_UNAVAILABLE") })
  if (!plan || plan.id !== called.workflow.planRevisionID || plan.sessionID !== parent.id ||
    plan.workflowBinding.publication.projectID !== parent.projectID ||
    plan.workflowBinding.publication.documentID !== called.workflow.documentID ||
    !isDeepStrictEqual(plan.workflowBinding.parameters, called.workflow.parameters) ||
    !isDeepStrictEqual(plan.workflowBinding.writePaths, called.writePaths ?? [])) return yield* denied("PLAN_UNBOUND")
  const retained = readSfRoutineNativeInput(plan)
  if (!retained || retained.owner.installationId !== resources.identity.installationId ||
    retained.owner.hostId !== resources.identity.hostId || retained.owner.projectId !== parent.projectID ||
    retained.owner.locationId !== digestSfValue(parent.location) || retained.owner.authoritySessionId !== parent.id)
    return yield* denied("INPUT_UNBOUND")
  const admission = yield* Effect.tryPromise({ try: () => resources.records.readAdmission(called.authorizationID!),
    catch: () => denied("ADMISSION_UNAVAILABLE") })
  if (!admission || admission.authorizationID !== called.authorizationID || admission.parent.id !== parent.id ||
    !isDeepStrictEqual(admission.revision, plan) ||
    admission.authorization.taskIntentHash !== GovernanceDispatchV2.taskIntentHash({
      subagentType: called.subagent_type, prompt: called.prompt, model: called.model,
    }) || (admission.bound && (admission.bound.authorityMessageID !== context.assistantMessageID ||
      admission.bound.authorityCallID !== context.toolCallID))) return yield* denied("ADMISSION_UNBOUND")
  // This witness already requires Authorization.Granted. Missing/rejected human receipts cannot support it.
  // Reservation/binding may still advance from preparing to admitted under the original native governance.
  if (admission.review?.verdict !== "APPROVE" || admission.approval?.outcome !== "APPROVED" || !admission.presentation)
    return yield* denied("APPROVAL_UNBOUND")
  const permissions = [...selected.info.permissions.map((rule) => ({ ...rule })), ...(yield* resources.store.permissions(parent.id))]
  if (!isDeepStrictEqual(permissions, frame.effectiveRules)) return yield* denied("POLICY_CHANGED")
  const targets = [called.subagent_type, ...(called.model === undefined ? [] : [called.model])]
  if (targets.some((target) => PermissionV2.evaluate(TaskTool.name, target, permissions).effect === "deny" ||
    PermissionV2.evaluate(TaskTool.name, target, frame.nativeDenyFloor).effect === "deny"))
    return yield* denied("PERMISSION_DENIED")
  const permission = yield* resources.permission.evaluate({ action: TaskTool.name, resources: targets,
    sessionID: parent.id, agent: AgentV2.defaultID,
    source: { type: "tool", messageID: context.assistantMessageID, callID: context.toolCallID },
  }).pipe(Effect.mapError(() => denied("PERMISSION_UNAVAILABLE")))
  // `ask` stays pending for Task's actual authorization; observing it never approves or saves a permission.
  if (permission === "deny") return yield* denied("PERMISSION_DENIED")
  const scope = yield* resources.store.scope(parent.id)
  if (scope && !scope.scope.tools.includes(TaskTool.name)) return yield* denied("SCOPE_DENIED")
  const latest = yield* Effect.tryPromise({ try: () => resources.records.isLatestPlan(plan),
    catch: () => denied("PLAN_UNAVAILABLE") })
  if (!latest || !live(resources)) return yield* denied("PLAN_OR_RUNTIME_CHANGED")
  return {
    identity: { ...resources.identity, location: { ...resources.identity.location } },
    parent: { id: parent.id, parentID: parent.parentID, projectID: parent.projectID, agent: parent.agent,
      model: parent.model, location: parent.location },
    assistantModel: entry.message.model, called, permissions, scope: scope?.scope,
    plan, retained, authorization: admission.authorization, validation: admission.validation, context: admission.context,
    review: admission.review, approval: admission.approval, presentation: admission.presentation,
  }
})

function live(resources: SfRoutineNativeRuntimeResources) {
  return !!resources.taskRegistration && resources.current() &&
    resources.registry.currentRegistrationIdentity(TaskTool.name) === resources.taskRegistration
}

function sameModel(left: { providerID: string; id: string; variant?: string }, right: { providerID: string; id: string; variant?: string }) {
  return left.providerID === right.providerID && left.id === right.id && (left.variant ?? "default") === (right.variant ?? "default")
}

function freeze<T>(value: T): T {
  if (!value || typeof value !== "object") return value
  Object.values(value).forEach(freeze)
  return Object.freeze(value)
}

function denied(reason: string) {
  return new ToolSafety.Denied({ reason: `SF_ROUTINE_NATIVE_OWNER_${reason}` })
}
