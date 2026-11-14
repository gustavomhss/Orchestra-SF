import type { DomainProjection, ProductContext } from "../contracts/context.ts"
import type { ScenarioComparison, ScenarioResult } from "../contracts/decisions.ts"
import type { SensitivityResult } from "../contracts/outputs.ts"

export const biViews = [
  { id: "BI01", question: "Como orçamento, realizado e outlook evoluem?", unit: "currency", producer: "dashboard/planner" },
  { id: "BI02", question: "Quais componentes explicam a diferença?", unit: "currency", producer: "planner" },
  { id: "BI03", question: "O que contribui para o desvio?", unit: "currency", producer: "dashboard/planner" },
  { id: "BI04", question: "Como capacidade e custo se distribuem?", unit: "fte/currency", producer: "dashboard/planner" },
  { id: "BI05", question: "Onde estão os pedidos abertos?", unit: "count", producer: "procurement" },
  { id: "BI06", question: "Quais aprovações aguardam mais tempo?", unit: "days", producer: "procurement" },
  { id: "BI07", question: "O que entrou e foi concluído?", unit: "count", producer: "dashboard" },
  { id: "BI08", question: "Quais marcos estão previstos ou concluídos?", unit: "date", producer: "dashboard" },
  { id: "BI09", question: "Quais parcelas sustentam a alternativa?", unit: "currency", producer: "decisions/portfolio" },
  { id: "BI10", question: "Qual data altera custo ou viabilidade?", unit: "date", producer: "decisions/portfolio" },
  { id: "BI11", question: "Qual variável altera a condição?", unit: "parameter", producer: "portfolio" },
] as const

export type BiViewId = (typeof biViews)[number]["id"]
/** visualPeriod is a display crop; context and reference retain the original authorized scope. */
export type BiSelection = { context: ProductContext; visualPeriod?: ProductContext["period"]; selectionRef: string; projectionVersion: number; engineVersion: string; valueId: string; reference: DomainProjection["values"][number]["drilldown"] }

/** Consumer-facing C08 registration; producer and drilldown resolution stay host-owned. */
export const consumableBiCatalog = biViews.slice(0, 8).map((view) => ({
  ...view,
  operation: "sf_bi_view" as const,
  filters: ["selectionRef", "period", "viewId"] as const,
  absence: "preserve-missing-and-restricted-values" as const,
  drilldown: "host-revalidate-projection-value-reference" as const,
}))

export function presentProjection(projection: DomainProjection, selectionRef: string) {
  const rows = projection.values.map((value) => ({
    ...value,
    value: value.evidenceState === "absent" || (typeof value.value === "number" && !Number.isFinite(value.value)) ? null : value.value,
    selection: { context: projection.context, selectionRef, projectionVersion: projection.version, engineVersion: projection.engineVersion, valueId: value.id, reference: value.drilldown } satisfies BiSelection,
  }))
  return { context: projection.context, version: projection.version, engineVersion: projection.engineVersion, rows, missing: projection.missing }
}

export function presentScenario(result: ScenarioResult, comparison: ScenarioComparison) {
  const inconsistent = (comparison.comparisonStatus === "complete" && (result.comparisonStatus !== "complete" || !comparison.costCoverageRefs.length || comparison.costCoverageRefs.some((reference) => !reference.trim()))) || (result.comparisonStatus === "complete" && (result.total === null || !Number.isFinite(result.total) || result.components.some((component) => component.evidenceState !== "confirmed" || component.amount === null || !Number.isFinite(component.amount))))
  return {
    resultId: result.id,
    version: result.version,
    currency: result.currency,
    horizon: result.horizon,
    status: inconsistent ? "incompatible" : comparison.comparisonStatus,
    knownSubtotal: result.knownSubtotal !== null && Number.isFinite(result.knownSubtotal) ? result.knownSubtotal : null,
    total: !inconsistent && result.total !== null && Number.isFinite(result.total) ? result.total : null,
    difference: !inconsistent && comparison.knownDifference !== null && Number.isFinite(comparison.knownDifference) ? comparison.knownDifference : null,
    conditions: [...result.unresolvedConditions, ...comparison.unresolvedConditions, ...(inconsistent ? ["Resultado ou comparação completa contém dados incompatíveis ou ausentes."] : [])],
    costCoverageRefs: comparison.costCoverageRefs,
    sourceRefs: result.sourceRefs,
    coverage: result.costCoverage,
    rows: result.components.map((component) => ({ ...component, amount: component.evidenceState !== "absent" && component.amount !== null && Number.isFinite(component.amount) ? component.amount : null })),
  }
}

export function presentSensitivity(result: SensitivityResult) {
  const provenance = !!result.unit.trim() && !!result.engineVersion.trim() && result.costCoverageRefs.length > 0 && result.costCoverageRefs.every((ref) => !!ref.trim())
  const boundsValid = Number.isFinite(result.bounds.minimum) && Number.isFinite(result.bounds.maximum) && result.bounds.minimum <= result.bounds.maximum && Number.isSafeInteger(result.bounds.steps) && result.bounds.steps > 0
  const evidence = result.thresholdEvidence
  const evidenceValid = evidence.state === "unavailable" ? result.threshold === null && !!evidence.reason.trim() : evidence.state === "exact"
    ? provenance && boundsValid && evidence.evidenceRefs.length > 0 && Number.isFinite(evidence.value) && evidence.value >= result.bounds.minimum && evidence.value <= result.bounds.maximum && result.threshold === evidence.value
    : provenance && boundsValid && evidence.evidenceRefs.length > 0 && result.threshold === null && Number.isFinite(evidence.interval.minimum) && Number.isFinite(evidence.interval.maximum) && evidence.interval.minimum <= evidence.interval.maximum && evidence.interval.minimum >= result.bounds.minimum && evidence.interval.maximum <= result.bounds.maximum && result.evaluated.some((point) => point.parameterValue === evidence.interval.minimum) && result.evaluated.some((point) => point.parameterValue === evidence.interval.maximum)
  const thresholdEvidence = evidenceValid ? evidence : { state: "unavailable" as const, reason: "invalid-threshold-evidence" }
  const threshold = thresholdEvidence.state === "exact" ? thresholdEvidence.value : null
  const comparisonStatus = provenance && !(result.comparisonStatus === "complete" && result.unresolvedConditions.length) ? result.comparisonStatus : "unavailable" as const
  return { ...result, comparisonStatus, threshold, thresholdEvidence, evaluated: result.evaluated.map((point) => ({ ...point, parameterValue: Number.isFinite(point.parameterValue) ? point.parameterValue : null, value: point.value !== null && Number.isFinite(point.value) ? point.value : null })) }
}
