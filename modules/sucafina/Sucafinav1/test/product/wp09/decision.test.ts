import { expect, test } from "bun:test"
import { readDecisionRoutine, startDecisionRoutine } from "../../../product/routines/decision.ts"
import type { DecisionRoutineHost } from "../../../product/routines/decision.ts"
import type { AuthorizedCaseProjection } from "../../../product/contracts/business-context.ts"
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
