import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessContextService } from "../contracts/business-context.ts"
import type { DecisionCasePort, DomainPortHost } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createDecisionPreparedReview } from "./prepared-review.ts"
import type { Snapshot } from "../../runtime/contract.ts"
import type { createDecisionProducerFences } from "./producer-fences.ts"
import type { createSfDecisionResultStore } from "./result-store.ts"
import type { StoredChangeProposal } from "./change-proposal-store.ts"
import { encodeCaseRef } from "./case-port.ts"

/** Revalidate producer-issued commands and every C08 preview under the current actor. */
export function createChangeProposalVerifier(input: {
  cases: DecisionCasePort
  results: ReturnType<typeof createSfDecisionResultStore>
  evidence: Pick<BusinessContextService, "context">
  host: Pick<DomainPortHost, "revalidate">
  fences: ReturnType<typeof createDecisionProducerFences>
  reviewDomain: Parameters<typeof createDecisionPreparedReview>[0]["reviewDomain"]
  verifyPreparedIntent: (proposal: StoredChangeProposal, context: TrustedDomainContext) => Promise<boolean>
  verifySourcesLocked: (snapshot: Snapshot, proposal: StoredChangeProposal, context: TrustedDomainContext) => boolean
}) {
  const verifySources = async (proposal: StoredChangeProposal, context: TrustedDomainContext) => {
    try {
      if (!await input.fences.capture(context, "change-proposal", proposal.requestDigest) || !await input.host.revalidate(context)) return false
      const current = await input.cases.read({ caseRef: encodeCaseRef(proposal.caseRef) }, context)
      if (current.status !== "ok" || current.value.case.version !== proposal.caseRef.version) return false
      const choice = current.value.case.choices.filter((item) => item.id === proposal.request.choiceRef)
      if (choice.length !== 1 || proposal.changes.length !== proposal.output.changes.length) return false
      const previews = await Promise.all(proposal.changes.map((item) => input.results.readHistoricalScenario({ resultRef: item.previewRef }, context)))
      if (previews.some((item, index) => item.status !== "ok" || item.value.kind !== "scenario" || item.value.caseRef.id !== proposal.caseRef.id || item.value.caseRef.incarnation !== proposal.caseRef.incarnation || item.value.caseRef.version > proposal.caseRef.version || item.value.requestDigest !== digestSfValue(choice[0]!.scenario) || item.value.resultDigest !== digestSfValue(proposal.changes[index]!.preview) || item.value.resultDigest !== digestSfValue(choice[0]!.result))) return false
      const reviews = await Promise.all(proposal.changes.map((item) => input.reviewDomain(item.command, context)))
      if (reviews.some((review, index) => review.status !== "ok" || review.value.originalTargetDigest !== digestSfValue(proposal.changes[index]!.command.target) || review.value.source.installationId !== context.binding.installationId || review.value.source.projectId !== context.binding.projectId || review.value.source.target.surface !== proposal.changes[index]!.command.target.surface || review.value.source.target.recordType !== proposal.changes[index]!.command.target.type || review.value.source.target.recordId !== proposal.changes[index]!.command.target.id)) return false
      const refs = reviews.flatMap((review) => review.status === "ok" ? [review.value.source] : [])
      const resolved = await input.evidence.context({ refs }, context)
      if (resolved.length !== refs.length || resolved.some((item, index) => item.state !== "fresh" || item.accessRevision !== context.binding.accessRevision || digestSfValue(item.ref) !== digestSfValue(refs[index]) || !item.currentRef || digestSfValue(item.currentRef) !== digestSfValue(item.ref))) return false
      if (!await input.verifyPreparedIntent(proposal, context)) return false
      const again = await input.cases.read({ caseRef: encodeCaseRef(proposal.caseRef) }, context)
      return again.status === "ok" && digestSfValue(again.value.case) === digestSfValue(current.value.case) && await input.host.revalidate(context)
    } catch { return false }
  }
  return {
    verifySources,
    verifySnapshot: (snapshot: Snapshot, proposal: StoredChangeProposal, context: TrustedDomainContext) => input.fences.verify(context, "change-proposal", proposal.requestDigest) && input.verifySourcesLocked(snapshot, proposal, context),
  }
}
