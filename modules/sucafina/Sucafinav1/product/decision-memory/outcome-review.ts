import { digestSfValue } from "../contracts/canonical.ts"
import type { ObservedResultProjection } from "../contracts/decisions.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createSfObservedOutcomeAccess } from "./outcome.ts"

/** The review owner persists and reauthorizes the returned observation and comparison. */
export function createSfReviewOutcomeAdapter(access: ReturnType<typeof createSfObservedOutcomeAccess>) {
  return async (request: { caseRef: ObservedResultProjection["caseRef"]; choiceId: string }, call: TrustedDomainContext) => {
    try {
      const result = await access(request, call)
      if (result.status !== "comparable" || digestSfValue(result.observation.caseRef) !== digestSfValue(request.caseRef)) return { status: "unavailable" as const }
      return { status: "ready" as const, observation: result.observation, comparison: result }
    } catch {
      return { status: "unavailable" as const }
    }
  }
}
