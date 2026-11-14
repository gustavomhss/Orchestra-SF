import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { HotTopic } from "../dashboard/hot-topics.ts"
import type { ReviewActionHandoff } from "./closure-action.ts"

type Relation = { id: string; version: number; from: BusinessEvidenceRef; to: BusinessEvidenceRef; state: "confirmed"; evidenceRefs: readonly BusinessEvidenceRef[] }

/** Verify the actual WP08 relation and WP02 action, including the current source identity. */
export function createReviewHandoffVerifier(input: {
  host: Pick<DomainPortHost, "revalidate">
  relations: { readVersioned: (recordRefs: readonly string[], context: TrustedDomainContext) => Promise<PortResult<readonly Relation[]>> }
  hotTopics: { read: (id: string, sourceRefs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => Promise<PortResult<HotTopic>> }
}) {
  return async (handoff: ReviewActionHandoff, topic: HotTopic, relationId: string, context: TrustedDomainContext) => {
    const source = handoff.intent.sourceRefs.find((ref) => ref.refId === handoff.sourceRef)
    if (!source || source.kind !== "record" || !source.target || !Array.isArray(source.target.fields) || handoff.intent.sourceRefs.filter((ref) => ref.refId === handoff.sourceRef).length !== 1 || source.installationId !== context.binding.installationId || source.projectId !== context.binding.projectId || !relationId || !await input.host.revalidate(context)) return false
    const inspect = async () => {
      const relations = await input.relations.readVersioned([handoff.sourceRef], context)
      const current = await input.hotTopics.read(topic.id, handoff.intent.sourceRefs, context)
      if (relations.status !== "ok" || current.status !== "ok" || current.value.id !== topic.id || !Number.isSafeInteger(current.value.version) || current.value.version < topic.version) return undefined
      const matches = relations.value.filter((relation) => relation.id === relationId && relation.state === "confirmed")
      if (matches.length !== 1) return undefined
      const relation = matches[0]!
      if (!Array.isArray(relation.evidenceRefs) || relation.evidenceRefs.filter((ref) => digestSfValue(ref) === digestSfValue(relation.from)).length !== 1 || relation.evidenceRefs.filter((ref) => digestSfValue(ref) === digestSfValue(relation.to)).length !== 1) return undefined
      if (!Number.isSafeInteger(relation.version) || relation.version < 1 || relation.evidenceRefs.some((ref) => !ref || ref.installationId !== context.binding.installationId || ref.projectId !== context.binding.projectId || ref.refDigest !== digestSfEvidenceRef(ref))) return undefined
      if (relation.from?.kind !== "record" || !relation.from.target || !Array.isArray(relation.from.target.fields) || relation.to?.kind !== "record" || !relation.to.target || relation.from.installationId !== source.installationId || relation.from.projectId !== source.projectId || relation.from.target.surface !== source.target.surface || relation.from.target.recordType !== source.target.recordType || relation.from.target.recordId !== source.target.recordId || relation.from.target.incarnation !== source.target.incarnation || digestSfValue([...relation.from.target.fields].sort()) !== digestSfValue([...source.target.fields].sort()) || digestSfValue(relation.from.target.period) !== digestSfValue(source.target.period) || relation.to.target.surface !== "dashboard" || relation.to.target.recordType !== "hotTopics" || relation.to.target.recordId !== topic.id || !relation.to.target.incarnation || !Array.isArray(relation.to.target.fields) || !relation.to.target.fields.includes("status")) return undefined
      return digestSfValue([relation, current.value])
    }
    const first = await inspect()
    if (!first || !await input.host.revalidate(context)) return false
    return first === await inspect() && await input.host.revalidate(context)
  }
}
