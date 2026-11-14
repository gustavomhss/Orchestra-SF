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
  return { host, schedules, state, occurrence, api: createRoutineSchedule(host, schedules) }
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

test("create keeps the authorized recipe and cadence when owner resolution mutates the caller's request", async () => {
  const { host, schedules, api } = fixture()
  const incoming = structuredClone(request)
  const authorized: unknown[] = []
  const written: unknown[] = []
  host.authorize = async (_, __, payload) => { authorized.push(structuredClone(payload)); return true }
  host.owner = async () => { incoming.recipeRef = "foreign-recipe"; incoming.recurrence = "weekly"; incoming.timezone = "UTC"; return { principalRef: "owner", projectId: "project" } }
  schedules.create = async (payload) => { written.push(payload); return { status: "ok", value: { scheduleRef: "schedule", version: 1, state: "active" } } }
  expect((await api.create(incoming, context)).status).toBe("ok")
  expect(authorized).toEqual([request, request])
  expect(written).toEqual([request])
})

test.each(["update", "pause", "resume", "runNow"] as const)("%s keeps the authorized schedule, version and cadence across owner awaits", async (operation) => {
  const { host, schedules, api, occurrence } = fixture()
  if (!host.occurrences) throw new Error("fixture missing occurrence port")
  const incoming = { scheduleRef: "schedule", expectedVersion: 1, recurrence: "daily", timezone: request.timezone, idempotencyKey: "manual-1" }
  const original = structuredClone(incoming)
  const authorized: unknown[] = []
  const written: unknown[] = []
  host.authorize = async (_, __, payload) => { authorized.push(structuredClone(payload)); return true }
  host.owner = async () => { incoming.scheduleRef = "foreign"; incoming.expectedVersion = 99; incoming.recurrence = "weekly"; incoming.timezone = "UTC"; incoming.idempotencyKey = "other-key"; return { principalRef: "owner", projectId: "project" } }
  schedules.update = async (payload) => { written.push(payload); return { status: "ok", value: { scheduleRef: "schedule", version: 2 } } }
  schedules.pause = async (payload) => { written.push(payload); return { status: "ok", value: { scheduleRef: "schedule", version: 2, state: "paused" } } }
  host.occurrences.resume = async (payload) => { written.push(payload); return { status: "ok", value: { scheduleRef: "schedule", version: 2, state: "active" } } }
  host.occurrences.runNow = async (payload) => { written.push(payload); return { status: "ok", value: occurrence } }
  expect((await api[operation](incoming, context)).status).toBe("ok")
  expect(authorized).toEqual([original, original])
  expect(written).toEqual([original])
})

test("authorization and qualification callbacks cannot rewrite the mutation payload", async () => {
  const { host, schedules, api } = fixture()
  if (!host.occurrences) throw new Error("fixture missing occurrence port")
  const incoming = structuredClone(request)
  const written: unknown[] = []
  host.authorize = async (_, __, payload) => { Object.assign(payload as Record<string, unknown>, { recipeRef: "callback-recipe", recurrence: "weekly" }); return true }
  host.occurrences.qualify = async (payload) => { payload.recipeRef = "qualification-recipe"; return { status: "ok", value: { principalRef: "owner", projectId: "project", recipeRef: request.recipeRef, conditionRef: request.conditionRef } } }
  schedules.create = async (payload) => { written.push(payload); return { status: "ok", value: { scheduleRef: "schedule", version: 1, state: "active" } } }
  expect((await api.create(incoming, context)).status).toBe("ok")
  expect(written).toEqual([request])
  expect(incoming).toEqual(request)
})

test.each(["create", "update", "pause", "resume", "runNow"] as const)("%s requires the same payload authorization immediately before mutation", async (operation) => {
  const { host, api, state } = fixture()
  const authorizations = { count: 0 }
  host.authorize = async () => ++authorizations.count === 1
  const input = { ...request, scheduleRef: "schedule", expectedVersion: 1, idempotencyKey: "manual-1" }
  expect(await api[operation](input, context)).toEqual({ status: "denied", reason: "human-authorization-required" })
  expect(authorizations.count).toBe(2)
  expect(state.calls).toEqual([])
})

test("private pending references participate in occurrence egress authorization", async () => {
  const { host, api, occurrence } = fixture()
  occurrence.pendingRefs = ["private-pending-sentinel"]
  host.revalidate = async (_, refs) => !refs.includes("private-pending-sentinel")
  const result = await api.runDue("schedule", context)
  expect(result).toEqual({ status: "denied", reason: "schedule-authority-changed" })
  expect(JSON.stringify(result)).not.toContain("sentinel")
})

test.each(["", " pending ", "p".repeat(513)])("invalid pending reference is rejected before egress: %s", async (pendingRef) => {
  const { api, occurrence } = fixture()
  occurrence.pendingRefs = [pendingRef]
  expect(await api.runDue("schedule", context)).toEqual({ status: "unavailable", reason: "occurrence-pending-references-invalid" })
})

test("pending reference arrays reject nonstrings and excessive entries", async () => {
  const { api, occurrence } = fixture()
  occurrence.pendingRefs = [17 as unknown as string]
  expect((await api.runDue("schedule", context)).status).toBe("unavailable")
  occurrence.pendingRefs = Array.from({ length: 129 }, (_, index) => `pending-${index}`)
  expect((await api.runDue("schedule", context)).status).toBe("unavailable")
})

test("pending references are deduplicated and detached from callback mutation", async () => {
  const { host, api, occurrence } = fixture()
  occurrence.pendingRefs = ["pending", "pending"]
  const checked: string[][] = []
  host.revalidate = async (_, refs) => { if (refs.includes("pending")) { checked.push([...refs]); occurrence.pendingRefs = ["unvalidated-substitution"] } return true }
  expect(await api.runDue("schedule", context)).toMatchObject({ status: "ok", value: { pendingRefs: ["pending"] } })
  expect(checked).toEqual([["schedule", "pending"]])
})



test.each(["create", "runNow"] as const)("%s refuses a replacement authorizer before any native mutation", async (operation) => {
  const { host, api, state } = fixture()
  const replacement = { calls: 0 }
  host.owner = async () => {
    host.authorize = async () => { replacement.calls++; return true }
    return { principalRef: "owner", projectId: "project" }
  }
  const input = { ...request, scheduleRef: "schedule", expectedVersion: 1, idempotencyKey: "manual-1" }
  expect(await api[operation](input, context)).toEqual({ status: "unavailable", reason: "schedule-provider-changed" })
  expect(state.calls).toEqual([])
  expect(replacement.calls).toBe(0)
})

test("update refuses a replacement scheduler method before dispatch", async () => {
  const { host, schedules, api, state } = fixture()
  const original = schedules.update
  host.owner = async () => {
    schedules.update = async () => { state.calls.push("replacement-update"); return { status: "ok", value: { scheduleRef: "schedule", version: 2 } } }
    return { principalRef: "owner", projectId: "project" }
  }
  expect(await api.update({ ...request, scheduleRef: "schedule", expectedVersion: 1 }, context)).toEqual({ status: "unavailable", reason: "schedule-provider-changed" })
  expect(schedules.update).not.toBe(original)
  expect(state.calls).toEqual([])
})

test("due dispatch refuses an occurrence provider replaced during the owner read", async () => {
  const { host, api, state } = fixture()
  const original = host.occurrences!
  host.owner = async () => {
    host.occurrences = { ...original }
    return { principalRef: "owner", projectId: "project" }
  }
  expect(await api.runDue("schedule", context)).toEqual({ status: "unavailable", reason: "schedule-provider-changed" })
  expect(state.calls).toEqual([])
})

test("occurrence methods cannot be replaced behind an unchanged provider object", async () => {
  const { host, api, state, occurrence } = fixture()
  const occurrences = host.occurrences!
  const read = occurrences.read
  occurrences.read = async (...args) => {
    occurrences.runNow = async () => { state.calls.push("replacement-manual"); return { status: "ok", value: occurrence } }
    return read(...args)
  }
  expect(await api.runNow({ scheduleRef: "schedule", expectedVersion: 1, idempotencyKey: "manual-1" }, context)).toEqual({ status: "unavailable", reason: "schedule-provider-changed" })
  expect(state.calls).toEqual([])
})

test("replacement after native dispatch hides the output and preserves the submitted retry identity", async () => {
  const { host, api, state, occurrence } = fixture()
  host.occurrences!.runNow = async (input) => {
    state.calls.push(input.idempotencyKey)
    host.revalidate = async () => true
    return { status: "ok", value: { ...occurrence, pendingRefs: ["private-pending-sentinel"] } }
  }
  const result = await api.runNow({ scheduleRef: "schedule", expectedVersion: 1, idempotencyKey: "exact-attempt-1" }, context)
  expect(result).toEqual({ status: "unavailable", reason: "schedule-provider-changed" })
  expect(JSON.stringify(result)).not.toContain("sentinel")
  expect(state.calls).toEqual(["exact-attempt-1"])
})

test("native result reader replacement cannot release a ready occurrence", async () => {
  const { host, api, occurrence } = fixture()
  occurrence.state = "ready"
  occurrence.routine = { admission: "admitted", admissionRef: "admission", admissionVersion: 1, documentId: "recipe", publishedVersion: "v1", principalRef: "owner", projectId: "project", correlationId: "correlation", sourceRefs: [], pending: [], runRef: "run", resultRef: "private-result-sentinel" }
  const calls = { result: 0 }
  host.resultAccess = { readResult: async () => { calls.result++; return { status: "unavailable", reason: "terminal-not-available" } } }
  host.occurrences!.runDue = async () => {
    host.resultAccess!.readResult = async () => { calls.result++; return { status: "unavailable", reason: "replacement" } }
    return { status: "ok", value: occurrence }
  }
  const result = await api.runDue("schedule", context)
  expect(result).toEqual({ status: "unavailable", reason: "schedule-provider-changed" })
  expect(JSON.stringify(result)).not.toContain("sentinel")
  expect(calls.result).toBe(0)
})

test("list does not release metadata through an authorizer replaced after its read", async () => {
  const { host, schedules, api } = fixture()
  schedules.list = async () => {
    host.revalidate = async () => true
    return { status: "ok", value: [{ scheduleRef: "private-schedule-sentinel", version: 1, state: "active", timezone: request.timezone, recurrence: request.recurrence }] }
  }
  const result = await api.list(context)
  expect(result).toEqual({ status: "unavailable", reason: "schedule-provider-changed" })
  expect(JSON.stringify(result)).not.toContain("sentinel")
})


test("native provider prototype methods retain their receiver and remain callable", async () => {
  const { host, state } = fixture()
  class NativeSchedules {
    version = 4
    async create() { state.calls.push("create"); return { status: "ok" as const, value: { scheduleRef: "schedule", version: this.version, state: "active" as const } } }
    async update() { return { status: "ok" as const, value: { scheduleRef: "schedule", version: this.version } } }
    async pause() { return { status: "ok" as const, value: { scheduleRef: "schedule", version: this.version, state: "paused" as const } } }
    async list() { return { status: "ok" as const, value: [{ scheduleRef: "schedule", version: this.version, state: "active" }] } }
    async readRun() { return { status: "unavailable" as const, reason: "not-selected" } }
  }
  const schedules = new NativeSchedules()
  expect(Object.keys(schedules)).toEqual(["version"])
  const api = createRoutineSchedule(host, schedules)
  expect(await api.create(request, context)).toEqual({ status: "ok", value: { scheduleRef: "schedule", version: 4, state: "active" } })
  expect(state.calls).toEqual(["create"])
})
