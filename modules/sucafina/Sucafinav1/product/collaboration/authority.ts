import { roleMap } from "../../runtime/admin.ts"
import { object } from "../../runtime/contract.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainPortHost } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { HotTopicIntent } from "../dashboard/hot-topics.ts"
import type { CollaborationThread } from "./threads.ts"
import { isAllowedRelationPair } from "./relation-catalog.ts"

/** Current source access and explicitly selected directory IDs are checked separately. */
export function createCollaborationAuthority(input: { host: DomainPortHost; evidence: BusinessContextService }) {
  const sources = async (refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => {
    if (!refs.length || refs.some((ref) => !ref || typeof ref !== "object" || ref.installationId !== context.binding.installationId || ref.projectId !== context.binding.projectId)) return false
    const current = await input.evidence.context({ refs }, context).catch(() => [])
    return current.length === refs.length && current.every((item, index) => item.state === "fresh" && digestSfValue(item.ref) === digestSfValue(refs[index])) && await input.host.revalidate(context)
  }
  const recipient = async (id: string, context: TrustedDomainContext) => {
    const request = input.host.requestFor(context)
    if (!request || !id.trim() || !await input.host.revalidate(context)) return undefined
    const environment = await input.host.environment(request)
    const person = environment.directory.find((entry) => entry.id === id && !!entry.name.trim())
    if (!person || environment.directory.filter((entry) => entry.id === id).length !== 1) return undefined
    const allowed = await input.host.persistence.transaction("dashboard", async (snapshot) => {
      const actor = await input.host.authenticate(request, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") })
      const access = object(snapshot.data.access)
      return { commit: false, value: !!actor && actor.id === context.binding.principalRef && !actor.id.startsWith("local:") && Object.hasOwn(access, id) && !!access[id] && typeof access[id] === "object" && !Array.isArray(access[id]) }
    }, { signal: request.signal }).catch(() => false)
    if (!allowed || !await input.host.revalidate(context)) return undefined
    return { id: person.id, name: person.name }
  }
  return {
    sources,
    recipient,
    authorizePair: async (pair: { fromRef: string; toRef: string; kind: string; evidenceRefs: readonly BusinessEvidenceRef[]; recipientRef?: string }, context: TrustedDomainContext) => {
      if (!Array.isArray(pair.evidenceRefs) || pair.evidenceRefs.some((ref) => !ref || typeof ref !== "object")) return false
      const from = pair.evidenceRefs.filter((ref) => ref.refId === pair.fromRef)
      const to = pair.evidenceRefs.filter((ref) => ref.refId === pair.toRef)
      if (from.length !== 1 || to.length !== 1 || !isAllowedRelationPair(pair.kind, from[0]!, to[0]!)) return false
      if (pair.recipientRef && !await recipient(pair.recipientRef, context)) return false
      return sources(pair.evidenceRefs, context)
    },
    authorizeThread: async (thread: { sourceRef: string; recipientRef?: string; evidenceRefs: readonly BusinessEvidenceRef[]; messages?: CollaborationThread["messages"] }, context: TrustedDomainContext, mode: "read" | "write") => {
      if (!thread.evidenceRefs.some((ref) => ref.refId === thread.sourceRef) || !await sources(thread.evidenceRefs, context)) return false
      if (thread.recipientRef && !await recipient(thread.recipientRef, context)) return false
      if (!thread.messages) return mode === "write"
      return thread.recipientRef === context.binding.principalRef || thread.messages.some((message) => message.authorRef === context.binding.principalRef)
    },
    authorizeIntent: async (intent: HotTopicIntent, recipientRef: string | undefined, context: TrustedDomainContext) => {
      if (intent.notes.trim() || !await sources(intent.sourceRefs, context)) return false
      if (!recipientRef) return !intent.owner.trim()
      const person = await recipient(recipientRef, context)
      return !!person && person.name === intent.owner
    },
  }
}
