import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "bun:test"
import { createDecisionCasePort } from "../../../product/decisions/case-port.ts"
import { createPreparedExecution } from "../../../product/decisions/apply.ts"
import { applicationAttempts } from "../../../product/decisions/application-attempt.ts"
import { createSfPreparedApply } from "../../../product/decisions/prepared-apply.ts"
import { proposalReviewDigest, receiptProofTransactionKey, receiptReviewBinding } from "../../../product/decisions/receipt-review-binding.ts"
import { createDecisionMutations } from "../../../product/decisions/mutations.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { CostCoverageBasis, DecisionCase, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { DomainProjection, PreparedCommand, SourceRef } from "../../../product/contracts/context.ts"
import type { PortfolioRequest, ScenarioOperation } from "../../../product/contracts/operations.ts"
import type { DomainPortHost, PlannerSourceHost, PreparedDomainMutation } from "../../../product/contracts/ports.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { plannerKnownSubtotal } from "../../../src/planner-accounts.ts"
import { createPlannerPort } from "../../../product/planner/port.ts"
import { createDecisionCandidateResolver, portfolioCandidateRef } from "../../../product/portfolio/candidates.ts"
import { createPortfolioPort } from "../../../product/portfolio/port.ts"
import { portfolioEvaluationDigest, preparePortfolioChoice } from "../../../product/portfolio/handoff.ts"
import type { PortfolioHost } from "../../../product/portfolio/port.ts"

test("portfolio handoff retains C08 choice and resumes after pre-dispatch producer unavailability without repeating a receipt", async () => {
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
    const targets: SourceRef[] = (["planner", "procurement"] as const).map((surface, index) => ({ surface, type: index === 0 ? "forecast" : "contract", id: index === 0 ? "forecast-a" : "contract-b", incarnation: `target-inc-${index}`, version: 4, fields: ["amount"], period: horizon, observedAt: "2027-01-01T00:00:00Z" }))
    const sourceRefs: Extract<BusinessEvidenceRef, { kind: "record" }>[] = targets.map((target, index) => {
      const ref = { schema: "sf-evidence-v1" as const, refId: `target-ref-${index}`, installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "observed" as const, kind: "record" as const, target: { surface: target.surface, recordType: target.type, recordId: target.id, incarnation: target.incarnation, version: target.version, fields: target.fields, period: horizon, projectionDigest: digestSfValue({ target, amount: index === 0 ? 30 : 50 }) } }
      return { ...ref, refDigest: digestSfEvidenceRef(ref) }
    })
    const basis: CostCoverageBasis = { id: "renewal", version: 1, decisionType: "renewal-transition-v1", categoryIds: RENEWAL_TRANSITION_CATEGORIES, additionalCategoryIds: [], sourceRefs }
    // Only orchestration is under test: controlled domain amounts remain conditioned,
    // and neither the missing categories nor the absent cost rule become approvals.
    const scenarioFor = (alternativeId: string, amounts: readonly number[]): ScenarioResult => ({
      id: `controlled-${alternativeId}`, version: 1,
      components: targets.map((target, index) => ({ id: target.id, amount: amounts[index]!, currency: "USD", period: horizon, sourceRefs: [target], evidenceState: alternativeId === "baseline" ? "confirmed" : "hypothetical" })),
      currency: "USD", horizon, sourceRefs, unresolvedConditions: ["cost-categories-pending"], restrictions: alternativeId === "baseline" ? [] : ["preview-not-applied"],
      comparisonStatus: "conditioned", knownSubtotal: plannerKnownSubtotal(amounts), total: null,
      costCoverage: { basisId: basis.id, basisVersion: basis.version, alternativeId, alternativeVersion: 1, currency: "USD", horizon, issues: ["training:missing-category"], evaluatedSourceRefs: sourceRefs, coverageState: "pending", entries: [{ status: "included", categoryId: "service", componentRefs: targets.map((target) => target.id), evidenceRefs: sourceRefs, scopeNote: "Controlled two-domain service amounts" }], derivedMissingCategoryIds: RENEWAL_TRANSITION_CATEGORIES.filter((category) => category !== "service") },
    })
    const scenario = scenarioFor("combined", [40, 60])
    const decision: DecisionCase = { id: "case-a", incarnation: "case-inc-a", version: 4, state: "comparing", objective: "Change two domains", horizon, currency: "USD", criteria: [{ id: "cost", description: "cost", required: true }], participants: ["principal"], sourceRefs, alternatives: [{ id: "baseline", version: 1, title: "Current domains", scenario: { baseRef: sourceRefs[0]!.refId, operations: [], assumptions: [] }, result: scenarioFor("baseline", [30, 50]) }, { id: "combined", version: 1, title: "Two reviewed changes", scenario: { baseRef: sourceRefs[0]!.refId, operations, assumptions: [] }, result: scenario }], costCoverageBases: [basis], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const originalCaseRef = { id: decision.id, incarnation: decision.incarnation, version: decision.version }
    const caseSelector = `case:${decision.id}:${decision.incarnation}`
    const state = createSfProductState({ persistence: store, createId: () => "product-state-inc", resolveTarget: async (_request, _snapshot, _namespace, targetRef) => targetRef === decision.id ? { incarnation: decision.incarnation } : targetRef === "forecast-a" ? { incarnation: "target-inc-0" } : targetRef === "contract-b" ? { incarnation: "target-inc-1" } : undefined, authorize: async () => ({ principalRef: "principal", policyVersion: "policy", accessRevision: "access" }) })
    await state.transaction(new Request("https://example.test"), { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "seed-case", commandDigest: "a".repeat(64), targetRef: decision.id, targetIncarnation: decision.incarnation }, async (productState) => { productState.cases[decision.id] = decision; return { commit: true, value: true } })
    const evidence: BusinessContextService = { context: async ({ refs }) => refs.map((ref) => ({ ref, state: "fresh", accessRevision: "access", checkedAt: "2027-01-01" })), resolve: async () => { throw new Error("unused") }, recall: async () => [], emitFromLedger: async () => { throw new Error("unused") } }
    const admittedRequest = new Request("https://example.test")
    const host: DomainPortHost = { persistence: store, authenticate: async () => ({ id: "principal", roles: [{ surface: "planner", role: "finance" }, { surface: "procurement", role: "buyer" }], canWrite: true }), environment: async () => ({ at: "2027-01-01T00:00:00Z", id: () => "unused", directory: [] }), requestFor: () => admittedRequest, revalidate: async (context) => context.kind === "ui" && context.binding.principalRef === "principal" && context.binding.accessRevision === "access" }
    const cases = createDecisionCasePort({ state, host, creationTarget: { ref: "install:cases", incarnation: "install-inc" }, operationIdentity: () => "case-operation", authorizeCase: async () => true, verifyScenarioOperations: async () => true, evidence, createId: () => "case-event", now: () => "2027-01-01T00:00:00Z" })
    const domain = { procurementFails: true, plannerCalls: 0, procurementCalls: 0, receiptSequence: 0 }
    for (const [index, surface] of (["planner", "procurement"] as const).entries()) {
      await store.transaction(surface, async (snapshot) => { snapshot.data.wp13Amount = index === 0 ? 30 : 50; snapshot.versions.wp13Amount = { version: 4, by: "principal" }; return { commit: true, value: true } })
    }
    const amounts = () => Promise.all((["planner", "procurement"] as const).map((surface) => store.transaction(surface, async (snapshot) => ({ commit: false, value: snapshot.data.wp13Amount }))))
    const results = createSfDecisionResultStore({ state, host, authorizeCase: async (value, context) => value.id === decision.id && value.incarnation === decision.incarnation && value.participants.includes(context.binding.principalRef), verifySources: async (_value, refs) => refs.length === sourceRefs.length && refs.every((ref) => sourceRefs.some((source) => digestSfValue(source) === digestSfValue(ref))), createId: (() => { let id = 0; return () => `handoff-result-${++id}` })(), now: () => "2027-01-01T00:00:00Z" })
    const scenarioResults: string[] = []
    for (const alternative of decision.alternatives) {
      const stored = await results.write({ kind: "scenario", result: alternative.result, caseRef: originalCaseRef, requestDigest: digestSfValue(alternative.scenario), sourceRefs, idempotencyKey: `scenario-${alternative.id}` }, binding)
      if (stored.status !== "ok") throw new Error(`C08 scenario write: ${JSON.stringify(stored)}`)
      scenarioResults.push(stored.value.resultRef)
    }
    const project = (result: ScenarioResult): DomainProjection => ({ context: { installationId: "install", projectId: "project", principalRef: "principal", accessRevision: "access", policyVersion: "policy", surface: "planner", period: horizon, currency: "USD", sourceRefs: targets, capabilities: [] }, version: result.version, engineVersion: "wp13-controlled-domain-v1", components: result.components, values: [], missing: [{ field: "training", reason: "missing" }] })
    const sources: PlannerSourceHost = {
      resolveForecastSource: async (reference, context) => {
        const version = await store.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot.versions.wp13Amount?.version }))
        return reference === sourceRefs[0]!.refId && version === targets[0]!.version && await host.revalidate(context) ? { status: "ok", value: { versionId: targets[0]!.id, evidence: sourceRefs[0]! } } : { status: "stale", reason: "controlled-source-changed" }
      },
      resolveForecastCoverage: async (reference, context) => {
        const current = await state.read(new Request("https://example.test"), "cases", (productState) => productState.cases[decision.id])
        const alternative = current.status === "ok" && current.value?.alternatives.find((item) => reference === `coverage:${item.id}`)
        return alternative && await host.revalidate(context) ? { status: "ok", value: { coverageRef: reference, basis, assessment: alternative.result.costCoverage } } : { status: "unavailable", reason: "coverage-unavailable" }
      },
    }
    const planner = createPlannerPort({ host, sources, scenarios: { resolve: async (reference, context) => {
      const stored = await results.readHistoricalScenario({ resultRef: reference }, context)
      if (stored.status !== "ok") return stored
      if (stored.value.kind !== "scenario") return { status: "unavailable", reason: "scenario-unavailable" }
      return { status: "ok", value: { result: stored.value.result, coverageRef: `coverage:${stored.value.result.costCoverage.alternativeId}`, basis, projection: project(stored.value.result), source: sourceRefs[0]! } }
    } } })
    const comparisonRequest = { scenarioRefs: scenarioResults, criteria: ["cost"] }
    const canonicalComparison = await planner.compareScenarios(comparisonRequest, binding)
    if (canonicalComparison.status !== "ok") throw new Error(`Canonical comparison: ${JSON.stringify(canonicalComparison)}`)
    expect(canonicalComparison.value).toMatchObject({ comparisonStatus: "conditioned", knownDifference: 20, completeDifference: null, criterionResults: [{ criterionId: "cost", state: "unknown", reason: "criterion-rule-unavailable" }] })
    const comparisonRecord = await results.write({ kind: "comparison", result: canonicalComparison.value, caseRef: originalCaseRef, requestDigest: digestSfValue(comparisonRequest), sourceRefs, idempotencyKey: "comparison-before-choice" }, binding)
    if (comparisonRecord.status !== "ok") throw new Error(`C08 comparison write: ${JSON.stringify(comparisonRecord)}`)
    const domainCommands = operations.map((operation, index) => {
      const target = targets[index]!
      const command: PreparedCommand = { id: `domain-command-${index}`, target, command: { page: target.surface, action: "edit", version: 4, values: { amount: operation.amount } }, idempotencyKey: `domain-key-${index}`, commandDigest: digestSfValue({ target, operation }), expectedVersion: 4, requiredAuthority: [target.surface], preview: project(scenario) }
      return { command, preview: scenario, targetEvidence: sourceRefs[index]! }
    })
    const confirmations = { choice: false, prepare: false, apply: false, choiceId: "" }
    const choiceRequest = { caseRef: originalCaseRef, alternativeId: "combined", alternativeVersion: 1, comparison: comparisonRequest, criteria: ["cost"], reason: "I reviewed the two changes; coverage and the cost criterion remain unresolved." }
    const authorizeMutation: Parameters<typeof createDecisionMutations>[0]["authorizeMutation"] = async (operation, request, context) => context.kind === "ui" && (operation === "record-choice" ? digestSfValue(request) === digestSfValue(choiceRequest) : operation === "prepare-changes" && confirmations.prepare && !!request && typeof request === "object" && "choiceId" in request && request.choiceId === confirmations.choiceId)
    const mutations = createDecisionMutations({ state, host, planner, sources, authorizeCase: async () => true, authorizeMutation, verifyMutation: (_snapshot, operation, request) => operation === "record-choice" ? confirmations.choice && digestSfValue(request) === digestSfValue(choiceRequest) : operation === "prepare-changes" && confirmations.prepare && !!request && typeof request === "object" && "choiceId" in request && request.choiceId === confirmations.choiceId, operationIdentity: () => "mutation-operation", confirmChoice: async () => confirmations.choice, resolveQuestion: async () => ({ status: "unavailable", reason: "unused" }), resolveAnswer: async () => ({ status: "unavailable", reason: "unused" }), confirmAnswer: async () => false, resolveChoiceValues: async (_caseRef, request, context) => { const comparison = await planner.compareScenarios(request, context); return comparison.status !== "ok" ? comparison : { status: "ok", value: [{ criterionRef: "cost", value: comparison.value.completeDifference, unit: "USD", currency: "USD", horizon }] } }, readScenarioResult: (resultRef, context) => results.readHistoricalScenario({ resultRef }, context), prepareDomainCommands: async (_caseRef, choiceId, selectedOperations) => choiceId === confirmations.choiceId && digestSfValue(selectedOperations) === digestSfValue(operations) ? { status: "ok", value: domainCommands } : { status: "conflict", reason: "unreviewed-domain-commands" }, createId: (() => { let id = 0; return () => `mutation-${++id}` })(), now: () => "2027-01-02T00:00:00Z" })
    expect(await mutations.recordChoice(choiceRequest, binding)).toEqual({ status: "denied", reason: "human-choice-required" })
    expect(await amounts()).toEqual([30, 50])
    confirmations.choice = true
    const chosen = await mutations.recordChoice(choiceRequest, binding)
    if (chosen.status !== "ok") throw new Error(`Human choice: ${JSON.stringify(chosen)}`)
    const chosenCase = await cases.read({ caseRef: caseSelector }, binding)
    if (chosenCase.status !== "ok") throw new Error(`Chosen case: ${JSON.stringify(chosenCase)}`)
    expect(chosenCase.value.case.choices).toHaveLength(1)
    expect(chosenCase.value.case.preparedChanges).toHaveLength(0)
    expect(chosenCase.value.case.receipts).toHaveLength(0)
    const choice = chosenCase.value.case.choices[0]!
    confirmations.choiceId = choice.id
    expect(choice).toMatchObject({ alternativeId: "combined", alternativeVersion: 1, principalRef: "principal", reason: choiceRequest.reason, comparisonStatus: "conditioned", values: [{ criterionRef: "cost", value: null, unit: "USD", currency: "USD", horizon }] })
    expect(choice.comparison).toEqual(canonicalComparison.value)
    expect(choice.scenario.operations).toEqual(operations)
    expect(chosenCase.value.events.filter((event) => event.kind === "choice-recorded")).toHaveLength(1)
    expect(chosenCase.value.events.find((event) => event.kind === "choice-recorded")?.outputDigest).toBe(digestSfValue(choice))
    expect(await mutations.recordChoice(choiceRequest, binding)).toEqual(chosen)
    const currentComparison = await results.write({ kind: "comparison", result: canonicalComparison.value, caseRef: chosen.value.caseRef, requestDigest: digestSfValue(comparisonRequest), sourceRefs, idempotencyKey: "comparison-after-choice" }, binding)
    if (currentComparison.status !== "ok") throw new Error(`Current C08 comparison: ${JSON.stringify(currentComparison)}`)
    const candidates = [portfolioCandidateRef({ caseRef: caseSelector, caseVersion: chosen.value.caseRef.version, alternativeId: choice.alternativeId, alternativeVersion: choice.alternativeVersion })]
    const portfolioRequest: PortfolioRequest = { scope: { horizon, currency: "USD" }, candidateRefs: candidates, operations: [], constraints: ["cost"], priorities: [], explorationLimit: 1 }
    const portfolioHost: PortfolioHost = {
      resolveCandidate: createDecisionCandidateResolver(cases),
      evaluate: async (request, context) => {
        if (digestSfValue(request.operations) !== digestSfValue(operations)) return { status: "conflict", reason: "combination-not-in-choice" }
        const selected = await results.readHistoricalScenario({ resultRef: scenarioResults[1]! }, context)
        const comparison = await results.read({ resultRef: currentComparison.value.resultRef, kind: "comparison" }, context)
        if (selected.status !== "ok") return selected
        if (comparison.status !== "ok") return comparison
        if (selected.value.kind !== "scenario" || comparison.value.kind !== "comparison") return { status: "unavailable", reason: "analysis-unavailable" }
        return { status: "ok", value: { scenario: selected.value.result, costCoverageRefs: comparison.value.result.costCoverageRefs, analysis: { scenario: selected.value.result, scenarioResultRef: selected.value.resultRef, comparison: comparison.value.result, comparisonRef: comparison.value.resultRef }, constraints: comparison.value.result.criterionResults.map((criterion) => ({ ref: criterion.criterionId, state: criterion.state, reason: criterion.reason })) } }
      },
      sensitivity: async () => ({ status: "unavailable", reason: "unused" }),
      revalidateEvaluation: async (observed, refs, analysis, context) => {
        const comparison = await results.read({ resultRef: currentComparison.value.resultRef, kind: "comparison" }, context)
        const selected = await results.readHistoricalScenario({ resultRef: scenarioResults[1]! }, context)
        return comparison.status === "ok" && comparison.value.kind === "comparison" && selected.status === "ok" && selected.value.kind === "scenario" && digestSfValue(selected.value.result) === digestSfValue(observed) && digestSfValue(comparison.value.result.costCoverageRefs) === digestSfValue(refs) && analysis?.comparisonRef === comparison.value.resultRef && digestSfValue(analysis.comparison) === digestSfValue(comparison.value.result)
      },
      revalidate: host.revalidate,
    }
    const portfolio = createPortfolioPort(portfolioHost)
    const comparison = await portfolio.evaluate(portfolioRequest, binding)
    if (comparison.status !== "ok") throw new Error(`Portfolio before handoff: ${JSON.stringify(comparison)}`)
    expect(comparison.value.combinations[0]?.eligibility).toBe("conditioned")
    expect(comparison.value.combinations[0]?.analysis?.comparison).toEqual(choice.comparison)
    const combinationId = digestSfValue({ candidates, operations })
    const preparation = { portfolio, host: portfolioHost, cases, decisions: mutations, request: portfolioRequest, selectedCandidateRefs: candidates, combinationId, expectedEvaluationDigest: portfolioEvaluationDigest(portfolioRequest, comparison.value), caseRef: chosen.value.caseRef, choiceId: choice.id }
    expect(await preparePortfolioChoice(preparation, binding)).toEqual({ status: "denied", reason: "human-promotion-required" })
    confirmations.prepare = true
    const prepared = await preparePortfolioChoice(preparation, binding)
    if (prepared.status !== "ok") throw new Error(`Portfolio preparation: ${JSON.stringify(prepared)}`)
    const saved = await state.read(new Request("https://example.test"), "cases", (productState) => productState.cases[decision.id])
    if (saved.status !== "ok" || !saved.value) throw new Error(`Prepared case: ${JSON.stringify(saved)}`)
    expect(saved.value.preparedChanges).toHaveLength(2)
    expect(saved.value.preparedChanges.map((item) => [item.target.surface, item.expectedVersion, item.state])).toEqual([["planner", 4, "planned"], ["procurement", 4, "planned"]])
    expect(await amounts()).toEqual([30, 50])
    const reviews = new Map(saved.value.preparedChanges.map((change, index) => [change.id, proposalReviewDigest({ caseId: decision.id, caseIncarnation: decision.incarnation, changeCaseVersion: change.caseVersion, choiceDigest: digestSfValue(choice), change, fields: [{ field: "amount", before: index === 0 ? 30 : 50, after: change.operation.command.values.amount as number }], sourceRefDigest: domainCommands[index]!.targetEvidence.refDigest })]))
    const reviewDigestFor: Parameters<typeof createSfPreparedApply>[0]["reviewDigestFor"] = (context, request, change) => context.kind === "ui" && request.caseRef.id === decision.id && request.caseRef.incarnation === decision.incarnation && request.choiceId === choice.id && change.caseId === decision.id ? reviews.get(change.id) : undefined
    const apply = createSfPreparedApply({
      state, host, authorizeCase: async () => true,
      authorizeLookup: async (request) => ["forecast-a", "contract-b"].includes(request.targetRef),
      authorizeReceipt: async (receipt, request) => receipt.targetIncarnation === request.targetIncarnation && receipt.commandDigest === request.commandDigest,
      confirmHuman: async (request, change, context) => confirmations.apply && !!reviewDigestFor(context, request, change),
      resolveActor: () => ({ id: "principal", roles: ["finance", "buyer"], canWrite: true }),
      resolveMutation: (_snapshot, change): PreparedDomainMutation | undefined => change.target.surface === "procurement" && domain.procurementFails ? undefined : ({
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
      verifyGrant: (_snapshot, request, change, _actor, context) => confirmations.apply && !!reviewDigestFor(context, request, change),
      receiptVersion: (snapshot) => snapshot.versions.wp13Amount?.version,
      environment: () => ({ at: "2027-01-03T00:00:00Z", id: () => "unused", directory: [] }),
      createId: () => `receipt-${++domain.receiptSequence}`, now: () => "2027-01-03T00:00:00Z", reviewDigestFor,
    })
    const execution = createPreparedExecution({ state, host, apply, reviewDigestFor, revalidateProducer: async (request, context) => {
      const change = saved.value!.preparedChanges.find((item) => item.id === request.changeId)
      const digest = change && reviewDigestFor(context, request, change)
      if (!change || !digest) return { status: "unavailable", reason: "review-producer-unavailable" }
      // This controlled producer is unavailable before dispatch. A failure after
      // WP11's durable reservation is a different case: receipt-required, covered
      // with the real domain rollback in handoff-domain-integration.test.ts.
      if (change.target.surface === "procurement" && domain.procurementFails) return { status: "unavailable", reason: "review-producer-unavailable" }
      const version = await store.transaction(change.target.surface, async (snapshot) => ({ commit: false, value: snapshot.versions.wp13Amount?.version }))
      return version === change.expectedVersion ? { status: "ok", value: { reviewDigest: digest } } : { status: "stale", reason: "review-source-changed" }
    }, authorizeCase: async () => true, authorizeApplication: async (request, change, trusted) => trusted.kind === "ui" && request.choiceId === choice.id && change.caseId === decision.id && ["planner:forecast-a", "procurement:contract-b"].includes(`${change.target.surface}:${change.target.id}`), confirmApplication: async () => confirmations.apply, operationIdentity: () => "apply-operation", classifyReceipt: async (receipt) => {
      const evidenceBase = { schema: "sf-evidence-v1" as const, refId: `receipt-ref-${receipt.id}`, installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "observed" as const, kind: "receipt" as const, target: { surface: receipt.surface, receiptId: receipt.id, idempotencyKey: receipt.idempotencyKey, targetIncarnation: receipt.targetIncarnation, commandDigest: receipt.commandDigest, version: receipt.version } }
      return { state: "applied", evidence: { ...evidenceBase, refDigest: digestSfEvidenceRef(evidenceBase) } }
    } })
    const firstChange = saved.value.preparedChanges[0]!
    const secondChange = saved.value.preparedChanges[1]!
    const firstRequest = { caseRef: { id: decision.id, incarnation: decision.incarnation, version: saved.value.version }, changeId: firstChange.id, choiceId: choice.id }
    expect(await execution(firstRequest, binding)).toEqual({ status: "denied", reason: "application-confirmation-required" })
    expect(await amounts()).toEqual([30, 50])
    expect(domain.plannerCalls).toBe(0)
    confirmations.apply = true
    const firstExecution = await execution(firstRequest, binding)
    if (firstExecution.status !== "ok") throw new Error(`First application: ${JSON.stringify(firstExecution)}`)
    expect(await amounts()).toEqual([40, 50])
    expect(domain.plannerCalls).toBe(1)
    const committedReceipt = await state.read(new Request("https://example.test"), "receipts", (productState) => Object.values(productState.receipts))
    expect(committedReceipt.status).toBe("ok")
    if (committedReceipt.status !== "ok") return
    expect(committedReceipt.value).toHaveLength(1)
    expect(committedReceipt.value[0]?.result.ok).toBe(true)
    const afterFirst = await cases.read({ caseRef: caseSelector }, binding)
    expect(afterFirst.status).toBe("ok")
    if (afterFirst.status !== "ok") return
    expect(afterFirst.value.case.receipts).toHaveLength(1)
    expect(afterFirst.value.case.preparedChanges.map((change) => change.state)).toEqual(["applied", "planned"])
    expect(digestSfValue(afterFirst.value.case.choices[0])).toBe(digestSfValue(choice))
    expect(await execution(firstRequest, binding)).toEqual(firstExecution)
    expect(domain.plannerCalls).toBe(1)
    expect((await execution({ caseRef: { id: decision.id, incarnation: decision.incarnation, version: afterFirst.value.case.version }, changeId: secondChange.id, choiceId: choice.id }, binding)).status).toBe("unavailable")
    const partial = await cases.read({ caseRef: caseSelector }, binding)
    expect(partial.status).toBe("ok")
    if (partial.status !== "ok") return
    expect(partial.value.case.state).toBe("partially-applied")
    expect(partial.value.case.receipts).toHaveLength(1)
    expect(partial.value.case.preparedChanges.map((change) => change.state)).toEqual(["applied", "planned"])
    expect(domain.procurementCalls).toBe(0)
    expect(await amounts()).toEqual([40, 50])
    const beforeDispatch = await state.read(admittedRequest, "cases", (productState) => applicationAttempts(productState, { caseRef: { id: decision.id, incarnation: decision.incarnation, version: partial.value.case.version }, changeId: secondChange.id, choiceId: choice.id }))
    expect(beforeDispatch.status).toBe("ok")
    expect(beforeDispatch.status === "ok" && beforeDispatch.value).toEqual([])
    domain.procurementFails = false
    expect((await execution({ caseRef: { id: decision.id, incarnation: decision.incarnation, version: partial.value.case.version }, changeId: firstChange.id, choiceId: choice.id }, binding)).status).toBe("ok")
    const beforeResume = await cases.read({ caseRef: caseSelector }, binding)
    if (beforeResume.status !== "ok") throw new Error("case unavailable after first retry")
    const secondRequest = { caseRef: { id: decision.id, incarnation: decision.incarnation, version: beforeResume.value.case.version }, changeId: secondChange.id, choiceId: choice.id }
    const secondExecution = await execution(secondRequest, binding)
    if (secondExecution.status !== "ok") throw new Error(`Resumed application: ${JSON.stringify(secondExecution)}`)
    expect(await execution(secondRequest, binding)).toEqual(secondExecution)
    expect(domain.plannerCalls).toBe(1)
    expect(domain.procurementCalls).toBe(1)
    expect(await amounts()).toEqual([40, 60])
    const completed = await cases.read({ caseRef: caseSelector }, binding)
    expect(completed.status).toBe("ok")
    if (completed.status !== "ok") return
    expect(completed.value.case.state).toBe("applied")
    expect(completed.value.case.choices).toHaveLength(1)
    expect(digestSfValue(completed.value.case.choices[0])).toBe(digestSfValue(choice))
    expect(completed.value.case.preparedChanges.map((change) => change.state)).toEqual(["applied", "applied"])
    expect(completed.value.case.receipts).toHaveLength(2)
    expect(completed.value.events.filter((event) => event.kind === "choice-recorded")).toHaveLength(1)
    const durable = await state.read(new Request("https://example.test"), "receipts", (productState) => ({ receipts: Object.values(productState.receipts), proofs: saved.value!.preparedChanges.map((change) => productState.transactions[receiptProofTransactionKey("principal", change.target.id, change.idempotencyKey)]), comparison: productState.decisionResults?.[comparisonRecord.value.resultRef], scenario: productState.decisionResults?.[scenarioResults[1]!] }))
    if (durable.status !== "ok") throw new Error(`Durable handoff proof: ${JSON.stringify(durable)}`)
    expect(durable.value.receipts).toHaveLength(2)
    expect(durable.value.proofs.map((proof) => proof?.commandDigest)).toEqual(saved.value.preparedChanges.map((change) => receiptReviewBinding(change, reviews.get(change.id)!)))
    expect(durable.value.comparison?.resultDigest).toBe(digestSfValue(choice.comparison))
    expect(durable.value.scenario?.requestDigest).toBe(digestSfValue(choice.scenario))
    expect(durable.value.scenario?.resultDigest).toBe(digestSfValue(choice.result))
    expect(await mutations.recordChoice(choiceRequest, binding)).toEqual(chosen)
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
