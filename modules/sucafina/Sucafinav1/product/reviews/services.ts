import { canonicalSfValue, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessContextService } from "../contracts/business-context.ts"
import type { DomainPortHost } from "../contracts/ports.ts"
import type { SfDomainValidation } from "../contracts/runtime.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { createReviewArtifactStorage } from "../reports/storage.ts"
import { createReviewCapabilities } from "./capabilities.ts"
import { createReviewPort } from "./port.ts"
import { createReviewThreadContext } from "./thread-context.ts"
import type { ReviewHost } from "./port.ts"

/** Compose production review capabilities with source-owned selection and access checks. */
export function createReviewServices(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  authority: SfDomainValidation
  evidence: Pick<BusinessContextService, "resolve">
  selection: Pick<ReviewHost, "select" | "isHistoricalSelection" | "authorizeOutcomeComparison" | "authorizeOutcome" | "authorizeDecision" | "authorizeSections" | "authorizeComments" | "authorizeSensitivity" | "revalidate">
  creationTarget: { ref: string; incarnation: string }
  operationIdentity: (context: TrustedDomainContext) => string | undefined
  requiredAuthority: readonly string[]
  maxBytes: number
  now: () => string
}) {
  if (!Number.isSafeInteger(input.maxBytes) || input.maxBytes <= 0 || !input.creationTarget.ref.trim() || !input.creationTarget.incarnation.trim()) throw new Error("SF_REVIEW_STORAGE_CONFIG_INVALID")
  const owners = { state: input.state, host: input.host, evidence: input.evidence, selection: input.selection }
  const methods = [
    [owners.host, "requestFor", owners.host.requestFor], [owners.host, "revalidate", owners.host.revalidate],
    [owners.evidence, "resolve", owners.evidence.resolve],
    ...(["authorizeSections", "authorizeComments", "authorizeOutcomeComparison", "authorizeOutcome", "authorizeDecision", "authorizeSensitivity", "revalidate"] as const)
      .map((name) => [owners.selection, name, owners.selection[name]] as const),
  ] as const
  // These pins reject composition swaps; validation still calls every method.
  const readDependenciesCurrent = () => Object.entries(owners).every(([name, value]) =>
    Object.getOwnPropertyDescriptor(input, name)?.value === value) && methods.every(([owner, name, value]) =>
      Object.getOwnPropertyDescriptor(owner, name)?.value === value)
  const reviews = createReviewPort({
    state: input.state,
    creationTarget: input.creationTarget,
    now: input.now,
    requestFor: input.host.requestFor,
    ...input.selection,
    revalidateReadAccess: input.host.revalidate,
    revalidateReadEvidence: async (context, refs) => {
      const references = new Map(refs.map((ref) => [canonicalSfValue(ref), structuredClone(ref)]))
      if (!await input.host.revalidate(context)) return false
      const resolutions = await Promise.all([...references].map(async ([expected, ref]) => {
        const result = await input.evidence.resolve(ref, context).catch(() => undefined)
        if (!result) return "unavailable"
        if (["revoked", "replaced", "missing", "invalid"].includes(result.state)) return "denied"
        if (result.state !== "fresh" && result.state !== "historical") return "unavailable"
        return result.accessRevision === context.binding.accessRevision && canonicalSfValue(result.ref) === expected ? "ok" : "denied"
      }))
      if (!await input.host.revalidate(context) || resolutions.includes("denied")) return false
      if (resolutions.some((status) => status !== "ok")) throw new Error("REVIEW_EVIDENCE_READ_UNAVAILABLE")
      return true
    },
    revalidateEvidence: async (context, refs) => {
      // Many captured cells refer to the same immutable source. Resolve each complete
      // reference once per pass; never reuse authorization across passes or requests.
      // Keep the expected body independent of caller/resolver mutation during awaits.
      const references = new Map(refs.map((ref) => [canonicalSfValue(ref), structuredClone(ref)]))
      if (!await input.host.revalidate(context)) return false
      const resolutions = await Promise.all([...references].map(async ([expected, ref]) => {
        const result = await input.evidence.resolve(ref, context)
        return (result.state === "fresh" || result.state === "historical") && result.accessRevision === context.binding.accessRevision && canonicalSfValue(result.ref) === expected
      }))
      return resolutions.every(Boolean) && await input.host.revalidate(context)
    },
  }, readDependenciesCurrent)
  const artifacts = createReviewArtifactStorage({ state: input.state, host: input.host, reviews, creationTarget: input.creationTarget, operationIdentity: (context, entry) => input.operationIdentity(context) ?? (context.kind === "native" ? input.authority.receiptFor(context, "sf_report_prepare", digestSfValue({ reviewRef: entry.reviewRef, format: entry.format, sectionRefs: entry.sectionRefs }))?.callId : undefined), maxBytes: input.maxBytes })
  return { reviews, threadContext: createReviewThreadContext({ reviews, host: input.host }), artifacts, descriptors: createReviewCapabilities({ reviews, artifacts, authority: input.authority, requiredAuthority: input.requiredAuthority }) }
}

