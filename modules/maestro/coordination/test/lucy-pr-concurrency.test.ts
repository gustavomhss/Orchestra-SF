import { expect, test } from "bun:test"
import { Deferred, Effect, Fiber } from "effect"
import { ReviewPRConcurrencyV2 } from "../src/v2/tools/review-pr-concurrency"

test("same candidate waits for its predecessor and a later call enters after release", () =>
  Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    const started = yield* Deferred.make<void>()
    const release = yield* Deferred.make<void>()
    const waiting = yield* Deferred.make<void>()
    const order: string[] = []
    const first = yield* ReviewPRConcurrencyV2.withCandidate("same", Effect.gen(function* () {
      order.push("first")
      yield* Deferred.succeed(started, undefined)
      yield* Deferred.await(release)
    })).pipe(Effect.forkChild)
    yield* Deferred.await(started)
    const second = yield* Effect.gen(function* () {
      yield* Deferred.succeed(waiting, undefined)
      yield* ReviewPRConcurrencyV2.withCandidate("same", Effect.sync(() => order.push("second")))
    }).pipe(Effect.forkChild)
    yield* Deferred.await(waiting)
    expect(order).toEqual(["first"])
    yield* Deferred.succeed(release, undefined)
    yield* Fiber.join(first)
    yield* Fiber.join(second)
    expect(order).toEqual(["first", "second"])
    yield* ReviewPRConcurrencyV2.withCandidate("same", Effect.sync(() => order.push("third")))
    expect(order).toEqual(["first", "second", "third"])
  }))),
)
