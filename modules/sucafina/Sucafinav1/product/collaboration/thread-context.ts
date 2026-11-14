import { object } from "../../runtime/contract.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { CollaborationThread } from "./threads.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { isReviewThreadContext } from "../reviews/thread-context.ts"
import type { ReviewThreadContext } from "../reviews/thread-context.ts"

export type ThreadSourceContext = Pick<CollaborationThread, "sourceRef" | "sourceIncarnation" | "observedVersion" | "period" | "evidenceRefs"> & { reviewContext?: ReviewThreadContext }
export type ReviewThreadContextAuthorizer = (pin: ReviewThreadContext, basis: ThreadSourceContext, context: TrustedDomainContext) => Promise<boolean>

/** Structural selection check only; scoped incarnation is actor-bound, not physical identity or permission.
 * The recipient reader proves physical continuity and current authority for every record basis.
 */
export function threadMessageContext(thread: CollaborationThread, message: CollaborationThread["messages"][number]): ThreadSourceContext | undefined {
  const selected: ThreadSourceContext = message.sourceContext ?? thread
  const first = thread.messages[0]?.sourceContext
  if (digestSfValue(selected.reviewContext) !== digestSfValue(first?.reviewContext)) return undefined
  if (first?.reviewContext && (digestSfValue(contextValue(selected)) !== digestSfValue(contextValue(first)) || digestSfValue(contextValue(thread)) !== digestSfValue({ sourceRef: first.sourceRef, sourceIncarnation: first.sourceIncarnation, observedVersion: first.observedVersion, period: first.period, evidenceRefs: first.evidenceRefs }))) return undefined
  if (!validThreadSourceContext(thread) || !validThreadSourceContext(selected)) return undefined
  const original = thread.evidenceRefs.find((ref) => ref.refId === thread.sourceRef)
  const source = selected.evidenceRefs.find((ref) => ref.refId === selected.sourceRef)
  if (!original || !source || original.kind !== "record" || source.kind !== "record" || digestSfValue(selector(original)) !== digestSfValue(selector(source))) return undefined
  const originals = thread.evidenceRefs.map(selector).map(digestSfValue).sort()
  const selectedRefs = selected.evidenceRefs.map(selector).map(digestSfValue).sort()
  if (digestSfValue(originals) !== digestSfValue(selectedRefs)) return undefined
  return contextValue(selected)
}

export function validThreadSourceContext(value: unknown): value is ThreadSourceContext {
  const context = object(value)
  if (context.reviewContext !== undefined && !isReviewThreadContext(context.reviewContext)) return false
  if (typeof context.sourceRef !== "string" || !context.sourceRef.trim() || typeof context.sourceIncarnation !== "string" || !context.sourceIncarnation.trim() || !Number.isSafeInteger(context.observedVersion) || Number(context.observedVersion) < 1 || !isSfPeriod(context.period) || !Array.isArray(context.evidenceRefs) || !context.evidenceRefs.length) return false
  const refs = context.evidenceRefs.map(object)
  if (refs.some((ref) => !["record", "document", "calculation", "receipt", "case-event", "policy"].includes(String(ref.kind)) || typeof ref.refId !== "string" || !ref.refId.trim() || typeof ref.refDigest !== "string" || !ref.target || typeof ref.target !== "object" || Array.isArray(ref.target) || ref.kind === "record" && (!Array.isArray(object(ref.target).fields) || (object(ref.target).fields as unknown[]).some((field) => typeof field !== "string")))) return false
  const sources = refs.filter((ref) => ref.refId === context.sourceRef)
  const source = object(sources[0]?.target)
  return sources.length === 1 && sources[0]!.kind === "record" && source.incarnation === context.sourceIncarnation && source.version === context.observedVersion && isSfPeriod(source.period) && source.period.start <= context.period.start && source.period.end >= context.period.end
}

function selector(ref: BusinessEvidenceRef) {
  if (ref.kind !== "record") return { immutableSupplement: ref }
  return { installationId: ref.installationId, projectId: ref.projectId, surface: ref.target.surface, recordType: ref.target.recordType, recordId: ref.target.recordId, fields: [...ref.target.fields].sort() }
}

function contextValue(context: ThreadSourceContext): ThreadSourceContext {
  return { sourceRef: context.sourceRef, sourceIncarnation: context.sourceIncarnation, observedVersion: context.observedVersion, period: context.period, evidenceRefs: context.evidenceRefs, ...(context.reviewContext ? { reviewContext: context.reviewContext } : {}) }
}
