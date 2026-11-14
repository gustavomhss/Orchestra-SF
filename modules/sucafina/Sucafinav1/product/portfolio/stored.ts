import { digestSfContribution, digestSfValue } from "../contracts/canonical.ts"
import { decodeSfContributionOutput } from "../contracts/schema-admission.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { PortfolioResult } from "../contracts/decisions.ts"
import type { DecisionCasePort, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { ContributionEnvelope, SkillLoadReceipt } from "../contracts/resident-ai.ts"
import type { SfProductStatePort } from "../contracts/state.ts"

/** Read only outputs already committed by the native contribution store. */
export function createStoredPortfolioReader(input: {
  state: SfProductStatePort
  cases: DecisionCasePort
  evidence: BusinessContextService
  requestFor: (context: TrustedDomainContext) => Request | undefined
  revalidate: (context: TrustedDomainContext) => Promise<boolean>
  revalidatePortfolio: (portfolio: PortfolioResult, context: TrustedDomainContext) => Promise<boolean>
}) {
  return async (outputRef: string, context: TrustedDomainContext): Promise<PortResult<{ portfolioResultRef: string; portfolio: PortfolioResult; caseRef: { id: string; incarnation: string; version: number } }>> => {
    const request = input.requestFor(context)
    if (!outputRef.trim() || !request || !await input.revalidate(context)) return { status: "denied", reason: "portfolio-access-unavailable" }
    const read = () => input.state.read(request, "contributions", (state, authority) => {
      if (authority.principalRef !== context.binding.principalRef || authority.accessRevision !== context.binding.accessRevision || authority.policyVersion !== context.binding.policyVersion) return undefined
      const output = state.contributions[outputRef]
      if (!output || output.id !== outputRef || output.kind !== "PortfolioComparison" || output.state !== "ready") return undefined
      const run = state.nativeRuns?.[output.runProvenance.runId]
      if (!run || run.runRef !== output.runProvenance.runId || typeof output.runProvenance.actualModel !== "string" || !output.runProvenance.actualModel.trim() || run.state !== "ready" || run.outputRef !== output.id || run.principalRef !== authority.principalRef || run.accessRevision !== authority.accessRevision || run.policyVersion !== authority.policyVersion || run.caseRef.id !== output.caseRef.id || run.caseRef.incarnation !== output.caseRef.incarnation || run.caseRef.version !== output.caseRef.version || !run.native || run.native.sessionID !== output.runProvenance.nativeSessionId || digestSfValue(run.native.skillReceipt) !== digestSfValue(Object.fromEntries(Object.keys(run.native.skillReceipt).map((key) => [key, output.runProvenance[key as keyof SkillLoadReceipt]]))) || run.contextFingerprint !== output.runProvenance.contextFingerprint) return undefined
      return output
    })
    const stored = await read().catch(() => undefined)
    if (!stored) return { status: "unavailable", reason: "portfolio-state-unavailable" }
    if (stored.status !== "ok") return "reason" in stored ? { status: stored.status, reason: stored.reason } : { status: "unavailable", reason: "portfolio-state-unavailable" }
    const output = stored.value
    if (!output || output.accessRevision !== context.binding.accessRevision || !validDigest(output) || !decodeSfContributionOutput("PortfolioComparison", output.payload).ok) return { status: "denied", reason: "portfolio-access-unavailable" }
    const caseRef = `case:${encodeURIComponent(output.caseRef.id)}:${encodeURIComponent(output.caseRef.incarnation)}`
    const current = await input.cases.read({ caseRef }, context)
    if (current.status !== "ok") return current
    if (current.value.case.version !== output.caseRef.version) return { status: "stale", reason: "portfolio-case-changed" }
    const refs = [...output.evidenceRefs, ...output.payload.evidenceRefs, ...output.payload.combinations.flatMap((item) => item.analysis ? [...item.analysis.scenario.sourceRefs, ...item.analysis.scenario.costCoverage.evaluatedSourceRefs, ...item.analysis.scenario.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)] : [])].filter((ref, index, values) => values.findIndex((item) => digestSfValue(item) === digestSfValue(ref)) === index)
    if (!await accessible(input.evidence, refs, context) || !await input.revalidatePortfolio(output.payload, context).catch(() => false)) return { status: "unavailable", reason: "portfolio-evidence-unavailable" }
    const again = await read().catch(() => undefined)
    if (!again || again.status !== "ok" || !again.value || digestSfValue(again.value) !== digestSfValue(output)) return { status: "stale", reason: "portfolio-changed" }
    const latestCase = await input.cases.read({ caseRef }, context)
    if (latestCase.status !== "ok") return latestCase
    if (latestCase.value.case.version !== output.caseRef.version || !await accessible(input.evidence, refs, context) || !await input.revalidatePortfolio(output.payload, context).catch(() => false) || !await input.revalidate(context)) return { status: "stale", reason: "portfolio-source-or-authority-changed" }
    return { status: "ok", value: { portfolioResultRef: output.id, portfolio: structuredClone(output.payload), caseRef: output.caseRef } }
  }
}

async function accessible(service: BusinessContextService, refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) {
  const resolutions = await service.context({ refs }, context).catch(() => undefined)
  return !!resolutions && resolutions.length === refs.length && refs.every((ref) => resolutions.some((item) => item.state === "fresh" && digestSfValue(item.ref) === digestSfValue(ref)))
}

function validDigest(output: ContributionEnvelope) {
  try {
    return digestSfContribution(output) === output.outputDigest
  } catch {
    return false
  }
}
