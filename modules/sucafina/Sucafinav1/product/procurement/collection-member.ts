import { digestSfValue } from "../contracts/canonical.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createProcurementCollectionRegistry, createProcurementSourceResolver } from "./sources.ts"

/** Turn a current collection member into durable individual evidence before persisting it. */
export function createProcurementCollectionMemberIssuer(input: { collection: ReturnType<typeof createProcurementCollectionRegistry>; individual: ReturnType<typeof createProcurementSourceResolver>; revalidate: (binding: TrustedDomainContext) => Promise<boolean> }) {
  return async (memberRef: string, binding: TrustedDomainContext): Promise<PortResult<Extract<BusinessEvidenceRef, { kind: "record" }>>> => {
    if (!await input.revalidate(binding)) return { status: "denied", reason: "Current authority unavailable" }
    const member = await input.collection.resolveRequestSource(memberRef, binding)
    if (member.status !== "ok") return member
    const target = member.value.evidence.target
    if (target.surface !== "procurement" || target.recordType !== "procurement-request" || !target.period) return { status: "unavailable", reason: "Collection member unavailable" }
    const issued = await input.individual.issue("procurement-request", target.recordId, binding)
    if (issued.status !== "ok") return issued
    const individual = await input.individual.resolve(issued.value, binding)
    if (individual.status !== "ok") return individual
    const actual = individual.value.evidence.target
    if (actual.recordId !== target.recordId || actual.recordType !== target.recordType || actual.projectionDigest !== target.projectionDigest || digestSfValue(actual.fields) !== digestSfValue(target.fields) || digestSfValue(actual.period) !== digestSfValue(target.period) || digestSfValue(individual.value.context) !== digestSfValue(member.value.context)) return { status: "stale", reason: "Collection member changed" }
    const again = await input.collection.resolveRequestSource(memberRef, binding)
    if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(member.value) || !await input.revalidate(binding)) return { status: "stale", reason: "Collection member changed" }
    return { status: "ok", value: individual.value.evidence }
  }
}
