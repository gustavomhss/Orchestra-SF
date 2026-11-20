import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "bun:test"
import { createDecisionCasePort } from "../../../product/decisions/case-port.ts"
import { createPreparedExecution } from "../../../product/decisions/apply.ts"
import { createSfPreparedApply } from "../../../product/decisions/prepared-apply.ts"
import { createDecisionPreparedReview } from "../../../product/decisions/prepared-review.ts"
import type { ReviewDigestFor } from "../../../product/decisions/receipt-review-binding.ts"
import { createDecisionMutations } from "../../../product/decisions/mutations.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { DecisionCase, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { PreparedCommand } from "../../../product/contracts/context.ts"
import type { PortfolioRequest, ScenarioOperation } from "../../../product/contracts/operations.ts"
import type { PreparedApplyPort, PreparedDomainMutation } from "../../../product/contracts/ports.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import type { Command } from "../../../runtime/contract.ts"
import { createPortfolioPort } from "../../../product/portfolio/port.ts"
import { portfolioEvaluationDigest, preparePortfolioChoice } from "../../../product/portfolio/handoff.ts"
import type { PortfolioHost } from "../../../product/portfolio/port.ts"

test("persisted producer: portfolio handoff prepares two WP11 changes and resumes a partial application without repeating a receipt", async () => {
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
    const state = createSfProductState({ persistence: store, createId: () => "product-state-inc", resolveTarget: async (_request, _snapshot, _namespace, targetRef) => targetRef === decision.id ? { incarnation: decision.incarnation } : targetRef === "forecast-a" ? { incarnation: "target-inc-0" } : targetRef === "contract-b" ? { incarnation: "target-inc-1" } : undefined, authorize: async () => ({ principalRef: "principal", policyVersion: "policy", accessRevision: "access" }) })
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
      await store.transaction(surface, async (snapshot) => { snapshot.data.wp13Amount = index === 0 ? 30 : 50; snapshot.versions.wp13Amount = { version: 4, by: "principal" }; return { commit: true, value: true } })
    }
    const amounts = () => Promise.all((["planner", "procurement"] as const).map((surface) => store.transaction(surface, async (snapshot) => ({ commit: false, value: snapshot.data.wp13Amount }))))
    const durableCase = async () => {
      const current = await state.read(admittedRequest, "cases", (productState) => productState.cases[decision.id])
      expect(current.status).toBe("ok")
      if (current.status !== "ok" || !current.value) throw new Error("Durable case unavailable")
      return current.value
    }
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
      const observed = await store.transaction(command.target.surface, async (snapshot) => ({ commit: false, value: { amount: snapshot.data.wp13Amount, version: snapshot.versions.wp13Amount?.version } }))
      const source = domainCommands.find((item) => item.command.id === command.id)?.targetEvidence
      if (!source || observed.version !== command.expectedVersion || typeof observed.amount !== "number") return { status: "stale", reason: "domain-review-changed" }
      return { status: "ok", value: { fields: [{ field: "amount", before: observed.amount, after: command.command.values.amount as number }], source, originalTargetDigest: digestSfValue(command.target) } }
    } })
    // Fixture admission retains an actual WP11 review; the private runtime/UI admission remains separate.
    const reviews = new Map<string, string>()
    const reviewDigestFor: ReviewDigestFor = (context, request, change) => context === binding && request.caseRef.id === decision.id && request.caseRef.incarnation === decision.incarnation && request.choiceId === choice.id && change.caseId === decision.id ? reviews.get(change.id) : undefined
    for (const change of saved.value.preparedChanges) {
      const reviewed = await review({ caseRef: { id: decision.id, incarnation: decision.incarnation, version: saved.value.version }, changeId: change.id, choiceId: choice.id }, binding)
      if (reviewed.status !== "ok") throw new Error(`prepared review unavailable: ${reviewed.reason}`)
      reviews.set(change.id, reviewed.value.reviewDigest)
    }
    const apply = createSfPreparedApply({
      state, host, authorizeCase: async () => true,
      authorizeLookup: async (request) => ["forecast-a", "contract-b"].includes(request.targetRef),
      authorizeReceipt: async (receipt, request) => receipt.targetIncarnation === request.targetIncarnation && receipt.commandDigest === request.commandDigest,
      confirmHuman: async (request, change, context) => !!reviewDigestFor(context, request, change),
      resolveActor: () => ({ id: "principal", roles: ["finance", "buyer"], canWrite: true }),
      resolveMutation: (_snapshot, change) => ({
        surface: change.target.surface, targetIncarnation: change.target.incarnation, idempotencyKey: change.idempotencyKey, commandDigest: change.operation.commandDigest, expectedVersion: change.expectedVersion,
        execute: (snapshot): ReturnType<PreparedDomainMutation["execute"]> => {
          if (snapshot.versions.wp13Amount?.version !== change.expectedVersion) return { commit: false, value: { status: "conflict" } }
          if (change.target.surface === "planner") domain.plannerCalls++
          if (change.target.surface === "procurement") domain.procurementCalls++
          snapshot.data.wp13Amount = change.operation.command.values.amount
          snapshot.versions.wp13Amount = { version: change.expectedVersion + 1, by: "principal" }
          return { commit: true, value: { amount: change.operation.command.values.amount as number } }
        },
      }),
      verifyGrant: (_snapshot, request, change, _actor, context) => !!reviewDigestFor(context, request, change),
      receiptVersion: (snapshot) => snapshot.versions.wp13Amount?.version,
      environment: () => ({ at: "2027-01-03T00:00:00Z", id: () => "unused", directory: [] }),
      createId: () => `receipt-${++domain.receiptSequence}`, now: () => "2027-01-03T00:00:00Z", reviewDigestFor,
    })
    // Lose only the response from the real producer, after its durable receipt.
    // An absent receipt after dispatch would stay indeterminate and cannot retry.
    const interruptedApply: PreparedApplyPort = { ...apply, executePrepared: async (request, context) => {
      const applied = await apply.executePrepared(request, context)
      if (applied.status === "ok") throw new Error("Injected loss after durable domain receipt")
      return applied
    } }
    const execution = createPreparedExecution({ state, host, apply: interruptedApply, reviewDigestFor, revalidateProducer: async (request, context) => {
      // Temporary producer unavailability is observed before reserving/dispatching.
      if (request.changeId === secondChange.id && domain.procurementFails) return { status: "unavailable", reason: "procurement-producer-unavailable" }
      return review(request, context)
    }, authorizeCase: async () => true, authorizeApplication: async (request, change, trusted) => trusted.kind === "ui" && request.choiceId === choice.id && change.caseId === decision.id && ["planner:forecast-a", "procurement:contract-b"].includes(`${change.target.surface}:${change.target.id}`), confirmApplication: async () => true, operationIdentity: () => "apply-operation", classifyReceipt: async (receipt) => {
      const evidenceBase = { schema: "sf-evidence-v1" as const, refId: `receipt-ref-${receipt.id}`, installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "observed" as const, kind: "receipt" as const, target: { surface: receipt.surface, receiptId: receipt.id, idempotencyKey: receipt.idempotencyKey, targetIncarnation: receipt.targetIncarnation, commandDigest: receipt.commandDigest, version: receipt.version } }
      return { state: "applied", evidence: { ...evidenceBase, refDigest: digestSfEvidenceRef(evidenceBase) } }
    } })
    const firstChange = saved.value.preparedChanges[0]!
    const secondChange = saved.value.preparedChanges[1]!
    const firstRequest = { caseRef: { id: decision.id, incarnation: decision.incarnation, version: saved.value.version }, changeId: firstChange.id, choiceId: choice.id }
    // A lost response follows the real atomic domain/receipt commit. It leaves
    // C08 unreconciled; recovery must use that receipt without another dispatch.
    expect(await execution(firstRequest, binding)).toEqual({ status: "unavailable", reason: "domain-result-unknown" })
    expect(await amounts()).toEqual([40, 50])
    expect({ planner: domain.plannerCalls, procurement: domain.procurementCalls }).toEqual({ planner: 1, procurement: 0 })
    const committedReceipt = await state.read(new Request("https://example.test"), "receipts", (productState) => Object.values(productState.receipts))
    expect(committedReceipt.status).toBe("ok")
    if (committedReceipt.status !== "ok") throw new Error("Committed Planner receipt unavailable")
    expect(committedReceipt.value).toHaveLength(1)
    const firstReceipt = committedReceipt.value[0]!
    expect(firstReceipt.result.ok).toBe(true)
    const unreconciled = await cases.read({ caseRef: `case:${decision.id}:${decision.incarnation}` }, binding)
    expect(unreconciled.status).toBe("ok")
    if (unreconciled.status !== "ok") throw new Error("Case unavailable before Planner reconciliation")
    expect(unreconciled.value.case.receipts).toHaveLength(0)
    expect(unreconciled.value.case.preparedChanges[0]?.state).toBe("planned")
    const firstExecution = await execution(firstRequest, binding)
    expect(firstExecution).toEqual({ status: "ok", value: firstReceipt })
    const afterFirst = await cases.read({ caseRef: `case:${decision.id}:${decision.incarnation}` }, binding)
    expect(afterFirst.status).toBe("ok")
    if (afterFirst.status !== "ok") throw new Error("Case unavailable after Planner reconciliation")
    expect((await durableCase()).receipts).toEqual([firstReceipt])
    expect(afterFirst.value.case.preparedChanges.map((change) => change.state)).toEqual(["applied", "planned"])
    expect(await execution({ caseRef: { id: decision.id, incarnation: decision.incarnation, version: afterFirst.value.case.version }, changeId: secondChange.id, choiceId: choice.id }, binding)).toEqual({ status: "unavailable", reason: "procurement-producer-unavailable" })
    const partial = await cases.read({ caseRef: `case:${decision.id}:${decision.incarnation}` }, binding)
    expect(partial.status).toBe("ok")
    if (partial.status !== "ok") throw new Error("Partially applied case unavailable")
    expect(partial.value.case).toEqual(afterFirst.value.case)
    expect(partial.value.case.state).toBe("partially-applied")
    expect({ planner: domain.plannerCalls, procurement: domain.procurementCalls, receipts: domain.receiptSequence }).toEqual({ planner: 1, procurement: 0, receipts: 1 })
    expect(await amounts()).toEqual([40, 50])
    domain.procurementFails = false
    expect(await execution({ caseRef: { id: decision.id, incarnation: decision.incarnation, version: partial.value.case.version }, changeId: firstChange.id, choiceId: choice.id }, binding)).toEqual({ status: "conflict", reason: "original-intent-mismatch" })
    expect(await execution(firstRequest, binding)).toEqual(firstExecution)
    const beforeResume = await cases.read({ caseRef: `case:${decision.id}:${decision.incarnation}` }, binding)
    if (beforeResume.status !== "ok") throw new Error("Case unavailable after first retry")
    expect(beforeResume.value.case).toEqual(partial.value.case)
    const secondRequest = { caseRef: { id: decision.id, incarnation: decision.incarnation, version: beforeResume.value.case.version }, changeId: secondChange.id, choiceId: choice.id }
    expect(await execution(secondRequest, binding)).toEqual({ status: "unavailable", reason: "domain-result-unknown" })
    expect(await amounts()).toEqual([40, 60])
    const secondCommitted = await state.read(new Request("https://example.test"), "receipts", (productState) => Object.values(productState.receipts))
    expect(secondCommitted.status).toBe("ok")
    if (secondCommitted.status !== "ok") throw new Error("Committed Procurement receipt unavailable")
    expect(secondCommitted.value).toHaveLength(2)
    const secondReceipt = secondCommitted.value.find((receipt) => receipt.idempotencyKey === secondChange.idempotencyKey)
    if (!secondReceipt) throw new Error("Original Procurement receipt missing")
    expect(secondReceipt.result.ok).toBe(true)
    expect(secondCommitted.value).toEqual([firstReceipt, secondReceipt])
    const beforeSecondReconciliation = await cases.read({ caseRef: `case:${decision.id}:${decision.incarnation}` }, binding)
    if (beforeSecondReconciliation.status !== "ok") throw new Error("Case unavailable before Procurement reconciliation")
    expect(beforeSecondReconciliation.value.case).toEqual(beforeResume.value.case)
    const secondExecution = await execution(secondRequest, binding)
    expect(secondExecution).toEqual({ status: "ok", value: secondReceipt })
    const completed = await cases.read({ caseRef: `case:${decision.id}:${decision.incarnation}` }, binding)
    expect(completed.status).toBe("ok")
    if (completed.status !== "ok") throw new Error("Completed case unavailable")
    expect(completed.value.case.state).toBe("applied")
    const completedState = await durableCase()
    expect(completedState.receipts).toEqual([firstReceipt, secondReceipt])
    expect(completedState.preparedChanges.map((change) => ({ state: change.state, receipt: change.receipt }))).toEqual([{ state: "applied", receipt: firstReceipt }, { state: "applied", receipt: secondReceipt }])
    expect(await execution(firstRequest, binding)).toEqual(firstExecution)
    expect(await execution(secondRequest, binding)).toEqual(secondExecution)
    const replayed = await cases.read({ caseRef: `case:${decision.id}:${decision.incarnation}` }, binding)
    if (replayed.status !== "ok") throw new Error("Replayed case unavailable")
    expect(replayed.value.case).toEqual(completed.value.case)
    expect(await durableCase()).toEqual(completedState)
    expect({ planner: domain.plannerCalls, procurement: domain.procurementCalls, receipts: domain.receiptSequence }).toEqual({ planner: 1, procurement: 1, receipts: 2 })
    expect(await amounts()).toEqual([40, 60])
    expect(await Promise.all((["planner", "procurement"] as const).map((surface) => store.transaction(surface, async (snapshot) => ({ commit: false, value: snapshot.versions.wp13Amount }))))).toEqual([{ version: 5, by: "principal" }, { version: 5, by: "principal" }])
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
