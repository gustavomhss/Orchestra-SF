import { digestSfValue } from "../contracts/canonical.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { SfNativeRunRecord } from "../contracts/state.ts"
import type { SkillLoadReceipt } from "../contracts/resident-ai.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { BusinessPorts } from "../contracts/ports.ts"

type CaseRef = SfNativeRunRecord["caseRef"]
type ContinuationOf = { runRef: string; version: number; caseRef: CaseRef; responseRef: string; responseDigest: string }
type AdmittedContinuation = SfNativeRunRecord & { continuationOf: ContinuationOf }
type ContinuationRequest = Parameters<BusinessPorts["analysis"]["create"]>[0]

/** Authenticated continuation admission. This binds an application-resolved human response to a new run;
 * it does not execute the provider or reuse the previous run's session, ticket, or authority. */
export function createSfAnalysisContinuation(input: {
  readPrior: (runRef: string, freshCall: TrustedDomainContext) => Promise<PortResult<SfNativeRunRecord>>
  resolveHumanResponse: (responseRef: string, freshCall: TrustedDomainContext) => Promise<PortResult<{ ref: string; digest: string; caseRef: CaseRef }>>
  /** Atomically revalidate prior run and response, persist lineage, and deduplicate the idempotency key in one C08 commit. */
  admitFresh: (input: { request: ContinuationRequest; skillInput: unknown; continuationOf: ContinuationOf; idempotencyKey: string }, freshCall: TrustedDomainContext) => Promise<PortResult<{ run: AdmittedContinuation; sessionID: string; skillReceipt: SkillLoadReceipt }>>
  readAdmitted: (runRef: string, freshCall: TrustedDomainContext) => Promise<PortResult<SfNativeRunRecord>>
  revalidate: (freshCall: TrustedDomainContext) => Promise<boolean>
}) {
  return async (request: ContinuationRequest, skillInput: unknown, selection: { priorRunRef: string; expectedPriorVersion: number; responseRef: string }, freshCall: TrustedDomainContext): Promise<PortResult<{ run: AdmittedContinuation; sessionID: string; skillReceipt: SkillLoadReceipt }>> => {
    if (freshCall.kind !== "ui" || !selection.priorRunRef.trim() || !selection.responseRef.trim() || (!Number.isSafeInteger(selection.expectedPriorVersion) || selection.expectedPriorVersion < 1) || (!Number.isSafeInteger(request.caseRef.version) || request.caseRef.version < 1) || !await input.revalidate(freshCall)) return { status: "denied", reason: "fresh-human-authority-required" }
    const prior = await input.readPrior(selection.priorRunRef, freshCall)
    if (prior.status !== "ok") return prior
    if (prior.value.runRef !== selection.priorRunRef || prior.value.version !== selection.expectedPriorVersion || prior.value.state !== "needs-input" || prior.value.principalRef !== freshCall.binding.principalRef ||
      request.caseRef.id !== prior.value.caseRef.id || request.caseRef.incarnation !== prior.value.caseRef.incarnation || request.caseRef.version < prior.value.caseRef.version) return { status: "stale", reason: "continuation-base-changed" }
    const response = await input.resolveHumanResponse(selection.responseRef, freshCall)
    if (response.status !== "ok") return response
    if (response.value.ref !== selection.responseRef || response.value.caseRef.id !== request.caseRef.id || response.value.caseRef.incarnation !== request.caseRef.incarnation || response.value.caseRef.version !== request.caseRef.version || !/^[a-f0-9]{64}$/.test(response.value.digest)) return { status: "stale", reason: "human-response-changed" }
    const continuationOf: ContinuationOf = { runRef: prior.value.runRef, version: prior.value.version, caseRef: prior.value.caseRef, responseRef: response.value.ref, responseDigest: response.value.digest }
    const latestPrior = await input.readPrior(selection.priorRunRef, freshCall)
    const latestResponse = await input.resolveHumanResponse(selection.responseRef, freshCall)
    if (latestPrior.status !== "ok") return latestPrior
    if (latestResponse.status !== "ok") return latestResponse
    if (digestSfValue(latestPrior.value) !== digestSfValue(prior.value) || digestSfValue(latestResponse.value) !== digestSfValue(response.value) || !await input.revalidate(freshCall)) return { status: "stale", reason: "continuation-input-changed" }
    const admitted = await input.admitFresh({ request, skillInput, continuationOf, idempotencyKey: digestSfValue({ continuationOf, request, skillInput }) }, freshCall)
    if (admitted.status !== "ok") return admitted
    const run = admitted.value.run
    const reread = await input.readAdmitted(run.runRef, freshCall)
    if (reread.status !== "ok") return reread
    const receipt = admitted.value.skillReceipt
    if (run.runRef === prior.value.runRef || run.state !== "queued" || digestSfValue(run.caseRef) !== digestSfValue(request.caseRef) || run.principalRef !== freshCall.binding.principalRef || run.accessRevision !== freshCall.binding.accessRevision || run.policyVersion !== freshCall.binding.policyVersion || run.requestDigest !== digestSfValue(request) || run.skillInputDigest !== digestSfValue(skillInput) || run.objective !== request.objective || run.contextFingerprint !== request.contextFingerprint || run.native?.sessionID !== admitted.value.sessionID || run.native?.sessionID === prior.value.native?.sessionID || digestSfValue(run.continuationOf) !== digestSfValue(continuationOf) || digestSfValue(reread.value) !== digestSfValue(run) ||
      digestSfValue(run.native?.skillReceipt) !== digestSfValue(receipt) || receipt.runId !== run.runRef || receipt.nativeSessionId !== admitted.value.sessionID || receipt.skillId !== request.skillId || receipt.skillVersion !== request.skillVersion || receipt.skillId !== run.skillId || receipt.profileId !== request.profileId || receipt.profileVersion !== request.profileVersion || receipt.manifestDigest !== request.manifestDigest || receipt.profileId !== run.selection.profile.id || receipt.profileVersion !== run.selection.profile.version || receipt.profileDigest !== run.selection.profile.sourceDigest || receipt.manifestDigest !== run.selection.manifestDigest ||
      (!receipt.loadedMessageId.trim() || !Number.isFinite(Date.parse(receipt.loadedAt))) || !run.selection.skills.some((skill) => skill.id === receipt.skillId && skill.version === receipt.skillVersion && skill.sourceDigest === receipt.sourceDigest && skill.instructionsDigest === receipt.instructionsDigest) || !await input.revalidate(freshCall)) return { status: "unavailable", reason: "continuation-admission-unverified" }
    return { status: "ok", value: admitted.value }
  }
}
