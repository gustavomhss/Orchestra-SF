import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DecisionCase, PreparedChange } from "../contracts/decisions.ts"
import type { CommandReceipt } from "../contracts/context.ts"
import type { DomainPortHost, PortResult, PreparedApplyPort } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductState, SfProductStatePort, SfStateResult, SfStateAuthority } from "../contracts/state.ts"
import { caseApplicationState, reconcileDomainReceipt } from "./receipts.ts"
import { isReviewDigest, preparedOriginalIntent, preparedOriginalIntentState, receiptProofKey, receiptProofMatches, receiptProofLookup, receiptReviewBinding, type PreparedApplyRequest, type ReviewDigestFor } from "./receipt-review-binding.ts"
import { applicationAbort, applicationAbortKey, applicationAttempt, applicationAttempts, applicationDispatchAttempt, applicationDispatchKey, applicationDispatchState, applicationReservation, hasApplicationAttempt } from "./application-attempt.ts"
import { appendSfTransactionAbort } from "../host-binding/state-provider.ts"

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
    const selectedChanges = value.preparedChanges.filter((item) => item.id === request.changeId)
    const change = selectedChanges[0]
    const choices = value.choices.filter((choice) => choice.id === request.choiceId)
    const choiceDigest = digestSfValue(choices)
    if (selectedChanges.length !== 1 || !change || change.choiceId !== request.choiceId || choices.length !== 1) return { status: "unavailable", reason: "prepared-change-unavailable" }
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
      const retained = await input.state.read(source, "cases", (state, authority) => authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision && !!state.cases[expectedCase.id] && digestSfValue(state.cases[expectedCase.id]) === digestSfValue(expectedCase) && receiptSnapshotMatches(state, request, change, receipt, reviewDigest, context, authority)).catch(() => undefined)
      return input.host.requestFor(context) === source && !source.signal.aborted && retained?.status === "ok" && retained.value
    }
    if (lookup.value.state === "found") {
      const bound = await input.state.read(source, "receipts", (state, authority) => {
        if (authority.principalRef !== context.binding.principalRef || authority.policyVersion !== context.binding.policyVersion || authority.accessRevision !== context.binding.accessRevision) return undefined
        const proof = receiptProofLookup(state, authority, change.target.id, change.idempotencyKey)
        const attempts = applicationAttempts(state, request, authority)
        if (proof.status !== "found" || attempts.status === "ambiguous") return undefined
        return { proof: proof.receipt,
          intent: preparedOriginalIntentState(state, request, change, state.cases[request.caseRef.id]?.choices.filter((choice) => choice.id === request.choiceId) ?? [], reviewDigest, context, attempts) }
      }).catch(() => undefined)
      if (!bound || bound.status !== "ok" || !bound.value?.proof) return { status: "unavailable", reason: "review-proof-unbound" }
      if (bound.value.proof.commandDigest !== receiptReviewBinding(change, reviewDigest) || digestSfValue(bound.value.proof.value) !== digestSfValue(lookup.value.receipt)) return { status: "conflict", reason: "review-proof-mismatch" }
      if (bound.value.intent !== "matched") return { status: bound.value.intent === "missing" ? "unavailable" : "conflict", reason: bound.value.intent === "missing" ? "original-intent-unverifiable" : "original-intent-mismatch" }
      if (change.receipt) {
        if (digestSfValue(change.receipt) !== digestSfValue(lookup.value.receipt)) return { status: "unavailable", reason: "receipt-identity-collision" }
        if (!await input.host.revalidate(context) || !await input.authorizeCase(value, context).catch(() => false) || !await input.authorizeApplication(request, change, context).catch(() => false)) return { status: "denied", reason: "case-access-unavailable" }
        if (!await retainReceipt(value, lookup.value.receipt)) return { status: "unavailable", reason: "receipt-authority-changed" }
        return { status: "ok", value: lookup.value.receipt }
      }
    }
    if (!await input.host.revalidate(context) || !await input.authorizeCase(value, context)) return { status: "denied", reason: "case-access-unavailable" }
    if (lookup.value.state === "not-found" && change.receipt) return { status: "unavailable", reason: "authoritative-receipt-unavailable" }
    const dispatch: { attempt?: ReturnType<typeof applicationAttempt>; ordinal?: number; reservation?: SfProductState["transactions"][string]; decision?: DecisionCase } = {}
    if (lookup.value.state === "not-found") {
      const attempt = { ...applicationAttempt(request, change, reviewDigest, context.binding.principalRef, operation), originalIntent: preparedOriginalIntent(request, change, choices[0]!, reviewDigest, context) }
      const attempted = await input.state.read(source, "cases", (state, authority) => authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision ? applicationDispatchState(state, request, attempt, change, authority) : undefined).catch(() => undefined)
      if (!attempted || attempted.status !== "ok" || attempted.value === undefined) return { status: "unavailable", reason: "application-attempt-unavailable" }
      if (attempted.value.state !== "new" && attempted.value.state !== "aborted") return { status: "unavailable", reason: "application-indeterminate-reconciliation-required" }
      if (value.version !== request.caseRef.version) return { status: "stale", reason: "case-changed" }
      const proof = await input.revalidateProducer(request, context).catch(() => undefined)
      if (!proof || proof.status !== "ok" || proof.value.reviewDigest !== reviewDigest) return proof && proof.status !== "ok" ? proof : { status: proof ? "stale" : "unavailable", reason: proof ? "review-proof-mismatch" : "review-producer-unavailable" }
      if (!await input.confirmApplication(request, context).catch(() => false)) return { status: "denied", reason: "application-confirmation-required" }
      const latest = await input.state.read(source, "cases", (state, authority) => authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision ? state.cases[request.caseRef.id] : undefined).catch(() => undefined)
      if (!latest || latest.status !== "ok") return { status: "unavailable", reason: "case-unavailable" }
      const fresh = latest.value
      const currentChange = fresh?.preparedChanges.find((item) => item.id === change.id && item.choiceId === request.choiceId)
      if (!fresh || fresh.incarnation !== value.incarnation || fresh.version !== value.version || !fresh.participants.includes(context.binding.principalRef) || fresh.preparedChanges.filter((item) => item.id === change.id).length !== 1 || digestSfValue(fresh.choices.filter((choice) => choice.id === request.choiceId)) !== choiceDigest || !currentChange || currentChange.state !== "planned" || digestSfValue(currentChange) !== digestSfValue(change)) return { status: "stale", reason: "case-changed" }
      if (!await input.authorizeCase(fresh, context).catch(() => false) || !await input.authorizeApplication(request, currentChange, context).catch(() => false) || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "application-authority-unavailable" }
      const ordinal = attempted.value.state === "new" ? 0 : attempted.value.ordinal + 1
      const reservationValue = attempted.value.state === "new" ? attempt : applicationDispatchAttempt(request, attempt, ordinal, digestSfValue(attempted.value.abort))
      // Persist every dispatch ordinal before crossing the domain boundary. A
      // crash or missing authenticated abort journal remains indeterminate.
      const reservation = { createdHere: false }
      const reserved = await input.state.transaction<typeof reservationValue | null>(source, { namespace: "cases", expectedStorageVersion: latest.storageVersion, targetRef: value.id, targetIncarnation: value.incarnation, idempotencyKey: applicationDispatchKey(request, ordinal), commandDigest: digestSfValue(reservationValue) }, async (state, authority) => {
        const actual = state.cases[value.id]
        if (!actual || digestSfValue(actual) !== digestSfValue(fresh) || authority.principalRef !== context.binding.principalRef || authority.policyVersion !== context.binding.policyVersion || authority.accessRevision !== context.binding.accessRevision ||
          digestSfValue(applicationDispatchState(state, request, attempt, currentChange, authority)) !== digestSfValue(attempted.value)) return { commit: false, value: null }
        // A provider may return a prior transaction without invoking this callback.
        // Only this invocation's successful CAS may perform this dispatch.
        reservation.createdHere = true
        return { commit: true, value: reservationValue }
      }).catch(() => undefined)
      if (!reserved || reserved.status !== "ok" || !reserved.value || !reservation.createdHere) {
        const recorded = await input.state.read(source, "cases", (state, authority) => authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision ? hasApplicationAttempt(state, request, authority) : undefined).catch(() => undefined)
        return { status: "unavailable", reason: recorded?.status === "ok" && recorded.value ? "application-indeterminate-reconciliation-required" : "application-attempt-unavailable" }
      }
      if (source.signal.aborted || !await input.host.revalidate(context).catch(() => false)) return { status: "unavailable", reason: "application-indeterminate-reconciliation-required" }
      dispatch.attempt = attempt
      dispatch.ordinal = ordinal
      dispatch.reservation = applicationReservation(request, context.binding.principalRef, reservationValue, reserved)
      dispatch.decision = fresh
    }
    const domainResult = lookup.value.state === "found" ? { status: "ok" as const, value: lookup.value.receipt } : await callDomain(() => input.apply.executePrepared(request, context))
    if (domainResult.status === "unavailable" && dispatch.attempt && dispatch.ordinal !== undefined && dispatch.reservation && dispatch.decision) {
      const { attempt, ordinal, reservation, decision } = dispatch
      // Inspect the actual producer result before cloning. Plain fields, copied
      // errors, post-COMMIT failures and reused observations cannot append here.
      await appendSfTransactionAbort({
        state: input.state, request: source, result: domainResult,
        expected: { namespace: "receipts", domainSurface: change.target.surface, targetRef: change.target.id,
          targetIncarnation: change.target.incarnation, idempotencyKey: receiptProofKey(change.idempotencyKey), commandDigest: receiptReviewBinding(change, reviewDigest) },
        expectedStorageVersion: reservation.storageVersion, targetRef: value.id, targetIncarnation: value.incarnation,
        idempotencyKey: applicationAbortKey(request, ordinal), value: applicationAbort(request, attempt, ordinal, reservation),
        validate: (state, authority, proof) => {
          const currentDispatch = applicationDispatchState(state, request, attempt, change, authority)
          return input.host.requestFor(context) === source && !source.signal.aborted &&
            authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision &&
            currentDispatch.state === "pending" && currentDispatch.ordinal === ordinal && digestSfValue(currentDispatch.reservation) === digestSfValue(reservation) &&
            digestSfValue(state.cases[value.id]) === digestSfValue(decision) && proof.envelope.incarnation === reservation.incarnation &&
            proof.envelope.versions.cases === reservation.storageVersion && proof.envelope.aggregateRevision >= reservation.aggregateRevision &&
            receiptProofLookup(state, authority, change.target.id, change.idempotencyKey).status === "missing" &&
            !Object.values(state.receipts).some((receipt) => receipt.surface === change.target.surface && receipt.targetIncarnation === change.target.incarnation &&
              receipt.idempotencyKey === change.idempotencyKey && receipt.principalRef === context.binding.principalRef)
        },
      }).catch(() => undefined)
    }
    const observed = structuredClone(domainResult)
    // A choice replaced after the domain receipt commits fails retention as
    // receipt-authority-changed. That is the material conflict, not a lost receipt.
    if (observed.status === "unavailable" && observed.reason === "receipt-authority-changed") {
      const raced = await input.state.read(source, "cases", (state, authority) => authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision ? state.cases[value.id] : undefined).catch(() => undefined)
      if (raced?.status === "ok" && raced.value && digestSfValue(raced.value.choices.filter((choice) => choice.id === request.choiceId)) !== choiceDigest) return { status: "stale", reason: "prepared-choice-changed" }
    }
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
    // Fresh storage may preserve unrelated edits, but cannot bind the original
    // receipt to a materially replaced or duplicated historical choice.
    if (reconciliation?.status === "ok" && reconciliation.value && digestSfValue(reconciliation.value.choices.filter((choice) => choice.id === request.choiceId)) !== choiceDigest) return { status: "stale", reason: "prepared-choice-changed" }
    if (reconciliation?.status === "ok" && reconciliation.value && reconciliation.value.preparedChanges.filter((item) => item.id === change.id).length !== 1) return { status: "stale", reason: "prepared-change-changed" }
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
      if (!actual || digestSfValue(actual) !== digestSfValue(fresh) || authority.principalRef !== context.binding.principalRef || authority.policyVersion !== context.binding.policyVersion || authority.accessRevision !== context.binding.accessRevision || !receiptSnapshotMatches(state, request, change, observed.value, reviewDigest, context, authority)) return { commit: false, value: false }
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

function receiptSnapshotMatches(state: SfProductState, request: PreparedApplyRequest, change: PreparedChange, receipt: CommandReceipt, reviewDigest: string, context: TrustedDomainContext, authority: SfStateAuthority) {
  const selected = receiptProofLookup(state, authority, change.target.id, change.idempotencyKey)
  if (selected.status !== "found") return false
  const proof = selected.receipt
  const choices = state.cases[request.caseRef.id]?.choices.filter((choice) => choice.id === request.choiceId) ?? []
  return receiptProofMatches(state, change.target, receipt, authority) && proof?.commandDigest === receiptReviewBinding(change, reviewDigest) &&
    preparedOriginalIntentState(state, request, change, choices, reviewDigest, context, applicationAttempts(state, request, authority)) === "matched"
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

