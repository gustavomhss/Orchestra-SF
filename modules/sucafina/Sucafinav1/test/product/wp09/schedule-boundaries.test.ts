import { expect, test } from "bun:test"
import { createRoutineSchedule } from "../../../product/routines/schedule.ts"
import type { RoutineOccurrence, ScheduleHost } from "../../../product/routines/schedule.ts"
import type { BusinessPorts } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

const context = { kind: "ui", binding: { principalRef: "owner", projectId: "project" } } as TrustedDomainContext
const request = { recipeRef: "recipe-v1", conditionRef: "condition", recurrence: "daily", timezone: "America/Sao_Paulo" }
function fixture() {
  const state = { allowed: true, phase: "active" as "active" | "paused", calls: [] as string[] }
  const occurrence: RoutineOccurrence = { scheduleRef: "schedule", occurrenceRef: "occurrence", state: "needs-review", principalRef: "owner", projectId: "project", pendingRefs: [] }
  const host: ScheduleHost = {
    owner: async () => ({ principalRef: "owner", projectId: "project" }),
    revalidate: async () => state.allowed,
    authorize: async () => state.allowed,
    validateRecurrence: (recurrence) => recurrence === "daily",
    occurrences: {
      qualify: async (input) => ({ status: "ok", value: { principalRef: "owner", projectId: "project", recipeRef: input.recipeRef, conditionRef: input.conditionRef } }),
      read: async () => ({ status: "ok", value: { scheduleRef: "schedule", version: 1, principalRef: "owner", projectId: "project", conditionRef: "condition", recipeRef: "recipe-v1", state: state.phase } }),
      resume: async () => { state.calls.push("resume"); return { status: "ok", value: { scheduleRef: "schedule", version: 2, state: "active" } } },
      runDue: async () => { state.calls.push("due"); return { status: "ok", value: occurrence } },
      runNow: async (input) => { state.calls.push(input.idempotencyKey); return { status: "ok", value: occurrence } },
    },
  }
  const schedules: BusinessPorts["schedules"] = {
    create: async () => { state.calls.push("create"); return { status: "ok", value: { scheduleRef: "schedule", version: 1, state: "active" } } },
    update: async () => { state.calls.push("update"); return { status: "ok", value: { scheduleRef: "schedule", version: 2 } } },
    pause: async () => { state.calls.push("pause"); return { status: "ok", value: { scheduleRef: "schedule", version: 2, state: "paused" } } },
    list: async () => ({ status: "ok", value: [] }),
    readRun: async () => ({ status: "unavailable", reason: "no-admitted-run" }),
  }
  return { host, state, occurrence, api: createRoutineSchedule(host, schedules) }
}

test("a qualified occurrence binding reaches C08 create and update without approving the routine", async () => {
  const { api, state } = fixture()
  expect((await api.create(request, context)).status).toBe("ok")
  expect((await api.update({ scheduleRef: "schedule", expectedVersion: 1, recurrence: "daily", timezone: request.timezone }, context)).status).toBe("ok")
  expect(await api.runDue("schedule", context)).toMatchObject({ status: "ok", value: { state: "needs-review" } })
  expect(state.calls).toEqual(["create", "update", "due"])
})

test("revocation after occurrence qualification prevents scheduler creation", async () => {
  const { host, api, state } = fixture()
  if (!host.occurrences) throw new Error("fixture missing occurrence port")
  host.occurrences.qualify = async () => { state.allowed = false; return { status: "ok", value: { principalRef: "owner", projectId: "project", recipeRef: "recipe-v1", conditionRef: "condition" } } }
  expect((await api.create(request, context)).status).toBe("denied")
  expect(state.calls).toEqual([])
})

test("paused schedules and stale edits never reach native occurrence dispatch", async () => {
  const { api, state } = fixture()
  state.phase = "paused"
  expect(await api.runDue("schedule", context)).toEqual({ status: "needs-input", reason: "schedule-not-active" })
  expect((await api.update({ scheduleRef: "schedule", expectedVersion: 0, recurrence: "daily", timezone: request.timezone }, context)).status).toBe("stale")
  expect((await api.resume({ scheduleRef: "schedule", expectedVersion: 0 }, context)).status).toBe("stale")
  expect(state.calls).toEqual([])
  expect((await api.resume({ scheduleRef: "schedule", expectedVersion: 1 }, context)).status).toBe("ok")
})

test("manual requests require a retry key and retain admission-pending outcome", async () => {
  const { api, state } = fixture()
  expect((await api.runNow({ scheduleRef: "schedule", expectedVersion: 1, idempotencyKey: "" }, context)).status).toBe("needs-input")
  expect(state.calls).toEqual([])
  expect(await api.runNow({ scheduleRef: "schedule", expectedVersion: 1, idempotencyKey: "manual-1" }, context)).toMatchObject({ status: "ok", value: { state: "needs-review" } })
  expect(state.calls).toEqual(["manual-1"])
})

test("an occurrence cannot claim completion without C07 admission and a real result reference", async () => {
  const { api, occurrence } = fixture()
  occurrence.state = "ready"
  expect(await api.runDue("schedule", context)).toEqual({ status: "unavailable", reason: "occurrence-admission-unavailable" })
  occurrence.routine = { admission: "admitted", admissionRef: "admission", admissionVersion: 1, documentId: "recipe", publishedVersion: "v1", principalRef: "owner", projectId: "project", correlationId: "correlation", sourceRefs: [], pending: [], runRef: "run" }
  expect(await api.runDue("schedule", context)).toEqual({ status: "unavailable", reason: "occurrence-result-unavailable" })
})

test("revocation during occurrence dispatch hides every result and pending reference", async () => {
  const { api, host, state, occurrence } = fixture()
  if (!host.occurrences) throw new Error("fixture missing occurrence port")
  host.occurrences.runDue = async () => { state.allowed = false; return { status: "ok", value: { ...occurrence, pendingRefs: ["private-pending-sentinel"] } } }
  const result = await api.runDue("schedule", context)
  expect(result.status).toBe("denied")
  expect(JSON.stringify(result)).not.toContain("sentinel")
})
