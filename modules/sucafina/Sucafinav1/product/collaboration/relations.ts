import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { ConfirmedRelations } from "../contracts/outputs.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import type { createCollaborationReissuer } from "./reissue.ts"
import type { CollaborationMutationFence } from "./mutation-fence.ts"
import type { CollaborationHumanAuthority } from "./human.ts"

type Relation = ConfirmedRelations["relations"][number]
type Pair = { fromRef: string; toRef: string; kind: string; evidenceRefs: readonly BusinessEvidenceRef[]; recipientRef?: string }
type Mutation = { expectedStorageVersion: number; idempotencyKey: string }

/** Authorization and the allowed relation catalogue belong to the composed host. */
export function createRelationPort(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  authorizePair: (pair: Pair, context: TrustedDomainContext) => Promise<boolean>
  creationTarget: { ref: string; incarnation: string }
  human: CollaborationHumanAuthority
  mutationFence: CollaborationMutationFence
  reissue?: ReturnType<typeof createCollaborationReissuer>
  handoffPermit: symbol
  createId: () => string
  now: () => string
}) {
  const create = async (pair: Pair, mutation: Mutation, context: TrustedDomainContext, admission: { action: "collaboration.relation.confirm" | "collaboration.handoff.confirm"; payload: unknown }): Promise<PortResult<Relation>> => {

      if (context.kind !== "ui") return { status: "denied", reason: "human-selection-required" }
      if (!validPair(pair) || !validMutation(mutation)) return { status: "needs-input", reason: "invalid-relation" }
      const selected = structuredClone({ pair, mutation })
      const admittedPayload = structuredClone(admission.payload)
      const request = input.host.requestFor(context)
      if (!request || !await input.human.authorize(context, admission.action, admittedPayload) || !await input.host.revalidate(context)) return { status: "denied", reason: "relation-access-unavailable" }
      const fence = await input.mutationFence.prepare(() => input.authorizePair(structuredClone(selected.pair), context))
      if (!fence) return { status: "unavailable", reason: "relation-source-fence-unavailable" }
      const relation: Relation = { fromRef: selected.pair.fromRef, toRef: selected.pair.toRef, kind: selected.pair.kind, evidenceRefs: selected.pair.evidenceRefs, id: input.createId(), confirmedBy: context.binding.principalRef, confirmedAt: input.now() }
      if (!relation.id.trim() || relation.id.startsWith("sf:hot-topic:") || relation.id.startsWith("sf:assignment:")) return { status: "unavailable", reason: "identity-unavailable" }
      const target = input.creationTarget
      const result = await input.state.transaction(request, { namespace: "relations", ...selected.mutation, commandDigest: digestSfValue(selected.pair), targetRef: target.ref, targetIncarnation: target.incarnation }, async (state, authority) => {
        if (authority.principalRef !== context.binding.principalRef || authority.accessRevision !== context.binding.accessRevision || authority.policyVersion !== context.binding.policyVersion || !await input.human.authorize(context, admission.action, admittedPayload) || !input.mutationFence.check(fence)) return { commit: false, value: null }
        const relations = Object.entries(state.relations).filter(([key]) => !key.startsWith("sf:hot-topic:") && !key.startsWith("sf:assignment:")).map(([, value]) => value)
        if (!relations.every(isRelation)) return { commit: false, value: null }
        const existing = relations.find((item) => item.fromRef === selected.pair.fromRef && item.toRef === selected.pair.toRef && item.kind === selected.pair.kind)
        if (existing) {
          const assignment = state.relations[`sf:assignment:${existing.id}`]
          if (digestSfValue(assignment) !== digestSfValue(selected.pair.recipientRef ? { relationId: existing.id, recipientRef: selected.pair.recipientRef } : undefined)) return { commit: false, value: null }
          return { commit: false, value: existing }
        }
        if (state.relations[relation.id]) return { commit: false, value: null }
        state.relations[relation.id] = relation
        if (selected.pair.recipientRef) state.relations[`sf:assignment:${relation.id}`] = { relationId: relation.id, recipientRef: selected.pair.recipientRef }
        return { commit: true, value: relation }
      })
      if (result.status !== "ok" && result.status !== "preview") return result
      if (!result.value) return { status: "conflict", reason: "relation-not-committed" }
      if (!await input.host.revalidate(context) || !await input.authorizePair(result.value, context)) return { status: "unavailable", reason: "relation-access-unavailable" }
      return { status: "ok", value: result.value }
  }
  return {
    storageVersion: async (context: TrustedDomainContext): Promise<PortResult<number>> => {
      const request = input.host.requestFor(context)
      if (!request || !await input.host.revalidate(context)) return { status: "denied", reason: "relation-access-unavailable" }
      const current = await input.state.read(request, "relations", (_state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion)
      if (current.status === "unavailable" && current.reason === "product-state-uninitialized" && await input.host.revalidate(context)) return { status: "ok", value: 0 }
      if (current.status !== "ok" || !current.value || !await input.host.revalidate(context)) return { status: "unavailable", reason: "relation-state-unavailable" }
      return { status: "ok", value: current.storageVersion }
    },
    create: (pair: Pair, mutation: Mutation, context: TrustedDomainContext) => create(pair, mutation, context, { action: "collaboration.relation.confirm", payload: { operation: "create", pair, mutation } }),
    createHandoff: (pair: Pair, mutation: Mutation, context: TrustedDomainContext, payload: unknown, permit: symbol) => permit === input.handoffPermit ? create(pair, mutation, context, { action: "collaboration.handoff.confirm", payload }) : Promise.resolve({ status: "denied" as const, reason: "human-selection-required" }),
    remove: async (id: string, pair: Pair, mutation: Mutation, context: TrustedDomainContext): Promise<PortResult<Relation>> => {
      if (context.kind !== "ui") return { status: "denied", reason: "human-selection-required" }
      if (!id.trim() || !validPair(pair) || !validMutation(mutation)) return { status: "needs-input", reason: "invalid-relation" }
      const selected = structuredClone({ pair, mutation })
      const request = input.host.requestFor(context)
      if (!request || !await input.human.authorize(context, "collaboration.relation.confirm", { operation: "remove", id, pair: selected.pair, mutation: selected.mutation }) || !await input.host.revalidate(context)) return { status: "denied", reason: "relation-access-unavailable" }
      const fence = await input.mutationFence.prepare(() => input.authorizePair(structuredClone(selected.pair), context))
      if (!fence) return { status: "unavailable", reason: "relation-source-fence-unavailable" }
      const target = input.creationTarget
      const result = await input.state.transaction(request, { namespace: "relations", ...selected.mutation, commandDigest: digestSfValue({ operation: "remove", id, pair: selected.pair }), targetRef: target.ref, targetIncarnation: target.incarnation }, async (state, authority) => {
        const relation = state.relations[id]
        if (authority.principalRef !== context.binding.principalRef || authority.accessRevision !== context.binding.accessRevision || authority.policyVersion !== context.binding.policyVersion || !await input.human.authorize(context, "collaboration.relation.confirm", { operation: "remove", id, pair: selected.pair, mutation: selected.mutation }) || !input.mutationFence.check(fence) || !isRelation(relation) || digestSfValue({ fromRef: relation.fromRef, toRef: relation.toRef, kind: relation.kind, evidenceRefs: relation.evidenceRefs, ...(selected.pair.recipientRef ? { recipientRef: selected.pair.recipientRef } : {}) }) !== digestSfValue(selected.pair) || digestSfValue(state.relations[`sf:assignment:${id}`]) !== digestSfValue(selected.pair.recipientRef ? { relationId: id, recipientRef: selected.pair.recipientRef } : undefined)) return { commit: false, value: null }
        delete state.relations[id]
        delete state.relations[`sf:assignment:${id}`]
        return { commit: true, value: relation }
      })
      if (result.status === "preview") return { status: "conflict", reason: "relation-not-found-or-changed" }
      if (result.status !== "ok") return result
      if (!result.value || !await input.host.revalidate(context) || !await input.authorizePair(result.value, context)) return { status: "unavailable", reason: "relation-access-unavailable" }
      return { status: "ok", value: result.value }
    },
    read: async (recordRefs: readonly string[], context: TrustedDomainContext): Promise<PortResult<ConfirmedRelations>> => {
      if (!recordRefs.length || recordRefs.some((ref) => !ref.trim())) return { status: "needs-input", reason: "invalid-references" }
      const refs = [...recordRefs]
      const request = input.host.requestFor(context)
      if (!request || !await input.host.revalidate(context)) return { status: "denied", reason: "relation-access-unavailable" }
      const result = await input.state.read(request, "relations", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? Object.entries(state.relations).filter(([key]) => !key.startsWith("sf:hot-topic:") && !key.startsWith("sf:assignment:")).map(([, value]) => value) : undefined)
      if (result.status === "preview") return { status: "unavailable", reason: "unexpected-state-preview" }
      if (result.status !== "ok") return result
      if (!result.value || !result.value.every(isRelation)) return { status: "unavailable", reason: "invalid-relations" }
      const projected = await Promise.all(result.value.map(async (relation): Promise<Relation | undefined> => {
        if (await input.authorizePair(relation, context)) return relation
        if (!input.reissue || relation.evidenceRefs.some((ref) => !ref || typeof ref !== "object" || ref.kind !== "record")) return undefined
        const from = relation.evidenceRefs.findIndex((ref) => ref.refId === relation.fromRef)
        const to = relation.evidenceRefs.findIndex((ref) => ref.refId === relation.toRef)
        if (from < 0 || to < 0 || from === to || relation.evidenceRefs.filter((ref) => ref.refId === relation.fromRef).length !== 1 || relation.evidenceRefs.filter((ref) => ref.refId === relation.toRef).length !== 1) return undefined
        const issued = await Promise.all(relation.evidenceRefs.map((ref) => input.reissue!(ref as Extract<BusinessEvidenceRef, { kind: "record" }>, context)))
        if (issued.some((entry) => entry.status !== "ok")) return undefined
        const evidenceRefs = issued.flatMap((entry) => entry.status === "ok" ? [entry.value] : [])
        if (!evidenceRefs[from] || !evidenceRefs[to]) return undefined
        const rebound = { ...relation, fromRef: evidenceRefs[from].refId, toRef: evidenceRefs[to].refId, evidenceRefs }
        return await input.authorizePair(rebound, context) ? rebound : undefined
      }))
      const candidates = projected.filter((relation): relation is Relation => !!relation && (refs.includes(relation.fromRef) || refs.includes(relation.toRef)))
      const access = await Promise.all(candidates.map((relation) => input.authorizePair(relation, context)))
      const again = await input.state.read(request, "relations", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? Object.entries(state.relations).filter(([key]) => !key.startsWith("sf:hot-topic:") && !key.startsWith("sf:assignment:")).map(([, value]) => value) : undefined)
      if (again.status !== "ok" || !again.value || digestSfValue(again.value) !== digestSfValue(result.value) || !await input.host.revalidate(context)) return { status: "unavailable", reason: "relation-access-unavailable" }
      const finalAccess = await Promise.all(candidates.map((relation) => input.authorizePair(relation, context)))
      if (!await input.host.revalidate(context)) return { status: "denied", reason: "relation-access-unavailable" }
      return { status: "ok", value: { relations: candidates.filter((_, index) => access[index] && finalAccess[index]) } }
    },
  }
}

function validPair(pair: Pair) {
  return !!pair && typeof pair.fromRef === "string" && !!pair.fromRef.trim() && typeof pair.toRef === "string" && !!pair.toRef.trim() && pair.fromRef !== pair.toRef && typeof pair.kind === "string" && !!pair.kind.trim() && Array.isArray(pair.evidenceRefs) && pair.evidenceRefs.length > 0 && (pair.recipientRef === undefined || typeof pair.recipientRef === "string" && !!pair.recipientRef.trim())
}

function validMutation(value: Mutation) {
  return !!value && Number.isSafeInteger(value.expectedStorageVersion) && value.expectedStorageVersion >= 0 && typeof value.idempotencyKey === "string" && !!value.idempotencyKey.trim()
}

function isRelation(value: unknown): value is Relation {
  if (!value || typeof value !== "object") return false
  const relation = value as Record<string, unknown>
  return [relation.id, relation.fromRef, relation.toRef, relation.kind, relation.confirmedBy, relation.confirmedAt].every((part) => typeof part === "string" && !!part.trim()) && Array.isArray(relation.evidenceRefs)
}
