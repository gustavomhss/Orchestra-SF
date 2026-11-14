import { expect, test } from "bun:test"
import { digestSfEvidenceRef, digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../../product/contracts/business-context.ts"
import type { DecisionCase, ScenarioResult } from "../../../../product/contracts/decisions.ts"
import type { SfProductState, SfStoredDecisionResult } from "../../../../product/contracts/state.ts"
import { createSfReviewCalculationHistory } from "../../../../../../../apps/cli/src/sucafina-product/review-calculation-history.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"

test("historical calculation proof requires the original C08 run/input binding and current membership in the same case incarnation", async () => {
  const fixture = await financialCompositionFixture()
  const { authority, business } = fixture
  const call = await fixture.read()
  try {
    const period = { start: "2026-01-01", end: "2026-12-31" }
    const source = await business.dashboardRecords.issue({ page: "OPEX Detail", recordType: "opexOwners", recordId: "owner", fields: ["budget"], period }, call)
    if (source.status !== "ok") throw new Error(source.reason)
    const request = { baseRef: source.value.refId, operations: [], assumptions: [] }
    const originalCase = { id: "case", incarnation: "case-incarnation", version: 1 }
    const decision: DecisionCase = { ...originalCase, version: 2, state: "draft", objective: "Historical proof fixture", horizon: period, currency: "USD", participants: ["person"], criteria: [],
      sourceRefs: [source.value], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const result: ScenarioResult = { id: "scenario", version: 1, components: [], currency: "USD", horizon: period, sourceRefs: [source.value], restrictions: [], unresolvedConditions: ["Cost evidence pending"],
      comparisonStatus: "conditioned", knownSubtotal: null, total: null, costCoverage: { basisId: "basis", basisVersion: 1, alternativeId: "alternative", alternativeVersion: 1,
        currency: "USD", horizon: period, issues: ["Cost evidence pending"], evaluatedSourceRefs: [source.value], entries: [{ status: "pending", categoryId: "service", reason: "Missing input" }],
        coverageState: "pending", derivedMissingCategoryIds: ["service"] } }
    const stored: SfStoredDecisionResult = { schema: "sf-decision-result-v1", kind: "scenario", resultRef: "decision-result:run", caseRef: originalCase,
      principalRef: call.binding.principalRef, accessRevision: call.binding.accessRevision, policyVersion: call.binding.policyVersion,
      requestDigest: digestSfValue(request), resultDigest: digestSfValue(result), sourceRefs: [source.value], createdAt: fixture.at, result }
    const seed = await authority.state.transaction(fixture.request("seed-history-run"), { namespace: "cases", expectedStorageVersion: 0, targetRef: authority.creationTarget.ref,
      targetIncarnation: authority.creationTarget.incarnation, idempotencyKey: "seed-history-run", commandDigest: digestSfValue(stored) }, async (state) => {
      state.cases[decision.id] = decision
      state.decisionResults = { [stored.resultRef]: stored }
      return { commit: true, value: true }
    })
    if (seed.status !== "ok") throw new Error("Run fixture not committed")
    const material = { schema: "sf-scenario-request-v1", resultRef: stored.resultRef, caseRef: originalCase, request,
      requestDigest: stored.requestDigest, resultDigest: stored.resultDigest, engineVersion: "planner-runtime-v1" }
    const key = `sf:proposal-coverage:scenario-request:${digestSfValue(stored.resultRef)}`
    const write = async (state: SfProductState) => { state.preferences[key] = { ...material, recordDigest: digestSfValue(material) }; return { commit: true, value: true } }
    const version = await authority.state.read(fixture.request(), "preferences", () => true)
    if (version.status !== "ok") throw new Error("Preferences not initialized")
    fixture.guards.proposalCoverageWrites.add(write)
    const saved = await authority.state.transaction(fixture.request("seed-request"), { namespace: "preferences", expectedStorageVersion: version.storageVersion, targetRef: decision.id,
      targetIncarnation: decision.incarnation, idempotencyKey: "seed-request", commandDigest: digestSfValue(material) }, write)
    fixture.guards.proposalCoverageWrites.delete(write)
    expect(saved.status).toBe("ok")
    const unsigned: Extract<BusinessEvidenceRef, { kind: "calculation" }> = { schema: "sf-evidence-v1", kind: "calculation", refId: `planner-calculation:${encodeURIComponent(stored.resultRef)}`,
      installationId: call.binding.installationId, projectId: call.binding.projectId, refDigest: "", evidenceLevel: "proposal",
      target: { calculationId: "planner:scenario", runId: stored.resultRef, engineVersion: "planner-runtime-v1", inputDigest: stored.requestDigest,
        resultDigest: stored.resultDigest, sourceRefs: [source.value], period, currency: "USD" } }
    const ref = { ...unsigned, refDigest: digestSfEvidenceRef(unsigned) }
    const proof = createSfReviewCalculationHistory({ authority, authorizeCase: business.authorizeCase })
    expect(await proof(ref, call)).toMatch(/^[a-f0-9]{64}$/)
    const wrongInput = { ...ref, target: { ...ref.target, inputDigest: "b".repeat(64) } }
    expect(await proof({ ...wrongInput, refDigest: digestSfEvidenceRef(wrongInput) }, call)).toBeUndefined()
    await fixture.store.transaction("dashboard", async (snapshot) => {
      const state = snapshot.data.__sfProductV1 as SfProductState
      state.cases[decision.id] = { ...decision, participants: [] }
      return { commit: true, value: undefined }
    })
    expect(await proof(ref, call)).toBeUndefined()
    await fixture.store.transaction("dashboard", async (snapshot) => {
      const state = snapshot.data.__sfProductV1 as SfProductState
      state.cases[decision.id] = { ...decision, incarnation: "replacement" }
      return { commit: true, value: undefined }
    })
    expect(await proof(ref, call)).toBeUndefined()
  } finally { authority.ui.finish(call); await fixture.dispose() }
})
