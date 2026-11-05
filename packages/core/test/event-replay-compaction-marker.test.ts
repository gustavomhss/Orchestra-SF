import { expect } from "bun:test"
import { Effect, Exit, Schema } from "effect"
import { asc, sql } from "drizzle-orm"
import { Database } from "@orchestra/core/database/database"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { EventV2 } from "@orchestra/core/event"
import { EventSequenceTable, EventTable } from "@orchestra/core/event/sql"
import { ResearchEvent } from "@orchestra/schema/research-event"
import { Session } from "@orchestra/schema/session"
import { DataMigrationTable } from "../src/data-migration.sql"
import { EventCompaction } from "../src/event/compaction"
import { testEffect } from "./lib/effect"

const build = () =>
  AppNodeBuilder.build(
    LayerNode.group([Database.node, EventV2.node]),
    [[Database.node, Database.layerFromPath(":memory:")]],
  )
const it = testEffect(build())
const LocalMessage = EventV2.define({
  type: "test.replay-marker-local",
  durable: { version: 1, aggregate: "aggregateID" },
  schema: { aggregateID: Schema.String, text: Schema.String },
})
// Replay uses the immutable durable manifest, not definitions registered by EventV2.define.
const ReplayMessage = ResearchEvent.AllowanceCharged
const serialized = (aggregateID: Session.ID, seq: number) => ({
  id: EventV2.ID.create(),
  type: EventV2.versionedType(ReplayMessage.type, 1),
  aggregateID,
  seq,
  data: {
    sessionID: aggregateID,
    dispatchCallID: `call_${seq}`,
    operation: "marker-test",
    kind: "tool" as const,
    amount: 1,
  },
})

const fixture = Effect.gen(function* () {
  const events = yield* EventV2.Service
  const database = yield* Database.Service
  const projected = new Array<EventV2.ID>()
  const notified = new Array<EventV2.ID>()
  yield* database.db.run("CREATE TABLE replay_marker_projection (event_id TEXT PRIMARY KEY)")
  const projector = (event: EventV2.Payload) =>
    Effect.gen(function* () {
      // The counter detects invocation even if a subsequent SQL transaction rolls back.
      projected.push(event.id)
      yield* database.db.run(sql`INSERT INTO replay_marker_projection (event_id) VALUES (${event.id})`).pipe(Effect.orDie)
    })
  yield* events.project(ReplayMessage, projector)
  yield* events.project(LocalMessage, projector)
  yield* events.listen((event) => Effect.sync(() => {
    notified.push(event.id)
  }))
  const snapshot = Effect.gen(function* () {
    return {
      rows: yield* database.db.select().from(EventTable).orderBy(asc(EventTable.aggregate_id), asc(EventTable.seq)).all(),
      sequences: yield* database.db.select().from(EventSequenceTable).orderBy(asc(EventSequenceTable.aggregate_id)).all(),
      projection: yield* database.db.all<{ event_id: string }>("SELECT event_id FROM replay_marker_projection ORDER BY event_id"),
      projected: [...projected],
      notified: [...notified],
    }
  })
  const mark = Effect.gen(function* () {
    yield* database.db.insert(DataMigrationTable).values({
      name: EventCompaction.SNAPSHOT_COMPACTION_MARKER,
      time_completed: 1,
    }).run()
    expect(yield* database.db.select().from(DataMigrationTable).all()).toEqual([
      { name: EventCompaction.SNAPSHOT_COMPACTION_MARKER, time_completed: 1 },
    ])
  })
  return { events, database, snapshot, mark }
})

function expectRefusal(exit: Exit.Exit<unknown, unknown>) {
  expect(Exit.isFailure(exit)).toBe(true)
  expect(String(exit)).toContain("Workspace sync disabled after snapshot compaction")
}

it.effect("live service refuses new replay after marker insertion; local publish and a fresh DB still work", () =>
  Effect.gen(function* () {
    const f = yield* fixture
    const first = serialized(Session.ID.create(), 0)
    yield* f.events.replay(first, { publish: true })
    const control = yield* f.snapshot
    expect(control.rows).toHaveLength(1)
    expect(control.rows[0]).toMatchObject({ id: first.id, seq: 0, data: first.data })
    expect(control.sequences).toEqual([{ aggregate_id: first.aggregateID, seq: 0, owner_id: null }])
    expect(control.projection).toEqual([{ event_id: first.id }])
    expect(control.projected).toEqual([first.id])
    expect(control.notified).toEqual([first.id])

    // Exact duplicate acceptance can claim an unowned sequence, but must not project/notify twice.
    yield* f.events.replay(first, { ownerID: "owner-a", strictOwner: true, publish: true })
    const before = yield* f.snapshot
    expect(before).toEqual({ ...control, sequences: [{ aggregate_id: first.aggregateID, seq: 0, owner_id: "owner-a" }] })
    const next = serialized(first.data.sessionID, 1)
    yield* f.mark
    expectRefusal(yield* f.events.replay(next, {
      ownerID: "owner-a", strictOwner: true, publish: true,
    }).pipe(Effect.exit))
    expect(yield* f.snapshot).toEqual(before)

    const local = yield* f.events.publish(LocalMessage, { aggregateID: first.aggregateID, text: "after marker" })
    expect(local.durable).toEqual({ aggregateID: first.aggregateID, seq: 1, version: 1 })
    const afterLocal = yield* f.snapshot
    expect(afterLocal.rows).toHaveLength(2)
    expect(afterLocal.rows.map((row) => row.id)).toEqual([first.id, local.id])
    expect(afterLocal.sequences).toEqual([{ aggregate_id: first.aggregateID, seq: 1, owner_id: "owner-a" }])
    expect(afterLocal.projection.map((row) => row.event_id).sort()).toEqual([first.id, local.id].sort())
    expect(afterLocal.projected).toEqual([first.id, local.id])
    expect(afterLocal.notified).toEqual([first.id, local.id])

    // Construct an independent service/DB only AFTER exercising the marked one, in the same process.
    yield* Effect.gen(function* () {
      const fresh = yield* fixture
      expect(fresh.events).not.toBe(f.events)
      expect(fresh.database.storageID).not.toBe(f.database.storageID)
      expect(yield* fresh.database.db.select().from(DataMigrationTable).all()).toEqual([])
      yield* fresh.events.replay(first, { ownerID: "fresh-owner", publish: true })
      const state = yield* fresh.snapshot
      expect(state.rows).toHaveLength(1)
      expect(state.rows[0]).toMatchObject({ id: first.id, seq: 0, data: first.data })
      expect(state.sequences).toEqual([{ aggregate_id: first.aggregateID, seq: 0, owner_id: "fresh-owner" }])
      expect(state.projection).toEqual([{ event_id: first.id }])
      expect(state.projected).toEqual([first.id])
      expect(state.notified).toEqual([first.id])
    }).pipe(Effect.provide(build()))
    expect(yield* f.snapshot).toEqual(afterLocal)
  }),
)

it.effect("marker refuses an exact duplicate before duplicate acceptance or an unowned sequence claim", () =>
  Effect.gen(function* () {
    const f = yield* fixture
    const event = serialized(Session.ID.create(), 0)
    yield* f.events.replay(event, { publish: true })
    yield* f.events.replay(event, { publish: true })
    const before = yield* f.snapshot
    expect(before.rows).toHaveLength(1)
    expect(before.rows[0]).toMatchObject({ id: event.id, seq: 0, data: event.data })
    expect(before.sequences).toEqual([{ aggregate_id: event.aggregateID, seq: 0, owner_id: null }])
    expect(before.projection).toEqual([{ event_id: event.id }])
    expect(before.projected).toEqual([event.id])
    expect(before.notified).toEqual([event.id])

    yield* f.mark
    expectRefusal(yield* f.events.replay(event, {
      ownerID: "must-not-claim", strictOwner: true, publish: true,
    }).pipe(Effect.exit))
    expect(yield* f.snapshot).toEqual(before)
  }),
)

it.effect("marker refuses a valid contiguous replayAll with no partial state, notifications or caller transaction write", () =>
  Effect.gen(function* () {
    const f = yield* fixture
    const controlID = Session.ID.create()
    const control = [serialized(controlID, 0), serialized(controlID, 1)]
    expect(yield* f.events.replayAll(control, { ownerID: "batch-owner", publish: true })).toBe(controlID)
    const before = yield* f.snapshot
    expect(before.rows.map((row) => ({ id: row.id, seq: row.seq }))).toEqual(
      control.map((event) => ({ id: event.id, seq: event.seq })),
    )
    expect(before.sequences).toEqual([{ aggregate_id: controlID, seq: 1, owner_id: "batch-owner" }])
    expect(before.projection.map((row) => row.event_id).sort()).toEqual(control.map((event) => event.id).sort())
    expect(before.projected).toEqual(control.map((event) => event.id))
    expect(before.notified).toEqual(control.map((event) => event.id))

    const aggregateID = Session.ID.create()
    const batch = [serialized(aggregateID, 0), serialized(aggregateID, 1)]
    yield* f.mark
    expectRefusal(yield* f.events.replayAll(batch, {
      ownerID: "must-not-claim", strictOwner: true, publish: true,
    }).pipe(Effect.exit))
    expect(yield* f.snapshot).toEqual(before)

    const exit = yield* f.database.db.transaction(() => Effect.gen(function* () {
      // Also check propagation through the actual caller transaction, not just the batch's savepoints.
      yield* f.database.db.run("INSERT INTO replay_marker_projection (event_id) VALUES ('outer-write')")
      expect(yield* f.database.db.all("SELECT event_id FROM replay_marker_projection WHERE event_id = 'outer-write'"))
        .toEqual([{ event_id: "outer-write" }])
      yield* f.events.replayAll(batch, { ownerID: "must-not-claim", publish: true })
    }), { behavior: "immediate" }).pipe(Effect.exit)
    expectRefusal(exit)
    expect(yield* f.snapshot).toEqual(before)
  }),
)
