import { digestSfValue } from "../contracts/canonical.ts"
import type { ContributionEnvelope } from "../contracts/resident-ai.ts"
import type { DecisionCase } from "../contracts/decisions.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfNativeRunRecord, SfProductState, SfProductStatePort } from "../contracts/state.ts"
import { alternativeProvenanceKey, verifyAlternativePublication, type AlternativeCapabilityProvenance } from "./alternative-provenance.ts"

function records(state: SfProductState, run: SfNativeRunRecord, output: ContributionEnvelope) {
  return Object.entries(state.preferences).flatMap(([key, value]) => {
    if (!key.startsWith("sf:proposal-coverage:alternative-provenance:") || !value || typeof value !== "object") return []
    const record = value as AlternativeCapabilityProvenance
    try { return key === alternativeProvenanceKey(record) && verifyAlternativePublication(record, run, output) ? [record] : [] } catch { return [] }
  })
}

/** Checks the exact private record under the caller's transaction lock. */
export function verifyAlternativeProvenanceBinding(state: SfProductState, run: SfNativeRunRecord, output: ContributionEnvelope, expectedDigest: string) {
  const matches = records(state, run, output)
  return matches.length === 1 && digestSfValue(matches[0]) === expectedDigest
}

/** Reopens the persisted C16 call and performs a read-only domain replay under current authority. */
export function createAlternativeProposalVerifier(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  authorizeCase: (decision: DecisionCase, context: TrustedDomainContext) => Promise<boolean>
  replay: (record: AlternativeCapabilityProvenance, context: TrustedDomainContext) => Promise<PortResult<{ output: AlternativeCapabilityProvenance["output"] }>>
}) {
  return async (output: ContributionEnvelope, run: SfNativeRunRecord, context: TrustedDomainContext): Promise<PortResult<{ recordDigest: string }>> => {
    try {
      const source = input.host.requestFor(context)
      if (!source || !await input.host.revalidate(context)) return { status: "denied", reason: "alternative-provenance-access-unavailable" }
      const read = async () => {
        const decision = await input.state.read(source, "cases", (state, authority) => authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision ? state.cases[run.caseRef.id] : undefined)
        const found = await input.state.read(source, "preferences", (state, authority) => authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision ? records(state, run, output) : undefined)
        if (decision.status !== "ok" || found.status !== "ok" || !found.value) return undefined
        return { decision: decision.value, records: found.value }
      }
      const first = await read()
      if (!first?.decision || first.decision.incarnation !== run.caseRef.incarnation || first.decision.version !== run.caseRef.version || !first.decision.participants.includes(context.binding.principalRef) || !await input.authorizeCase(first.decision, context) || first.records.length !== 1) return { status: "unavailable", reason: "alternative-provenance-unavailable" }
      const record = first.records[0]!
      if (record.installationId !== context.binding.installationId || record.projectId !== context.binding.projectId) return { status: "denied", reason: "alternative-provenance-access-unavailable" }
      const replay = await input.replay(record, context)
      if (replay.status !== "ok") return replay
      if (digestSfValue(replay.value.output) !== record.receipt.resultDigest) return { status: "stale", reason: "alternative-provenance-changed" }
      const again = await read()
      if (!again?.decision || digestSfValue(again.decision) !== digestSfValue(first.decision) || !await input.authorizeCase(again.decision, context) || again.records.length !== 1 || digestSfValue(again.records[0]) !== digestSfValue(record) || source.signal.aborted || !await input.host.revalidate(context)) return { status: "stale", reason: "alternative-provenance-changed" }
      return { status: "ok", value: { recordDigest: digestSfValue(record) } }
    } catch { return { status: "unavailable", reason: "alternative-provenance-unavailable" } }
  }
}
