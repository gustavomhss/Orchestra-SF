import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { Effect } from "effect"
import { Database } from "@orchestra/core/database/database"
import { EventV2 } from "@orchestra/core/event"
import { Project } from "@orchestra/core/project"
import { SessionSchema } from "@orchestra/core/session/schema"
import { SessionStore } from "@orchestra/core/session/store"
import { MaestroEvent } from "@orchestra/schema/maestro-event"
import { GovernanceDispatchV2 } from "../../../../../maestro/coordination/src/v2/governance/dispatch.ts"
import { createSfRoutineNativeRecords } from "../../../../../../apps/cli/src/sucafina-product/routine-native-records.ts"
import { fixturePlan, seedSession, withNativeRecords } from "./fixture.ts"

const parentID = SessionSchema.ID.make("ses_sf_routine_admission_fixture")
const contextID = EventV2.ID.make("evt_sf_routine_context_fixture")
const validationID = EventV2.ID.make("evt_sf_routine_validation_fixture")
const authorizationID = EventV2.ID.make("evt_sf_routine_authorization_fixture")

/** A persisted grant is synthetic test data, deliberately lacking human approval, dispatch and Relay execution. */
const grantFixture = Effect.fn("SfRoutineFixture.grant")(function* (directory: string) {
  const events = yield* EventV2.Service
  yield* seedSession({ id: parentID, directory, agent: "maestro" })
  const plan = fixturePlan(parentID)
  yield* events.publish(MaestroEvent.PlanRevision.RecordedV3, plan, { id: EventV2.ID.make(plan.id) })
  const context = {
    id: contextID, sessionID: parentID, planRevisionID: plan.id, projectID: Project.ID.global,
    directory, mode: "UNGROUNDED" as const, branch: "fixture", headSHA: "a".repeat(40), changedPaths: [],
    currentEvidenceIdentityHash: "b".repeat(64), contextHash: "c".repeat(64), status: "CURRENT" as const,
    createdAt: 1_700_000_000_000,
  }
  yield* events.publish(MaestroEvent.Context.Recorded, context, { id: contextID })
  const actorBytes = JSON.stringify({ principal: "synthetic-reader-fixture" })
  const shared = {
    sessionID: parentID, projectID: Project.ID.global, workCardHash: "d".repeat(64), routedMemberID: "backend",
    rosterHash: "e".repeat(64), grantHash: "f".repeat(64), reviewPolicyHash: "1".repeat(64),
    actor: { version: "rfc8785-v1" as const, bytes: actorBytes, sha256: createHash("sha256").update(actorBytes).digest("hex") },
  }
  const validation = {
    ...shared, planRevisionID: plan.id, contextRecordID: contextID, contextHash: context.contextHash,
    workCardID: "workcard-fixture", workCard: "Synthetic retained native workcard", validatorID: "maestro" as const,
    validatorVersion: "test-fixture", checks: [{ id: "fixture-check", status: "PASS" as const, detail: "Synthetic test input" }],
    outcome: "VALID" as const,
  }
  yield* events.publish(MaestroEvent.Validation.RecordedV2, validation, { id: validationID })
  const authorization = {
    ...shared, approvalMessageID: "msg_no_human_approval", validationRecordID: validationID,
    reviewerID: "lucy" as const,
    taskIntentHash: GovernanceDispatchV2.taskIntentHash({ subagentType: "backend", prompt: "Prepare review" }),
    methodVersion: "test-fixture",
  }
  yield* events.publish(MaestroEvent.Authorization.Granted, authorization, { id: authorizationID })
  return { plan, context, validation, authorization }
})

test("a native Authorization event alone remains needs-review and never becomes an admitted run", () =>
  withNativeRecords((directory) => Effect.gen(function* () {
    const database = yield* Database.Service
    const store = yield* SessionStore.Service
    const seeded = yield* grantFixture(directory)
    const readers = createSfRoutineNativeRecords({ database, store, relayFor: async () => undefined })
    const admission = yield* Effect.promise(() => readers.readAdmission(authorizationID))
    expect(admission?.state).toBe("needs-review")
    expect(admission?.reference).toBe(authorizationID)
    expect(admission?.revision.id).toBe(seeded.plan.id)
    expect(admission?.reservation).toBeUndefined()
    expect(admission?.bound).toBeUndefined()
    expect(admission?.child).toBeUndefined()
    expect((yield* Effect.promise(() => readers.listAdmissions(seeded.plan.id))).map((entry) => entry.reference)).toEqual([authorizationID])
    const childID = GovernanceDispatchV2.childSessionID(authorizationID)
    yield* seedSession({ id: childID, directory, agent: "backend", parentID })
    expect(yield* Effect.promise(() => readers.readRun(childID))).toBeUndefined()
    expect(yield* Effect.promise(() => readers.terminal(childID))).toBeUndefined()
    expect(yield* Effect.promise(() => readers.readAdmission("evt_nonexistent"))).toBeUndefined()
    const events = yield* database.db.select().from(EventV2.EventTable).all().pipe(Effect.orDie)
    expect(events).toHaveLength(4)
  })))

test("a persisted dispatch reservation does not bypass missing review or create a workflow-bound execution", () =>
  withNativeRecords((directory) => Effect.gen(function* () {
    const database = yield* Database.Service
    const events = yield* EventV2.Service
    const store = yield* SessionStore.Service
    const seeded = yield* grantFixture(directory)
    const reservationID = GovernanceDispatchV2.reservationID(authorizationID)
    const childID = GovernanceDispatchV2.childSessionID(authorizationID)
    yield* events.publish(MaestroEvent.Dispatch.ReservedV2, {
      sessionID: parentID, authorizationID, childSessionID: childID, projectID: Project.ID.global,
      routedMemberID: "backend", taskIntentHash: seeded.authorization.taskIntentHash, permission: [],
    }, { id: reservationID })
    const readers = createSfRoutineNativeRecords({ database, store, relayFor: async () => undefined })
    const admission = yield* Effect.promise(() => readers.readAdmission(reservationID))
    expect(admission?.state).toBe("needs-review")
    expect(admission?.reference).toBe(reservationID)
    expect(admission?.reservation?.childSessionID).toBe(childID)
    expect(admission?.bound).toBeUndefined()
    expect(yield* Effect.promise(() => readers.readRun(childID))).toBeUndefined()
    const rows = yield* database.db.select().from(EventV2.EventTable).all().pipe(Effect.orDie)
    expect(rows).toHaveLength(5)
  })))

for (const variant of ["validation-held", "placement-changed", "grant-changed", "wrong-validation-aggregate"] as const) {
  test(`native admission refuses ${variant} in the retained authorization chain`, () =>
    withNativeRecords((directory) => Effect.gen(function* () {
      const database = yield* Database.Service
      const store = yield* SessionStore.Service
      const seeded = yield* grantFixture(directory)
      const readers = createSfRoutineNativeRecords({ database, store, relayFor: async () => undefined })
      expect((yield* Effect.promise(() => readers.readAdmission(authorizationID)))?.state).toBe("needs-review")
      if (variant === "wrong-validation-aggregate") {
        yield* database.db.insert(EventV2.EventSequenceTable).values({ aggregate_id: "ses_wrong_validation_owner", seq: 2 })
          .run().pipe(Effect.orDie)
      }
      const id = variant === "placement-changed" ? contextID : variant === "grant-changed" ? authorizationID : validationID
      const change = variant === "validation-held" ? { data: { ...seeded.validation, outcome: "HOLD" } }
        : variant === "placement-changed" ? { data: { ...seeded.context, directory: `${directory}-another-location` } }
        : variant === "grant-changed" ? { data: { ...seeded.authorization, grantHash: "3".repeat(64) } }
        : { aggregate_id: "ses_wrong_validation_owner" }
      if ("data" in change && change.data !== undefined) yield* database.db.$client`UPDATE event SET data = ${JSON.stringify(change.data)} WHERE id = ${id}`.pipe(Effect.orDie)
      else if (change.aggregate_id !== undefined) yield* database.db.$client`UPDATE event SET aggregate_id = ${change.aggregate_id} WHERE id = ${id}`.pipe(Effect.orDie)
      const result = yield* Effect.promise(() => readers.readAdmission(authorizationID).catch(() => undefined))
      expect(result).toBeUndefined()
      const rows = yield* database.db.select().from(EventV2.EventTable).all().pipe(Effect.orDie)
      expect(rows).toHaveLength(4)
    })))
}
