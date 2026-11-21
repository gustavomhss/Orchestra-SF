import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { CriterionMetric, CriterionRule } from "./criterion-rules.ts"

/** Freshness, scope and metric output are rechecked against the host's real producers. */
export function createDecisionEvidenceChecks(input: {
  host: Pick<DomainPortHost, "revalidate">
  evidence: Pick<BusinessContextService, "context">
  recomputeMetric: (metric: CriterionMetric, context: TrustedDomainContext) => Promise<PortResult<CriterionMetric>>
}) {
  const refs = async (values: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => {
    try {
      if (!await input.host.revalidate(context) || values.some((ref) => ref.installationId !== context.binding.installationId || ref.projectId !== context.binding.projectId || ref.refDigest !== digestSfEvidenceRef(ref))) return false
      const result = await input.evidence.context({ refs: values }, context)
      return result.length === values.length && result.every((item, index) => item.state === "fresh" && item.accessRevision === context.binding.accessRevision && !!item.authorizedProjection && !!item.currentRef && digestSfValue(item.ref) === digestSfValue(values[index]) && digestSfValue(item.currentRef) === digestSfValue(item.ref)) && await input.host.revalidate(context)
    } catch { return false }
  }
  // Listing history may expose only the producer's authorized original and
  // explicit differences. Mutation, criterion and metric checks keep refs above.
  const readRefs = async (values: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => {
    try {
      const captured = structuredClone(values)
      const binding = digestSfValue({ kind: context.kind, binding: context.binding })
      const current = () => digestSfValue(values) === digestSfValue(captured) && digestSfValue({ kind: context.kind, binding: context.binding }) === binding
      if (!await input.host.revalidate(context) || !current() || captured.some((ref) => ref.installationId !== context.binding.installationId || ref.projectId !== context.binding.projectId || ref.refDigest !== digestSfEvidenceRef(ref))) return false
      const result = await input.evidence.context({ refs: captured }, context)
      const readable = result.length === captured.length && result.every((item, index) => item.accessRevision === context.binding.accessRevision &&
        !!item.authorizedProjection && !!item.currentRef && digestSfValue(item.ref) === digestSfValue(captured[index]) &&
        item.currentRef.installationId === context.binding.installationId && item.currentRef.projectId === context.binding.projectId &&
        item.currentRef.refDigest === digestSfEvidenceRef(item.currentRef) &&
        (item.state === "fresh" ? digestSfValue(item.currentRef) === digestSfValue(item.ref) : item.state === "historical" && Array.isArray(item.differences)))
      return readable && current() && await input.host.revalidate(context) && current()
    } catch { return false }
  }
  return {
    refs,
    readRefs,
    rule: async (rule: CriterionRule, context: TrustedDomainContext) => refs([...rule.evidenceRefs, ...(rule.sensitivity?.sourceRefs ?? [])], context),
    metric: async (metric: CriterionMetric, context: TrustedDomainContext) => {
      if (!await refs(metric.evidenceRefs, context)) return false
      const current = await input.recomputeMetric(metric, context)
      return current.status === "ok" && digestSfValue(current.value) === digestSfValue(metric) && await refs(metric.evidenceRefs, context)
    },
  }
}
