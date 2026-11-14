import { expect, test } from "bun:test"
import { contribution, routineStatus, scenario, workList, workState } from "../../../product/ui/components.ts"
import type { ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { ContributionEnvelope } from "../../../product/contracts/resident-ai.ts"

test("conditioned scenario shows known subtotal and missing category without a total", () => {
  const result: ScenarioResult = {
    id: "alternative", version: 1, components: [], currency: "USD", horizon: { start: "2027-01", end: "2027-12" }, sourceRefs: [],
    unresolvedConditions: [], restrictions: [], comparisonStatus: "conditioned", knownSubtotal: 210000, total: null,
    costCoverage: { basisId: "basis", basisVersion: 1, alternativeId: "alternative", alternativeVersion: 1, currency: "USD", horizon: { start: "2027-01", end: "2027-12" }, issues: [], evaluatedSourceRefs: [], entries: [], derivedMissingCategoryIds: ["training"], coverageState: "pending" },
  }
  const html = scenario(result)
  expect(html).toContain("Known subtotal: 210000 USD")
  expect(html).toContain("training")
  expect(html).not.toContain("Total:")
  expect(html).not.toContain("Complete comparison")
})

test("status messages escape user-supplied details", () => {
  expect(workState("error", "<script>bad</script>")).toContain("&lt;script&gt;bad&lt;/script&gt;")
})

test("work list displays only supplied authorized items and handles an empty selection", () => {
  expect(workList({ items: [] })).toContain("No work is currently assigned")
  const html = workList({ items: [{ actionRef: "<review>", sourceRefs: [], state: "pending", ownerRef: "person" }] })
  expect(html).toContain("&lt;review&gt;")
  expect(html).toContain("pending")
  expect(html).not.toContain("<review>")
})

test("routine status does not claim admission for a pending request", () => {
  const routine = { documentId: "recipe", publishedVersion: "1", principalRef: "person", projectId: "project", correlationId: "correlation", sourceRefs: [], pending: ["Review required"] }
  expect(routineStatus({ ...routine, admission: "needs-review" })).toContain("Review required")
  expect(routineStatus({ ...routine, admission: "needs-review" })).not.toContain("Admission ")
  expect(routineStatus({ ...routine, admission: "admitted", admissionRef: "admission", admissionVersion: 2 })).toContain("Admission admission · version 2")
})

test("contribution renders a persisted question and retains explicit stale state", () => {
  const base = {
    id: "output", caseRef: { id: "case", version: 1, incarnation: "first" }, schemaVersion: "sf-contribution-v1" as const,
    evidenceRefs: [], accessRevision: "access", createdAt: "2027-01-01", outputDigest: "digest",
    runProvenance: { runId: "run", nativeSessionId: "session", profileId: "sf_maestro" as const, profileVersion: "1", profileDigest: "profile", skillId: "skill", skillVersion: "1", sourceDigest: "source", instructionsDigest: "instructions", loadedMessageId: "message", loadedAt: "2027-01-01", manifestDigest: "manifest", actualModel: "model", contextFingerprint: "context" },
  }
  const ready: ContributionEnvelope = { ...base, kind: "QuestionProposal", state: "ready", payload: { caseRef: "case", question: "What changed?", evidenceRefs: [], expectedCaseVersion: 1 } }
  expect(contribution(ready)).toContain("What changed?")
  expect(contribution(ready)).toContain("Recipient not selected")
  const stale: ContributionEnvelope = { ...base, kind: "QuestionProposal", state: "stale", reason: "Base changed" }
  expect(contribution(stale)).toContain("stale · Base changed")
  expect(contribution(stale)).not.toContain("Ready for review")
  const compared: ContributionEnvelope = { ...base, kind: "ScenarioComparison", state: "ready", payload: {
    baselineResultRef: "base", alternativeResultRef: "alternative", costCoverageRefs: ["coverage-base", "<coverage-alternative>"],
    criterionResults: [], unresolvedConditions: ["Training is missing"], comparisonStatus: "conditioned", knownDifference: 30000, completeDifference: null,
  } }
  const html = contribution(compared)
  expect(html).toContain("Known difference: 30000")
  expect(html).toContain("coverage-base")
  expect(html).toContain("&lt;coverage-alternative&gt;")
  expect(html).toContain("Review the unresolved coverage")
  expect(html).toContain("Training is missing")
  expect(html).not.toContain("Total:")
  const commercial = { ...base, kind: "CommercialComparison" as const, state: "ready" as const, payload: {
    requestRef: "request", requestVersion: 1, currency: "USD", proposals: [{ proposalRef: "offer", eligible: true, score: null, convertedAmount: 0, evidenceRefs: [], issues: [],
      components: { technical: 0, price: null, commercial: null, overall: null },
      money: { originalAmount: 0, originalCurrency: "USD", baseCurrency: "USD", fxRate: null, fxSource: null },
    }], ranking: [], conditions: [], sourceRefs: [],
    weights: { technical: null, commercial: null, technicalCriteria: [], commercialCriteria: [] },
    selection: { proposalRef: "offer", reason: "<human reason>" },
  } }
  const commercialHtml = contribution(commercial)
  expect(commercialHtml).toContain("Technical: 0")
  expect(commercialHtml).toContain("Original amount: 0")
  expect(commercialHtml).toContain("&lt;human reason&gt;")
  expect(commercialHtml).not.toContain("Price: 0")
  const malformed = { ...commercial, payload: { ...commercial.payload, weights: { invalid: true } } }
  expect(contribution(malformed)).toContain("Weights not supplied")
})

