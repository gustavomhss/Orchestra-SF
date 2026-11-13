import { digestSfValue } from "../contracts/canonical.ts"
import type { ObservedResultProjection } from "../contracts/decisions.ts"
import type { DomainPortHost } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { validOutcomeComparison } from "./outcome.ts"
import type { ReviewOutcomeComparison } from "./outcome.ts"

/** Reopens the WP14 producer output under the current identity before a snapshot can leave. */
export function createReviewOutcomeComparisonAccess(input: {
  host: Pick<DomainPortHost, "revalidate">
  read: (request: { caseRef: ObservedResultProjection["caseRef"]; choiceId: string; cutoff: string }, context: TrustedDomainContext) => Promise<{ status: "ready"; observation: ObservedResultProjection; comparison: ReviewOutcomeComparison } | { status: "unavailable" }>
}) {
  return async (context: TrustedDomainContext, comparisons: readonly ReviewOutcomeComparison[]) => {
    try {
      const captured = structuredClone(comparisons)
      const binding = digestSfValue([context.kind, context.binding])
      if (!await input.host.revalidate(context) || captured.some((comparison) => !validOutcomeComparison(comparison))) return false
      const load = () => Promise.all(captured.map((comparison) => input.read({ caseRef: comparison.caseRef, choiceId: comparison.choiceId, cutoff: comparison.cutoff }, context)))
      const same = (values: Awaited<ReturnType<typeof load>>) => values.every((value, index) => value.status === "ready" && digestSfValue(value.comparison) === digestSfValue(captured[index]) && digestSfValue(value.observation) === digestSfValue(captured[index]?.observation))
      const first = await load()
      if (!same(first) || !await input.host.revalidate(context)) return false
      const second = await load()
      return same(second) && digestSfValue(first) === digestSfValue(second) && digestSfValue(comparisons) === digestSfValue(captured) && digestSfValue([context.kind, context.binding]) === binding && await input.host.revalidate(context)
    } catch { return false }
  }
}
