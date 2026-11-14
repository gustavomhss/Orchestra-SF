import { digestSfValue } from "../contracts/canonical.ts"
import { requiredSfCostCategories } from "../contracts/coverage-inventory.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../contracts/business-context.ts"
import type { Period } from "../contracts/context.ts"
import type { CostCoverageAssessment, CostCoverageBasis, DecisionCase, ScenarioResult } from "../contracts/decisions.ts"
import type { ScenarioRequest } from "../contracts/operations.ts"
import type { CriterionRule } from "./criterion-rules.ts"
import type { CoverageClassification } from "./coverage-classification.ts"
import { classificationDigest, supportsCoverageClassification } from "./coverage-classification.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { validateScenarioCoverage } from "./cost-coverage.ts"
import type { PortfolioSelection } from "./portfolio-selection.ts"

export type PlannerDirectIntervalProof = {
  kind: "planner-direct-usd-v1"
  baselineRef: string
  scenarioRef: string
  scenarioDigest: string
  metadataDigest: string
  engineVersion: string
  parameterRef: string
  minimum: number
  maximum: number
  period: Period
  unit: "USD"
  componentIds: readonly string[]
  fixedComponentsDigest: string
  sourceRefs: readonly BusinessEvidenceRef[]
}
export type CoverageIntervalCertificate = {
  schema: "sf-coverage-interval-v1"
  caseRef: { id: string; incarnation: string; version: number }
  selectionRef: string
  ruleRef: string
  ruleVersion: number
  scenarioRef: string
  bounds: { parameterRef: string; minimum: number; maximum: number }
  structuralDigest: string
  selectionDigest: string
  ruleDigest: string
  resultDigest: string
  basisDigest: string
  classificationDigest: string
  assessmentDigest: string
  evidenceDigest: string
  certificateDigest: string
}

function fresh(ref: BusinessEvidenceRef, evidence: readonly BusinessEvidenceResolution[], accessRevision: string) {
  return evidence.some((item) => item.state === "fresh" && item.accessRevision === accessRevision && item.checkedAt.trim() && Number.isFinite(Date.parse(item.checkedAt)) && digestSfValue(item.ref) === digestSfValue(ref))
}

/** Checks coverage against a producer-verified interval; callers must authenticate and fence the producer proof. */
export function createCoverageIntervalCertificate(input: {
  decision: DecisionCase
  selection: PortfolioSelection
  scenario: ScenarioRequest
  storedResult: ScenarioResult
  rule: CriterionRule
  structural: PlannerDirectIntervalProof
  assessment: CostCoverageAssessment
  basis: CostCoverageBasis
  classification: CoverageClassification
  evidence: readonly BusinessEvidenceResolution[]
  context: TrustedDomainContext
}): CoverageIntervalCertificate | undefined {
  const caseRef = { id: input.decision.id, incarnation: input.decision.incarnation, version: input.decision.version }
  const alternatives = input.decision.alternatives.filter((item) => item.id === input.selection.alternativeId)
  if (input.selection.schema !== "sf-portfolio-selection-v1" || input.selection.selectionDigest !== digestSfValue(Object.fromEntries(Object.entries(input.selection).filter(([key]) => key !== "selectionDigest"))) || digestSfValue(input.selection.caseRef) !== digestSfValue(caseRef) || input.selection.alternativeRef !== input.structural.scenarioRef || input.selection.baselineRef !== input.structural.baselineRef || !input.selection.criteria.includes(input.rule.criterionId) || alternatives.length !== 1 || digestSfValue(alternatives[0]!.scenario) !== digestSfValue(input.scenario) || digestSfValue(alternatives[0]!.result) !== digestSfValue(input.storedResult) || digestSfValue(input.storedResult.costCoverage) !== digestSfValue(input.assessment)) return undefined
  if (validateScenarioCoverage(input.storedResult, input.basis, input.assessment) || input.assessment.currency !== "USD" || input.storedResult.currency !== "USD") return undefined
  if (input.assessment.coverageState !== "complete" || input.assessment.issues.length || input.assessment.derivedMissingCategoryIds.length || input.assessment.entries.some((entry) => entry.status === "pending" || entry.status === "not-applicable")) return undefined
  const categories = requiredSfCostCategories(input.basis)
  if (!categories || input.assessment.entries.length !== categories.length || categories.some((category) => input.assessment.entries.filter((entry) => entry.categoryId === category).length !== 1)) return undefined
  if (input.structural.kind !== "planner-direct-usd-v1" || input.structural.engineVersion !== "planner-runtime-v1" || input.structural.unit !== "USD" || input.rule.unit !== "USD" || input.rule.schema !== "sf-criterion-rule-v1" || digestSfValue(input.rule.period) !== digestSfValue(input.structural.period) || digestSfValue(input.assessment.horizon) !== digestSfValue(input.structural.period)) return undefined
  if (!input.structural.sourceRefs.length || !input.structural.baselineRef.trim() || !input.structural.scenarioRef.trim() || !input.structural.metadataDigest.trim() || !input.structural.fixedComponentsDigest.trim()) return undefined
  if (input.structural.scenarioDigest !== digestSfValue(input.scenario) || input.scenario.assumptions.length || input.scenario.operations.length !== 1) return undefined
  const operation = input.scenario.operations[0]
  if (!operation || operation.kind !== "replace" || operation.replacementRef !== undefined || operation.targetRef !== input.structural.parameterRef || operation.targetRef.startsWith("HR:") || operation.currency !== "USD") return undefined
  if (!(input.structural.minimum < input.structural.maximum) || !Number.isFinite(input.structural.minimum) || !Number.isFinite(input.structural.maximum)) return undefined
  if (input.classification.schema !== "sf-coverage-classification-v1" || input.classification.classificationDigest !== classificationDigest(input.classification) || input.classification.caseRef.id !== caseRef.id || input.classification.caseRef.incarnation !== caseRef.incarnation || input.classification.caseRef.version > caseRef.version || digestSfValue(input.classification.basis) !== digestSfValue(input.basis)) return undefined
  if (input.rule.caseRef.id !== caseRef.id || input.rule.caseRef.incarnation !== caseRef.incarnation || input.rule.caseRef.version > caseRef.version || input.rule.accessRevision !== input.context.binding.accessRevision) return undefined
  if (input.rule.recordDigest !== digestSfValue(Object.fromEntries(Object.entries(input.rule).filter(([key]) => key !== "recordDigest"))) || !input.rule.sensitivity || input.rule.sensitivity.baselineRef !== input.structural.baselineRef || input.rule.sensitivity.parameterRef !== input.structural.parameterRef || input.rule.sensitivity.parameterUnit !== "USD" || input.rule.sensitivity.resultUnit !== "USD" || input.rule.sensitivity.engineVersion !== input.structural.engineVersion) return undefined
  const included = input.assessment.entries.filter((entry) => entry.status === "included")
  const refs = included.flatMap((entry) => entry.componentRefs)
  if (!included.length || new Set(refs).size !== refs.length || !refs.includes(input.structural.parameterRef)) return undefined
  if (digestSfValue([...input.structural.componentIds].sort()) !== digestSfValue([...refs].sort()) || input.structural.componentIds.length !== refs.length) return undefined
  if (included.some((entry) => !supportsCoverageClassification(input.classification, entry, input.evidence))) return undefined
  const sources = [input.classification.source, ...input.structural.sourceRefs, ...input.basis.sourceRefs, ...input.assessment.evaluatedSourceRefs, ...input.assessment.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs), ...input.rule.evidenceRefs, ...input.rule.sensitivity.sourceRefs]
  if (sources.some((ref) => !fresh(ref, input.evidence, input.context.binding.accessRevision))) return undefined
  const body = { schema: "sf-coverage-interval-v1" as const, caseRef, selectionRef: input.selection.selectionRef, ruleRef: input.rule.ruleRef, ruleVersion: input.rule.version, scenarioRef: input.structural.scenarioRef, bounds: { parameterRef: input.structural.parameterRef, minimum: input.structural.minimum, maximum: input.structural.maximum }, structuralDigest: digestSfValue(input.structural), selectionDigest: digestSfValue(input.selection), ruleDigest: digestSfValue(input.rule), resultDigest: digestSfValue(input.storedResult), basisDigest: digestSfValue(input.basis), classificationDigest: input.classification.classificationDigest, assessmentDigest: digestSfValue(input.assessment), evidenceDigest: digestSfValue(sources), certificateDigest: "" }
  return { ...body, certificateDigest: digestSfValue(Object.fromEntries(Object.entries(body).filter(([key]) => key !== "certificateDigest"))) }
}
