import { digestSfContribution, digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfContributionEnvelope } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { BusinessContextService } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfNativeRunRecord } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { ContributionEnvelope } from "../../../../modules/sucafina/Sucafinav1/product/contracts/resident-ai.ts"
import { withoutObservationTimes } from "./analysis-verifier.ts"

export function createSfAnalysisAuthorReader(input: { authority: ReturnType<typeof createSfProductAuthority>; context: BusinessContextService;
  resolveCase: (call: TrustedDomainContext) => Promise<PortResult<{ id: string; incarnation: string; version: number }>> }) {
  return async (runRef: string, outputDigest: string, call: TrustedDomainContext) => {
    const binding = digestSfValue([call.kind, call.binding])
    const request = input.authority.host.requestFor(call)
    const selected = await input.resolveCase(call)
    if (!request || selected.status !== "ok" || !/^[a-f0-9]{64}$/.test(outputDigest) || !await input.authority.host.revalidate(call) ||
      call.kind === "native" && (call.binding.profileId !== "sf_reviewer" || call.binding.runId === runRef ||
        call.binding.caseId !== selected.value.id || call.binding.caseIncarnation !== selected.value.incarnation || call.binding.caseVersion !== selected.value.version ||
        call.binding.skillReceipts.filter((receipt) => ["sf-contestar-decisao", "sf-revisar-evidencias"].includes(receipt.skillId) && receipt.runId === call.binding.runId && receipt.nativeSessionId === call.binding.nativeSessionId).length !== 1))
      return { status: "denied" as const, reason: "author-analysis-unavailable" }
    const read = () => input.authority.state.read(request, "contributions", (state, actor) => {
      const run = state.nativeRuns?.[runRef]
      const reviewer = call.kind === "native" ? state.nativeRuns?.[call.binding.runId] : undefined
      const current = run && state.cases[run.caseRef.id]
      const output = run?.outputRef && state.contributions[run.outputRef]
      return run?.state === "ready" && run.native && output && current && current.participants.includes(actor.principalRef) &&
        run.principalRef === actor.principalRef && run.accessRevision === actor.accessRevision && run.policyVersion === actor.policyVersion &&
        (call.kind !== "native" || run.native.sessionID !== call.binding.nativeSessionId && reviewer?.native?.sessionID === call.binding.nativeSessionId &&
          ["queued", "running", "ready"].includes(reviewer.state) && ["sf-contestar-decisao", "sf-revisar-evidencias"].includes(reviewer.skillId) &&
          reviewer.reviewTarget?.targetRunId === runRef && reviewer.reviewTarget.targetSessionId === run.native.sessionID && reviewer.reviewTarget.targetOutputDigest === outputDigest &&
          digestSfValue(reviewer.reviewTarget.caseRef) === digestSfValue(selected.value) && digestSfValue(reviewer.caseRef) === digestSfValue(selected.value) &&
          reviewer.principalRef === actor.principalRef && reviewer.accessRevision === actor.accessRevision && reviewer.policyVersion === actor.policyVersion) &&
        digestSfValue(run.caseRef) === digestSfValue(selected.value) && current.incarnation === run.caseRef.incarnation && current.version === run.caseRef.version
        ? { run, output } : undefined
    })
    const found = await read()
    if (found.status !== "ok" || !found.value) return { status: "unavailable" as const, reason: "author-analysis-unavailable" }
    const run = found.value.run
    const decoded = decodeSfContributionEnvelope(found.value.output)
    if (!decoded.ok || decoded.value.state !== "ready" || decoded.value.id !== run.outputRef || decoded.value.outputDigest !== outputDigest ||
      decoded.value.outputDigest !== digestSfContribution(decoded.value) || digestSfValue(decoded.value.caseRef) !== digestSfValue(run.caseRef) ||
      decoded.value.accessRevision !== run.accessRevision || decoded.value.runProvenance.runId !== runRef || decoded.value.runProvenance.nativeSessionId !== run.native.sessionID ||
      decoded.value.runProvenance.contextFingerprint !== run.contextFingerprint || decoded.value.runProvenance.actualModel !== `${run.model.providerID}/${run.model.id}` ||
      digestSfValue(Object.fromEntries(Object.keys(run.native.skillReceipt).map((key) => [key, decoded.value.runProvenance[key as keyof typeof run.native.skillReceipt]]))) !== digestSfValue(run.native.skillReceipt))
      return { status: "unavailable" as const, reason: "author-analysis-invalid" }
    const resolutions = await input.context.context({ refs: decoded.value.evidenceRefs }, call)
    const again = await read()
    const checked = await input.context.context({ refs: decoded.value.evidenceRefs }, call)
    const selectedAgain = await input.resolveCase(call)
    if (resolutions.length !== decoded.value.evidenceRefs.length || resolutions.some((item, index) => item.state !== "fresh" || !item.currentRef || !item.authorizedProjection ||
      digestSfValue(item.ref) !== digestSfValue(decoded.value.evidenceRefs[index]) || digestSfValue(item.currentRef) !== digestSfValue(item.ref)) ||
      digestSfValue(withoutObservationTimes(resolutions)) !== digestSfValue(withoutObservationTimes(checked)) || again.status !== "ok" ||
      digestSfValue(again.value) !== digestSfValue(found.value) || selectedAgain.status !== "ok" || digestSfValue(selectedAgain.value) !== digestSfValue(selected.value) ||
      binding !== digestSfValue([call.kind, call.binding]) || !await input.authority.host.revalidate(call)) return { status: "stale" as const, reason: "author-analysis-changed" }
    return { status: "ok" as const, value: { run, output: decoded.value } }
  }
}

/** Historical authors still require the current review run's persisted target and distinct session. */
export function createSfAnalysisReviewTargetVerifier(authority: ReturnType<typeof createSfProductAuthority>) {
  return async (author: { run: SfNativeRunRecord; output: ContributionEnvelope }, caseRef: { id: string; incarnation: string; version: number }, call: TrustedDomainContext) => {
    if (call.kind === "ui") return authority.host.revalidate(call)
    const identity = digestSfValue([call.kind, call.binding])
    const request = authority.host.requestFor(call)
    const native = author.run.native
    if (!request || !native || call.binding.profileId !== "sf_reviewer" || call.binding.runId === author.run.runRef ||
      call.binding.nativeSessionId === native.sessionID || call.binding.caseId !== caseRef.id || call.binding.caseIncarnation !== caseRef.incarnation ||
      call.binding.caseVersion !== caseRef.version || !await authority.host.revalidate(call)) return false
    const read = () => authority.state.read(request, "contributions", (state, actor) => {
      const reviewer = state.nativeRuns?.[call.binding.runId]
      const current = state.cases[caseRef.id]
      const stored = state.nativeRuns?.[author.run.runRef]
      const output = stored?.outputRef ? state.contributions[stored.outputRef] : undefined
      return actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion &&
        current?.incarnation === caseRef.incarnation && current.version === caseRef.version && current.participants.includes(actor.principalRef) &&
        digestSfValue(stored) === digestSfValue(author.run) && digestSfValue(output) === digestSfValue(author.output) &&
        !!reviewer?.native && reviewer.native.sessionID === call.binding.nativeSessionId && ["queued", "running", "ready"].includes(reviewer.state) &&
        ["sf-contestar-decisao", "sf-revisar-evidencias"].includes(reviewer.skillId) && reviewer.principalRef === actor.principalRef &&
        reviewer.accessRevision === actor.accessRevision && reviewer.policyVersion === actor.policyVersion && digestSfValue(reviewer.caseRef) === digestSfValue(caseRef) &&
        reviewer.reviewTarget?.targetRunId === author.run.runRef && reviewer.reviewTarget.targetSessionId === native.sessionID &&
        reviewer.reviewTarget.targetOutputDigest === author.output.outputDigest && digestSfValue(reviewer.reviewTarget.caseRef) === digestSfValue(caseRef) &&
        call.binding.skillReceipts.filter((receipt) => receipt.skillId === reviewer.skillId && receipt.runId === call.binding.runId &&
          receipt.nativeSessionId === call.binding.nativeSessionId && digestSfValue(receipt) === digestSfValue(reviewer.native!.skillReceipt)).length === 1
    })
    const first = await read()
    const again = await read()
    return first.status === "ok" && first.value === true && again.status === "ok" && again.value === true &&
      identity === digestSfValue([call.kind, call.binding]) && !request.signal.aborted && await authority.host.revalidate(call)
  }
}
