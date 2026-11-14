import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../contracts/business-context.ts"
import type { CostCoverageAssessment, CostCoverageBasis, DecisionCase, ScenarioResult } from "../contracts/decisions.ts"
import type { ScenarioRequest, SensitivityRequest } from "../contracts/operations.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { assessCostCoverage, validateScenarioCoverage } from "../decisions/cost-coverage.ts"
import { classificationDigest, supportsCoverageClassification } from "../decisions/coverage-classification.ts"
import type { CoverageClassification } from "../decisions/coverage-classification.ts"
import { createCoverageIntervalCertificate } from "../decisions/coverage-interval.ts"
import type { CoverageIntervalCertificate, PlannerDirectIntervalProof } from "../decisions/coverage-interval.ts"
import type { CriterionRule } from "../decisions/criterion-rules.ts"
import type { PortfolioSelection } from "../decisions/portfolio-selection.ts"
import { plannerComponentDigest } from "../planner/comparison.ts"
import { exactComponents } from "../planner/exact-threshold.ts"
import { createPlannerIntervalProof } from "../planner/interval-proof.ts"
import { plannerPreviewDigest, plannerScenarioDigest } from "../planner/preview-comparison.ts"
import type { comparePlannerPreview } from "../planner/preview-comparison.ts"

type CompleteCoverage = Extract<CostCoverageAssessment, { coverageState: "complete" }>
export type PortfolioCoveragePreview = Extract<Awaited<ReturnType<typeof comparePlannerPreview>>, { status: "ok" }>["value"]

/** The host reads authenticated WP11 records and fences their case, evidence and authority. */
export type PortfolioCoverageAuthority = {
  decision: DecisionCase
  selection: PortfolioSelection
  scenario: ScenarioRequest
  storedResult: ScenarioResult
  rule: CriterionRule
  basis: CostCoverageBasis
  classification: CoverageClassification
  baseline: { result: ScenarioResult; classification: CoverageClassification }
  evidence: readonly BusinessEvidenceResolution[]
  isStillValid: (context: TrustedDomainContext) => Promise<boolean>
}

export type PortfolioCoverageInterval = {
  intervalRef: string
  requestDigest: string
  baselineRef: string
  certificate: CoverageIntervalCertificate
  structural: PlannerDirectIntervalProof
  assessment: CompleteCoverage
  baselineAssessment: CompleteCoverage
  evidenceRefs: readonly BusinessEvidenceRef[]
}

/** Completeness belongs to the quantified analysis; it does not apply or confirm a scenario. */
export type PortfolioCoverageQualification = {
  schema: "sf-portfolio-coverage-preview-v1"
  intervalRef: string
  certificateDigest: string
  requestDigest: string
  sampleDigest: string
  scenarioDigest: string
  parameterValue: number
  metricValue: number
  assessment: CompleteCoverage
  baselineAssessment: CompleteCoverage
  evidenceRefs: readonly BusinessEvidenceRef[]
  resolvedCoverageConditions: readonly string[]
  hypotheticalConditions: readonly string[]
}

const coverageConditions = ["cost-coverage-unresolved-or-source-mismatch", "scenario-coverage-reassessment-required", "preview-coverage-unresolved"]
const hypotheticalConditions = ["scenario-is-hypothetical", "preview-comparison-transient"]
const eligibleConditions = [...coverageConditions, ...hypotheticalConditions]

/** Compose C10 coverage and the canonical Planner interval without rewriting producer results. */
export function createPortfolioCoveragePreview(input: {
  units: Parameters<typeof createPlannerIntervalProof>[0]["units"]
  preview: Parameters<typeof createPlannerIntervalProof>[0]["preview"]
  resolveAuthority: (request: SensitivityRequest, baselineRef: string, context: TrustedDomainContext) => Promise<PortResult<PortfolioCoverageAuthority>>
}) {
  const prove = createPlannerIntervalProof({ units: input.units, preview: input.preview })
  const issued = new Map<string, { request: SensitivityRequest; interval: PortfolioCoverageInterval; authorityDigest: string; contextDigest: string; scenario: ScenarioRequest; expiresAt: number }>()
  const qualified = new Map<string, string>()
  const prune = () => {
    for (const [ref, value] of issued) if (value.expiresAt <= Date.now()) issued.delete(ref)
    while (issued.size > 32) issued.delete(issued.keys().next().value!)
    for (const [digest, ref] of qualified) if (!issued.has(ref)) qualified.delete(digest)
    while (qualified.size > 4096) qualified.delete(qualified.keys().next().value!)
  }
  const scope = (context: TrustedDomainContext) => digestSfValue({ installationId: context.binding.installationId, projectId: context.binding.projectId, principalRef: context.binding.principalRef, policyVersion: context.binding.policyVersion, accessRevision: context.binding.accessRevision })
  const authorityDigest = (authority: PortfolioCoverageAuthority) => digestSfValue({ decision: authority.decision, selection: authority.selection, scenario: authority.scenario, storedResult: authority.storedResult, rule: authority.rule, basis: authority.basis, classification: authority.classification, baseline: authority.baseline, evidence: authority.evidence.map(({ ref, state, accessRevision }) => ({ ref, state, accessRevision })) })
  const detach = (authority: PortfolioCoverageAuthority): PortfolioCoverageAuthority => {
    const { isStillValid, ...data } = authority
    return { ...structuredClone(data), isStillValid }
  }
  const assess = (authority: PortfolioCoverageAuthority, scenario: ScenarioResult, classification: CoverageClassification) => assessCostCoverage({ basis: authority.basis, alternativeId: scenario.costCoverage.alternativeId, alternativeVersion: scenario.costCoverage.alternativeVersion, currency: scenario.currency, horizon: scenario.horizon, entries: scenario.costCoverage.entries, components: scenario.components, evidence: authority.evidence, supports: (entry, evidence) => supportsCoverageClassification(classification, entry, evidence) })
  const certificateFor = (authority: PortfolioCoverageAuthority, structural: PlannerDirectIntervalProof, context: TrustedDomainContext) => createCoverageIntervalCertificate({ decision: authority.decision, selection: authority.selection, scenario: authority.scenario, storedResult: authority.storedResult, rule: authority.rule, structural, assessment: authority.storedResult.costCoverage, basis: authority.basis, classification: authority.classification, evidence: authority.evidence, context })
  const current = async (intervalRef: string, context: TrustedDomainContext): Promise<PortResult<PortfolioCoverageAuthority>> => {
    prune()
    const saved = issued.get(intervalRef)
    if (!saved || saved.contextDigest !== scope(context)) return { status: "unavailable", reason: "coverage-interval-unissued" }
    const resolved = await input.resolveAuthority(structuredClone(saved.request), saved.interval.baselineRef, context)
    if (resolved.status !== "ok") return resolved
    const authority = detach(resolved.value)
    const digest = authorityDigest(authority)
    if (digest !== saved.authorityDigest || !await authority.isStillValid(context) || authorityDigest(resolved.value) !== digest) return { status: "stale", reason: "coverage-authority-changed" }
    const certificate = certificateFor(authority, saved.interval.structural, context)
    if (!certificate || digestSfValue(certificate) !== digestSfValue(saved.interval.certificate)) return { status: "stale", reason: "coverage-certificate-changed" }
    return { status: "ok", value: authority }
  }
  const issue = async (incoming: SensitivityRequest, baselineRef: string, context: TrustedDomainContext): Promise<PortResult<PortfolioCoverageInterval>> => {
    const request = structuredClone(incoming)
    const resolved = await input.resolveAuthority(structuredClone(request), baselineRef, context)
    if (resolved.status !== "ok") return resolved
    const authority = detach(resolved.value)
    const initialDigest = authorityDigest(authority)
    if (!await authority.isStillValid(context) || authorityDigest(resolved.value) !== initialDigest) return { status: "stale", reason: "coverage-authority-changed" }
    const selection = authority.selection
    const baseline = authority.decision.alternatives.filter((alternative) => alternative.id === selection.baselineAlternativeId)
    const classification = authority.baseline.classification
    if (selection.baselineRef !== baselineRef || selection.alternativeRef !== request.scenarioRef || selection.baselineAlternativeId === selection.alternativeId || selection.principalRef !== context.binding.principalRef || selection.accessRevision !== context.binding.accessRevision || selection.policyVersion !== context.binding.policyVersion || !authority.decision.participants.includes(context.binding.principalRef) || baseline.length !== 1 || digestSfValue(baseline[0]!.result) !== digestSfValue(authority.baseline.result) || classification.source.refId !== baseline[0]!.scenario.baseRef || authority.classification.source.refId !== authority.scenario.baseRef || !authority.decision.costCoverageBases.some((basis) => digestSfValue(basis) === digestSfValue(authority.basis))) return { status: "unavailable", reason: "coverage-selection-mismatch" }
    if (classification.schema !== "sf-coverage-classification-v1" || classification.classificationDigest !== classificationDigest(classification) || classification.caseRef.id !== authority.decision.id || classification.caseRef.incarnation !== authority.decision.incarnation || classification.caseRef.version > authority.decision.version || digestSfValue(classification.basis) !== digestSfValue(authority.basis)) return { status: "unavailable", reason: "baseline-classification-unavailable" }
    if (authority.rule.criterionId !== request.criterion.id || authority.rule.operator !== request.criterion.operator || authority.rule.value !== request.criterion.value || !Number.isFinite(request.criterion.value) || authority.storedResult.currency !== "USD" || authority.baseline.result.currency !== "USD" || digestSfValue(authority.baseline.result.horizon) !== digestSfValue(authority.storedResult.horizon)) return { status: "unavailable", reason: "coverage-rule-or-scope-mismatch" }
    if ([authority.storedResult, authority.baseline.result].some((result) => result.comparisonStatus === "unavailable" || result.comparisonStatus === "incompatible" || result.knownSubtotal === null || !Number.isFinite(result.knownSubtotal) || result.unresolvedConditions.some((condition) => !eligibleConditions.includes(condition)) || result.restrictions.some((restriction) => restriction !== "preview-not-applied"))) return { status: "unavailable", reason: "coverage-source-unresolved" }
    if (authority.evidence.some((item) => item.state !== "fresh" || item.accessRevision !== context.binding.accessRevision || !item.checkedAt.trim() || !Number.isFinite(Date.parse(item.checkedAt)))) return { status: "unavailable", reason: "coverage-evidence-unavailable" }
    const assessment = authority.storedResult.costCoverage
    const baselineAssessment = authority.baseline.result.costCoverage
    if (assessment.coverageState !== "complete" || baselineAssessment.coverageState !== "complete" || validateScenarioCoverage(authority.storedResult, authority.basis, assessment) || validateScenarioCoverage(authority.baseline.result, authority.basis, baselineAssessment) || assess(authority, authority.storedResult, authority.classification).coverageState !== "complete" || assess(authority, authority.baseline.result, classification).coverageState !== "complete") return { status: "unavailable", reason: "coverage-incomplete" }
    const structural = await prove(structuredClone(request), baselineRef, context)
    if (structural.status !== "ok") return structural
    if (plannerComponentDigest(authority.storedResult.components.filter((component) => component.id !== structural.value.parameterRef)) !== structural.value.fixedComponentsDigest || digestSfValue(authority.storedResult.components.map((component) => component.id)) !== digestSfValue(structural.value.componentIds)) return { status: "stale", reason: "coverage-stored-components-changed" }
    const certificate = certificateFor(authority, structural.value, context)
    if (!certificate) return { status: "unavailable", reason: "coverage-interval-unproven" }
    const refs = [...authority.evidence.map((item) => item.ref), ...structural.value.sourceRefs].filter((ref, index, all) => all.findIndex((other) => digestSfValue(other) === digestSfValue(ref)) === index)
    const body = { requestDigest: digestSfValue(request), baselineRef, certificate, structural: structural.value, assessment, baselineAssessment, evidenceRefs: refs }
    const interval: PortfolioCoverageInterval = structuredClone({ intervalRef: `portfolio-coverage-interval:${digestSfValue(body)}`, ...body })
    issued.set(interval.intervalRef, { request, interval, authorityDigest: initialDigest, contextDigest: scope(context), scenario: structuredClone(authority.scenario), expiresAt: Date.now() + 300_000 })
    prune()
    const checked = await current(interval.intervalRef, context)
    if (checked.status !== "ok") { issued.delete(interval.intervalRef); return checked }
    return { status: "ok", value: structuredClone(interval) }
  }
  const revalidate = async (intervalRef: string, context: TrustedDomainContext) => {
    const saved = issued.get(intervalRef)
    const authority = await current(intervalRef, context)
    if (!saved || authority.status !== "ok") return false
    const structural = await prove(structuredClone(saved.request), saved.interval.baselineRef, context)
    return structural.status === "ok" && digestSfValue(structural.value) === digestSfValue(saved.interval.structural) && (await current(intervalRef, context)).status === "ok"
  }
  const qualify = async (intervalRef: string, parameterValue: number, incoming: PortfolioCoveragePreview, context: TrustedDomainContext): Promise<PortResult<PortfolioCoverageQualification>> => {
    const preview = structuredClone(incoming)
    const saved = issued.get(intervalRef)
    const authority = await current(intervalRef, context)
    if (authority.status !== "ok") return authority
    if (!saved || !Number.isFinite(parameterValue) || parameterValue < saved.interval.structural.minimum || parameterValue > saved.interval.structural.maximum) return { status: "unavailable", reason: "coverage-parameter-outside-interval" }
    const structural = saved.interval.structural
    if (!exactComponents(preview.sample, structural.parameterRef, parameterValue) || plannerComponentDigest(preview.sample.components.filter((component) => component.id !== structural.parameterRef)) !== structural.fixedComponentsDigest || digestSfValue(preview.sample.components.map((component) => component.id)) !== digestSfValue(structural.componentIds) || preview.sample.currency !== structural.unit || digestSfValue(preview.sample.horizon) !== digestSfValue(structural.period) || preview.sample.costCoverage.basisId !== authority.value.basis.id || preview.sample.costCoverage.basisVersion !== authority.value.basis.version) return { status: "unavailable", reason: "coverage-preview-outside-proof" }
    if (preview.sample.comparisonStatus !== "conditioned" || preview.sample.total !== null || preview.comparison.comparisonStatus !== "conditioned" || preview.comparison.completeDifference !== null || preview.comparison.baselineResultRef !== saved.interval.baselineRef || preview.comparison.alternativeResultRef !== preview.sample.id || preview.metric.metricRef !== "planner:known-subtotal-difference" || preview.metric.state !== "conditioned" || preview.metric.value === null || !Number.isFinite(preview.metric.value) || preview.metric.value !== preview.comparison.knownDifference || preview.metric.engineVersion !== structural.engineVersion || preview.metric.unit !== structural.unit || digestSfValue(preview.metric.period) !== digestSfValue(structural.period)) return { status: "unavailable", reason: "coverage-preview-metric-mismatch" }
    if ([...preview.sample.unresolvedConditions, ...preview.comparison.unresolvedConditions].some((condition) => !eligibleConditions.includes(condition)) || preview.sample.restrictions.some((restriction) => restriction !== "preview-not-applied")) return { status: "unavailable", reason: "coverage-preview-unresolved" }
    const scenario = { ...saved.scenario, operations: saved.scenario.operations.length ? saved.scenario.operations.map((operation) => operation.targetRef === structural.parameterRef ? { ...operation, amount: parameterValue } : operation) : structural.parameterOperation ? [{ ...structural.parameterOperation, amount: parameterValue }] : [] }
    const replay = await input.preview({ baselineRef: saved.interval.baselineRef, scenario }, context)
    if (replay.status !== "ok") return replay
    if (plannerPreviewDigest(replay.value) !== plannerPreviewDigest(preview)) return { status: "stale", reason: "coverage-preview-changed" }
    const assessment = assessCostCoverage({ basis: authority.value.basis, alternativeId: preview.sample.costCoverage.alternativeId, alternativeVersion: preview.sample.costCoverage.alternativeVersion, currency: preview.sample.currency, horizon: preview.sample.horizon, entries: saved.interval.assessment.entries, components: preview.sample.components, evidence: authority.value.evidence, supports: (entry, evidence) => supportsCoverageClassification(authority.value.classification, entry, evidence) })
    if (assessment.coverageState !== "complete" || validateScenarioCoverage({ ...preview.sample, costCoverage: assessment }, authority.value.basis, assessment)) return { status: "unavailable", reason: "coverage-preview-incomplete" }
    const checked = await current(intervalRef, context)
    if (checked.status !== "ok") return checked
    const qualification: PortfolioCoverageQualification = { schema: "sf-portfolio-coverage-preview-v1", intervalRef, certificateDigest: saved.interval.certificate.certificateDigest, requestDigest: saved.interval.requestDigest, sampleDigest: plannerPreviewDigest(preview), scenarioDigest: plannerScenarioDigest(preview.sample), parameterValue, metricValue: preview.metric.value, assessment, baselineAssessment: saved.interval.baselineAssessment, evidenceRefs: saved.interval.evidenceRefs, resolvedCoverageConditions: coverageConditions.filter((condition) => preview.sample.unresolvedConditions.includes(condition) || preview.comparison.unresolvedConditions.includes(condition)), hypotheticalConditions: hypotheticalConditions.filter((condition) => preview.sample.unresolvedConditions.includes(condition) || preview.comparison.unresolvedConditions.includes(condition)) }
    qualified.set(digestSfValue(qualification), intervalRef)
    prune()
    return { status: "ok", value: structuredClone(qualification) }
  }
  const verify = async (qualification: PortfolioCoverageQualification, context: TrustedDomainContext) => {
    const value = structuredClone(qualification)
    if (!qualified.has(digestSfValue(value)) || !await revalidate(value.intervalRef, context)) return false
    const saved = issued.get(value.intervalRef)
    if (!saved) return false
    const structural = saved.interval.structural
    const scenario = { ...saved.scenario, operations: saved.scenario.operations.length ? saved.scenario.operations.map((operation) => operation.targetRef === structural.parameterRef ? { ...operation, amount: value.parameterValue } : operation) : structural.parameterOperation ? [{ ...structural.parameterOperation, amount: value.parameterValue }] : [] }
    const preview = await input.preview({ baselineRef: saved.interval.baselineRef, scenario }, context)
    if (preview.status !== "ok") return false
    const replay = await qualify(value.intervalRef, value.parameterValue, preview.value, context)
    return replay.status === "ok" && digestSfValue(replay.value) === digestSfValue(value)
  }
  return { issue, qualify, revalidate, verify }
}
