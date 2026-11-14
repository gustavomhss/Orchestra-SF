import { expect, test } from "bun:test"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { AuthorizedCaseProjection, BusinessContextService, BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { CostCoverageAssessment, CostCoverageBasis, CostCoverageEntry, DecisionCase } from "../../../product/contracts/decisions.ts"
import type { PortfolioRequest, ScenarioRequest } from "../../../product/contracts/operations.ts"
import type { DomainPortHost, PlannerSourceHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { assessCostCoverage } from "../../../product/decisions/cost-coverage.ts"
import { classifyCoverage, supportsCoverageClassification } from "../../../product/decisions/coverage-classification.ts"
import { createCriterionRuleRegistry } from "../../../product/decisions/criterion-rules.ts"
import type { PortfolioBinding } from "../../../product/decisions/portfolio-bindings.ts"
import { createPortfolioHistory } from "../../../product/decisions/portfolio-history.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createPlannerMateriality } from "../../../product/planner/materiality.ts"
import { createPlannerPort, projectPlannerSource } from "../../../product/planner/port.ts"
import type { PlannerScenarioHost } from "../../../product/planner/scenario-comparison-port.ts"
import { createPortfolioPort } from "../../../product/portfolio/port.ts"
import type { PortfolioCandidate } from "../../../product/portfolio/port.ts"
import { createPortfolioReconciliation, portfolioComponentConditionDigest } from "../../../product/portfolio/reconciliation.ts"
import { domain } from "../../../runtime/planner.ts"
import { wp05Horizon } from "../wp05/engine-fixture.ts"
import { createRenewalChoiceHistory } from "../wp11/renewal-choice-fixture.ts"

type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>
type History = Awaited<ReturnType<typeof createRenewalChoiceHistory>>
type ResolvedScenario = Extract<Awaited<ReturnType<PlannerScenarioHost["resolve"]>>, { status: "ok" }>["value"]
const now = () => "2026-11-14T03:00:00Z"
const actor = { id: "finance", roles: ["finance"], canWrite: true, assigned: [], domains: [] }

/** Real Planner commands/calculations, C08 writes and WP11 recordChoice. The historical
 * selection reader, source issuer and admission are controlled host seams, not GNATIVE.
 * A quote edit is an input revision; it does not execute or replace the human choice.
 */
test("a real 45000 to 70000 quote on the same source changes its portfolio condition while preserving the human choice and C08 composition", async () => {
  const history = await createRenewalChoiceHistory({ training: "bundled" })
  try {
    const before = history.before
    const fixture = history.fixture
    const candidate: PortfolioCandidate = { ref: "wp13-price-candidate", caseRef: encodeCaseRef(before.caseRef), scenario: before.scenario, operations: before.scenario.operations, result: before.selectedResult }
    const request: PortfolioRequest = { scope: { currency: "USD", horizon: wp05Horizon }, candidateRefs: [candidate.ref], operations: [], constraints: ["renewal-difference"], priorities: [], explorationLimit: 1 }
    const port = createPortfolioPort({
      resolveCandidate: async (ref, context) => ref === candidate.ref && await fixture.host.revalidate(context) ? { status: "ok", value: candidate } : { status: "denied", reason: "candidate-unavailable" },
      evaluate: async (_request, context) => {
        const compared = await before.planner.compareScenarios({ scenarioRefs: [before.baselineRef, before.selectedRef], criteria: request.constraints }, context)
        return compared.status === "ok" ? { status: "ok", value: { scenario: before.selectedResult, costCoverageRefs: compared.value.costCoverageRefs, analysis: { scenarioResultRef: before.selectedRef, scenario: before.selectedResult, comparisonRef: before.comparisonRef, comparison: compared.value }, constraints: compared.value.criterionResults.map((criterion) => ({ ref: criterion.criterionId, state: criterion.state, reason: criterion.reason })) } } : compared
      },
      sensitivity: async () => ({ status: "unavailable", reason: "not-requested" }),
      revalidateEvaluation: async (scenario, _refs, analysis, context) => {
        const compared = await before.planner.compareScenarios({ scenarioRefs: [before.baselineRef, before.selectedRef], criteria: request.constraints }, context)
        return compared.status === "ok" && digestSfValue(scenario) === digestSfValue(before.selectedResult) && digestSfValue(analysis?.comparison) === digestSfValue(compared.value)
      },
      revalidate: fixture.host.revalidate,
    })
    const evaluated = await port.evaluate(request, fixture.context)
    if (evaluated.status !== "ok") throw new Error(`Original portfolio unavailable: ${JSON.stringify(evaluated)}`)
    const saved = await before.results.write({ kind: "portfolio", result: evaluated.value, caseRef: before.caseRef, requestDigest: digestSfValue(request), sourceRefs: evaluated.value.evidenceRefs, idempotencyKey: "wp13-original-price-portfolio" }, fixture.context)
    if (saved.status !== "ok" || saved.value.kind !== "portfolio") throw new Error(`Original portfolio C08 unavailable: ${JSON.stringify(saved)}`)
    const stored = saved.value
    const combination = stored.result.combinations[0]!
    const bindingBody = { schema: "sf-portfolio-binding-v1" as const, caseRef: before.caseRef, resultRef: stored.resultRef, resultDigest: stored.resultDigest, request, requestDigest: stored.requestDigest, proof: { candidates: [{ ref: candidate.ref, digest: digestSfValue(candidate) }], selectionDigest: digestSfValue({ caseRef: before.caseRef, candidateRefs: request.candidateRefs, criteria: request.constraints }) }, createdAt: stored.createdAt }
    // The private selection admission is controlled; all selected numeric payloads above are real producer/C08 outputs.
    const binding: PortfolioBinding = { ...bindingBody, bindingDigest: digestSfValue(bindingBody) }
    const chosen = await history.choose()
    const original = await history.readCase()
    const originalChoiceDigest = digestSfValue(chosen.choice)
    const originalPortfolioDigest = digestSfValue(stored)
    const originalCaseDigest = digestSfValue(original)
    expect(chosen.choice.result.components.find((component) => component.id === "implementation:11")?.amount).toBe(45000)
    expect(chosen.choice.result.knownSubtotal).toBe(210000)
    expect(chosen.choice.result.total).toBeNull()
    expect(chosen.choice.result.comparisonStatus).toBe("conditioned")

    const revision = await revisePriceInPlace(history)
    const current = refFor(original)
    expect(revision.source.target.recordId).toBe(revision.originalSource.target.recordId)
    expect(revision.source.target.incarnation).toBe(revision.originalSource.target.incarnation)
    expect(revision.source.target.version).toBeGreaterThan(revision.originalSource.target.version)
    expect(revision.after.result.components.find((component) => component.id === "implementation:11")?.amount).toBe(70000)
    expect(revision.after.result).toMatchObject({ knownSubtotal: 235000, total: 235000, comparisonStatus: "complete" })
    expect(revision.comparison).toMatchObject({ knownDifference: -5000, completeDifference: -5000, comparisonStatus: "complete", criterionResults: [{ criterionId: "renewal-difference", state: "failed" }] })
    const persistedComparison = await revision.results.read({ kind: "comparison", resultRef: revision.comparisonRef }, fixture.context)
    expect(persistedComparison.status === "ok" && persistedComparison.value.result).toEqual(revision.comparison)

    const historical = createPortfolioHistory({ state: revision.state, host: revision.host, authorizeCase: revision.authorizeCase, verifyHistoricalProvenance: async (value, context) => {
      const decision = await history.readCase()
      return await revision.host.revalidate(context) && digestSfValue(value) === originalPortfolioDigest && decision.choices.some((choice) => digestSfValue(choice) === originalChoiceDigest) && decision.ledger.some((event) => event.kind === "choice-recorded" && event.outputDigest === originalChoiceDigest) && (await revision.evidence.context({ refs: stored.sourceRefs }, context)).every((entry) => entry.state === "fresh" || entry.state === "historical")
    } })
    const materiality = createPlannerMateriality({ scenarios: revision.scenarios, planner: revision.planner, verifyBinding: async (selection, choice, context) => await revision.host.revalidate(context) && digestSfValue(selection.caseRef) === digestSfValue(current) && selection.choiceId === chosen.choice.id && digestSfValue(choice) === originalChoiceDigest && selection.evidence.refDigest === revision.originalSource.refDigest && digestSfValue(selection.scenarioRefs) === digestSfValue([revision.baselineRef, revision.afterRef]) && (await history.readCase()).choices.some((item) => digestSfValue(item) === originalChoiceDigest) })
    const read = createPortfolioReconciliation({
      caseFor: async () => ({ status: "ok", value: refFor(await history.readCase()) }),
      host: revision.host,
      evidence: revision.evidence,
      // This is the authorized historical case seam: the source revision does not rewrite old alternatives.
      cases: { read: async (caseRequest, context) => {
        const decision = await history.readCase()
        if (caseRequest.caseRef !== encodeCaseRef(decision) || !await revision.authorizeCase(decision, context)) return { status: "denied", reason: "case-unavailable" }
        const projection: AuthorizedCaseProjection = { context: { kind: "ui", installationId: context.binding.installationId, projectId: context.binding.projectId, principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion }, case: decision, events: decision.ledger, evidenceRefs: uniqueRefs([...decision.sourceRefs, ...chosen.choice.evidenceRefs, ...chosen.choice.result.sourceRefs, ...chosen.choice.costCoverage.evaluatedSourceRefs]), checkedAt: now() }
        return { status: "ok", value: projection }
      } },
      readPortfolio: async (query, context) => {
        if (query.combinationId !== combination.id) return { status: "unavailable", reason: "selection-unavailable" }
        const checked = await historical.read({ caseRef: query.caseRef, resultRef: query.resultRef }, context)
        if (checked.status !== "ok") return checked
        const loaded = await revision.state.read(fixture.request, "cases", (state) => state.decisionResults?.[query.resultRef])
        if (loaded.status !== "ok" || loaded.value?.kind !== "portfolio" || digestSfValue(loaded.value) !== originalPortfolioDigest) return { status: "unavailable", reason: "portfolio-unavailable" }
        return { status: "ok", value: { stored: loaded.value, binding, candidates: [candidate] } }
      },
      readMaterialChange: async ({ condition, component, caseRef }, context) => {
        if (!["implementation:11", "bridge:10"].includes(component.id)) return { status: "unavailable", reason: "component-not-selected-for-this-observation" }
        const observed = await materiality({ choice: condition.choice, selection: { caseRef, choiceId: condition.choice.id, source: condition.source, evidence: revision.originalSource, fields: condition.fields, period: condition.period, criterionId: condition.criterionId, scenarioRefs: [revision.baselineRef, revision.afterRef] } }, context)
        if (observed.status !== "ok") return observed
        const after = observed.value.comparison.resultAfter.components.find((item) => item.id === component.id)
        if (!after) return { status: "unavailable", reason: "component-unavailable" }
        return { status: "ok", value: { ...observed.value, componentScope: { componentId: component.id, beforeDigest: portfolioComponentConditionDigest(component), afterDigest: portfolioComponentConditionDigest(after) } } }
      },
    })
    const input = { caseRef: current, portfolioResultRef: stored.resultRef, combinationId: combination.id, choiceId: chosen.choice.id }
    const reconciled = await read(input, fixture.context)
    if (reconciled.status !== "ok") throw new Error(`Price reconciliation unavailable: ${JSON.stringify(reconciled)}`)
    const implementation = reconciled.value.components.find((component) => component.original.id === "implementation:11")!
    expect(implementation.original.amount).toBe(45000)
    expect(implementation.conditions[0]?.observation.comparison?.resultAfter.components.find((component) => component.id === "implementation:11")?.amount).toBe(70000)
    expect(implementation.conditions[0]?.scopeReason).toBe("component-scope-bound")
    expect(implementation.conditions[0]?.impact.state).toBe("material")
    expect(implementation.conditions[0]?.signal).toMatchObject({ choiceId: chosen.choice.id, conditionId: implementation.conditions[0]?.condition.id, severity: "reconsider" })
    // October's bridge zero is explicit and unchanged; a global criterion failure cannot assign it November's price change.
    const unchanged = reconciled.value.components.find((component) => component.original.id === "bridge:10")!
    expect(unchanged.original).toMatchObject({ amount: 0, evidenceState: "confirmed" })
    expect(unchanged.conditions[0]?.scopeReason).toBe("component-unchanged-comparison-changed")
    expect(unchanged.conditions[0]?.impact.state).toBe("unknown")
    expect(unchanged.conditions[0]?.signal?.severity).toBe("unknown")
    expect(reconciled.value.choiceDigest).toBe(originalChoiceDigest)
    expect(reconciled.value.originalChoice).toEqual(chosen.choice)
    expect(reconciled.value.originalCombination).toEqual(combination)
    expect(reconciled.value.components.every((component) => !component.effects.length)).toBe(true)
    expect(digestSfValue(await history.readCase())).toBe(originalCaseDigest)
    expect((await history.readCase()).receipts).toEqual([])
    expect((await history.readCase()).preparedChanges).toEqual([])
    const storedAgain = await revision.state.read(fixture.request, "cases", (state) => state.decisionResults?.[stored.resultRef])
    expect(storedAgain.status === "ok" && digestSfValue(storedAgain.value)).toBe(originalPortfolioDigest)
    revision.revoke()
    expect((await read(input, fixture.context)).status).not.toBe("ok")
    expect(digestSfValue(await history.readCase())).toBe(originalCaseDigest)
  } finally { await history.cleanup() }
}, 300000)

async function revisePriceInPlace(history: History) {
  const fixture = history.fixture
  const before = history.before
  const decision = await history.readCase()
  const current = refFor(decision)
  const originalSource = before.selectedResult.sourceRefs.find((ref): ref is RecordEvidence => ref.kind === "record" && ref.refId === before.scenario.baseRef)
  const baselineSource = before.baselineResult.sourceRefs.find((ref): ref is RecordEvidence => ref.kind === "record" && ref.refId === before.baselineScenario.baseRef)
  if (!originalSource || !baselineSource) throw new Error("Chosen Planner origins unavailable")
  const source = await fixture.store.transaction("planner", async (snapshot) => {
    const previous = projectPlannerSource(snapshot, actor, originalSource.target.recordId)
    if (!previous || digestSfValue({ versionId: originalSource.target.recordId, projection: previous }) !== originalSource.target.projectionDigest) throw new Error("Original source changed before the quote")
    const result = domain.execute(snapshot, { ...actor, id: "quote-author", roles: ["admin"] }, { page: "OPEX", action: "save", id: "implementation", version: snapshot.versions[`${originalSource.target.recordId}:lines:implementation`]?.version ?? 0, values: { versionId: originalSource.target.recordId, f10: 70000 } }, { at: now(), id: () => "wp13-price-input-revision", directory: [] })
    if (!result.ok) throw new Error(`Actual Planner quote edit rejected: ${JSON.stringify(result)}`)
    const projection = projectPlannerSource(snapshot, actor, originalSource.target.recordId)
    if (!projection || digestSfValue(projection) === digestSfValue(previous)) throw new Error("The Planner quote edit did not change its source")
    // The controlled issuer advances the observed record revision only after the real projection changed.
    const value: RecordEvidence = { ...originalSource, refDigest: "", target: { ...originalSource.target, version: originalSource.target.version + 1, fields: Object.keys(projection), projectionDigest: digestSfValue({ versionId: originalSource.target.recordId, projection }) } }
    return { commit: true, value: { ...value, refDigest: digestSfEvidenceRef(value) } }
  })
  const revoked = { value: false }
  const host: DomainPortHost = { ...fixture.host, environment: async () => ({ at: now(), id: () => "wp13-current-price-read", directory: [] }), revalidate: async (context) => !revoked.value && await fixture.host.revalidate(context) }
  const historicalRefs = uniqueRefs([...before.selectedResult.sourceRefs, ...before.baselineResult.sourceRefs, ...before.selectedResult.costCoverage.evaluatedSourceRefs, ...before.baselineResult.costCoverage.evaluatedSourceRefs, ...decision.sourceRefs, ...decision.choices.flatMap((choice) => choice.evidenceRefs)])
  const known = uniqueRefs([...historicalRefs, source])
  const currentSource = async (ref: RecordEvidence, context: TrustedDomainContext) => {
    if (!await host.revalidate(context)) return false
    const projection = await fixture.store.transaction("planner", async (snapshot) => ({ commit: false, value: projectPlannerSource(snapshot, actor, ref.target.recordId) }))
    return !!projection && digestSfValue({ versionId: ref.target.recordId, projection }) === ref.target.projectionDigest
  }
  const resolveEvidence: BusinessContextService["resolve"] = async (ref, context) => {
    const present = known.some((item) => digestSfValue(item) === digestSfValue(ref))
    if (!present || !await host.revalidate(context)) return { state: "revoked", ref, accessRevision: context.binding.accessRevision, checkedAt: now() }
    if (digestSfValue(ref) === digestSfValue(originalSource)) return { state: "historical", ref, accessRevision: context.binding.accessRevision, checkedAt: now() }
    const valid = ref.kind !== "record" || ref.target.recordType !== "planner-version" || await currentSource(ref, context)
    return { state: valid ? "fresh" : "revoked", ref, accessRevision: context.binding.accessRevision, checkedAt: now() }
  }
  const evidence: BusinessContextService = { resolve: resolveEvidence, context: async ({ refs }, context) => Promise.all(refs.map((ref) => resolveEvidence(ref, context))), recall: async () => [], emitFromLedger: async () => { throw new Error("Reconciliation must not write memory") } }
  const basis: CostCoverageBasis = { ...before.basis, version: before.basis.version + 1, sourceRefs: before.basis.sourceRefs.map((ref) => ref.refDigest === originalSource.refDigest ? source : ref) }
  const assessments = new Map<string, CostCoverageAssessment>()
  const coverageRef = (ref: RecordEvidence) => `wp13-price-coverage:${ref.refDigest}`
  const sources: PlannerSourceHost = {
    resolveForecastSource: async (reference, context) => {
      const ref = [source, baselineSource].find((item) => item.refId === reference)
      return ref && await currentSource(ref, context) ? { status: "ok", value: { versionId: ref.target.recordId, evidence: ref } } : { status: "unavailable", reason: "price-source-unavailable" }
    },
    resolveForecastCoverage: async (reference, context) => {
      const ref = [source, baselineSource].find((item) => item.refId === reference || coverageRef(item) === reference)
      if (!ref || !await currentSource(ref, context)) return { status: "unavailable", reason: "price-coverage-unavailable" }
      const assessment: CostCoverageAssessment = assessments.get(ref.refId) ?? { basisId: basis.id, basisVersion: basis.version, alternativeId: ref.refId, alternativeVersion: 1, currency: "USD", horizon: wp05Horizon, coverageState: "pending", issues: [], evaluatedSourceRefs: basis.sourceRefs, entries: basis.categoryIds.map((categoryId) => ({ categoryId, status: "pending", reason: "missing-category" })), derivedMissingCategoryIds: [...basis.categoryIds] }
      return { status: "ok", value: { coverageRef: coverageRef(ref), basis, assessment } }
    },
  }
  const domainPlanner = createPlannerPort({ host, sources })
  const projections = new Map<string, DomainProjection>()
  for (const ref of [source, baselineSource]) {
    const projected = await domainPlanner.compareForecast({ baseRef: ref.refId, candidateRef: ref.refId, currency: "USD", period: wp05Horizon }, fixture.context)
    if (projected.status !== "ok") throw new Error(`Revised canonical projection unavailable: ${JSON.stringify(projected)}`)
    projections.set(ref.refId, projected.value.candidate)
    const previous = ref.refId === source.refId ? before.selectedResult.costCoverage : before.baselineResult.costCoverage
    const entries: CostCoverageEntry[] = previous.entries.map((entry) => entry.status === "pending" ? entry : { ...entry, evidenceRefs: entry.evidenceRefs.map((item) => item.refDigest === originalSource.refDigest ? source : item) })
    const classification = classifyCoverage({ caseRef: current, source: ref, basis, entries, expectedVersion: 0 }, projected.value.candidate, 1)
    const refs = uniqueRefs([...basis.sourceRefs, ...entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)])
    const resolutions = await evidence.context({ refs }, fixture.context)
    const assessed = assessCostCoverage({ basis, alternativeId: ref.refId, alternativeVersion: 1, currency: "USD", horizon: wp05Horizon, entries, components: projected.value.candidate.components, evidence: resolutions, supports: (entry, resolved) => supportsCoverageClassification(classification, entry, resolved) })
    if (assessed.coverageState !== "complete") throw new Error(`Current quoted inventory incomplete: ${JSON.stringify(assessed)}`)
    assessments.set(ref.refId, assessed)
  }
  const writes = new WeakSet<object>()
  const authorizeCase = async (value: DecisionCase, context: TrustedDomainContext) => await host.revalidate(context) && value.id === current.id && value.incarnation === current.incarnation && value.participants.includes(context.binding.principalRef)
  const state = createSfProductState({ persistence: fixture.store, proposalCoverageWrites: writes, createId: () => "wp13-price-state", resolveTarget: async () => ({ incarnation: current.incarnation }), authorize: async (request) => request === fixture.request && await host.revalidate(fixture.context) ? fixture.context.binding : undefined })
  const counter = { value: 0 }
  const results = createSfDecisionResultStore({ state, host, authorizeCase, verifySources: async (_stored, refs, context) => (await evidence.context({ refs }, context)).every((entry) => entry.state === "fresh"), createId: () => `wp13-price-result-${++counter.value}`, now })
  const resolved = new Map<string, ResolvedScenario>()
  const publish = async (ref: RecordEvidence) => {
    const request: ScenarioRequest = { baseRef: ref.refId, operations: [], assumptions: [] }
    const result = await domainPlanner.simulateScenario(request, fixture.context)
    if (result.status !== "ok") throw new Error(`Source-only quoted result unavailable: ${JSON.stringify(result)}`)
    const stored = await results.write({ kind: "scenario", result: result.value, caseRef: current, requestDigest: digestSfValue(request), sourceRefs: uniqueRefs([...result.value.sourceRefs, ...result.value.costCoverage.evaluatedSourceRefs]), idempotencyKey: `wp13-current-price:${ref.refDigest}` }, fixture.context)
    if (stored.status !== "ok" || stored.value.kind !== "scenario") throw new Error(`Quoted scenario C08 unavailable: ${JSON.stringify(stored)}`)
    resolved.set(stored.value.resultRef, { result: stored.value.result, coverageRef: coverageRef(ref), basis, projection: projections.get(ref.refId)!, source: ref })
    return stored.value.resultRef
  }
  const afterRef = await publish(source)
  const baselineRef = await publish(baselineSource)
  const scenarios: PlannerScenarioHost = { resolve: async (reference, context) => {
    const expected = resolved.get(reference)
    if (!expected) return { status: "unavailable", reason: "quoted-scenario-unavailable" }
    const saved = await results.read({ kind: "scenario", resultRef: reference }, context)
    return saved.status === "ok" && saved.value.kind === "scenario" && digestSfValue(saved.value.result) === digestSfValue(expected.result) ? { status: "ok", value: expected } : { status: "denied", reason: "quoted-scenario-source-unavailable" }
  } }
  const comparisonPlanner = createPlannerPort({ host, sources, scenarios })
  const rules = createCriterionRuleRegistry({ state, host, authorizeCase, authorizeRule: async () => true, verifyEvidence: async (rule, context) => (await evidence.context({ refs: rule.evidenceRefs }, context)).every((entry) => entry.state === "fresh"), verifySnapshot: (snapshot) => [source, baselineSource].every((ref) => {
    const projection = projectPlannerSource(snapshot, actor, ref.target.recordId)
    return !!projection && digestSfValue({ versionId: ref.target.recordId, projection }) === ref.target.projectionDigest
  }), readMetric: async (request, context) => {
    if (request.scenarioRef !== afterRef || request.baselineRef !== baselineRef || request.metricRef !== "planner:known-subtotal-difference") return { status: "unavailable", reason: "price-metric-binding-unavailable" }
    const compared = await comparisonPlanner.compareScenarios({ scenarioRefs: [baselineRef, afterRef], criteria: [] }, context)
    if (compared.status !== "ok") return compared
    return { status: "ok", value: { ...request, value: compared.value.completeDifference, unit: "USD", period: wp05Horizon, evidenceRefs: basis.sourceRefs, state: compared.value.comparisonStatus === "complete" ? "confirmed" : "conditioned", engineVersion: "planner-runtime-v1" } }
  }, verifyMetric: async (metric, context) => metric.engineVersion === "planner-runtime-v1" && (await evidence.context({ refs: metric.evidenceRefs }, context)).every((entry) => entry.state === "fresh"), operationIdentity: () => "wp13-same-rule-current-price-source", proposalCoverageWrites: writes, now })
  const registered = await rules.register({ caseRef: current, criterionId: before.rule.criterionId, metricRef: before.rule.metricRef, operator: before.rule.operator, value: before.rule.value, unit: before.rule.unit, period: before.rule.period, evidenceRefs: basis.sourceRefs, expectedRuleVersion: before.rule.version }, fixture.context)
  if (registered.status !== "ok") throw new Error(`Unchanged canonical price criterion unavailable: ${JSON.stringify(registered)}`)
  const planner = createPlannerPort({ host, sources, scenarios, criteria: { evaluate: (request, context) => rules.evaluate({ caseRef: current, ...request }, context) } })
  const comparisonRequest = { scenarioRefs: [baselineRef, afterRef], criteria: [before.rule.criterionId] }
  const compared = await planner.compareScenarios(comparisonRequest, fixture.context)
  if (compared.status !== "ok") throw new Error(`Current canonical price comparison unavailable: ${JSON.stringify(compared)}`)
  const comparisonStored = await results.write({ kind: "comparison", result: compared.value, caseRef: current, requestDigest: digestSfValue(comparisonRequest), sourceRefs: basis.sourceRefs, idempotencyKey: "wp13-current-price-comparison" }, fixture.context)
  if (comparisonStored.status !== "ok" || comparisonStored.value.kind !== "comparison") throw new Error(`Current price comparison C08 unavailable: ${JSON.stringify(comparisonStored)}`)
  return { source, originalSource, host, state, results, evidence, authorizeCase, scenarios, planner, afterRef, baselineRef, after: resolved.get(afterRef)!, comparison: compared.value, comparisonRef: comparisonStored.value.resultRef, revoke: () => { revoked.value = true } }
}

function refFor(value: Pick<DecisionCase, "id" | "incarnation" | "version">) { return { id: value.id, incarnation: value.incarnation, version: value.version } }
function uniqueRefs(refs: readonly BusinessEvidenceRef[]) { return refs.filter((ref, index) => refs.findIndex((item) => digestSfValue(item) === digestSfValue(ref)) === index) }
