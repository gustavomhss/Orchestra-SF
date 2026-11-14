import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessContextService } from "../contracts/business-context.ts"
import type { DecisionCasePort, PlannerPort, PlannerSourceHost } from "../contracts/ports.ts"
import type { PortfolioRequest } from "../contracts/operations.ts"
import type { PortfolioResult } from "../contracts/decisions.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { Snapshot } from "../../runtime/contract.ts"
import { sfRunSourceFence } from "../ai/run-store.ts"
import type { StoredDecisionResult, createSfDecisionResultStore } from "../decisions/result-store.ts"
import type { PortfolioBinding } from "../decisions/portfolio-bindings.ts"
import type { CriterionResultBinding } from "../decisions/criterion-rules.ts"
import type { PlannerDirectIntervalProof } from "../decisions/coverage-interval.ts"
import type { createPlannerSensitivityUnits } from "../planner/sensitivity-units.ts"
import { createPlannerIntervalProof } from "../planner/interval-proof.ts"
import { plannerScenarioDigest } from "../planner/preview-comparison.ts"
import { createSensitivityEvaluator } from "./sensitivity.ts"
import { finalizePlannerSensitivity } from "./planner-sensitivity.ts"
import type { createPlannerSensitivity } from "./planner-sensitivity.ts"
import type { CriterionComparisonBinding } from "../decisions/criterion-comparison.ts"
import { createProductionPortfolio } from "./production.ts"
import { portfolioResultDigest } from "./result-store.ts"
import { plannerSensitivityScenario, validatePlannerThreshold, type KnownSubtotalThreshold } from "./threshold-proof.ts"

/** Reproduce a bound portfolio or comparison using only authorized reads and Planner previews. */
export function createPortfolioProofVerifier(input: {
  cases: DecisionCasePort
  planner: PlannerPort
  sources: PlannerSourceHost
  evidence: BusinessContextService
  results: ReturnType<typeof createSfDecisionResultStore>
  revalidate: (context: TrustedDomainContext) => Promise<boolean>
  readSourceFences: (context: TrustedDomainContext) => Promise<{ dashboard: string; planner: string; procurement: string } | undefined>
  lockedSourceFences: () => { dashboard: string; planner: string; procurement: string } | undefined
  caseFor: Parameters<typeof createProductionPortfolio>[0]["persistence"]["caseFor"]
  idempotencyKey: Parameters<typeof createProductionPortfolio>[0]["persistence"]["idempotencyKey"]
  decisions: Parameters<typeof createProductionPortfolio>[0]["decisions"]
  createReceipt: Parameters<typeof createProductionPortfolio>[0]["createReceipt"]
  candidateCoverageRefFor: NonNullable<Parameters<typeof createProductionPortfolio>[0]["candidateCoverageRefFor"]>
  coverageRefFor?: Parameters<typeof createProductionPortfolio>[0]["coverageRefFor"]
  revalidateAnalysis: NonNullable<Parameters<typeof createProductionPortfolio>[0]["analysis"]>["revalidate"]
  units: ReturnType<typeof createPlannerSensitivityUnits>
  sensitivityPreview: Parameters<typeof createPlannerSensitivity>[0]["preview"]
  exactThreshold?: Parameters<typeof createPlannerSensitivity>[0]["exactThreshold"]
  coveragePreview?: Parameters<typeof createPlannerSensitivity>[0]["coveragePreview"]
}) {
  const proveSensitivityInterval = createPlannerIntervalProof({ units: input.units, preview: (request, context) => input.sensitivityPreview(request, context) })
  const fences = new Map<string, { digest: string; planner: string; expires: number }>()
  const key = (binding: PortfolioBinding | CriterionComparisonBinding | CriterionResultBinding, context: TrustedDomainContext) => digestSfValue({ binding: binding.bindingDigest, installation: context.binding.installationId, project: context.binding.projectId, principal: context.binding.principalRef, revision: context.binding.accessRevision, policy: context.binding.policyVersion })
  const capture = async (binding: PortfolioBinding | CriterionComparisonBinding | CriterionResultBinding, context: TrustedDomainContext, expected: string) => {
    const current = await input.readSourceFences(context)
    if (!current || digestSfValue(current) !== expected || !await input.revalidate(context)) return false
    const now = Date.now()
    for (const [ref, fence] of fences) if (fence.expires <= now) fences.delete(ref)
    if (fences.size >= 2048 && !fences.has(key(binding, context))) return false
    fences.set(key(binding, context), { digest: expected, planner: current.planner, expires: now + 30_000 })
    return await input.revalidate(context)
  }
  const replayPortfolio = async (request: PortfolioRequest, portfolio: PortfolioResult, context: TrustedDomainContext) => {
    const initial = await input.readSourceFences(context)
    if (!initial) return false
    const initialFence = digestSfValue(initial)
    const analysis: NonNullable<Parameters<typeof createProductionPortfolio>[0]["analysis"]> = {
      evaluate: async (request, trusted) => {
        const id = digestSfValue({ candidates: request.candidates.map((candidate) => candidate.ref), operations: request.scenario.operations })
        const found = portfolio.combinations.filter((combination) => combination.id === id)
        if (found.length !== 1) return { status: "stale", reason: "portfolio-combination-changed" }
        const item = found[0]!
        if (!item.analysis) return { status: "unavailable", reason: "portfolio-analysis-not-yet-persisted" }
        if (!await input.revalidateAnalysis(item.analysis, trusted)) return { status: "stale", reason: "portfolio-analysis-changed" }
        const comparison = item.analysis.comparison
        if (request.portfolio.constraints.some((ref) => !comparison.criterionResults.some((criterion) => criterion.criterionId === ref))) return { status: "stale", reason: "portfolio-criteria-changed" }
        return { status: "ok", value: { analysis: item.analysis, constraints: request.portfolio.constraints.map((ref) => { const criterion = comparison.criterionResults.find((value) => value.criterionId === ref)!; return { ref, state: criterion.state, reason: criterion.reason } }) } }
      },
      revalidate: input.revalidateAnalysis,
    }
    const port = createProductionPortfolio({ cases: input.cases, planner: input.planner, sources: input.sources, evidence: input.evidence, revalidate: input.revalidate, analysis, candidateCoverageRefFor: input.candidateCoverageRefFor, coverageRefFor: input.coverageRefFor, decisions: input.decisions, createReceipt: input.createReceipt, persistence: { results: input.results, caseFor: input.caseFor, idempotencyKey: input.idempotencyKey }, enabledOperations: [] }).port
    const replay = await port.evaluate(request, context)
    const latest = await input.readSourceFences(context)
    return replay.status === "ok" && portfolioResultDigest(replay.value) === portfolioResultDigest(portfolio) && !!latest && digestSfValue(latest) === initialFence && await input.revalidate(context)
  }
  const verifyPortfolio = async (binding: PortfolioBinding, stored: StoredDecisionResult, context: TrustedDomainContext) => {
    if (stored.kind !== "portfolio" || stored.resultRef !== binding.resultRef || stored.requestDigest !== digestSfValue(binding.request) || stored.resultDigest !== digestSfValue(stored.result) || digestSfValue(stored.caseRef) !== digestSfValue(binding.caseRef)) return false
    const initial = await input.readSourceFences(context)
    if (!initial) return false
    const initialFence = digestSfValue(initial)
    return await replayPortfolio(binding.request, stored.result, context) && await capture(binding, context, initialFence)
  }
  const verifyComparison = async (binding: CriterionComparisonBinding, stored: StoredDecisionResult, context: TrustedDomainContext) => {
    if (stored.kind !== "comparison" || stored.resultRef !== binding.resultRef || stored.requestDigest !== digestSfValue(binding.request) || stored.resultDigest !== digestSfValue(stored.result) || digestSfValue(stored.caseRef) !== digestSfValue(binding.caseRef)) return false
    const initial = await input.readSourceFences(context)
    if (!initial) return false
    const initialFence = digestSfValue(initial)
    const current = await input.planner.compareScenarios(binding.request, context)
    return current.status === "ok" && digestSfValue(current.value) === stored.resultDigest && await capture(binding, context, initialFence)
  }
  const verifySensitivity = async (incomingBinding: CriterionResultBinding, incomingStored: StoredDecisionResult, context: TrustedDomainContext) => {
    const binding = structuredClone(incomingBinding)
    const stored = structuredClone(incomingStored)
    const bindingInputDigest = digestSfValue(incomingBinding)
    const storedInputDigest = digestSfValue(incomingStored)
    const sameInputs = () => digestSfValue(incomingBinding) === bindingInputDigest && digestSfValue(incomingStored) === storedInputDigest
    const authority = digestSfValue({ kind: context.kind, binding: context.binding })
    const originalBinding = context.binding
    const lease = context.lease
    const sameAuthority = () => context.binding === originalBinding && context.lease === lease && digestSfValue({ kind: context.kind, binding: context.binding }) === authority
    if (stored.kind !== "sensitivity" || stored.resultRef !== binding.resultRef || stored.requestDigest !== digestSfValue(binding.request) || stored.resultDigest !== digestSfValue(stored.result) || digestSfValue(stored.caseRef) !== digestSfValue(binding.caseRef)) return false
    if (!await input.revalidate(context) || !sameAuthority() || !sameInputs()) return false
    const expectedResult = stored.result
    const initial = await input.readSourceFences(context)
    if (!initial) return false
    const initialFence = digestSfValue(initial)
    const issued = structuredClone(await input.units.resolve(binding.request, context))
    if (issued.status !== "ok" || issued.value.ruleRef !== binding.ruleRef || issued.value.ruleVersion !== binding.ruleVersion || digestSfValue(issued.value.caseRef) !== digestSfValue(binding.caseRef)) return false
    const unitBinding = issued.value
    const source = structuredClone(await input.results.readHistoricalScenario({ resultRef: binding.request.scenarioRef }, context))
    const baseline = structuredClone(await input.results.readHistoricalScenario({ resultRef: unitBinding.baselineRef }, context))
    if (source.status !== "ok" || baseline.status !== "ok" || source.value.kind !== "scenario" || baseline.value.kind !== "scenario" || source.value.resultRef !== binding.request.scenarioRef || baseline.value.resultRef !== unitBinding.baselineRef || source.value.requestDigest !== digestSfValue(unitBinding.scenario) || [source.value, baseline.value].some((value) => value.resultDigest !== digestSfValue(value.result) || value.caseRef.id !== binding.caseRef.id || value.caseRef.incarnation !== binding.caseRef.incarnation || value.caseRef.version > binding.caseRef.version)) return false
    const sourceScenario = source.value.result
    const baselineScenario = baseline.value.result
    const interval = input.coveragePreview ? structuredClone(await input.coveragePreview.issue(structuredClone(binding.request), unitBinding.baselineRef, context)) : undefined
    if (interval && interval.status !== "ok" && interval.status !== "unavailable") return false
    const samples: { resultRef: string; coverageRefs: readonly string[]; conditions: readonly string[]; quantified: boolean }[] = []
    const exact: { value?: KnownSubtotalThreshold; structural?: PlannerDirectIntervalProof } = {}
    const certify = (certificate: { value: number | null; evidenceRefs: readonly import("../contracts/business-context.ts").BusinessEvidenceRef[] }, trusted: TrustedDomainContext) => validatePlannerThreshold({ request: binding.request, binding: unitBinding, source: sourceScenario, baseline: baselineScenario, certificate, structural: exact.structural, preview: input.sensitivityPreview, context: trusted })
    const evaluate = createSensitivityEvaluator({
      sample: async (_request, value, trusted) => {
        const point = expectedResult.evaluated[samples.length]
        if (!point || point.parameterValue !== value) return { status: "stale", reason: "sensitivity-sample-changed" }
        const scenario = plannerSensitivityScenario(unitBinding, binding.request.parameterBounds.parameterRef, value)
        const saved = structuredClone(await input.results.read({ kind: "scenario", resultRef: point.resultRef }, trusted))
        if (saved.status !== "ok") return saved
        const preview = structuredClone(await input.sensitivityPreview({ baselineRef: unitBinding.baselineRef, scenario: structuredClone(scenario) }, trusted))
        if (preview.status !== "ok") return preview
        if (saved.value.kind !== "scenario" || digestSfValue(saved.value.caseRef) !== digestSfValue(binding.caseRef) || saved.value.requestDigest !== digestSfValue(scenario) || plannerScenarioDigest(saved.value.result) !== plannerScenarioDigest(preview.value.sample) || preview.value.metric.metricRef !== "planner:known-subtotal-difference" || preview.value.metric.state !== "conditioned" || !preview.value.metric.evidenceRefs.length || digestSfValue(preview.value.metric.period) !== digestSfValue(preview.value.sample.horizon) || digestSfValue(preview.value.comparison.costCoverageRefs) !== digestSfValue([unitBinding.baselineCoverageRef]) || preview.value.comparison.comparisonStatus === "incompatible" || preview.value.comparison.comparisonStatus === "unavailable" || preview.value.metric.unit !== unitBinding.resultUnit || preview.value.metric.engineVersion !== unitBinding.engineVersion || preview.value.metric.value !== point.value || preview.value.comparison.knownDifference !== point.value || preview.value.comparison.baselineResultRef !== unitBinding.baselineRef || preview.value.comparison.alternativeResultRef !== preview.value.sample.id) return { status: "stale", reason: "sensitivity-sample-changed" }
        const qualified = interval?.status === "ok" && input.coveragePreview ? structuredClone(await input.coveragePreview.qualify(interval.value.intervalRef, value, preview.value, trusted)) : undefined
        if (qualified && qualified.status !== "ok") return qualified
        const qualification = qualified?.status === "ok" ? qualified.value : undefined
        samples.push({ resultRef: point.resultRef, coverageRefs: preview.value.comparison.costCoverageRefs, conditions: qualification ? preview.value.comparison.unresolvedConditions.filter((condition) => ![...qualification.resolvedCoverageConditions, ...qualification.hypotheticalConditions].includes(condition)) : preview.value.comparison.unresolvedConditions, quantified: preview.value.metric.value !== null && Number.isFinite(preview.value.metric.value) })
        return { status: "ok", value: { resultRef: point.resultRef, scenario: saved.value.result, criterionValue: point.value, parameterUnit: unitBinding.parameterUnit, resultUnit: unitBinding.resultUnit, unitMetadataRef: unitBinding.unitMetadataRef, unitMetadataVersion: unitBinding.unitMetadataVersion, ...(qualification ? { coverageQualification: qualification } : {}) } }
      },
      exactThreshold: async (_request, trusted) => {
        if (!input.exactThreshold || samples.some((sample) => !sample.quantified) || baselineScenario.knownSubtotal === null || sourceScenario.knownSubtotal === null) return { status: "unavailable", reason: "exact-threshold-not-proven" }
        if (expectedResult.thresholdEvidence.state === "exact") {
          // A stored number is only a candidate. Re-establish the producer's
          // current monotone domain, then prove its accepted/rejected IEEE boundary.
          // The proof is local to this invocation; no prior authorization is reused.
          if (expectedResult.threshold !== expectedResult.thresholdEvidence.value) return { status: "unavailable", reason: "exact-threshold-certificate-incompatible" }
          const structural = interval?.status === "ok"
            ? { status: "ok" as const, value: structuredClone(interval.value.structural) }
            : structuredClone(await proveSensitivityInterval(structuredClone(binding.request), unitBinding.baselineRef, trusted))
          if (structural.status !== "ok") return structural
          exact.structural = structural.value
          // Reproduce the producer's evidence, including its deterministic order;
          // a self-hashed extra, missing or substituted stored ref is not authority.
          if (digestSfValue(expectedResult.thresholdEvidence.evidenceRefs) !== digestSfValue(structural.value.sourceRefs)) return { status: "unavailable", reason: "exact-threshold-evidence-changed" }
          const certificate = await certify({ value: expectedResult.thresholdEvidence.value, evidenceRefs: structural.value.sourceRefs }, trusted)
          if (certificate.status === "ok") exact.value = certificate.value
          return certificate
        }
        const result = structuredClone(await input.exactThreshold(structuredClone(binding.request), structuredClone(unitBinding), trusted))
        if (result.status !== "ok") return result
        const certificate = await certify(result.value, trusted)
        if (certificate.status === "ok") exact.value = certificate.value
        return certificate
      },
      revalidate: async (_samples, _threshold, trusted) => {
        if (!await input.units.revalidate(unitBinding, trusted) || samples.length !== expectedResult.evaluated.length) return false
        const currentSource = structuredClone(await input.results.readHistoricalScenario({ resultRef: binding.request.scenarioRef }, trusted))
        const currentBaseline = structuredClone(await input.results.readHistoricalScenario({ resultRef: unitBinding.baselineRef }, trusted))
        if (currentSource.status !== "ok" || currentBaseline.status !== "ok" || digestSfValue(currentSource.value) !== digestSfValue(source.value) || digestSfValue(currentBaseline.value) !== digestSfValue(baseline.value)) return false
        if (interval?.status === "ok" && (!input.coveragePreview || !await input.coveragePreview.revalidate(interval.value.intervalRef, trusted))) return false
        if (!exact.value) return true
        // The fresh interval proof admits the direct parameter's domain. Reproduce
        // its candidate boundary with current adjacent previews, then recheck authority/units.
        const certificate = await certify(structuredClone(exact.value), trusted)
        return certificate.status === "ok" && digestSfValue(certificate.value) === digestSfValue(exact.value) && await input.units.revalidate(structuredClone(unitBinding), trusted)
      },
      verifyCoverageQualification: input.coveragePreview?.verify,
    })
    const sampled = await evaluate(binding.request, context)
    if (sampled.status !== "ok") return false
    const result = finalizePlannerSensitivity({ request: binding.request, binding: unitBinding, result: sampled.value, samples, baselineRefs: baseline.value.sourceRefs, exact: exact.value, originalScenarios: sampled.value.comparisonStatus === "complete" ? [] : [{ resultRef: binding.request.scenarioRef, scenario: sourceScenario, coverageRef: unitBinding.scenarioCoverageRef }, { resultRef: unitBinding.baselineRef, scenario: baselineScenario, coverageRef: unitBinding.baselineCoverageRef }] })
    return result.status === "ok" && digestSfValue(result.value) === stored.resultDigest && sameAuthority() && sameInputs() && await capture(binding, context, initialFence) && sameAuthority() && sameInputs()
  }
  const verifySnapshot = (snapshot: Snapshot, binding: PortfolioBinding | CriterionComparisonBinding | CriterionResultBinding, context: TrustedDomainContext) => {
    const saved = fences.get(key(binding, context))
    const current = input.lockedSourceFences()
    return !!saved && !!current && saved.expires > Date.now() && saved.planner === sfRunSourceFence(snapshot) && saved.digest === digestSfValue(current)
  }
  return { replayPortfolio, verifyPortfolio, verifyComparison, verifySensitivity, verifySnapshot }
}
