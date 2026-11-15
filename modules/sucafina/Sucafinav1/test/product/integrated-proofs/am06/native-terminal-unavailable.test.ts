import { expect, test } from "bun:test"
import { Effect } from "effect"
import { EventV2 } from "@orchestra/core/event"
import { SessionMessageTable } from "@orchestra/core/session/sql"
import { withOwnerFixture } from "../../routine-native-owner-binding/fixture.ts"

/**
 * This composes the real publication, native owner registry, adapter and
 * persisted EventV2 readers. The owner/approval/Task/arm rows are intentionally
 * synthetic fixture input and NO Relay Task is dispatched. It therefore
 * verifies negative C07/egress boundaries, never a positive AM06 execution.
 */
test("AM06 a pinned C07 plan plus persisted synthetic arm cannot create a terminal result", () =>
  withOwnerFixture((f) => Effect.gen(function* () {
    const originalEvents = yield* f.database.db.select().from(EventV2.EventTable).all().pipe(Effect.orDie)
    const originalMessages = yield* f.database.db.select().from(SessionMessageTable).all().pipe(Effect.orDie)
    yield* f.enter(Effect.gen(function* () {
      const published = yield* Effect.promise(() => f.adapter.port.resolvePlan(
        { documentId: f.draft.id, publishedVersion: f.draft.versionId },
        f.retained.purpose, f.state.context,
      ))
      expect(published).toMatchObject({ status: "ok", value: {
        planRevisionId: f.plan.id, documentId: f.draft.id, publishedVersion: f.draft.versionId,
      } })
      const substituted = yield* Effect.promise(() => f.adapter.port.resolvePlan(
        { documentId: f.draft.id, publishedVersion: "superseded-without-publication" },
        f.retained.purpose, f.state.context,
      ))
      expect(substituted).toEqual({ status: "ok", value: null })

      // Native completion is not implied by synthetic persisted authorization,
      // arm, child identity, or an otherwise valid pinned publication.
      const execution = yield* Effect.promise(() => f.adapter.port.readExecution(f.childID, f.state.context))
      expect(execution.status).toBe("ok")
      if (execution.status !== "ok") throw new Error("Native execution read boundary unavailable")
      expect(execution.value.state).not.toBe("completed")
      expect(execution.value.outputDigest).toBeUndefined()
      expect((yield* Effect.promise(() => f.adapter.port.readArtifact(
        "not-a-settled-native-result", f.state.context,
      ))).status).not.toBe("ok")

      f.state.authorized = false
      try {
        expect((yield* Effect.promise(() => f.adapter.port.resolvePlan(
          { documentId: f.draft.id, publishedVersion: f.draft.versionId },
          f.retained.purpose, f.state.context,
        ))).status).not.toBe("ok")
      } finally { f.state.authorized = true }
    }))
    expect(yield* f.database.db.select().from(EventV2.EventTable).all().pipe(Effect.orDie)).toEqual(originalEvents)
    expect(yield* f.database.db.select().from(SessionMessageTable).all().pipe(Effect.orDie)).toEqual(originalMessages)
  })))
