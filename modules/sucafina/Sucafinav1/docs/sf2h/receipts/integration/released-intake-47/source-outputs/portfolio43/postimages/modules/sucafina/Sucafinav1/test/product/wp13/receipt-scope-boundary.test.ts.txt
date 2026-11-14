import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "bun:test"
import { createDecisionCasePort } from "../../../product/decisions/case-port.ts"
import { createDecisionPreparedReview } from "../../../product/decisions/prepared-review.ts"
import { prepareDomainChange } from "../../../product/decisions/prepared-change.ts"
import { createPreparedExecution } from "../../../product/decisions/apply.ts"
import { createSfPreparedApply } from "../../../product/decisions/prepared-apply.ts"
import { applicationAttempts } from "../../../product/decisions/application-attempt.ts"
import { receiptProofTransactionKey, receiptReviewBinding, type ReviewDigestFor } from "../../../product/decisions/receipt-review-binding.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { ChoiceRecord, DecisionCase, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { PreparedCommand } from "../../../product/contracts/context.ts"
import type { PreparedDomainMutation } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import type { Persistence, Snapshot, TransactionOptions } from "../../../runtime/contract.ts"
import type { Surface } from "../../../src/identity.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"

test("portfolio C12 rollback before domain commit retains its durable reservation across reopen", async () => {
  const fixture = await receiptScopeFixture()
  try {
    fixture.fault.beforeReceiptCommit = true
    expect(await fixture.services.execution(fixture.request, fixture.admission.context)).toEqual({ status: "unavailable", reason: "domain-application-unavailable" })
    const failed = await fixture.services.witness()
    expect(failed.domain).toEqual({ amount: 30, version: 4 })
    expect(failed.receipts).toEqual([])
    expect(failed.proof).toBeUndefined()
    expect(failed.attempts).toHaveLength(1)
    expect(failed.attempts[0]?.value).toMatchObject({ schema: "sf-decision-application-attempt-v1", state: "receipt-required", caseRef: fixture.request.caseRef, changeId: fixture.change.id, choiceId: fixture.choice.id, reviewBinding: receiptReviewBinding(fixture.change, fixture.review.digest!) })
    expect(failed.decision).toEqual(fixture.decision)
    expect(fixture.fault.producerCalls).toBe(1)
    const reopened = await fixture.reopen()
    expect(await reopened.witness()).toEqual(failed)
    expect(await reopened.execution(fixture.request, fixture.admission.context)).toEqual({ status: "unavailable", reason: "application-indeterminate-reconciliation-required" })
    expect(await reopened.execution(fixture.request, fixture.admission.context, "recover")).toEqual({ status: "unavailable", reason: "original-receipt-unavailable" })
    expect(await reopened.witness()).toEqual(failed)
    expect(fixture.fault.producerCalls).toBe(1)
  } finally {
    await fixture.dispose()
  }
})

test("portfolio C12 lost response recovers the original canonical receipt after reopen without repeating the effect", async () => {
  const fixture = await receiptScopeFixture()
  try {
    fixture.fault.afterReceiptCommit = true
    const oldContext = fixture.admission.context
    expect(await fixture.services.execution(fixture.request, oldContext)).toEqual({ status: "unavailable", reason: "domain-result-unknown" })
    const committed = await fixture.services.witness()
    expect(committed.domain).toEqual({ amount: 40, version: 5 })
    expect(committed.receipts).toHaveLength(1)
    expect(committed.attempts).toHaveLength(1)
    expect(committed.decision).toEqual(fixture.decision)
    expect(committed.proof?.scopeDigest).toBe(digestSfValue({ namespaces: ["cases", "receipts"], domainSurface: "planner" }))
    expect(committed.proof?.commandDigest).toBe(receiptReviewBinding(fixture.change, fixture.review.digest!))
    expect(committed.proof?.value).toEqual(committed.receipts[0])
    expect(fixture.fault.producerCalls).toBe(1)
    const reopened = await fixture.reopen()
    expect(await reopened.witness()).toEqual(committed)
    expect(await reopened.execution(fixture.request, oldContext, "recover")).toEqual({ status: "denied", reason: "human-authority-required" })
    const substituted = { ...fixture.admission.context, lease: {} } as unknown as TrustedUiContext
    expect(await reopened.execution(fixture.request, substituted, "recover")).toEqual({ status: "denied", reason: "human-authority-required" })
    fixture.admission.allowed = false
    expect(await reopened.execution(fixture.request, fixture.admission.context, "recover")).toEqual({ status: "denied", reason: "human-authority-required" })
    fixture.admission.allowed = true
    expect((await reopened.execution({ ...fixture.request, choiceId: "different-choice" }, fixture.admission.context, "recover")).status).toBe("unavailable")
    expect((await reopened.execution({ ...fixture.request, caseRef: { ...fixture.request.caseRef, incarnation: "replacement-incarnation" } }, fixture.admission.context, "recover")).status).toBe("denied")
    const recovered = await reopened.execution(fixture.request, fixture.admission.context, "recover")
    expect(recovered).toEqual({ status: "ok", value: committed.receipts[0] })
    expect(await reopened.execution(fixture.request, fixture.admission.context)).toEqual(recovered)
    const reconciled = await reopened.witness()
    expect(reconciled.domain).toEqual(committed.domain)
    expect(reconciled.receipts).toEqual(committed.receipts)
    expect(reconciled.proof).toEqual(committed.proof)
    expect(reconciled.attempts).toEqual(committed.attempts)
    expect(reconciled.decision?.choices).toEqual([fixture.choice])
    expect(reconciled.decision?.preparedChanges[0]?.receipt).toEqual(committed.receipts[0])
    expect(reconciled.decision?.receipts).toEqual(committed.receipts)
    expect(reconciled.decision?.state).toBe("applied")
    expect(fixture.fault.producerCalls).toBe(1)
    expect(await reopened.apply.readReceipt({ surface: "planner", targetRef: fixture.change.target.id, targetIncarnation: fixture.change.target.incarnation, idempotencyKey: fixture.change.idempotencyKey, commandDigest: "f".repeat(64) }, fixture.admission.context)).toEqual({ status: "conflict", reason: "idempotency-content-changed" })
    expect(await reopened.witness()).toEqual(reconciled)
  } finally {
    await fixture.dispose()
  }
})

test("portfolio C12 canonical producer preserves the domain CAS and commits a single rejected receipt", async () => {
  const fixture = await receiptScopeFixture()
  try {
    fixture.fault.advanceBeforeProducer = true
    const rejected = await fixture.services.execution(fixture.request, fixture.admission.context)
    expect(rejected.status).toBe("ok")
    if (rejected.status !== "ok") throw new Error("canonical rejected receipt unavailable")
    expect(rejected.value).toMatchObject({ surface: "planner", version: 5, result: { ok: false, status: 409 } })
    const durable = await fixture.services.witness()
    expect(durable.domain).toEqual({ amount: 35, version: 5 })
    expect(durable.receipts).toEqual([rejected.value])
    expect(durable.attempts).toHaveLength(1)
    expect(durable.decision?.preparedChanges[0]?.state).toBe("conflict")
    expect(durable.decision?.choices).toEqual([fixture.choice])
    expect(durable.proof?.scopeDigest).toBe(digestSfValue({ namespaces: ["cases", "receipts"], domainSurface: "planner" }))
    expect(fixture.fault.producerCalls).toBe(1)
    const reopened = await fixture.reopen()
    expect(await reopened.execution(fixture.request, fixture.admission.context, "recover")).toEqual(rejected)
    expect(await reopened.witness()).toEqual(durable)
    expect(fixture.fault.producerCalls).toBe(1)
  } finally {
    await fixture.dispose()
  }
})

// Controlled values isolate the receipt protocol; complete coverage, native
// admission and the real Finance/Procurement algorithms remain separate proofs.
async function receiptScopeFixture() {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-portfolio-receipt-scope-"))
  await chmod(directory, 0o700)
  const handle = { store: await openLocalStore(directory), generation: 0 }
  const binding = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "principal", requestId: "request-0", policyVersion: "policy", accessRevision: "access", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
  const admission = { context: binding, request: new Request("https://example.test/portfolio"), allowed: true }
  const fault = { beforeReceiptCommit: false, afterReceiptCommit: false, advanceBeforeProducer: false, producerCalls: 0, receiptSequence: 0 }
  const review = { digest: undefined as string | undefined }
  const horizon = { start: "2027-01-01", end: "2027-12-31" }
  const target = { surface: "planner" as const, type: "forecast", id: "forecast-a", incarnation: "forecast-inc", version: 4, fields: ["amount"], period: horizon, observedAt: "2027-01-01T00:00:00Z" }
  const evidenceBase: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", refId: "forecast-ref", installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: target.type, recordId: target.id, incarnation: target.incarnation, version: 4, fields: target.fields, period: horizon, projectionDigest: digestSfValue({ target, amount: 30 }) } }
  const source = { ...evidenceBase, refDigest: digestSfEvidenceRef(evidenceBase) }
  const scenario: ScenarioResult = { id: "controlled-scenario", version: 1, components: [{ id: target.id, amount: 40, currency: "USD", period: horizon, sourceRefs: [target], evidenceState: "hypothetical" }], currency: "USD", horizon, sourceRefs: [source], unresolvedConditions: ["training:missing-category"], restrictions: ["controlled-protocol-fixture"], comparisonStatus: "conditioned", knownSubtotal: 40, total: null, costCoverage: { basisId: "controlled", basisVersion: 1, alternativeId: "controlled", alternativeVersion: 1, currency: "USD", horizon, issues: ["training:missing-category"], evaluatedSourceRefs: [source], coverageState: "pending", entries: [{ status: "included", categoryId: "service", componentRefs: [target.id], evidenceRefs: [source], scopeNote: "Only the controlled service amount is supplied" }], derivedMissingCategoryIds: ["training"] } }
  const choice: ChoiceRecord = { id: "choice", alternativeId: "controlled", alternativeVersion: 1, basisVersion: 1, criteria: ["cost"], values: [{ criterionRef: "cost", value: null, unit: "USD", currency: "USD", horizon }], evidenceRefs: [source], principalRef: "principal", reason: "Controlled human choice with unresolved training cost", at: "2027-01-01T00:00:00Z", scenario: { baseRef: source.refId, operations: [{ kind: "replace", targetRef: "planner:forecast-a", amount: 40, currency: "USD", period: horizon }], assumptions: [] }, result: scenario, comparison: { baselineResultRef: "controlled-baseline", alternativeResultRef: "controlled-scenario", costCoverageRefs: ["controlled-coverage"], criterionResults: [{ criterionId: "cost", state: "unknown", reason: "training:missing-category" }], unresolvedConditions: ["training:missing-category"], comparisonStatus: "conditioned", knownDifference: -10, completeDifference: null }, comparisonStatus: "conditioned", costCoverage: scenario.costCoverage }
  const initial: DecisionCase = { id: "case", incarnation: "case-inc", version: 4, state: "chosen", objective: "Exercise one controlled receipt", horizon, currency: "USD", criteria: [{ id: "cost", description: "cost", required: true }], participants: ["principal"], sourceRefs: [source], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [choice], preparedChanges: [], receipts: [], ledger: [] }
  const command = { page: "planner", action: "edit", version: 4, values: { amount: 40 } }
  const prepared: PreparedCommand = { id: "command", target, command, idempotencyKey: "controlled-command", commandDigest: digestSfValue(command), expectedVersion: 4, requiredAuthority: ["planner"], preview: { context: { installationId: "install", projectId: "project", principalRef: "principal", accessRevision: "access", policyVersion: "policy", surface: "planner", period: horizon, currency: "USD", sourceRefs: [target], capabilities: [] }, version: 4, engineVersion: "controlled-domain-v1", components: scenario.components, values: [], missing: [{ field: "training", reason: "missing" }] } }
  const preparation = prepareDomainChange({ case: initial, expectedCaseVersion: 4, choiceId: choice.id, command: prepared, preview: scenario, id: "change" })
  if (preparation.status !== "ok") throw new Error("controlled domain preparation failed")
  const change = preparation.change
  const decision: DecisionCase = { ...initial, preparedChanges: [change] }
  const request = { caseRef: { id: decision.id, incarnation: decision.incarnation, version: decision.version }, changeId: change.id, choiceId: choice.id }
  const makeServices = () => {
    const transactionAll = handle.store.transactionAll
    if (!transactionAll) throw new Error("canonical C08 cross-surface persistence unavailable")
    const persistence: Persistence = {
      ...handle.store,
      transactionAll: <T>(work: (snapshots: Record<Surface, Snapshot>) => Promise<{ commit: boolean; value: T }>, options?: TransactionOptions) => transactionAll(async (snapshots) => {
        const before = snapshots.planner.versions.wp13Amount?.version
        const result = await work(snapshots)
        if (fault.beforeReceiptCommit && result.commit && snapshots.planner.versions.wp13Amount?.version !== before) {
          fault.beforeReceiptCommit = false
          throw new Error("WP13_CONTROLLED_PRECOMMIT_FAILURE")
        }
        return result
      }, options),
    }
    const current = (context: TrustedDomainContext) => admission.allowed && context === admission.context && !admission.request.signal.aborted
    const host = { requestFor: (context: TrustedDomainContext) => current(context) ? admission.request : undefined, revalidate: async (context: TrustedDomainContext) => current(context) }
    const state = createSfProductState({ persistence, createId: () => "product-inc", authorize: async (incoming) => admission.allowed && incoming === admission.request ? { principalRef: "principal", policyVersion: "policy", accessRevision: "access" } : undefined, resolveTarget: async (_incoming, _snapshot, _namespace, ref) => ref === decision.id ? { incarnation: decision.incarnation } : ref === target.id ? { incarnation: target.incarnation } : undefined })
    const evidence: BusinessContextService = { context: async ({ refs }) => refs.map((ref) => ({ ref, state: "fresh", accessRevision: "access", checkedAt: "2027-01-01" })), resolve: async () => { throw new Error("unused") }, recall: async () => [], emitFromLedger: async () => { throw new Error("unused") } }
    const cases = createDecisionCasePort({ state, host, creationTarget: { ref: "install:cases", incarnation: "install-inc" }, operationIdentity: () => "controlled-case", authorizeCase: async (value, context) => current(context) && value.id === decision.id, verifyScenarioOperations: async () => true, evidence, createId: () => "unused-event", now: () => "2027-01-01T00:00:00Z" })
    const domainValue = () => handle.store.transaction("planner", async (snapshot) => ({ commit: false, value: { amount: snapshot.data.wp13Amount as number, version: snapshot.versions.wp13Amount?.version } }))
    const preparedReview = createDecisionPreparedReview({ state, cases, host, reviewDomain: async (operation, context) => {
      const value = await domainValue()
      if (!current(context) || value.version !== operation.expectedVersion) return { status: "stale", reason: "domain-review-changed" }
      return { status: "ok", value: { fields: [{ field: "amount", before: value.amount, after: operation.command.values.amount as number }], source, originalTargetDigest: digestSfValue(operation.target) } }
    } })
    const reviewDigestFor: ReviewDigestFor = (context, incoming, selected) => current(context) && incoming.caseRef.id === request.caseRef.id && incoming.caseRef.incarnation === request.caseRef.incarnation && incoming.choiceId === choice.id && incoming.changeId === change.id && selected.id === change.id && digestSfValue(selected.operation) === digestSfValue(change.operation) ? review.digest : undefined
    const producer = createSfPreparedApply({
      state, host,
      authorizeCase: async (value, context) => current(context) && value.id === decision.id && value.incarnation === decision.incarnation,
      authorizeLookup: async (lookup, context) => current(context) && lookup.surface === target.surface && lookup.targetRef === target.id && lookup.targetIncarnation === target.incarnation && lookup.idempotencyKey === change.idempotencyKey,
      authorizeReceipt: async (receipt, lookup, context) => current(context) && receipt.principalRef === "principal" && receipt.surface === lookup.surface && receipt.targetIncarnation === lookup.targetIncarnation && receipt.idempotencyKey === lookup.idempotencyKey && receipt.commandDigest === lookup.commandDigest,
      confirmHuman: async (incoming, selected, context) => !!reviewDigestFor(context, incoming, selected),
      resolveActor: (_snapshot, context) => current(context) ? { id: "principal", roles: ["finance"], canWrite: true } : undefined,
      resolveMutation: (_snapshot, selected): PreparedDomainMutation => ({
        surface: selected.target.surface, targetIncarnation: selected.target.incarnation, idempotencyKey: selected.idempotencyKey, commandDigest: selected.operation.commandDigest, expectedVersion: selected.expectedVersion,
        execute: (snapshot): ReturnType<PreparedDomainMutation["execute"]> => {
          fault.producerCalls++
          if (snapshot.versions.wp13Amount?.version !== selected.expectedVersion) return { commit: false, value: { status: "conflict" } }
          snapshot.data.wp13Amount = selected.operation.command.values.amount
          snapshot.versions.wp13Amount = { version: selected.expectedVersion + 1, by: "principal" }
          return { commit: true, value: { amount: selected.operation.command.values.amount as number } }
        },
      }),
      verifyGrant: (_snapshot, incoming, selected, actor, context) => actor.id === context.binding.principalRef && !!reviewDigestFor(context, incoming, selected),
      receiptVersion: (snapshot) => snapshot.versions.wp13Amount?.version,
      environment: () => ({ at: "2027-01-01T00:00:00Z", id: () => "unused", directory: [] }), createId: () => `receipt-${++fault.receiptSequence}`, now: () => "2027-01-01T00:00:00Z", reviewDigestFor,
    })
    const apply: typeof producer = {
      readReceipt: producer.readReceipt,
      executePrepared: async (incoming, context) => {
        if (fault.advanceBeforeProducer) {
          fault.advanceBeforeProducer = false
          await handle.store.transaction("planner", async (snapshot) => {
            snapshot.data.wp13Amount = 35
            snapshot.versions.wp13Amount = { version: 5, by: "other-authorized-editor" }
            return { commit: true, value: true }
          })
        }
        const result = await producer.executePrepared(incoming, context)
        if (fault.afterReceiptCommit && result.status === "ok") {
          fault.afterReceiptCommit = false
          throw new Error("WP13_CONTROLLED_POSTCOMMIT_RESPONSE_LOSS")
        }
        return result
      },
    }
    const execution = createPreparedExecution({ state, host, apply, reviewDigestFor, revalidateProducer: preparedReview, authorizeCase: async (value, context) => current(context) && value.id === decision.id, authorizeApplication: async (incoming, selected, context) => current(context) && incoming.choiceId === choice.id && selected.caseId === decision.id, confirmApplication: async (_incoming, context) => current(context), operationIdentity: () => "controlled-application", classifyReceipt: async (receipt) => {
      const ref: Extract<BusinessEvidenceRef, { kind: "receipt" }> = { schema: "sf-evidence-v1", refId: `receipt-ref-${receipt.id}`, installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "observed", kind: "receipt", target: { surface: receipt.surface, receiptId: receipt.id, idempotencyKey: receipt.idempotencyKey, targetIncarnation: receipt.targetIncarnation, commandDigest: receipt.commandDigest, version: receipt.version } }
      return { state: receipt.result.ok ? "applied" : "conflict", evidence: { ...ref, refDigest: digestSfEvidenceRef(ref) } }
    } })
    const witness = async () => {
      const saved = await state.read(admission.request, "cases", (product) => ({ decision: product.cases[decision.id], receipts: Object.values(product.receipts), proof: product.transactions[receiptProofTransactionKey("principal", target.id, change.idempotencyKey)], attempts: applicationAttempts(product, request) }))
      if (saved.status !== "ok") throw new Error("canonical witness unavailable")
      return { ...saved.value, domain: await domainValue() }
    }
    return { state, apply, execution, preparedReview, witness }
  }
  await handle.store.transaction("planner", async (snapshot) => {
    snapshot.data.wp13Amount = 30
    snapshot.versions.wp13Amount = { version: 4, by: "principal" }
    return { commit: true, value: true }
  })
  const services = makeServices()
  const seeded = await services.state.transaction(admission.request, { namespace: "cases", expectedStorageVersion: 0, targetRef: decision.id, targetIncarnation: decision.incarnation, idempotencyKey: "seed-controlled-case", commandDigest: digestSfValue(decision) }, async (product) => {
    product.cases[decision.id] = decision
    return { commit: true, value: true }
  })
  if (seeded.status !== "ok") throw new Error("controlled case seed failed")
  const reviewed = await services.preparedReview(request, admission.context)
  if (reviewed.status !== "ok") throw new Error(`controlled review failed: ${reviewed.reason}`)
  review.digest = reviewed.value.reviewDigest
  return {
    admission, fault, review, decision, choice, change, request, services,
    reopen: async () => {
      await handle.store.dispose()
      handle.store = await openLocalStore(directory)
      handle.generation++
      admission.context = { ...binding, binding: { ...binding.binding, requestId: `request-${handle.generation}` }, lease: {} } as unknown as TrustedUiContext
      admission.request = new Request("https://example.test/portfolio")
      return makeServices()
    },
    dispose: async () => {
      await handle.store.dispose()
      await rm(directory, { recursive: true, force: true })
    },
  }
}

