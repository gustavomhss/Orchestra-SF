import { expect, test } from "bun:test"
import { correlateAm06 } from "./correlate.ts"
import type { RoutineResult } from "../../../../product/contracts/context.ts"

/**
 * These are correlation-failure witnesses only. Real C07 authorization, Relay
 * completion, actual model inference and UI recovery must come from hosted runs.
 */
const admission: RoutineResult = {
  admission: "admitted", admissionRef: "reservation-synthetic", admissionVersion: 3,
  documentId: "published-recipe-synthetic", publishedVersion: "v1",
  principalRef: "principal-synthetic", projectId: "project-synthetic",
  correlationId: "authorization-synthetic", authorizationId: "authorization-synthetic",
  armRef: "arm-synthetic", childSessionId: "child-synthetic", sourceRefs: [], pending: [],
}

test("AM06 remains NOT_RUN when a source commit exists but the native witnesses do not", () => {
  const observation = correlateAm06({ candidateSha: "a".repeat(40) })
  expect(observation.state).toBe("NOT_RUN")
  expect(observation.missing).toContain("admission")
  expect(observation.missing).toContain("opened")
  expect(observation.missing).toContain("analysisRun")
  expect(observation.missing).toContain("brief")
  expect(observation.missing).toContain("consumption")
  expect(observation.missing).toContain("capabilityCalls")
})

test("cross-stage admission version, publication pin and native child cannot be recombined", () => {
  const pin = { documentId: admission.documentId, publishedVersion: "v2", planRevisionId: "plan-synthetic" }
  const status: RoutineResult = { ...admission, admissionVersion: 4, runRef: "wrong-child", resultRef: "result-synthetic" }
  const observation = correlateAm06({ candidateSha: "b".repeat(40), publication: pin, admission, status })
  expect(observation.state).toBe("REJECTED")
  expect(observation.mismatches).toContain("publication-version-mismatch")
  expect(observation.mismatches).toContain("admission-status-identity-mismatch")
  expect(observation.mismatches).toContain("native-child-run-mismatch")
})

test("a catalog shape or empty tool transcript never satisfies the five bound C07 operation calls", () => {
  const observation = correlateAm06({ publication: {
    documentId: admission.documentId, publishedVersion: admission.publishedVersion, planRevisionId: "plan-synthetic",
  }, admission, capabilityCalls: [] })
  expect(observation.state).toBe("REJECTED")
  expect(observation.mismatches).toContain("missing-or-duplicated-operation:sf_routine_catalog")
  expect(observation.mismatches).toContain("missing-or-duplicated-operation:sf_routine_prepare")
  expect(observation.mismatches).toContain("missing-or-duplicated-operation:sf_routine_run")
  expect(observation.mismatches).toContain("missing-or-duplicated-operation:sf_routine_status")
  expect(observation.mismatches).toContain("missing-or-duplicated-operation:sf_routine_result")
})
