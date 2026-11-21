import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { createChangeProposalStore } from "../../../../modules/sucafina/Sucafinav1/product/decisions/change-proposal-store.ts"
import type { StoredChangeProposal } from "../../../../modules/sucafina/Sucafinav1/product/decisions/change-proposal-store.ts"
import { createChangeProposalVerifier } from "../../../../modules/sucafina/Sucafinav1/product/decisions/change-proposal-verifier.ts"
import { createDecisionProducerFences } from "../../../../modules/sucafina/Sucafinav1/product/decisions/producer-fences.ts"
import { createDecisionChoiceResultLookup } from "../../../../modules/sucafina/Sucafinav1/product/decisions/choice-result-lookup.ts"
import { createChangeProposalService } from "../../../../modules/sucafina/Sucafinav1/product/decisions/proposals.ts"
import { createProcurementScenarioPreparation } from "../../../../modules/sucafina/Sucafinav1/product/procurement/scenario-preparation.ts"
import { createProcurementPreparedReview } from "../../../../modules/sucafina/Sucafinav1/product/procurement/prepared-review.ts"
import { prepareProcurementMutation, procurementPreparedScope } from "../../../../modules/sucafina/Sucafinav1/product/procurement/prepared.ts"
import type { createSfBusinessServices } from "./business-services.ts"

/** A proposed Procurement edit is rebuilt by its domain producer; this service never applies it. */
export function createSfChangeProposalServices(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  business: ReturnType<typeof createSfBusinessServices>
  proposalCoverageWrites: WeakSet<object>
}) {
  const { authority, business } = input
  const { host, state } = authority
  const fences = createDecisionProducerFences({ host, operationIdentity: business.operationIdentity,
    readSourceFences: business.readSourceFences, lockedSourceFences: business.lockedSourceFences })
  const prepare = createProcurementScenarioPreparation({ host, sources: business.individual })
  const reviewDomain = createProcurementPreparedReview({ port: business.procurement, individual: business.individual })
  const verified = new WeakMap<TrustedDomainContext, Map<string, { proposal: string; decision: string }>>()
  const currentCase = async (caseRef: StoredChangeProposal["caseRef"], call: TrustedDomainContext) => {
    const request = host.requestFor(call)
    if (!request || !await host.revalidate(call) || call.kind === "native" && (call.binding.caseId !== caseRef.id ||
      call.binding.caseIncarnation !== caseRef.incarnation || call.binding.caseVersion !== caseRef.version)) return undefined
    const current = await state.read(request, "cases", (value, actor) => {
      const decision = value.cases[caseRef.id]
      return actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision &&
        actor.policyVersion === call.binding.policyVersion && decision?.incarnation === caseRef.incarnation && decision.version === caseRef.version &&
        decision.participants.includes(actor.principalRef) ? decision : undefined
    })
    return current.status === "ok" && current.value && await host.revalidate(call) ? current.value : undefined
  }
  const verifyPreparedIntent = async (proposal: StoredChangeProposal, call: TrustedDomainContext) => {
    const request = host.requestFor(call)
    const current = await currentCase(proposal.caseRef, call)
    const choices = current?.choices.filter((choice) => choice.id === proposal.request.choiceRef)
    if (!request || !current || choices?.length !== 1 || !proposal.changes.length || proposal.changes.length !== proposal.request.operations.length ||
      new Set(proposal.request.operations.map((operation) => operation.targetRef)).size !== proposal.request.operations.length) return false
    const choice = choices[0]!
    const environment = await host.environment(request)
    for (const [index, item] of proposal.changes.entries()) {
      const operation = proposal.request.operations[index]!
      if (!choice.scenario.operations.some((value) => digestSfValue(value) === digestSfValue(operation)) || operation.kind !== "replace" || operation.replacementRef !== undefined ||
        operation.targetRef !== item.targetEvidence.refId || operation.amount !== object(item.command.command.values.pr).estAmount ||
        digestSfValue(item.command.command.values) !== digestSfValue({ pr: { estAmount: operation.amount } }) ||
        operation.currency !== choice.result.currency || digestSfValue(operation.period) !== digestSfValue(choice.result.horizon) ||
        digestSfValue(item.preview) !== digestSfValue(choice.result)) return false
      const output = proposal.output.changes[index]
      const identity = digestSfValue({ proposalRef: proposal.proposalRef, index, command: item.command.commandDigest })
      if (!output || output.changeRef !== `proposed-change:${identity}` || output.operationRef !== `proposed-operation:${identity}` ||
        output.previewRef !== item.previewRef || output.expectedVersion !== item.command.expectedVersion ||
        digestSfValue(output.targetRef) !== digestSfValue(item.targetEvidence) || digestSfValue(output.requiredAuthority) !== digestSfValue(item.command.requiredAuthority)) return false
      const rebuilt = await host.persistence.transaction("procurement", async (snapshot) => {
        const principal = await host.authenticate(request, { surface: "procurement", roleMap: roleMap(snapshot, "procurement") })
        const scope = procurementPreparedScope(snapshot, item.command.target, call)
        if (!principal || principal.id !== call.binding.principalRef || principal.id.startsWith("local:") || !scope) return { commit: false, value: false }
        const roles = principal.roles.filter((entry) => entry.surface === "procurement").map((entry) => entry.role)
        const actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: [], domains: [] }
        const value = prepareProcurementMutation({ snapshot, actor, environment, context: call, target: item.command.target, scope,
          evidence: item.targetEvidence, command: item.command.command, operationId: item.command.id, idempotencyKey: item.command.idempotencyKey })
        return { commit: false, value: !!value && digestSfValue(value.command) === digestSfValue(item.command) && digestSfValue(value.targetEvidence) === digestSfValue(item.targetEvidence) }
      }, { signal: request.signal })
      if (!rebuilt || !await host.revalidate(call)) return false
    }
    const again = await currentCase(proposal.caseRef, call)
    if (!again || digestSfValue(again) !== digestSfValue(current)) return false
    const records = verified.get(call) ?? new Map<string, { proposal: string; decision: string }>()
    records.set(proposal.proposalRef, { proposal: digestSfValue(proposal), decision: digestSfValue(current) })
    verified.set(call, records)
    return true
  }
  const proof = createChangeProposalVerifier({ cases: business.cases, results: business.results, evidence: business.context, host, fences, reviewDomain, verifyPreparedIntent,
    verifySourcesLocked: (_snapshot, proposal, call) => {
      const captured = verified.get(call)?.get(proposal.proposalRef)
      const snapshots = host.persistence.currentSnapshots?.()
      const decision = object(object(snapshots?.dashboard.data.__sfProductV1).cases)[proposal.caseRef.id]
      return !!captured && !!snapshots && captured.proposal === digestSfValue(proposal) && captured.decision === digestSfValue(decision)
    } })
  const authorizeProposal: Parameters<typeof createChangeProposalStore>[0]["authorizeProposal"] = async (request, output, call) => {
    const current = await business.cases.read({ caseRef: request.caseRef }, call)
    if (current.status !== "ok" || output.caseRef !== request.caseRef || output.caseVersion !== current.value.case.version ||
      current.value.case.choices.filter((choice) => choice.id === request.choiceRef).length !== 1 || !output.changes.length || output.changes.length !== request.operations.length) return false
    const refs = output.changes.map((change) => change.targetRef)
    const resolved = await business.context.context({ refs }, call)
    return resolved.length === refs.length && resolved.every((item, index) => item.state === "fresh" && !!item.authorizedProjection && !!item.currentRef &&
      item.accessRevision === call.binding.accessRevision && digestSfValue(item.ref) === digestSfValue(refs[index]) && digestSfValue(item.currentRef) === digestSfValue(item.ref)) && await host.revalidate(call)
  }
  const store = createChangeProposalStore({ state, host, proposalCoverageWrites: input.proposalCoverageWrites, operationIdentity: business.operationIdentity,
    now: () => new Date().toISOString(), authorizeCase: async (value, call) => value.participants.includes(call.binding.principalRef) && await host.revalidate(call),
    authorizeProposal, ...proof })
  const resolveChanges: Parameters<typeof createChangeProposalService>[0]["resolveChanges"] = async (request, call) => {
    const operationIdentity = business.operationIdentity(call)
    if (!operationIdentity || !await fences.capture(call, "change-proposal", digestSfValue(request))) return { status: "denied", reason: "change-proposal-authority-unavailable" }
    const current = await business.cases.read({ caseRef: request.caseRef }, call)
    if (current.status !== "ok") return current
    const choices = current.value.case.choices.filter((choice) => choice.id === request.choiceRef)
    if (choices.length !== 1 || !request.operations.length || new Set(request.operations.map((operation) => operation.targetRef)).size !== request.operations.length)
      return { status: "needs-input", reason: "distinct-choice-operations-required" }
    const choice = choices[0]!
    if (choice.result.comparisonStatus !== "complete") return { status: "needs-input", reason: "choice-preview-incomplete" }
    const changes: Awaited<ReturnType<typeof prepare>>[] = []
    for (const [index, operation] of request.operations.entries()) changes.push(await prepare({ operation, choice,
      operationId: `change-proposal:${digestSfValue({ operationIdentity, index })}`, idempotencyKey: `change-proposal:${digestSfValue({ operationIdentity, index })}` }, call))
    const failure = changes.find((value) => value.status !== "ok")
    if (failure) return failure
    return { status: "ok", value: { changes: changes.flatMap((value) => value.status === "ok" ? [value.value] : []), conditions: [] } }
  }
  const resolvePreview = createDecisionChoiceResultLookup({ cases: business.cases, state, results: business.results, host })
  const prepareProposal = createChangeProposalService({ cases: business.cases, host, store, resolveChanges, resolvePreview, authorizeProposal })
  return { store, prepare: prepareProposal, proof, unavailable: ["change-proposal-dashboard-command-producer-unavailable"] }
}
