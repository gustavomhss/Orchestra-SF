import { createHash } from "node:crypto"
import path from "node:path"
import { isDeepStrictEqual } from "node:util"
import { and, desc, eq, inArray, sql } from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import { DateTime, Effect, Option, Schema } from "effect"
import { AgentV2 } from "@orchestra/core/agent"
import type { Database } from "@orchestra/core/database/database"
import { EventV2 } from "@orchestra/core/event"
import type { Location } from "@orchestra/core/location"
import type { Relay } from "@orchestra/core/relay"
import { SessionMessage } from "@orchestra/core/session/message"
import { SessionSchema } from "@orchestra/core/session/schema"
import type { SessionStore } from "@orchestra/core/session/store"
import type { TaskTool } from "@orchestra/core/tool/task"
import { ArmLoad } from "../../../../modules/relay/src/arm/load.ts"
import type { RelayAudit } from "../../../../modules/relay/src/audit.ts"
import { MaestroEvent } from "../../../../packages/schema/src/maestro-event.ts"
import { RelayArm } from "../../../../packages/schema/src/relay-arm.ts"
import { taskHash } from "../../../../modules/maestro/coordination/src/task-hash.ts"
import { GovernanceDispatchV2 } from "../../../../modules/maestro/coordination/src/v2/governance/dispatch.ts"
import { GovernanceRecordsV2 } from "../../../../modules/maestro/coordination/src/v2/governance/records.ts"
import { WorkflowGateV2 } from "../../../../modules/maestro/coordination/src/v2/governance/workflow.ts"
import { MaestroReviewRecords } from "../../../../modules/maestro/coordination/src/v2/tools/review-records.ts"
import { WorkflowArmV2 } from "../../../../modules/maestro/coordination/src/v2/workflow/arm.ts"
import { WorkflowRecordsV2 } from "../../../../modules/maestro/coordination/src/v2/workflow/records.ts"

export type NativePlan = Effect.Success<ReturnType<typeof GovernanceRecordsV2.readWorkflowRevision>>
type Validation = NonNullable<Effect.Success<ReturnType<typeof GovernanceRecordsV2.readValidation>>>
type NativeContext = NonNullable<Effect.Success<ReturnType<typeof GovernanceRecordsV2.readContext>>>
type NativeReview = NonNullable<Effect.Success<ReturnType<typeof MaestroReviewRecords.findReview>>>
type Authorization = Schema.Schema.Type<typeof MaestroEvent.Authorization.Granted.data>
type Approval = Schema.Schema.Type<typeof MaestroEvent.Approval.Decided.data>
type Presentation = Schema.Schema.Type<typeof MaestroEvent.Approval.Presented.data>
type Reservation = Schema.Schema.Type<typeof MaestroEvent.Dispatch.ReservedV2.data>
type WorkflowBound = Schema.Schema.Type<typeof MaestroEvent.Task.WorkflowBound.data>

/** All references and versions below belong to existing native events. Nothing here reserves or writes a run. */
export type NativeAdmission = {
  readonly reference: string
  readonly version: number
  readonly state: "preparing" | "needs-review" | "admitted"
  readonly revision: NativePlan
  readonly authorizationID: string
  readonly authorization: Authorization & { readonly id: string }
  readonly validation: Validation
  readonly context: NativeContext
  readonly review?: NativeReview
  readonly approval?: Approval
  readonly presentation?: Presentation
  readonly reservation?: Reservation & { readonly id: string; readonly seq: number }
  readonly bound?: WorkflowBound
  readonly taskStatus?: SessionMessage.ToolState["status"]
  readonly parent: SessionSchema.Info
  readonly child?: SessionSchema.Info
}

/** Text from the provider and titles do not establish a native terminal result. */
export type NativeTaskResult = Pick<Schema.Schema.Type<typeof TaskTool.Output>,
  "sessionID" | "agent" | "model" | "sessionId" | "parentSessionId" | "agentId" | "directory">
export type NativeTerminal = {
  readonly admission: NativeAdmission
  readonly state: "running" | "awaiting-human" | "completed" | "failed"
  readonly resultRef?: string
  readonly completedAt?: string
  readonly checkpoint?: RelayArm.WorkflowCheckpoint
  readonly taskResult?: NativeTaskResult
  readonly audit?: RelayAudit.VerifyReport
}

export type SfRoutineNativeRecordsInput = {
  readonly database: Database.Interface
  readonly store: SessionStore.Interface
  readonly relayFor: (location: Location.Ref) => Promise<Relay.Interface | undefined>
}

const HISTORY_LIMIT = 256
const strict = { onExcessProperty: "error" } as const

/**
 * Projection of Task/Relay's durable records. The writer remains native Task governance and Relay. This reader
 * supports Authorization.Granted + Dispatch.ReservedV2; another admission protocol is unavailable until bound.
 * Missing rows are absence. Corrupt identities, ambiguous chains and truncated histories fail closed.
 */
export function createSfRoutineNativeRecords(input: SfRoutineNativeRecordsInput) {
  const db = input.database.db
  const row = (id: string) => Effect.runPromise(GovernanceRecordsV2.row(db, id))
  const rows = async (condition: SQL | undefined) => {
    const found = await Effect.runPromise(db.select().from(EventV2.EventTable).where(condition)
      .orderBy(desc(EventV2.EventTable.seq)).limit(HISTORY_LIMIT + 1).all().pipe(Effect.orDie))
    if (found.length > HISTORY_LIMIT) throw held("HISTORY_OVERFLOW")
    return found
  }
  const readPlan = async (id: string): Promise<NativePlan | undefined> => {
    if (!await row(id)) return undefined
    return Effect.runPromise(GovernanceRecordsV2.readWorkflowRevision(db, id))
  }
  const listPlans = async (parentID: string): Promise<readonly NativePlan[]> => {
    const found = await rows(and(eq(EventV2.EventTable.aggregate_id, parentID),
      eq(EventV2.EventTable.type, versioned(MaestroEvent.PlanRevision.RecordedV3.type, 3)),
      sql`json_type(${EventV2.EventTable.data}, '$.workflowBinding') = 'object'`))
    return Promise.all(found.map((record) => Effect.runPromise(GovernanceRecordsV2.readWorkflowRevision(db, record.id))))
  }
  const isLatestPlan = async (plan: NativePlan): Promise<boolean> => {
    const newest = await Effect.runPromise(db.select({ id: EventV2.EventTable.id }).from(EventV2.EventTable)
      .where(and(eq(EventV2.EventTable.aggregate_id, plan.sessionID), inArray(EventV2.EventTable.type,
        [1, 2, 3].map((version) => versioned(MaestroEvent.PlanRevision.Recorded.type, version)))))
      .orderBy(desc(EventV2.EventTable.seq)).limit(1).get().pipe(Effect.orDie))
    return newest?.id === plan.id
  }
  const readBoundPlan = async (childID: string): Promise<{ readonly planRevisionID: string; readonly revision: NativePlan } | undefined> => {
    if (!Schema.is(SessionSchema.ID)(childID)) return undefined
    const bound = await Effect.runPromise(WorkflowRecordsV2.read(db, childID))
    if (!bound) return undefined
    const boundRow = await row(WorkflowGateV2.eventID(childID))
    const revision = await readPlan(bound.binding.planRevisionID)
    if (!boundRow || boundRow.aggregate_id !== childID || !revision || revision.sessionID !== bound.binding.authoritySessionID ||
      !isDeepStrictEqual(revision.workflowBinding, bound.binding.definition)) throw held("WORKFLOW_BINDING_MISMATCH")
    return { planRevisionID: revision.id, revision }
  }

  const readTaskCall = async (bound: WorkflowBound, parent: SessionSchema.Info, revision: NativePlan,
    authorization: Authorization & { readonly id: string }) => {
    const authority = await Effect.runPromise(input.store.message(bound.authorityMessageID))
    if (authority?.sessionID !== parent.id || authority.message.type !== "assistant" ||
      authority.message.agent !== AgentV2.defaultID) throw held("TASK_CALL_UNBOUND")
    const message = authority.message
    const part = message.content.find((part) => part.type === "tool" && part.id === bound.authorityCallID)
    if (!part || part.type !== "tool" || part.name !== "task" || part.provider?.executed || part.state.status === "pending")
      throw held("TASK_CALL_UNBOUND")
    const { TaskTool } = await import("@orchestra/core/tool/task")
    const { GovernanceInputV2 } = await import("../../../../modules/maestro/coordination/src/v2/governance/input.ts")
    const { canonicalMemberId } = await import("../../../../modules/maestro/coordination/src/roster.ts")
    const called = decode(Schema.Struct({ ...TaskTool.Input.fields, ...GovernanceInputV2.fields }), part.state.input)
    if (called.authorizationID !== authorization.id || canonicalMemberId(called.subagent_type) !== canonicalMemberId(authorization.routedMemberID) ||
      called.workflow?.planRevisionID !== revision.id || called.workflow.documentID !== revision.workflowBinding.publication.documentID ||
      !isDeepStrictEqual(called.workflow.parameters, revision.workflowBinding.parameters) ||
      !isDeepStrictEqual(called.writePaths ?? [], revision.workflowBinding.writePaths) || called.worktree === true ||
      (called.directory !== undefined && called.directory !== parent.location.directory) ||
      GovernanceDispatchV2.taskIntentHash({ subagentType: called.subagent_type, prompt: called.prompt, model: called.model }) !== authorization.taskIntentHash)
      throw held("TASK_INPUT_MISMATCH")
    return { message, part }
  }

  const readAdmission = async (reference: string): Promise<NativeAdmission | undefined> => {
    const requested = await row(reference)
    if (!requested) return undefined
    const requestedReservation = requested.type === versioned(MaestroEvent.Dispatch.ReservedV2.type, 2)
      ? decode(MaestroEvent.Dispatch.ReservedV2.data, requested.data) : undefined
    if (!requestedReservation && requested.type !== versioned(MaestroEvent.Authorization.Granted.type, 1)) return undefined
    const authorizationID = requestedReservation?.authorizationID ?? requested.id
    const authRow = requestedReservation ? await row(authorizationID) : requested
    if (!authRow || authRow.type !== versioned(MaestroEvent.Authorization.Granted.type, 1)) throw held("AUTHORIZATION_MISSING")
    const authorization = { ...decode(MaestroEvent.Authorization.Granted.data, authRow.data), id: authRow.id }
    eventIdentity(authRow, authorization.sessionID)
    const validation = await Effect.runPromise(GovernanceRecordsV2.readValidation(db, authorization.validationRecordID))
    if (!validation?.planRevisionID || !validation.contextRecordID || validation.outcome !== "VALID")
      throw held("VALIDATION_UNBOUND")
    const revision = await readPlan(validation.planRevisionID)
    const context = await Effect.runPromise(GovernanceRecordsV2.readContext(db, validation.contextRecordID))
    if (!revision || !context || !Schema.is(SessionSchema.ID)(authorization.sessionID)) throw held("PLAN_CONTEXT_MISSING")
    const parent = await Effect.runPromise(input.store.get(authorization.sessionID))
    if (!parent || (parent.agent !== undefined && parent.agent !== AgentV2.defaultID)) throw held("AUTHORITY_SESSION_MISSING")
    const { canonicalMemberId } = await import("../../../../modules/maestro/coordination/src/roster.ts")
    if (validation.sessionID !== parent.id || revision.sessionID !== parent.id || context.sessionID !== parent.id ||
      authorization.projectID !== parent.projectID || validation.projectID !== parent.projectID || context.projectID !== parent.projectID ||
      revision.workflowBinding.publication.projectID !== parent.projectID || context.planRevisionID !== revision.id ||
      context.directory !== parent.location.directory || validation.contextHash !== context.contextHash || context.changedPaths.length > 0 ||
      authorization.workCardHash !== validation.workCardHash || authorization.rosterHash !== validation.rosterHash ||
      authorization.grantHash !== validation.grantHash || authorization.reviewPolicyHash !== validation.reviewPolicyHash ||
      canonicalMemberId(authorization.routedMemberID) !== canonicalMemberId(validation.routedMemberID) ||
      !isDeepStrictEqual(authorization.actor, validation.actor)) throw held("AUTHORIZATION_CHAIN_MISMATCH")
    const validationRow = await row(validation.id)
    const contextRow = await row(validation.contextRecordID)
    if (!validationRow || !contextRow) throw held("VALIDATION_CONTEXT_MISSING")
    eventIdentity(validationRow, parent.id)
    eventIdentity(contextRow, parent.id)

    // Read the plan-stage review actually recorded by Maestro; do not infer approval from a model's prose.
    const reviewRows = await rows(and(eq(EventV2.EventTable.aggregate_id, parent.id),
      inArray(EventV2.EventTable.type, [versioned(MaestroEvent.Review.Received.type, 1), versioned(MaestroEvent.Review.ReceivedV2.type, 2)]),
      sql`json_extract(${EventV2.EventTable.data}, '$.validationRecordID') = ${validation.id}`))
    const reviews = reviewRows.map((record) => ({ id: record.id, ...(record.type === versioned(MaestroEvent.Review.ReceivedV2.type, 2)
      ? decode(MaestroEvent.Review.ReceivedV2.data, record.data) : decode(MaestroEvent.Review.Received.data, record.data)) }))
      .filter((record) => (!("stage" in record) || record.stage === "plan") && record.workCardHash === validation.workCardHash)
    // Native findReview selects the newest plan-stage receipt, including a later correction.
    const review = reviews[0]
    if (review && (review.sessionID !== parent.id || review.projectID !== parent.projectID ||
      review.validationRecordID !== validation.id || review.rosterHash !== validation.rosterHash ||
      review.grantHash !== validation.grantHash || review.reviewPolicyHash !== validation.reviewPolicyHash ||
      canonicalMemberId(review.routedMemberID) !== canonicalMemberId(validation.routedMemberID))) throw held("REVIEW_CHAIN_MISMATCH")

    const decisions = await rows(and(eq(EventV2.EventTable.aggregate_id, parent.id),
      eq(EventV2.EventTable.type, versioned(MaestroEvent.Approval.Decided.type, 1)),
      sql`json_extract(${EventV2.EventTable.data}, '$.approvalMessageID') = ${authorization.approvalMessageID}`))
    const matching = decisions.map((record) => ({ record, decision: decode(MaestroEvent.Approval.Decided.data, record.data) }))
      .filter(({ decision }) => decision.planRevisionID === revision.id && decision.validationRecordID === validation.id)
    if (matching.length > 1) throw held("APPROVAL_AMBIGUOUS")
    const decision = matching[0]
    const approval = decision?.decision
    // presentationID is the native `apr_...` payload identity; it is not an EventV2 row ID.
    const presentations = approval ? await rows(and(eq(EventV2.EventTable.aggregate_id, parent.id),
      eq(EventV2.EventTable.type, versioned(MaestroEvent.Approval.Presented.type, 1)),
      sql`json_extract(${EventV2.EventTable.data}, '$.id') = ${approval.presentationID}`)) : []
    if (presentations.length > 1) throw held("PRESENTATION_AMBIGUOUS")
    const presentationRow = presentations[0]
    const presentation = presentationRow ? decode(MaestroEvent.Approval.Presented.data, presentationRow.data) : undefined
    if (approval && presentation && decision && presentationRow) {
      eventIdentity(presentationRow, parent.id)
      const validationHash = MaestroReviewRecords.hash(validation)
      const expectedTaskHash = taskHash({ ...presentation.intent, planRevisionID: revision.id,
        revisionHash: revision.revisionHash, validationRecordID: validation.id, validationHash,
        contextHash: context.contextHash, policyHash: validation.reviewPolicyHash,
        workflowBinding: revision.workflowBinding, writePaths: revision.workflowBinding.writePaths })
      if (approval.sessionID !== parent.id || approval.projectID !== parent.projectID || approval.memberID !== AgentV2.defaultID ||
        approval.revisionHash !== revision.revisionHash || approval.validationHash !== validationHash ||
        approval.contextHash !== context.contextHash || approval.policyHash !== validation.reviewPolicyHash ||
        approval.taskHash !== expectedTaskHash || approval.presentationMessageID !== presentation.assistantMessageID ||
        presentation.id !== approval.presentationID || presentation.sessionID !== parent.id || presentation.projectID !== parent.projectID ||
        presentation.memberID !== AgentV2.defaultID || presentation.planRevisionID !== revision.id ||
        presentation.validationRecordID !== validation.id || presentation.revisionHash !== revision.revisionHash ||
        presentation.validationHash !== validationHash || presentation.contextHash !== context.contextHash ||
        presentation.policyHash !== validation.reviewPolicyHash || presentation.taskHash !== expectedTaskHash ||
        authorization.taskIntentHash !== GovernanceDispatchV2.taskIntentHash(presentation.intent) ||
        presentationRow.seq >= decision.record.seq || decision.record.seq >= authRow.seq)
        throw held("APPROVAL_CHAIN_MISMATCH")
      const human = Schema.is(SessionMessage.ID)(authorization.approvalMessageID)
        ? await Effect.runPromise(input.store.message(authorization.approvalMessageID)) : undefined
      const shown = Schema.is(SessionMessage.ID)(presentation.assistantMessageID)
        ? await Effect.runPromise(input.store.message(presentation.assistantMessageID)) : undefined
      if (human?.sessionID !== parent.id || human.message.type !== "user" || shown?.sessionID !== parent.id ||
        shown.message.type !== "assistant" || shown.message.agent !== AgentV2.defaultID) throw held("HUMAN_APPROVAL_UNBOUND")
    }

    // Derived native IDs only locate and compare rows already persisted by native governance.
    const reserveRow = await row(GovernanceDispatchV2.reservationID(authorizationID))
    if (requestedReservation && reserveRow?.id !== requested.id) throw held("RESERVATION_ID_MISMATCH")
    if (reserveRow && reserveRow.type !== versioned(MaestroEvent.Dispatch.ReservedV2.type, 2)) throw held("RESERVATION_VERSION_UNSUPPORTED")
    const reservation = reserveRow ? { ...decode(MaestroEvent.Dispatch.ReservedV2.data, reserveRow.data), id: reserveRow.id, seq: reserveRow.seq } : undefined
    if (reserveRow && reservation) {
      eventIdentity(reserveRow, parent.id)
      if (reservation.authorizationID !== authorizationID || reservation.sessionID !== parent.id ||
        reservation.projectID !== parent.projectID || reservation.childSessionID !== GovernanceDispatchV2.childSessionID(authorizationID) ||
        canonicalMemberId(reservation.routedMemberID) !== canonicalMemberId(authorization.routedMemberID) ||
        reservation.taskIntentHash !== authorization.taskIntentHash || reserveRow.seq <= authRow.seq)
        throw held("RESERVATION_BINDING_MISMATCH")
    }
    const bound = reservation ? await Effect.runPromise(WorkflowRecordsV2.read(db, reservation.childSessionID)) : undefined
    const child = reservation && Schema.is(SessionSchema.ID)(reservation.childSessionID)
      ? await Effect.runPromise(input.store.get(reservation.childSessionID)) : undefined
    let taskStatus: SessionMessage.ToolState["status"] | undefined
    if (bound && reservation) {
      const boundRow = await row(WorkflowGateV2.eventID(reservation.childSessionID))
      if (!boundRow || boundRow.aggregate_id !== reservation.childSessionID || bound.binding.authoritySessionID !== parent.id ||
        bound.binding.planRevisionID !== revision.id || !isDeepStrictEqual(bound.binding.definition, revision.workflowBinding))
        throw held("WORKFLOW_BINDING_MISMATCH")
      if (child && (child.parentID !== parent.id || child.projectID !== parent.projectID ||
        canonicalMemberId(child.agent) !== canonicalMemberId(reservation.routedMemberID) ||
        !isDeepStrictEqual(child.location, parent.location))) throw held("CHILD_BINDING_MISMATCH")
      const arms = await Effect.runPromise(WorkflowArmV2.arms(input.database, parent.id))
      if (!arms.some((arm) => arm.token === bound.token && arm.projectID === parent.projectID && arm.directory === parent.location.directory))
        throw held("NATIVE_ARM_UNBOUND")
      taskStatus = (await readTaskCall(bound, parent, revision, authorization)).part.state.status
    }
    const approved = review?.verdict === "APPROVE" && approval?.outcome === "APPROVED" && presentation !== undefined
    return {
      reference: reservation?.id ?? authorization.id, version: reservation?.seq ?? authRow.seq,
      state: !approved ? "needs-review" : reservation && bound ? "admitted" : "preparing",
      revision, authorizationID, authorization, validation, context, review, approval, presentation,
      reservation, bound, taskStatus, parent, child,
    }
  }

  const listAdmissions = async (planRevisionID: string): Promise<readonly NativeAdmission[]> => {
    const revision = await readPlan(planRevisionID)
    if (!revision) return []
    const grants = await rows(and(eq(EventV2.EventTable.aggregate_id, revision.sessionID),
      eq(EventV2.EventTable.type, versioned(MaestroEvent.Authorization.Granted.type, 1))))
    const found: NativeAdmission[] = []
    for (const grant of grants) {
      const authorization = decode(MaestroEvent.Authorization.Granted.data, grant.data)
      const validation = await Effect.runPromise(GovernanceRecordsV2.readValidation(db, authorization.validationRecordID))
      if (validation?.planRevisionID !== planRevisionID) continue
      const admission = await readAdmission(grant.id)
      if (admission) found.push(admission)
    }
    return found
  }

  const readRun = async (runRef: string): Promise<NativeAdmission | undefined> => {
    if (!Schema.is(SessionSchema.ID)(runRef)) return undefined
    const bound = await Effect.runPromise(WorkflowRecordsV2.read(db, runRef))
    if (!bound) return undefined
    const reserved = await rows(and(eq(EventV2.EventTable.aggregate_id, bound.binding.authoritySessionID),
      eq(EventV2.EventTable.type, versioned(MaestroEvent.Dispatch.ReservedV2.type, 2)),
      sql`json_extract(${EventV2.EventTable.data}, '$.childSessionID') = ${runRef}`))
    if (reserved.length > 1) throw held("RUN_RESERVATION_AMBIGUOUS")
    if (!reserved[0]) return undefined
    const admission = await readAdmission(reserved[0].id)
    if (!admission?.reservation || admission.reservation.childSessionID !== runRef ||
      !isDeepStrictEqual(admission.bound, bound)) throw held("RUN_BINDING_MISMATCH")
    return admission
  }

  const terminal = async (runRef: string): Promise<NativeTerminal | undefined> => {
    const admission = await readRun(runRef)
    if (!admission?.bound || admission.state !== "admitted") return undefined
    const bound = admission.bound
    const { message, part } = await readTaskCall(bound, admission.parent, admission.revision, admission.authorization)
    if (part.state.status === "error") return { admission, state: "failed" }
    if (!admission.child) return undefined
    const relay = await input.relayFor(admission.parent.location)
    if (!relay) return undefined
    const view = await Effect.runPromise(relay.currentStep(bound.token, bound.binding))
    if (view.state === "awaiting-human" || view.state === "escalated") return { admission, state: "awaiting-human" }
    if (part.state.status !== "completed" || view.state !== "complete" || view.pending)
      return { admission, state: "running" }
    const { TaskTool } = await import("@orchestra/core/tool/task")
    const output = decode(TaskTool.Output, part.state.structured)
    if (output.sessionID !== runRef || output.sessionId !== runRef || output.parentSessionId !== admission.parent.id ||
      output.agent !== admission.child.agent || output.agentId !== admission.child.agent ||
      !isDeepStrictEqual(output.model, admission.child.model)) throw held("TASK_RESULT_MISMATCH")
    const context = { sessionID: admission.parent.id, agent: AgentV2.defaultID,
      assistantMessageID: message.id, toolCallID: part.id }
    const messages = await Effect.runPromise(input.store.entries(admission.child.id))
    const reply = TaskTool.completedReply(messages.map((entry) => entry.message), TaskTool.taskPromptID(context, admission.child.id))
    if (!reply?.time.completed || reply.agent !== admission.child.agent) throw held("TASK_REPLY_UNBOUND")
    const arm = path.join(relay.paths.arms, bound.token)
    const loaded = await Effect.runPromise(ArmLoad.arm(arm))
    if (!isDeepStrictEqual(loaded.meta.workflow, bound.binding)) throw held("TERMINAL_ARM_MISMATCH")
    const file = path.join(arm, `workflow_${createHash("sha256").update(reply.id).digest("hex")}.json`)
    const checkpoint = await Effect.runPromise(ArmLoad.bytes(file).pipe(Effect.flatMap((bytes) => ArmLoad.decode(file, bytes, RelayArm.WorkflowCheckpoint))))
    if (!isDeepStrictEqual(checkpoint.binding, bound.binding) || checkpoint.phase !== "settled" ||
      checkpoint.settlement.assistantMessageID !== reply.id || checkpoint.evaluation?.outcome !== "complete" ||
      checkpoint.evaluation.ledgerSeq !== view.ledgerSeq) throw held("TERMINAL_CHECKPOINT_UNBOUND")
    const audit = await Effect.runPromise(relay.audit(bound.token))
    if (!audit.chain_intact || audit.record_errors.length > 0 || audit.exit !== 0 || audit.truncated || audit.escalated)
      throw held("TERMINAL_AUDIT_UNAVAILABLE")
    const after = await Effect.runPromise(relay.currentStep(bound.token, bound.binding))
    if (after.state !== "complete" || after.pending || after.ledgerSeq !== view.ledgerSeq || after.position !== view.position || after.attempt !== view.attempt)
      throw held("TERMINAL_CHANGED")
    const taskResult: NativeTaskResult = { sessionID: output.sessionID, agent: output.agent, sessionId: output.sessionId,
      parentSessionId: output.parentSessionId, agentId: output.agentId,
      ...(output.model ? { model: output.model } : {}), ...(output.directory ? { directory: output.directory } : {}) }
    return { admission, state: "completed", resultRef: reply.id,
      completedAt: DateTime.formatIso(reply.time.completed), checkpoint, taskResult, audit }
  }

  const terminalForResult = async (resultRef: string): Promise<NativeTerminal | undefined> => {
    if (!Schema.is(SessionMessage.ID)(resultRef)) return undefined
    const entry = await Effect.runPromise(input.store.message(resultRef))
    if (!entry || entry.message.type !== "assistant") return undefined
    const found = await terminal(entry.sessionID)
    return found?.resultRef === resultRef ? found : undefined
  }
  return { readPlan, listPlans, isLatestPlan, readBoundPlan, readAdmission, listAdmissions, readRun, terminal, terminalForResult }
}

function decode<A>(schema: Schema.Decoder<A>, value: unknown): A {
  const result = Schema.decodeUnknownOption(schema)(value, strict)
  if (Option.isNone(result)) throw held("RECORD_INVALID")
  return result.value
}

function eventIdentity(row: { readonly aggregate_id: string; readonly seq: number }, aggregate: string) {
  if (row.aggregate_id !== aggregate || !Number.isSafeInteger(row.seq) || row.seq <= 0) throw held("EVENT_IDENTITY_MISMATCH")
}

function versioned(type: string, version: number) {
  return EventV2.versionedType(type, version)
}

function held(reason: string) {
  return new Error(`SF_ROUTINE_NATIVE_${reason}`)
}
