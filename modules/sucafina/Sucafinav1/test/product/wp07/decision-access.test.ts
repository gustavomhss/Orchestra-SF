import { expect, test } from "bun:test"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createReviewDecisionAccess } from "../../../product/reviews/decision-access.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { testPersistence } from "../../fixture/persistence.ts"

test("decision access reopens actual results and denies changed evidence or mismatched bytes", async () => {
  const persistence = testPersistence()
  const state = createSfProductState({ persistence: persistence.persistence, createId: () => "state", resolveTarget: async () => ({ incarnation: "inc" }), authorize: async () => ({ principalRef: "principal", policyVersion: "policy", accessRevision: "access" }) })
  const context = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "principal", requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedDomainContext
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const caseRef = { id: "case", incarnation: "inc", version: 1 }
  const decisionCase = { ...caseRef, state: "draft", objective: "decision", currency: "USD", horizon: period, criteria: [], participants: ["principal"], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] } as const
  const request = new Request("https://example.test")
  await state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "seed", commandDigest: "a".repeat(64), targetRef: "case", targetIncarnation: "inc" }, async (staged) => { staged.cases.case = decisionCase; return { commit: true, value: true } })
  const access = { sources: true, count: 0 }
  const results = createSfDecisionResultStore({ state, host: { requestFor: () => request, revalidate: async () => true }, authorizeCase: async () => true, verifySources: async () => access.sources, createId: () => `result-${++access.count}`, now: () => "2026-11-13T00:00:00Z" })
  const scenario = { id: "scenario", version: 1, components: [], currency: "USD", horizon: period, sourceRefs: [], unresolvedConditions: [], restrictions: [], comparisonStatus: "conditioned", knownSubtotal: 100, total: null, costCoverage: { basisId: "basis", basisVersion: 1, alternativeId: "alternative", alternativeVersion: 1, currency: "USD", horizon: period, issues: [], evaluatedSourceRefs: [], entries: [], derivedMissingCategoryIds: ["training"], coverageState: "pending" } } as const
  const storedScenario = await results.write({ kind: "scenario", result: scenario, caseRef, requestDigest: "b".repeat(64), sourceRefs: [], idempotencyKey: "scenario" }, context)
  if (storedScenario.status !== "ok") throw new Error("scenario unavailable")
  const comparison = { baselineResultRef: "baseline", alternativeResultRef: storedScenario.value.resultRef, costCoverageRefs: ["coverage"], criterionResults: [], unresolvedConditions: ["training"], comparisonStatus: "conditioned", knownDifference: 20, completeDifference: null } as const
  const storedComparison = await results.write({ kind: "comparison", result: comparison, caseRef, requestDigest: "c".repeat(64), sourceRefs: [], idempotencyKey: "comparison" }, context)
  if (storedComparison.status !== "ok") throw new Error("comparison unavailable")
  const selected = { kind: "scenario", scenarioResultRef: storedScenario.value.resultRef, scenario, comparisonRef: storedComparison.value.resultRef, comparison } as const
  const authorize = createReviewDecisionAccess({ host: { revalidate: async () => true }, results, sensitivity: { read: async () => ({ status: "unavailable", reason: "unused" }) } })
  expect(await authorize(context, [selected])).toBe(true)
  expect(await authorize(context, [{ ...selected, scenario: { ...scenario, knownSubtotal: 999 } }])).toBe(false)
  access.sources = false
  expect(await authorize(context, [selected])).toBe(false)
})
