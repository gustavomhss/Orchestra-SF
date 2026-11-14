import { canonicalSfValue, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessContextService } from "../contracts/business-context.ts"
import type { SfDomainValidation } from "../contracts/runtime.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import type { createSfUiAuthority } from "../integration/ui-authority.ts"
import { dispatchSfCapability } from "../host-binding/capability-dispatch.ts"
import type { createSfRoutineProduct } from "../routines/factory.ts"
import { createRoutineReviewResultReader } from "../routines/review-result.ts"
import type { ReviewHost } from "./port.ts"

/** Reauthorize each UI read on the original Request; a native context never becomes a UI lease. */
export function createReviewRoutineReader(input: {
  product: Pick<ReturnType<typeof createSfRoutineProduct>, "openResult" | "descriptors">
  ui: ReturnType<typeof createSfUiAuthority>
  authority: SfDomainValidation
  evidence: Pick<BusinessContextService, "resolve">
  access: Pick<ReviewHost, "authorizeSections" | "authorizeComments" | "authorizeOutcomeComparison" | "authorizeOutcome" | "authorizeDecision" | "authorizeSensitivity" | "revalidate">
}) {
  return createRoutineReviewResultReader({
    openResult: async (runRef, context) => {
      if (context.kind !== "ui") return input.product.openResult(runRef, context)
      const request = input.ui.requestFor(context)
      if (!request || !await input.ui.revalidate(context)) return { status: "denied", reason: "routine-review-authority-unavailable" }
      const payload = { runRef }
      const admitted = await input.ui.admit(request, "sf_routine_result", digestSfValue(payload))
      if (admitted.status !== "ok") return admitted
      try {
        if ((["installationId", "projectId", "principalRef", "accessRevision", "policyVersion"] as const).some((key) => admitted.value.binding[key] !== context.binding[key])) return { status: "denied", reason: "routine-review-authority-changed" }
        const dispatched = await dispatchSfCapability({
          operation: "sf_routine_result", payload, context: admitted.value, descriptors: input.product.descriptors, authority: input.authority,
          validateInput: (_descriptor, value) => decodeSfOperationInput("sf_routine_result", value).ok,
          validateOutput: (_descriptor, value) => value.status !== "ok" || decodeSfOperationOutput("sf_routine_result", value.result).ok,
        })
        if (dispatched.status !== "ok") return { status: dispatched.status === "denied" ? "denied" : "unavailable", reason: "routine-review-result-unavailable" }
        const opened = await input.product.openResult(runRef, admitted.value)
        if (opened.status !== "ok") return opened
        if (digestSfValue(dispatched.result) !== digestSfValue(opened.value.run) || input.ui.requestFor(context) !== request || !await input.ui.revalidate(context) || !await input.ui.revalidate(admitted.value)) return { status: "denied", reason: "routine-review-authority-changed" }
        return opened
      } finally { input.ui.finish(admitted.value) }
    },
    authorizeReview: async (context, snapshot) => {
      if (!await input.authority.revalidateDomainContext(context)) return false
      const { sections, comments } = snapshot
      if (!await input.access.authorizeSections(context, sections.map((section) => ({ id: section.id, sourceRefs: section.projection.context.sourceRefs }))) ||
        !await input.access.authorizeComments(context, comments) ||
        !await input.access.authorizeOutcomeComparison(context, sections.flatMap((section) => section.outcomeComparison ? [section.outcomeComparison] : [])) ||
        !await input.access.authorizeOutcome(context, sections.flatMap((section) => section.outcome ? [section.outcome] : [])) ||
        !await input.access.authorizeDecision(context, sections.flatMap((section) => section.projection.decision ? [section.projection.decision] : [])) ||
        !await input.access.authorizeSensitivity(context, sections.flatMap((section) => section.chart?.status === "ok" && section.chart.sensitivity ? [section.chart.sensitivity.result] : []))) return false
      return await input.access.revalidate(context, snapshot.sourceRefs) && await input.authority.revalidateDomainContext(context)
    },
    revalidateEvidence: async (context, refs) => {
      if (!await input.authority.revalidateDomainContext(context)) return false
      const references = new Map(refs.map((ref) => [canonicalSfValue(ref), structuredClone(ref)]))
      const resolved = await Promise.all([...references].map(async ([expected, ref]) => {
        const result = await input.evidence.resolve(ref, context)
        return (result.state === "fresh" || result.state === "historical") && result.accessRevision === context.binding.accessRevision && canonicalSfValue(result.ref) === expected
      }))
      return resolved.every(Boolean) && await input.authority.revalidateDomainContext(context)
    },
  })
}
