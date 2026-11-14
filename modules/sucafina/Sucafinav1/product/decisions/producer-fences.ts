import { digestSfValue } from "../contracts/canonical.ts"
import type { DomainPortHost } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"

type SourceFences = { dashboard: string; planner: string; procurement: string }

/** Capture a consumed host lease and all domain revisions before producing a durable proposal. */
export function createDecisionProducerFences(input: {
  host: Pick<DomainPortHost, "revalidate">
  operationIdentity: (context: TrustedDomainContext) => string | undefined
  readSourceFences: (context: TrustedDomainContext) => Promise<SourceFences | undefined>
  lockedSourceFences: () => SourceFences | undefined
}) {
  const records = new WeakMap<TrustedDomainContext, Map<string, { operation: string; fences: SourceFences }>>()
  return {
    capture: async (context: TrustedDomainContext, tag: string, requestDigest: string) => {
      try {
        const operation = input.operationIdentity(context)
        if (!operation || !tag.trim() || !/^[a-f0-9]{64}$/.test(requestDigest) || !await input.host.revalidate(context)) return false
        const key = digestSfValue({ tag, requestDigest })
        const prior = records.get(context)?.get(key)
        if (prior) return prior.operation === operation && await input.host.revalidate(context)
        const fences = await input.readSourceFences(context)
        if (!fences || input.operationIdentity(context) !== operation || !await input.host.revalidate(context)) return false
        const bucket = records.get(context) ?? new Map<string, { operation: string; fences: SourceFences }>()
        const existing = bucket.get(key)
        if (existing) return existing.operation === operation && digestSfValue(existing.fences) === digestSfValue(fences)
        bucket.set(key, { operation, fences: structuredClone(fences) })
        records.set(context, bucket)
        return true
      } catch { return false }
    },
    verify: (context: TrustedDomainContext, tag: string, requestDigest: string) => {
      try {
        const operation = input.operationIdentity(context)
        const prior = records.get(context)?.get(digestSfValue({ tag, requestDigest }))
        const current = input.lockedSourceFences()
        return !!operation && !!prior && prior.operation === operation && !!current && digestSfValue(prior.fences) === digestSfValue(current)
      } catch { return false }
    },
  }
}
