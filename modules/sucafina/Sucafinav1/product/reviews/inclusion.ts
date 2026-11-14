import type { ReviewOutcomeComparison } from "./outcome.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { DomainProjection, PreservedReview } from "../contracts/context.ts"
import type { ObservedResultProjection } from "../contracts/decisions.ts"
import { renderReviewBars, renderReviewChart, renderReviewSensitivity, renderReviewTimeline, renderReviewWaterfall } from "./chart.ts"
import { reviewDecisionEvidence } from "./decision.ts"
import { reviewChartEvidence } from "./port.ts"
import { validReviewDecision } from "./decision.ts"
import { validReviewOutcome, validOutcomeComparison } from "./outcome.ts"
import { matchesSelectedSources } from "./references.ts"
import type { ReviewChart } from "./port.ts"

/** Describes only content the renderer actually emitted, never infers a decision-case association. */
export function reviewInclusion(review: PreservedReview, sectionRefs: readonly string[]) {
  const sections = sectionRefs.map((id) => review.sections.find((section) => section.id === id))
  if (new Set(sectionRefs).size !== sectionRefs.length || sections.some((section) => !section)) return undefined
  const selectedRefs = sections.flatMap((section) => section?.sourceRefs ?? [])
  return {
    reviewRef: review.id,
    reviewVersion: review.version,
    reviewDigest: digestSfValue(review),
    sections: sections.map((section) => {
      const projection = section!.content as DomainProjection & { reviewChart?: ReviewChart; reviewOutcome?: ObservedResultProjection; reviewOutcomeComparison?: ReviewOutcomeComparison }
      const decision = projection.decision && validReviewDecision(projection.decision) ? projection.decision : undefined
      const chart = projection.reviewChart
      const line = renderReviewChart(projection, chart)
      const scatter = renderReviewSensitivity(projection, chart)
      const images = line ? [line] : renderReviewBars(projection, chart) ?? renderReviewTimeline(projection, chart) ?? renderReviewWaterfall(projection, chart) ?? (scatter ? [scatter] : [])
      const chartIncluded = images.length > 0
      return {
        sectionRef: section!.id,
        sectionDigest: digestSfValue(section),
        recordCount: section!.count,
        decisionResults: decision?.kind === "scenario" ? [{ resultRef: decision.scenarioResultRef, resultDigest: digestSfValue(decision.scenario), comparisonRef: decision.comparisonRef, comparisonDigest: digestSfValue(decision.comparison) }] : decision?.kind === "portfolio" ? decision.portfolio.combinations.flatMap((item) => item.analysis ? [{ resultRef: item.analysis.scenarioResultRef, resultDigest: digestSfValue(item.analysis.scenario), comparisonRef: item.analysis.comparisonRef, comparisonDigest: digestSfValue(item.analysis.comparison) }] : []) : [],
        ...(decision?.kind === "portfolio" ? { portfolio: { resultRef: decision.portfolioResultRef, resultDigest: digestSfValue(decision.portfolio) } } : {}),
        ...(projection.reviewOutcomeComparison && validOutcomeComparison(projection.reviewOutcomeComparison) ? { outcomeComparison: { caseRef: projection.reviewOutcomeComparison.caseRef, choiceId: projection.reviewOutcomeComparison.choiceId, digest: digestSfValue(projection.reviewOutcomeComparison) } } : {}),
        ...(projection.reviewOutcome && validReviewOutcome(projection.reviewOutcome) ? { outcome: { caseRef: projection.reviewOutcome.caseRef, digest: digestSfValue(projection.reviewOutcome) } } : {}),
        ...(chartIncluded && chart?.status === "ok" ? { chart: { viewId: chart.viewId, digest: digestSfValue(chart) } } : {}),
        sourceRefs: [...projection.values.flatMap((value) => value.sourceRefs), ...reviewChartEvidence(chart), ...reviewDecisionEvidence(decision), ...(projection.reviewOutcome?.sourceRefs ?? []), ...(projection.reviewOutcomeComparison?.baselineRefs ?? []), ...(projection.reviewOutcomeComparison?.sourceRefs ?? [])],
      }
    }),
    comments: review.comments.filter((comment) => matchesSelectedSources(comment.sourceRefs, selectedRefs)).map((comment) => ({ id: comment.id, version: comment.version, digest: digestSfValue(comment) })),
  }
}

export type ReviewInclusion = NonNullable<ReturnType<typeof reviewInclusion>>
