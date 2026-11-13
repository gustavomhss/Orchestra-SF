import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createDecisionCasePort } from "../../../product/decisions/case-port.ts"
import { createStoredPlannerScenarioHost } from "../../../product/planner/stored-scenarios.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createPlannerResultPersistence } from "../../../product/planner/persistence.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import type { ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"

test("scenario and comparison results use the real case-scoped result store", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-planner-results-"))
  const db = await openLocalStore(directory)
  try {
    const context = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "principal", requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
    const state = createSfProductState({ persistence: db, createId: () => "state", resolveTarget: async () => ({ incarnation: "inc" }), authorize: async () => ({ principalRef: "principal", policyVersion: "policy", accessRevision: "access" }) })
    const horizon = { start: "2027-01-01", end: "2027-12-31" }
    const decision = { id: "case", incarnation: "inc", version: 1, state: "draft", objective: "decision", currency: "USD", horizon, criteria: [], participants: ["principal"], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] } as const
    const source = new Request("https://example.test")
    await state.transaction(source, { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "seed", commandDigest: "a".repeat(64), targetRef: "case", targetIncarnation: "inc" }, async (staged) => { staged.cases.case = decision; return { commit: true, value: true } })
    const access = { allowed: true, ids: 0 }
    const store = createSfDecisionResultStore({ state, host: { requestFor: () => source, revalidate: async () => access.allowed }, authorizeCase: async () => access.allowed, verifySources: async () => access.allowed, createId: () => `result-${++access.ids}`, now: () => "2026-11-13T00:00:00Z" })
    const persist = createPlannerResultPersistence({ store, resolveCase: async () => ({ status: "ok", value: { id: "case", incarnation: "inc", version: 1 } }) })
    const request = { baseRef: "source", operations: [], assumptions: [] }
    const scenario: ScenarioResult = { id: "preview", version: 0, components: [], currency: "USD", horizon, sourceRefs: [], costCoverage: { basisId: "basis", basisVersion: 1, alternativeId: "alternative", alternativeVersion: 1, currency: "USD", horizon, issues: ["coverage-pending"], evaluatedSourceRefs: [], coverageState: "pending", derivedMissingCategoryIds: [], entries: [] }, comparisonStatus: "conditioned", knownSubtotal: null, total: null, unresolvedConditions: ["coverage-pending"], restrictions: ["preview-not-applied"] }
    const first = await persist({ kind: "scenario", request, result: scenario }, "call-1", context)
    expect(first.status).toBe("ok")
    if (first.status !== "ok") return
    expect(await persist({ kind: "scenario", request, result: scenario }, "call-1", context)).toEqual(first)
    const cases = createDecisionCasePort({ state, host: { requestFor: () => source, revalidate: async () => access.allowed }, creationTarget: { ref: "case", incarnation: "inc" }, operationIdentity: () => "op", authorizeCase: async () => access.allowed, evidence: { resolve: async () => { throw new Error("unexpected evidence lookup") }, context: async () => [], recall: async () => [], emitFromLedger: async () => { throw new Error("unused") } }, createId: () => "id", now: () => "2026-11-13T00:00:00Z" })
    const scenarios = createStoredPlannerScenarioHost({ store, cases, planner: { compareForecast: async () => ({ status: "unavailable", reason: "unexpected" }) }, coverageRefFor: () => "coverage" })
    expect(await scenarios.resolve(first.value.resultRef, context)).toMatchObject({ status: "unavailable", reason: "scenario-not-current-case-alternative" })
    const second = await persist({ kind: "scenario", request, result: scenario }, "call-2", context)
    expect(second.status).toBe("ok")
    if (second.status !== "ok") return
    const comparison = { baselineResultRef: first.value.resultRef, alternativeResultRef: second.value.resultRef, costCoverageRefs: [], criterionResults: [], unresolvedConditions: ["coverage-pending"], comparisonStatus: "conditioned" as const, knownDifference: null, completeDifference: null }
    expect(await persist({ kind: "comparison", request: { scenarioRefs: [first.value.resultRef, second.value.resultRef], criteria: [] }, result: comparison }, "call-3", context)).toMatchObject({ status: "unavailable", reason: "scenario-validation-unavailable" })
    access.allowed = false
    expect(await persist({ kind: "scenario", request, result: scenario }, "call-4", context)).toMatchObject({ status: "denied" })
  } finally { await db.dispose(); await rm(directory, { recursive: true, force: true }) }
})
