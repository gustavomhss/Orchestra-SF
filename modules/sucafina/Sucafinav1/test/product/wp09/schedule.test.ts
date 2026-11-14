import { expect, test } from "bun:test"
import { createRoutineSchedule } from "../../../product/routines/schedule.ts"
import type { BusinessPorts } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

const context = { kind: "ui", binding: { principalRef: "owner-1", projectId: "project-1", accessRevision: "a" } } as TrustedDomainContext

function fixture() {
  const calls: string[] = []
  const schedules = {
    create: async () => ({ status: "ok" as const, value: { scheduleRef: "schedule-1", version: 1, state: "needs-review" as const } }),
    update: async () => ({ status: "ok" as const, value: { scheduleRef: "schedule-1", version: 2 } }),
    pause: async () => ({ status: "ok" as const, value: { scheduleRef: "schedule-1", version: 2, state: "paused" as const } }),
    list: async () => ({ status: "ok" as const, value: [{ scheduleRef: "schedule-1", version: 1, state: "active" }] }),
    readRun: async () => ({ status: "ok" as const, value: {} as never }),
  } as BusinessPorts["schedules"]
  const host = {
    owner: async () => ({ principalRef: "owner-1", projectId: "project-1" }),
    revalidate: async (_context: TrustedDomainContext, refs: readonly string[]) => { calls.push(`validate:${refs.join(",")}`); return true },
    validateRecurrence: (recurrence: string, timezone: string) => recurrence.trim().length > 0 && timezone === "America/Sao_Paulo",
    authorize: async () => true,
  }
  return { api: createRoutineSchedule(host, schedules), calls }
}

test("schedule validates timezone and principal before creating through the public schedule port", async () => {
  const { api, calls } = fixture()
  expect(await api.create({ conditionRef: "condition", recipeRef: "recipe", recurrence: "daily", timezone: "Mars/Olympus" }, context)).toEqual({ status: "denied", reason: "schedule-authority-unavailable" })
  expect(await api.create({ conditionRef: "condition", recipeRef: "recipe", recurrence: "daily", timezone: "America/Sao_Paulo" }, context)).toEqual({ status: "unavailable", reason: "occurrence-owner-revalidation-unavailable" })
  expect(calls).toEqual(["validate:"])
})

test("due recurrence stays unavailable without a durable occurrence port", async () => {
  const { api, calls } = fixture()
  expect(await api.runDue("schedule-1", context)).toEqual({ status: "unavailable", reason: "durable-occurrence-port-unavailable" })
  expect(calls).toEqual(["validate:schedule-1"])
})

test("schedule update fails closed when its authorized recipe binding is unavailable", async () => {
  const { api } = fixture()
  expect(await api.update({ scheduleRef: "schedule-1", expectedVersion: 1, recurrence: "daily", timezone: "America/Sao_Paulo" }, context)).toEqual({ status: "unavailable", reason: "authorized-schedule-recipe-unavailable" })
})

