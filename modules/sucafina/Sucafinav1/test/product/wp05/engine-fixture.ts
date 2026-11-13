import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { CostCoverageAssessment, CostCoverageBasis, DecisionCase, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { ScenarioRequest, SensitivityRequest } from "../../../product/contracts/operations.ts"
import type { DomainPortHost, PlannerSourceHost } from "../../../product/contracts/ports.ts"
import { createDecisionCasePort } from "../../../product/decisions/case-port.ts"
import { createDecisionCoverageAccess, decisionCoverageRef } from "../../../product/decisions/coverage-access.ts"
import { createCriterionComparisonBindings } from "../../../product/decisions/criterion-comparison.ts"
import { createCriterionResultBindings, createCriterionRuleRegistry } from "../../../product/decisions/criterion-rules.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createPlannerCriterionMetric } from "../../../product/planner/criterion-metric.ts"
import { createPlannerExactThreshold } from "../../../product/planner/exact-threshold.ts"
import { createPlannerPort, projectPlannerSource } from "../../../product/planner/port.ts"
import { comparePlannerPreview } from "../../../product/planner/preview-comparison.ts"
import { createPlannerSensitivityUnits } from "../../../product/planner/sensitivity-units.ts"
import { createStoredPlannerScenarioHost } from "../../../product/planner/stored-scenarios.ts"
import { createPlannerSensitivity } from "../../../product/portfolio/planner-sensitivity.ts"
import { createPersistentSensitivityPort } from "../../../product/portfolio/sensitivity-store.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import { resolve } from "../../../src/identity.ts"

export const wp05Horizon = { start: "2027-01-01", end: "2027-12-31" }
const november = { start: "2027-11-01", end: "2027-11-30" }
const now = () => "2026-11-13T00:00:00Z"
const actor = { id: "finance", roles: ["finance"], canWrite: true, assigned: [], domains: [] }
type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>
type FixtureOptions = { mode?: "eur-missing-fx" | "renewal-usd"; training?: "bundled" | "omitted" | "confirmed" }

function initial(options: FixtureOptions): Snapshot {
  const line = (id: string, amount: number) => ({ id, sec: "opex", el: "licenses", cur: "USD", b: Array.from({ length: 12 }, (_, month) => month === 10 ? amount : 0), a: Array(12).fill(null), f: Array.from({ length: 12 }, (_, month) => month === 10 ? amount : 0) })
  const version = (id: string, lines: ReturnType<typeof line>[]) => ({ id, year: 2027, closed: 0, lines, fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} })
  return {
    data: {
      roleMap: [{ surface: "planner", role: "finance", entra: "finance-group", version: 1, by: "admin" }],
      versions: options.mode === "renewal-usd"
        ? [version("renewal", [line("renewal", 240000)]), version(`transition-${options.training ?? "bundled"}`, [line("bridge", 60000), line("implementation", 45000), line("new-service", 105000), ...(options.training === "confirmed" ? [line("training", 40000)] : [])])]
        : [{ id: "v0", year: 2027, closed: 9, lines: [{ id: "line", sec: "opex", el: "licenses", cur: "EUR", b: Array(12).fill(100000), a: Array(12).fill(null), f: [null, null, null, null, null, null, null, null, null, 100000, 112000, 100000] }], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }],
    },
    versions: {}, sequences: {}, audit: [], notices: [],
  }
}

/**
 * WP05-owned fixture, reconstructed against the published WP03/WP11/WP13 producers.
 * Planner computes every monetary value. C08 and criterion bindings use the real store.
 * Synthetic authorization/evidence callbacks are host boundaries; this is UI admission,
 * not a GNATIVE/provider proof. No callback supplies a computed financial result.
 */
export async function createWp05SensitivityFixture(options: FixtureOptions = {}) {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-wp05-engine-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const access = { allowed: true }
  const request = new Request("https://example.test/wp05", { headers: { authorization: "wp05-fixture" } })
  const identity = { installationId: "install", projectId: "project", principalRef: "finance", policyVersion: "policy", accessRevision: "access" }
  const authorize = async (incoming: Request) => access.allowed && incoming === request && incoming.headers.get("authorization") === "wp05-fixture" ? identity : undefined
  const ui = createSfUiAuthority({ authorize, commandIdentity: async () => "wp05-engine-command", createId: () => "wp05-engine-request", now: () => Date.parse(now()) })
  const intent = { viewId: "BI11", selectionRef: "authorized-selection", period: wp05Horizon }
  const admitted = await ui.admit(request, "sf_bi_view", digestSfValue(intent))
  if (admitted.status !== "ok") throw new Error(`WP05 UI admission: ${admitted.status}`)
  const context = admitted.value
  if (!await ui.validate(context, "sf_bi_view", digestSfValue(intent))) throw new Error("WP05 UI admission was not consumed")
  const cleanup = async () => {
    ui.finish(context)
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
  try {
    const snapshot = initial(options)
    await store.transaction("planner", async (current) => { current.data = snapshot.data; return { commit: true, value: true } })
    const caseRef = { id: "case", incarnation: "case-incarnation", version: 1 }
    const selectedSourceId = options.mode === "renewal-usd" ? `transition-${options.training ?? "bundled"}` : "v0"
    const baselineSourceId = options.mode === "renewal-usd" ? "renewal" : "v0"
    const sourceRefs = [...new Set([selectedSourceId, baselineSourceId])].map((id): RecordEvidence => {
      const projection = projectPlannerSource(snapshot, actor, id)
      if (!projection) throw new Error(`Planner source unavailable: ${id}`)
      const ref: RecordEvidence = { schema: "sf-evidence-v1", refId: id, installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "planner-version", recordId: id, incarnation: `planner-${id}`, version: 1, fields: Object.keys(projection), period: wp05Horizon, projectionDigest: digestSfValue({ versionId: id, projection }) } }
      return { ...ref, refDigest: digestSfEvidenceRef(ref) }
    })
    const sourceMatches = (ref: BusinessEvidenceRef) => sourceRefs.some((source) => digestSfValue(source) === digestSfValue(ref))
    const basis: CostCoverageBasis = { id: "renewal-transition", version: 1, decisionType: "renewal-transition-v1", categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs }
    const coverageAccess: { resolve?: PlannerSourceHost["resolveForecastCoverage"] } = {}
    const host: DomainPortHost = {
      persistence: store,
      authenticate: async (_request, input) => resolve("finance", [...input!.roleMap], (group) => group === "finance-group"),
      environment: async () => ({ at: now(), id: () => "unused", directory: [] }),
      requestFor: (trusted) => trusted.kind === "ui" ? ui.requestFor(trusted) : undefined,
      revalidate: (trusted) => trusted.kind === "ui" ? ui.revalidate(trusted) : Promise.resolve(false),
    }
    const sources: PlannerSourceHost = {
      resolveForecastSource: async (reference) => {
        const evidence = sourceRefs.find((ref) => ref.refId === reference)
        return evidence ? { status: "ok", value: { versionId: reference, evidence } } : { status: "unavailable", reason: "planner-source-unavailable" }
      },
      resolveForecastCoverage: async (reference, trusted) => {
        if (sourceRefs.some((ref) => ref.refId === reference)) {
          // Explicitly incomplete bootstrap inventory; downstream tests assess real components.
          const assessment: CostCoverageAssessment = { basisId: basis.id, basisVersion: basis.version, alternativeId: reference, alternativeVersion: 1, currency: "USD", horizon: wp05Horizon, issues: [], evaluatedSourceRefs: sourceRefs, coverageState: "pending", entries: RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => ({ status: "pending", categoryId, reason: "missing-category" })), derivedMissingCategoryIds: [...RENEWAL_TRANSITION_CATEGORIES] }
          return { status: "ok", value: { coverageRef: `source-coverage:${reference}`, basis, assessment } }
        }
        return coverageAccess.resolve ? coverageAccess.resolve(reference, trusted) : { status: "unavailable", reason: "planner-coverage-unavailable" }
      },
    }
    const planner = createPlannerPort({ host, sources })
    const proposalCoverageWrites = new WeakSet<object>()
    const state = createSfProductState({ persistence: store, proposalCoverageWrites, createId: () => "state-incarnation", resolveTarget: async () => ({ incarnation: caseRef.incarnation }), authorize: async (incoming) => await authorize(incoming) ? identity : undefined })
    const evidenceService: BusinessContextService = {
      resolve: async (ref) => ({ state: access.allowed && sourceMatches(ref) ? "fresh" : "revoked", ref, accessRevision: "access", checkedAt: now() }),
      context: async ({ refs }) => refs.map((ref) => ({ state: access.allowed && sourceMatches(ref) ? "fresh" : "revoked", ref, accessRevision: "access", checkedAt: now() })),
      recall: async () => [], emitFromLedger: async () => { throw new Error("Unexpected memory write in WP05 engine fixture") },
    }
    const parameterRef = options.mode === "renewal-usd" ? "implementation:11" : "line:11"
    const scenario: ScenarioRequest = { baseRef: selectedSourceId, operations: [{ kind: "replace", targetRef: parameterRef, amount: options.mode === "renewal-usd" ? 45000 : 112000, currency: options.mode === "renewal-usd" ? "USD" : "EUR", period: november }], assumptions: [] }
    const baselineScenario: ScenarioRequest = options.mode === "renewal-usd"
      ? { baseRef: baselineSourceId, operations: [{ kind: "replace", targetRef: "renewal:11", amount: 240000, currency: "USD", period: november }], assumptions: [] }
      : { ...scenario, operations: [{ ...scenario.operations[0]!, amount: 100000 }] }
    const selectedPreview = await planner.simulateScenario(scenario, context)
    const baselinePreview = await planner.simulateScenario(baselineScenario, context)
    if (selectedPreview.status !== "ok" || baselinePreview.status !== "ok") throw new Error(`Planner simulation unavailable: ${JSON.stringify({ selectedPreview, baselinePreview })}`)
    // Assign case identity to the producer assessment without changing values or completeness.
    const selectedResult: ScenarioResult = { ...selectedPreview.value, costCoverage: { ...selectedPreview.value.costCoverage, alternativeId: "selected", alternativeVersion: 1 } }
    const baselineResult: ScenarioResult = { ...baselinePreview.value, costCoverage: { ...baselinePreview.value.costCoverage, alternativeId: "baseline", alternativeVersion: 1 } }
    const decision: DecisionCase = { ...caseRef, state: "comparing", objective: "renewal", currency: "USD", horizon: wp05Horizon, criteria: [{ id: "renewal-difference", description: "Explicit known subtotal criterion", required: true }], participants: ["finance"], sourceRefs, alternatives: [{ id: "selected", version: 1, title: "Transition", scenario, result: selectedResult }, { id: "baseline", version: 1, title: "Renewal", scenario: baselineScenario, result: baselineResult }], costCoverageBases: [basis], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const seeded = await state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "wp05-seed-case", commandDigest: digestSfValue(decision), targetRef: caseRef.id, targetIncarnation: caseRef.incarnation }, async (value) => { value.cases[caseRef.id] = decision; return { commit: true, value: true } })
    if (seeded.status !== "ok" || !seeded.value) throw new Error(`Case persistence unavailable: ${seeded.status}`)
    let nextId = 0
    const results = createSfDecisionResultStore({ state, host, authorizeCase: async () => access.allowed, verifySources: async (_value, refs) => access.allowed && refs.every(sourceMatches), createId: () => `wp05-result-${++nextId}`, now })
    const selectedStored = await results.write({ kind: "scenario", result: selectedResult, caseRef, requestDigest: digestSfValue(scenario), sourceRefs: selectedResult.sourceRefs, idempotencyKey: "wp05-selected" }, context)
    const baselineStored = await results.write({ kind: "scenario", result: baselineResult, caseRef, requestDigest: digestSfValue(baselineScenario), sourceRefs: baselineResult.sourceRefs, idempotencyKey: "wp05-baseline" }, context)
    if (selectedStored.status !== "ok" || baselineStored.status !== "ok") throw new Error(`Scenario persistence unavailable: ${JSON.stringify({ selectedStored, baselineStored })}`)
    const selectedRef = selectedStored.value.resultRef
    const baselineRef = baselineStored.value.resultRef
    const cases = createDecisionCasePort({ state, host, creationTarget: { ref: caseRef.id, incarnation: caseRef.incarnation }, operationIdentity: () => "wp05-case", authorizeCase: async () => access.allowed, evidence: evidenceService, createId: () => "unused", now })
    coverageAccess.resolve = createDecisionCoverageAccess({ state, host, authorizeCase: async () => access.allowed, verifyEvidence: async (coverageBasis, assessment) => access.allowed && coverageBasis.sourceRefs.every(sourceMatches) && assessment.evaluatedSourceRefs.every(sourceMatches) })
    const scenarios = createStoredPlannerScenarioHost({ store: results, cases, planner, coverageRefFor: (ref, alternative) => decisionCoverageRef(ref, alternative.id, alternative.version) })
    const preview: Parameters<typeof createPlannerExactThreshold>[0]["preview"] = (input, trusted) => comparePlannerPreview({ host, sources, scenarios, planner }, input, trusted)
    const ruleOperation = { id: "wp05-criterion" }
    const metrics: { read?: ReturnType<typeof createPlannerCriterionMetric> } = {}
    const rules = createCriterionRuleRegistry({ state, host, authorizeCase: async () => access.allowed, authorizeRule: async () => access.allowed, verifyEvidence: async (rule) => access.allowed && rule.evidenceRefs.every(sourceMatches), verifySnapshot: () => access.allowed, readMetric: (input, trusted) => {
      if (!metrics.read) throw new Error("Planner criterion metric is not wired")
      return metrics.read(input, trusted)
    }, verifyMetric: async (metric) => access.allowed && metric.evidenceRefs.every(sourceMatches), operationIdentity: () => ruleOperation.id, proposalCoverageWrites, now })
    const issuer = createPlannerSensitivityUnits({ host, cases, scenarios, store: results, evidence: evidenceService, rules })
    metrics.read = createPlannerCriterionMetric({ host, rules, units: issuer, preview })
    const issued = await issuer.issue({ scenarioRef: selectedRef, baselineRef, parameterRef }, context)
    if (issued.status !== "ok") throw new Error(`Sensitivity units unavailable: ${JSON.stringify(issued)}`)
    const criterion = options.mode === "renewal-usd" ? { id: "renewal-difference", operator: "lte" as const, value: -20000 } : { id: "renewal-difference", operator: "gte" as const, value: 0 }
    const ruleInput = { caseRef, criterionId: criterion.id, metricRef: "planner:known-subtotal-difference", operator: criterion.operator, value: criterion.value, unit: "USD", period: wp05Horizon, evidenceRefs: sourceRefs, sensitivity: issued.value.units }
    const registered = await rules.register({ ...ruleInput, expectedRuleVersion: 0 }, context)
    if (registered.status !== "ok") throw new Error(`Criterion persistence unavailable: ${JSON.stringify(registered)}`)
    const plannerWithCriteria = createPlannerPort({ host, sources, scenarios, criteria: { evaluate: (input, trusted) => rules.evaluate({ caseRef, ...input }, trusted) } })
    const comparisonBindings = createCriterionComparisonBindings({ state, host, rules, results, authorizeCase: async () => access.allowed, verifyBinding: async () => access.allowed, verifySnapshot: () => access.allowed, operationIdentity: () => "wp05-comparison-binding", proposalCoverageWrites, now })
    const comparisonRequest = { scenarioRefs: [baselineRef, selectedRef], criteria: [criterion.id] }
    const compared = await plannerWithCriteria.compareScenarios(comparisonRequest, context)
    if (compared.status !== "ok") throw new Error(`Planner comparison unavailable: ${JSON.stringify(compared)}`)
    const comparisonStored = await results.write({ kind: "comparison", result: compared.value, caseRef, requestDigest: digestSfValue(comparisonRequest), sourceRefs, idempotencyKey: "wp05-comparison" }, context)
    if (comparisonStored.status !== "ok") throw new Error(`Comparison persistence unavailable: ${JSON.stringify(comparisonStored)}`)
    const comparisonRef = comparisonStored.value.resultRef
    const proofs = await comparisonBindings.proofs(caseRef, [criterion.id], context)
    if (proofs.status !== "ok") throw new Error(`Criterion proofs unavailable: ${proofs.status}`)
    const bound = await comparisonBindings.bind({ caseRef, resultRef: comparisonRef, request: comparisonRequest, expectedRules: proofs.value }, context)
    if (bound.status !== "ok") throw new Error(`Comparison binding unavailable: ${JSON.stringify(bound)}`)
    const bindings = createCriterionResultBindings({ state, host, rules, results, authorizeCase: async () => access.allowed, verifyBinding: async () => access.allowed, verifySnapshot: () => access.allowed, operationIdentity: () => "wp05-sensitivity-binding", proposalCoverageWrites, now })
    const exact = createPlannerExactThreshold({ units: issuer, preview })
    const exactCalls = { count: 0 }
    const sensitivity = createPlannerSensitivity({ results, resolve: issuer.resolve, revalidate: issuer.revalidate, preview, exactThreshold: (input, binding, trusted) => { exactCalls.count++; return exact(input, binding.baselineRef, trusted) }, idempotencyKey: async (digest) => `wp05-samples-${digest}` })
    const persistent = createPersistentSensitivityPort({ portfolio: { evaluate: async () => ({ status: "unavailable", reason: "portfolio-not-requested" }), sensitivity }, results, bindings, resolveBinding: issuer.resolve, idempotencyKey: async (digest) => `wp05-sensitivity-${digest}` })
    const sensitivityRequest: SensitivityRequest = { scenarioRef: selectedRef, parameterBounds: { parameterRef, minimum: options.mode === "renewal-usd" ? 10000 : 100000, maximum: options.mode === "renewal-usd" ? 70000 : 120000, steps: 2 }, criterion }
    const saved = await persistent.evaluateAndStore(sensitivityRequest, caseRef, context)
    if (saved.status !== "ok") throw new Error(`Sensitivity persistence unavailable: ${JSON.stringify(saved)}`)
    return {
      context, host, planner, plannerWithCriteria, sources, sourceRefs, basis, cases, caseRef,
      scenario, baselineScenario, selectedResult, baselineResult, selectedRef, baselineRef,
      results, persistent, comparisonBindings, comparisonRef, comparison: compared.value,
      saved: saved.value, sensitivityRequest, issuer, exact, exactCalls, preview,
      reviseRule: () => { ruleOperation.id = "wp05-criterion-revision"; return rules.register({ ...ruleInput, value: criterion.value + 1, expectedRuleVersion: 1 }, context) },
      cleanup,
    }
  } catch (error) {
    await cleanup()
    throw error
  }
}
