import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../product/contracts/business-context.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { CostCoverageBasis, CostCoverageEntry, ScenarioResult } from "../../../product/contracts/decisions.ts"
import { assessCostCoverage } from "../../../product/decisions/cost-coverage.ts"
import { classifyCoverage, supportsCoverageClassification } from "../../../product/decisions/coverage-classification.ts"

/** Component-only synthetic inventory. Classification and matching are the real
 * producers; these unit fixtures do not claim a persisted human approval,
 * Planner calculation, financial total, UI admission or installed authority.
 */
export function stabilityFixture(amount: number | null = 40000) {
  const horizon = { start: "2027-01-01", end: "2027-12-31" }
  const statements = Object.fromEntries(RENEWAL_TRANSITION_CATEGORIES.filter((category) => category !== "training")
    .map((category) => [category, `Synthetic unit inventory: ${category} has no applicable component.`]))
  const reference = (id: string, fields: string[], projection: unknown) => {
    const value = { schema: "sf-evidence-v1", kind: "record", refId: `SYN-C10-STABILITY:${id}`,
      installationId: "synthetic-install", projectId: "synthetic-project", refDigest: "", evidenceLevel: "observed",
      target: { surface: "planner", recordType: "synthetic-coverage-inventory", recordId: id, incarnation: `${id}-1`,
        version: 1, fields, period: horizon, projectionDigest: digestSfValue(projection) } } satisfies Extract<BusinessEvidenceRef, { kind: "record" }>
    return { ...value, refDigest: digestSfEvidenceRef(value) }
  }
  const source = reference("training", ["amount"], { amount })
  const statement = reference("scope", Object.keys(statements), statements)
  const basis = { id: "synthetic-coverage-basis", version: 1, decisionType: "renewal-transition-v1",
    categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: [source, statement] } satisfies CostCoverageBasis
  const components = [{ id: "training:11", amount, currency: "USD", period: horizon,
    evidenceState: amount === null ? "absent" as const : "confirmed" as const,
    sourceRefs: [{ surface: "planner" as const, type: source.target.recordType, id: source.target.recordId,
      incarnation: source.target.incarnation, version: source.target.version, fields: ["amount"], period: horizon,
      observedAt: "2026-11-13T00:00:00Z" }] }]
  const entries: CostCoverageEntry[] = RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => categoryId === "training"
    ? { categoryId, status: "included", componentRefs: [components[0]!.id], evidenceRefs: [source], scopeNote: "Synthetic training quote only." }
    : { categoryId, status: "not-applicable", justification: statements[categoryId]!, evidenceRefs: [statement] })
  const projection = { context: { installationId: source.installationId, projectId: source.projectId, principalRef: "synthetic-finance",
    accessRevision: "synthetic-access", policyVersion: "synthetic-policy", surface: "planner", period: horizon, currency: "USD",
    sourceRefs: components[0]!.sourceRefs, capabilities: [] }, version: 1, engineVersion: "synthetic-unit-input-v1",
    components, values: [], missing: [] } satisfies DomainProjection
  const classification = classifyCoverage({ caseRef: { id: "synthetic-case", incarnation: "synthetic-case-1", version: 3 },
    source, basis, entries, expectedVersion: 0 }, projection, 1)
  const evidence: BusinessEvidenceResolution[] = basis.sourceRefs.map((ref) => ({ state: "fresh", ref,
    accessRevision: "synthetic-access", checkedAt: "2026-11-13T00:00:00Z" }))
  const input = { basis, alternativeId: "synthetic-alternative", alternativeVersion: 7, currency: "USD", horizon, entries,
    components, evidence, supports: (entry, resolved) => supportsCoverageClassification(classification, entry, resolved) } satisfies Parameters<typeof assessCostCoverage>[0]
  const assessment = assessCostCoverage(input)
  const scenario = { id: "synthetic-scenario", version: 4, components, currency: "USD", horizon, sourceRefs: basis.sourceRefs,
    unresolvedConditions: ["scenario-coverage-reassessment-required"], restrictions: ["component-unit-proof-only"],
    comparisonStatus: "conditioned", costCoverage: assessment, knownSubtotal: amount, total: null } satisfies ScenarioResult
  const expectedEvidence = structuredClone(evidence)
  const resolveEvidence = async (refs: readonly BusinessEvidenceRef[]): Promise<readonly BusinessEvidenceResolution[]> => refs.map((ref) => {
    const found = expectedEvidence.find((item) => digestSfValue(item.ref) === digestSfValue(ref))
    return found ? structuredClone(found) : { state: "unavailable", ref: structuredClone(ref),
      accessRevision: "synthetic-access", checkedAt: "2026-11-13T00:00:00Z" }
  })
  return { input, source, statement, components, entries, classification, assessment, scenario, resolveEvidence }
}

export function freezeStabilityInput(value: unknown): void {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return
  Object.values(value).forEach(freezeStabilityInput)
  Object.freeze(value)
}
