import { expect, test } from "bun:test"
import { Cause, Effect, Exit, Schema } from "effect"
import { Capability } from "@orchestra/schema/capability"
import { AgentV2 } from "../src/agent"
import { SessionV2 } from "../src/session"
import { SessionOwner } from "../src/session/owner"
import { SessionProcess } from "../src/session-process"
import { ScheduledTask } from "../src/scheduled-task"
import { AuthorityGeneration } from "../src/session/authority-generation"
import { AuthoritySqlFence } from "../src/database/authority-sql-fence"
import { teamSessionFixture, profileA, profileB, oid, other } from "./fixture/team-session"

const denied = <A, E, R>(work: Effect.Effect<A, E, R>) => Effect.gen(function* () {
  const result = yield* work.pipe(Effect.exit)
  expect(Exit.isFailure(result)).toBe(true)
  if (Exit.isSuccess(result)) return yield* Effect.die("Private background operation unexpectedly succeeded")
  const cause = Cause.squash(result.cause)
  if (!(cause instanceof SessionOwner.Denied) && !(cause instanceof AuthorityGeneration.GenerationError))
    return yield* Effect.die(cause)
})

test("background-owner-01: process reads and control require the current full Session owner before any child use", async () => {
  await using f = await teamSessionFixture({ extraNodes: [SessionProcess.node] })
  const secondCookie = await f.login(other)
  await f.run(Effect.gen(function* () {
    const sessions = yield* SessionV2.Service
    const processes = yield* SessionProcess.Service
    const request = f.businessRequest(profileA)
    const session = yield* f.admitted(request, sessions.create({ location: f.location }))
    const launched = yield* f.admitted(request, processes.launch({ sessionID: session.id, command: "sleep 30", title: "owner private child" }))
    expect((yield* f.admitted(request, processes.list(session.id))).map((row) => row.id)).toEqual([launched.id])
    for (const foreign of [f.businessRequest(profileB), f.businessRequest(profileA, secondCookie)]) {
      for (const operation of [
        processes.list(session.id), processes.get(session.id, launched.id),
        processes.wait(session.id, launched.id, 0), processes.cancel(session.id, launched.id),
        processes.stopSession(session.id),
        processes.launch({ sessionID: session.id, command: "true" }),
      ]) yield* denied(f.admitted(foreign, operation))
    }
    expect((yield* f.admitted(request, processes.list(session.id))).map((row) => row.id)).toEqual([launched.id])
    expect(yield* f.admitted(request, processes.cancel(session.id, launched.id))).toBe(true)
    expect(yield* f.admitted(request, processes.list(session.id))).toEqual([])
    const retained = yield* f.capture(request)
    f.provider.directTeams.set(oid, [])
    yield* denied(SessionOwner.withLease(retained, processes.get(session.id, launched.id)))
  }))
})

test("background-owner-02: schedules use the durable Session owner and writer fence, while placement and daemon cannot confer authority", async () => {
  await using f = await teamSessionFixture({ extraNodes: [ScheduledTask.node] })
  const secondCookie = await f.login(other)
  // Install the same real SQLite fence on the schedule tables, not a mocked writer callback.
  const planHash = "a".repeat(64)
  f.control.beginMaintenance(f.storage, 1)
  f.control.suspendDrained(f.storage, 1)
  f.control.advanceSuspended(f.storage, 1, planHash)
  f.business.execute("BEGIN IMMEDIATE")
  AuthoritySqlFence.install(f.business, { generation: 2, controlId: f.control.controlId },
    [...AuthoritySqlFence.protectedTables, "scheduled_task", "scheduled_task_run"])
  f.business.execute("COMMIT")
  f.control.activate(f.storage, 2, planHash, f.marker)
  await f.run(Effect.gen(function* () {
    const sessions = yield* SessionV2.Service
    const tasks = yield* ScheduledTask.Service
    const request = f.businessRequest(profileA)
    const session = yield* f.admitted(request, sessions.create({ location: f.location, agent: AgentV2.ID.make("build") }))
    const owner = Schema.decodeUnknownSync(Capability.Owner)({
      projectID: session.projectID, location: f.location, sessionID: session.id, agentID: session.agent,
    })
    const task = yield* f.admitted(request, tasks.capability.create(owner, {
      name: "private owner schedule", prompt: "Private fixture prompt",
      cadence: { kind: "interval", minutes: 60 }, timezone: "UTC",
    }))
    expect((yield* f.admitted(request, tasks.capability.list(owner))).map((row) => row.id)).toEqual([task.id])
    for (const foreign of [f.businessRequest(profileB), f.businessRequest(profileA, secondCookie)]) {
      for (const operation of [
        tasks.capability.list(owner), tasks.capability.get(owner, task.id),
        tasks.capability.pause(owner, task.id), tasks.capability.remove(owner, task.id),
        tasks.capability.run(owner, task.id, "foreign-run-must-not-exist"),
      ]) yield* denied(f.admitted(foreign, operation))
    }
    yield* denied(f.admitted(request, tasks.capability.placed({ projectID: owner.projectID, location: owner.location })))
    yield* denied(tasks.list(f.location.directory))
    yield* denied(tasks.tick)
    expect(f.business.all("SELECT count(*) AS count FROM scheduled_task_run")).toEqual([{ count: 0 }])
    expect((yield* f.admitted(request, tasks.capability.pause(owner, task.id))).enabled).toBe(false)
    yield* f.admitted(request, tasks.capability.remove(owner, task.id))
    expect(yield* f.admitted(request, tasks.capability.list(owner))).toEqual([])
    expect(f.business.all("SELECT writer_permit FROM sf_authority_generation")).toEqual([{ writer_permit: null }])
    expect(f.control.pendingWriters(f.storage)).toEqual([])
  }))
})
