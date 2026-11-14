import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DecisionCase, PreparedChange } from "../contracts/decisions.ts"
import type { CommandReceipt } from "../contracts/context.ts"
import type { DomainPortHost, PortResult, PreparedApplyPort } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductState, SfProductStatePort, SfStateResult } from "../contracts/state.ts"
import { caseApplicationState, reconcileDomainReceipt } from "./receipts.ts"
import { isReviewDigest, receiptProofTransactionKey, receiptReviewBinding, type ReviewDigestFor } from "./receipt-review-binding.ts"
import { applicationAttempt, applicationAttemptKey, applicationAttempts } from "./application-attempt.ts"

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
  return async (incoming: { caseRef: { id: string; incarnation: string; version: number }; changeId: string; choiceId: string }, context: TrustedDomainContext, mode: "apply" | "recover" = "apply"): Promise<PortResult<CommandReceipt>> => {
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
    if (value.version < request.caseRef.version) return { status: "stale", reason: "case-changed" }
    if (change.state !== "planned" && !change.receipt) return { status: "conflict", reason: "change-not-applicable" }
    if (!await input.authorizeApplication(request, change, context).catch(() => false)) return { status: "denied", reason: "application-authority-unavailable" }
    const lookup = structuredClone(await callDomain(() => input.apply.readReceipt({ surface: change.target.surface, targetRef: change.target.id, targetIncarnation: change.target.incarnation, idempotencyKey: change.idempotencyKey, commandDigest: change.operation.commandDigest }, context)))
    if (lookup.status !== "ok") return lookup
    // Historical admission can only reconcile an existing domain receipt.
    if (mode === "recover" && lookup.value.state !== "found") return { status: "unavailable", reason: "original-receipt-unavailable" }
    const reviewDigest = input.reviewDigestFor(context, request, change)
    if (!isReviewDigest(reviewDigest)) return { status: "needs-input", reason: "review-proof-required" }
    const retainReceipt = async (expectedCase: DecisionCase, receipt: CommandReceipt) => {
      if (expectedCase.preparedChanges.filter((item) => item.receipt?.id === receipt.id).length !== 1 || expectedCase.preparedChanges.find((item) => item.receipt?.id === receipt.id)?.id !== change.id || expectedCase.receipts.filter((item) => item.id === receipt.id).length !== 1 || digestSfValue(expectedCase.receipts.find((item) => item.id === receipt.id)) !== digestSfValue(receipt)) return false
      // This is a consistency fence for a receipt already authorized by its
      // canonical reader, never a substitute for that reader's authority.
      const retained = await input.state.read(source, "cases", (state, authority) => authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision && !!state.cases[expectedCase.id] && digestSfValue(state.cases[expectedCase.id]) === digestSfValue(expectedCase) && receiptSnapshotMatches(state, change, receipt, reviewDigest, context.binding.principalRef)).catch(() => undefined)
      return input.host.requestFor(context) === source && !source.signal.aborted && retained?.status === "ok" && retained.value
    }
    if (lookup.value.state === "found") {
      const bound = await input.state.read(source, "receipts", (state, authority) => authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision ? state.transactions[receiptProofTransactionKey(authority.principalRef, change.target.id, change.idempotencyKey)] : undefined).catch(() => undefined)
      if (!bound || bound.status !== "ok" || !bound.value) return { status: "unavailable", reason: "review-proof-unbound" }
      if (bound.value.commandDigest !== receiptReviewBinding(change, reviewDigest) || digestSfValue(bound.value.value) !== digestSfValue(lookup.value.receipt)) return { status: "conflict", reason: "review-proof-mismatch" }
      if (change.receipt) {
        if (digestSfValue(change.receipt) !== digestSfValue(lookup.value.receipt)) return { status: "unavailable", reason: "receipt-identity-collision" }
        if (!await input.host.revalidate(context) || !await input.authorizeCase(value, context).catch(() => false) || !await input.authorizeApplication(request, change, context).catch(() => false)) return { status: "denied", reason: "case-access-unavailable" }
        if (!await retainReceipt(value, lookup.value.receipt)) return { status: "unavailable", reason: "receipt-authority-changed" }
        return { status: "ok", value: lookup.value.receipt }
      }
    }
    if (!await input.host.revalidate(context) || !await input.authorizeCase(value, context)) return { status: "denied", reason: "case-access-unavailable" }
    if (lookup.value.state === "not-found" && change.receipt) return { status: "unavailable", reason: "authoritative-receipt-unavailable" }
    if (lookup.value.state === "not-found") {
      const attempted = await input.state.read(source, "cases", (state, authority) => authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision ? applicationAttempts(state, request).length > 0 : undefined).catch(() => undefined)
      if (!attempted || attempted.status !== "ok" || attempted.value === undefined) return { status: "unavailable", reason: "application-attempt-unavailable" }
      if (attempted.value) return { status: "unavailable", reason: "application-indeterminate-reconciliation-required" }
      if (value.version !== request.caseRef.version) return { status: "stale", reason: "case-changed" }
      const proof = await input.revalidateProducer(request, context).catch(() => undefined)
      if (!proof || proof.status !== "ok" || proof.value.reviewDigest !== reviewDigest) return proof && proof.status !== "ok" ? proof : { status: proof ? "stale" : "unavailable", reason: proof ? "review-proof-mismatch" : "review-producer-unavailable" }
      if (!await input.confirmApplication(request, context).catch(() => false)) return { status: "denied", reason: "application-confirmation-required" }
      const latest = await input.state.read(source, "cases", (state, authority) => authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision ? state.cases[request.caseRef.id] : undefined).catch(() => undefined)
      if (!latest || latest.status !== "ok") return { status: "unavailable", reason: "case-unavailable" }
      const fresh = latest.value
      const currentChange = fresh?.preparedChanges.find((item) => item.id === change.id && item.choiceId === request.choiceId)
      if (!fresh || fresh.incarnation !== value.incarnation || fresh.version !== value.version || !fresh.participants.includes(context.binding.principalRef) || !currentChange || currentChange.state !== "planned" || digestSfValue(currentChange) !== digestSfValue(change)) return { status: "stale", reason: "case-changed" }
      if (!await input.authorizeCase(fresh, context).catch(() => false) || !await input.authorizeApplication(request, currentChange, context).catch(() => false) || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "application-authority-unavailable" }
      const attempt = applicationAttempt(request, currentChange, reviewDigest, context.binding.principalRef, operation)
      // Persist before crossing the domain boundary. A crash before dispatch is
      // conservatively unresolved; absence of a receipt never grants a new dispatch.
      const reservation = { createdHere: false }
      const reserved = await input.state.transaction<ReturnType<typeof applicationAttempt> | null>(source, { namespace: "cases", expectedStorageVersion: latest.storageVersion, targetRef: value.id, targetIncarnation: value.incarnation, idempotencyKey: applicationAttemptKey(request), commandDigest: digestSfValue(attempt) }, async (state, authority) => {
        const actual = state.cases[value.id]
        if (!actual || digestSfValue(actual) !== digestSfValue(fresh) || authority.principalRef !== context.binding.principalRef || authority.policyVersion !== context.binding.policyVersion || authority.accessRevision !== context.binding.accessRevision || applicationAttempts(state, request).length) return { commit: false, value: null }
        // A provider may return a prior transaction without invoking this callback.
        // Only this invocation's successful commit may perform the first dispatch.
        reservation.createdHere = true
        return { commit: true, value: attempt }
      }).catch(() => undefined)
      if (!reserved || reserved.status !== "ok" || !reserved.value || !reservation.createdHere) {
        const recorded = await input.state.read(source, "cases", (state, authority) => authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision ? applicationAttempts(state, request).length > 0 : undefined).catch(() => undefined)
        return { status: "unavailable", reason: recorded?.status === "ok" && recorded.value ? "application-indeterminate-reconciliation-required" : "application-attempt-unavailable" }
      }
      if (source.signal.aborted || !await input.host.revalidate(context).catch(() => false)) return { status: "unavailable", reason: "application-indeterminate-reconciliation-required" }
    }
    const observed = structuredClone(lookup.value.state === "found" ? { status: "ok" as const, value: lookup.value.receipt } : await callDomain(() => input.apply.executePrepared(request, context)))
    if (observed.status !== "ok") return observed
    const result = structuredClone(await input.classifyReceipt(structuredClone(observed.value), structuredClone(change), context).catch(() => undefined))
    if (!result || !await input.host.revalidate(context)) return { status: "unavailable", reason: "receipt-classification-unavailable" }
    if (result.evidence.installationId !== context.binding.installationId || result.evidence.projectId !== context.binding.projectId || result.evidence.target.surface !== observed.value.surface || result.evidence.target.receiptId !== observed.value.id || result.evidence.target.idempotencyKey !== observed.value.idempotencyKey || result.evidence.target.targetIncarnation !== observed.value.targetIncarnation || result.evidence.target.commandDigest !== observed.value.commandDigest || result.evidence.target.version !== observed.value.version) return { status: "unavailable", reason: "receipt-evidence-mismatch" }
    const priorReceipt = value.receipts.find((receipt) => receipt.id === observed.value.id)
    if (value.preparedChanges.some((item) => item.id !== change.id && item.receipt?.id === observed.value.id)) return { status: "unavailable", reason: "receipt-identity-collision" }
    if (priorReceipt && digestSfValue(priorReceipt) !== digestSfValue(observed.value)) return { status: "unavailable", reason: "receipt-identity-collision" }
    const reconciled = reconcileDomainReceipt({ change, receipt: observed.value, principalRef: context.binding.principalRef, state: result.state })
    if (reconciled.status !== "ok") return reconciled
    if (change.receipt) {
      if (!await input.authorizeCase(value, context).catch(() => false) || !await input.authorizeApplication(request, change, context).catch(() => false) || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "case-access-unavailable" }
      if (!await retainReceipt(value, observed.value)) return { status: "unavailable", reason: "receipt-authority-changed" }
      return { status: "ok", value: observed.value }
    }
    // The producer may have advanced the cases namespace while committing its receipt.
    // Reopen it after the domain result and preserve unrelated, versioned case edits.
    const reconciliation = await input.state.read(source, "cases", (state, authority) => authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision ? state.cases[value.id] : undefined).catch(() => undefined)
    if (!reconciliation || reconciliation.status !== "ok" || !reconciliation.value) return { status: "unavailable", reason: "case-reconciliation-pending" }
    const fresh = reconciliation.value
    const selected = fresh.preparedChanges.find((item) => item.id === change.id && item.choiceId === request.choiceId)
    if (fresh.incarnation !== value.incarnation || fresh.version < value.version || !fresh.participants.includes(context.binding.principalRef) || !fresh.choices.some((choice) => choice.id === request.choiceId) || !selected || !await input.authorizeCase(fresh, context).catch(() => false) || !await input.authorizeApplication(request, selected, context).catch(() => false) || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "case-access-unavailable" }
    // Re-observe the domain's authoritative receipt after the asynchronous case
    // callbacks. The earlier command response is not a durable receipt fence.
    const confirmedReceipt = structuredClone(await callDomain(() => input.apply.readReceipt({ surface: change.target.surface, targetRef: change.target.id, targetIncarnation: change.target.incarnation, idempotencyKey: change.idempotencyKey, commandDigest: change.operation.commandDigest }, context)))
    if (confirmedReceipt.status !== "ok") return confirmedReceipt
    if (confirmedReceipt.value.state !== "found" || digestSfValue(confirmedReceipt.value.receipt) !== digestSfValue(observed.value)) return { status: "unavailable", reason: "authoritative-receipt-changed" }
    if (source.signal.aborted || !await input.authorizeCase(fresh, context).catch(() => false) || !await input.authorizeApplication(request, selected, context).catch(() => false) || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "case-access-unavailable" }
    if (selected.receipt) {
      if (digestSfValue(selected) !== digestSfValue(reconciled.change)) return { status: "unavailable", reason: "receipt-identity-collision" }
      if (!await retainReceipt(fresh, observed.value)) return { status: "unavailable", reason: "receipt-authority-changed" }
      return { status: "ok", value: observed.value }
    }
    if (digestSfValue(selected) !== digestSfValue(change)) return { status: "stale", reason: "prepared-change-changed" }
    if (fresh.preparedChanges.some((item) => item.id !== change.id && item.receipt?.id === observed.value.id) || fresh.receipts.some((receipt) => receipt.id === observed.value.id && digestSfValue(receipt) !== digestSfValue(observed.value))) return { status: "unavailable", reason: "receipt-identity-collision" }
    const changes = fresh.preparedChanges.map((item) => item.id === change.id ? reconciled.change : item)
    const reconciledCase: DecisionCase = { ...fresh, version: fresh.version + 1, preparedChanges: changes, receipts: fresh.receipts.some((receipt) => receipt.id === observed.value.id) ? fresh.receipts : [...fresh.receipts, observed.value], sourceRefs: [...fresh.sourceRefs, result.evidence].filter((ref, index, refs) => refs.findIndex((other) => other.refDigest === ref.refDigest) === index), state: caseApplicationState(changes) }
    const saved = await input.state.transaction(source, { namespace: "cases", expectedStorageVersion: reconciliation.storageVersion, targetRef: value.id, targetIncarnation: value.incarnation, idempotencyKey: `${operation}:${change.id}:${observed.value.id}`, commandDigest: digestSfValue({ caseRef: request.caseRef, changeId: change.id, receipt: observed.value, state: result.state, evidence: result.evidence }) }, async (state, authority) => {
      const actual = state.cases[value.id]
      if (!actual || digestSfValue(actual) !== digestSfValue(fresh) || authority.principalRef !== context.binding.principalRef || authority.policyVersion !== context.binding.policyVersion || authority.accessRevision !== context.binding.accessRevision || !receiptSnapshotMatches(state, change, observed.value, reviewDigest, context.binding.principalRef)) return { commit: false, value: false }
      state.cases[value.id] = reconciledCase
      return { commit: true, value: true }
    }).catch(() => undefined)
    if (!saved || saved.status !== "ok") return { status: "unavailable", reason: "case-reconciliation-pending" }
    if (!saved.value) return { status: "unavailable", reason: "case-reconciliation-pending" }
    const currentReceipt = await input.classifyReceipt(structuredClone(observed.value), structuredClone(reconciled.change), context).catch(() => undefined)
    if (!currentReceipt || digestSfValue(currentReceipt) !== digestSfValue(result) || !await input.authorizeApplication(request, reconciled.change, context).catch(() => false) || !await input.host.revalidate(context).catch(() => false)) return { status: "unavailable", reason: "receipt-authority-changed" }
    if (!await retainReceipt(reconciledCase, observed.value)) return { status: "unavailable", reason: "receipt-authority-changed" }
    return { status: "ok", value: observed.value }
  }
}

function receiptSnapshotMatches(state: SfProductState, change: PreparedChange, receipt: CommandReceipt, reviewDigest: string, principalRef: string) {
  const stored = state.receipts[receipt.id]
  const proof = state.transactions[receiptProofTransactionKey(principalRef, change.target.id, change.idempotencyKey)]
  const matches = Object.values(state.receipts).filter((item) => item.surface === change.target.surface && item.targetIncarnation === change.target.incarnation && item.idempotencyKey === change.idempotencyKey && item.principalRef === principalRef)
  const scope = change.target.surface === "dashboard" ? ["cases", "receipts"] : { namespaces: ["cases", "receipts"], domainSurface: change.target.surface }
  return matches.length === 1 && !!stored && !!proof && proof.namespace === "receipts" && proof.scopeDigest === digestSfValue(scope) && proof.principalRef === principalRef && proof.targetRef === change.target.id && proof.targetIncarnation === change.target.incarnation && proof.incarnation === state.incarnation && digestSfValue(stored) === digestSfValue(receipt) && proof.commandDigest === receiptReviewBinding(change, reviewDigest) && digestSfValue(proof.value) === digestSfValue(receipt)
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
