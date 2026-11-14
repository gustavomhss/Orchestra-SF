import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { DecisionCase, ScenarioResult } from "../../../../product/contracts/decisions.ts"
import type { SfProductState } from "../../../../product/contracts/state.ts"
import { portfolioCandidateRef } from "../../../../product/portfolio/candidates.ts"
import { encodeCaseRef } from "../../../../product/decisions/case-port.ts"
import { createSfPortfolioPreparation } from "../../../../../../../apps/cli/src/sucafina-product/portfolio-preparation.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"

test("choice and answer confirmations require the consumed exact human intent", async () => {
  const fixture = await financialCompositionFixture()
  const { authority, business, portfolio } = fixture
  const preparation = createSfPortfolioPreparation({ authority, business, registries: portfolio, procurementEvidenceWrites: fixture.guards.procurementEvidenceWrites })
  const caseRef = { id: "case", incarnation: "case-incarnation", version: 1 }
  const payload = { caseRef, alternativeId: "alternative", alternativeVersion: 1, comparison: { scenarioRefs: ["baseline", "alternative"], criteria: ["cost"] }, criteria: ["cost"], reason: "Reviewed choice" }
  const admitted = await authority.human.admit(fixture.request("choose"), "decisions.choose", payload)
  if (admitted.status !== "ok") throw new Error(admitted.reason)
  try {
    expect(await preparation.confirmChoice(caseRef, "alternative", admitted.value)).toBe(false)
    expect(await preparation.authorizeMutation("record-choice", payload, admitted.value)).toBe(true)
    expect(await preparation.confirmChoice(caseRef, "alternative", admitted.value)).toBe(true)
    expect(await preparation.confirmChoice({ ...caseRef, version: 2 }, "alternative", admitted.value)).toBe(false)
    expect(await preparation.confirmChoice(caseRef, "other", admitted.value)).toBe(false)
    expect(await preparation.authorizeMutation("record-choice", { ...payload, reason: "Changed" }, admitted.value)).toBe(false)
    expect(await preparation.confirmAnswer(caseRef, "question", "answer", admitted.value)).toBe(false)
    // Valid intent cannot manufacture absent case/metric data.
    expect((await preparation.resolveChoiceValues(caseRef, payload.comparison, admitted.value)).status).not.toBe("ok")
    fixture.active.value = false
    expect(await preparation.confirmChoice(caseRef, "alternative", admitted.value)).toBe(false)
  } finally { authority.human.finish(admitted.value); preparation.dispose(); await fixture.dispose() }
})

test("the canonical portfolio endpoint reopens an existing atomic C08 receipt without evaluating changed candidates", async () => {
  const fixture = await financialCompositionFixture()
  const { authority, portfolio } = fixture
  try {
    const before = receiptCase()
    const originalRef = { id: before.id, incarnation: before.incarnation, version: before.version }
    const candidate = portfolioCandidateRef({ caseRef: encodeCaseRef(before), caseVersion: before.version, alternativeId: "alternative", alternativeVersion: 1 })
    const payload = { caseRef: originalRef, choiceId: "choice", request: { scope: { horizon: before.horizon, currency: "USD" }, candidateRefs: [candidate], operations: [], constraints: [], priorities: [], explorationLimit: 1 },
      selectedCandidateRefs: [candidate], combinationId: digestSfValue({ candidates: [candidate], operations: [] }), expectedEvaluationDigest: "a".repeat(64) }
    const seeded = await authority.state.transaction(fixture.request("seed"), { namespace: "cases", expectedStorageVersion: 0, targetRef: authority.creationTarget.ref,
      targetIncarnation: authority.creationTarget.incarnation, idempotencyKey: "seed", commandDigest: digestSfValue(before) }, async (state) => {
      state.cases[before.id] = before
      return { commit: true, value: before }
    })
    if (seeded.status !== "ok") throw new Error("Case fixture was not committed")
    // This represents a response already committed by the producer and lost in transit.
    const child = { caseRef: originalRef, choiceId: "choice", operations: [] }
    const next = { ...before, version: 2 }
    const committed = await authority.state.transaction(fixture.request("committed"), { namespace: "cases", domainSurface: "planner", expectedStorageVersion: seeded.storageVersion,
      targetRef: before.id, targetIncarnation: before.incarnation, idempotencyKey: "prepare-operation:prepare-changes", commandDigest: digestSfValue(child) }, async (state) => {
      state.cases[before.id] = next
      return { commit: true, value: { ...next, portfolioReplay: { parentDigest: digestSfValue(payload), child } } }
    })
    if (committed.status !== "ok") throw new Error("Receipt fixture was not committed")
    const http = portfolio.http({ origin: "https://example.test", mount: "/product" })
    const request = (body: unknown, origin = "https://example.test", surface = "planner") => new Request(`https://example.test/product/${surface}?sf=decision-prepare-portfolio`, {
      method: "POST", headers: { origin, "content-type": "application/json", "x-operation": "prepare-operation" }, body: JSON.stringify(body) })
    expect((await http(request({ ...payload, authority: "forged" }), "planner"))?.status).toBe(400)
    expect((await http(request(payload, "https://other.test"), "planner"))?.status).toBe(403)
    expect((await http(request(payload), "dashboard"))?.status).toBe(403)
    const first = await http(request(payload), "planner")
    expect(first?.status).toBe(200)
    expect(await first!.json()).toEqual({ status: "ok", value: { caseRef: { ...originalRef, version: 2 } } })
    expect((await http(request(payload), "planner"))?.status).toBe(200)
    expect((await http(request(payload, "https://example.test", "dashboard"), "dashboard"))?.status).toBe(200)
    expect((await http(request({ ...payload, choiceId: "other" }), "planner"))?.status).toBe(409)
    const state = await authority.state.read(fixture.request(), "cases", (value) => ({ version: value.cases[before.id]!.version, receipts: Object.keys(value.transactions).length }))
    expect(state).toMatchObject({ status: "ok", storageVersion: committed.storageVersion, value: { version: 2, receipts: 2 } })
    await fixture.store.transaction("dashboard", async (snapshot) => {
      const product = snapshot.data.__sfProductV1 as SfProductState
      product.cases[before.id] = { ...product.cases[before.id]!, participants: [] }
      return { commit: true, value: undefined }
    })
    expect((await http(request(payload), "planner"))?.status).toBe(403)
  } finally { await fixture.dispose() }
})

function receiptCase(): DecisionCase {
  const horizon = { start: "2026-01-01", end: "2026-12-31" }
  const coverage = { basisId: "basis", basisVersion: 1, alternativeId: "alternative", alternativeVersion: 1, currency: "USD", horizon,
    issues: ["Evidence pending"], evaluatedSourceRefs: [], coverageState: "pending" as const, entries: [], derivedMissingCategoryIds: ["service"] }
  const result: ScenarioResult = { id: "scenario", version: 1, components: [], currency: "USD", horizon, sourceRefs: [], unresolvedConditions: ["Evidence pending"], restrictions: [],
    comparisonStatus: "conditioned", costCoverage: coverage, knownSubtotal: null, total: null }
  const scenario = { baseRef: "unavailable-baseline", operations: [], assumptions: [] }
  return { id: "case", incarnation: "case-incarnation", version: 1, state: "chosen", objective: "Receipt replay fixture", horizon, currency: "USD", criteria: [{ id: "cost", description: "Cost", required: true }],
    participants: ["person"], sourceRefs: [], assumptions: [], questions: [], receipts: [], ledger: [], preparedChanges: [], costCoverageBases: [],
    alternatives: [{ id: "alternative", version: 1, title: "Conditioned", scenario, result }],
    choices: [{ id: "choice", alternativeId: "alternative", alternativeVersion: 1, basisVersion: 1, criteria: ["cost"], values: [{ criterionRef: "cost", value: null, unit: "USD", currency: "USD", horizon }],
      evidenceRefs: [], principalRef: "person", reason: "Synthetic receipt fixture", at: "2026-11-14T00:00:00Z", scenario, result, costCoverage: coverage, comparisonStatus: "conditioned",
      comparison: { baselineResultRef: "baseline", alternativeResultRef: "scenario", costCoverageRefs: [], criterionResults: [], unresolvedConditions: ["Evidence pending"], comparisonStatus: "conditioned", knownDifference: null, completeDifference: null } }] }
}
