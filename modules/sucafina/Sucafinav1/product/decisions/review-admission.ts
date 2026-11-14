import { digestSfValue } from "../contracts/canonical.ts"
import type { TrustedUiContext } from "../contracts/sf-execution.ts"
import type { createDecisionIntentFences } from "./intent-fences.ts"
import { sameApplyRequest, type AdmittedApply, type ReviewDigestFor } from "./receipt-review-binding.ts"

/** Keeps the reviewed digest attached to the exact admitted human action, not the public C12 command. */
export function createDecisionReviewAdmission(ui: Parameters<typeof createDecisionIntentFences>[0]["ui"]) {
  const admitted = new WeakMap<TrustedUiContext, AdmittedApply>()
  const bind = (context: TrustedUiContext, request: AdmittedApply) => { admitted.set(context, structuredClone(request)) }
  const get: ReviewDigestFor = (context, request) => {
    const value = context.kind === "ui" ? admitted.get(context) : undefined
    if (!value || !sameApplyRequest(value, request) || context.kind !== "ui" || !ui.matchesIntent(context, "sf-human:decisions.apply", digestSfValue(value))) return undefined
    return value.reviewDigest
  }
  const payload = (context: TrustedUiContext, request: Omit<AdmittedApply, "reviewDigest">) => {
    const value = admitted.get(context)
    return value && sameApplyRequest(value, request) && ui.matchesIntent(context, "sf-human:decisions.apply", digestSfValue(value)) ? value : undefined
  }
  return { bind, get, payload }
}
