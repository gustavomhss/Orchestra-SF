import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "bun:test"
import { createDecisionCasePort } from "../../../product/decisions/case-port.ts"
import { createPreparedExecution } from "../../../product/decisions/apply.ts"
import { createSfPreparedApply } from "../../../product/decisions/prepared-apply.ts"
import { proposalReviewDigest, receiptProofTransactionKey, receiptReviewBinding } from "../../../product/decisions/receipt-review-binding.ts"
import { createDecisionMutations } from "../../../product/decisions/mutations.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { CostCoverageBasis, DecisionCase, PreparedChange, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { DomainProjection, PreparedCommand, ProductContext, SourceRef } from "../../../product/contracts/context.ts"
import type { PortfolioRequest, ScenarioOperation } from "../../../product/contracts/operations.ts"
import type { DomainPortHost, PlannerSourceHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { randomUUID } from "node:crypto"
import { roleMap } from "../../../runtime/admin.ts"
import { object, rows } from "../../../runtime/contract.ts"
import type { Actor, Snapshot } from "../../../runtime/contract.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import type { SfSourceScope } from "../../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector, sfPlannerProjectionSelector } from "../../../product/integration/source-projections.ts"
import { preparePlannerMutation, plannerPreparedRevision } from "../../../product/planner/prepared.ts"
import { createPlannerPreparedReview } from "../../../product/planner/prepared-review.ts"
import { createPlannerProduct } from "../../../product/planner/product.ts"
import { createProcurementC12Bridge } from "../../../product/procurement/c12.ts"
import { createProcurementPort } from "../../../product/procurement/port.ts"
import { prepareProcurementMutation } from "../../../product/procurement/prepared.ts"
import { createProcurementSourceResolver } from "../../../product/procurement/sources.ts"
import { plannerKnownSubtotal } from "../../../src/planner-accounts.ts"
import { createPlannerPort } from "../../../product/planner/port.ts"
import { createDecisionCandidateResolver, portfolioCandidateRef } from "../../../product/portfolio/candidates.ts"
import { createPortfolioPort } from "../../../product/portfolio/port.ts"
import { portfolioEvaluationDigest, preparePortfolioChoice } from "../../../product/portfolio/handoff.ts"
import type { PortfolioHost } from "../../../product/portfolio/port.ts"

// Admission, case coverage and selection are explicit host seams. Source incarnation,
// domain projection, previews, commands, SQLite commits, review bindings and receipts
// use the published producers. No fixture mutation applies a financial value.
test("portfolio C08 choice hands off canonical Planner and Procurement financial edits; partial confirmation resumes with durable receipts", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-portfolio-domain-handoff-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  try {
    const domains = await canonicalDomains(store)
    const { binding, horizon, host, persistence, targets, sourceRefs } = domains
    const operations: ScenarioOperation[] = [
      { kind: "replace", targetRef: "planner:v0", amount: domains.previewAmounts[0], currency: "USD", period: horizon },
      { kind: "replace", targetRef: "procurement:PR-1", amount: domains.previewAmounts[1], currency: "USD", period: horizon },
    ]
    const basis: CostCoverageBasis = { id: "renewal", version: 1, decisionType: "renewal-transition-v1", categoryIds: RENEWAL_TRANSITION_CATEGORIES, additionalCategoryIds: [], sourceRefs }
    // Components copy the canonical domain previews. The service-only coverage seam
    // deliberately leaves the comparison conditioned; absent cost is never zero.
    const scenarioFor = (alternativeId: string, amounts: readonly number[]): ScenarioResult => ({
      id: `canonical-command-${alternativeId}`, version: 1,
      components: targets.map((target, index) => ({ id: target.id, amount: amounts[index]!, currency: "USD", period: horizon, sourceRefs: [target], evidenceState: alternativeId === "baseline" ? "confirmed" : "hypothetical" })),
      currency: "USD", horizon, sourceRefs, unresolvedConditions: ["cost-categories-pending"], restrictions: alternativeId === "baseline" ? [] : ["preview-not-applied"],
      comparisonStatus: "conditioned", knownSubtotal: plannerKnownSubtotal(amounts), total: null,
      costCoverage: { basisId: basis.id, basisVersion: basis.version, alternativeId, alternativeVersion: 1, currency: "USD", horizon, issues: ["training:missing-category"], evaluatedSourceRefs: sourceRefs, coverageState: "pending", entries: [{ status: "included", categoryId: "service", componentRefs: targets.map((target) => target.id), evidenceRefs: sourceRefs, scopeNote: "Two canonical domain command amounts; other categories remain unresolved" }], derivedMissingCategoryIds: RENEWAL_TRANSITION_CATEGORIES.filter((category) => category !== "service") },
    })
    const scenario = scenarioFor("combined", domains.previewAmounts)
    const decision: DecisionCase = { id: "case-a", incarnation: "case-inc-a", version: 4, state: "comparing", objective: "Change two domains", horizon, currency: "USD", criteria: [{ id: "cost", description: "cost", required: true }], participants: ["principal"], sourceRefs, alternatives: [{ id: "baseline", version: 1, title: "Current domains", scenario: { baseRef: sourceRefs[0]!.refId, operations: [], assumptions: [] }, result: scenarioFor("baseline", await domains.amounts()) }, { id: "combined", version: 1, title: "Two reviewed changes", scenario: { baseRef: sourceRefs[0]!.refId, operations, assumptions: [] }, result: scenario }], costCoverageBases: [basis], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const originalCaseRef = { id: decision.id, incarnation: decision.incarnation, version: decision.version }
    const caseSelector = `case:${decision.id}:${decision.incarnation}`
    const state = createSfProductState({ persistence, createId: randomUUID, resolveTarget: async (_request, _snapshot, _namespace, targetRef) => targetRef === decision.id ? { incarnation: decision.incarnation } : targets.find((target) => target.id === targetRef), authorize: async () => ({ principalRef: "principal", policyVersion: "policy", accessRevision: "access" }) })
    await state.transaction(new Request("https://example.test"), { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "seed-case", commandDigest: "a".repeat(64), targetRef: decision.id, targetIncarnation: decision.incarnation }, async (productState) => { productState.cases[decision.id] = decision; return { commit: true, value: true } })
    const evidence: BusinessContextService = { context: async ({ refs }) => refs.map((ref) => ({ ref, state: "fresh", accessRevision: "access", checkedAt: "2027-01-01" })), resolve: async () => { throw new Error("unused") }, recall: async () => [], emitFromLedger: async () => { throw new Error("unused") } }
    const cases = createDecisionCasePort({ state, host, creationTarget: { ref: "install:cases", incarnation: "install-inc" }, operationIdentity: () => "case-operation", authorizeCase: async (value, context) => value.id === decision.id && value.participants.includes(context.binding.principalRef) && host.revalidate(context), verifyScenarioOperations: async () => true, evidence, createId: randomUUID, now: () => domains.at })
    const amounts = domains.amounts
    const results = createSfDecisionResultStore({ state, host, authorizeCase: async (value, context) => value.id === decision.id && value.incarnation === decision.incarnation && value.participants.includes(context.binding.principalRef), verifySources: async (_value, refs) => refs.length === sourceRefs.length && refs.every((ref) => sourceRefs.some((source) => digestSfValue(source) === digestSfValue(ref))), createId: (() => { let id = 0; return () => `handoff-result-${++id}` })(), now: () => "2027-01-01T00:00:00Z" })
    const scenarioResults: string[] = []
    for (const alternative of decision.alternatives) {
      const stored = await results.write({ kind: "scenario", result: alternative.result, caseRef: originalCaseRef, requestDigest: digestSfValue(alternative.scenario), sourceRefs, idempotencyKey: `scenario-${alternative.id}` }, binding)
      if (stored.status !== "ok") throw new Error(`C08 scenario write: ${JSON.stringify(stored)}`)
      scenarioResults.push(stored.value.resultRef)
    }
    const project = (result: ScenarioResult): DomainProjection => ({ context: { installationId: "install", projectId: "project", principalRef: "principal", accessRevision: "access", policyVersion: "policy", surface: "planner", period: horizon, currency: "USD", sourceRefs: targets, capabilities: [] }, version: result.version, engineVersion: "wp13-canonical-command-composition-v1", components: result.components, values: [], missing: [{ field: "training", reason: "missing" }] })
    const sources: PlannerSourceHost = {
      resolveForecastSource: domains.planner.sources.resolveForecastSource,
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
    const domainCommands = domains.commands.map((command, index) => ({ command, preview: scenario, targetEvidence: sourceRefs[index]! }))
    const confirmations = { choice: false, prepare: false, apply: new Set<string>(), choiceId: "" }
    const choiceRequest = { caseRef: originalCaseRef, alternativeId: "combined", alternativeVersion: 1, comparison: comparisonRequest, criteria: ["cost"], reason: "I reviewed the two changes; coverage and the cost criterion remain unresolved." }
    const authorizeMutation: Parameters<typeof createDecisionMutations>[0]["authorizeMutation"] = async (operation, request, context) => context.kind === "ui" && (operation === "record-choice" ? digestSfValue(request) === digestSfValue(choiceRequest) : operation === "prepare-changes" && confirmations.prepare && !!request && typeof request === "object" && "choiceId" in request && request.choiceId === confirmations.choiceId)
    const mutations = createDecisionMutations({ state, host, planner, sources, authorizeCase: async () => true, authorizeMutation, verifyMutation: (_snapshot, operation, request) => operation === "record-choice" ? confirmations.choice && digestSfValue(request) === digestSfValue(choiceRequest) : operation === "prepare-changes" && confirmations.prepare && !!request && typeof request === "object" && "choiceId" in request && request.choiceId === confirmations.choiceId, operationIdentity: () => "mutation-operation", confirmChoice: async () => confirmations.choice, resolveQuestion: async () => ({ status: "unavailable", reason: "unused" }), resolveAnswer: async () => ({ status: "unavailable", reason: "unused" }), confirmAnswer: async () => false, resolveChoiceValues: async (_caseRef, request, context) => { const comparison = await planner.compareScenarios(request, context); return comparison.status !== "ok" ? comparison : { status: "ok", value: [{ criterionRef: "cost", value: comparison.value.completeDifference, unit: "USD", currency: "USD", horizon }] } }, readScenarioResult: (resultRef, context) => results.readHistoricalScenario({ resultRef }, context), prepareDomainCommands: async (_caseRef, choiceId, selectedOperations) => choiceId === confirmations.choiceId && digestSfValue(selectedOperations) === digestSfValue(operations) ? { status: "ok", value: domainCommands } : { status: "conflict", reason: "unreviewed-domain-commands" }, createId: (() => { let id = 0; return () => `mutation-${++id}` })(), now: () => domains.at })
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
    expect(saved.value.preparedChanges.map((item) => [item.target.surface, item.expectedVersion, item.state])).toEqual([["planner", 0, "planned"], ["procurement", 0, "planned"]])
    expect(await amounts()).toEqual([30, 50])
    const reviews = new Map<string, string>()
    for (const change of saved.value.preparedChanges) {
      const reviewed = await domains.reviewDomain(change.operation, binding)
      if (reviewed.status !== "ok") throw new Error(`Canonical domain review: ${JSON.stringify(reviewed)}`)
      expect(reviewed.value.fields).toContainEqual(change.target.surface === "planner"
        ? { field: "line:1:forecast", before: 30, after: 40, beforeCurrency: "USD", afterCurrency: "USD" }
        : { field: "originalAmount", before: 50, after: 60, beforeCurrency: "USD", afterCurrency: "USD" })
      reviews.set(change.id, proposalReviewDigest({ caseId: decision.id, caseIncarnation: decision.incarnation, changeCaseVersion: change.caseVersion, choiceDigest: digestSfValue(choice), change, fields: reviewed.value.fields, sourceRefDigest: reviewed.value.source.refDigest }))
    }
    const reviewDigestFor: Parameters<typeof createSfPreparedApply>[0]["reviewDigestFor"] = (context, request, change) => context.kind === "ui" && context.binding.principalRef === "principal" && request.caseRef.id === decision.id && request.caseRef.incarnation === decision.incarnation && request.choiceId === choice.id && change.caseId === decision.id && saved.value!.preparedChanges.some((original) => original.id === change.id && original.operation.commandDigest === change.operation.commandDigest) ? reviews.get(change.id) : undefined
    const producerCalls: string[] = []
    const apply = createSfPreparedApply({
      state, host,
      authorizeCase: async (value, context) => value.id === decision.id && value.participants.includes(context.binding.principalRef) && host.revalidate(context),
      authorizeLookup: async (request, context) => targets.some((target) => target.surface === request.surface && target.id === request.targetRef && target.incarnation === request.targetIncarnation) && host.revalidate(context),
      authorizeReceipt: async (receipt, request, context) => receipt.principalRef === context.binding.principalRef && receipt.targetIncarnation === request.targetIncarnation && receipt.commandDigest === request.commandDigest && host.revalidate(context),
      confirmHuman: async (request, change, context) => confirmations.apply.has(change.id) && !!reviewDigestFor(context, request, change),
      resolveActor: (snapshot) => Array.isArray(snapshot.data.versions) ? domains.plannerActor : domains.procurementActor,
      resolveMutation: (snapshot, change, actor, context) => {
        producerCalls.push(change.target.surface)
        return domains.resolveMutation(snapshot, change, actor, context)
      },
      verifyGrant: (_snapshot, request, change, actor, context) => confirmations.apply.has(change.id) && actor.id === context.binding.principalRef && actor.canWrite && !!reviewDigestFor(context, request, change),
      receiptVersion: domains.receiptVersion,
      environment: () => domains.environment,
      createId: randomUUID, now: () => domains.at, reviewDigestFor,
    })
    const execution = createPreparedExecution({
      state, host, apply, reviewDigestFor,
      revalidateProducer: async (request, context) => {
        const change = saved.value!.preparedChanges.find((item) => item.id === request.changeId)
        if (!change || !reviewDigestFor(context, request, change)) return { status: "unavailable", reason: "review-producer-unavailable" }
        const reviewed = await domains.reviewDomain(change.operation, context)
        if (reviewed.status !== "ok") return reviewed
        return { status: "ok", value: { reviewDigest: proposalReviewDigest({ caseId: decision.id, caseIncarnation: decision.incarnation, changeCaseVersion: change.caseVersion, choiceDigest: digestSfValue(choice), change, fields: reviewed.value.fields, sourceRefDigest: reviewed.value.source.refDigest }) } }
      },
      authorizeCase: async (value, context) => value.id === decision.id && value.participants.includes(context.binding.principalRef) && host.revalidate(context),
      authorizeApplication: async (request, change, context) => context.kind === "ui" && request.choiceId === choice.id && change.caseId === decision.id && targets.some((target) => digestSfValue(target) === digestSfValue(change.target)) && host.revalidate(context),
      confirmApplication: async (request) => confirmations.apply.has(request.changeId),
      operationIdentity: () => "domain-apply-operation",
      classifyReceipt: async (receipt, _change, context) => {
        if (!await host.revalidate(context)) return undefined
        const ref: Extract<BusinessEvidenceRef, { kind: "receipt" }> = { schema: "sf-evidence-v1", refId: `receipt-ref-${receipt.id}`, installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "observed", kind: "receipt", target: { surface: receipt.surface, receiptId: receipt.id, idempotencyKey: receipt.idempotencyKey, targetIncarnation: receipt.targetIncarnation, commandDigest: receipt.commandDigest, version: receipt.version } }
        return { state: receipt.result.ok ? "applied" : "conflict", evidence: { ...ref, refDigest: digestSfEvidenceRef(ref) } }
      },
    })
    const firstChange = saved.value.preparedChanges[0]!
    const secondChange = saved.value.preparedChanges[1]!
    const firstRequest = { caseRef: { id: decision.id, incarnation: decision.incarnation, version: saved.value.version }, changeId: firstChange.id, choiceId: choice.id }
    const untouched = await domains.snapshots()
    expect(await execution(firstRequest, binding)).toEqual({ status: "denied", reason: "application-confirmation-required" })
    expect(await domains.snapshots()).toEqual(untouched)
    expect(producerCalls).toEqual([])

    confirmations.apply.add(firstChange.id)
    const firstExecution = await execution(firstRequest, binding)
    if (firstExecution.status !== "ok") throw new Error(`Planner canonical application: ${JSON.stringify(firstExecution)}`)
    expect(firstExecution.value).toMatchObject({ surface: "planner", result: { ok: true }, version: 1 })
    expect(await amounts()).toEqual([40, 50])
    const afterFirst = await cases.read({ caseRef: caseSelector }, binding)
    if (afterFirst.status !== "ok") throw new Error(`Partial case: ${JSON.stringify(afterFirst)}`)
    expect(afterFirst.value.case.state).toBe("partially-applied")
    expect(afterFirst.value.case.preparedChanges.map((change) => change.state)).toEqual(["applied", "planned"])
    expect(afterFirst.value.case.receipts).toHaveLength(1)
    expect(afterFirst.value.case.choices).toEqual([choice])
    expect(await execution(firstRequest, binding)).toEqual(firstExecution)
    expect(producerCalls).toEqual(["planner"])

    // Procurement is still an unconfirmed proposal. The successful Planner receipt
    // grants neither a second-domain approval nor a replacement of the human choice.
    const secondRequest = { caseRef: { id: decision.id, incarnation: decision.incarnation, version: afterFirst.value.case.version }, changeId: secondChange.id, choiceId: choice.id }
    const partialDomains = await domains.snapshots()
    expect(await execution(secondRequest, binding)).toEqual({ status: "denied", reason: "application-confirmation-required" })
    expect(await domains.snapshots()).toEqual(partialDomains)
    expect(producerCalls).toEqual(["planner"])
    const partial = await cases.read({ caseRef: caseSelector }, binding)
    if (partial.status !== "ok") throw new Error(`Unconfirmed Procurement case: ${JSON.stringify(partial)}`)
    expect(partial.value.case).toEqual(afterFirst.value.case)

    confirmations.apply.add(secondChange.id)
    const secondExecution = await execution(secondRequest, binding)
    if (secondExecution.status !== "ok") throw new Error(`Procurement canonical application: ${JSON.stringify(secondExecution)}`)
    expect(secondExecution.value).toMatchObject({ surface: "procurement", result: { ok: true }, version: 1 })
    expect(await amounts()).toEqual([40, 60])
    expect(producerCalls).toEqual(["planner", "procurement"])
    const completed = await cases.read({ caseRef: caseSelector }, binding)
    if (completed.status !== "ok") throw new Error(`Completed case: ${JSON.stringify(completed)}`)
    expect(completed.value.case.state).toBe("applied")
    expect(completed.value.case.preparedChanges.map((change) => change.state)).toEqual(["applied", "applied"])
    expect(completed.value.case.receipts).toHaveLength(2)
    expect(completed.value.case.choices).toEqual([choice])
    expect(completed.value.case.choices[0]?.comparisonStatus).toBe("conditioned")
    expect(completed.value.case.choices[0]?.comparison?.completeDifference).toBeNull()
    expect(completed.value.events.filter((event) => event.kind === "choice-recorded")).toHaveLength(1)

    const official = await domains.snapshots()
    expect(official.planner.versions["v0:lines:line"]?.version).toBe(1)
    expect(official.procurement.versions["requests:PR-1"]?.version).toBe(1)
    expect(object(object(object(official.procurement.data.store).requests)["PR-1"]).request).toMatchObject({ pr: { title: "Original requisition", justification: "Original scope", estAmount: 60 } })
    expect(object(object(object(object(official.procurement.data.store).requests)["PR-1"]).request).history).toHaveLength(1)
    confirmations.apply.clear()
    expect(await execution(secondRequest, binding)).toEqual(secondExecution)
    expect(await execution(firstRequest, binding)).toEqual(firstExecution)
    expect(producerCalls).toEqual(["planner", "procurement"])
    expect(await domains.snapshots()).toEqual(official)
    expect((await cases.read({ caseRef: caseSelector }, binding))).toEqual(completed)
    const durable = await state.read(new Request("https://example.test"), "receipts", (productState) => ({ receipts: Object.values(productState.receipts), proofs: saved.value!.preparedChanges.map((change) => productState.transactions[receiptProofTransactionKey("principal", change.target.id, change.idempotencyKey)]), comparison: productState.decisionResults?.[comparisonRecord.value.resultRef], scenario: productState.decisionResults?.[scenarioResults[1]!] }))
    if (durable.status !== "ok") throw new Error(`Durable canonical handoff: ${JSON.stringify(durable)}`)
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

async function canonicalDomains(store: Awaited<ReturnType<typeof openLocalStore>>) {
  const at = "2027-01-01T00:00:00Z"
  const horizon = { start: "2027-01-01", end: "2027-12-31" }
  const environment = { at, id: randomUUID, directory: [{ id: "principal", name: "Principal" }] }
  const binding = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "principal", requestId: "domain-request", policyVersion: "policy", accessRevision: "access", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
  const plannerActor: Actor = { id: "principal", canWrite: true, roles: ["finance"], assigned: [], domains: [] }
  const procurementActor: Actor = { id: "principal", canWrite: true, roles: ["requester"], assigned: [], domains: [] }
  const persistence = createSfSourcePersistence({ persistence: store, enumerate: enumerateSfSources, createId: randomUUID, projectScope: createSfSourceScopeProjector(() => at) })
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  await persistence.transaction("planner", async (snapshot) => {
    snapshot.data.roleMap = [{ surface: "planner", role: "finance", entra: "finance-group", version: 1, by: "admin" }]
    snapshot.data.versions = [{ id: "v0", year: 2027, closed: 0, lines: [{ id: "line", sec: "opex", el: "licenses", cur: "USD", b: [30], f: [30] }], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }]
    return { commit: true, value: true }
  })
  await persistence.transaction("procurement", async (snapshot) => {
    snapshot.data.store = { requests: { "PR-1": { request: { number: "PR-1", createdBy: "principal", status: "draft", pr: { title: "Original requisition", justification: "Original scope", estAmount: 50 }, history: [] }, version: 1, by: "principal" } }, suppliers: [], settings: { currency: "USD", fxRates: [] }, issued: { pr: ["PR-1"], po: [] } }
    snapshot.versions["requests:PR-1"] = { version: 0, by: "principal" }
    return { commit: true, value: true }
  })
  const host: DomainPortHost = {
    persistence,
    authenticate: async (_request, scope) => ({ id: "principal", canWrite: true, roles: [{ surface: scope?.surface ?? "procurement", role: scope?.surface === "planner" ? "finance" : "requester" }] }),
    environment: async () => environment,
    requestFor: () => new Request("https://example.test/controlled-domain-admission"),
    revalidate: async (context) => context.kind === "ui" && context.binding.installationId === "install" && context.binding.projectId === "project" && context.binding.principalRef === "principal" && context.binding.accessRevision === "access" && context.binding.policyVersion === "policy",
  }
  const unavailable = async () => ({ status: "unavailable" as const, reason: "outside-this-fixture" })
  const productContext = (surface: "planner" | "procurement"): ProductContext => ({ installationId: "install", projectId: "project", principalRef: "principal", accessRevision: "access", policyVersion: "policy", surface, period: horizon, currency: "USD", sourceRefs: [], capabilities: [] })
  const planner = createPlannerProduct({ host, scopedSources: persistence, coverageFor: unavailable })
  const plannerIssued = await planner.issueSource("v0", binding)
  if (plannerIssued.status !== "ok") throw new Error(`Planner source: ${JSON.stringify(plannerIssued)}`)
  const plannerEvidence = plannerIssued.value.evidence
  const plannerTarget: SourceRef = { surface: "planner", type: "planner-version", id: "v0", incarnation: plannerEvidence.target.incarnation, version: plannerEvidence.target.version, fields: plannerEvidence.target.fields, period: horizon, observedAt: at }
  const plannerSnapshot = await persistence.transaction("planner", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
  const plannerScope = { principalRef: "principal", accessRevision: "access", policyVersion: "policy", recordType: "planner-version", recordId: "v0", selector: sfPlannerProjectionSelector(plannerSnapshot, plannerActor) }
  const preparedPlanner = preparePlannerMutation({ snapshot: plannerSnapshot, actor: plannerActor, environment, context: binding, target: plannerTarget, evidence: plannerEvidence, scope: plannerScope, command: { page: "OPEX", action: "save", id: "line", version: 0, values: { versionId: "v0", f0: 40 } }, operationId: "planner-operation", idempotencyKey: "planner-forecast-edit" })
  if (!preparedPlanner?.preview) throw new Error("Canonical Planner preparation unavailable")
  const forecast = rows(preparedPlanner.preview.lines).find((line) => line.id === "line")?.f
  if (!Array.isArray(forecast) || typeof forecast[0] !== "number") throw new Error("Canonical forecast preview unavailable")
  const plannerCommand: PreparedCommand = { id: "planner-operation", target: plannerTarget, command: preparedPlanner.command, expectedVersion: 0, idempotencyKey: "planner-forecast-edit", commandDigest: preparedPlanner.mutation.commandDigest, requiredAuthority: ["finance"], preview: { context: productContext("planner"), version: plannerTarget.version, engineVersion: "planner-canonical-prepared-command", components: [], missing: [], values: [{ id: "line:1:forecast", value: forecast[0], currency: "USD", period: { start: "2027-01-01", end: "2027-01-31" }, granularity: "month", sourceRefs: [plannerEvidence], drilldown: plannerEvidence, evidenceState: "hypothetical" }] } }

  // Controlled source admission uses the exact field set accepted by the published
  // integration/procurement-projections.ts (08fdfb8…). The newer WP04 source issuer
  // is not imported and this test makes no claim about the native/host source flow.
  // Persisting and resolving this private scope still uses the canonical lifecycle.
  const procurementFields = ["status", "holder", "stageEnteredAt", "ageDays", "baseAmount", "submittedAmount", "submittedCurrency", "submittedFxRate", "originalAmount", "originalCurrency", "fxRate", "fxSource", "monetaryState", "subject", "reason", "nextStep", "sourcing"]
  const procurementScope: SfSourceScope = await persistence.transaction("procurement", async (snapshot) => ({ commit: false, value: { principalRef: "principal", accessRevision: "access", policyVersion: "policy", recordType: "procurement-request", recordId: "PR-1", selector: { kind: "procurement-record-v1", roles: procurementActor.roles, canWrite: true, roleMapDigest: digestSfValue(roleMap(snapshot, "procurement")), fields: procurementFields, period: horizon, currency: "USD" } } }))
  const procurementIssued = await persistence.readScopedSource("procurement", procurementScope, async () => host.revalidate(binding))
  if (!procurementIssued) throw new Error("Procurement scoped source unavailable")
  const procurementRef = `sf-procurement:${encodeURIComponent(procurementIssued.incarnation)}:${procurementIssued.version}`
  const procurementSources = createProcurementSourceResolver({ host, scopedSources: persistence, contextFor: async () => ({ status: "ok", value: productContext("procurement") }) })
  const procurementSource = await procurementSources.resolveForPreparation(procurementRef, binding)
  if (procurementSource.status !== "ok") throw new Error(`Procurement source resolution: ${JSON.stringify(procurementSource)}`)
  const procurementEvidence = procurementSource.value.evidence
  const procurementTarget: SourceRef = { surface: "procurement", type: "procurement-request", id: "PR-1", incarnation: procurementEvidence.target.incarnation, version: procurementEvidence.target.version, fields: procurementEvidence.target.fields, period: horizon, observedAt: at }
  const procurementSnapshot = await persistence.transaction("procurement", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
  const preparedProcurement = prepareProcurementMutation({ snapshot: procurementSnapshot, actor: procurementActor, environment, context: binding, target: procurementTarget, evidence: procurementEvidence, scope: procurementSource.value.scope, command: { page: "Requests", action: "save", id: "PR-1", version: 0, values: { pr: { estAmount: 60 } } }, operationId: "procurement-operation", idempotencyKey: "procurement-estimate-edit" })
  if (!preparedProcurement) throw new Error("Canonical Procurement preparation unavailable")
  const procurementAmount = preparedProcurement.preview.values.find((value) => value.id === "baseAmount")
  if (!procurementAmount || typeof procurementAmount.value !== "number" || procurementAmount.currency !== "USD") throw new Error("Canonical Procurement amount unavailable")
  expect(preparedProcurement.preview.values.find((value) => value.id === "submittedAmount")?.value).toBeNull()
  expect(preparedProcurement.preview.values.find((value) => value.id === "originalAmount")).toMatchObject({ value: 60, currency: "USD", evidenceState: "hypothetical" })
  const individual: ReturnType<typeof createProcurementSourceResolver> = {
    ...procurementSources,
    issueForActor: async (target, context) => {
      if (digestSfValue(target) !== digestSfValue(procurementEvidence.target) || !await host.revalidate(context)) return { status: "denied", reason: "controlled-source-admission-mismatch" }
      const current = await procurementSources.resolveForPreparation(procurementRef, context)
      return current.status === "ok" ? { status: "ok", value: current.value.evidence } : current
    },
  }
  const procurementHost = { ...host, resolveRequestSource: procurementSources.resolve, resolveSupplierSource: procurementSources.resolve, isCurrentRequestSource: procurementSources.isCurrent, isCurrentSupplierSource: procurementSources.isCurrent, resolveRequestCollection: unavailable, isCurrentRequestCollection: () => false, readContractSource: unavailable }
  const bridge = createProcurementC12Bridge({ host: procurementHost, individual, port: createProcurementPort(procurementHost) })
  const plannerReview = createPlannerPreparedReview({ host, issueSource: planner.issueSource })
  const snapshots = async () => ({ planner: await persistence.transaction("planner", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) })), procurement: await persistence.transaction("procurement", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) })) })
  const amounts = async () => {
    const current = await snapshots()
    const forecast = rows(rows(current.planner.data.versions)[0]?.lines).find((line) => line.id === "line")?.f
    const estimate = object(object(object(object(current.procurement.data.store).requests)["PR-1"]).request).pr
    if (!Array.isArray(forecast) || typeof forecast[0] !== "number" || typeof object(estimate).estAmount !== "number") throw new Error("Official domain amounts unavailable")
    return [forecast[0], object(estimate).estAmount as number]
  }
  return {
    at, horizon, environment, binding, host, persistence, planner, plannerActor, procurementActor,
    targets: [plannerTarget, procurementTarget], sourceRefs: [plannerEvidence, procurementEvidence],
    commands: [plannerCommand, preparedProcurement.command], previewAmounts: [forecast[0] as number, procurementAmount.value] as const,
    snapshots, amounts,
    reviewDomain: (command: PreparedCommand, context: TrustedDomainContext) => command.target.surface === "planner" ? plannerReview(command, context) : bridge.reviewDomain(command, context),
    resolveMutation: (snapshot: Snapshot, change: PreparedChange, actor: Actor, context: TrustedDomainContext) => {
      if (change.target.surface === "procurement") return bridge.resolveMutation(snapshot, change, actor, context)
      const evidence = change.operation.preview.values[0]?.sourceRefs[0]
      if (evidence?.kind !== "record") return undefined
      const scope = { principalRef: actor.id, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, recordType: change.target.type, recordId: change.target.id, selector: sfPlannerProjectionSelector(snapshot, actor) }
      return preparePlannerMutation({ snapshot, actor, environment, context, target: change.target, evidence, scope, command: change.operation.command, operationId: change.operation.id, idempotencyKey: change.idempotencyKey })?.mutation
    },
    receiptVersion: (snapshot: Snapshot, change: PreparedChange) => change.target.surface === "planner" ? plannerPreparedRevision(snapshot, change.operation.command) : bridge.receiptVersion(snapshot, change),
  }
}
