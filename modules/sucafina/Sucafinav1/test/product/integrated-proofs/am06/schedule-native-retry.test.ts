import "../../../../../../../packages/core/test/preload.ts"
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
import { testEffect } from "@orchestra/core/test/lib/effect"
import { readNativeRoutineSchedule } from "../../../../product/routines/schedule-native.ts"
import type { NativeRoutineScheduleHost } from "../../../../product/routines/schedule-native.ts"
import { createRoutineUiFixture } from "../../wp09/ui-authority-fixture.ts"

/**
 * Real native ScheduledTask/Session/SQLite writes, projections, retry key and
 * timezone. SessionExecution is intentionally non-executing: this proves
 * schedule admission and deduplication, never a C07 approval or Relay result.
 * Positive Relay/provider evidence must be obtained from the installed host.
 */
const execution = Layer.succeed(SessionExecution.Service, SessionExecution.Service.of({
  active: Effect.succeed(new Set()), resume: () => Effect.void, interrupt: () => Effect.void,
  wake: () => Effect.void, exclusive: (_, effect) => Effect.asSome(effect),
  withRunner: () => Effect.die("AM06_SCHEDULE_FIXTURE_MUST_NOT_RUN_PROVIDER"),
}))
const projects = Layer.succeed(ProjectV2.Service, ProjectV2.Service.of({
  resolve: (directory) => Effect.succeed({ id: ProjectV2.ID.global, directory }),
  directories: () => Effect.succeed([]), list: () => Effect.succeed([]), commit: () => Effect.void,
}))
const it = testEffect(AppNodeBuilder.build(LayerNode.group([
  Database.node, EventV2.node, SessionProjector.node, SessionStore.node, SessionV2.node, ScheduledTask.node,
]), [[ProjectV2.node, projects], [SessionExecution.node, execution]]))

it.effect("AM06 native schedule distinguishes same-key retry, changed request, timezone and revoked owner", () => Effect.gen(function* () {
  yield* TestClock.setTime(Date.parse("2031-01-15T12:00:00Z"))
  const tasks = yield* ScheduledTask.Service
  const sessions = yield* SessionV2.Service
  const database = yield* Database.Service
  const location = { directory: AbsolutePath.make("/sf-am06-native-schedule") }
  const agentID = AgentV2.ID.make("sf_maestro")
  const session = yield* sessions.create({ agent: agentID, location })
  const owner = { projectID: session.projectID, location, sessionID: session.id, agentID }
  const native = yield* tasks.capability.create(owner, {
    name: "Prepare current review",
    prompt: "Reauthenticate the original pinned SF C07 request before a native review.",
    cadence: { kind: "daily", time: "09:00" }, timezone: "America/Sao_Paulo", catchUp: "skip",
  })
  const ui = yield* Effect.promise(() => createRoutineUiFixture(session.projectID, "owner"))
  const context = ui.context
  const authority = { allowed: true }
  const host: NativeRoutineScheduleHost = {
    schedules: tasks.capability,
    resolve: async () => ({ status: "ok", value: {
      nativeId: native.id, owner, principalRef: "owner", projectId: session.projectID,
    } }),
    revalidate: async (call) => authority.allowed && call.kind === "ui" && await ui.authority.revalidate(call),
    readRoutine: async () => ({ status: "ok", value: null }),
  }

  const original = yield* Effect.promise(() => readNativeRoutineSchedule("am06-schedule", context, host))
  expect(original).toMatchObject({ status: "ok", value: {
    state: "active", timezone: "America/Sao_Paulo", missedOccurrences: 0,
  } })

  const first = yield* tasks.capability.run(owner, native.id, "am06-original-request")
  const retry = yield* tasks.capability.run(owner, native.id, "am06-original-request")
  expect(retry).toEqual({ sessionID: first.sessionID, reused: true })
  expect(yield* database.db.select().from(SessionInputTable).all().pipe(Effect.orDie)).toHaveLength(1)
  const pending = yield* Effect.promise(() => readNativeRoutineSchedule("am06-schedule", context, host))
  expect(pending).toMatchObject({ status: "ok", value: { last: { state: "admission-pending" } } })
  expect(JSON.stringify(pending)).not.toContain("am06-original-request")

  yield* tasks.capability.pause(owner, native.id)
  expect(yield* Effect.promise(() => readNativeRoutineSchedule("am06-schedule", context, host)))
    .toMatchObject({ status: "ok", value: { state: "paused" } })
  yield* tasks.capability.resume(owner, native.id)
  yield* tasks.capability.update(owner, native.id, {
    cadence: { kind: "weekly", day: 1, time: "09:30" },
    timezone: "UTC",
  })
  const revised = yield* Effect.promise(() => readNativeRoutineSchedule("am06-schedule", context, host))
  expect(revised).toMatchObject({ status: "ok", value: {
    state: "active", timezone: "UTC", cadence: { kind: "weekly", day: 1, time: "09:30" },
  } })

  authority.allowed = false
  expect(yield* Effect.promise(() => readNativeRoutineSchedule("am06-schedule", context, host)))
    .toEqual({ status: "denied", reason: "schedule-access-unavailable" })
  ui.authority.finish(context)
}))
