import { expect, test } from "bun:test"
import type { AuthorizedCaseProjection, BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { ChoiceRecord, ScenarioResult } from "../../../product/contracts/decisions.ts"
import { decisionChoiceForm, decisionChoiceScript } from "../../../product/ui/decision-choice.ts"

test("choice initialization parses with the exact embedded retention and receipt helpers", () => {
  // This only parses the emitted browser program; it is not a simulated successful user journey.
  expect(() => new Bun.Transpiler({ loader: "js" }).transformSync(decisionChoiceScript)).not.toThrow()
})

test("authorized choice context preserves the original condition and snapshots after current source values change", () => {
  const item = projection()
  const old = structuredClone(item.case.choices[0]!)
  const current: AuthorizedCaseProjection = { ...item, case: { ...item.case, version: 9, alternatives: item.case.alternatives.map((alternative) => ({ ...alternative, version: 4, result: { ...alternative.result, knownSubtotal: 9000 } })) } }
  const before = structuredClone(current)
  const html = decisionChoiceForm(current)
  const context = embedded(html, "data-decision-choice")
  expect(context.caseRef).toEqual({ id: "case", incarnation: "incarnation", version: 9 })
  expect(context.authority.principalRef).toBe("person")
  expect(context.choices).toEqual([old])
  expect(context.choices[0]?.result.knownSubtotal).toBe(0)
  expect(context.choices[0]?.result.total).toBeNull()
  expect(context.choices[0]?.result.costCoverage.derivedMissingCategoryIds).toEqual(["training"])
  expect(context.choices[0]?.scenario.assumptions.map((assumption) => assumption.value)).toEqual([null, 0])
  expect(current).toEqual(before)
  expect(html).toContain("Financial approval remains a separate explicit action.")
})

test("a recorded choice without operations does not invent an Apply route or a prepared change", () => {
  const item = projection()
  const before = structuredClone(item)
  const html = decisionChoiceForm(item)
  expect(html).toContain('<button type="submit" disabled>Prepare changes from this choice</button>')
  expect(html).toContain("This recorded choice contains no executable operations. No changes were prepared.")
  expect(embedded(html, "data-decision-prepare").choices[0]?.scenario.operations).toEqual([])
  expect(item).toEqual(before)
  expect(html).not.toContain("Apply reviewed change")
})

test("numeric comparison rule starts without an inferred amount and uses buttons inside the existing choice form", () => {
  const html = decisionChoiceForm(projection())
  expect(html).toContain('<fieldset data-numeric-rule hidden>')
  expect(html).toContain('<button type="button" data-numeric-load>Load comparison rule</button>')
  expect(html).toContain('<button type="button" data-numeric-save disabled>Save comparison rule</button>')
  expect(html).toContain('<input data-numeric-value type="number" step="any" disabled>')
  expect(html).toContain('<select data-numeric-evidence multiple disabled></select>')
  expect(html.match(/<form\b/g)).toHaveLength(2)
  expect(html.match(/<\/form>/g)).toHaveLength(2)
  expect(html).toContain("Missing costs remain unresolved, and saving a rule does not grant financial approval.")
})

test("preparation uses the exact authorized historical operations and safely escapes its labels", () => {
  const item = projection()
  const original = item.case.choices[0]!
  const reason = '</option><script>throw "not executed"</script>'
  const choice: ChoiceRecord = { ...original, reason, scenario: { ...original.scenario, operations: [{ kind: "replace", targetRef: "authorized-target", amount: 0, currency: "USD", period: original.result.horizon }] } }
  const current = { ...item, case: { ...item.case, alternatives: [], choices: [choice] } }
  const html = decisionChoiceForm(current)
  const prepared = embedded(html, "data-decision-prepare")
  expect(prepared.choices).toEqual([choice])
  expect(prepared.choices[0]?.scenario.operations).toEqual(choice.scenario.operations)
  expect(html).toContain('<button type="submit">Prepare changes from this choice</button>')
  expect(html).not.toContain('<script>throw')
  expect(html).toContain('&lt;/option&gt;&lt;script&gt;throw &quot;not executed&quot;&lt;/script&gt;')
  expect(current.case.preparedChanges).toEqual([])
})

function projection(): AuthorizedCaseProjection {
  const horizon = { start: "2027-01-01", end: "2027-12-31" }
  const evidence: BusinessEvidenceRef = { schema: "sf-evidence-v1", kind: "record", installationId: "installation", projectId: "project", refId: "source", refDigest: "a".repeat(64), evidenceLevel: "observed", target: { surface: "planner", recordType: "planner-version", recordId: "forecast", incarnation: "forecast-inc", version: 3, fields: ["amount"], period: horizon, projectionDigest: "b".repeat(64) } }
  const result: ScenarioResult = { id: "result", version: 1, components: [], currency: "USD", horizon, sourceRefs: [evidence], unresolvedConditions: ["training: missing-category"], restrictions: [], comparisonStatus: "conditioned", knownSubtotal: 0, total: null, costCoverage: { basisId: "coverage", basisVersion: 1, alternativeId: "alternative", alternativeVersion: 1, currency: "USD", horizon, entries: [{ categoryId: "training", status: "pending", reason: "missing-category" }], derivedMissingCategoryIds: ["training"], coverageState: "pending", issues: ["training: missing-category"], evaluatedSourceRefs: [evidence] } }
  const choice: ChoiceRecord = { id: "choice", alternativeId: "alternative", alternativeVersion: 1, basisVersion: 1, criteria: ["cost"], values: [{ criterionRef: "cost", value: null, unit: "USD", currency: "USD", horizon }], evidenceRefs: [evidence], principalRef: "person", reason: "Choose with explicit pending cost; no financial approval", at: "2026-11-14T20:00:00Z", scenario: { baseRef: "authorized-forecast", operations: [], assumptions: [{ id: "unknown", value: null, evidenceRefs: [evidence], state: "absent" }, { id: "zero", value: 0, evidenceRefs: [evidence], state: "confirmed" }] }, result, comparisonStatus: "conditioned", costCoverage: result.costCoverage, comparison: { baselineResultRef: "baseline-result", alternativeResultRef: "result", costCoverageRefs: ["coverage"], comparisonStatus: "conditioned", knownDifference: 0, completeDifference: null, criterionResults: [{ criterionId: "cost", state: "unknown", reason: "missing category" }], unresolvedConditions: ["training: missing-category"] } }
  return { context: { kind: "ui", installationId: "installation", projectId: "project", principalRef: "person", policyVersion: "policy", accessRevision: "access" }, case: { id: "case", incarnation: "incarnation", version: 5, state: "chosen", objective: "Compare", horizon, currency: "USD", criteria: [{ id: "cost", description: "Cost", required: true }], participants: ["person"], sourceRefs: [evidence], alternatives: ["baseline", "alternative"].map((id) => ({ id, version: 1, title: id, scenario: choice.scenario, result: { ...result, id: id + "-result" } })), costCoverageBases: [], assumptions: [], questions: [], choices: [choice], preparedChanges: [], receipts: [], ledger: [] }, events: [], evidenceRefs: [evidence], checkedAt: "2026-11-14T20:01:00Z" }
}

function embedded(html: string, marker: string) {
  const encoded = html.match(new RegExp(marker + ' data-context="([^"]+)"'))?.[1]
  if (!encoded) throw new Error("context-not-rendered")
  return JSON.parse(encoded.replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&")) as { caseRef: { id: string; incarnation: string; version: number }; authority: AuthorizedCaseProjection["context"]; choices: readonly ChoiceRecord[] }
}
