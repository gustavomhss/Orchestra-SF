import { describe, expect } from "bun:test"
import { Cause, Deferred, Effect, Exit, Fiber, Layer } from "effect"
import { SessionRunCoordinator } from "@orchestra/core/session/run-coordinator"
import { testEffect } from "./lib/effect"

const it = testEffect(Layer.empty)

describe("SessionRunCoordinator maintenance", () => {
  it.effect("closes all admission before awaiting every owner cleanup and never promotes pending work", () =>
    Effect.scoped(Effect.gen(function* () {
      const startedA = yield* Deferred.make<void>()
      const startedB = yield* Deferred.make<void>()
      const cleanupA = yield* Deferred.make<void>()
      const cleanupB = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      const runs: string[] = [], cleaned: string[] = []
      const coordinator = yield* SessionRunCoordinator.make<string, never>({
        drain: (key) => Effect.sync(() => runs.push(key)).pipe(
          Effect.andThen(Deferred.succeed(key === "a" ? startedA : startedB, undefined)),
          Effect.andThen(Effect.never),
          Effect.ensuring(Deferred.succeed(key === "a" ? cleanupA : cleanupB, undefined).pipe(
            Effect.andThen(Deferred.await(release)), Effect.andThen(Effect.sync(() => cleaned.push(key))),
          )),
        ),
      })
      yield* coordinator.wake("a")
      yield* coordinator.wake("b")
      yield* Deferred.await(startedA)
      yield* Deferred.await(startedB)
      yield* coordinator.wake("a")
      const closing = yield* coordinator.close.pipe(Effect.forkChild)
      yield* Deferred.await(cleanupA)
      yield* Deferred.await(cleanupB)
      expect(cleaned).toEqual([])
      expect(Array.from(yield* coordinator.active).sort()).toEqual(["a", "b"])
      let exclusive = 0
      for (const attempt of [coordinator.run("c"), coordinator.wake("a"),
        coordinator.exclusive("c", Effect.sync(() => exclusive++)).pipe(Effect.asVoid)]) {
        const denied = yield* attempt.pipe(Effect.exit)
        expect(Exit.isFailure(denied) && Cause.hasInterruptsOnly(denied.cause)).toBeTrue()
      }
      expect(runs.sort()).toEqual(["a", "b"])
      expect(exclusive).toBe(0)
      yield* Deferred.succeed(release, undefined)
      yield* Fiber.join(closing)
      expect(cleaned.sort()).toEqual(["a", "b"])
      expect(Array.from(yield* coordinator.active)).toEqual([])
      yield* coordinator.close
      expect(runs).toEqual(["a", "b"])
    })),
  )

  for (const operation of ["run", "wake", "exclusive"] as const) {
    it.effect("rejects a late private binding for " + operation + " after maintenance closes", () =>
      Effect.scoped(Effect.gen(function* () {
        const binding = yield* Deferred.make<void>()
        const release = yield* Deferred.make<void>()
        let work = 0
        const coordinator = yield* SessionRunCoordinator.make<string, never>({
          bind: Deferred.succeed(binding, undefined).pipe(
            Effect.andThen(Deferred.await(release)),
            Effect.as(<A, E, R>(effect: Effect.Effect<A, E, R>) => effect),
          ),
          drain: () => Effect.sync(() => { work++ }),
        })
        const action = operation === "run" ? coordinator.run("held") : operation === "wake" ? coordinator.wake("held") :
          coordinator.exclusive("held", Effect.sync(() => { work++ })).pipe(Effect.asVoid)
        const pending = yield* action.pipe(Effect.exit, Effect.forkChild)
        yield* Deferred.await(binding)
        yield* coordinator.close
        yield* Deferred.succeed(release, undefined)
        const denied = yield* Fiber.join(pending)
        expect(Exit.isFailure(denied) && Cause.hasInterruptsOnly(denied.cause)).toBeTrue()
        expect(work).toBe(0)
        expect(Array.from(yield* coordinator.active)).toEqual([])
      })),
    )
  }

  it.effect("a retained coordinator cannot restart work after its owning scope closes", () =>
    Effect.gen(function* () {
      let work = 0
      const coordinator = yield* Effect.scoped(SessionRunCoordinator.make({
        drain: () => Effect.sync(() => { work++ }),
      }))
      for (const attempt of [coordinator.run("closed"), coordinator.wake("closed"),
        coordinator.exclusive("closed", Effect.sync(() => { work++ })).pipe(Effect.asVoid)]) {
        const denied = yield* attempt.pipe(Effect.exit)
        expect(Exit.isFailure(denied) && Cause.hasInterruptsOnly(denied.cause)).toBeTrue()
      }
      expect(work).toBe(0)
      expect(Array.from(yield* coordinator.active)).toEqual([])
    }),
  )
})
