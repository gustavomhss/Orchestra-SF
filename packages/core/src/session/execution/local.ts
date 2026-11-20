import { Cause, Effect, Layer } from "effect"
import { LocationServiceMap } from "../../location-service-map"
import { makeGlobalNode } from "../../effect/app-node"
import { SessionRunCoordinator } from "../run-coordinator"
import { SessionRunner } from "../runner"
import { SessionSchema } from "../schema"
import { SessionStore } from "../store"
import { SessionExecution } from "../execution"
import { SessionOwner } from "../owner"
import { HostMaintenance } from "../../host-maintenance"

/** Current-process routing for implicit-local Locations. Future remote placement belongs here. */
const layer = Layer.effect(
  SessionExecution.Service,
  Effect.gen(function* () {
    const maintenance = yield* HostMaintenance.Service
    const store = yield* SessionStore.Service
    const owners = yield* SessionOwner.Service
    const locations = yield* LocationServiceMap.Service
    const coordinator = yield* SessionRunCoordinator.make<SessionSchema.ID, SessionRunner.RunError>({
      bind: owners.bind.pipe(Effect.orDie),
      drain: (sessionID: SessionSchema.ID, force: boolean) => SessionOwner.guard(owners, sessionID, "run", (ownerScope) => Effect.gen(function* () {
        const session = yield* store.get(sessionID)
        // A coalesced wake can outlive its Session (removal interrupts, then deletes); only an explicit run is a defect.
        if (!session && !force) return
        if (!session) return yield* Effect.die(`Session not found: ${sessionID}`)
        // Undo remains reversible while staged. A wake admitted during its filesystem window must not promote the
        // pending input or read the hidden history; explicit continuation reports the same busy contract.
        if (session.revert) {
          if (force) return yield* new SessionRunner.BusyError({ sessionID })
          return
        }
        return yield* SessionRunner.Service.use((runner) => owners.verify(ownerScope).pipe(Effect.orDie, Effect.andThen(runner.run({ sessionID, force })))).pipe(
          Effect.provide(locations.get(session.location)),
          Effect.mapError((error) => error as SessionRunner.RunError),
          Effect.tapCause((cause) =>
            Cause.hasInterruptsOnly(cause)
              ? Effect.void
              : Effect.logError("Failed to drain Session", cause).pipe(Effect.annotateLogs({ sessionID })),
          ),
        )
      })),
    })

    yield* maintenance.register("session-execution", coordinator.close)
    const service = SessionExecution.Service.of({
      active: Effect.gen(function* () {
        const scope = yield* owners.open().pipe(Effect.orDie)
        yield* owners.authorize(scope, "read").pipe(Effect.orDie)
        const result = new Set<SessionSchema.ID>()
        for (const sessionID of yield* coordinator.active)
          if (yield* owners.canRead(scope, sessionID).pipe(Effect.orDie)) result.add(sessionID)
        yield* owners.verify(scope).pipe(Effect.orDie)
        return result
      }),
      interrupt: (sessionID, options) => SessionOwner.guard(owners, sessionID, "control", () => coordinator.interrupt(sessionID, options)),
      resume: (sessionID, options) => SessionOwner.guard(owners, sessionID, "run", () => coordinator.run(sessionID, options)),
      wake: (sessionID) => SessionOwner.guard(owners, sessionID, "run", () => coordinator.wake(sessionID)),
      exclusive: (sessionID, effect, options) => Effect.gen(function* () {
        const scope = yield* owners.open().pipe(Effect.orDie)
        const action = yield* owners.eventOperation(scope, sessionID, "write")
        return yield* SessionOwner.guard(owners, sessionID, action, () => coordinator.exclusive(sessionID, effect, options))
      }),
      withRunner: <A, E>(sessionID: SessionSchema.ID, use: (runner: SessionRunner.Interface) => Effect.Effect<A, E>) =>
        SessionOwner.guard(owners, sessionID, "run", (ownerScope) => Effect.gen(function* () {
          const session = yield* store.get(sessionID)
          if (!session) return yield* Effect.die(`Session not found: ${sessionID}`)
          return yield* SessionRunner.Service.use((runner) => owners.verify(ownerScope).pipe(Effect.orDie, Effect.andThen(use(runner)))).pipe(
            Effect.provide(locations.get(session.location)),
            Effect.mapError((error) => error as E),
          )
        })) as Effect.Effect<A, E, never>,
    })
    return SessionExecution.Service.of({
      ...service,
      resume: (id, options) => maintenance.admit(service.resume(id, options)),
      wake: (id) => maintenance.admit(service.wake(id)),
      exclusive: (id, work, options) => maintenance.admit(service.exclusive(id, work, options)),
      withRunner: (id, use) => maintenance.admit(service.withRunner(id, use)),
    })
  }),
)

export const node = makeGlobalNode({
  service: SessionExecution.Service,
  layer,
  deps: [SessionStore.node, LocationServiceMap.node, SessionOwner.node, HostMaintenance.node],
})

export * as SessionExecutionLocal from "./local"
