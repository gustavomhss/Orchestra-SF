import type { DomainProjection, ProductContext, ProjectionComponent } from "../contracts/context.ts"
import { digestSfValue } from "../contracts/canonical.ts"

/** Re-observing an unchanged source does not change its identity or the selected scope. */
export function sameBiContext(left: ProductContext, right: ProductContext) {
  const normalize = (context: ProductContext) => ({ ...context, sourceRefs: context.sourceRefs.map((reference) => ({ ...reference, observedAt: "" })) })
  return digestSfValue(normalize(left)) === digestSfValue(normalize(right))
}

/** Observation time is not part of source identity; all other decision data is compared. */
export function sameBiProjection(left: DomainProjection, right: DomainProjection) {
  const components = (values: readonly ProjectionComponent[]) => values.map((component) => ({ ...component, sourceRefs: component.sourceRefs.map((reference) => ({ ...reference, observedAt: "" })) }))
  const normalize = (projection: DomainProjection) => ({
    ...projection,
    context: { ...projection.context, sourceRefs: projection.context.sourceRefs.map((reference) => ({ ...reference, observedAt: "" })) },
    ...(projection.comparison ? { comparison: { ...projection.comparison, context: { ...projection.comparison.context, sourceRefs: projection.comparison.context.sourceRefs.map((reference) => ({ ...reference, observedAt: "" })) } } } : {}),
    components: components(projection.components),
    ...(projection.decision?.kind === "scenario" ? { decision: { ...projection.decision, scenario: { ...projection.decision.scenario, components: components(projection.decision.scenario.components) } } }
      : projection.decision?.kind === "portfolio" ? { decision: { ...projection.decision, portfolio: { ...projection.decision.portfolio, combinations: projection.decision.portfolio.combinations.map((combination) => ({ ...combination, components: components(combination.components), ...(combination.analysis ? { analysis: { ...combination.analysis, scenario: { ...combination.analysis.scenario, components: components(combination.analysis.scenario.components) } } } : {}) })) } } }
        : {}),
  })
  return digestSfValue(normalize(left)) === digestSfValue(normalize(right))
}

/** The producer and host must still verify the persisted references and every dependency. */
export function hasBiDecision(projection: DomainProjection, viewId?: string) {
  const decision = projection.decision
  if (!decision) return false
  if (decision.kind === "portfolio") return viewId !== "BI11" && !!decision.portfolioResultRef.trim()
  const hasSensitivityRef = "sensitivityResultRef" in decision
  if (hasSensitivityRef && (typeof decision.sensitivityResultRef !== "string" || !decision.sensitivityResultRef.trim())) return false
  if (!!decision.sensitivity !== hasSensitivityRef || (viewId === "BI11" && !decision.sensitivity)) return false
  return !!decision.scenarioResultRef.trim() && !!decision.comparisonRef.trim()
}
