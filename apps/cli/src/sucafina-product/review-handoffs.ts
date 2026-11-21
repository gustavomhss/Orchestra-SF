import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { createReviewApplication } from "../../../../modules/sucafina/Sucafinav1/product/reviews/application.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { createSfBusinessServices } from "./business-services.ts"

type Handoffs = NonNullable<Parameters<typeof createReviewApplication>[0]["handoffs"]>

/** Preserve a review closure only after re-opening the actual WP08 relation and WP02 action. */
export function createSfReviewHandoffs(input: { authority: ReturnType<typeof createSfProductAuthority>; business: ReturnType<typeof createSfBusinessServices> }): Handoffs {
  const { authority, business } = input
  const readAction: Handoffs["readAction"] = business.collaboration.hotTopics.read
  const verifyHandoff: Handoffs["verifyHandoff"] = async (handoff, topic, relationId, call) => {
    const request = authority.host.requestFor(call)
    if (!request || !relationId.trim() || !await authority.host.revalidate(call)) return false
    const read = async () => {
      const relations = await business.collaboration.relations.read([handoff.sourceRef], call)
      if (relations.status !== "ok") return undefined
      const matches = relations.value.relations.filter((relation) => relation.id === relationId && relation.kind === "handoff" &&
        relation.fromRef === handoff.sourceRef && relation.confirmedBy === call.binding.principalRef &&
        relation.evidenceRefs.some((ref) => ref.refId === relation.toRef && ref.kind === "record" && ref.target.surface === "dashboard" && ref.target.recordType === "hotTopics" && ref.target.recordId === topic.id) &&
        handoff.intent.sourceRefs.every((ref) => relation.evidenceRefs.some((evidence) => digestSfValue(evidence) === digestSfValue(ref))))
      if (matches.length !== 1) return undefined
      const current = await readAction(topic.id, handoff.intent.sourceRefs, call)
      if (current.status !== "ok" || current.value.id !== topic.id || current.value.version < topic.version) return undefined
      const proof = await authority.state.read(request, "relations", (state, actor) => actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion
        ? { correlation: state.relations[`sf:hot-topic:${digestSfValue({ correlationKey: handoff.intent.correlationKey })}`], assignment: state.relations[`sf:assignment:${relationId}`] } : undefined)
      if (proof.status !== "ok" || !proof.value) return undefined
      const correlation = object(proof.value.correlation)
      const intent = handoff.intent
      if (correlation.id !== topic.id || correlation.digest !== digestSfValue({ principal: call.binding.principalRef, action: intent.action, owner: intent.owner, due: intent.due,
        priority: intent.priority, notes: intent.notes, sourceRefs: intent.sourceRefs }) ||
        digestSfValue(proof.value.assignment) !== digestSfValue(handoff.recipientRef ? { relationId, recipientRef: handoff.recipientRef } : undefined)) return undefined
      return { relation: matches[0], action: current.value, proof: proof.value }
    }
    const first = await read()
    const again = first ? await read() : undefined
    return !!first && !!again && digestSfValue(first) === digestSfValue(again) && await authority.host.revalidate(call)
  }
  return { readAction, verifyHandoff, handoff: { create: async (request, call) => {
    const result = await business.collaboration.handoff.create(request, call)
    if (result.status !== "ok") return result
    if (result.value.state !== "created" && result.value.state !== "existing") return { status: "unavailable", reason: "review-handoff-state-mismatch" }
    return await verifyHandoff(request, result.value.topic, result.value.relationId, call)
      ? { status: "ok", value: { ...result.value, state: result.value.state } } : { status: "unavailable", reason: "review-handoff-proof-unavailable" }
  } } }
}
