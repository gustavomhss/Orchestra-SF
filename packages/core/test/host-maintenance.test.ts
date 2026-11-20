import { describe, expect } from "bun:test"
import { Cause, Deferred, Effect, Exit, Fiber, Layer } from "effect"
import { HostMaintenance } from "@orchestra/core/host-maintenance"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { Database } from "@orchestra/core/database/database"
import { ProjectV2 } from "@orchestra/core/project"
import { AbsolutePath } from "@orchestra/core/schema"
import { SessionV2 } from "@orchestra/core/session"
import { SessionExecution } from "@orchestra/core/session/execution"
import { SessionExecutionLocal } from "@orchestra/core/session/execution/local"
import { SessionProcess } from "@orchestra/core/session-process"
import { ScheduledTask } from "@orchestra/core/scheduled-task"
import { testEffect } from "./lib/effect"

const it = testEffect(Layer.empty)
const interrupted = (exit: Exit.Exit<unknown, unknown>) =>
  Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)

describe("HostMaintenance private local barrier", () => {
  it.effect("waits for every admitted finalizer, permanently denies late work, and never trusts a serialized witness", () =>
    Effect.scoped(Effect.gen(function* () {
      const maintenance = yield* HostMaintenance.make
      const other = yield* HostMaintenance.make
      const started = yield* Deferred.make<void>()
      const cleaning = yield* Deferred.make<void>()
      const release = yield* Deferred.make<void>()
      let cleaned = false, calls = 0
      const stopped = new Set<string>()
      for (const name of ["session-execution", "session-process", "scheduled-task-daemon"] as const)
        yield* maintenance.register(name, Effect.sync(() => { stopped.add(name) }))
      const running = yield* maintenance.admit(
        Deferred.succeed(started, undefined).pipe(Effect.andThen(Effect.never),
          Effect.ensuring(Deferred.succeed(cleaning, undefined).pipe(
            Effect.andThen(Deferred.await(release)), Effect.andThen(Effect.sync(() => { cleaned = true })),
          ))),
      ).pipe(Effect.forkChild)
      yield* Deferred.await(started)
      let delivered = false
      const closing = yield* maintenance.close.pipe(Effect.tap(() => Effect.sync(() => { delivered = true })), Effect.forkChild)
      yield* Deferred.await(cleaning)
      expect(delivered).toBe(false)
      expect(cleaned).toBe(false)
      expect(interrupted(yield* maintenance.admit(Effect.sync(() => { calls++ })).pipe(Effect.exit))).toBe(true)
      yield* Deferred.succeed(release, undefined)
      const receipt = yield* Fiber.join(closing)
      expect(interrupted(yield* Fiber.await(running))).toBe(true)
      expect(cleaned).toBe(true)
      expect(calls).toBe(0)
      expect([...stopped].sort()).toEqual(["scheduled-task-daemon", "session-execution", "session-process"])
      expect(maintenance.verify(receipt)).toBe(true)
      expect(maintenance.verify({ ...receipt })).toBe(false)
      expect(maintenance.verify(JSON.parse(JSON.stringify(receipt)))).toBe(false)
      expect(other.verify(receipt)).toBe(false)
      expect(yield* maintenance.close).toBe(receipt)
      expect(Exit.isFailure(yield* maintenance.register("session-process", Effect.void).pipe(Effect.exit))).toBe(true)
    })),
  )

  it.effect("an incomplete graph closes admission without issuing a drain witness", () =>
    Effect.scoped(Effect.gen(function* () {
      const maintenance = yield* HostMaintenance.make
      let stopped = 0, ran = 0
      yield* maintenance.register("session-execution", Effect.sync(() => { stopped++ }))
      const result = yield* maintenance.close.pipe(Effect.exit)
      expect(Exit.isFailure(result)).toBe(true)
      expect(stopped).toBeGreaterThan(0)
      expect(interrupted(yield* maintenance.admit(Effect.sync(() => { ran++ })).pipe(Effect.exit))).toBe(true)
      expect(ran).toBe(0)
      expect(maintenance.verify({ _tag: "HostMaintenance.Drained" })).toBe(false)
    })),
  )

  it.effect("scope disposal closes retained admission even when no migration was requested", () =>
    Effect.gen(function* () {
      const maintenance = yield* Effect.scoped(HostMaintenance.make)
      let ran = 0
      expect(interrupted(yield* maintenance.admit(Effect.sync(() => { ran++ })).pipe(Effect.exit))).toBe(true)
      expect(ran).toBe(0)
    }),
  )
})

const directory = AbsolutePath.make("/project")
const projects = Layer.succeed(ProjectV2.Service, ProjectV2.Service.of({
  resolve: () => Effect.succeed({ id: ProjectV2.ID.global, directory }),
  list: () => Effect.succeed([]), directories: () => Effect.succeed([]), commit: () => Effect.void,
}))
const graph = AppNodeBuilder.build(LayerNode.group([
  SessionV2.node, SessionExecution.node, SessionProcess.node, ScheduledTask.node,
  ScheduledTask.daemonNode, HostMaintenance.node,
]), [
  [Database.node, Database.layerFromPath(":memory:")],
  [ProjectV2.node, projects],
  [SessionExecution.node, SessionExecutionLocal.node],
])

it.live("the actual graph drains its Session coordinator, daemon and native child process before the cut", () =>
  Effect.gen(function* () {
    const maintenance = yield* HostMaintenance.Service
    const sessions = yield* SessionV2.Service
    const runs = yield* SessionExecution.Service
    const processes = yield* SessionProcess.Service
    const tasks = yield* ScheduledTask.Service
    const session = yield* sessions.create({ location: { directory } })
    const started = yield* Deferred.make<void>()
    const cleaning = yield* Deferred.make<void>()
    const release = yield* Deferred.make<void>()
    let cleaned = false, delivered = false
    const owner = yield* runs.exclusive(session.id, Deferred.succeed(started, undefined).pipe(
      Effect.andThen(Effect.never),
      Effect.ensuring(Deferred.succeed(cleaning, undefined).pipe(
        Effect.andThen(Deferred.await(release)), Effect.andThen(Effect.sync(() => { cleaned = true })),
      )),
    )).pipe(Effect.forkChild)
    yield* Deferred.await(started)
    const child = yield* processes.launch({ sessionID: session.id, command: "sleep 30", title: "maintenance child" })
    const task = yield* tasks.create(directory, { name: "pending maintenance task", prompt: "Do not run during maintenance",
      cadence: "once", timezone: "UTC", next: Date.now() + 60000 })
    const closing = yield* maintenance.close.pipe(Effect.tap(() => Effect.sync(() => { delivered = true })), Effect.forkChild)
    yield* Deferred.await(cleaning)
    expect(delivered).toBe(false)
    expect(cleaned).toBe(false)
    yield* Deferred.succeed(release, undefined)
    const receipt = yield* Fiber.join(closing)
    expect(maintenance.verify(receipt)).toBe(true)
    expect(interrupted(yield* Fiber.await(owner))).toBe(true)
    expect(cleaned).toBe(true)
    expect(Array.from(yield* runs.active)).toEqual([])
    expect(yield* processes.list(session.id)).toEqual([])
    expect((yield* processes.wait(session.id, child.id, 0)).timedOut).toBe(false)
    expect(() => process.kill(child.pid, 0)).toThrow()
    for (const attempted of [
      runs.resume(session.id), runs.wake(session.id), runs.exclusive(session.id, Effect.void).pipe(Effect.asVoid),
      processes.launch({ sessionID: session.id, command: "true" }).pipe(Effect.asVoid),
      tasks.tick, tasks.run(directory, task.id).pipe(Effect.asVoid),
    ]) expect(interrupted(yield* attempted.pipe(Effect.exit))).toBe(true)
    expect((yield* sessions.get(session.id)).id).toBe(session.id)
  }).pipe(Effect.provide(graph)),
)
