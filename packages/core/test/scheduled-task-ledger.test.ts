import { expect, test } from "bun:test"
import path from "node:path"
import { eq, sql } from "drizzle-orm"
import { Effect, Exit, Layer, type Scope } from "effect"
import type { Capability } from "@orchestra/schema/capability"
import { AgentV2 } from "../src/agent"
import { Database } from "../src/database/database"
import { AppNodeBuilder } from "../src/effect/app-node-builder"
import { LayerNode } from "../src/effect/layer-node"
import { EventV2 } from "../src/event"
import { ProjectV2 } from "../src/project"
import { AbsolutePath } from "../src/schema"
import { ScheduledTask } from "../src/scheduled-task"
import { ScheduledTaskTable, ScheduledTaskRunTable } from "../src/scheduled-task/sql"
import { SessionV2 } from "../src/session"
import { SessionExecution } from "../src/session/execution"
import { SessionProjector } from "../src/session/projector"
import { SessionInputTable } from "../src/session/sql"
import { SessionStore } from "../src/session/store"
import { teamSessionFixture, profileB } from "./fixture/team-session"
import { tmpdir } from "./fixture/tmpdir"

const definition = { name: "Durable schedule reservation", prompt: "Recorded only.",
  cadence: { kind: "interval" as const, minutes: 60 }, timezone: "UTC" }
const agent = AgentV2.ID.make("ledger-recorder")

test("schedule-ledger-01: a restarted technical scheduler settles a removed admitted claim without waking it again", async () => {
  await using directory = await tmpdir()
  const filename = path.join(directory.path, "schedule-ledger.sqlite")
  const location = { directory: AbsolutePath.make(directory.path) }
  let wakes = 0
  const execution = Layer.succeed(SessionExecution.Service, SessionExecution.Service.of({
    active: Effect.succeed(new Set<SessionV2.ID>()), resume: () => Effect.void, interrupt: () => Effect.void,
    wake: () => Effect.sync(() => { wakes++ }), exclusive: (_, effect) => Effect.asSome(effect),
    withRunner: () => Effect.die("Recording-only ledger fixture; no model execution"),
  }))
  const projects = Layer.succeed(ProjectV2.Service, ProjectV2.Service.of({
    resolve: (directory) => Effect.succeed({ id: ProjectV2.ID.global, directory }),
    list: () => Effect.succeed([]), directories: () => Effect.succeed([]), commit: () => Effect.void,
  }))
  const graph = () => Layer.fresh(AppNodeBuilder.build(LayerNode.group([
    Database.node, EventV2.node, SessionProjector.node, SessionStore.node, SessionV2.node, ScheduledTask.node,
  ]), [[Database.node, Database.layerFromPath(filename)], [ProjectV2.node, projects], [SessionExecution.node, execution]]))
  type Services = Database.Service | SessionV2.Service | ScheduledTask.Service
  const run = <A, E>(body: Effect.Effect<A, E, Services | Scope.Scope>) =>
    Effect.runPromise(body.pipe(Effect.provide(graph()), Effect.scoped))
  const saved = await run(Effect.gen(function* () {
    const sessions = yield* SessionV2.Service
    const tasks = yield* ScheduledTask.Service
    const { db } = yield* Database.Service
    const session = yield* sessions.create({ agent, location })
    const owner = { sessionID: session.id, projectID: session.projectID, location: {
      directory: session.location.directory,
      ...(session.location.workspaceID === undefined ? {} : { workspaceID: session.location.workspaceID }),
    }, agentID: agent } satisfies Capability.Owner
    const task = yield* tasks.capability.create(owner, definition)
    // The prompt is admitted through the real Session producer. Fault injection rejects only
    // its later receipt UPDATE, leaving the exact durable frontier of a stopped process.
    yield* db.run(sql.raw("CREATE TEMP TRIGGER reject_schedule_receipt BEFORE UPDATE OF state ON scheduled_task_run WHEN NEW.state = 'started' BEGIN SELECT RAISE(ABORT, 'synthetic receipt interruption'); END")).pipe(Effect.orDie)
    expect(Exit.isFailure(yield* Effect.exit(tasks.capability.run(owner, task.id, "original-invocation")))).toBe(true)
    yield* db.run(sql.raw("DROP TRIGGER reject_schedule_receipt")).pipe(Effect.orDie)
    expect(wakes).toBe(1)
    const receipt = yield* db.select().from(ScheduledTaskRunTable).get().pipe(Effect.orDie)
    if (!receipt || !receipt.message_id) throw new Error("Original durable claim required")
    expect(receipt.state).toBe("running")
    expect((yield* db.select().from(SessionInputTable).all().pipe(Effect.orDie)).map((row) => row.id)).toEqual([receipt.message_id])
    yield* tasks.capability.remove(owner, task.id)
    const tombstone = yield* db.select().from(ScheduledTaskTable).where(eq(ScheduledTaskTable.id, task.id)).get().pipe(Effect.orDie)
    if (!tombstone) throw new Error("Removed task must remain durable")
    // Only the technical legacy recovery clock is advanced; this is not corporate authority.
    yield* db.update(ScheduledTaskRunTable).set({ time_claimed: Date.now() - ScheduledTask.LEASE - 1000 })
      .where(eq(ScheduledTaskRunTable.id, receipt.id)).run().pipe(Effect.orDie)
    return { owner, task, receipt, tombstone }
  }))
  // A new graph, coordinator and SQLite connection read the retained row after the old Scope closed.
  await run(Effect.gen(function* () {
    const tasks = yield* ScheduledTask.Service
    const { db } = yield* Database.Service
    yield* tasks.tick
    const receipt = yield* db.select().from(ScheduledTaskRunTable).get().pipe(Effect.orDie)
    expect(receipt).toMatchObject({ id: saved.receipt.id, task_id: saved.task.id, manual_key: "original-invocation",
      state: "started", session_id: saved.receipt.session_id, message_id: saved.receipt.message_id })
    expect(wakes).toBe(1)
    expect(yield* db.select().from(ScheduledTaskTable).where(eq(ScheduledTaskTable.id, saved.task.id)).get().pipe(Effect.orDie))
      .toEqual(saved.tombstone)
    expect(yield* tasks.capability.list(saved.owner)).toEqual([])
    expect(yield* tasks.capability.run(saved.owner, saved.task.id, "original-invocation").pipe(Effect.flip))
      .toBeInstanceOf(ScheduledTask.NotFoundError)
    expect((yield* db.select().from(SessionInputTable).all().pipe(Effect.orDie)).map((row) => row.id)).toEqual([saved.receipt.message_id])
  }))
}, 30000)

test("schedule-ledger-02: actual Microsoft/Owner admission preserves removed reservations across graphs and denies another Team", async () => {
  await using f = await teamSessionFixture({ extraNodes: [ScheduledTask.node] })
  const saved = await f.run(f.admitted(f.businessRequest(), Effect.gen(function* () {
    const sessions = yield* SessionV2.Service
    const tasks = yield* ScheduledTask.Service
    const session = yield* sessions.create({ agent, location: f.location })
    const owner = { sessionID: session.id, projectID: session.projectID, location: {
      directory: session.location.directory,
      ...(session.location.workspaceID === undefined ? {} : { workspaceID: session.location.workspaceID }),
    }, agentID: agent } satisfies Capability.Owner
    const task = yield* tasks.capability.create(owner, definition)
    const result = yield* tasks.capability.run(owner, task.id, "corporate-invocation")
    yield* tasks.capability.remove(owner, task.id)
    return { owner, task, result }
  })))
  expect(f.calls.wakes).toBe(1)
  await f.run(f.admitted(f.businessRequest(profileB), Effect.gen(function* () {
    const tasks = yield* ScheduledTask.Service
    expect(Exit.isFailure(yield* Effect.exit(tasks.capability.get(saved.owner, saved.task.id)))).toBe(true)
    expect(Exit.isFailure(yield* Effect.exit(tasks.capability.run(saved.owner, saved.task.id, "corporate-invocation")))).toBe(true)
  })))
  await f.run(f.admitted(f.businessRequest(), Effect.gen(function* () {
    const tasks = yield* ScheduledTask.Service
    const { db } = yield* Database.Service
    expect(yield* tasks.capability.list(saved.owner)).toEqual([])
    expect(yield* tasks.capability.run(saved.owner, saved.task.id, "corporate-invocation").pipe(Effect.flip))
      .toBeInstanceOf(ScheduledTask.NotFoundError)
    expect(yield* tasks.capability.resume(saved.owner, saved.task.id).pipe(Effect.flip))
      .toBeInstanceOf(ScheduledTask.NotFoundError)
    const rows = yield* db.select().from(ScheduledTaskRunTable).all().pipe(Effect.orDie)
    expect(rows.map((row) => [row.task_id, row.manual_key, row.session_id, row.state]))
      .toEqual([[saved.task.id, "corporate-invocation", saved.result.sessionID, "started"]])
    expect(yield* db.select().from(ScheduledTaskTable).where(eq(ScheduledTaskTable.id, saved.task.id)).get().pipe(Effect.orDie))
      .toMatchObject({ owner: saved.owner, disabled_reason: "removed", enabled: false, revision: 1 })
    expect((yield* db.select().from(SessionInputTable).all().pipe(Effect.orDie)).map((row) => row.session_id))
      .toEqual([saved.result.sessionID])
  })))
  expect(f.calls.wakes).toBe(1)
}, 30000)
