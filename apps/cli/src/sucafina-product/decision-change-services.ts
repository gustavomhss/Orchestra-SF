import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { ChoiceRecord } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { ChangePrepareRequest } from "../../../../modules/sucafina/Sucafinav1/product/contracts/operations.ts"
import type { UnresolvedCondition } from "../../../../modules/sucafina/Sucafinav1/product/contracts/outputs.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { sfRunSourceFence } from "../../../../modules/sucafina/Sucafinav1/product/ai/run-store.ts"
import { encodeCaseRef, parseCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import { createChangeProposalService } from "../../../../modules/sucafina/Sucafinav1/product/decisions/proposals.ts"
import { createChangeProposalStore } from "../../../../modules/sucafina/Sucafinav1/product/decisions/change-proposal-store.ts"
import { createChangeProposalVerifier } from "../../../../modules/sucafina/Sucafinav1/product/decisions/change-proposal-verifier.ts"
import { createDecisionChoiceResultLookup } from "../../../../modules/sucafina/Sucafinav1/product/decisions/choice-result-lookup.ts"
import { createDecisionProducerFences } from "../../../../modules/sucafina/Sucafinav1/product/decisions/producer-fences.ts"
import { createProcurementScenarioPreparation } from "../../../../modules/sucafina/Sucafinav1/product/procurement/scenario-preparation.ts"
import { createProcurementPreparedReview } from "../../../../modules/sucafina/Sucafinav1/product/procurement/prepared-review.ts"
import { prepareProcurementMutation, procurementPreparedScope } from "../../../../modules/sucafina/Sucafinav1/product/procurement/prepared.ts"
import type { createSfBusinessServices } from "./business-services.ts"

type CaseRef = { id: string; incarnation: string; version: number }

/** Private C12 proposal composition. Preparation and replay do not execute the mutation. */
export function createSfDecisionChangeServices(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  business: ReturnType<typeof createSfBusinessServices>
  selectedCase: (call: TrustedDomainContext) => Promise<PortResult<CaseRef>>
  verifiedInputFor?: (call: TrustedDomainContext) => Promise<PortResult<unknown>>
  proposalCoverageWrites: WeakSet<object>
}) {
  const host = input.authority.host
  const business = input.business
  const fences = createDecisionProducerFences({ host, operationIdentity: business.operationIdentity, readSourceFences: business.readSourceFences, lockedSourceFences: business.lockedSourceFences })
  const prepare = createProcurementScenarioPreparation({ host, sources: business.individual })
  const proofs = new WeakMap<TrustedDomainContext, Map<string, { binding: string; roleMap: string; scopes: readonly string[]; expires: number }>>()
  const selectedChoice = async (request: ChangePrepareRequest, call: TrustedDomainContext) => {
    const ref = parseCaseRef(request.caseRef)
    const selected = await input.selectedCase(call)
    if (!ref || selected.status !== "ok" || ref.id !== selected.value.id || ref.incarnation !== selected.value.incarnation || !await host.revalidate(call)) return undefined
    const current = await business.cases.read({ caseRef: encodeCaseRef(selected.value) }, call)
    if (current.status !== "ok" || current.value.case.version !== selected.value.version) return undefined
    const choices = current.value.case.choices.filter((value) => value.id === request.choiceRef)
    if (choices.length !== 1 || !request.operations.length || request.operations.length > 100 || new Set(request.operations.map((value) => value.targetRef)).size !== request.operations.length ||
      request.operations.some((operation) => !choices[0]!.scenario.operations.some((value) => same(value, operation)))) return undefined
    return { caseRef: selected.value, current: current.value, choice: choices[0]! }
  }
  const authorizeProposal: Parameters<typeof createChangeProposalService>[0]["authorizeProposal"] = async (request, output, call) => {
    const selected = await selectedChoice(request, call)
    if (!selected || output.caseRef !== request.caseRef || output.caseVersion !== selected.caseRef.version || output.changes.length !== request.operations.length ||
      !same(output.conditions, choiceConditions(selected.choice))) return false
    const checked = await Promise.all(request.operations.map((operation) => business.individual.resolveForPreparation(operation.targetRef, call)))
    if (checked.some((value, index) => value.status !== "ok" || !same(value.value.evidence, output.changes[index]!.targetRef) ||
      value.value.evidence.target.recordType !== "procurement-request" || value.value.context.currency !== request.operations[index]!.currency || !same(value.value.context.period, request.operations[index]!.period))) return false
    const again = await selectedChoice(request, call)
    return !!again && same(again.current.case, selected.current.case) && await host.revalidate(call)
  }
  const verifier = createChangeProposalVerifier({ cases: business.cases, results: business.results, evidence: business.context, host, fences,
    reviewDomain: createProcurementPreparedReview({ port: business.procurement, individual: business.individual }),
    verifyPreparedIntent: async (proposal, call) => {
      const source = host.requestFor(call)
      const binding = digestSfValue([call.kind, call.binding])
      const selected = await selectedChoice(proposal.request, call)
      if (!source || source.signal.aborted || !selected || !same(proposal.caseRef, selected.caseRef) || proposal.changes.length !== proposal.request.operations.length ||
        proposal.output.changes.length !== proposal.changes.length || !same(proposal.output.conditions, choiceConditions(selected.choice))) return false
      const sources = await Promise.all(proposal.request.operations.map((operation) => business.individual.resolveForPreparation(operation.targetRef, call)))
      if (sources.some((value, index) => {
        const change = proposal.changes[index]!
        const operation = proposal.request.operations[index]!
        const values = object(change.command.command.values)
        const pr = object(values.pr)
        return value.status !== "ok" || !same(value.value.evidence, change.targetEvidence) || change.targetEvidence.refId !== operation.targetRef ||
          operation.kind !== "replace" || operation.replacementRef !== undefined || typeof operation.amount !== "number" || !Number.isFinite(operation.amount) || operation.amount < 0 ||
          operation.currency !== value.value.context.currency || !same(operation.period, value.value.context.period) || !same(change.preview, selected.choice.result) ||
          change.command.command.page !== "Requests" || change.command.command.action !== "save" || change.command.command.id !== change.command.target.id ||
          !same(Object.keys(values), ["pr"]) || !same(Object.keys(pr), ["estAmount"]) || pr.estAmount !== operation.amount
      })) return false
      const environment = await host.environment(source)
      if (!Number.isFinite(Date.parse(environment.at))) return false
      const replay = await host.persistence.transaction("procurement", async (snapshot) => {
        const principal = await host.authenticate(source, { surface: "procurement", roleMap: roleMap(snapshot, "procurement") })
        if (!principal || principal.id !== call.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: undefined }
        const roles = principal.roles.filter((value) => value.surface === "procurement").map((value) => value.role)
        const actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((value) => value !== "viewer"), assigned: [], domains: [] }
        const scopes = proposal.changes.map((change, index) => {
          const observed = sources[index]
          const scope = procurementPreparedScope(snapshot, change.command.target, call)
          if (!scope || observed?.status !== "ok" || !same(scope, observed.value.scope) || !business.individual.isCurrent(snapshot, change.targetEvidence)) return undefined
          const rebuilt = prepareProcurementMutation({ snapshot, actor, environment, context: call, target: change.command.target, scope, evidence: change.targetEvidence,
            command: change.command.command, operationId: change.command.id, idempotencyKey: change.command.idempotencyKey })
          return rebuilt && same(rebuilt.command, change.command) && same(rebuilt.targetEvidence, change.targetEvidence) ? digestSfValue(scope) : undefined
        })
        return { commit: false, value: scopes.every((scope): scope is string => scope !== undefined) ? { roleMap: digestSfValue(roleMap(snapshot, "procurement")), scopes } : undefined }
      }, { signal: source.signal })
      const again = await selectedChoice(proposal.request, call)
      const sourcesAgain = await Promise.all(proposal.request.operations.map((operation) => business.individual.resolveForPreparation(operation.targetRef, call)))
      if (!replay || !again || !same(again.current.case, selected.current.case) || !same(sourcesAgain, sources) || binding !== digestSfValue([call.kind, call.binding]) || source.signal.aborted || !await host.revalidate(call)) return false
      const now = Date.now()
      const bucket = proofs.get(call) ?? new Map<string, { binding: string; roleMap: string; scopes: readonly string[]; expires: number }>()
      for (const [key, value] of bucket) if (value.expires <= now) bucket.delete(key)
      if (bucket.size >= 128 && !bucket.has(proposal.recordDigest)) return false
      bucket.set(proposal.recordDigest, { binding, ...replay, expires: now + 30_000 })
      proofs.set(call, bucket)
      return true
    },
    verifySourcesLocked: (snapshot, proposal, call) => {
      const proof = proofs.get(call)?.get(proposal.recordDigest)
      const snapshots = host.persistence.currentSnapshots?.()
      const locked = business.lockedSourceFences()
      if (!proof || !snapshots || !locked || proof.expires <= Date.now() || proof.binding !== digestSfValue([call.kind, call.binding]) ||
        sfRunSourceFence(snapshot) !== locked.planner || proof.roleMap !== digestSfValue(roleMap(snapshots.procurement, "procurement"))) return false
      return proposal.changes.length === proof.scopes.length && proposal.changes.every((change, index) => {
        const scope = procurementPreparedScope(snapshots.procurement, change.command.target, call)
        return !!scope && digestSfValue(scope) === proof.scopes[index] && change.targetEvidence.target.surface === "procurement" && business.individual.isCurrent(snapshots.procurement, change.targetEvidence)
      })
    } })
  const store = createChangeProposalStore({ state: input.authority.state, host, authorizeCase: business.authorizeCase, authorizeProposal,
    verifySources: verifier.verifySources, verifySnapshot: verifier.verifySnapshot, operationIdentity: business.operationIdentity,
    proposalCoverageWrites: input.proposalCoverageWrites, now: () => new Date().toISOString() })
  const service = createChangeProposalService({ cases: business.cases, host, store, authorizeProposal,
    resolvePreview: createDecisionChoiceResultLookup({ cases: business.cases, state: input.authority.state, results: business.results, host }),
    resolveChanges: async (request, call) => {
      const selected = await selectedChoice(request, call)
      const identity = business.operationIdentity(call)
      if (!selected || !identity) return { status: "denied", reason: "distinct-choice-operations-required" }
      const resolved = await Promise.all(request.operations.map((operation, index) => prepare({ operation, choice: selected.choice,
        operationId: `${identity}:${index}`, idempotencyKey: `${identity}:${index}` }, call)))
      const failed = resolved.find((result) => result.status !== "ok")
      if (failed) return failed
      const again = await selectedChoice(request, call)
      if (!again || !same(again.current.case, selected.current.case) || !await host.revalidate(call)) return { status: "stale", reason: "preparation-case-changed" }
      return { status: "ok", value: { changes: resolved.flatMap((value) => value.status === "ok" ? [value.value] : []), conditions: choiceConditions(selected.choice) } }
    } })
  const change: ReturnType<typeof createChangeProposalService> = async (request, call) => {
    const selected = await selectedChoice(request, call)
    if (!selected) return { status: "denied", reason: "change-selected-choice-unavailable" }
    if (call.kind === "ui") {
      if (!await input.authority.human.authorize(call, "decisions.prepare-changes", request)) return { status: "denied", reason: "change-human-authority-unavailable" }
      return service(request, call)
    }
    if (!input.verifiedInputFor) return { status: "unavailable", reason: "purchase-run-input-unavailable" }
    const admitted = await input.verifiedInputFor(call)
    if (admitted.status !== "ok") return admitted
    const parsed = decodeSfSkillInput("PurchasePreparationInput", admitted.value)
    if (!parsed.ok || !same(parsed.value.choice, selected.choice)) return { status: "denied", reason: "purchase-choice-outside-human-selection" }
    const targets = await Promise.all(request.operations.map((operation) => business.individual.resolveForPreparation(operation.targetRef, call)))
    if (targets.some((value) => value.status !== "ok" || !parsed.value.allowedChangeTargets.some((target) => target.surface === value.value.evidence.target.surface && target.type === value.value.evidence.target.recordType &&
      target.id === value.value.evidence.target.recordId && target.incarnation === value.value.evidence.target.incarnation && target.version === value.value.evidence.target.version &&
      same(target.fields, value.value.evidence.target.fields) && same(target.period, value.value.context.period)))) return { status: "denied", reason: "purchase-target-outside-human-selection" }
    const result = await service(request, call)
    const again = await input.verifiedInputFor(call)
    return again.status === "ok" && same(again.value, admitted.value) && await host.revalidate(call) ? result : { status: "stale", reason: "purchase-run-selection-changed" }
  }
  return { change, changeProposals: { read: store.read, readSet: store.readSet, readCommand: store.readCommand } }
}

function choiceConditions(choice: ChoiceRecord): readonly UnresolvedCondition[] {
  const values = [
    ...choice.result.unresolvedConditions.map((reason) => ({ category: "scenario", reason })),
    ...choice.comparison.unresolvedConditions.map((reason) => ({ category: "comparison", reason })),
    ...choice.result.restrictions.map((reason) => ({ category: "restriction", reason })),
    ...choice.result.costCoverage.issues.map((reason) => ({ category: "cost-coverage", reason })),
    ...choice.result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [{ category: entry.categoryId, reason: entry.reason, ...(entry.questionRef ? { questionRef: entry.questionRef } : {}) }] : []),
  ]
  return values.filter((value, index) => values.findIndex((other) => same(value, other)) === index).map((value) => ({ ...value,
    id: `chosen-condition:${digestSfValue({ choiceId: choice.id, ...value })}`, evidenceRefs: choice.result.sourceRefs }))
}
function same(left: unknown, right: unknown) { return digestSfValue(left) === digestSfValue(right) }
