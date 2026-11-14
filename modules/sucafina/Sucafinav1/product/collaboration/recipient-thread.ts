import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import { isThread } from "./threads.ts"
import type { CollaborationThread } from "./threads.ts"
import type { createCollaborationReissuer } from "./reissue.ts"
import type { CollaborationWorkSourceRefresh } from "./work-source-refresh.ts"
import { threadMessageContext } from "./thread-context.ts"
import type { ThreadSourceContext } from "./thread-context.ts"

type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>
export type RecipientThread = Pick<CollaborationThread, "id" | "kind" | "recipientRef" | "state" | "messages"> & {
  observed: { version: number; period: CollaborationThread["period"] }
  current: { sourceRef: RecordEvidence; evidenceRefs: readonly BusinessEvidenceRef[] }
  historical?: ThreadSourceContext
  continuity: "unchanged" | "historical"
}

/** Current refs are issued for the reader; original refs require an explicit historical source grant. */
export function createRecipientThreadReader(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  reissue: ReturnType<typeof createCollaborationReissuer>
  refresh?: CollaborationWorkSourceRefresh
  authorize: (refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => Promise<boolean>
  authorizeHistorical?: (refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => Promise<boolean>
  authorizeContext?: (basis: ThreadSourceContext, context: TrustedDomainContext) => Promise<boolean>
}) {
  return async (id: string, context: TrustedDomainContext): Promise<PortResult<RecipientThread>> => {
    if (typeof id !== "string" || !id.trim()) return { status: "needs-input", reason: "invalid-thread-reference" }
    const request = input.host.requestFor(context)
    if (!request || !await input.host.revalidate(context)) return { status: "denied", reason: "thread-access-unavailable" }
    const read = () => input.state.read(request, "threads", (state, authority) => authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion ? state.threads[id] : undefined)
    const first = await read()
    if (first.status !== "ok" || !isThread(first.value) || first.value.id !== id) return { status: "unavailable", reason: "thread-access-unavailable" }
    const thread = first.value
    if (thread.recipientRef !== context.binding.principalRef && !thread.messages.some((message) => message.authorRef === context.binding.principalRef)) return { status: "denied", reason: "thread-access-unavailable" }
    const originals = thread.evidenceRefs
    const sourceIndex = originals.findIndex((ref) => ref.kind === "record" && ref.refId === thread.sourceRef && ref.target.incarnation === thread.sourceIncarnation)
    if (sourceIndex < 0 || originals.filter((ref) => ref.refId === thread.sourceRef).length !== 1) return { status: "unavailable", reason: "thread-source-unavailable" }
    const messageContexts = thread.messages.map((message) => threadMessageContext(thread, message))
    if (messageContexts.some((basis) => !basis)) return { status: "unavailable", reason: "thread-source-unavailable" }
    const historyRefs = [...new Map([...originals, ...messageContexts.flatMap((basis) => basis!.evidenceRefs)].map((ref) => [ref.refDigest, ref])).values()]
    const preserved = input.authorizeHistorical ? await input.authorizeHistorical(historyRefs, context) : false
    const reviewBasis = messageContexts[0]?.reviewContext ? messageContexts[0] : undefined
    if (reviewBasis && (!preserved || !input.authorizeContext || !await input.authorizeContext(reviewBasis, context))) return { status: "unavailable", reason: "review-thread-context-unavailable" }
    const records = historyRefs.filter((ref): ref is RecordEvidence => ref.kind === "record")
    const supplements = historyRefs.filter((ref) => ref.kind !== "record")
    const contextScopes = await Promise.all(records.map((ref) => input.reissue(ref, context)))
    const changed = contextScopes.some((result) => result.status !== "ok")
    if (changed && !preserved) return { status: "unavailable", reason: "thread-source-unavailable" }
    // Refresh proves physical continuity for every stored basis; it never authorizes historical text by itself.
    const renew = () => Promise.all(records.map((ref) => changed && input.refresh ? input.refresh(ref, context) : input.reissue(ref, context)))
    const issued = changed ? await renew() : contextScopes
    if (issued.some((result) => result.status !== "ok")) return { status: "unavailable", reason: "thread-source-unavailable" }
    const issuedByDigest = new Map(issued.flatMap((result, index) => result.status === "ok" ? [[records[index]!.refDigest, result.value] as const] : []))
    const projection = (refs: readonly BusinessEvidenceRef[]) => refs.map((ref) => ref.kind === "record" ? issuedByDigest.get(ref.refDigest)! : ref)
    const current = projection(originals)
    const canonical = digestSfValue(current.map((ref) => ref.refDigest).sort())
    if (messageContexts.some((basis) => digestSfValue(projection(basis!.evidenceRefs).map((ref) => ref.refDigest).sort()) !== canonical)) return { status: "unavailable", reason: "thread-source-continuity-unavailable" }
    const sourceRef = current[sourceIndex]
    const authorizeCurrent = async () => await input.authorize(current.filter((ref) => ref.kind === "record"), context) && (!supplements.length || await (input.authorizeHistorical ?? input.authorize)(supplements, context))
    if (!sourceRef || sourceRef.kind !== "record" || !await authorizeCurrent()) return { status: "unavailable", reason: "thread-source-unavailable" }
    const again = await read()
    const finalScopes = await renew()
    if (again.status !== "ok" || !isThread(again.value) || again.value.id !== id || digestSfValue(again.value) !== digestSfValue(thread) || digestSfValue(finalScopes) !== digestSfValue(issued) || !await authorizeCurrent() || preserved && !await input.authorizeHistorical!(historyRefs, context) || reviewBasis && !await input.authorizeContext!(reviewBasis, context) || !await input.host.revalidate(context)) return { status: "unavailable", reason: "thread-access-unavailable" }
    return { status: "ok", value: { id: thread.id, kind: thread.kind, ...(thread.recipientRef ? { recipientRef: thread.recipientRef } : {}), state: thread.state, messages: thread.messages, observed: { version: thread.observedVersion, period: thread.period }, current: { sourceRef, evidenceRefs: current }, ...(preserved ? { historical: { sourceRef: thread.sourceRef, sourceIncarnation: thread.sourceIncarnation, observedVersion: thread.observedVersion, period: thread.period, evidenceRefs: originals } } : {}), continuity: changed ? "historical" : "unchanged" } }
  }
}


