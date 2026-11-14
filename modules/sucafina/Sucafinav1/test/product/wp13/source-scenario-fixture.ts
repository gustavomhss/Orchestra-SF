import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../product/contracts/business-context.ts"
import type { CostCoverageBasis, CostCoverageEntry, DecisionCase } from "../../../product/contracts/decisions.ts"
import type { ScenarioRequest } from "../../../product/contracts/operations.ts"
import type { PlannerSourceHost } from "../../../product/contracts/ports.ts"
import { createDecisionBaselineCoverage } from "../../../product/decisions/baseline-coverage.ts"
import { createDecisionCasePort } from "../../../product/decisions/case-port.ts"
import { createDecisionCoverageAccess, decisionCoverageRef } from "../../../product/decisions/coverage-access.ts"
import { createCriterionRuleRegistry } from "../../../product/decisions/criterion-rules.ts"
import { classifyCoverage, supportsCoverageClassification } from "../../../product/decisions/coverage-classification.ts"
import { createDecisionMutations } from "../../../product/decisions/mutations.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createPlannerCriterionMetric } from "../../../product/planner/criterion-metric.ts"
import { createPlannerExactThreshold } from "../../../product/planner/exact-threshold.ts"
import { createPlannerPort, projectPlannerSource } from "../../../product/planner/port.ts"
import { comparePlannerPreview } from "../../../product/planner/preview-comparison.ts"
import { createPlannerSensitivityUnits } from "../../../product/planner/sensitivity-units.ts"
import { createStoredPlannerScenarioHost } from "../../../product/planner/stored-scenarios.ts"
import { wp05Horizon } from "../wp05/engine-fixture.ts"
import { createWp11FixtureTrace } from "../wp11/fixture-trace.ts"
import { renewalCoverage } from "../wp11/renewal-coverage-fixture.ts"
import { createRenewalQuoteRevision, createRenewalSourceFixture, renewalEvidenceContext } from "../wp11/renewal-source-fixture.ts"
import { createRenewalOperationVerifier } from "../wp11/renewal-operation-verifier.ts"

type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>
const now = () => "2026-11-13T02:00:00Z"
const actor = { id: "finance", roles: ["finance"], canWrite: true, assigned: [], domains: [] }

/** Fixture derived from WP11 renewal-choice-fixture at 88144ff9495c4061fd1661c55e8c6d802bf197a7,
 * blob 52dc09126bc81da39aa4b5beb0a28d0218d7560d. The only setup extension declares the second policy before C10 registration.
 * Source bootstrap, admission and per-call observations selectively follow WP11 c41d7277be5941bafb105654360a32adea7f0347,
 * blob a7fbf1ab3e35810cc717980b89421f039eae41f1. They create real sources without an unused preliminary sensitivity result,
 * preserve current raw source authority, and keep C10 enrichment on the calculation and comparison path.
 * Every financial calculation, coverage assessment, scenario, unit, rule and durable write still uses its real producer.
 * Source declarations and human grants are synthetic fixture authority; this is not a fork of the financial engine. */
export const wp13CeilingCriterion = { id: "renewal-ceiling-240000", description: "Complete transition cost must not exceed USD 240000: the canonical selected-minus-renewal difference must be <= 0 against the complete persisted USD 240000 renewal baseline.", required: true } as const

export async function createWp13PolicyHistory(options: { training: "omitted" | "bundled" } = { training: "omitted" }) {
  const trace = createWp11FixtureTrace("wp13-policy-history")
  await trace.checkpoint("bootstrap-start")
  const upstream = await createRenewalSourceFixture(options.training)
  const fixture = { ...upstream, host: { ...upstream.host, revalidate: (context: Parameters<typeof upstream.host.revalidate>[0]) => trace.measure("host.revalidate", () => upstream.host.revalidate(context)) } }
  try {
    const writes = new WeakSet<object>()
    const current = { sources: fixture.sources, evidence: fixture.evidence, identity: "wp11-history", next: 0, ruleVersion: 0, sourceFenceValid: true }
    const declarations = new Map<string, { ref: RecordEvidence; entries: readonly CostCoverageEntry[] }>()
    const classifications: ReturnType<typeof classifyCoverage>[] = []
    const coverageVersions = new Map<string, number>()
    const state = trace.state(createSfProductState({ persistence: fixture.store, proposalCoverageWrites: writes, createId: () => "wp11-history-state", resolveTarget: async () => ({ incarnation: fixture.caseRef.incarnation }), authorize: async (request) => request === fixture.request ? fixture.context.binding : undefined }))
    const checkpoint = (phase: string) => trace.checkpoint(phase, state, fixture.request)
    // Initial policy declaration precedes every baseline coverage caseScopeDigest and all scenario publication.
    const initial = await state.read(fixture.request, "cases", (value) => value.cases[fixture.caseRef.id])
    if (initial.status !== "ok" || !initial.value || initial.value.criteria.some((criterion) => criterion.id === wp13CeilingCriterion.id)) throw new Error("Initial policy fixture case unavailable")
    const seeded = await state.transaction(fixture.request, { namespace: "cases", expectedStorageVersion: initial.storageVersion, targetRef: fixture.caseRef.id, targetIncarnation: fixture.caseRef.incarnation, idempotencyKey: "wp13-initial-policy", commandDigest: digestSfValue(wp13CeilingCriterion) }, async (value) => {
      const decision = value.cases[fixture.caseRef.id]
      if (!decision || digestSfValue(decision) !== digestSfValue(initial.value)) return { commit: false, value: false }
      value.cases[decision.id] = { ...decision, criteria: [...decision.criteria, wp13CeilingCriterion] }
      return { commit: true, value: true }
    })
    if (seeded.status !== "ok" || !seeded.value) throw new Error("Initial policy fixture declaration failed")
    await checkpoint("bootstrap-complete")
    const readCase = async () => {
      const loaded = await state.read(fixture.request, "cases", (value) => value.cases[fixture.caseRef.id])
      if (loaded.status !== "ok" || !loaded.value) throw new Error("Current decision unavailable")
      return structuredClone(loaded.value)
    }
    const refFor = (decision: DecisionCase) => ({ id: decision.id, incarnation: decision.incarnation, version: decision.version })
    const authorizeCase = async (decision: DecisionCase) => decision.id === fixture.caseRef.id && decision.incarnation === fixture.caseRef.incarnation && decision.participants.includes(fixture.context.binding.principalRef)
    const resolve: BusinessContextService["resolve"] = async (ref, context) => {
      const declaration = declarations.get(ref.refDigest)
      return declaration && digestSfValue(declaration.ref) === digestSfValue(ref) && await fixture.host.revalidate(context)
        ? { state: "fresh", ref, currentRef: ref, accessRevision: context.binding.accessRevision, checkedAt: now() }
        : current.evidence.resolve(ref, context)
    }
    const evidence: BusinessContextService = { ...fixture.evidence, resolve, context: renewalEvidenceContext(resolve) }
    const verifyEvidence = async (refs: readonly BusinessEvidenceRef[]) => (await evidence.context({ refs }, fixture.context)).every((value) => value.state === "fresh")
    const snapshotMatches = (snapshot: Parameters<Parameters<typeof createDecisionBaselineCoverage>[0]["verifySnapshot"]>[0], refs: readonly BusinessEvidenceRef[]) => refs.every((ref) => {
      if (declarations.has(ref.refDigest)) return digestSfValue(declarations.get(ref.refDigest)!.ref) === digestSfValue(ref)
      if (ref.kind !== "record" || ref.target.surface !== "planner" || ref.target.recordType !== "planner-version") return false
      const projection = projectPlannerSource(snapshot, actor, ref.target.recordId)
      return !!projection && digestSfValue({ versionId: ref.target.recordId, projection }) === ref.target.projectionDigest
    })
    const supports = (entry: Exclude<CostCoverageEntry, { status: "pending" }>, resolutions: readonly BusinessEvidenceResolution[]) => classifications.some((classification) => supportsCoverageClassification(classification, entry, resolutions))
    const ports: { baseline?: ReturnType<typeof createDecisionBaselineCoverage>; caseCoverage?: PlannerSourceHost["resolveForecastCoverage"] } = {}
    const sources: PlannerSourceHost = {
      resolveForecastSource: (reference, context) => trace.measure("classified-source", () => current.sources.resolveForecastSource(reference, context)),
      resolveForecastCoverage: (reference, context) => trace.measure("classified-coverage", async () => {
        if (reference.startsWith("case-coverage:") && ports.caseCoverage) return ports.caseCoverage(reference, context)
        if (ports.baseline) {
          const classified = await ports.baseline.resolveForecastCoverage(reference, context)
          if (classified.status === "ok" || classified.reason !== "baseline-coverage-unavailable") return classified
        }
        return current.sources.resolveForecastCoverage(reference, context)
      }),
    }
    const planner = createPlannerPort({ host: fixture.host, sources, evidence })
    const baseline = createDecisionBaselineCoverage({ state, host: fixture.host, resolveCase: async () => ({ status: "ok", value: refFor(await readCase()) }), authorizeCase, authorizeCoverage: async () => true,
      projectForecast: async (sourceRef, _caseRef, context) => { const value = await planner.compareForecast({ baseRef: sourceRef, candidateRef: sourceRef, period: wp05Horizon, currency: "USD" }, context); return value.status === "ok" ? { status: "ok", value: value.value.candidate } : value },
      resolveEvidence: (refs, context) => evidence.context({ refs }, context),
      supports: (entry, resolved) => entry.status === "not-applicable" && entry.evidenceRefs.some((ref) => declarations.get(ref.refDigest)?.entries.some((candidate) => digestSfValue(candidate) === digestSfValue(entry))) && entry.evidenceRefs.every((ref) => resolved.some((value) => value.state === "fresh" && digestSfValue(value.ref) === digestSfValue(ref))),
      verifySnapshot: (snapshot, request, record) => snapshotMatches(snapshot, [request.source, ...record.basis.sourceRefs, ...record.assessment.evaluatedSourceRefs]), operationIdentity: () => current.identity, proposalCoverageWrites: writes, now })
    ports.baseline = baseline
    ports.caseCoverage = createDecisionCoverageAccess({ state, host: fixture.host, authorizeCase, verifyEvidence: (basis, assessment) => verifyEvidence([...basis.sourceRefs, ...assessment.evaluatedSourceRefs]) })
    const results = createSfDecisionResultStore({ state, host: fixture.host, authorizeCase, verifySources: (_value, refs) => verifyEvidence(refs), createId: () => `wp11-history-result-${++current.next}`, now })
    // Operation admission retains current source/projection authority. Nonempty
    // operations and assumptions use the complete canonical operation verifier.
    // C10 judgment remains on the classified calculation/comparison Planner.
    const operationSources: PlannerSourceHost = {
      resolveForecastSource: (reference, context) => trace.measure("operation-source", () => current.sources.resolveForecastSource(reference, context)),
      resolveForecastCoverage: (reference, context) => trace.measure("operation-coverage", () => current.sources.resolveForecastCoverage(reference, context)),
    }
    // Stored scenarios retain their persisted C10 result and basis. This port
    // supplies only the canonical source DomainProjection; judgment and preview
    // keep the classified Planner and revalidate their complete C10 observations.
    const sourcePlanner = createPlannerPort({ host: fixture.host, sources: operationSources })
    const verifyOperations = createRenewalOperationVerifier(fixture.host, operationSources, trace)
    const cases = createDecisionCasePort({ state, host: fixture.host, creationTarget: { ref: fixture.caseRef.id, incarnation: fixture.caseRef.incarnation }, operationIdentity: () => current.identity, authorizeCase, verifyScenarioOperations: async (decision, context) => (await Promise.all(decision.alternatives.map((alternative) => verifyOperations(alternative.scenario, context)))).every(Boolean), evidence, createId: () => `wp11-history-case-${++current.next}`, now })
    const scenarios = createStoredPlannerScenarioHost({ store: results, cases, planner: sourcePlanner, coverageRefFor: (ref, alternative) => decisionCoverageRef(ref, alternative.id, alternative.version) })
    const preview: Parameters<typeof createPlannerExactThreshold>[0]["preview"] = (request, context) => comparePlannerPreview({ host: fixture.host, sources, scenarios, planner }, request, context)
    const metrics: { read?: ReturnType<typeof createPlannerCriterionMetric> } = {}
    const rules = createCriterionRuleRegistry({ state, host: fixture.host, authorizeCase, authorizeRule: async () => true, verifyEvidence: (rule) => verifyEvidence(rule.evidenceRefs), verifySnapshot: (snapshot, rule) => snapshotMatches(snapshot, rule.evidenceRefs), readMetric: (request, context) => { if (!metrics.read) throw new Error("Metric not composed"); return metrics.read(request, context) }, verifyMetric: (metric) => verifyEvidence(metric.evidenceRefs), operationIdentity: () => current.identity, proposalCoverageWrites: writes, now })
    const issuer = createPlannerSensitivityUnits({ host: fixture.host, cases, scenarios, store: results, evidence, rules })
    metrics.read = createPlannerCriterionMetric({ host: fixture.host, rules, units: issuer, preview })
    const withCriteria = createPlannerPort({ host: fixture.host, sources, scenarios, evidence, criteria: { evaluate: async (request, context) => rules.evaluate({ caseRef: refFor(await readCase()), ...request }, context) } })
    const exact = createPlannerExactThreshold({ units: issuer, preview })
    const mutation = createDecisionMutations({ state, host: fixture.host, planner: withCriteria, sources, authorizeCase, authorizeMutation: async () => true, verifyMutation: () => true, operationIdentity: () => current.identity, confirmChoice: async () => true, confirmAnswer: async () => false, resolveQuestion: async () => ({ status: "unavailable", reason: "not-requested" }), resolveAnswer: async () => ({ status: "unavailable", reason: "not-requested" }), prepareDomainCommands: async () => ({ status: "unavailable", reason: "separate-application-required" }),
      coverageEvidence: { entries: async (_scenario, assessment) => ({ status: "ok", value: assessment.entries }), resolve: (refs, context) => evidence.context({ refs }, context), supports, verifySnapshot: (snapshot, result, basis) => current.sourceFenceValid && snapshotMatches(snapshot, [...result.sourceRefs, ...basis.sourceRefs, ...result.costCoverage.evaluatedSourceRefs]) },
      resolveChoiceValues: async (_caseRef, request, context) => { const compared = await withCriteria.compareScenarios(request, context); return compared.status === "ok" ? { status: "ok", value: [{ criterionRef: "renewal-difference", value: compared.value.knownDifference, unit: "USD", currency: "USD", horizon: wp05Horizon }] } : compared },
      readScenarioResult: (resultRef, context) => results.readHistoricalScenario({ resultRef }, context), createId: () => `wp11-history-${++current.next}`, now })
    const register = async (source: RecordEvidence, basis: CostCoverageBasis, entries: readonly CostCoverageEntry[]) => {
      const caseRef = refFor(await readCase())
      current.identity = `coverage-${source.refId}-${basis.version}`
      const value = await baseline.register({ caseRef, source, basis, entries, expectedVersion: coverageVersions.get(source.refId) ?? 0 }, fixture.context)
      if (value.status !== "ok") throw new Error(`Coverage registration: ${value.reason}`)
      coverageVersions.set(source.refId, value.value.version)
      const classification = await baseline.readClassification(source.refId, fixture.context)
      if (classification.status !== "ok") throw new Error(classification.reason)
      classifications.push(classification.value)
      return value.value.coverageRef
    }
    const advance = async (alternativeId: string, scenario: ScenarioRequest, coverageRef: string) => {
      const decision = await readCase()
      const selected = decision.alternatives.find((alternative) => alternative.id === alternativeId)
      if (!selected) throw new Error("Alternative unavailable")
      current.identity = `promote-${alternativeId}-${selected.version + 1}`
      const advanced = await mutation.addAlternative({ caseRef: refFor(decision), alternativeRef: { id: selected.id, version: selected.version }, title: selected.title, scenario, coverageRef }, fixture.context)
      if (advanced.status !== "ok") throw new Error(`Alternative revision: ${advanced.reason}`)
      if (!advanced.value.resultRef) throw new Error("Alternative revision did not emit its C08 result")
      return { ...structuredClone(advanced.value), resultRef: advanced.value.resultRef }
    }
    const preparePhase = async (source: RecordEvidence, basis: CostCoverageBasis, scenario: ScenarioRequest, training: "omitted" | "confirmed" | "bundled") => {
      await checkpoint(`prepare:${source.refId}:start`)
      const phaseRefs = [...basis.sourceRefs].filter((ref): ref is RecordEvidence => ref.kind === "record")
      const coverage = await renewalCoverage({ ...fixture, planner, sources, evidence, scenario, basis, sourceRefs: phaseRefs, caseRef: refFor(await readCase()) }, training)
      declarations.set(coverage.statement.refDigest, { ref: coverage.statement, entries: coverage.entries })
      const selectedCoverageRef = await register(source, basis, coverage.entries)
      const renewalSource = phaseRefs.find((ref) => ref.refId === fixture.baselineScenario.baseRef)
      if (!renewalSource) throw new Error("Renewal source unavailable")
      const renewalProjection = await planner.compareForecast({ baseRef: renewalSource.refId, candidateRef: renewalSource.refId, period: wp05Horizon, currency: "USD" }, fixture.context)
      if (renewalProjection.status !== "ok") throw new Error(renewalProjection.reason)
      const description = "The synthetic renewal quote has one final service price; this transition category does not apply to retaining that service."
      const unsigned: RecordEvidence = { schema: "sf-evidence-v1", kind: "record", refId: `renewal-scope-${basis.version}`, installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "observed", target: { surface: "planner", recordType: "synthetic-scope", recordId: `renewal-scope-${basis.version}`, incarnation: "renewal-scope", version: basis.version, fields: [...basis.categoryIds], period: wp05Horizon, projectionDigest: digestSfValue({ description, source: renewalSource }) } }
      const statement = { ...unsigned, refDigest: digestSfEvidenceRef(unsigned) }
      const renewalEntries: CostCoverageEntry[] = basis.categoryIds.map((categoryId) => categoryId === "service" || categoryId === "taxes" ? { categoryId, status: "included", componentRefs: renewalProjection.value.candidate.components.map((component) => component.id), evidenceRefs: [renewalSource], scopeNote: "The final renewal service price includes taxes without a second monetary contribution." } : { categoryId, status: "not-applicable", justification: description, evidenceRefs: [statement] })
      declarations.set(statement.refDigest, { ref: statement, entries: renewalEntries })
      const renewalCoverageRef = await register(renewalSource, basis, renewalEntries)
      await advance("selected", scenario, selectedCoverageRef)
      const baselineScenario: ScenarioRequest = { baseRef: renewalSource.refId, operations: [], assumptions: [] }
      const baselineMutation = await advance("baseline", baselineScenario, renewalCoverageRef)
      const decision = await readCase()
      const caseRef = refFor(decision)
      const publish = async (id: string) => {
        const alternative = decision.alternatives.find((item) => item.id === id)
        if (!alternative) throw new Error("Alternative unavailable")
        const sourceRefs = [...alternative.result.sourceRefs, ...alternative.result.costCoverage.evaluatedSourceRefs].filter((ref, index, all) => all.findIndex((other) => digestSfValue(other) === digestSfValue(ref)) === index)
        const saved = await results.write({ kind: "scenario", result: alternative.result, caseRef, requestDigest: digestSfValue(alternative.scenario), sourceRefs, idempotencyKey: `current-${id}-${caseRef.version}` }, fixture.context)
        if (saved.status !== "ok" || saved.value.kind !== "scenario") throw new Error(`Current scenario persistence: ${saved.status}`)
        return saved.value
      }
      const selected = await publish("selected")
      // The last mutation already emitted the baseline at this case version. Reuse
      // its C08 receipt; another write here makes the current scenario lookup ambiguous.
      const emittedBaseline = await results.read({ kind: "scenario", resultRef: baselineMutation.resultRef }, fixture.context)
      if (emittedBaseline.status !== "ok" || emittedBaseline.value.kind !== "scenario" || emittedBaseline.value.resultRef !== baselineMutation.resultRef || digestSfValue(baselineMutation.caseRef) !== digestSfValue(caseRef) || digestSfValue(emittedBaseline.value.caseRef) !== digestSfValue(caseRef) || emittedBaseline.value.requestDigest !== digestSfValue(baselineScenario) || emittedBaseline.value.resultDigest !== digestSfValue(decision.alternatives.find((alternative) => alternative.id === "baseline")?.result)) throw new Error("Current baseline mutation C08 mismatch")
      const renewed = emittedBaseline.value
      const units = await issuer.issue({ scenarioRef: selected.resultRef, baselineRef: renewed.resultRef, parameterRef: "implementation:11" }, fixture.context)
      if (units.status !== "ok") throw new Error(`Current units: ${units.reason}`)
      current.identity = `rule-${caseRef.version}`
      const registered = await rules.register({ caseRef, criterionId: "renewal-difference", metricRef: "planner:known-subtotal-difference", operator: "lte", value: -20000, unit: "USD", period: wp05Horizon, evidenceRefs: basis.sourceRefs, sensitivity: units.value.units, expectedRuleVersion: current.ruleVersion }, fixture.context)
      if (registered.status !== "ok") throw new Error(`Current criterion: ${registered.reason}`)
      current.ruleVersion += 1
      const comparisonRequest = { scenarioRefs: [renewed.resultRef, selected.resultRef], criteria: ["renewal-difference"] }
      const compared = await withCriteria.compareScenarios(comparisonRequest, fixture.context)
      const advantage = await withCriteria.compareScenarios({ scenarioRefs: [selected.resultRef, renewed.resultRef], criteria: [] }, fixture.context)
      if (compared.status !== "ok" || advantage.status !== "ok") throw new Error(`Current comparison unavailable: ${JSON.stringify({ compared, advantage })}`)
      const comparisonStored = await results.write({ kind: "comparison", result: compared.value, caseRef, requestDigest: digestSfValue(comparisonRequest), sourceRefs: basis.sourceRefs, idempotencyKey: `current-comparison-${caseRef.version}` }, fixture.context)
      if (comparisonStored.status !== "ok") throw new Error(comparisonStored.reason)
      const projection = await planner.compareForecast({ baseRef: source.refId, candidateRef: source.refId, period: wp05Horizon, currency: "USD" }, fixture.context)
      if (projection.status !== "ok") throw new Error(projection.reason)
      const classification = await baseline.readClassification(source.refId, fixture.context)
      const rule = await rules.resolve({ caseRef, criterionId: "renewal-difference" }, fixture.context)
      if (classification.status !== "ok" || rule.status !== "ok") throw new Error("Current classification or rule unavailable")
      await checkpoint(`prepare:${source.refId}:complete`)
      return { caseRef, selectedRef: selected.resultRef, baselineRef: renewed.resultRef, baselineMutation, comparisonRef: comparisonStored.value.resultRef, comparison: compared.value, advantageComparison: advantage.value, selectedResult: selected.result, baselineResult: renewed.result, scenario, baselineScenario, projection: projection.value.candidate, sourceRefs: basis.sourceRefs, basis, planner: withCriteria, results, evidence, cases, issuer, exact, preview, classification: classification.value, rule: rule.value, sensitivityRequest: { scenarioRef: selected.resultRef, parameterBounds: { parameterRef: "implementation:11", minimum: 10000, maximum: 70000, steps: 2 }, criterion: { id: "renewal-difference", operator: "lte" as const, value: -20000 } } }
    }
    const originalSource = fixture.sourceRefs.find((ref) => ref.refId === fixture.scenario.baseRef)
    if (!originalSource) throw new Error("Original source unavailable")
    const before = await preparePhase(originalSource, fixture.basis, fixture.scenario, options.training)
    const choose = async () => {
      current.identity = "human-records-original-choice"
      const request = { caseRef: before.caseRef, alternativeId: "selected", alternativeVersion: before.selectedResult.costCoverage.alternativeVersion, comparison: { scenarioRefs: [before.baselineRef, before.selectedRef], criteria: ["renewal-difference"] }, criteria: ["renewal-difference"], reason: options.training === "omitted" ? "Human chooses the conditioned transition while the separately excluded training quote is still missing; no application is authorized." : "Human chooses the reviewed transition scenario with bundled migration and training; no application is authorized." }
      const recorded = await mutation.recordChoice(request, fixture.context)
      if (recorded.status !== "ok") throw new Error(recorded.reason)
      const decision = await readCase()
      const choice = decision.choices.at(-1)
      if (!choice) throw new Error("Human choice was not persisted")
      return { caseRef: recorded.value.caseRef, choice: structuredClone(choice), retry: () => { current.identity = "human-records-original-choice"; return mutation.recordChoice(request, fixture.context) } }
    }
    const resolveTraining = async () => {
      const revision = await createRenewalQuoteRevision(fixture, "training")
      current.sources = revision.sources
      current.evidence = revision.evidence
      return preparePhase(revision.source, revision.basis, { baseRef: revision.source.refId, operations: [], assumptions: [] }, "confirmed")
    }
    const reviseImplementation = async () => {
      const revision = await createRenewalQuoteRevision(fixture, "implementation")
      current.sources = revision.sources
      current.evidence = revision.evidence
      return preparePhase(revision.source, revision.basis, { baseRef: revision.source.refId, operations: [], assumptions: [] }, "bundled")
    }
    const rejectLockedSourceCheck = async () => {
      const decision = await readCase()
      const selected = decision.alternatives.find((alternative) => alternative.id === "selected")
      if (!selected) throw new Error("Current alternative unavailable")
      const coverage = await sources.resolveForecastCoverage(selected.scenario.baseRef, fixture.context)
      if (coverage.status !== "ok") throw new Error(coverage.reason)
      current.identity = "reject-stale-source-observation"
      current.sourceFenceValid = false
      try { return await mutation.addAlternative({ caseRef: refFor(decision), alternativeRef: { id: selected.id, version: selected.version }, title: selected.title, scenario: selected.scenario, coverageRef: coverage.value.coverageRef }, fixture.context) }
      finally { current.sourceFenceValid = true }
    }
    return { fixture, before, choose, resolveTraining, reviseImplementation, readCase, state, checkpoint, rejectLockedSourceCheck, cleanup: fixture.cleanup }
  } catch (error) {
    await fixture.cleanup()
    throw error
  }
}
