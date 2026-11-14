import "../../../../../../packages/core/test/preload.ts"
import { expect } from "bun:test"
import { Effect, Layer } from "effect"
import { TestClock } from "effect/testing"
import { AgentV2 } from "@orchestra/core/agent"
import { Database } from "@orchestra/core/database/database"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { EventV2 } from "@orchestra/core/event"
import { ProjectV2 } from "@orchestra/core/project"
import { AbsolutePath } from "@orchestra/core/schema"
import { ScheduledTask } from "@orchestra/core/scheduled-task"
import { SessionV2 } from "@orchestra/core/session"
import { SessionExecution } from "@orchestra/core/session/execution"
import { SessionProjector } from "@orchestra/core/session/projector"
import { SessionInputTable } from "@orchestra/core/session/sql"
import { SessionStore } from "@orchestra/core/session/store"
import { testEffect } from "../../../../../../packages/core/test/lib/effect"
import { readNativeRoutineSchedule } from "../../../product/routines/schedule-native.ts"
import type { NativeRoutineScheduleHost } from "../../../product/routines/schedule-native.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

// Exercises actual SQLite schedule/session admission only. Provider execution and C07 approval are outside this proof.
const execution = Layer.succeed(SessionExecution.Service, SessionExecution.Service.of({
  active: Effect.succeed(new Set()), resume: () => Effect.void, interrupt: () => Effect.void,
  wake: () => Effect.void, exclusive: (_, effect) => Effect.asSome(effect),
  withRunner: () => Effect.die("Provider execution is not part of the schedule receipt proof"),
}))
const projects = Layer.succeed(ProjectV2.Service, ProjectV2.Service.of({
  resolve: (directory) => Effect.succeed({ id: ProjectV2.ID.global, directory }),
  directories: () => Effect.succeed([]), list: () => Effect.succeed([]), commit: () => Effect.void,
}))
const it = testEffect(AppNodeBuilder.build(LayerNode.group([
  Database.node, EventV2.node, SessionProjector.node, SessionStore.node, SessionV2.node, ScheduledTask.node,
]), [[ProjectV2.node, projects], [SessionExecution.node, execution]]))

it.effect("native Schedule controls and deduped prompt receipts remain distinct from a completed routine", () => Effect.gen(function* () {
  yield* TestClock.setTime(Date.parse("2031-01-15T12:00:00Z"))
  const tasks = yield* ScheduledTask.Service
  const sessions = yield* SessionV2.Service
  const database = yield* Database.Service
  const location = { directory: AbsolutePath.make("/wp09-schedule-proof") }
  const agentID = AgentV2.ID.make("sf_maestro")
  const session = yield* sessions.create({ agent: agentID, location })
  const owner = { projectID: session.projectID, location, sessionID: session.id, agentID }
  const native = yield* tasks.capability.create(owner, { name: "Preparar revisão", prompt: "Reautenticar a solicitação opaca wp09-request antes de preparar a revisão.", cadence: { kind: "daily", time: "09:00" }, timezone: "America/Sao_Paulo", catchUp: "skip" })
  const authority = { allowed: true }
  const context = { kind: "ui", binding: { principalRef: "owner", projectId: session.projectID } } as TrustedDomainContext
  const host: NativeRoutineScheduleHost = {
    schedules: tasks.capability,
    resolve: async () => ({ status: "ok", value: { nativeId: native.id, owner, principalRef: "owner", projectId: session.projectID } }),
    revalidate: async () => authority.allowed,
    readRoutine: async () => ({ status: "ok", value: null }),
  }
  const initial = yield* Effect.promise(() => readNativeRoutineSchedule("schedule-ref", context, host))
  expect(initial.status === "ok" && initial.value).toMatchObject({ state: "active", timezone: "America/Sao_Paulo", missedOccurrences: 0 })
  yield* tasks.capability.pause(owner, native.id)
  expect((yield* Effect.promise(() => readNativeRoutineSchedule("schedule-ref", context, host)))).toMatchObject({ status: "ok", value: { state: "paused" } })
  yield* tasks.capability.resume(owner, native.id)
  yield* tasks.capability.update(owner, native.id, { cadence: { kind: "weekly", day: 1, time: "09:30" } })
  const first = yield* tasks.capability.run(owner, native.id, "manual-request-1")
  const retry = yield* tasks.capability.run(owner, native.id, "manual-request-1")
  expect(retry).toEqual({ sessionID: first.sessionID, reused: true })
  expect(yield* database.db.select().from(SessionInputTable).all().pipe(Effect.orDie)).toHaveLength(1)
  const read = yield* Effect.promise(() => readNativeRoutineSchedule("schedule-ref", context, host))
  expect(read).toMatchObject({ status: "ok", value: { state: "active", cadence: { kind: "weekly", day: 1, time: "09:30" }, last: { state: "admission-pending" } } })
  expect(JSON.stringify(read)).not.toContain("wp09-request")
  authority.allowed = false
  expect(yield* Effect.promise(() => readNativeRoutineSchedule("schedule-ref", context, host))).toEqual({ status: "denied", reason: "schedule-access-unavailable" })
}))
