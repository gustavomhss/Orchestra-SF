import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import { isThread, sameThreadReadScope } from "./threads.ts"
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

export type ReviewAnswerObservation = { thread: CollaborationThread; current: () => boolean }

/** Current refs are issued for the reader; original refs require an explicit historical source grant. */
export function createRecipientThreadReader(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  reissue: ReturnType<typeof createCollaborationReissuer>
  refresh?: CollaborationWorkSourceRefresh
  authorize: (refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => Promise<boolean>
  authorizeHistorical?: (refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => Promise<boolean>
  authorizeContext?: (basis: ThreadSourceContext, context: TrustedDomainContext) => Promise<boolean>
  authorizeReviewLeg?: (thread: CollaborationThread, basis: ThreadSourceContext, refs: readonly BusinessEvidenceRef[],
    context: TrustedDomainContext, historical: () => Promise<boolean>) => Promise<boolean | undefined>
}) {
  return async (id: string, context: TrustedDomainContext, observeAnswer?: (latest: ReviewAnswerObservation) => void): Promise<PortResult<RecipientThread>> => {
    if (typeof id !== "string" || !id.trim()) return { status: "needs-input", reason: "invalid-thread-reference" }
    const request = input.host.requestFor(context)
    const stateRead = input.state.read
    const requestFor = input.host.requestFor
    const revalidate = input.host.revalidate
    const reissue = input.reissue
    const refresh = input.refresh
    const authorize = input.authorize
    const lease = context.lease
    const binding = observeAnswer && digestSfValue([context.kind, context.binding])
    const currentAccess = async () => !!request && input.host.requestFor(context) === request && await input.host.revalidate(context) && input.host.requestFor(context) === request
    try {
      if (!request || !await currentAccess()) return { status: "denied", reason: "thread-access-unavailable" }
      const read = () => input.state.read(request, "threads", (state, authority) => {
        const bound = authority.principalRef === context.binding.principalRef && authority.accessRevision === context.binding.accessRevision && authority.policyVersion === context.binding.policyVersion
        return { bound, thread: bound ? state.threads[id] : undefined }
      })
      const first = await read()
      if (!await currentAccess()) return { status: "denied", reason: "thread-access-unavailable" }
      if (first.status !== "ok") return first.status === "denied" ? first : { status: "unavailable", reason: "thread-read-unavailable" }
      if (!first.value.bound) return { status: "denied", reason: "thread-access-binding-changed" }
      if (first.value.thread === undefined) return { status: "denied", reason: "thread-target-changed" }
      if (!isThread(first.value.thread)) return { status: "unavailable", reason: "thread-read-unavailable" }
      const thread = first.value.thread
      if (thread.id !== id) return { status: "denied", reason: "thread-target-changed" }
      if (thread.recipientRef !== context.binding.principalRef && !thread.messages.some((message) => message.authorRef === context.binding.principalRef)) return { status: "denied", reason: "thread-access-unavailable" }
      const originals = thread.evidenceRefs
      const sourceIndex = originals.findIndex((ref) => ref.kind === "record" && ref.refId === thread.sourceRef && ref.target.incarnation === thread.sourceIncarnation)
      if (sourceIndex < 0 || originals.filter((ref) => ref.refId === thread.sourceRef).length !== 1) return { status: "unavailable", reason: "thread-source-unavailable" }
      const messageContexts = thread.messages.map((message) => threadMessageContext(thread, message))
      if (messageContexts.some((basis) => !basis)) return { status: "unavailable", reason: "thread-source-unavailable" }
      const historyRefs = [...new Map([...originals, ...messageContexts.flatMap((basis) => basis!.evidenceRefs)].map((ref) => [ref.refDigest, ref])).values()]
      const reviewBasis = messageContexts[0]?.reviewContext ? messageContexts[0] : undefined
      const basisDigest = observeAnswer && reviewBasis ? digestSfValue(reviewBasis) : undefined
      const pairEligible = basisDigest !== undefined && messageContexts.every((basis) => digestSfValue(basis) === basisDigest)
      const authorizeHistorical = input.authorizeHistorical
      const authorizeContext = input.authorizeContext
      const authorizeReviewLeg = input.authorizeReviewLeg
      const observeReviewLeg = async (selected: CollaborationThread, historical: () => Promise<boolean>) => {
        if (!reviewBasis || !authorizeContext || !authorizeHistorical || !authorizeReviewLeg) return undefined
        const current = () => input.authorizeHistorical === authorizeHistorical && input.authorizeContext === authorizeContext &&
          input.authorizeReviewLeg === authorizeReviewLeg
        const result = await authorizeReviewLeg(selected, reviewBasis, historyRefs, context, async () => current() && await historical() && current())
        return current() ? result : false
      }
      // Historical access is optional for ordinary threads: an inconclusive
      // probe may still be followed by independent current-ref issuance below.
      let historical: boolean | undefined
      let checkedHistory = false
      const observeHistorical = async () => {
        if (!checkedHistory) {
          checkedHistory = true
          historical = await input.authorizeHistorical?.(historyRefs, context).catch(() => undefined)
        }
        return historical === true
      }
      const initial = await observeReviewLeg(thread, observeHistorical)
      if (initial === false && !checkedHistory) return { status: "denied", reason: "review-thread-context-unavailable" }
      if (initial === undefined) await observeHistorical()
      const preserved = historical === true
      if (reviewBasis && (historical === undefined || !input.authorizeContext)) return { status: "unavailable", reason: "thread-read-unavailable" }
      if (reviewBasis && (!preserved || !(initial ?? await input.authorizeContext!(reviewBasis, context)))) return { status: "denied", reason: "review-thread-context-unavailable" }
      const records = historyRefs.filter((ref): ref is RecordEvidence => ref.kind === "record")
      const supplements = historyRefs.filter((ref) => ref.kind !== "record")
      const contextScopes = await Promise.all(records.map((ref) => input.reissue(ref, context)))
      // A rolled observation window denies same-period reissue. A preserved historical grant restores today's source instead of treating that denial as lost access.
      const samePeriodDenied = contextScopes.some((result) => result.status === "denied")
      if (!await currentAccess() || samePeriodDenied && !preserved) return { status: "denied", reason: "thread-source-unavailable" }
      const changed = samePeriodDenied || contextScopes.some((result) => result.status !== "ok")
      if (changed && !preserved) return { status: "unavailable", reason: "thread-source-unavailable" }
      // Refresh proves physical continuity for every stored basis; it never authorizes historical text by itself.
      const renew = () => Promise.all(records.map((ref) => changed && input.refresh ? input.refresh(ref, context) : input.reissue(ref, context)))
      const issued = changed ? await renew() : contextScopes
      if (!await currentAccess() || issued.some((result) => result.status === "denied")) return { status: "denied", reason: "thread-source-unavailable" }
      if (issued.some((result) => result.status !== "ok")) return samePeriodDenied ? { status: "denied", reason: "thread-source-unavailable" } : { status: "unavailable", reason: "thread-source-unavailable" }
      const issuedByDigest = new Map(issued.flatMap((result, index) => result.status === "ok" ? [[records[index]!.refDigest, result.value] as const] : []))
      const projection = (refs: readonly BusinessEvidenceRef[]) => refs.map((ref) => ref.kind === "record" ? issuedByDigest.get(ref.refDigest)! : ref)
      const current = projection(originals)
      const canonical = digestSfValue(current.map((ref) => ref.refDigest).sort())
      if (messageContexts.some((basis) => digestSfValue(projection(basis!.evidenceRefs).map((ref) => ref.refDigest).sort()) !== canonical)) return { status: "unavailable", reason: "thread-source-continuity-unavailable" }
      const sourceRef = current[sourceIndex]
      const authorizeCurrent = async () => await input.authorize(current.filter((ref) => ref.kind === "record"), context) && (!supplements.length || await (input.authorizeHistorical ?? input.authorize)(supplements, context))
      if (!sourceRef || sourceRef.kind !== "record") return { status: "unavailable", reason: "thread-source-unavailable" }
      if (!await authorizeCurrent() || !await currentAccess()) return { status: "denied", reason: "thread-source-unavailable" }
      const again = await read()
      if (!await currentAccess()) return { status: "denied", reason: "thread-access-unavailable" }
      if (again.status !== "ok") return again.status === "denied" ? again : { status: "unavailable", reason: "thread-read-unavailable" }
      if (!again.value.bound) return { status: "denied", reason: "thread-access-binding-changed" }
      if (again.value.thread === undefined) return { status: "denied", reason: "thread-target-changed" }
      if (!isThread(again.value.thread)) return { status: "unavailable", reason: "thread-read-unavailable" }
      if (!sameThreadReadScope(thread, again.value.thread)) return { status: "denied", reason: "thread-target-changed" }
      const finalScopes = await renew()
      if (!await currentAccess() || finalScopes.some((result) => result.status === "denied")) return { status: "denied", reason: "thread-access-unavailable" }
      if (finalScopes.some((result) => result.status !== "ok")) return { status: "unavailable", reason: "thread-read-unavailable" }
      if (!await authorizeCurrent()) return { status: "denied", reason: "thread-access-unavailable" }
      let finalHistory: boolean | undefined
      const observeFinalHistory = async () => finalHistory ??= !preserved || await input.authorizeHistorical!(historyRefs, context)
      const final = await observeReviewLeg(again.value.thread, observeFinalHistory)
      if (pairEligible && initial === true && final === undefined) return { status: "denied", reason: "thread-access-unavailable" }
      if (!(final ?? (await observeFinalHistory() && (!reviewBasis || await input.authorizeContext!(reviewBasis, context)))) ||
        !await currentAccess()) return { status: "denied", reason: "thread-access-unavailable" }
      if (digestSfValue(again.value.thread) !== digestSfValue(thread) || digestSfValue(finalScopes) !== digestSfValue(issued)) return { status: "stale", reason: "thread-content-changed" }
      // Both independent C08 observations completed under the installed review
      // reader. Only the private answer selector may observe the final raw row.
      if (observeAnswer && pairEligible && initial === true && final === true && preserved) {
        const current = () => !request.signal.aborted && input.host.requestFor === requestFor &&
          input.host.revalidate === revalidate && requestFor.call(input.host, context) === request &&
          input.state.read === stateRead && input.reissue === reissue && input.refresh === refresh &&
          input.authorize === authorize && input.authorizeHistorical === authorizeHistorical &&
          input.authorizeContext === authorizeContext && input.authorizeReviewLeg === authorizeReviewLeg &&
          context.lease === lease && digestSfValue([context.kind, context.binding]) === binding
        if (!current()) return { status: "denied", reason: "thread-access-unavailable" }
        observeAnswer({ thread: again.value.thread, current })
      }
      return { status: "ok", value: { id: thread.id, kind: thread.kind, ...(thread.recipientRef ? { recipientRef: thread.recipientRef } : {}), state: thread.state, messages: thread.messages, observed: { version: thread.observedVersion, period: thread.period }, current: { sourceRef, evidenceRefs: current }, ...(preserved ? { historical: { sourceRef: thread.sourceRef, sourceIncarnation: thread.sourceIncarnation, observedVersion: thread.observedVersion, period: thread.period, evidenceRefs: originals } } : {}), continuity: changed ? "historical" : "unchanged" } }
    } catch {
      const authorized = await currentAccess().catch(() => undefined)
      if (authorized === false) return { status: "denied", reason: "thread-access-unavailable" }
      return { status: "unavailable", reason: "thread-read-unavailable" }
    }
  }
}
