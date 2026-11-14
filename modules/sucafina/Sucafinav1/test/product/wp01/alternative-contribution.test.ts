import { expect, test } from "bun:test"
import { contribution } from "../../../product/ui/components.ts"
import { digestSfContribution } from "../../../product/contracts/canonical.ts"
import { decodeSfContributionEnvelope, decodeSfContributionOutput } from "../../../product/contracts/schema-admission.ts"
import type { AlternativeDraft } from "../../../product/contracts/outputs.ts"
import type { ContributionEnvelope } from "../../../product/contracts/resident-ai.ts"

// Rendering inputs are structurally admitted with the published contract. This does not
// stand in for the separate native provenance, C10 evidence or human promotion gates.
function alternative(knownSubtotal: number | null): AlternativeDraft {
  const horizon = { start: "2027-01-01", end: "2027-12-31" }
  return {
    caseRef: "case:decision:incarnation", coverageRef: "<coverage-selector>", domainApplied: false,
    costCoverageBasis: { id: "basis", version: 1, decisionType: "operational", categoryIds: ["other_relevant_costs"], additionalCategoryIds: [], sourceRefs: [] },
    proposal: { id: "alternative", version: 1, title: "<script>Proposed operating change</script>", scenario: { baseRef: "base-selector", operations: [], assumptions: [] },
      result: { id: "result", version: 1, currency: "USD", horizon, sourceRefs: [], components: [], restrictions: [],
        comparisonStatus: "conditioned", knownSubtotal, total: null, unresolvedConditions: ["<Training impact is not assessed>"],
        costCoverage: { basisId: "basis", basisVersion: 1, alternativeId: "alternative", alternativeVersion: 1, currency: "USD", horizon,
          issues: [], evaluatedSourceRefs: [], coverageState: "pending", derivedMissingCategoryIds: ["other_relevant_costs"],
          entries: [{ status: "pending", categoryId: "other_relevant_costs", reason: "Operational impact has not been assessed" }] } } },
  }
}

function envelope(payload: AlternativeDraft): Extract<ContributionEnvelope, { kind: "AlternativeDraft"; state: "ready" }> {
  const candidate: Extract<ContributionEnvelope, { kind: "AlternativeDraft"; state: "ready" }> = {
    id: "alternative-output", caseRef: { id: "decision", incarnation: "incarnation", version: 1 }, kind: "AlternativeDraft", state: "ready", payload,
    schemaVersion: "sf-contribution-v1", evidenceRefs: [], accessRevision: "current-access", createdAt: "2027-01-01T00:00:00Z", outputDigest: "0".repeat(64),
    runProvenance: { runId: "run", nativeSessionId: "session", profileId: "sf_maestro", profileVersion: "1", profileDigest: "a".repeat(64),
      skillId: "scenario-skill", skillVersion: "1", sourceDigest: "b".repeat(64), instructionsDigest: "c".repeat(64), loadedMessageId: "message", loadedAt: "2027-01-01T00:00:00Z",
      manifestDigest: "d".repeat(64), actualModel: "provider/model", contextFingerprint: "e".repeat(64) },
  }
  return { ...candidate, outputDigest: digestSfContribution(candidate) }
}

for (const subtotal of [null, 0]) test(`typed AlternativeDraft renders a readonly conditioned proposal with subtotal ${subtotal}`, () => {
  const payload = alternative(subtotal)
  const admittedPayload = decodeSfContributionOutput("AlternativeDraft", payload)
  expect(admittedPayload.ok).toBe(true)
  if (!admittedPayload.ok) throw new Error("Published AlternativeDraft output schema is not available")
  const decoded = decodeSfContributionEnvelope(envelope(admittedPayload.value))
  expect(decoded.ok).toBe(true)
  if (!decoded.ok) throw new Error("Published AlternativeDraft envelope schema is not available")
  const before = structuredClone(decoded.value)
  const html = contribution(decoded.value)
  expect(html).toContain("Alternative proposal")
  expect(html).toContain("Proposal only; not applied.")
  expect(html).toContain(`Known subtotal: ${subtotal === null ? "Unavailable" : "0"} USD`)
  expect(html).toContain("2027-01-01 – 2027-12-31")
  expect(html).toContain("&lt;script&gt;Proposed operating change&lt;/script&gt;")
  expect(html).toContain("&lt;coverage-selector&gt;")
  expect(html).toContain("&lt;Training impact is not assessed&gt;")
  expect(html).toContain("Review the unresolved coverage")
  expect(html).not.toContain("Total:")
  expect(html).not.toMatch(/<(?:button|form|input|script)\b/)
  expect(decoded.value).toEqual(before)
})

test("a stale AlternativeDraft renders its state without exposing the former proposal", () => {
  const ready = envelope(alternative(0))
  const { payload: _payload, ...identity } = ready
  const stale: ContributionEnvelope = { ...identity, state: "stale", reason: "The authorized scenario changed" }
  const html = contribution(stale)
  expect(html).toContain("stale · The authorized scenario changed")
  expect(html).not.toContain("Proposed operating change")
  expect(html).not.toContain("Known subtotal")
  expect(html).not.toMatch(/<(?:button|form|input)\b/)
})
