import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { RoutineResult } from "../../../product/contracts/context.ts"
import type { BusinessPorts } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createRoutineSchedule } from "../../../product/routines/schedule.ts"
import type { RoutineOccurrence, ScheduleHost } from "../../../product/routines/schedule.ts"
import { createRoutineResultAccess, routineArtifactDigest } from "../../../product/routines/result-access.ts"
import type { RoutineArtifact, RoutineExecutionSnapshot } from "../../../product/routines/result-access.ts"

// Native storage is an explicit boundary fixture. These tests exercise both production adapters, not a Relay execution.
function fixture() {
  const context = { kind: "ui", binding: { principalRef: "owner", projectId: "project" } } as TrustedDomainContext
  const run: RoutineResult = { admission: "admitted", admissionRef: "admission", admissionVersion: 1, documentId: "recipe", publishedVersion: "v1", principalRef: "owner", projectId: "project", correlationId: "correlation", sourceRefs: [], pending: [], runRef: "run", resultRef: "result" }
  const body: Omit<RoutineArtifact, "outputDigest"> = { schema: "sf-routine-artifact-v1", runRef: "run", resultRef: "result", correlationId: "correlation", documentId: "recipe", publishedVersion: "v1", principalRef: "owner", projectId: "project", inputDigest: digestSfValue({ input: "synthetic" }), sourceRefs: [], content: { text: "private-result-sentinel" }, createdAt: "2031-01-15T12:00:00Z" }
  const artifact: RoutineArtifact = { ...body, outputDigest: routineArtifactDigest(body) }
  const execution: RoutineExecutionSnapshot = { runRef: "run", resultRef: "result", state: "completed", revision: "terminal-1", outputDigest: artifact.outputDigest }
  const occurrence: RoutineOccurrence = { scheduleRef: "schedule", occurrenceRef: "occurrence", state: "ready", principalRef: "owner", projectId: "project", routine: run, pendingRefs: ["pending"] }
  const state = { allowed: true, reads: 0 }
  const access = createRoutineResultAccess({
    routines: { readRun: async () => ({ status: "ok", value: run }) },
    readExecution: async () => ({ status: "ok", value: execution }),
    readArtifact: async () => { state.reads++; return { status: "ok", value: artifact } },
    expectedInputDigest: async () => ({ status: "ok", value: body.inputDigest }),
    authorize: async () => state.allowed, revalidateArtifact: async () => state.allowed,
  })
  const host: ScheduleHost = {
    owner: async () => ({ principalRef: "owner", projectId: "project" }),
    authorize: async () => state.allowed, revalidate: async () => state.allowed, validateRecurrence: () => true,
    resultAccess: access,
    occurrences: {
      qualify: async (request) => ({ status: "ok", value: { ...request, principalRef: "owner", projectId: "project" } }),
      read: async () => ({ status: "ok", value: { scheduleRef: "schedule", version: 1, principalRef: "owner", projectId: "project", conditionRef: "condition", recipeRef: "recipe", state: "active" } }),
      resume: async () => ({ status: "ok", value: { scheduleRef: "schedule", version: 2, state: "active" } }),
      runDue: async () => ({ status: "ok", value: occurrence }),
      runNow: async () => ({ status: "ok", value: occurrence }),
    },
  }
  const unavailable = async () => ({ status: "unavailable" as const, reason: "not-selected" })
  const schedules: BusinessPorts["schedules"] = { create: unavailable, update: unavailable, pause: unavailable, list: unavailable, readRun: unavailable }
  return { context, run, artifact, execution, occurrence, state, access, host, api: createRoutineSchedule(host, schedules) }
}

test.each(["ready", "unchanged"] as const)("%s requires the authenticated terminal result rather than a result URL", async (status) => {
  const f = fixture()
  f.occurrence.state = status
  delete f.host.resultAccess
  expect(await f.api.runDue("schedule", f.context)).toEqual({ status: "unavailable", reason: "occurrence-result-reader-unavailable" })
  expect(f.state.reads).toBe(0)
  f.host.resultAccess = f.access
  expect(await f.api.runDue("schedule", f.context)).toMatchObject({ status: "ok", value: { state: status, pendingRefs: ["pending"] } })
  expect(f.state.reads).toBe(1)
})

test.each(["failed", "cancelled"] as const)("a %s native receipt cannot be reported as a ready occurrence", async (state) => {
  const f = fixture()
  f.execution.state = state
  const result = await f.api.runNow({ scheduleRef: "schedule", expectedVersion: 1, idempotencyKey: "manual" }, f.context)
  expect(result).toEqual({ status: "denied", reason: "routine-result-unavailable" })
  expect(f.state.reads).toBe(0)
  expect(JSON.stringify(result)).not.toContain("pending")
})

test("an occurrence cannot substitute a different completed result with a valid digest", async () => {
  const f = fixture()
  f.host.resultAccess = { readResult: async (runRef, context) => {
    const result = await f.access.readResult(runRef, context)
    if (result.status !== "ok") return result
    return { status: "ok", value: { ...result.value, run: { ...result.value.run, correlationId: "another-occurrence" } } }
  } }
  expect(await f.api.runDue("schedule", f.context)).toEqual({ status: "stale", reason: "occurrence-result-changed" })
})

test("revocation after result recovery suppresses the occurrence and its pending references", async () => {
  const f = fixture()
  f.host.resultAccess = { readResult: async (runRef, context) => {
    const result = await f.access.readResult(runRef, context)
    f.state.allowed = false
    return result
  } }
  const result = await f.api.runDue("schedule", f.context)
  expect(result).toEqual({ status: "denied", reason: "schedule-authority-changed" })
  expect(JSON.stringify(result)).not.toContain("private-result-sentinel")
  expect(JSON.stringify(result)).not.toContain("pending")
})

test("admission-pending remains usable without claiming an authenticated terminal output", async () => {
  const f = fixture()
  f.occurrence.state = "needs-review"
  delete f.occurrence.routine
  delete f.host.resultAccess
  expect(await f.api.runDue("schedule", f.context)).toMatchObject({ status: "ok", value: { state: "needs-review" } })
  expect(f.state.reads).toBe(0)
})
