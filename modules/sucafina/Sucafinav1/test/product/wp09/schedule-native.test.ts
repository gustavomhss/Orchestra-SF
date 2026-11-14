import "../../../../../../packages/core/test/preload.ts"
import { expect, test } from "bun:test"
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
import { readNativeRoutineSchedule } from "../../../product/routines/schedule-native.ts"
import type { NativeRoutineScheduleHost } from "../../../product/routines/schedule-native.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import type { RoutineResult } from "../../../product/contracts/context.ts"
import type { Capability } from "@orchestra/schema/capability"
import type { CapabilityScheduleManagement } from "@orchestra/schema/capability-schedule-management"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createRoutineResultAccess, routineArtifactDigest } from "../../../product/routines/result-access.ts"
import type { RoutineArtifact, RoutineExecutionSnapshot } from "../../../product/routines/result-access.ts"
import { createRoutineUiFixture } from "./ui-authority-fixture.ts"

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
  const ui = yield* Effect.promise(() => createRoutineUiFixture(session.projectID, "owner"))
  const context = ui.context
  const host: NativeRoutineScheduleHost = {
    schedules: tasks.capability,
    resolve: async () => ({ status: "ok", value: { nativeId: native.id, owner, principalRef: "owner", projectId: session.projectID } }),
    revalidate: async (call) => authority.allowed && call.kind === "ui" && await ui.authority.revalidate(call),
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
  ui.authority.finish(context)
}))

// The following contract probes use synthetic native snapshots. They prove the projection fences, not Relay execution.
function lifecycleFixture() {
  const owner = { projectID: "project", sessionID: "owner-session", agentID: "sf_maestro", location: { directory: "/synthetic-schedule" } } as Capability.Owner
  const native: CapabilityScheduleManagement.Schedule = {
    id: "native-schedule" as CapabilityScheduleManagement.Schedule["id"], revision: 1, name: "Preparar revisão", prompt: "private-prompt-sentinel",
    cadence: { kind: "daily", time: "09:00" }, timezone: "UTC", catchUp: "skip", enabled: true, next: 2, runs: 1, skipped: 0,
    last: { outcome: "started", time: 1, sessionID: "child-session" as Capability.Owner["sessionID"] },
  }
  const context = { kind: "ui", binding: { principalRef: "owner", projectId: "project" } } as TrustedDomainContext
  const routine: RoutineResult = { admission: "admitted", admissionRef: "admission", admissionVersion: 1, documentId: "recipe", publishedVersion: "v1", principalRef: "owner", projectId: "project", correlationId: "correlation", sourceRefs: [], pending: [], runRef: "run", resultRef: "result" }
  const body: Omit<RoutineArtifact, "outputDigest"> = { schema: "sf-routine-artifact-v1", runRef: "run", resultRef: "result", correlationId: "correlation", documentId: "recipe", publishedVersion: "v1", principalRef: "owner", projectId: "project", inputDigest: digestSfValue({ admittedInput: "synthetic" }), sourceRefs: [], content: { text: "immutable synthetic output" }, createdAt: "2031-01-15T12:00:00Z" }
  const output: RoutineArtifact = { ...body, outputDigest: routineArtifactDigest(body) }
  const receipt: RoutineExecutionSnapshot = { runRef: "run", resultRef: "result", state: "completed", revision: "native-revision-1", outputDigest: output.outputDigest }
  const state = { artifactReads: 0, schedule: native,
    binding: { nativeId: native.id, owner, principalRef: "owner", projectId: "project" } }
  const resultAccess = createRoutineResultAccess({
    routines: { readRun: async () => ({ status: "ok", value: structuredClone(routine) }) },
    readExecution: async () => ({ status: "ok", value: structuredClone(receipt) }),
    readArtifact: async () => { state.artifactReads++; return { status: "ok", value: structuredClone(output) } },
    expectedInputDigest: async () => ({ status: "ok", value: body.inputDigest }),
    authorize: async () => true,
    revalidateArtifact: async () => true,
  })
  const host: NativeRoutineScheduleHost = {
    schedules: { get: () => Effect.succeed(state.schedule) },
    resolve: async () => ({ status: "ok", value: state.binding }),
    revalidate: async () => true,
    readRoutine: async () => ({ status: "ok", value: routine }),
    readExecution: async () => ({ status: "ok", value: structuredClone(receipt) }),
    resultAccess,
  }
  return { host, context, native, owner, routine, receipt, state, resultAccess }
}

test("admitted plus resultRef remains blocked without execution or authenticated output readers", async () => {
  const { host, context, state } = lifecycleFixture()
  const readExecution = host.readExecution
  delete host.readExecution
  expect(await readNativeRoutineSchedule("schedule", context, host)).toMatchObject({ status: "ok", value: { last: { state: "blocked" } } })
  host.readExecution = readExecution
  delete host.resultAccess
  expect(await readNativeRoutineSchedule("schedule", context, host)).toMatchObject({ status: "ok", value: { last: { state: "blocked" } } })
  expect(state.artifactReads).toBe(0)
})

test.each(["failed", "cancelled"] as const)("native execution %s cannot become reviewable because a result reference exists", async (terminal) => {
  const { host, context, receipt, state } = lifecycleFixture()
  receipt.state = terminal
  expect(await readNativeRoutineSchedule("schedule", context, host)).toMatchObject({ status: "ok", value: { last: { state: terminal } } })
  expect(state.artifactReads).toBe(0)
})

test("reviewable requires matching native completion and the authenticated immutable artifact", async () => {
  const { host, context, state } = lifecycleFixture()
  const result = await readNativeRoutineSchedule("schedule", context, host)
  expect(result).toMatchObject({ status: "ok", value: { last: { state: "reviewable", routine: { runRef: "run", resultRef: "result" } } } })
  expect(state.artifactReads).toBe(1)
  expect(JSON.stringify(result)).not.toContain("private-prompt-sentinel")
})

test("result authorization denial never returns schedule result metadata", async () => {
  const { host, context } = lifecycleFixture()
  host.resultAccess = { readResult: async () => ({ status: "denied", reason: "routine-result-unavailable" }) }
  expect(await readNativeRoutineSchedule("schedule", context, host)).toEqual({ status: "denied", reason: "routine-result-unavailable" })
})

test.each(["runRef", "resultRef", "outputDigest"] as const)("completion rejects a substituted %s before reading output", async (field) => {
  const { host, context, receipt, state } = lifecycleFixture()
  receipt[field] = "substituted"
  expect(await readNativeRoutineSchedule("schedule", context, host)).toEqual({ status: "unavailable", reason: "schedule-execution-unverified" })
  expect(state.artifactReads).toBe(0)
})

test("cancellation after the artifact read invalidates the earlier completion snapshot", async () => {
  const { host, context, receipt, resultAccess } = lifecycleFixture()
  host.resultAccess = { readResult: async (runRef, binding) => {
    const opened = await resultAccess.readResult(runRef, binding)
    receipt.state = "cancelled"
    receipt.revision = "native-revision-2"
    return opened
  } }
  expect(await readNativeRoutineSchedule("schedule", context, host)).toEqual({ status: "stale", reason: "schedule-execution-changed" })
})

test("a changed schedule revision during result recovery cannot return its older occurrence", async () => {
  const { host, context, native, resultAccess, state } = lifecycleFixture()
  host.resultAccess = { readResult: async (runRef, binding) => {
    const opened = await resultAccess.readResult(runRef, binding)
    state.schedule = { ...native, revision: native.revision + 1, enabled: false }
    return opened
  } }
  expect(await readNativeRoutineSchedule("schedule", context, host)).toEqual({ status: "stale", reason: "schedule-changed" })
})

test("a substituted owner binding during result recovery cannot expose the former owner's result", async () => {
  const { host, context, resultAccess, state } = lifecycleFixture()
  host.resultAccess = { readResult: async (runRef, binding) => {
    const opened = await resultAccess.readResult(runRef, binding)
    state.binding = { ...state.binding, principalRef: "replacement" }
    return opened
  } }
  expect(await readNativeRoutineSchedule("schedule", context, host)).toEqual({ status: "stale", reason: "schedule-binding-changed" })
})

test.each(["schedule-service", "schedule-get", "owner-resolver", "source-authority", "routine-reader", "execution-reader", "result-reader", "result-read-call"] as const)("a replacement %s cannot release identical result bytes through the previous provider", async (provider) => {
  const { host, context, native, resultAccess } = lifecycleFixture()
  const schedules = { get: host.schedules.get }
  host.schedules = schedules
  host.resultAccess = { readResult: async (runRef, binding) => {
    const opened = await resultAccess.readResult(runRef, binding)
    switch (provider) {
      case "schedule-service":
        host.schedules = { ...host.schedules }
        break
      case "schedule-get":
        schedules.get = () => Effect.succeed(native)
        break
      case "owner-resolver": {
        const resolve = host.resolve
        host.resolve = (reference, call) => resolve(reference, call)
        break
      }
      case "source-authority": {
        const revalidate = host.revalidate
        host.revalidate = (call, references) => revalidate(call, references)
        break
      }
      case "routine-reader": {
        const readRoutine = host.readRoutine
        host.readRoutine = (session, call) => readRoutine(session, call)
        break
      }
      case "execution-reader": {
        const readExecution = host.readExecution!
        host.readExecution = (reference, call) => readExecution(reference, call)
        break
      }
      case "result-reader":
        host.resultAccess = { readResult: host.resultAccess!.readResult }
        break
      case "result-read-call": {
        const readResult = host.resultAccess!.readResult
        host.resultAccess!.readResult = (reference, call) => readResult(reference, call)
        break
      }
    }
    return opened
  } }
  expect(await readNativeRoutineSchedule("schedule", context, host)).toEqual({ status: "unavailable", reason: "schedule-provider-changed" })
})

test("a provider replacement during initial authorization stops before result recovery", async () => {
  const { host, context, state } = lifecycleFixture()
  host.revalidate = async () => {
    host.schedules = { ...host.schedules }
    return true
  }
  expect(await readNativeRoutineSchedule("schedule", context, host)).toEqual({ status: "unavailable", reason: "schedule-provider-changed" })
  expect(state.artifactReads).toBe(0)
})

test("a provider replacement during final authorization cannot release an already recovered result", async () => {
  const { host, context, state } = lifecycleFixture()
  host.revalidate = async (_call, references) => {
    if (references.includes("result")) host.resultAccess = { readResult: host.resultAccess!.readResult }
    return true
  }
  expect(await readNativeRoutineSchedule("schedule", context, host)).toEqual({ status: "unavailable", reason: "schedule-provider-changed" })
  expect(state.artifactReads).toBe(1)
})

