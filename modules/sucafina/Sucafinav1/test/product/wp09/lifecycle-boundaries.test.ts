import { expect, test } from "bun:test"
import { prepareRoutine, prepareWatch, readRoutineResult, readRoutineStatus, runAdmittedRoutine, routineInputSchemas, routineOutputSchemas } from "../../../product/routines/capabilities.ts"
import type { RoutineHost } from "../../../product/routines/capabilities.ts"
import type { RoutineResult, SourceRef } from "../../../product/contracts/context.ts"
import type { BoundCapabilityReceipt, TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

// Synthetic contexts isolate adapter behavior; they are not evidence of native binding or skill loading.
const context = { kind: "native", binding: { entryMode: "interactive", principalRef: "owner", projectId: "project", caseId: "case", caseIncarnation: "inc", caseVersion: 1 } } as TrustedDomainContext
const admitted: RoutineResult = { admission: "admitted", admissionRef: "admission", admissionVersion: 3, documentId: "recipe", publishedVersion: "v1", principalRef: "owner", projectId: "project", correlationId: "correlation", sourceRefs: [], pending: [] }
function fixture() {
  const state = { allowed: true, starts: 0 }
  const host: RoutineHost = {
    routines: {
      catalog: async () => ({ status: "ok", value: [] }),
      prepareAdmission: async () => ({ status: "ok", value: admitted }),
      readAdmission: async () => ({ status: "ok", value: admitted }),
      readRun: async () => ({ status: "ok", value: { ...admitted, runRef: "run", resultRef: "result" } }),
      run: async () => { state.starts++; return { status: "ok", value: { ...admitted, runRef: "run" } } },
    },
    resolveRecipe: async () => ({ status: "ok", value: { planRevisionId: "plan", writeScope: [], documentId: "recipe", publishedVersion: "v1" } }),
    resolveCase: async () => ({ status: "ok", value: { id: "case", incarnation: "inc", version: 1 } }),
    prepareWatch: async (request) => ({ status: "ok", value: { caseRef: request.caseRef, conditionRef: request.conditionRef, recurrence: request.recurrence.schedule, ...(request.recipientRef ? { recipientRef: request.recipientRef } : {}), state: "prepared" } }),
    authority: { revalidateDomainContext: async () => state.allowed, receiptFor: () => ({ kind: "native" }) as BoundCapabilityReceipt },
    revalidateOutput: async () => state.allowed,
    resolveResult: async (run) => ({ status: "ok", value: run }),
    requiredAuthority: { sf_routine_catalog: [], sf_routine_prepare: [], sf_routine_run: [], sf_routine_status: [], sf_routine_result: [], sf_watch_prepare: [] },
  }
  return { host, state }
}

test("revocation during case resolution stops the native invocation before any run starts", async () => {
  const { host, state } = fixture()
  host.resolveCase = async () => { state.allowed = false; return { status: "ok", value: { id: "case", incarnation: "inc", version: 1 } } }
  expect(await runAdmittedRoutine({ admittedRunRef: "admission", expectedAdmissionVersion: 3 }, context, host)).toMatchObject({ status: "denied", reason: "admission-authority-changed" })
  expect(state.starts).toBe(0)
})

test("run refuses fractional versions and a port that only prepared admission", async () => {
  const { host, state } = fixture()
  expect((await runAdmittedRoutine({ admittedRunRef: "admission", expectedAdmissionVersion: 3.5 }, context, host)).status).toBe("needs-input")
  host.routines.readAdmission = async () => ({ status: "ok", value: { ...admitted, admission: "needs-review" } })
  expect((await runAdmittedRoutine({ admittedRunRef: "admission", expectedAdmissionVersion: 3 }, context, host)).status).toBe("needs-input")
  expect(state.starts).toBe(0)
})

const governed: RoutineResult = {
  ...admitted,
  authorizationId: "authorization", armRef: "arm", childSessionId: "child-session",
  sourceRefs: [{ surface: "dashboard", type: "topic", id: "topic", incarnation: "inc", version: 1, fields: ["status"], period: { start: "2031-01-01", end: "2031-01-31" }, observedAt: "2031-01-15T12:00:00Z" }],
}

test.each(["correlationId", "authorizationId", "armRef", "childSessionId", "documentId", "publishedVersion", "principalRef", "projectId"] as const)("run rejects substituted %s from the admitted identity", async (field) => {
  const { host } = fixture()
  host.routines.readAdmission = async () => ({ status: "ok", value: structuredClone(governed) })
  host.routines.run = async () => ({ status: "ok", value: { ...structuredClone(governed), runRef: "run", [field]: "substituted" } })
  expect(await runAdmittedRoutine({ admittedRunRef: "admission", expectedAdmissionVersion: 3 }, context, host)).toMatchObject({ status: "stale", reason: "run-admission-mismatch" })
})

test.each(["authorizationId", "armRef", "childSessionId"] as const)("run rejects removal of admitted %s", async (field) => {
  const { host } = fixture()
  host.routines.readAdmission = async () => ({ status: "ok", value: structuredClone(governed) })
  const run = { ...structuredClone(governed), runRef: "run" }
  delete run[field]
  host.routines.run = async () => ({ status: "ok", value: run })
  expect(await runAdmittedRoutine({ admittedRunRef: "admission", expectedAdmissionVersion: 3 }, context, host)).toMatchObject({ status: "stale", reason: "run-admission-mismatch" })
})

const sourceChanges: readonly [string, Partial<SourceRef>][] = [
  ["id", { id: "substituted" }], ["incarnation", { incarnation: "substituted" }],
  ["fields", { fields: ["title"] }], ["version", { version: 2 }],
  ["period", { period: { start: "2031-02-01", end: "2031-02-28" } }],
]
test.each(sourceChanges)("run compares the complete source digest including %s", async (_, change) => {
  const { host } = fixture()
  host.routines.readAdmission = async () => ({ status: "ok", value: structuredClone(governed) })
  const source = { ...governed.sourceRefs[0]!, ...change }
  host.routines.run = async () => ({ status: "ok", value: { ...structuredClone(governed), runRef: "run", sourceRefs: [source] } })
  expect(await runAdmittedRoutine({ admittedRunRef: "admission", expectedAdmissionVersion: 3 }, context, host)).toMatchObject({ status: "stale", reason: "run-admission-mismatch" })
})

test("an admission object changed while resolving the case cannot rewrite the accepted identity", async () => {
  const { host } = fixture()
  const shared = structuredClone(governed)
  host.routines.readAdmission = async () => ({ status: "ok", value: shared })
  host.resolveCase = async () => { shared.correlationId = "substituted-during-await"; return { status: "ok", value: { id: "case", incarnation: "inc", version: 1 } } }
  host.routines.run = async () => ({ status: "ok", value: { ...shared, runRef: "run" } })
  expect(await runAdmittedRoutine({ admittedRunRef: "admission", expectedAdmissionVersion: 3 }, context, host)).toMatchObject({ status: "stale", reason: "run-admission-mismatch" })
})

test("authority callbacks receive copies and cannot change the admitted or released run", async () => {
  const { host } = fixture()
  host.routines.readAdmission = async () => ({ status: "ok", value: structuredClone(governed) })
  host.routines.run = async () => ({ status: "ok", value: { ...structuredClone(governed), runRef: "run" } })
  host.revalidateOutput = async (_, value) => { if ("correlationId" in value) value.correlationId = "callback-substitution"; return true }
  expect(await runAdmittedRoutine({ admittedRunRef: "admission", expectedAdmissionVersion: 3 }, context, host)).toMatchObject({ status: "ok", result: { correlationId: "correlation", authorizationId: "authorization", armRef: "arm", childSessionId: "child-session" } })
})

test("status and direct result reads never return another principal's metadata", async () => {
  const { host } = fixture()
  host.routines.readRun = async () => ({ status: "ok", value: { ...admitted, principalRef: "private-owner", runRef: "run", resultRef: "private-result" } })
  for (const read of [readRoutineStatus, readRoutineResult]) {
    const result = await read({ runRef: "run" }, context, host)
    expect(result.status).toBe("denied")
    expect(JSON.stringify(result)).not.toContain("private")
  }
})

test("a result reference without admitted run authority is not a ready result", async () => {
  const { host } = fixture()
  host.routines.readRun = async () => ({ status: "ok", value: { ...admitted, admission: "needs-review", runRef: "run", resultRef: "result" } })
  expect(await readRoutineResult({ runRef: "run" }, context, host)).toMatchObject({ status: "unavailable", reason: "run-admission-unavailable" })
})

test("a run's result reference alone cannot bypass its authenticated immutable artifact reader", async () => {
  const { host } = fixture()
  delete host.resolveResult
  expect(await readRoutineResult({ runRef: "run" }, context, host)).toMatchObject({ status: "unavailable", reason: "result-reader-unavailable" })
  host.resolveResult = async (run) => ({ status: "ok", value: { ...run, resultRef: "substituted-result" } })
  expect(await readRoutineResult({ runRef: "run" }, context, host)).toMatchObject({ status: "stale", reason: "result-run-mismatch" })
})

test("preparation rejects substituted principal and published version", async () => {
  const { host } = fixture()
  const request = { publishedRecipeRef: "recipe", inputRefs: [], parameters: {} }
  host.routines.prepareAdmission = async () => ({ status: "ok", value: { ...admitted, principalRef: "other" } })
  expect((await prepareRoutine(request, context, host)).status).toBe("denied")
  host.routines.prepareAdmission = async () => ({ status: "ok", value: { ...admitted, publishedVersion: "v2" } })
  expect(await prepareRoutine(request, context, host)).toMatchObject({ status: "stale", reason: "recipe-version-changed" })
})

test("port failures return a bounded failure without backend exception content", async () => {
  const { host } = fixture()
  host.routines.readRun = async () => { throw new Error("private document text and credential sentinel") }
  const result = await readRoutineResult({ runRef: "run" }, context, host)
  expect(result.status).toBe("unavailable")
  expect(JSON.stringify(result)).not.toContain("sentinel")
})

test("watch preparation keeps case, condition, recipient and recurrence attached to the authorized request", async () => {
  const { host } = fixture()
  const request = { caseRef: "case", conditionRef: "condition", recurrence: { recipeRef: "recipe", schedule: "daily", timezone: "UTC" } }
  expect((await prepareWatch(request, context, host)).status).toBe("ok")
  host.prepareWatch = async () => ({ status: "ok", value: { caseRef: "case", conditionRef: "other", recurrence: "daily", state: "prepared" } })
  expect(await prepareWatch(request, context, host)).toMatchObject({ status: "stale", reason: "watch-proposal-mismatch" })
  expect((await prepareWatch({ ...request, caseRef: "another-case" }, context, host)).status).toBe("denied")
})

test("the six producer exports expose the canonical input and output schemas", () => {
  const ids = ["sf_routine_catalog", "sf_routine_prepare", "sf_routine_run", "sf_routine_status", "sf_routine_result", "sf_watch_prepare"]
  expect(Object.keys(routineInputSchemas)).toEqual(ids)
  expect(Object.keys(routineOutputSchemas)).toEqual(ids)
})
