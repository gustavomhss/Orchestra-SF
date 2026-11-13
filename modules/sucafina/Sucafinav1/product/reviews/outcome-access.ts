import { digestSfValue } from "../contracts/canonical.ts"
import type { ObservedResultProjection } from "../contracts/decisions.ts"
import type { DomainPortHost } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { validOutcomeComparison } from "./outcome.ts"
import type { ReviewOutcomeComparison } from "./outcome.ts"

/** Reopens the WP14 producer output under the current identity before a snapshot can leave. */
export function createReviewOutcomeComparisonAccess(input: {
  host: Pick<DomainPortHost, "revalidate">
  read: (request: { caseRef: ObservedResultProjection["caseRef"]; choiceId: string }, context: TrustedDomainContext) => Promise<{ status: "ready"; observation: ObservedResultProjection; comparison: ReviewOutcomeComparison } | { status: "unavailable" }>
}) {
  return async (context: TrustedDomainContext, comparisons: readonly ReviewOutcomeComparison[]) => {
    if (!await input.host.revalidate(context) || comparisons.some((comparison) => !validOutcomeComparison(comparison))) return false
    const load = () => Promise.all(comparisons.map((comparison) => input.read({ caseRef: comparison.caseRef, choiceId: comparison.choiceId }, context)))
    const same = (values: Awaited<ReturnType<typeof load>>) => values.every((value, index) => value.status === "ready" && digestSfValue(value.comparison) === digestSfValue(comparisons[index]) && digestSfValue(value.observation) === digestSfValue(comparisons[index]?.observation))
    const first = await load()
    if (!same(first) || !await input.host.revalidate(context)) return false
    const second = await load()
    return same(second) && digestSfValue(first) === digestSfValue(second) && await input.host.revalidate(context)
  }
}
