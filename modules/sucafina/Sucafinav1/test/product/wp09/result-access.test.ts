import { expect, test } from "bun:test"
import { createRoutineResultAccess, routineArtifactDigest, routineInputDigest } from "../../../product/routines/result-access.ts"
import type { RoutineArtifact, RoutineExecutionSnapshot } from "../../../product/routines/result-access.ts"
import type { RoutineResult } from "../../../product/contracts/context.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

// Native run/artifact I/O is an explicit boundary fixture, not a Relay execution witness.
function fixture() {
  const context = { kind: "ui", binding: { principalRef: "person", projectId: "project" } } as TrustedDomainContext
  const run: RoutineResult = { documentId: "review-recipe", publishedVersion: "v1", principalRef: "person", projectId: "project",
    admission: "admitted", admissionRef: "admission", admissionVersion: 1, runRef: "child-session", resultRef: "immutable-output",
    correlationId: "native-correlation", sourceRefs: [], pending: [] }
  const body: Omit<RoutineArtifact, "outputDigest"> = { schema: "sf-routine-artifact-v1", runRef: "child-session", resultRef: "immutable-output",
    correlationId: run.correlationId, documentId: run.documentId, publishedVersion: run.publishedVersion,
    principalRef: run.principalRef, projectId: run.projectId, inputDigest: routineInputDigest({ publishedRecipeRef: run.documentId, publishedVersion: run.publishedVersion,
      planRevisionId: "plan", writeScope: [], inputRefs: ["source"], parameters: { period: { start: "2027-01-01", end: "2027-01-31" } },
      principalRef: run.principalRef, projectId: run.projectId, caseRef: { id: "case", incarnation: "inc", version: 1 } }), sourceRefs: [],
    content: { facts: [{ label: "Pending review", count: 3 }], narrative: null }, createdAt: "2026-11-13T12:00:00Z" }
  const execution: RoutineExecutionSnapshot = { runRef: "child-session", resultRef: "immutable-output", state: "completed", revision: "terminal-1", outputDigest: routineArtifactDigest(body) }
  const state = { run, execution, output: { ...body, outputDigest: routineArtifactDigest(body) }, allowed: true, current: true, reads: 0 }
  const dependencies: Parameters<typeof createRoutineResultAccess>[0] = { routines: { readRun: async () => ({ status: "ok", value: state.run }) },
    expectedInputDigest: async () => ({ status: "ok", value: body.inputDigest }),
    readExecution: async () => ({ status: "ok", value: state.execution }),
    authorize: async () => state.allowed, revalidateArtifact: async () => state.current,
    readArtifact: async () => { state.reads++; return { status: "ok", value: state.output } } }
  const access = createRoutineResultAccess(dependencies)
  return { context, state, access, dependencies }
}

test("immutable factual result is delivered without model narrative and does not share mutable storage", async () => {
  const f = fixture()
  const result = await f.access.readResult("child-session", f.context)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") throw new Error("Expected authorized result")
  expect(result.value.output.content).toEqual({ facts: [{ label: "Pending review", count: 3 }], narrative: null })
  expect(result.value.execution.outputDigest).toBe(result.value.output.outputDigest)
  result.value.output.content = { corrupted: true }
  expect((await f.access.readResult("child-session", f.context))).toMatchObject({ status: "ok", value: { output: { content: { narrative: null } } } })
})

test("result reference alone never grants access; forged identity and changed content are refused", async () => {
  const f = fixture()
  expect((await f.access.readResult("child-session", { ...f.context, binding: { ...f.context.binding, principalRef: "other" } } as TrustedDomainContext)).status).toBe("denied")
  expect(f.state.reads).toBe(0)
  f.state.output = { ...f.state.output, content: { private: "substituted" } }
  expect(await f.access.readResult("child-session", f.context)).toEqual({ status: "unavailable", reason: "routine-artifact-unverified" })
  f.state.output = { ...f.state.output, resultRef: "other-result" }
  expect((await f.access.readResult("child-session", f.context)).status).toBe("unavailable")
})

test("revocation during file recovery suppresses all content and retry cannot resurrect it", async () => {
  const f = fixture()
  const access = createRoutineResultAccess({ ...f.dependencies,
    readArtifact: async () => { f.state.allowed = false; return { status: "ok", value: f.state.output } } })
  expect(await access.readResult("child-session", f.context)).toEqual({ status: "denied", reason: "routine-result-unavailable" })
  expect(await access.readResult("child-session", f.context)).toEqual({ status: "denied", reason: "routine-result-unavailable" })
})

test("a changed native result pin during recovery is stale and absent artifacts remain pending", async () => {
  const f = fixture()
  const access = createRoutineResultAccess({ ...f.dependencies,
    readArtifact: async () => { f.state.run = { ...f.state.run, resultRef: "new-result" }; return { status: "ok", value: f.state.output } } })
  expect(await access.readResult("child-session", f.context)).toEqual({ status: "stale", reason: "routine-result-changed" })
  const { resultRef: _completedResult, ...pending } = f.state.run
  f.state.run = pending
  expect(await access.readResult("child-session", f.context)).toEqual({ status: "needs-input", reason: "result-not-ready" })
})

test("a substituted artifact with a recomputed self hash still fails the immutable terminal pin", async () => {
  const f = fixture()
  const { outputDigest: _discarded, ...body } = f.state.output
  const replacement = { ...body, content: { private: "substituted" } }
  f.state.output = { ...replacement, outputDigest: routineArtifactDigest(replacement) }
  expect(await f.access.readResult("child-session", f.context)).toEqual({ status: "unavailable", reason: "routine-artifact-unverified" })
})

test("failed and cancelled native executions never open an artifact even with a result reference", async () => {
  for (const state of ["failed", "cancelled"] as const) {
    const f = fixture()
    f.state.execution = { ...f.state.execution, state }
    expect(await f.access.readResult("child-session", f.context)).toEqual({ status: "denied", reason: "routine-result-unavailable" })
    expect(f.state.reads).toBe(0)
  }
})

test("terminal state changes during artifact recovery invalidate the whole return", async () => {
  const f = fixture()
  const access = createRoutineResultAccess({ ...f.dependencies, readArtifact: async () => {
    f.state.execution = { ...f.state.execution, state: "cancelled", revision: "terminal-2" }
    return { status: "ok", value: f.state.output }
  } })
  expect(await access.readResult("child-session", f.context)).toEqual({ status: "stale", reason: "routine-execution-changed" })
})

test("input resolver callbacks cannot mutate the run snapshot returned with the artifact", async () => {
  const f = fixture()
  const access = createRoutineResultAccess({ ...f.dependencies, expectedInputDigest: async (run) => {
    run.resultRef = "substituted-by-reader"
    run.correlationId = "another-correlation"
    return { status: "ok", value: f.state.output.inputDigest }
  } })
  expect(await access.readResult("child-session", f.context)).toMatchObject({ status: "ok", value: {
    run: { resultRef: "immutable-output", correlationId: "native-correlation" }, output: { resultRef: "immutable-output", correlationId: "native-correlation" },
  } })
})
