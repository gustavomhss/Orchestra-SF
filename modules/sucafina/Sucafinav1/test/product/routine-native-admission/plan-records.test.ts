import { expect, test } from "bun:test"
import { Effect } from "effect"
import { Database } from "@orchestra/core/database/database"
import { EventV2 } from "@orchestra/core/event"
import { SessionSchema } from "@orchestra/core/session/schema"
import { SessionStore } from "@orchestra/core/session/store"
import { MaestroEvent } from "@orchestra/schema/maestro-event"
import { createSfRoutineNativeRecords } from "../../../../../../apps/cli/src/sucafina-product/routine-native-records.ts"
import { fixturePlan, seedSession, withNativeRecords } from "./fixture.ts"

const parentID = SessionSchema.ID.make("ses_sf_routine_plan_fixture")

test("native reader retains a real EventV2 plan body and lists only workflow revisions for its Session", () =>
  withNativeRecords((directory) => Effect.gen(function* () {
    const database = yield* Database.Service
    const events = yield* EventV2.Service
    const store = yield* SessionStore.Service
    yield* seedSession({ id: parentID, directory, agent: "maestro" })
    const selected = fixturePlan(parentID)
    yield* events.publish(MaestroEvent.PlanRevision.RecordedV3, selected, { id: EventV2.ID.make(selected.id) })
    const unrelated = fixturePlan("ses_another_owner")
    yield* events.publish(MaestroEvent.PlanRevision.RecordedV3, unrelated, { id: EventV2.ID.make(unrelated.id) })
    const plain = fixturePlan(parentID, false)
    yield* events.publish(MaestroEvent.PlanRevision.RecordedV3, plain, { id: EventV2.ID.make(plain.id) })
    const readers = createSfRoutineNativeRecords({ database, store, relayFor: async () => undefined })
    const found = yield* Effect.promise(() => readers.readPlan(selected.id))
    expect(found).toEqual(selected)
    expect(found?.workflowBinding?.parameters).toEqual({ selectedCase: "case-fixture" })
    expect(found?.workflowBinding?.writePaths).toEqual(["review-output"])
    expect((yield* Effect.promise(() => readers.listPlans(parentID))).map((plan) => plan.id)).toEqual([selected.id])
    expect(yield* Effect.promise(() => readers.readPlan(plain.id).catch(() => undefined))).toBeUndefined()
    const rows = yield* database.db.select().from(EventV2.EventTable).all().pipe(Effect.orDie)
    expect(rows).toHaveLength(3)
  })))

for (const variant of ["body", "record-id", "aggregate", "extra-field", "event-type"] as const) {
  test(`native plan reader refuses ${variant} corruption instead of trusting a plausible reference`, () =>
    withNativeRecords((directory) => Effect.gen(function* () {
      const database = yield* Database.Service
      const events = yield* EventV2.Service
      const store = yield* SessionStore.Service
      yield* seedSession({ id: parentID, directory, agent: "maestro" })
      const selected = fixturePlan(parentID)
      yield* events.publish(MaestroEvent.PlanRevision.RecordedV3, selected, { id: EventV2.ID.make(selected.id) })
      const readers = createSfRoutineNativeRecords({ database, store, relayFor: async () => undefined })
      expect((yield* Effect.promise(() => readers.readPlan(selected.id)))?.id).toBe(selected.id)
      if (variant === "aggregate") {
        yield* database.db.insert(EventV2.EventSequenceTable).values({ aggregate_id: "ses_wrong_owner", seq: 0 })
          .run().pipe(Effect.orDie)
      }
      const change = variant === "body" ? { data: { ...selected, goal: { ...selected.goal, value: "Changed after hashing" } } }
        : variant === "record-id" ? { data: { ...selected, id: "evt_maestro_plan_revision_wrong" } }
        : variant === "aggregate" ? { aggregate_id: "ses_wrong_owner" }
        : variant === "extra-field" ? { data: { ...selected, fabricatedApproval: true } }
        : { type: EventV2.versionedType(MaestroEvent.Admission.Decided.type, 1) }
      // The native Database exposes its parameterized SqlClient; this package does not depend on drizzle-orm.
      if ("data" in change && change.data !== undefined) yield* database.db.$client`UPDATE event SET data = ${JSON.stringify(change.data)} WHERE id = ${selected.id}`.pipe(Effect.orDie)
      else if ("aggregate_id" in change && change.aggregate_id !== undefined) yield* database.db.$client`UPDATE event SET aggregate_id = ${change.aggregate_id} WHERE id = ${selected.id}`.pipe(Effect.orDie)
      else if ("type" in change && change.type !== undefined) yield* database.db.$client`UPDATE event SET type = ${change.type} WHERE id = ${selected.id}`.pipe(Effect.orDie)
      expect(yield* Effect.promise(() => readers.readPlan(selected.id).catch(() => undefined))).toBeUndefined()
      // A retained malformed native event is not repaired or rewritten by the reader.
      const rows = yield* database.db.select().from(EventV2.EventTable).all().pipe(Effect.orDie)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject(change)
    })))
}
