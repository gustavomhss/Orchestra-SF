import type { createSfContributionReader, createSfHistoricalContributionReader } from "../ai/contribution-reader.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { encodeCaseRef } from "../decisions/case-port.ts"

/** Resolve the actual C11 output; a draft never becomes a human confirmation here. */
export function createCampaignProposalReader(input: {
  readContribution: ReturnType<typeof createSfContributionReader>
  caseFor: (context: TrustedDomainContext) => Promise<PortResult<{ id: string; incarnation: string; version: number }>>
}) {
  return async (outputRef: string, context: TrustedDomainContext): Promise<PortResult<{ outputDigest: string }>> => {
    const caseRef = await input.caseFor(context)
    if (caseRef.status !== "ok") return caseRef
    const found = await input.readContribution({ outputRef, caseRef: caseRef.value }, context)
    if (found.status !== "ok") return found
    const output = found.value.output
    if (output.kind !== "AlternativeDraft" || output.state !== "ready" || output.payload.domainApplied !== false || output.payload.caseRef !== encodeCaseRef(caseRef.value) || output.runProvenance.profileId !== "sf_portfolio" || output.runProvenance.skillId !== "sf-compor-portfolio") return { status: "denied", reason: "campaign-proposal-unavailable" }
    return { status: "ok", value: { outputDigest: output.outputDigest } }
  }
}

/** Read an earlier proposal only as history after the C11 reader reauthorizes its sources. */
export function createCampaignHistoricalProposalReader(input: {
  readContribution: ReturnType<typeof createSfHistoricalContributionReader>
  caseFor: (context: TrustedDomainContext) => Promise<PortResult<{ id: string; incarnation: string; version: number }>>
}) {
  return async (outputRef: string, context: TrustedDomainContext): Promise<PortResult<{ outputDigest: string }>> => {
    const caseRef = await input.caseFor(context)
    if (caseRef.status !== "ok") return caseRef
    const found = await input.readContribution({ outputRef, currentCase: caseRef.value }, context)
    if (found.status !== "ok") return found
    const output = found.value.output
    if (found.value.state !== "historical" || output.kind !== "AlternativeDraft" || output.state !== "ready" || output.payload.domainApplied !== false || output.payload.caseRef !== encodeCaseRef(caseRef.value) || output.runProvenance.profileId !== "sf_portfolio" || output.runProvenance.skillId !== "sf-compor-portfolio") return { status: "denied", reason: "campaign-proposal-unavailable" }
    return { status: "ok", value: { outputDigest: output.outputDigest } }
  }
}
