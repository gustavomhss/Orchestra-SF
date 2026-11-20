import { requireApplicationAttempts } from "../application-attempt-fixture.ts"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "bun:test"
import { createDecisionCasePort } from "../../../product/decisions/case-port.ts"
import { createPreparedExecution } from "../../../product/decisions/apply.ts"
import { createSfPreparedApply } from "../../../product/decisions/prepared-apply.ts"
import { createDecisionPreparedReview } from "../../../product/decisions/prepared-review.ts"
import { receiptProofTransactionKey, receiptReviewBinding, type ReviewDigestFor } from "../../../product/decisions/receipt-review-binding.ts"
import { createDecisionMutations } from "../../../product/decisions/mutations.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { DecisionCase, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { PreparedCommand } from "../../../product/contracts/context.ts"
import type { PortfolioRequest, ScenarioOperation } from "../../../product/contracts/operations.ts"
import type { PreparedDomainMutation } from "../../../product/contracts/ports.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import type { Command } from "../../../runtime/contract.ts"
import { createPortfolioPort } from "../../../product/portfolio/port.ts"
import { portfolioEvaluationDigest, preparePortfolioChoice } from "../../../product/portfolio/handoff.ts"
import type { PortfolioHost } from "../../../product/portfolio/port.ts"

test("portfolio handoff prepares two WP11 changes and resumes after pre-dispatch unavailability without repeating a receipt", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-portfolio-handoff-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  try {
    const binding = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "principal", requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
    const horizon = { start: "2027-01-01", end: "2027-12-31" }
    const operations: ScenarioOperation[] = [
      { kind: "replace", targetRef: "planner:forecast-a", amount: 40, currency: "USD", period: horizon },
      { kind: "replace", targetRef: "procurement:contract-b", amount: 60, currency: "USD", period: horizon },
    ]
    const scenario: ScenarioResult = {
      id: "portfolio-preview",
      version: 1,
      components: [
        { id: "forecast-a", amount: 40, currency: "USD", period: horizon, sourceRefs: [], evidenceState: "confirmed" },
        { id: "contract-b", amount: 60, currency: "USD", period: horizon, sourceRefs: [], evidenceState: "confirmed" },
      ],
      currency: "USD",
      horizon,
      sourceRefs: [],
      unresolvedConditions: [],
      restrictions: [],
      comparisonStatus: "conditioned",
      knownSubtotal: 100,
      total: null,
      costCoverage: { basisId: "renewal", basisVersion: 1, alternativeId: "combined", alternativeVersion: 1, currency: "USD", horizon, issues: ["training:missing-category"], evaluatedSourceRefs: [], coverageState: "pending", entries: [], derivedMissingCategoryIds: ["training"] },
    }
    const choice = { id: "choice-portfolio", scenario: { baseRef: "base", operations, assumptions: [] }, result: scenario, evidenceRefs: [], costCoverage: scenario.costCoverage } as unknown as DecisionCase["choices"][number]
    const decision: DecisionCase = { id: "case-a", incarnation: "case-inc-a", version: 4, state: "chosen", objective: "Change two domains", horizon, currency: "USD", criteria: [{ id: "cost", description: "cost", required: true }], participants: ["principal"], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [choice], preparedChanges: [], receipts: [], ledger: [] }
    const state = createSfProductState({ persistence: store, createId: () => "product-state-inc", resolveTarget: async (_request, _snapshot, _namespace, targetRef) => ({ incarnation: targetRef === decision.id ? decision.incarnation : targetRef === "forecast-a" ? "target-inc-0" : "target-inc-1" }), authorize: async () => ({ principalRef: "principal", policyVersion: "policy", accessRevision: "access" }) })
    await state.transaction(new Request("https://example.test"), { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "seed-case", commandDigest: "a".repeat(64), targetRef: decision.id, targetIncarnation: decision.incarnation }, async (productState) => { productState.cases[decision.id] = decision; return { commit: true, value: true } })
    const evidence: BusinessContextService = { context: async ({ refs }) => refs.map((ref) => ({ ref, state: "fresh", accessRevision: "access", checkedAt: "2027-01-01" })), resolve: async () => { throw new Error("unused") }, recall: async () => [], emitFromLedger: async () => { throw new Error("unused") } }
    const admittedRequest = new Request("https://example.test")
    const host = { requestFor: () => admittedRequest, revalidate: async () => true }
    const cases = createDecisionCasePort({ state, host, creationTarget: { ref: "install:cases", incarnation: "install-inc" }, operationIdentity: () => "case-operation", authorizeCase: async () => true, verifyScenarioOperations: async () => true, evidence, createId: () => "case-event", now: () => "2027-01-01T00:00:00Z" })
    const domainCommands = operations.map((operation, index) => {
      const surface = index === 0 ? "planner" as const : "procurement" as const
      const id = index === 0 ? "forecast-a" : "contract-b"
      const target = { surface, type: index === 0 ? "forecast" : "contract", id, incarnation: `target-inc-${index}`, version: 4, fields: ["amount"], period: horizon, observedAt: "2027-01-01T00:00:00Z" }
      const targetEvidenceBase = { schema: "sf-evidence-v1" as const, refId: `target-ref-${index}`, installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "observed" as const, kind: "record" as const, target: { surface, recordType: target.type, recordId: id, incarnation: target.incarnation, version: target.version, fields: ["amount"], period: horizon, projectionDigest: String(index + 3).repeat(64) } }
      const targetEvidence: Extract<BusinessEvidenceRef, { kind: "record" }> = { ...targetEvidenceBase, refDigest: digestSfEvidenceRef(targetEvidenceBase) }
      const command: PreparedCommand = { id: `domain-command-${index}`, target, command: { page: surface, action: "edit", version: 4, values: { amount: operation.amount } } as unknown as Command, idempotencyKey: `domain-key-${index}`, commandDigest: String(index + 5).repeat(64), expectedVersion: 4, requiredAuthority: [surface], preview: {} as PreparedCommand["preview"] }
      return { command, preview: scenario, targetEvidence }
    })
    const planner = { compareForecast: async () => ({ status: "unavailable" as const, reason: "unused" }), simulateScenario: async () => ({ status: "unavailable" as const, reason: "unused" }), compareScenarios: async () => ({ status: "unavailable" as const, reason: "unused" }), evaluateSensitivity: async () => ({ status: "unavailable" as const, reason: "unused" }) }
    const authorizePrepare = (_operation: string, request: unknown, trusted: TrustedUiContext) => trusted.kind === "ui" && typeof request === "object" && !!request && "choiceId" in request && request.choiceId === choice.id
    const mutations = createDecisionMutations({ state, host, planner, sources: { resolveForecastSource: async () => ({ status: "unavailable", reason: "unused" }), resolveForecastCoverage: async () => ({ status: "unavailable", reason: "unused" }) }, authorizeCase: async () => true, authorizeMutation: async (operation, request, trusted) => operation === "prepare-changes" && authorizePrepare(operation, request, trusted as TrustedUiContext), verifyMutation: (_snapshot, operation, request, trusted) => operation === "prepare-changes" && authorizePrepare(operation, request, trusted as TrustedUiContext), operationIdentity: () => "mutation-operation", confirmChoice: async () => true, resolveQuestion: async () => ({ status: "unavailable", reason: "unused" }), resolveAnswer: async () => ({ status: "unavailable", reason: "unused" }), confirmAnswer: async () => false, resolveChoiceValues: async () => ({ status: "unavailable", reason: "unused" }), prepareDomainCommands: async () => ({ status: "ok", value: domainCommands }), createId: (() => { let id = 0; return () => `prepared-${++id}` })(), now: () => "2027-01-02T00:00:00Z" })
    const candidates = ["candidate-a", "candidate-b"]
    const portfolioRequest: PortfolioRequest = { scope: { horizon, currency: "USD" }, candidateRefs: candidates, operations: [], constraints: [], priorities: [], explorationLimit: 3 }
    const portfolioHost: PortfolioHost = {
      resolveCandidate: async (ref) => {
        const operation = operations[ref === candidates[0] ? 0 : 1]!
        return { status: "ok", value: { ref, caseRef: decision.id, operations: [operation], scenario: { baseRef: "base", operations: [operation], assumptions: [] } } }
      },
      evaluate: async () => ({ status: "ok", value: { scenario, costCoverageRefs: ["cost-coverage"], constraints: [] } }),
      sensitivity: async () => ({ status: "unavailable", reason: "unused" }),
      revalidateEvaluation: async () => true,
      revalidate: async () => true,
    }
    const portfolio = createPortfolioPort(portfolioHost)
    const domain = { procurementFails: true, plannerCalls: 0, procurementCalls: 0, receiptSequence: 0 }
    for (const [index, surface] of (["planner", "procurement"] as const).entries()) {
      await store.transaction(surface, async (snapshot) => {
        snapshot.data.wp13Amount = index === 0 ? 30 : 50
        snapshot.versions.wp13Amount = { version: 4, by: "principal" }
        return { commit: true, value: true }
      })
    }
    const domainValue = (surface: "planner" | "procurement") => store.transaction(surface, async (snapshot) => ({ commit: false, value: { amount: snapshot.data.wp13Amount as number, version: snapshot.versions.wp13Amount?.version } }))
    const amounts = async () => Promise.all((["planner", "procurement"] as const).map(async (surface) => (await domainValue(surface)).amount))
    const comparison = await portfolio.evaluate(portfolioRequest, binding)
    expect(comparison.status).toBe("ok")
    if (comparison.status !== "ok") return
    const combinationId = digestSfValue({ candidates, operations })
    const prepared = await preparePortfolioChoice({ portfolio, host: portfolioHost, cases, decisions: mutations, request: portfolioRequest, selectedCandidateRefs: candidates, combinationId, expectedEvaluationDigest: portfolioEvaluationDigest(portfolioRequest, comparison.value), caseRef: { id: decision.id, incarnation: decision.incarnation, version: decision.version }, choiceId: choice.id }, binding)
    expect(prepared.status).toBe("ok")
    const saved = await state.read(new Request("https://example.test"), "cases", (productState) => productState.cases[decision.id])
    expect(saved.status).toBe("ok")
    if (saved.status !== "ok" || !saved.value) return
    expect(saved.value.preparedChanges).toHaveLength(2)
    expect(saved.value.preparedChanges.map((item) => [item.target.surface, item.expectedVersion, item.state])).toEqual([["planner", 4, "planned"], ["procurement", 4, "planned"]])
    expect(await amounts()).toEqual([30, 50])
    const review = createDecisionPreparedReview({ state, cases, host, reviewDomain: async (command) => {
      if (command.target.surface !== "planner" && command.target.surface !== "procurement") return { status: "unavailable", reason: "domain-unavailable" }
      const current = await domainValue(command.target.surface)
      const source = domainCommands.find((item) => item.command.id === command.id)?.targetEvidence
      if (!current || current.version !== command.expectedVersion || !source) return { status: "stale", reason: "domain-review-changed" }
      return { status: "ok", value: { fields: [{ field: "amount", before: current.amount, after: command.command.values.amount as number }], source, originalTargetDigest: digestSfValue(command.target) } }
    } })
    // A private test admission retains exactly the review produced before the human apply.
    // This exercises the WP11 review and receipt consumers, not native/UI admission.
    const admittedReviews = new Map<string, string>()
    const reviewDigestFor: ReviewDigestFor = (trusted, request, change) => trusted === binding && request.caseRef.id === decision.id && request.caseRef.incarnation === decision.incarnation && request.choiceId === choice.id && request.changeId === change.id ? admittedReviews.get(change.id) : undefined
    for (const change of saved.value.preparedChanges) {
      const reviewed = await review({ caseRef: { id: decision.id, incarnation: decision.incarnation, version: saved.value.version }, changeId: change.id, choiceId: choice.id }, binding)
      expect(reviewed.status).toBe("ok")
      if (reviewed.status !== "ok") throw new Error(`prepared review unavailable: ${reviewed.reason}`)
      admittedReviews.set(change.id, reviewed.value.reviewDigest)
    }
    const apply = createSfPreparedApply({
      state, host,
      authorizeCase: async (value, trusted) => trusted === binding && value.id === decision.id && value.incarnation === decision.incarnation && value.participants.includes(trusted.binding.principalRef),
      authorizeLookup: async (request, trusted) => trusted === binding && domainCommands.some((item) => item.command.target.surface === request.surface && item.command.target.id === request.targetRef && item.command.target.incarnation === request.targetIncarnation && item.command.idempotencyKey === request.idempotencyKey && item.command.commandDigest === request.commandDigest),
      authorizeReceipt: async (receipt, request, trusted) => trusted === binding && receipt.principalRef === trusted.binding.principalRef && receipt.surface === request.surface && receipt.targetIncarnation === request.targetIncarnation && receipt.idempotencyKey === request.idempotencyKey && receipt.commandDigest === request.commandDigest,
      confirmHuman: async (request, change, trusted) => !!reviewDigestFor(trusted, request, change),
      resolveActor: (_snapshot, trusted) => trusted === binding ? { id: trusted.binding.principalRef, roles: ["finance", "buyer"], canWrite: true } : undefined,
      resolveMutation: (_snapshot, change): PreparedDomainMutation | undefined => change.target.surface === "procurement" && domain.procurementFails ? undefined : ({
        surface: change.target.surface, targetIncarnation: change.target.incarnation,
        idempotencyKey: change.idempotencyKey, commandDigest: change.operation.commandDigest, expectedVersion: change.expectedVersion,
        execute: (snapshot): ReturnType<PreparedDomainMutation["execute"]> => {
          if (snapshot.versions.wp13Amount?.version !== change.expectedVersion) return { commit: false, value: { status: "conflict" } }
          if (change.target.surface === "planner") domain.plannerCalls++
          if (change.target.surface === "procurement") domain.procurementCalls++
          snapshot.data.wp13Amount = change.operation.command.values.amount
          snapshot.versions.wp13Amount = { version: change.expectedVersion + 1, by: "principal" }
          return { commit: true, value: { amount: change.operation.command.values.amount as number } }
        },
      }),
      verifyGrant: (_snapshot, request, change, actor, trusted) => actor.id === trusted.binding.principalRef && !!reviewDigestFor(trusted, request, change),
      receiptVersion: (snapshot) => snapshot.versions.wp13Amount?.version,
      environment: () => ({ at: "2027-01-03T00:00:00Z", id: () => "unused", directory: [] }),
      createId: () => `receipt-${++domain.receiptSequence}`, now: () => "2027-01-03T00:00:00Z", reviewDigestFor,
    })
    const execution = createPreparedExecution({ state, host, apply, reviewDigestFor, revalidateProducer: async (request, trusted) => {
      const change = saved.value!.preparedChanges.find((item) => item.id === request.changeId)
      // This is a refusal before durable reservation. A failure after dispatch
      // keeps the receipt-required contract covered by receipt-scope-boundary.
      if (change?.target.surface === "procurement" && domain.procurementFails) return { status: "unavailable", reason: "supplier-system-unavailable" }
      return review(request, trusted)
    }, authorizeCase: async () => true, authorizeApplication: async (request, change, trusted) => trusted.kind === "ui" && request.choiceId === choice.id && change.caseId === decision.id && ["planner:forecast-a", "procurement:contract-b"].includes(`${change.target.surface}:${change.target.id}`), confirmApplication: async () => true, operationIdentity: () => "apply-operation", classifyReceipt: async (receipt) => {
      const evidenceBase = { schema: "sf-evidence-v1" as const, refId: `receipt-ref-${receipt.id}`, installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "observed" as const, kind: "receipt" as const, target: { surface: receipt.surface, receiptId: receipt.id, idempotencyKey: receipt.idempotencyKey, targetIncarnation: receipt.targetIncarnation, commandDigest: receipt.commandDigest, version: receipt.version } }
      return { state: "applied", evidence: { ...evidenceBase, refDigest: digestSfEvidenceRef(evidenceBase) } }
    } })
    const firstChange = saved.value.preparedChanges[0]!
    const secondChange = saved.value.preparedChanges[1]!
    const firstRequest = { caseRef: { id: decision.id, incarnation: decision.incarnation, version: saved.value.version }, changeId: firstChange.id, choiceId: choice.id }
    const firstExecution = await execution(firstRequest, binding)
    expect(firstExecution.status).toBe("ok")
    const afterFirst = await cases.read({ caseRef: `case:${decision.id}:${decision.incarnation}` }, binding)
    expect(afterFirst.status).toBe("ok")
    if (afterFirst.status !== "ok") return
    expect((await execution({ caseRef: { id: decision.id, incarnation: decision.incarnation, version: afterFirst.value.case.version }, changeId: secondChange.id, choiceId: choice.id }, binding)).status).toBe("unavailable")
    const partial = await cases.read({ caseRef: `case:${decision.id}:${decision.incarnation}` }, binding)
    expect(partial.status).toBe("ok")
    if (partial.status !== "ok") return
    expect(partial.value.case.state).toBe("partially-applied")
    expect(await amounts()).toEqual([40, 50])
    const beforeDispatch = await state.read(admittedRequest, "cases", (productState, authority) => requireApplicationAttempts(productState, { caseRef: { id: decision.id, incarnation: decision.incarnation, version: partial.value.case.version }, changeId: secondChange.id, choiceId: choice.id }, authority))
    expect(beforeDispatch.status).toBe("ok")
    expect(beforeDispatch.status === "ok" && beforeDispatch.value).toEqual([])
    domain.procurementFails = false
    expect(await execution({ caseRef: { id: decision.id, incarnation: decision.incarnation, version: partial.value.case.version }, changeId: firstChange.id, choiceId: choice.id }, binding)).toEqual({ status: "conflict", reason: "original-intent-mismatch" })
    expect(await execution(firstRequest, binding)).toEqual(firstExecution)
    const beforeResume = await cases.read({ caseRef: `case:${decision.id}:${decision.incarnation}` }, binding)
    if (beforeResume.status !== "ok") throw new Error("case unavailable after first retry")
    expect((await execution({ caseRef: { id: decision.id, incarnation: decision.incarnation, version: beforeResume.value.case.version }, changeId: secondChange.id, choiceId: choice.id }, binding)).status).toBe("ok")
    expect(domain.plannerCalls).toBe(1)
    expect(await amounts()).toEqual([40, 60])
    const completed = await cases.read({ caseRef: `case:${decision.id}:${decision.incarnation}` }, binding)
    expect(completed.status).toBe("ok")
    if (completed.status === "ok") expect(completed.value.case.state).toBe("applied")
    const durable = await state.read(admittedRequest, "receipts", (productState, authority) => ({
      receipts: Object.values(productState.receipts),
      proofs: saved.value!.preparedChanges.map((change) => productState.transactions[receiptProofTransactionKey("principal", change.target.id, change.idempotencyKey)]),
      attempts: saved.value!.preparedChanges.map((change) => requireApplicationAttempts(productState, { caseRef: { id: decision.id, incarnation: decision.incarnation, version: saved.value!.version }, changeId: change.id, choiceId: choice.id }, authority)),
      choice: productState.cases[decision.id]?.choices[0],
    }))
    expect(durable.status).toBe("ok")
    if (durable.status !== "ok") throw new Error("canonical receipt witness unavailable")
    expect(domain.procurementCalls).toBe(1)
    expect(durable.value.receipts).toHaveLength(2)
    expect(durable.value.receipts.map((receipt) => [receipt.surface, receipt.version, receipt.result.ok])).toEqual([["planner", 5, true], ["procurement", 5, true]])
    expect(durable.value.proofs.map((proof) => proof?.scopeDigest)).toEqual(saved.value.preparedChanges.map((change) => digestSfValue({ namespaces: ["cases", "receipts"], domainSurface: change.target.surface })))
    expect(durable.value.proofs.map((proof) => proof?.commandDigest)).toEqual(saved.value.preparedChanges.map((change) => receiptReviewBinding(change, admittedReviews.get(change.id)!)))
    expect(durable.value.proofs.map((proof) => proof?.value)).toEqual(durable.value.receipts)
    expect(durable.value.attempts.map((attempts) => attempts.length)).toEqual([1, 1])
    expect(durable.value.choice).toEqual(choice)
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})

