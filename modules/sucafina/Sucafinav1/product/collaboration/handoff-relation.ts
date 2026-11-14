import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { ConfirmedRelations } from "../contracts/outputs.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { HotTopic } from "../dashboard/hot-topics.ts"
import type { createCollaborationReissuer } from "./reissue.ts"
import { sameHandoffWorkSource } from "./work-handoff-source.ts"

type Relation = ConfirmedRelations["relations"][number]
type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>

/** Current action state is independent of the preserved relation's creation snapshot. */
export function createHandoffRelationProjection(input: {
  host: DomainPortHost
  authorizeSources: (refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => Promise<boolean>
  reissue?: ReturnType<typeof createCollaborationReissuer>
  readTopic: (id: string, refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => Promise<PortResult<HotTopic>>
  issueTopic: (topic: HotTopic, context: TrustedDomainContext) => Promise<PortResult<RecordEvidence>>
}) {
  return async (relation: Relation, context: TrustedDomainContext): Promise<Relation | undefined> => {
    if (relation.kind !== "handoff" || !Array.isArray(relation.evidenceRefs) || !await input.host.revalidate(context)) return undefined
    const original = structuredClone(relation)
    const target = original.evidenceRefs.filter((ref) => ref.refId === original.toRef)
    if (target.length !== 1 || target[0]?.kind !== "record" || target[0].target.surface !== "dashboard" || target[0].target.recordType !== "hotTopics") return undefined
    const previous = target[0]
    const origins = original.evidenceRefs.filter((ref) => ref.refId !== original.toRef)
    if (!origins.length || origins.filter((ref) => ref.refId === original.fromRef).length !== 1) return undefined
    const issued = await Promise.all(origins.map(async (ref) => {
      if (await input.authorizeSources([ref], context)) return ref
      if (ref.kind !== "record" || !input.reissue) return undefined
      const renewed = await input.reissue(ref, context)
      return renewed.status === "ok" ? renewed.value : undefined
    }))
    if (issued.some((ref) => !ref)) return undefined
    const sourceRefs = issued.filter((ref): ref is BusinessEvidenceRef => !!ref)
    if (!await input.authorizeSources(sourceRefs, context)) return undefined
    const topic = await input.readTopic(previous.target.recordId, sourceRefs, context)
    if (topic.status !== "ok" || topic.value.id !== previous.target.recordId) return undefined
    const issuedTopic = await input.issueTopic(topic.value, context)
    if (issuedTopic.status !== "ok") return undefined
    const current = structuredClone(issuedTopic.value)
    if (current.evidenceLevel !== previous.evidenceLevel || digestSfValue([...current.target.fields].sort()) !== digestSfValue([...previous.target.fields].sort()) || !await sameHandoffWorkSource(input.host, previous, current, context)) return undefined
    const evidenceRefs = original.evidenceRefs.map((ref) => ref.refId === original.toRef ? current : sourceRefs[origins.findIndex((origin) => origin.refId === ref.refId)]!)
    if (evidenceRefs.some((ref) => !ref) || !await input.authorizeSources(evidenceRefs, context) || !await sameHandoffWorkSource(input.host, previous, current, context) || !await input.host.revalidate(context)) return undefined
    return { ...original, fromRef: sourceRefs[origins.findIndex((ref) => ref.refId === original.fromRef)]!.refId, toRef: current.refId, evidenceRefs }
  }
}
