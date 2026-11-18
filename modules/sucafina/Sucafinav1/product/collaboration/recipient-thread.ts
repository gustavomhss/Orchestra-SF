import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import { isThread } from "./threads.ts"
import type { CollaborationThread } from "./threads.ts"
import type { createCollaborationReissuer } from "./reissue.ts"

type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>
export type RecipientThread = Pick<CollaborationThread, "id" | "kind" | "recipientRef" | "state" | "messages"> & {
  observed: { version: number; period: CollaborationThread["period"] }
  current: { sourceRef: RecordEvidence; evidenceRefs: readonly RecordEvidence[] }
}

/** The recipient receives current, individually authorized refs, never the creator's scoped refs. */
export function createRecipientThreadReader(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  reissue: ReturnType<typeof createCollaborationReissuer>
  authorize: (refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => Promise<boolean>
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
    if (thread.evidenceRefs.some((ref) => !ref || typeof ref !== "object" || ref.kind !== "record")) return { status: "unavailable", reason: "thread-source-unavailable" }
    const originals = thread.evidenceRefs as readonly RecordEvidence[]
    const sourceIndex = originals.findIndex((ref) => ref.refId === thread.sourceRef && ref.target.incarnation === thread.sourceIncarnation)
    if (sourceIndex < 0 || originals.filter((ref) => ref.refId === thread.sourceRef).length !== 1) return { status: "unavailable", reason: "thread-source-unavailable" }
    const issued = await Promise.all(originals.map((ref) => input.reissue(ref, context)))
    if (issued.some((result) => result.status !== "ok")) return { status: "unavailable", reason: "thread-source-unavailable" }
    const current = issued.flatMap((result) => result.status === "ok" ? [result.value] : [])
    const sourceRef = current[sourceIndex]
    if (!sourceRef || !await input.authorize(current, context)) return { status: "unavailable", reason: "thread-source-unavailable" }
    const again = await read()
    if (again.status !== "ok" || !isThread(again.value) || again.value.id !== id || digestSfValue(again.value) !== digestSfValue(thread) || !await input.authorize(current, context) || !await input.host.revalidate(context)) return { status: "unavailable", reason: "thread-access-unavailable" }
    return { status: "ok", value: { id: thread.id, kind: thread.kind, ...(thread.recipientRef ? { recipientRef: thread.recipientRef } : {}), state: thread.state, messages: thread.messages, observed: { version: thread.observedVersion, period: thread.period }, current: { sourceRef, evidenceRefs: current } } }
  }
}

