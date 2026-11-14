import { expect, test } from "bun:test"
import { eq } from "drizzle-orm"
import { DateTime, Effect, Schema } from "effect"
import { Database } from "@orchestra/core/database/database"
import { EventV2 } from "@orchestra/core/event"
import { ModelV2 } from "@orchestra/core/model"
import { Project } from "@orchestra/core/project"
import { ProviderV2 } from "@orchestra/core/provider"
import { SessionMessage } from "@orchestra/core/session/message"
import { SessionSchema } from "@orchestra/core/session/schema"
import { SessionStore } from "@orchestra/core/session/store"
import { SessionMessageTable } from "@orchestra/core/session/sql"
import { MaestroEvent } from "@orchestra/schema/maestro-event"
import { SessionEvent } from "@orchestra/schema/session-event"
import { taskHash } from "../../../../../maestro/coordination/src/task-hash.ts"
import { GovernanceDispatchV2 } from "../../../../../maestro/coordination/src/v2/governance/dispatch.ts"
import { GovernanceRecordsV2 } from "../../../../../maestro/coordination/src/v2/governance/records.ts"
import { WorkflowGateV2 } from "../../../../../maestro/coordination/src/v2/governance/workflow.ts"
import { MaestroReviewRecords } from "../../../../../maestro/coordination/src/v2/tools/review-records.ts"
import { createSfRoutineNativeRecords } from "../../../../../../apps/cli/src/sucafina-product/routine-native-records.ts"
import { SF_ROUTINE_INPUT_PARAMETER } from "../../../../../../apps/cli/src/sucafina-product/routine-native-input.ts"
import { fixturePlan, seedSession, withNativeRecords } from "./fixture.ts"

const parentID = SessionSchema.ID.make("ses_sf_positive_admission_fixture")
const contextID = EventV2.ID.make("evt_sf_positive_context_fixture")
const validationID = EventV2.ID.make("evt_sf_positive_validation_fixture")
const authorizationID = EventV2.ID.make("evt_sf_positive_authorization_fixture")
const presentationRowID = EventV2.ID.make("evt_maestro_approval_presentation_fixture")
const presentationID = "apr_positive_fixture"
const armRowID = EventV2.ID.make("evt_sf_positive_arm_fixture")
const humanID = SessionMessage.ID.make("msg_sf_positive_human_fixture")
const shownID = SessionMessage.ID.make("msg_sf_positive_shown_fixture")
const taskMessageID = SessionMessage.ID.make("msg_sf_positive_task_fixture")
const taskCallID = "call_sf_positive_task_fixture"
const token = "sf-positive-admission-fixture-arm"
const model = { id: ModelV2.ID.make("fixture-model"), providerID: ProviderV2.ID.make("fixture-provider") }
const time = { created: DateTime.makeUnsafe(1_700_000_000_000) }

/**
 * Real native schemas, hash functions, SQLite, EventV2 and SessionStore read this persisted synthetic chain.
 * No model, permission prompt, native dispatch writer or Relay arm is executed. This is reader coverage, not AM06.
 */
const completeAdmissionFixture = Effect.fn("SfRoutineFixture.completeAdmission")(function* (directory: string) {
  const database = yield* Database.Service
  const events = yield* EventV2.Service
  yield* seedSession({ id: parentID, directory, agent: "maestro" })
  const retained = {
    schema: "sf-routine-native-input-v1", purpose: "Prepare selected review",
    owner: { installationId: "installation-fixture", hostId: "host-fixture", projectId: Project.ID.global,
      locationId: directory, authoritySessionId: parentID, principalRef: "principal-fixture",
      policyVersion: "policy-1", accessRevision: "access-1", providerGeneration: 2 },
    caseRef: { id: "case-fixture", incarnation: "case-incarnation-fixture", version: 1 },
    publishedRecipeRef: "sf-review-fixture", inputRefs: [], parameters: {}, sourceRefs: [],
  }
  const plan = fixturePlan(parentID, true, { [SF_ROUTINE_INPUT_PARAMETER]: JSON.stringify(retained) })
  if (!plan.workflowBinding) return yield* Effect.die("Fixture lacks workflow binding")
  yield* events.publish(MaestroEvent.PlanRevision.RecordedV3, plan, { id: EventV2.ID.make(plan.id) })
  const context = {
    id: contextID, sessionID: parentID, planRevisionID: plan.id, projectID: Project.ID.global,
    directory, mode: "UNGROUNDED" as const, branch: "fixture", headSHA: "a".repeat(40), changedPaths: [],
    currentEvidenceIdentityHash: "b".repeat(64), contextHash: "c".repeat(64), status: "CURRENT" as const,
    createdAt: 1_700_000_000_000,
  }
  yield* events.publish(MaestroEvent.Context.Recorded, context, { id: contextID })
  const workCard = "Synthetic reader coverage for the selected case"
  const shared = {
    sessionID: parentID, projectID: Project.ID.global, workCardHash: MaestroReviewRecords.workCardHash(workCard),
    routedMemberID: "backend", rosterHash: "d".repeat(64), grantHash: "e".repeat(64), reviewPolicyHash: "f".repeat(64),
  }
  yield* events.publish(MaestroEvent.Validation.RecordedV2, {
    ...shared, actor: MaestroReviewRecords.actor({ id: parentID, projectID: Project.ID.global }, "maestro"),
    planRevisionID: plan.id, contextRecordID: contextID, contextHash: context.contextHash,
    workCardID: "workcard-positive-fixture", workCard, validatorID: "maestro", validatorVersion: "synthetic-fixture",
    checks: [{ id: "reader-fixture", status: "PASS", detail: "Synthetic persisted test input" }], outcome: "VALID",
  }, { id: validationID })
  const validation = yield* GovernanceRecordsV2.readValidation(database.db, validationID)
  if (!validation) return yield* Effect.die("Native validation fixture is missing")
  yield* events.publish(MaestroEvent.Review.ReceivedV2, {
    ...shared, actor: MaestroReviewRecords.actor({ id: parentID, projectID: Project.ID.global }, "lucy"),
    validationRecordID: validationID, reviewerID: "lucy", reviewMethodVersion: "synthetic-reader-review",
    artifact: { workCardHash: shared.workCardHash, sha256: "1".repeat(64), baseSHA: "2".repeat(40),
      headSHA: context.headSHA, worktree: directory, changedPaths: [] },
    verdict: "APPROVE", findings: [], stage: "plan",
  }, { id: EventV2.ID.make("evt_sf_positive_review_fixture") })
  const intent = { subagentType: "backend", prompt: "Prepare the selected review" }
  const validationHash = MaestroReviewRecords.hash(validation)
  const approvalBinding = {
    sessionID: parentID, projectID: Project.ID.global, memberID: "maestro", planRevisionID: plan.id,
    validationRecordID: validationID, revisionHash: plan.revisionHash, validationHash,
    contextHash: context.contextHash, policyHash: shared.reviewPolicyHash,
    taskHash: taskHash({ ...intent, planRevisionID: plan.id, revisionHash: plan.revisionHash,
      validationRecordID: validationID, validationHash, contextHash: context.contextHash,
      policyHash: shared.reviewPolicyHash, workflowBinding: plan.workflowBinding, writePaths: plan.workflowBinding.writePaths }),
    methodVersion: "synthetic-reader-approval",
  }
  yield* events.publish(MaestroEvent.Approval.Presented, {
    ...approvalBinding, id: presentationID, assistantMessageID: shownID, callID: "call_present_fixture", intent,
    plan: "Synthetic plan presentation", provenance: "Synthetic native reader test fixture", assumptions: [],
    validationLedger: validationID, contextState: "CURRENT",
  }, { id: presentationRowID })
  yield* events.publish(MaestroEvent.Approval.Decided, {
    ...approvalBinding, presentationID, presentationMessageID: shownID, approvalMessageID: humanID,
    outcome: "APPROVED", decisionTime: 1_700_000_000_001,
  }, { id: EventV2.ID.make("evt_sf_positive_approval_fixture") })
  const taskIntentHash = GovernanceDispatchV2.taskIntentHash(intent)
  yield* events.publish(MaestroEvent.Authorization.Granted, {
    ...shared, actor: validation.actor, approvalMessageID: humanID, validationRecordID: validationID,
    reviewerID: "lucy", taskIntentHash, methodVersion: "synthetic-reader-authorization",
  }, { id: authorizationID })
  yield* events.publish(SessionEvent.Tool.Progress, {
    sessionID: parentID, assistantMessageID: taskMessageID, callID: "call_native_arm_fixture", timestamp: time.created,
    structured: { nativeArsenal: { source: "native-host", version: 1, kind: "completion-arm",
      tool: "maestro_arsenal_execute", token, projectID: Project.ID.global, directory } }, content: [],
  }, { id: armRowID })
  const childID = GovernanceDispatchV2.childSessionID(authorizationID)
  const reservationID = GovernanceDispatchV2.reservationID(authorizationID)
  yield* events.publish(MaestroEvent.Dispatch.ReservedV2, {
    sessionID: parentID, authorizationID, childSessionID: childID, projectID: Project.ID.global,
    routedMemberID: shared.routedMemberID, taskIntentHash, permission: [],
  }, { id: reservationID })
  const bound = {
    executionSessionID: childID, authorityMessageID: taskMessageID, authorityCallID: taskCallID, token,
    binding: { definition: plan.workflowBinding, planRevisionID: plan.id, executionSessionID: childID,
      authoritySessionID: parentID, logicalTaskID: "logical-positive-fixture" },
  }
  yield* events.publish(MaestroEvent.Task.WorkflowBound, bound, { id: WorkflowGateV2.eventID(childID) })
  const taskInput = {
    description: "Selected review", prompt: intent.prompt, subagent_type: intent.subagentType, authorizationID,
    workflow: { documentID: plan.workflowBinding.publication.documentID, planRevisionID: plan.id,
      parameters: plan.workflowBinding.parameters }, writePaths: plan.workflowBinding.writePaths,
  }
  const taskMessage = SessionMessage.Assistant.make({
    id: taskMessageID, type: "assistant", agent: "maestro", model, time, content: [{
      type: "tool", id: taskCallID, name: "task", provider: { executed: false }, time,
      state: { status: "running", input: taskInput, structured: {}, content: [] },
    }],
  })
  const messages = [
    SessionMessage.Assistant.make({ id: shownID, type: "assistant", agent: "maestro", model, time, content: [] }),
    SessionMessage.User.make({ id: humanID, type: "user", text: "Synthetic human approval fixture", time }),
    taskMessage,
  ]
  yield* database.db.insert(SessionMessageTable).values(messages.map((message, index) => ({
    id: message.id, session_id: parentID, type: message.type, seq: index + 1,
    time_created: DateTime.toEpochMillis(message.time.created), data: Schema.encodeSync(SessionMessage.Message)(message),
  }))).run().pipe(Effect.orDie)
  return { plan, childID, reservationID, bound, taskMessage, taskInput }
})

test("complete retained native chain resolves the actual reservation and child identities, including the approval payload identity", () =>
  withNativeRecords((directory) => Effect.gen(function* () {
    const database = yield* Database.Service
    const store = yield* SessionStore.Service
    const seeded = yield* completeAdmissionFixture(directory)
    const readers = createSfRoutineNativeRecords({ database, store, relayFor: async () => undefined })
    const beforeChild = yield* Effect.promise(() => readers.readAdmission(authorizationID))
    expect(beforeChild?.state).toBe("admitted")
    expect(beforeChild?.reference).toBe(seeded.reservationID)
    expect(beforeChild?.reservation?.childSessionID).toBe(seeded.childID)
    expect(beforeChild?.child).toBeUndefined()
    expect(beforeChild?.presentation?.id).toBe(presentationID)
    expect(beforeChild?.presentation?.id).not.toBe(presentationRowID)
    expect(beforeChild?.taskStatus).toBe("running")
    expect(yield* Effect.promise(() => readers.terminal(seeded.childID))).toBeUndefined()
    yield* seedSession({ id: seeded.childID, directory, agent: "backend", parentID })
    const admission = yield* Effect.promise(() => readers.readRun(seeded.childID))
    expect(admission?.state).toBe("admitted")
    expect(admission?.child?.id).toBe(seeded.childID)
    expect(admission?.bound).toEqual(seeded.bound)
    expect(admission?.version).toBe(beforeChild?.version)
    expect((yield* Effect.promise(() => readers.listAdmissions(seeded.plan.id))).map((item) => item.reference)).toEqual([seeded.reservationID])
    expect((yield* Effect.promise(() => readers.readAdmission(seeded.reservationID)))?.reference).toBe(seeded.reservationID)
    // The retained chain alone cannot supply a terminal result without a live, bound Relay reader.
    expect(yield* Effect.promise(() => readers.terminal(seeded.childID))).toBeUndefined()
    expect(yield* database.db.select().from(EventV2.EventTable).all().pipe(Effect.orDie)).toHaveLength(10)
  })))

test("human message, Task parameters and native arm provenance are required even after a complete chain was readable", () =>
  withNativeRecords((directory) => Effect.gen(function* () {
    const database = yield* Database.Service
    const store = yield* SessionStore.Service
    const seeded = yield* completeAdmissionFixture(directory)
    const readers = createSfRoutineNativeRecords({ database, store, relayFor: async () => undefined })
    expect((yield* Effect.promise(() => readers.readAdmission(authorizationID)))?.state).toBe("admitted")
    const human = yield* database.db.select().from(SessionMessageTable).where(eq(SessionMessageTable.id, humanID)).get().pipe(Effect.orDie)
    if (!human) return yield* Effect.die("Fixture human message is missing")
    yield* database.db.delete(SessionMessageTable).where(eq(SessionMessageTable.id, humanID)).run().pipe(Effect.orDie)
    expect(yield* Effect.promise(() => readers.readAdmission(authorizationID).then(() => "accepted", (error: Error) => error.message)))
      .toContain("HUMAN_APPROVAL_UNBOUND")
    yield* database.db.insert(SessionMessageTable).values(human).run().pipe(Effect.orDie)
    const changedTask = SessionMessage.Assistant.make({ ...seeded.taskMessage, content: [{
      type: "tool", id: taskCallID, name: "task", time, state: {
        status: "running", input: { ...seeded.taskInput, workflow: { ...seeded.taskInput.workflow, parameters: { forged: "scope" } } },
        structured: {}, content: [],
      },
    }] })
    yield* database.db.update(SessionMessageTable).set({ data: Schema.encodeSync(SessionMessage.Message)(changedTask) })
      .where(eq(SessionMessageTable.id, taskMessageID)).run().pipe(Effect.orDie)
    expect(yield* Effect.promise(() => readers.readAdmission(authorizationID).then(() => "accepted", (error: Error) => error.message)))
      .toContain("TASK_INPUT_MISMATCH")
    yield* database.db.update(SessionMessageTable).set({ data: Schema.encodeSync(SessionMessage.Message)(seeded.taskMessage) })
      .where(eq(SessionMessageTable.id, taskMessageID)).run().pipe(Effect.orDie)
    yield* database.db.delete(EventV2.EventTable).where(eq(EventV2.EventTable.id, armRowID)).run().pipe(Effect.orDie)
    expect(yield* Effect.promise(() => readers.readAdmission(authorizationID).then(() => "accepted", (error: Error) => error.message)))
      .toContain("NATIVE_ARM_UNBOUND")
  })))
