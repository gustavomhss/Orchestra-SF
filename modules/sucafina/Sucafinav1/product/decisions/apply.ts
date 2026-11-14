import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DecisionCase, PreparedChange } from "../contracts/decisions.ts"
import type { CommandReceipt } from "../contracts/context.ts"
import type { DomainPortHost, PortResult, PreparedApplyPort } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort, SfStateResult } from "../contracts/state.ts"
import { caseApplicationState, reconcileDomainReceipt } from "./receipts.ts"
import { isReviewDigest, receiptProofTransactionKey, receiptReviewBinding, type ReviewDigestFor } from "./receipt-review-binding.ts"

/** Explicit human application; each domain commits its own receipt before the case is reconciled. */
export function createPreparedExecution(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  apply: PreparedApplyPort
  authorizeCase: (value: DecisionCase, context: TrustedDomainContext) => Promise<boolean>
  authorizeApplication: (request: { caseRef: { id: string; incarnation: string; version: number }; changeId: string; choiceId: string }, change: PreparedChange, context: TrustedDomainContext) => Promise<boolean>
  confirmApplication: (request: { caseRef: { id: string; incarnation: string; version: number }; changeId: string; choiceId: string }, context: TrustedDomainContext) => Promise<boolean>
  operationIdentity: (context: TrustedDomainContext) => string | undefined
  classifyReceipt: (receipt: CommandReceipt, change: PreparedChange, context: TrustedDomainContext) => Promise<{ state: "applied" | "awaiting-approval" | "conflict" | "failed" | "cancelled"; evidence: Extract<BusinessEvidenceRef, { kind: "receipt" }> } | undefined>
  reviewDigestFor: ReviewDigestFor
  revalidateProducer: (request: { caseRef: { id: string; incarnation: string; version: number }; changeId: string; choiceId: string }, context: TrustedDomainContext) => Promise<PortResult<{ reviewDigest: string }>>
}) {
  return async (incoming: { caseRef: { id: string; incarnation: string; version: number }; changeId: string; choiceId: string }, context: TrustedDomainContext): Promise<PortResult<CommandReceipt>> => {
    const request = structuredClone(incoming)
    const source = input.host.requestFor(context)
    const operation = input.operationIdentity(context)
    if (context.kind !== "ui" || !source || !operation || !await input.host.revalidate(context)) return { status: "denied", reason: "human-authority-required" }
    const current = await input.state.read(source, "cases", (state, authority) => authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision ? state.cases[request.caseRef.id] : undefined)
    if (current.status !== "ok") return failure(current)
    const value = current.value
    if (!value || value.incarnation !== request.caseRef.incarnation || !value.participants.includes(context.binding.principalRef) || !await input.authorizeCase(value, context)) return { status: "denied", reason: "case-access-unavailable" }
    const change = value.preparedChanges.find((item) => item.id === request.changeId && item.choiceId === request.choiceId)
    if (!change || !value.choices.some((choice) => choice.id === request.choiceId)) return { status: "unavailable", reason: "prepared-change-unavailable" }
    if (value.version !== request.caseRef.version && !change.receipt) return { status: "stale", reason: "case-changed" }
    if (change.state !== "planned" && !change.receipt) return { status: "conflict", reason: "change-not-applicable" }
    if (!await input.authorizeApplication(request, change, context).catch(() => false)) return { status: "denied", reason: "application-authority-unavailable" }
    const lookup = await callDomain(() => input.apply.readReceipt({ surface: change.target.surface, targetRef: change.target.id, targetIncarnation: change.target.incarnation, idempotencyKey: change.idempotencyKey, commandDigest: change.operation.commandDigest }, context))
    if (lookup.status !== "ok") return lookup
    const reviewDigest = input.reviewDigestFor(context, request, change)
    if (!isReviewDigest(reviewDigest)) return { status: "needs-input", reason: "review-proof-required" }
    if (lookup.value.state === "found") {
      const bound = await input.state.read(source, "receipts", (state, authority) => authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision ? state.transactions[receiptProofTransactionKey(authority.principalRef, change.target.id, change.idempotencyKey)] : undefined).catch(() => undefined)
      if (!bound || bound.status !== "ok" || !bound.value) return { status: "unavailable", reason: "review-proof-unbound" }
      if (bound.value.commandDigest !== receiptReviewBinding(change, reviewDigest) || digestSfValue(bound.value.value) !== digestSfValue(lookup.value.receipt)) return { status: "conflict", reason: "review-proof-mismatch" }
      if (change.receipt) {
        if (digestSfValue(change.receipt) !== digestSfValue(lookup.value.receipt)) return { status: "unavailable", reason: "receipt-identity-collision" }
        if (!await input.host.revalidate(context) || !await input.authorizeCase(value, context).catch(() => false) || !await input.authorizeApplication(request, change, context).catch(() => false)) return { status: "denied", reason: "case-access-unavailable" }
        return { status: "ok", value: lookup.value.receipt }
      }
    }
    if (!await input.host.revalidate(context) || !await input.authorizeCase(value, context)) return { status: "denied", reason: "case-access-unavailable" }
    if (lookup.value.state === "not-found" && change.receipt) return { status: "unavailable", reason: "authoritative-receipt-unavailable" }
    if (lookup.value.state === "not-found") {
      const proof = await input.revalidateProducer(request, context).catch(() => undefined)
      if (!proof || proof.status !== "ok" || proof.value.reviewDigest !== reviewDigest) return proof && proof.status !== "ok" ? proof : { status: proof ? "stale" : "unavailable", reason: proof ? "review-proof-mismatch" : "review-producer-unavailable" }
      if (!await input.confirmApplication(request, context).catch(() => false)) return { status: "denied", reason: "application-confirmation-required" }
      const latest = await input.state.read(source, "cases", (state, authority) => authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision ? state.cases[request.caseRef.id] : undefined).catch(() => undefined)
      if (!latest || latest.status !== "ok") return { status: "unavailable", reason: "case-unavailable" }
      const fresh = latest.value
      const currentChange = fresh?.preparedChanges.find((item) => item.id === change.id && item.choiceId === request.choiceId)
      if (!fresh || fresh.incarnation !== value.incarnation || fresh.version !== value.version || !fresh.participants.includes(context.binding.principalRef) || !currentChange || currentChange.state !== "planned" || digestSfValue(currentChange) !== digestSfValue(change)) return { status: "stale", reason: "case-changed" }
      if (!await input.authorizeCase(fresh, context).catch(() => false) || !await input.authorizeApplication(request, currentChange, context).catch(() => false) || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "application-authority-unavailable" }
    }
    const observed = lookup.value.state === "found" ? { status: "ok" as const, value: lookup.value.receipt } : await callDomain(() => input.apply.executePrepared(request, context))
    if (observed.status !== "ok") return observed
    const result = await input.classifyReceipt(observed.value, change, context).catch(() => undefined)
    if (!result || !await input.host.revalidate(context)) return { status: "unavailable", reason: "receipt-classification-unavailable" }
    if (result.evidence.installationId !== context.binding.installationId || result.evidence.projectId !== context.binding.projectId || result.evidence.target.surface !== observed.value.surface || result.evidence.target.receiptId !== observed.value.id || result.evidence.target.idempotencyKey !== observed.value.idempotencyKey || result.evidence.target.targetIncarnation !== observed.value.targetIncarnation || result.evidence.target.commandDigest !== observed.value.commandDigest || result.evidence.target.version !== observed.value.version) return { status: "unavailable", reason: "receipt-evidence-mismatch" }
    const priorReceipt = value.receipts.find((receipt) => receipt.id === observed.value.id)
    if (value.preparedChanges.some((item) => item.id !== change.id && item.receipt?.id === observed.value.id)) return { status: "unavailable", reason: "receipt-identity-collision" }
    if (priorReceipt && digestSfValue(priorReceipt) !== digestSfValue(observed.value)) return { status: "unavailable", reason: "receipt-identity-collision" }
    const reconciled = reconcileDomainReceipt({ change, receipt: observed.value, principalRef: context.binding.principalRef, state: result.state })
    if (reconciled.status !== "ok") return reconciled
    if (change.receipt) {
      if (!await input.authorizeCase(value, context).catch(() => false) || !await input.authorizeApplication(request, change, context).catch(() => false) || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "case-access-unavailable" }
      return { status: "ok", value: observed.value }
    }
    const saved = await input.state.transaction(source, { namespace: "cases", expectedStorageVersion: current.storageVersion, targetRef: value.id, targetIncarnation: value.incarnation, idempotencyKey: `${operation}:${change.id}:${observed.value.id}`, commandDigest: digestSfValue({ caseRef: request.caseRef, changeId: change.id, receipt: observed.value, state: result.state, evidence: result.evidence }) }, async (state, authority) => {
      const actual = state.cases[value.id]
      if (!actual || actual.incarnation !== value.incarnation || actual.version !== value.version || authority.principalRef !== context.binding.principalRef || authority.policyVersion !== context.binding.policyVersion || authority.accessRevision !== context.binding.accessRevision) return { commit: false, value: false }
      const changes = actual.preparedChanges.map((item) => item.id === change.id ? reconciled.change : item)
      state.cases[value.id] = { ...actual, version: actual.version + 1, preparedChanges: changes, receipts: actual.receipts.some((receipt) => receipt.id === observed.value.id) ? actual.receipts : [...actual.receipts, observed.value], sourceRefs: [...actual.sourceRefs, result.evidence].filter((ref, index, refs) => refs.findIndex((other) => other.refDigest === ref.refDigest) === index), state: caseApplicationState(changes) }
      return { commit: true, value: true }
    }).catch(() => undefined)
    if (!saved || saved.status !== "ok") return { status: "unavailable", reason: "case-reconciliation-pending" }
    if (!saved.value) return { status: "unavailable", reason: "case-reconciliation-pending" }
    const currentReceipt = await input.classifyReceipt(observed.value, reconciled.change, context).catch(() => undefined)
    if (!currentReceipt || digestSfValue(currentReceipt) !== digestSfValue(result) || !await input.authorizeApplication(request, reconciled.change, context).catch(() => false) || !await input.host.revalidate(context).catch(() => false)) return { status: "unavailable", reason: "receipt-authority-changed" }
    return { status: "ok", value: observed.value }
  }
}

async function callDomain<T>(work: () => Promise<PortResult<T>>): Promise<PortResult<T>> {
  try {
    return await work()
  } catch {
    return { status: "unavailable", reason: "domain-result-unknown" }
  }
}

function failure(value: SfStateResult<unknown>): PortResult<never> {
  if ("reason" in value) return { status: value.status, reason: value.reason }
  return { status: "unavailable", reason: "case-reconciliation-pending" }
}
