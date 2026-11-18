import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { Persistence } from "../../../runtime/contract.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { CostCoverageBasis, DecisionCase, ScenarioComparison, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { ScenarioCompareRequest, ScenarioRequest } from "../../../product/contracts/operations.ts"
import type { DomainPortHost, PlannerPort, PlannerSourceHost, PortResult } from "../../../product/contracts/ports.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import { createDecisionCasePort } from "../../../product/decisions/case-port.ts"
import { createCriterionComparisonBindings } from "../../../product/decisions/criterion-comparison.ts"
import { createCriterionRuleRegistry } from "../../../product/decisions/criterion-rules.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createPlannerResultPersistence } from "../../../product/planner/persistence.ts"
import { compareScenarios } from "../../../product/planner/scenario-comparison-port.ts"
import type { PlannerScenarioHost } from "../../../product/planner/scenario-comparison-port.ts"
import { createStoredPlannerScenarioHost } from "../../../product/planner/stored-scenarios.ts"

const at = "2026-11-13T00:00:00Z"
const period = { start: "2027-01-01", end: "2027-12-31" }
const caseRef = { id: "case", incarnation: "inc", version: 1 }

function ok<T>(result: PortResult<T>): T {
  expect(result.status).toBe("ok")
  if (result.status !== "ok") throw new Error(`${result.status}: ${result.reason}`)
  return result.value
}

function scenarioFixture(id: string, amount: number) {
  const sourceRef = { surface: "planner" as const, type: "planner-version", id: `plan-${id}`, incarnation: `plan-inc-${id}`, version: 1, fields: ["budget"], period, observedAt: at }
  const projection: DomainProjection = {
    context: { installationId: "install", projectId: "project", principalRef: "principal", accessRevision: "access", policyVersion: "policy", surface: "planner", currency: "USD", period, sourceRefs: [sourceRef], capabilities: [] },
    version: 1, engineVersion: "planner-runtime-v1", components: [{ id: `line-${id}`, amount, currency: "USD", period, sourceRefs: [sourceRef], evidenceState: "confirmed" }], values: [], missing: [],
  }
  const source: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", refId: `source-${id}`, installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "planner-version", recordId: sourceRef.id, incarnation: sourceRef.incarnation, version: 1, fields: sourceRef.fields, period, projectionDigest: digestSfValue(projection) } }
  source.refDigest = digestSfEvidenceRef(source)
  const request: ScenarioRequest = { baseRef: source.refId, operations: [], assumptions: [] }
  const result: ScenarioResult = {
    id, version: 1, components: projection.components, currency: "USD", horizon: period, sourceRefs: [source],
    costCoverage: { basisId: "basis", basisVersion: 1, alternativeId: id, alternativeVersion: 1, currency: "USD", horizon: period, issues: [], evaluatedSourceRefs: [source], coverageState: "complete", derivedMissingCategoryIds: [], entries: RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => categoryId === "service" ? { status: "included" as const, categoryId, componentRefs: [`line-${id}`], evidenceRefs: [source], scopeNote: "Current service budget" } : { status: "not-applicable" as const, categoryId, evidenceRefs: [source], justification: "Explicitly excluded from this controlled case fixture" }) },
    comparisonStatus: "complete", knownSubtotal: amount, total: amount, unresolvedConditions: [], restrictions: [],
  }
  return { source, projection, request, result, coverageRef: `coverage-${id}` }
}

/** Real case/result/rule/binding implementations and SQLite; only authority and source-provider boundaries are controlled. */
async function fixture() {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-planner-comparison-"))
  let database = await openLocalStore(directory)
  const control = { writes: 0, ids: 0, operation: "comparison-operation", allowed: true, sourceFresh: true }
  const persistence: Persistence = {
    transaction: (surface, work, options) => database.transaction(surface, async (snapshot) => {
      const result = await work(snapshot)
      if (result.commit) control.writes++
      return result
    }, options),
    transactionAll: (work, options) => database.transactionAll!(async (snapshots) => {
      const result = await work(snapshots)
      if (result.commit) control.writes++
      return result
    }, options),
  }
  const context = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "principal", requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
  const request = new Request("https://example.test/planner")
  const proposalCoverageWrites = new WeakSet<object>()
  const state = createSfProductState({ persistence, proposalCoverageWrites, createId: () => "state", resolveTarget: async () => ({ incarnation: caseRef.incarnation }), authorize: async () => control.allowed ? { principalRef: "principal", policyVersion: "policy", accessRevision: "access" } : undefined })
  const host: DomainPortHost = { persistence, requestFor: () => request, revalidate: async () => control.allowed, authenticate: async () => ({ id: "principal", roles: [{ surface: "planner", role: "admin" }], canWrite: true }), environment: async () => ({ at, id: () => "fixture-id", directory: [] }) }
  const baseline = scenarioFixture("baseline", 1000)
  const alternative = scenarioFixture("alternative", 900)
  const available = [baseline, alternative]
  const basis: CostCoverageBasis = { id: "basis", version: 1, decisionType: "renewal-transition-v1", categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: available.map((entry) => entry.source) }
  const authorizedEvidence = (ref: BusinessEvidenceRef) => control.sourceFresh && available.some((entry) => digestSfValue(entry.source) === digestSfValue(ref))
  const authorizeCase = async (decision: DecisionCase) => control.allowed && decision.id === caseRef.id && decision.incarnation === caseRef.incarnation && decision.participants.includes("principal")
  const evidence: BusinessContextService = {
    resolve: async (ref) => ({ state: authorizedEvidence(ref) ? "fresh" as const : "stale" as const, ref, accessRevision: "access", checkedAt: at }),
    context: async ({ refs }) => refs.map((ref) => ({ state: authorizedEvidence(ref) ? "fresh" as const : "stale" as const, ref, accessRevision: "access", checkedAt: at })),
    recall: async () => [], emitFromLedger: async () => { throw new Error("Unexpected ledger emission") },
  }
  const decision: DecisionCase = { ...caseRef, state: "comparing", objective: "Compare current plans", currency: "USD", horizon: period, criteria: [{ id: "cap", description: "Annual service budget cap", required: true }], participants: ["principal"], sourceRefs: basis.sourceRefs, alternatives: available.map((entry) => ({ id: entry.result.id, version: 1, title: entry.result.id, scenario: entry.request, result: entry.result })), costCoverageBases: [basis], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
  const seeded = await state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "seed", commandDigest: digestSfValue(decision), targetRef: caseRef.id, targetIncarnation: caseRef.incarnation }, async (staged) => { staged.cases.case = decision; return { commit: true, value: true } })
  expect(seeded.status).toBe("ok")
  const store = createSfDecisionResultStore({ state, host, authorizeCase, verifySources: async (_value, refs) => refs.every(authorizedEvidence), createId: () => `result-${++control.ids}`, now: () => at })
  const resolveCase = async () => ({ status: "ok" as const, value: caseRef })
  const saveScenario = createPlannerResultPersistence({ store, resolveCase })
  const scenarioRefs = [] as string[]
  for (const entry of available) scenarioRefs.push(ok(await saveScenario({ kind: "scenario", request: entry.request, result: entry.result }, `seed-${entry.result.id}`, context)).resultRef)
  const cases = createDecisionCasePort({ state, host, creationTarget: { ref: caseRef.id, incarnation: caseRef.incarnation }, operationIdentity: () => control.operation, authorizeCase, evidence, createId: () => "unused", now: () => at })
  const scenarios = createStoredPlannerScenarioHost({ store, cases, coverageRefFor: (_ref, entry) => `coverage-${entry.id}`, planner: { compareForecast: async (input) => {
    const current = available.find((entry) => entry.source.refId === input.baseRef)
    if (!current || !control.sourceFresh) return { status: "unavailable", reason: "fixture-source-unavailable" }
    return { status: "ok", value: { baseline: current.projection, candidate: current.projection, sourceRefs: [current.source], gaps: [], explanation: "Current authorized projection", analysisBasis: "domain", domainApplied: false, knownDifference: 0, completeDifference: 0, comparison: { baselineResultRef: input.baseRef, alternativeResultRef: input.candidateRef, costCoverageRefs: [current.coverageRef], criterionResults: [], unresolvedConditions: [], comparisonStatus: "complete", knownDifference: 0, completeDifference: 0 } } }
  } } })
  const sources: PlannerSourceHost = {
    resolveForecastSource: async (reference) => { const found = available.find((entry) => entry.source.refId === reference); return found && control.sourceFresh ? { status: "ok", value: { versionId: found.source.target.recordId, evidence: found.source } } : { status: "unavailable", reason: "fixture-source-unavailable" } },
    resolveForecastCoverage: async (reference) => { const found = available.find((entry) => entry.coverageRef === reference); return found && control.sourceFresh ? { status: "ok", value: { coverageRef: reference, basis, assessment: found.result.costCoverage } } : { status: "unavailable", reason: "fixture-coverage-unavailable" } },
  }
  const rules = createCriterionRuleRegistry({ state, host, authorizeCase, authorizeRule: async () => control.allowed, verifyEvidence: async (rule) => rule.evidenceRefs.every(authorizedEvidence), verifySnapshot: () => control.sourceFresh, proposalCoverageWrites, operationIdentity: () => control.operation, now: () => at,
    readMetric: async (input, trusted) => {
      const stored = await store.readHistoricalScenario({ resultRef: input.scenarioRef }, trusted)
      if (stored.status !== "ok") return stored
      if (stored.value.kind !== "scenario") return { status: "unavailable", reason: "fixture-metric-unavailable" }
      return { status: "ok", value: { ...input, value: stored.value.result.knownSubtotal, unit: "USD", period, evidenceRefs: stored.value.sourceRefs, state: "confirmed", engineVersion: "planner-runtime-v1" } }
    }, verifyMetric: async (metric) => metric.evidenceRefs.every(authorizedEvidence),
  })
  const replay: Pick<PlannerPort, "compareScenarios"> = { compareScenarios: (input, trusted) => compareScenarios({ host, sources, scenarios, criteria: { evaluate: (criterion, binding) => rules.evaluate({ ...criterion, caseRef }, binding) } }, input, trusted) }
  const bindings = createCriterionComparisonBindings({ state, host, rules, results: store, authorizeCase, proposalCoverageWrites, operationIdentity: () => control.operation, now: () => at, verifySnapshot: () => control.sourceFresh,
    verifyBinding: async (binding, result, trusted) => {
      const current = await replay.compareScenarios(binding.request, trusted)
      return current.status === "ok" && result.kind === "comparison" && digestSfValue(current.value) === digestSfValue(result.result)
    },
  })
  const persist = (overrides: Partial<Parameters<typeof createPlannerResultPersistence>[0]> = {}) => createPlannerResultPersistence({ store, scenarios, comparisonBindings: bindings, replay, resolveCase, ...overrides })
  const comparison = async (criteria: readonly string[] = []) => { const input: ScenarioCompareRequest = { scenarioRefs, criteria }; return { kind: "comparison" as const, request: input, result: ok(await replay.compareScenarios(input, context)) } }
  const snapshot = () => persistence.transactionAll!(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))
  const readState = async () => { const current = await state.read(request, "cases", (value) => value); if (current.status !== "ok") throw new Error("Fixture state unavailable"); return current.value }
  const registerRule = async (value: number, expectedRuleVersion = 0) => {
    control.operation = `rule-${expectedRuleVersion + 1}`
    const saved = ok(await rules.register({ caseRef, criterionId: "cap", metricRef: "annual-service-budget", operator: "lte", value, unit: "USD", period, evidenceRefs: [alternative.source], expectedRuleVersion }, context))
    control.operation = "comparison-operation"
    return saved
  }
  return { context, control, store, scenarios, bindings, rules, replay, persist, comparison, snapshot, readState, registerRule,
    reopen: async () => { await database.dispose(); database = await openLocalStore(directory) },
    dispose: async () => { await database.dispose(); await rm(directory, { recursive: true, force: true }) },
  }
}

test("comparison persistence refuses tampered totals, coverage references and criterion outcomes before any write", async () => {
  const f = await fixture()
  try {
    const input = await f.comparison()
    const before = await f.snapshot()
    const writes = f.control.writes
    const tampered: ScenarioComparison[] = [
      { ...input.result, knownDifference: 777 },
      { ...input.result, costCoverageRefs: ["forged-coverage"] },
      { ...input.result, criterionResults: [{ criterionId: "cap", state: "satisfied", reason: "forged" }] },
    ]
    for (const [index, result] of tampered.entries()) expect(await f.persist()({ ...input, result }, `tamper-${index}`, f.context)).toEqual({ status: "stale", reason: "comparison-replay-changed" })
    expect(await f.persist()({ ...input, result: { ...input.result, alternativeResultRef: input.request.scenarioRefs[0]! } }, "wrong-reference", f.context)).toEqual({ status: "conflict", reason: "comparison-reference-mismatch" })
    expect(f.control.writes).toBe(writes)
    expect(await f.snapshot()).toEqual(before)
  } finally { await f.dispose() }
})

test("criteria require both replay and durable criterion binding with zero writes when either is missing", async () => {
  const f = await fixture()
  try {
    await f.registerRule(1000)
    const input = await f.comparison(["cap"])
    const before = await f.snapshot()
    const writes = f.control.writes
    for (const [index, overrides] of [{ comparisonBindings: undefined }, { replay: undefined }, { comparisonBindings: undefined, replay: undefined }].entries()) {
      expect(await f.persist(overrides)(input, `missing-authority-${index}`, f.context)).toEqual({ status: "unavailable", reason: "comparison-criterion-binding-unavailable" })
    }
    expect(f.control.writes).toBe(writes)
    expect(await f.snapshot()).toEqual(before)
  } finally { await f.dispose() }
})

test("comparison without criteria persists through real scenarios and SQLite, retries idempotently and survives reopen", async () => {
  const f = await fixture()
  try {
    const input = await f.comparison()
    expect(input.result).toMatchObject({ comparisonStatus: "complete", knownDifference: -100, completeDifference: -100, criterionResults: [] })
    const persist = f.persist({ comparisonBindings: undefined, replay: undefined })
    const saved = ok(await persist(input, "no-criteria", f.context))
    const current = ok(await f.store.read({ resultRef: saved.resultRef, kind: "comparison" }, f.context))
    expect(current.result).toEqual(input.result)
    expect(current.sourceRefs).toHaveLength(2)
    const beforeRetry = await f.snapshot()
    const writes = f.control.writes
    expect(ok(await persist(input, "no-criteria", f.context))).toEqual(saved)
    expect(f.control.writes).toBe(writes)
    expect(await f.snapshot()).toEqual(beforeRetry)
    await f.reopen()
    expect(ok(await f.store.read({ resultRef: saved.resultRef, kind: "comparison" }, f.context))).toEqual(current)
  } finally { await f.dispose() }
})

test("real WP11 rules bind a comparison, survive reopen and refuse a second binding or a stale rule", async () => {
  const f = await fixture()
  try {
    const rule = await f.registerRule(1000)
    const input = await f.comparison(["cap"])
    expect(input.result.criterionResults).toEqual([{ criterionId: "cap", state: "satisfied", reason: "criterion-satisfied" }])
    const saved = ok(await f.persist()(input, "with-criteria", f.context))
    const bound = ok(await f.bindings.read({ caseRef, resultRef: saved.resultRef }, f.context))
    expect(bound.rules).toMatchObject([{ criterionId: "cap", ruleRef: rule.ruleRef, version: 1 }])
    const beforeRetry = await f.snapshot()
    const writes = f.control.writes
    expect(ok(await f.persist()(input, "with-criteria", f.context))).toEqual(saved)
    expect(f.control.writes).toBe(writes)
    expect(await f.snapshot()).toEqual(beforeRetry)
    await f.reopen()
    expect(ok(await f.bindings.read({ caseRef, resultRef: saved.resultRef }, f.context))).toEqual(bound)
    f.control.operation = "different-binding-operation"
    expect(await f.bindings.bind({ caseRef, resultRef: saved.resultRef, request: input.request, expectedRules: bound.rules }, f.context)).toEqual({ status: "conflict", reason: "comparison-binding-unavailable" })
    expect(f.control.writes).toBe(writes)
    expect(await f.snapshot()).toEqual(beforeRetry)
    await f.registerRule(800, 1)
    expect(await f.bindings.read({ caseRef, resultRef: saved.resultRef }, f.context)).toEqual({ status: "stale", reason: "comparison-rule-or-source-changed" })
    const afterRuleChange = await f.snapshot()
    const writesAfterRuleChange = f.control.writes
    expect(await f.persist()(input, "stale-comparison", f.context)).toEqual({ status: "stale", reason: "comparison-replay-changed" })
    expect(f.control.writes).toBe(writesAfterRuleChange)
    expect(await f.snapshot()).toEqual(afterRuleChange)
  } finally { await f.dispose() }
})

test("a postwrite binding failure reports persisted-but-unbound and a retry repairs the same result", async () => {
  const f = await fixture()
  try {
    await f.registerRule(1000)
    const input = await f.comparison(["cap"])
    const before = await f.readState()
    const writes = f.control.writes
    const unavailable = { ...f.bindings, bind: async () => ({ status: "unavailable" as const, reason: "injected-binding-provider-outage" }) }
    expect(await f.persist({ comparisonBindings: unavailable })(input, "binding-recovery", f.context)).toEqual({ status: "unavailable", reason: "comparison-persisted-but-binding-unavailable" })
    const after = await f.readState()
    const saved = Object.values(after.decisionResults ?? {}).filter((entry) => entry.kind === "comparison")
    expect(saved).toHaveLength(1)
    expect(saved[0]!.result).toEqual(input.result)
    expect(after.preferences).toEqual(before.preferences)
    expect(f.control.writes).toBe(writes + 1)
    expect(await f.bindings.read({ caseRef, resultRef: saved[0]!.resultRef }, f.context)).toEqual({ status: "unavailable", reason: "comparison-binding-unavailable" })
    const recovered = ok(await f.persist()(input, "binding-recovery", f.context))
    expect(recovered.resultRef).toBe(saved[0]!.resultRef)
    expect(f.control.writes).toBe(writes + 2)
    expect(ok(await f.bindings.read({ caseRef, resultRef: recovered.resultRef }, f.context)).rules).toHaveLength(1)
    expect(Object.values((await f.readState()).decisionResults ?? {}).filter((entry) => entry.kind === "comparison")).toHaveLength(1)
  } finally { await f.dispose() }
})

test("current scenario content and case identity are rechecked before comparison storage", async () => {
  const f = await fixture()
  try {
    const input = await f.comparison()
    const before = await f.snapshot()
    const writes = f.control.writes
    const scenarios: PlannerScenarioHost = { resolve: async (reference, trusted) => {
      const current = await f.scenarios.resolve(reference, trusted)
      if (current.status !== "ok") return current
      return { status: "ok", value: { ...current.value, result: { ...current.value.result, id: "changed-scenario" } } }
    } }
    expect(await f.persist({ scenarios })(input, "changed-source", f.context)).toEqual({ status: "stale", reason: "scenario-changed" })
    let reads = 0
    expect(await f.persist({ resolveCase: async () => ({ status: "ok", value: { ...caseRef, version: ++reads === 1 ? 1 : 2 } }) })(input, "changed-case", f.context)).toEqual({ status: "stale", reason: "comparison-case-changed" })
    expect(f.control.writes).toBe(writes)
    expect(await f.snapshot()).toEqual(before)
  } finally { await f.dispose() }
})
