export * as HostMaintenance from "./host-maintenance"

import { Context, Deferred, Effect, Fiber, Layer, Scope } from "effect"
import { makeGlobalNode } from "./effect/app-node"

const required = ["session-execution", "session-process", "scheduled-task-daemon"] as const
export type Participant = typeof required[number]
/** Process-private witness of local cleanup only. It does not reconcile an external or durable effect. */
export interface Drained { readonly _tag: "HostMaintenance.Drained" }
export interface Interface {
  readonly admit: <A, E, R>(work: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
  readonly register: (participant: Participant, stop: Effect.Effect<void>) => Effect.Effect<void>
  /** Closes admission permanently, interrupts owned work and awaits every real producer's cleanup. */
  readonly close: Effect.Effect<Drained>
  readonly verify: (candidate: unknown) => boolean
}
export class Service extends Context.Service<Service, Interface>()("@orchestra/HostMaintenance") {}

export const make: Effect.Effect<Interface, never, Scope.Scope> = Effect.gen(function* () {
  const participants = new Map<Participant, Effect.Effect<void>>()
  const active = new Map<object, Fiber.Fiber<unknown, unknown>>()
  const witnesses = new WeakSet<object>()
  let closed = false
  let result: Deferred.Deferred<Drained> | undefined

  const admit: Interface["admit"] = (work) => Effect.uninterruptibleMask((restore) =>
    Effect.gen(function* () {
      if (closed) return yield* restore(Effect.interrupt)
      const token = { settled: false }
      const ready = Deferred.makeUnsafe<void>()
      const fiber = yield* restore(Deferred.await(ready).pipe(Effect.andThen(work))).pipe(
        Effect.ensuring(Effect.sync(() => { token.settled = true; active.delete(token) })),
        Effect.forkChild,
      )
      if (!token.settled) active.set(token, fiber)
      // Forking can yield. A close which won that race must prevent even the first instruction of work.
      if (closed || token.settled) {
        yield* Fiber.interrupt(fiber)
        return yield* restore(Effect.interrupt)
      }
      Deferred.doneUnsafe(ready, Effect.void)
      return yield* restore(Fiber.join(fiber)).pipe(
        Effect.ensuring(Fiber.interrupt(fiber).pipe(Effect.asVoid)),
      )
    }))

  const shutdown = Effect.uninterruptible(Effect.suspend(() => {
    closed = true
    // Producers and their callers must stop together: a producer may be waiting for an owned caller's finalizer.
    return Effect.all([
      Effect.forEach([...active.values()], (fiber) => Fiber.interrupt(fiber), { concurrency: "unbounded", discard: true }),
      Effect.all([...participants.values()], { concurrency: "unbounded", discard: true }),
    ], { concurrency: "unbounded", discard: true }).pipe(
      // A producer can finish registering a child scope while its admitted caller is being interrupted.
      // After callers have settled, await the idempotent producer cleanup once more.
      Effect.andThen(Effect.all([...participants.values()], { concurrency: "unbounded", discard: true })),
    )
  }))
  yield* Effect.addFinalizer(() => shutdown)

  const close = Effect.uninterruptible(Effect.suspend(() => {
    if (result) return Deferred.await(result)
    const completion = Deferred.makeUnsafe<Drained>()
    result = completion
    return shutdown.pipe(Effect.andThen(Effect.sync(() => {
      if (active.size || required.some((name) => !participants.has(name)))
        throw new Error("HOST_MAINTENANCE_INCOMPLETE")
      const witness = Object.freeze({ _tag: "HostMaintenance.Drained" } satisfies Drained)
      witnesses.add(witness)
      return witness
    })), Effect.onExit((exit) => Deferred.done(completion, exit)))
  }))

  return Object.freeze({
    admit,
    register: (participant: Participant, stop: Effect.Effect<void>) => Effect.sync(() => {
      if (closed || !required.includes(participant) || participants.has(participant))
        throw new Error("HOST_MAINTENANCE_INVALID_PARTICIPANT")
      participants.set(participant, stop)
    }),
    close,
    verify: (candidate: unknown) => closed && active.size === 0 &&
      !!candidate && typeof candidate === "object" && witnesses.has(candidate),
  })
})

export const node = makeGlobalNode({ service: Service, layer: Layer.effect(Service, make), deps: [] })
