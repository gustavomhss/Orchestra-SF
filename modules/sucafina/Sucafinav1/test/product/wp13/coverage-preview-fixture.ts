import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../product/contracts/business-context.ts"
import type { CostCoverageEntry, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { ScenarioRequest, SensitivityRequest } from "../../../product/contracts/operations.ts"
import type { PortResult } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { assessCostCoverage } from "../../../product/decisions/cost-coverage.ts"
import { classifyCoverage, supportsCoverageClassification } from "../../../product/decisions/coverage-classification.ts"
import type { PortfolioSelection } from "../../../product/decisions/portfolio-selection.ts"
import { createPortfolioCoveragePreview } from "../../../product/portfolio/coverage-preview.ts"
import type { PortfolioCoverageAuthority } from "../../../product/portfolio/coverage-preview.ts"
import { createWp05ComparisonFixture, wp05Horizon } from "../wp05/engine-fixture.ts"
import { renewalCoverage } from "../wp11/renewal-coverage-fixture.ts"

/** Published Planner/C08/rule producers calculate every number. Scope declarations and admission are synthetic host fixtures. */
export async function createPortfolioCoverageFixture(training: "bundled" | "omitted" | "confirmed" | "zero" | "null" = "bundled", mode: "renewal-usd" | "eur-missing-fx" = "renewal-usd") {
  // C08 scenarios, rule and comparison are required; each consumer runs its own sensitivity proof.
  const fixture = await createWp05ComparisonFixture({ mode, training, composed: true })
  try {
    const selected = await renewalCoverage(fixture, training)
    const source = fixture.sourceRefs.find((ref) => ref.refId === fixture.baselineScenario.baseRef)
    if (!source) throw new Error("Baseline Planner source missing")
    const projection = await fixture.planner.compareForecast({ baseRef: source.refId, candidateRef: source.refId, period: wp05Horizon, currency: "USD" }, fixture.context)
    if (projection.status !== "ok") throw new Error(projection.reason)
    const actual = projection.value.candidate
    const declarations = Object.fromEntries(fixture.basis.categoryIds.filter((category) => category !== "service" && category !== "taxes").map((category) => [category, `The synthetic renewal inventory confirms no incremental ${category} charge in this scope.`]))
    const unsigned: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", kind: "record", refId: "baseline-scope", installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "observed", target: { surface: "planner", recordType: "synthetic-scope", recordId: "baseline-scope", incarnation: "baseline-scope-v1", version: 1, fields: Object.keys(declarations), period: wp05Horizon, projectionDigest: digestSfValue(declarations) } }
    const statement = { ...unsigned, refDigest: digestSfEvidenceRef(unsigned) }
    const components = actual.components.map((component) => component.id)
    const entries: CostCoverageEntry[] = [
      { categoryId: "service", status: "included", componentRefs: components, evidenceRefs: [source], scopeNote: "The renewal supplies the existing service throughout the quoted scope." },
      { categoryId: "taxes", status: "included", componentRefs: components, evidenceRefs: [source], scopeNote: "The synthetic renewal is explicitly quoted at its final price; no additional tax is inferred." },
      ...Object.entries(declarations).map(([categoryId, justification]): CostCoverageEntry => ({ categoryId, status: "not-applicable", justification, evidenceRefs: [statement] })),
    ]
    const classification = classifyCoverage({ caseRef: fixture.caseRef, source, basis: fixture.basis, entries, expectedVersion: 0 }, actual, 1)
    const evidence: BusinessEvidenceResolution[] = [...selected.evidence, { state: "fresh", ref: statement, accessRevision: "access", checkedAt: "2026-11-13T00:00:00Z" }]
    const assessment = assessCostCoverage({ basis: fixture.basis, alternativeId: "baseline", alternativeVersion: 1, currency: "USD", horizon: wp05Horizon, entries, components: fixture.baselineResult.components, evidence, supports: (entry, resolved) => supportsCoverageClassification(classification, entry, resolved) })
    const storedResult: ScenarioResult = { ...fixture.selectedResult, costCoverage: selected.assessment, comparisonStatus: "conditioned", total: null }
    const baselineResult: ScenarioResult = { ...fixture.baselineResult, costCoverage: assessment, comparisonStatus: "conditioned", total: null }
    const decision = { ...fixture.decision, alternatives: fixture.decision.alternatives.map((alternative) => alternative.id === "selected" ? { ...alternative, result: storedResult } : alternative.id === "baseline" ? { ...alternative, result: baselineResult } : alternative) }
    const selectionBody = { schema: "sf-portfolio-selection-v1" as const, selectionRef: "wp13-coverage-selection", caseRef: fixture.caseRef, baselineAlternativeId: "baseline", alternativeId: "selected", baselineRef: fixture.baselineRef, alternativeRef: fixture.selectedRef, criteria: [fixture.sensitivityRequest.criterion.id], comparisonDigest: digestSfValue(fixture.comparison), version: 1, principalRef: "finance", accessRevision: "access", policyVersion: "policy", createdAt: "2026-11-13T00:00:00Z" }
    const selection: PortfolioSelection = { ...selectionBody, selectionDigest: digestSfValue(selectionBody) }
    const revoked = new Set<string>()
    const access = { allowed: true }
    const scopeRefs = [selected.statement, statement].map((ref) => structuredClone(ref))
    // C08 validates source identity/freshness here. Case, rule and interval checks remain in their canonical ports.
    const coverageEvidence = async (refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext): Promise<readonly BusinessEvidenceResolution[] | undefined> => {
      if (!access.allowed || !await fixture.host.revalidate(context)) return undefined
      if (refs.some((ref) => ![...fixture.sourceRefs, ...scopeRefs].some((known) => digestSfValue(known) === digestSfValue(ref)))) return undefined
      const resolved = await Promise.all(refs.map(async (ref): Promise<BusinessEvidenceResolution> => {
        if (scopeRefs.some((known) => digestSfValue(known) === digestSfValue(ref))) return { state: revoked.has(ref.refId) ? "revoked" : "fresh", ref: structuredClone(ref), accessRevision: context.binding.accessRevision, checkedAt: "2026-11-13T00:00:00Z" }
        return fixture.evidence.resolve(ref, context)
      }))
      return access.allowed && await fixture.host.revalidate(context) ? resolved : undefined
    }
    const resolveAuthority = async (request: SensitivityRequest, baselineRef: string, context: TrustedDomainContext): Promise<PortResult<PortfolioCoverageAuthority>> => {
      if (!access.allowed || request.scenarioRef !== fixture.selectedRef || baselineRef !== fixture.baselineRef || !await fixture.host.revalidate(context)) return { status: "denied", reason: "coverage-fixture-access-unavailable" }
      const rule = await fixture.rules.resolve({ caseRef: fixture.caseRef, criterionId: request.criterion.id }, context)
      if (rule.status !== "ok") return rule
      const resolutions = await Promise.all(fixture.sourceRefs.map((ref) => fixture.evidence.resolve(ref, context)))
      const scopeEvidence: BusinessEvidenceResolution[] = [selected.statement, statement].map((ref) => ({ state: revoked.has(ref.refId) ? "revoked" : "fresh", ref, accessRevision: context.binding.accessRevision, checkedAt: "2026-11-13T00:00:00Z" }))
      const isStillValid = async (trusted: TrustedDomainContext) => {
        if (!access.allowed || revoked.size || !await fixture.host.revalidate(trusted)) return false
        const currentRule = await fixture.rules.resolve({ caseRef: fixture.caseRef, criterionId: request.criterion.id }, trusted)
        const currentCase = await fixture.state.read(fixture.request, "cases", (state) => state.cases[fixture.caseRef.id])
        const currentEvidence = await Promise.all(fixture.sourceRefs.map((ref) => fixture.evidence.resolve(ref, trusted)))
        return currentRule.status === "ok" && digestSfValue(currentRule.value) === digestSfValue(rule.value) && currentCase.status === "ok" && digestSfValue(currentCase.value) === digestSfValue(fixture.decision) && currentEvidence.every((item) => item.state === "fresh" && item.accessRevision === trusted.binding.accessRevision)
      }
      return { status: "ok", value: { decision, selection, scenario: fixture.scenario, storedResult, rule: rule.value, basis: fixture.basis, classification: selected.classification, baseline: { result: baselineResult, classification }, evidence: [...resolutions, ...scopeEvidence], isStillValid } }
    }
    const coverage = createPortfolioCoveragePreview({ units: fixture.issuer, preview: fixture.preview, resolveAuthority })
    const withAmount = (amount: number): ScenarioRequest => ({ ...fixture.scenario, operations: fixture.scenario.operations.map((operation) => operation.targetRef === fixture.sensitivityRequest.parameterBounds.parameterRef ? { ...operation, amount } : operation) })
    return { ...fixture, selectedCoverage: selected, baselineCoverage: { assessment, classification, statement }, storedResult, coveredBaseline: baselineResult, selection, resolveAuthority, coverageEvidence, coverage, withAmount, revokeStatement: (ref = selected.statement.refId) => { revoked.add(ref) }, deny: () => { access.allowed = false } }
  } catch (error) {
    await fixture.cleanup()
    throw error
  }
}
