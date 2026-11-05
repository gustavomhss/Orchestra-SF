import { describe, expect } from "bun:test"
import { Deferred, Effect, Exit, Fiber, Layer, Schema, Stream } from "effect"
import { and, eq } from "drizzle-orm"
import { EventV2 } from "@orchestra/core/event"
import { Database } from "@orchestra/core/database/database"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { EventTable } from "@orchestra/core/event/sql"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { WorkspaceV2 } from "@orchestra/core/workspace"
import { ResearchEvent } from "@orchestra/schema/research-event"
import { Session } from "@orchestra/schema/session"
import { location } from "./fixture/location"
import { testEffect } from "./lib/effect"

const it = testEffect(
  AppNodeBuilder.build(LayerNode.group([Database.node, EventV2.node, Location.node]), [
    [Location.node, Layer.succeed(Location.Service, Location.Service.of(location({
      directory: AbsolutePath.make("project"), workspaceID: WorkspaceV2.ID.make("wrk_test"),
    })))],
  ]),
)
const definition = ResearchEvent.AllowanceCharged
const data = (sessionID: Session.ID, index: number) =>
  ({ sessionID, dispatchCallID: `call_${index}`, operation: "test", kind: "tool" as const, amount: 1 })
const seed = (events: EventV2.Interface, sessionID: Session.ID, count: number) =>
  Effect.forEach(Array.from({ length: count }, (_, index) => index),
    (index) => events.publish(definition, data(sessionID, index)), { discard: true })
const foreign = EventV2.define({
  type: "test.foreign.durable.page", durable: { version: 1, aggregate: "id" }, schema: { id: Schema.String },
})

describe("durable event pages", () => {
  it.live("reads bounded pages while draining every committed event", () =>
    Effect.gen(function* () {
      const reads: string[] = []
      const eventLayer = EventV2.layerWith({
        beforeAggregateRead: (aggregateID) => Effect.sync(() => { reads.push(aggregateID) }),
      }).pipe(Layer.provide(LayerNode.compile(Database.node)))
      yield* Effect.gen(function* () {
        const events = yield* EventV2.Service
        const aggregateID = Session.ID.create()
        yield* seed(events, aggregateID, 257)
        const received = yield* events.durable({ aggregateID }).pipe(
          Stream.take(257), Stream.runCollect, Effect.timeout("3 seconds"),
        )
        expect(received.map((event) => event.durable?.seq)).toEqual(Array.from({ length: 257 }, (_, index) => index))
        expect(received.map((event) => event.data)).toEqual(Array.from({ length: 257 }, (_, index) => data(aggregateID, index)))
        expect(reads).toEqual([aggregateID, aggregateID, aggregateID])
      }).pipe(Effect.provide(Layer.merge(LayerNode.compile(Database.node), eventLayer)))
    }),
  )

  it.live("filters non-manifest durable rows before decoding", () =>
    Effect.gen(function* () {
      const events = yield* EventV2.Service
      const aggregateID = Session.ID.create()
      yield* events.publish(foreign, { id: aggregateID })
      yield* events.publish(definition, data(aggregateID, 1))
      const received = yield* events.durable({ aggregateID }).pipe(
        Stream.take(1), Stream.runCollect, Effect.timeout("3 seconds"),
      )
      expect(received).toHaveLength(1)
      expect(received[0]).toMatchObject({ type: definition.type, durable: { aggregateID, seq: 1 }, data: data(aggregateID, 1) })
    }),
  )

  it.live("drains every page behind coalesced live wakes without another publish", () =>
    Effect.gen(function* () {
      const historical = yield* Deferred.make<void>()
      const liveRead = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const reads: string[] = []
      const eventLayer = EventV2.layerWith({
        beforeAggregateRead: (aggregateID) => Effect.gen(function* () {
          reads.push(aggregateID)
          if (reads.length !== 2) return
          yield* Deferred.succeed(liveRead, undefined)
          yield* Deferred.await(release)
        }),
      }).pipe(Layer.provide(LayerNode.compile(Database.node)))
      yield* Effect.gen(function* () {
        const events = yield* EventV2.Service
        const aggregateID = Session.ID.create()
        yield* events.publish(definition, data(aggregateID, 0))
        const consumer = yield* events.durable({ aggregateID }).pipe(
          Stream.tap((event) => event.durable?.seq === 0 ? Deferred.succeed(historical, undefined) : Effect.void),
          Stream.take(258), Stream.runCollect, Effect.forkScoped,
        )
        // Registered after the consumer: open its gate before scope teardown joins it on a failed assertion.
        yield* Effect.addFinalizer(() => Deferred.succeed(release, undefined))
        yield* Deferred.await(historical).pipe(Effect.timeout("3 seconds"))
        yield* events.publish(definition, data(aggregateID, 1))
        yield* Deferred.await(liveRead).pipe(Effect.timeout("3 seconds"))
        // The consumed wake is parked; these writes leave only one coalesced wake. A one-page-per-wake
        // reader can drain at most 256 of the 257 pending rows and cannot finish without another publish.
        yield* Effect.forEach(Array.from({ length: 256 }, (_, index) => index + 2),
          (index) => events.publish(definition, data(aggregateID, index)), { discard: true })
        yield* Deferred.succeed(release, undefined)
        const received = yield* Fiber.join(consumer).pipe(Effect.timeout("3 seconds"))
        expect(received.map((event) => event.durable?.seq)).toEqual(Array.from({ length: 258 }, (_, index) => index))
        expect(reads).toEqual([aggregateID, aggregateID, aggregateID, aggregateID])
      }).pipe(Effect.provide(Layer.merge(LayerNode.compile(Database.node), eventLayer)))
    }),
  )

  it.live("returns a typed failure for malformed known durable data", () =>
    Effect.gen(function* () {
      const events = yield* EventV2.Service
      const database = yield* Database.Service
      const aggregateID = Session.ID.create()
      yield* events.publish(definition, data(aggregateID, 0))
      yield* database.db.update(EventTable).set({ data: {} })
        .where(eq(EventTable.aggregate_id, aggregateID)).run().pipe(Effect.orDie)
      const result = yield* events.durable({ aggregateID }).pipe(
        Stream.runCollect, Effect.timeout("3 seconds"), Effect.exit,
      )
      expect(Exit.isFailure(result)).toBe(true)
      if (!Exit.isFailure(result)) throw new Error("Expected malformed durable data to fail")
      expect(result.cause.reasons).toHaveLength(1)
      const reason = result.cause.reasons[0]
      expect(reason?._tag).toBe("Fail")
      if (reason?._tag !== "Fail") throw new Error("Expected a typed durable decode failure, not a defect")
      expect(reason.error).toBeInstanceOf(EventV2.InvalidDurableEventError)
      if (!definition.durable) throw new Error("Expected a durable research event fixture")
      expect(reason.error).toMatchObject({
        type: EventV2.versionedType(definition.type, definition.durable.version),
        message: "Stored durable event data is invalid",
      })
    }),
  )

  it.live("does not decode a malformed row beyond the demanded page", () =>
    Effect.gen(function* () {
      const events = yield* EventV2.Service
      const database = yield* Database.Service
      const aggregateID = Session.ID.create()
      yield* seed(events, aggregateID, 129)
      yield* database.db.update(EventTable).set({ data: {} })
        .where(and(eq(EventTable.aggregate_id, aggregateID), eq(EventTable.seq, 128))).run().pipe(Effect.orDie)
      const result = yield* events.durable({ aggregateID }).pipe(
        Stream.take(128), Stream.runCollect, Effect.timeout("3 seconds"), Effect.exit,
      )
      expect(Exit.isSuccess(result)).toBe(true)
      if (!Exit.isSuccess(result)) throw new Error("The demanded good page must not decode the following page")
      expect(result.value.map((event) => event.durable?.seq)).toEqual(Array.from({ length: 128 }, (_, index) => index))
    }),
  )
})
