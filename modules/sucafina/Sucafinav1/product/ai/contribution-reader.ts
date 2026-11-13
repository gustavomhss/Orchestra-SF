import { digestSfContribution, digestSfValue } from "../contracts/canonical.ts"
import { decodeSfContributionEnvelope } from "../contracts/schema-admission.ts"
import type { ContributionEnvelope } from "../contracts/resident-ai.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { SfNativeRunRecord, SfProductStatePort } from "../contracts/state.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createSfRunStore } from "./run-store.ts"

/** Read an existing contribution for a currently authorized consumer; never starts another run. */
export function createSfContributionReader(input: {
  state: SfProductStatePort
  runs: ReturnType<typeof createSfRunStore>
  requestFor: (context: TrustedDomainContext) => Request | undefined
  revalidate: (context: TrustedDomainContext) => Promise<boolean>
  verify: (output: ContributionEnvelope, run: SfNativeRunRecord, context: TrustedDomainContext) => Promise<PortResult<true>>
}) {
  return async (request: { outputRef: string; caseRef: ContributionEnvelope["caseRef"] }, context: TrustedDomainContext): Promise<PortResult<{ output: ContributionEnvelope; run: SfNativeRunRecord }>> => {
    const source = input.requestFor(context)
    if (!source || !request.outputRef.trim() || !await input.revalidate(context)) return { status: "denied", reason: "contribution-access-unavailable" }
    const read = () => input.state.read(source, "contributions", (state, authority) => {
      if (authority.principalRef !== context.binding.principalRef || authority.policyVersion !== context.binding.policyVersion || authority.accessRevision !== context.binding.accessRevision) return undefined
      return state.contributions[request.outputRef]
    })
    const first = await read()
    if (first.status !== "ok") return "reason" in first ? { status: first.status, reason: first.reason } : { status: "unavailable", reason: "contribution-unavailable" }
    const decoded = decodeSfContributionEnvelope(first.value)
    if (!decoded.ok || decoded.value.id !== request.outputRef || decoded.value.state !== "ready" || digestSfValue(decoded.value.caseRef) !== digestSfValue(request.caseRef) || decoded.value.accessRevision !== context.binding.accessRevision || digestSfContribution(decoded.value) !== decoded.value.outputDigest) return { status: "unavailable", reason: "contribution-unavailable" }
    const run = await input.runs.read(decoded.value.runProvenance.runId, context)
    if (run.status !== "ok") return run
    const native = run.value.native
    if (run.value.state !== "ready" || run.value.outputRef !== decoded.value.id || !native || digestSfValue(run.value.caseRef) !== digestSfValue(request.caseRef) || native.sessionID !== decoded.value.runProvenance.nativeSessionId || digestSfValue(native.skillReceipt) !== digestSfValue(Object.fromEntries(Object.keys(native.skillReceipt).map((key) => [key, decoded.value.runProvenance[key as keyof typeof native.skillReceipt]])))) return { status: "denied", reason: "contribution-provenance-mismatch" }
    const verified = await input.verify(decoded.value, run.value, context)
    if (verified.status !== "ok") return verified
    const current = await read()
    if (current.status !== "ok") return "reason" in current ? { status: current.status, reason: current.reason } : { status: "unavailable", reason: "contribution-unavailable" }
    if (!current.value || digestSfValue(current.value) !== digestSfValue(decoded.value)) return { status: "stale", reason: "contribution-changed" }
    const again = await input.runs.read(run.value.runRef, context)
    if (again.status !== "ok") return again
    if (digestSfValue(again.value) !== digestSfValue(run.value)) return { status: "stale", reason: "contribution-run-changed" }
    const verifiedAgain = await input.verify(decoded.value, again.value, context)
    if (verifiedAgain.status !== "ok") return verifiedAgain
    if (!await input.revalidate(context)) return { status: "denied", reason: "contribution-access-unavailable" }
    return { status: "ok", value: { output: decoded.value, run: again.value } }
  }
}
