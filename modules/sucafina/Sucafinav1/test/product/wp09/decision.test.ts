import { expect, test } from "bun:test"
import { readDecisionRoutine, readDecisionRoutineOutput, startDecisionRoutine } from "../../../product/routines/decision.ts"
import { createRoutineResultAccess, routineArtifactDigest, routineInputDigest } from "../../../product/routines/result-access.ts"
import type { RoutineAdmittedInput, RoutineExecutionSnapshot } from "../../../product/routines/result-access.ts"
import type { DecisionRoutineHost } from "../../../product/routines/decision.ts"
import type { AuthorizedCaseProjection } from "../../../product/contracts/business-context.ts"
import type { RoutineResult } from "../../../product/contracts/context.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

const context = { kind: "ui", binding: { principalRef: "person", projectId: "project" } } as TrustedDomainContext
const caseRef = { id: "case", incarnation: "inc", version: 1 }
const bound = { admissionRef: "admission", admissionVersion: 3, documentId: "recipe", publishedVersion: "v1", caseRef, runRef: "run" }
const routine = { documentId: "recipe", publishedVersion: "v1", principalRef: "person", projectId: "project", admission: "admitted", admissionRef: "admission", admissionVersion: 3, runRef: "run", correlationId: "key", sourceRefs: [], pending: [] } as const

test("decision routine requires the exact case and admitted version before invoking the native port", async () => {
  let starts = 0
  const host: DecisionRoutineHost = {
    cases: { read: async () => ({ status: "ok", value: { case: caseRef } as unknown as AuthorizedCaseProjection }), draft: async () => ({ status: "unavailable", reason: "unused" }), prepareIntent: async () => ({ status: "unavailable", reason: "unused" }) },
    routines: { catalog: async () => ({ status: "unavailable", reason: "unused" }), prepareAdmission: async () => ({ status: "unavailable", reason: "unused" }), readAdmission: async () => ({ status: "ok", value: routine }), readRun: async () => ({ status: "ok", value: routine }), run: async () => { starts++; return { status: "ok", value: routine } } },
    binding: async () => ({ status: "ok", value: bound }), revalidate: async () => true,
  }
  const request = { admissionRef: "admission", admissionVersion: 3, caseRef, context, host }
  expect((await startDecisionRoutine({ ...request, admissionVersion: 2 })).status).toBe("stale")
  expect(starts).toBe(0)
  expect((await startDecisionRoutine(request)).status).toBe("ok")
  expect(starts).toBe(1)
  expect(await readDecisionRoutine({ admissionRef: "admission", runRef: "run", caseRef, context, host })).toEqual({ status: "needs-input", reason: "decision-result-not-ready" })
  expect((await readDecisionRoutine({ admissionRef: "admission", runRef: "run", caseRef: { ...caseRef, version: 2 }, context, host })).status).toBe("stale")
  const otherCase = { kind: "native", binding: { principalRef: "person", projectId: "project", caseId: "other", caseIncarnation: "inc", caseVersion: 1 } } as TrustedDomainContext
  expect(await readDecisionRoutine({ admissionRef: "admission", runRef: "run", caseRef, context: otherCase, host })).toEqual({ status: "denied", reason: "decision-access-unavailable" })
})

function fixture() {
  const state = { allowed: true, starts: 0, case: { ...caseRef }, binding: { ...bound, caseRef: { ...caseRef } }, admission: structuredClone(routine) as RoutineResult, run: { ...structuredClone(routine), resultRef: "result" } as RoutineResult }
  const host: DecisionRoutineHost = {
    cases: { read: async () => ({ status: "ok", value: { case: state.case } as unknown as AuthorizedCaseProjection }), draft: async () => ({ status: "unavailable", reason: "unused" }), prepareIntent: async () => ({ status: "unavailable", reason: "unused" }) },
    routines: { catalog: async () => ({ status: "unavailable", reason: "unused" }), prepareAdmission: async () => ({ status: "unavailable", reason: "unused" }), readAdmission: async () => ({ status: "ok", value: state.admission }), readRun: async () => ({ status: "ok", value: state.run }), run: async () => { state.starts++; return { status: "ok", value: state.run } } },
    binding: async () => ({ status: "ok", value: state.binding }), revalidate: async () => state.allowed,
  }
  // These immutable admission/completion fixtures exercise the consumer, not a native Relay execution.
  const admittedInput: RoutineAdmittedInput = { publishedRecipeRef: routine.documentId, publishedVersion: routine.publishedVersion, planRevisionId: "plan-v1", writeScope: ["cases"], inputRefs: ["case:inc:1"], parameters: { objective: "Review the quote", currency: "USD" }, principalRef: routine.principalRef, projectId: routine.projectId, caseRef: { ...caseRef } }
  const inputDigest = routineInputDigest(admittedInput)
  const body = { schema: "sf-routine-artifact-v1" as const, runRef: "run", resultRef: "result", correlationId: routine.correlationId, documentId: routine.documentId, publishedVersion: routine.publishedVersion, principalRef: routine.principalRef, projectId: routine.projectId, inputDigest, sourceRefs: [], content: { questions: ["Confirm the quoted cost"] }, createdAt: "2026-11-13T00:00:00Z" }
  const artifact = { ...body, outputDigest: routineArtifactDigest(body) }
  const execution: RoutineExecutionSnapshot = { runRef: "run", resultRef: "result", state: "completed", revision: "completion:1", outputDigest: artifact.outputDigest }
  host.resultAccess = createRoutineResultAccess({ routines: host.routines, authorize: async () => state.allowed, revalidateArtifact: async () => state.allowed,
    expectedInputDigest: async () => ({ status: "ok", value: inputDigest }),
    readExecution: async () => ({ status: "ok", value: structuredClone(execution) }),
    readArtifact: async () => ({ status: "ok", value: structuredClone(artifact) }),
  })
  return { state, host, start: { admissionRef: "admission", admissionVersion: 3, caseRef, context, host }, read: { admissionRef: "admission", runRef: "run", caseRef, context, host } }
}

test("decision run must keep the admitted correlation, input scope and native authorization", async () => {
  const value = fixture()
  value.state.run.correlationId = "another-work"
  expect(await startDecisionRoutine(value.start)).toEqual({ status: "unavailable", reason: "decision-run-unverified" })
  expect(await readDecisionRoutine(value.read)).toEqual({ status: "unavailable", reason: "decision-run-unverified" })
  value.state.run.correlationId = routine.correlationId
  value.state.admission.authorizationId = "authorization"
  expect((await readDecisionRoutine(value.read)).status).toBe("unavailable")
  value.state.run.authorizationId = "authorization"
  value.state.run.sourceRefs = [{ surface: "planner", type: "version", id: "foreign", incarnation: "foreign-inc", version: 2, fields: ["cost"], period: { start: "2027-01-01", end: "2027-01-31" }, observedAt: "2027-01-01T00:00:00Z" }]
  expect((await readDecisionRoutine(value.read)).status).toBe("unavailable")
  value.state.run.sourceRefs = []
  expect((await readDecisionRoutine(value.read)).status).toBe("ok")
})

test("decision run and result suppress output when authority or case changes at an async boundary", async () => {
  const value = fixture()
  value.host.routines.readRun = async () => { value.state.allowed = false; return { status: "ok", value: value.state.run } }
  expect(await readDecisionRoutine(value.read)).toEqual({ status: "denied", reason: "routine-result-unavailable" })
  value.state.allowed = true
  value.host.routines.run = async () => { value.state.case.version++; return { status: "ok", value: value.state.run } }
  expect(await startDecisionRoutine(value.start)).toEqual({ status: "stale", reason: "decision-case-changed" })
})

test("decision pinning detects a mutated native binding and rejects routine-result recursion before dispatch", async () => {
  const value = fixture()
  value.host.routines.run = async () => { value.state.binding.publishedVersion = "replacement"; value.state.run.publishedVersion = "replacement"; return { status: "ok", value: value.state.run } }
  expect(await startDecisionRoutine(value.start)).toEqual({ status: "unavailable", reason: "decision-run-unverified" })
  const recursive = { kind: "native", binding: { ...context.binding, caseId: caseRef.id, caseIncarnation: caseRef.incarnation, caseVersion: caseRef.version, entryMode: "routine-result" } } as TrustedDomainContext
  expect(await startDecisionRoutine({ ...value.start, context: recursive })).toEqual({ status: "denied", reason: "recursive-routine" })
  expect(value.state.starts).toBe(0)
})

test("decision failures propagate without a reviewable result and a stale admission cannot recover an old result", async () => {
  const value = fixture()
  value.host.routines.readRun = async () => ({ status: "failed", reason: "native-run-failed" })
  expect(await readDecisionRoutine(value.read)).toEqual({ status: "failed", reason: "native-run-failed" })
  value.host.routines.readAdmission = async () => ({ status: "ok", value: { ...routine, admission: "stale" } })
  expect(await readDecisionRoutine(value.read)).toEqual({ status: "stale", reason: "decision-admission-changed" })
})

test("a decision result requires the authenticated artifact reader and preserves its payload", async () => {
  const value = fixture()
  const result = await readDecisionRoutineOutput(value.read)
  expect(result).toMatchObject({ status: "ok", value: { output: { content: { questions: ["Confirm the quoted cost"] } } } })
  value.host.resultAccess = undefined
  expect(await readDecisionRoutine(value.read)).toEqual({ status: "unavailable", reason: "decision-result-reader-unavailable" })
})

test("artifact read cannot return a different run or escape a concurrent case change", async () => {
  const value = fixture()
  const read = value.host.resultAccess!.readResult
  value.host.resultAccess = { readResult: async (...args) => {
    const result = await read(...args)
    if (result.status === "ok") return { status: "ok", value: { ...result.value, run: { ...result.value.run, publishedVersion: "foreign" } } }
    return result
  } }
  expect(await readDecisionRoutine(value.read)).toEqual({ status: "stale", reason: "decision-result-changed" })
  value.host.resultAccess = { readResult: async (...args) => { const result = await read(...args); value.state.case.version++; return result } }
  expect(await readDecisionRoutine(value.read)).toEqual({ status: "stale", reason: "decision-case-changed" })
})

