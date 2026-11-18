import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { SensitivityRequest } from "../../../../product/contracts/operations.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../product/contracts/sf-execution.ts"
import { classificationKey } from "../../../../product/decisions/coverage-classification.ts"
import type { CoverageClassification } from "../../../../product/decisions/coverage-classification.ts"
import type { PortfolioSelection } from "../../../../product/decisions/portfolio-selection.ts"
import { createPortfolioCoveragePreview } from "../../../../product/portfolio/coverage-preview.ts"
import type { PortfolioCoverageAuthority } from "../../../../product/portfolio/coverage-preview.ts"
import type { JourneyTrace, RenewalHistory, observeRenewalPhase } from "./observed-ports.ts"

/** Preserve the S11 synthetic selection/authority composition, adding timing only. */
export function observeRenewalCoverage(history: RenewalHistory, after: ReturnType<typeof observeRenewalPhase>, trace: JourneyTrace) {
  const readCase = trace.wrap("confirmed.authority.read-case", history.readCase)
  const classifications = () => trace.measure("confirmed.authority.read-classifications", () => history.state.read(history.fixture.request, "preferences", (state) => ({
    selected: state.preferences[classificationKey(after.caseRef, after.scenario.baseRef)],
    baseline: state.preferences[classificationKey(after.caseRef, after.baselineScenario.baseRef)],
  })))
  const resolveAuthority = trace.wrap("confirmed.authority.resolve", async (request: SensitivityRequest, baselineRef: string, context: TrustedDomainContext): Promise<PortResult<PortfolioCoverageAuthority>> => {
    const binding = await after.issuer.resolve(request, context)
    if (binding.status !== "ok") return binding
    if (request.scenarioRef !== after.selectedRef || baselineRef !== after.baselineRef || digestSfValue(binding.value.caseRef) !== digestSfValue(after.caseRef)) return { status: "unavailable", reason: "choice-history-selection-mismatch" }
    const decision = await readCase()
    const current = await classifications()
    if (current.status !== "ok" || !current.value.selected || typeof current.value.selected !== "object" || !("classificationDigest" in current.value.selected) || !current.value.baseline || typeof current.value.baseline !== "object" || !("classificationDigest" in current.value.baseline)) return { status: "unavailable", reason: "choice-history-classification-unavailable" }
    const selected = current.value.selected as CoverageClassification
    const baseline = current.value.baseline as CoverageClassification
    const body = {
      schema: "sf-portfolio-selection-v1" as const,
      selectionRef: "wp13-human-history-selection", caseRef: after.caseRef,
      baselineAlternativeId: "baseline", alternativeId: "selected", baselineRef,
      alternativeRef: after.selectedRef, criteria: [request.criterion.id],
      comparisonDigest: digestSfValue(after.comparison), version: 1,
      principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision,
      policyVersion: context.binding.policyVersion, createdAt: "2026-11-13T02:00:00Z",
    }
    const selection: PortfolioSelection = { ...body, selectionDigest: digestSfValue(body) }
    const refs = [...after.basis.sourceRefs, ...after.selectedResult.sourceRefs, ...after.baselineResult.sourceRefs,
      ...after.selectedResult.costCoverage.evaluatedSourceRefs, ...after.baselineResult.costCoverage.evaluatedSourceRefs,
      selected.source, baseline.source, ...after.rule.evidenceRefs, ...binding.value.evidenceRefs]
      .filter((ref, index, all) => all.findIndex((other) => digestSfValue(other) === digestSfValue(ref)) === index)
    const evidence = await trace.measure("confirmed.authority.evidence-context", () => after.evidence.context({ refs }, context))
    const decisionDigest = digestSfValue(decision)
    const classificationDigest = digestSfValue(current.value)
    return { status: "ok", value: {
      decision, selection, scenario: after.scenario, storedResult: after.selectedResult, rule: after.rule,
      basis: after.basis, classification: selected, baseline: { result: after.baselineResult, classification: baseline }, evidence,
      isStillValid: trace.wrap("confirmed.authority.is-still-valid", async (trusted: TrustedDomainContext) => {
        const latest = await classifications()
        return latest.status === "ok" && digestSfValue(latest.value) === classificationDigest && digestSfValue(await readCase()) === decisionDigest && await after.issuer.revalidate(binding.value, trusted)
      }),
    } }
  })
  const coverage = createPortfolioCoveragePreview({ units: after.issuer, preview: after.preview, resolveAuthority })
  return {
    issue: trace.wrap("confirmed.coverage.issue", coverage.issue),
    qualify: trace.wrap("confirmed.coverage.qualify", coverage.qualify),
    revalidate: trace.wrap("confirmed.coverage.revalidate", coverage.revalidate),
    verify: trace.wrap("confirmed.coverage.verify", coverage.verify),
  }
}
