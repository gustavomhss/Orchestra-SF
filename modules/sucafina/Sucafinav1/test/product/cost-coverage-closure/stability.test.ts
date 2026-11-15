import { expect, test } from "bun:test"
import type { BusinessEvidenceResolution } from "../../../product/contracts/business-context.ts"
import type { CostCoverageEntry, ScenarioResult } from "../../../product/contracts/decisions.ts"
import { assessCostCoverage, reassessScenarioCoverage, validateScenarioCoverage } from "../../../product/decisions/cost-coverage.ts"
import { supportsCoverageClassification } from "../../../product/decisions/coverage-classification.ts"
import { freezeStabilityInput, stabilityFixture } from "./stability-fixture.ts"

test("C10 stability: included null and its normalized pending row reassess identically without zero filling", async () => {
  const fixture = stabilityFixture(null)
  const before = structuredClone({ basis: fixture.input.basis, entries: fixture.entries, scenario: fixture.scenario, assessment: fixture.assessment })
  freezeStabilityInput(fixture.input)
  freezeStabilityInput(fixture.scenario)
  freezeStabilityInput(fixture.assessment)
  expect(fixture.assessment).toMatchObject({ coverageState: "pending", issues: [], derivedMissingCategoryIds: [],
    entries: expect.arrayContaining([{ categoryId: "training", status: "pending", reason: "component-unresolved" }]) })
  const original = await reassessScenarioCoverage({ scenario: fixture.scenario, basis: fixture.input.basis,
    baseline: fixture.assessment, entries: fixture.entries, resolveEvidence: fixture.resolveEvidence, supports: fixture.input.supports })
  const normalized = await reassessScenarioCoverage({ scenario: fixture.scenario, basis: fixture.input.basis,
    baseline: fixture.assessment, entries: fixture.assessment.entries, resolveEvidence: fixture.resolveEvidence, supports: fixture.input.supports })
  expect(original).toBeDefined()
  expect(normalized).toEqual(original)
  expect(normalized).toMatchObject({ knownSubtotal: null, total: null, comparisonStatus: "conditioned",
    components: [expect.objectContaining({ amount: null, evidenceState: "absent" })], costCoverage: fixture.assessment })
  if (!normalized) throw new Error("Identical null coverage became unavailable")
  expect(validateScenarioCoverage(normalized, fixture.input.basis, normalized.costCoverage)).toBeUndefined()
  expect({ basis: fixture.input.basis, entries: fixture.entries, scenario: fixture.scenario, assessment: fixture.assessment }).toEqual(before)
})

test("C10 stability: a genuinely unassigned component still prevents a complete seal", () => {
  const fixture = stabilityFixture()
  expect(fixture.assessment.coverageState).toBe("complete")
  const components = [...fixture.components, { ...structuredClone(fixture.components[0]!), id: "orphan:11", amount: 17 }]
  expect(assessCostCoverage({ ...fixture.input, components })).toMatchObject({ coverageState: "pending", issues: ["uncategorized-component"] })
  expect(validateScenarioCoverage({ ...fixture.scenario, components }, fixture.input.basis, fixture.assessment)).toBe("incomplete-cost-coverage")
  expect(fixture.components).toHaveLength(1)
})

test("C10 stability: assessment owns its horizon, entries and all evidence references", () => {
  const fixture = stabilityFixture()
  const saved = structuredClone(fixture.assessment)
  const training = fixture.entries.find((entry) => entry.categoryId === "training")!
  const assessedTraining = fixture.assessment.entries.find((entry) => entry.categoryId === "training")!
  expect(fixture.assessment.horizon).not.toBe(fixture.input.horizon)
  expect(assessedTraining).not.toBe(training)
  expect(fixture.assessment.evaluatedSourceRefs[0]).not.toBe(fixture.source)
  if (training.status !== "included" || assessedTraining.status !== "included") throw new Error("Training classification unavailable")
  expect(assessedTraining.componentRefs).not.toBe(training.componentRefs)
  expect(assessedTraining.evidenceRefs[0]).not.toBe(training.evidenceRefs[0])
  fixture.input.horizon.end = "2028-12-31"
  training.scopeNote = "Changed after assessment"
  fixture.source.target.version = 2
  expect(fixture.assessment).toEqual(saved)
})

test("C10 stability: reassessment detaches the complete scenario DTO from frozen borrowed inputs", async () => {
  const fixture = stabilityFixture()
  freezeStabilityInput(fixture.scenario)
  freezeStabilityInput(fixture.entries)
  const result = await reassessScenarioCoverage({ scenario: fixture.scenario, basis: fixture.input.basis,
    baseline: fixture.assessment, entries: fixture.entries, resolveEvidence: fixture.resolveEvidence, supports: fixture.input.supports })
  expect(result).toEqual({ ...fixture.scenario, unresolvedConditions: [] })
  if (!result) throw new Error("Valid frozen scenario became unavailable")
  expect(result.horizon).not.toBe(fixture.scenario.horizon)
  expect(result.components).not.toBe(fixture.scenario.components)
  expect(result.components[0]).not.toBe(fixture.scenario.components[0])
  expect(result.components[0]!.sourceRefs[0]).not.toBe(fixture.scenario.components[0]!.sourceRefs[0])
  expect(result.sourceRefs[0]).not.toBe(fixture.scenario.sourceRefs[0])
  expect(result.restrictions).not.toBe(fixture.scenario.restrictions)
  expect(result.costCoverage).not.toBe(fixture.assessment)
})

test("C10 stability: original entry identity reaches the real classifier and scenario alternative version is preserved", async () => {
  const fixture = stabilityFixture()
  const classifications = new WeakMap<CostCoverageEntry, typeof fixture.classification>(fixture.entries.map((entry) => [entry, fixture.classification] as const))
  const seen: CostCoverageEntry[] = []
  const supports: typeof fixture.input.supports = (entry, evidence) => {
    seen.push(entry)
    const classification = classifications.get(entry)
    return !!classification && supportsCoverageClassification(classification, entry, evidence)
  }
  const assessment = assessCostCoverage({ ...fixture.input, supports })
  expect(assessment.coverageState).toBe("complete")
  expect(seen).toEqual(fixture.entries)
  seen.length = 0
  // Baseline registrations legitimately have their own generated alternative ID.
  const baseline = { ...fixture.assessment, alternativeId: "baseline:canonical-generated-id", alternativeVersion: 91 }
  const result = await reassessScenarioCoverage({ scenario: fixture.scenario, basis: fixture.input.basis,
    baseline, entries: fixture.entries, resolveEvidence: fixture.resolveEvidence, supports })
  expect(result).toMatchObject({ id: fixture.scenario.id, version: 4,
    costCoverage: { coverageState: "complete", alternativeId: "synthetic-alternative", alternativeVersion: 7 } })
  expect(seen).toEqual(fixture.entries)
  expect(seen.every((entry, index) => entry === fixture.entries[index])).toBe(true)
  if (!result) throw new Error("Identity-keyed real classification was lost")
  expect(validateScenarioCoverage(result, fixture.input.basis, result.costCoverage)).toBeUndefined()
  expect(baseline.alternativeVersion).toBe(91)
})

test("C10 stability: a scenario getter and borrowed components cannot switch the assessed input during resolution", async () => {
  const fixture = stabilityFixture()
  const expected = structuredClone({ ...fixture.scenario, unresolvedConditions: [] })
  const changed: ScenarioResult = { ...structuredClone(fixture.scenario), id: "other-scenario", version: 99, currency: "EUR",
    costCoverage: { ...structuredClone(fixture.assessment), alternativeId: "other-alternative", alternativeVersion: 99 } }
  let current: ScenarioResult = fixture.scenario
  let reads = 0
  const result = await reassessScenarioCoverage({ get scenario() { reads++; return current }, basis: fixture.input.basis,
    baseline: fixture.assessment, entries: fixture.entries, supports: fixture.input.supports,
    resolveEvidence: async (refs) => {
      current = changed
      fixture.components[0]!.amount = 99999
      return fixture.resolveEvidence(refs)
    } })
  expect(result).toEqual(expected)
  expect(reads).toBe(1)
  expect(fixture.components[0]!.amount).toBe(99999)
})

test("C10 stability: an untrusted resolver cannot rewrite the expected evidence through its argument", async () => {
  const fixture = stabilityFixture()
  const before = structuredClone({ basis: fixture.input.basis, entries: fixture.entries, scenario: fixture.scenario })
  const result = await reassessScenarioCoverage({ scenario: fixture.scenario, basis: fixture.input.basis,
    baseline: fixture.assessment, entries: fixture.entries, supports: fixture.input.supports,
    resolveEvidence: async (refs): Promise<readonly BusinessEvidenceResolution[]> => {
      // Deliberate hostile response, never the positive fixture resolver.
      const source = refs.find((ref) => ref.refId === fixture.source.refId)
      if (!source || source.kind !== "record") throw new Error("Expected requested training evidence")
      source.target.version += 1
      return refs.map((ref) => ({ state: "fresh", ref, accessRevision: "synthetic-access", checkedAt: "2026-11-13T00:00:00Z" }))
    } })
  expect(result).toBeUndefined()
  expect({ basis: fixture.input.basis, entries: fixture.entries, scenario: fixture.scenario }).toEqual(before)
})

test("C10 stability: a classifier cannot approve a different borrowed entry after it returns", () => {
  const fixture = stabilityFixture()
  const result = assessCostCoverage({ ...fixture.input, supports: (entry, evidence) => {
    const accepted = supportsCoverageClassification(fixture.classification, entry, evidence)
    if (entry.categoryId === "training" && entry.status === "included") entry.scopeNote = "Changed after the real classifier checked it"
    return accepted
  } })
  expect(result.coverageState).toBe("pending")
  expect(result.entries.find((entry) => entry.categoryId === "training")).toEqual({ categoryId: "training", status: "pending", reason: "scope-not-supported" })
})
