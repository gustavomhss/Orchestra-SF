import { expect, test } from "bun:test"
import { Effect } from "effect"
import { EventV2 } from "@orchestra/core/event"
import { SessionMessageTable } from "@orchestra/core/session/sql"
import { withOwnerFixture } from "../routine-native-owner-binding/fixture.ts"

/**
 * Real native EventV2/Session storage and original C07 adapter read boundary.
 * The fixture's owner/arm is synthetic, so a positive Task/Relay is forbidden:
 * only 229's eventual real origin, human admission and provider terminal
 * receipts can supply AM06 positive evidence.
 */
test("proof234 AM06 refuses a terminal artifact without a completed original native child and current owner", () =>
  withOwnerFixture((fixture) => Effect.gen(function* () {
    const beforeEvents = yield* fixture.database.db.select().from(EventV2.EventTable).all().pipe(Effect.orDie)
    const beforeMessages = yield* fixture.database.db.select().from(SessionMessageTable).all().pipe(Effect.orDie)

    yield* fixture.enter(Effect.gen(function* () {
      const published = yield* Effect.promise(() => fixture.adapter.port.resolvePlan(
        { documentId: fixture.draft.id, publishedVersion: fixture.draft.versionId },
        fixture.retained.purpose, fixture.state.context,
      ))
      expect(published.status).toBe("ok")
      if (published.status !== "ok" || !published.value) throw new Error("Original publication missing")
      expect(published.value.planRevisionId).toBe(fixture.plan.id)

      const execution = yield* Effect.promise(() =>
        fixture.adapter.port.readExecution(fixture.childID, fixture.state.context))
      expect(execution.status).toBe("ok")
      if (execution.status !== "ok") throw new Error("Original native execution unavailable")
      expect(execution.value.state).not.toBe("completed")
      expect(execution.value.outputDigest).toBeUndefined()

      const absent = yield* Effect.promise(() =>
        fixture.adapter.port.readArtifact("proof234-absent-native-result", fixture.state.context))
      expect(absent.status).not.toBe("ok")

      fixture.state.authorized = false
      try {
        const denied = yield* Effect.promise(() =>
          fixture.adapter.port.readExecution(fixture.childID, fixture.state.context))
        expect(denied.status).not.toBe("ok")
        const deniedPublication = yield* Effect.promise(() => fixture.adapter.port.resolvePlan(
          { documentId: fixture.draft.id, publishedVersion: fixture.draft.versionId },
          fixture.retained.purpose, fixture.state.context,
        ))
        expect(deniedPublication.status).not.toBe("ok")
      } finally {
        fixture.state.authorized = true
      }
    }))
    expect(yield* fixture.database.db.select().from(EventV2.EventTable).all().pipe(Effect.orDie))
      .toEqual(beforeEvents)
    expect(yield* fixture.database.db.select().from(SessionMessageTable).all().pipe(Effect.orDie))
      .toEqual(beforeMessages)
    console.info("SF_PROOF234_AM06_NEGATIVE", JSON.stringify({
      originalNativeReader: true, authoritativeTaskOrigin229: "NOT_PROVEN",
      actualRelayRun: "NOT_RUN", nativeModel: "NOT_RUN", uiReturn: "NOT_RUN",
    }))
  })))
