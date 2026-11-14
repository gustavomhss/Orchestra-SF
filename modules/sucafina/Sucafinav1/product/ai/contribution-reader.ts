import { digestSfContribution, digestSfValue } from "../contracts/canonical.ts"
import { decodeSfContributionEnvelope } from "../contracts/schema-admission.ts"
import type { ContributionEnvelope } from "../contracts/resident-ai.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { SfNativeRunRecord, SfProductStatePort } from "../contracts/state.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createSfRunStore } from "./run-store.ts"
import { matchesSfRunOutput } from "./run-provenance.ts"

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
    if (!source || !request.outputRef.trim()) return { status: "denied", reason: "contribution-access-unavailable" }
    const identityMatches = retainReadIdentity(request, context, source, input.requestFor)
    if (!await input.revalidate(context)) return { status: "denied", reason: "contribution-access-unavailable" }
    if (!identityMatches()) return { status: "denied", reason: "contribution-read-identity-changed" }
    const read = () => input.state.read(source, "contributions", (state, authority) => {
      if (authority.principalRef !== context.binding.principalRef || authority.policyVersion !== context.binding.policyVersion || authority.accessRevision !== context.binding.accessRevision) return undefined
      return state.contributions[request.outputRef]
    })
    const first = await read()
    if (!identityMatches()) return { status: "denied", reason: "contribution-read-identity-changed" }
    if (first.status !== "ok") return "reason" in first ? { status: first.status, reason: first.reason } : { status: "unavailable", reason: "contribution-unavailable" }
    const decoded = decodeSfContributionEnvelope(first.value)
    if (!decoded.ok || decoded.value.id !== request.outputRef || decoded.value.state !== "ready" || digestSfValue(decoded.value.caseRef) !== digestSfValue(request.caseRef) || decoded.value.accessRevision !== context.binding.accessRevision || digestSfContribution(decoded.value) !== decoded.value.outputDigest) return { status: "unavailable", reason: "contribution-unavailable" }
    const outputDigest = digestSfValue(decoded.value)
    const run = await input.runs.read(decoded.value.runProvenance.runId, context)
    if (!identityMatches()) return { status: "denied", reason: "contribution-read-identity-changed" }
    if (run.status !== "ok") return run
    if (!matchesDigest(decoded.value, outputDigest)) return { status: "denied", reason: "contribution-verification-mutated-input" }
    if (run.value.state !== "ready" || run.value.outputRef !== decoded.value.id || !matchesSfRunOutput(run.value, decoded.value)) return { status: "denied", reason: "contribution-provenance-mismatch" }
    const runDigest = digestSfValue(run.value)
    const originalsMatch = () => matchesDigest(decoded.value, outputDigest) && matchesDigest(run.value, runDigest)
    const verified = await input.verify(decoded.value, run.value, context)
    if (!identityMatches()) return { status: "denied", reason: "contribution-read-identity-changed" }
    if (verified.status !== "ok") return verified
    if (!originalsMatch()) return { status: "denied", reason: "contribution-verification-mutated-input" }
    const current = await read()
    if (!identityMatches()) return { status: "denied", reason: "contribution-read-identity-changed" }
    if (current.status !== "ok") return "reason" in current ? { status: current.status, reason: current.reason } : { status: "unavailable", reason: "contribution-unavailable" }
    if (!originalsMatch()) return { status: "denied", reason: "contribution-verification-mutated-input" }
    if (!current.value || !matchesDigest(current.value, outputDigest)) return { status: "stale", reason: "contribution-changed" }
    const again = await input.runs.read(run.value.runRef, context)
    if (!identityMatches()) return { status: "denied", reason: "contribution-read-identity-changed" }
    if (again.status !== "ok") return again
    if (!originalsMatch()) return { status: "denied", reason: "contribution-verification-mutated-input" }
    if (!matchesDigest(again.value, runDigest)) return { status: "stale", reason: "contribution-run-changed" }
    const verifiedAgain = await input.verify(decoded.value, again.value, context)
    if (!identityMatches()) return { status: "denied", reason: "contribution-read-identity-changed" }
    if (verifiedAgain.status !== "ok") return verifiedAgain
    if (!originalsMatch() || !matchesDigest(again.value, runDigest)) return { status: "denied", reason: "contribution-verification-mutated-input" }
    if (!await input.revalidate(context)) return { status: "denied", reason: "contribution-access-unavailable" }
    if (!identityMatches()) return { status: "denied", reason: "contribution-read-identity-changed" }
    if (!originalsMatch() || !matchesDigest(again.value, runDigest)) return { status: "denied", reason: "contribution-verification-mutated-input" }
    return { status: "ok", value: { output: structuredClone(decoded.value), run: structuredClone(again.value) } }
  }
}

/** Historical access reopens the current case and sources; an old receipt is not an access grant. */
export function createSfHistoricalContributionReader(input: {
  state: SfProductStatePort
  requestFor: (context: TrustedDomainContext) => Request | undefined
  revalidate: (context: TrustedDomainContext) => Promise<boolean>
  /** Reopen and authorize every source and replay the historical output against current domain data. */
  verifyHistorical: (output: ContributionEnvelope, run: SfNativeRunRecord, currentCase: ContributionEnvelope["caseRef"], context: TrustedDomainContext) => Promise<PortResult<true>>
}) {
  return async (request: { outputRef: string; currentCase: ContributionEnvelope["caseRef"] }, context: TrustedDomainContext): Promise<PortResult<{ state: "historical"; output: ContributionEnvelope }>> => {
    const source = input.requestFor(context)
    if (!source || !request.outputRef.trim()) return { status: "denied", reason: "contribution-access-unavailable" }
    const identityMatches = retainReadIdentity(request, context, source, input.requestFor)
    if (!await input.revalidate(context)) return { status: "denied", reason: "contribution-access-unavailable" }
    if (!identityMatches()) return { status: "denied", reason: "contribution-read-identity-changed" }
    if (context.kind === "native" && (context.binding.caseId !== request.currentCase.id || context.binding.caseIncarnation !== request.currentCase.incarnation || context.binding.caseVersion !== request.currentCase.version)) return { status: "denied", reason: "historical-case-binding-mismatch" }
    const read = async () => {
      const cases = await input.state.read(source, "cases", (state, authority) => {
        const current = state.cases[request.currentCase.id]
        if (!current || current.incarnation !== request.currentCase.incarnation || current.version !== request.currentCase.version || authority.principalRef !== context.binding.principalRef || authority.accessRevision !== context.binding.accessRevision || authority.policyVersion !== context.binding.policyVersion || !current.participants.includes(authority.principalRef)) return undefined
        return current
      })
      if (cases.status !== "ok" || !cases.value) return undefined
      const found = await input.state.read(source, "contributions", (state, authority) => {
        if (authority.principalRef !== context.binding.principalRef || authority.accessRevision !== context.binding.accessRevision || authority.policyVersion !== context.binding.policyVersion) return undefined
        const output = state.contributions[request.outputRef]
        return { output, run: output && state.nativeRuns?.[output.runProvenance.runId] }
      })
      if (found.status !== "ok" || !found.value) return undefined
      const decoded = decodeSfContributionEnvelope(found.value.output)
      const run = found.value.run
      if (!decoded.ok || decoded.value.id !== request.outputRef || decoded.value.state !== "ready" || decoded.value.caseRef.id !== request.currentCase.id ||
        decoded.value.caseRef.incarnation !== request.currentCase.incarnation || decoded.value.caseRef.version > request.currentCase.version || !run ||
        run.principalRef !== context.binding.principalRef || (run.state !== "ready" && run.state !== "stale") || run.outputRef !== decoded.value.id ||
        (decoded.value.caseRef.version === request.currentCase.version && run.state !== "stale") || !matchesSfRunOutput(run, decoded.value)) return undefined
      return { case: cases.value, output: decoded.value, run }
    }
    const first = await read()
    if (!identityMatches()) return { status: "denied", reason: "contribution-read-identity-changed" }
    if (!first) return { status: "unavailable", reason: "historical-contribution-unavailable" }
    const historicalDigest = digestSfValue(first)
    const verified = await input.verifyHistorical(first.output, first.run, request.currentCase, context)
    if (!identityMatches()) return { status: "denied", reason: "contribution-read-identity-changed" }
    if (verified.status !== "ok") return verified
    if (!matchesDigest(first, historicalDigest)) return { status: "denied", reason: "historical-verification-mutated-input" }
    const again = await read()
    if (!identityMatches()) return { status: "denied", reason: "contribution-read-identity-changed" }
    if (!again || !matchesDigest(again, historicalDigest)) return { status: "stale", reason: "historical-contribution-changed" }
    const verifiedAgain = await input.verifyHistorical(again.output, again.run, request.currentCase, context)
    if (!identityMatches()) return { status: "denied", reason: "contribution-read-identity-changed" }
    if (verifiedAgain.status !== "ok") return verifiedAgain
    if (!matchesDigest(first, historicalDigest) || !matchesDigest(again, historicalDigest)) return { status: "denied", reason: "historical-verification-mutated-input" }
    if (!await input.revalidate(context)) return { status: "denied", reason: "contribution-access-unavailable" }
    if (!identityMatches()) return { status: "denied", reason: "contribution-read-identity-changed" }
    if (!matchesDigest(first, historicalDigest) || !matchesDigest(again, historicalDigest)) return { status: "denied", reason: "historical-verification-mutated-input" }
    return { status: "ok", value: { state: "historical", output: structuredClone(again.output) } }
  }
}

function matchesDigest(value: unknown, expected: string) {
  try { return digestSfValue(value) === expected } catch { return false }
}

/** Keep identity stable across host callbacks without copying or persisting a grant. */
function retainReadIdentity(request: unknown, context: TrustedDomainContext, source: Request,
  requestFor: (context: TrustedDomainContext) => Request | undefined) {
  const requestDigest = digestSfValue(request)
  const binding = context.binding
  const authorityDigest = digestSfValue({ kind: context.kind, binding })
  const lease = context.lease
  return () => requestFor(context) === source && context.binding === binding && context.lease === lease && matchesDigest(request, requestDigest) &&
    matchesDigest({ kind: context.kind, binding: context.binding }, authorityDigest)
}
