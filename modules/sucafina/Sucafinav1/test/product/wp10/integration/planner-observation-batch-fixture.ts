import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { DecisionCase, CostCoverageBasis } from "../../../../product/contracts/decisions.ts"
import type { DomainPortHost, PortResult } from "../../../../product/contracts/ports.ts"
import { compareScenarios } from "../../../../product/planner/scenario-comparison-port.ts"
import { createSfPlannerObservationBatch } from "../../../../../../../apps/cli/src/sucafina-product/planner-observation-batch.ts"
import { sfPlannerCaseReadAdmission } from "../../../../../../../apps/cli/src/sucafina-product/planner-case-read-batch.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"
import type { compositionTestDeadline } from "./composition-test-deadline.ts"

// The data below is a declared SQLite fixture. Scenarios, stored results, human
// criteria, units and the final choice are produced by their real domain APIs.
export async function plannerObservationFixture(deadline: ReturnType<typeof compositionTestDeadline>, mixed = false, options: { sourceOnly?: boolean } = {}) {
  const fixture = await deadline.phase("fixture.initialize", async () => {
    const value = await financialCompositionFixture({ signal: deadline.signal, beforeEnvironment: async () => deadline.check(), humanActions: ["decisions.portfolio.read"] })
    deadline.own(() => value.dispose())
    return value
  })
  const call = await fixture.read()
  deadline.own(() => fixture.authority.ui.finish(call))
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const caseRef = { id: "metric-case", incarnation: "metric-incarnation", version: 1 }
  await fixture.persistence.transaction("planner", async (snapshot) => {
    snapshot.data.versions = [100, 80].map((amount, index) => ({ id: `v${index}`, name: index ? "Candidate" : "Baseline", year: 2026, closed: 0,
      lines: [{ id: "line", sec: "opex", el: "licenses", cur: "USD", b: Array(12).fill(amount), a: Array(12).fill(null), f: Array(12).fill(amount) }],
      fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }))
    return { commit: true, value: undefined }
  })
  const sources = [] as CostCoverageBasis["sourceRefs"][number][]
  for (const id of ["v0", "v1"]) {
    const issued = await fixture.business.plannerProduct.issueSource(id, call)
    if (issued.status !== "ok") throw new Error(`Actual metric source ${id} unavailable: ${issued.reason}`)
    sources.push(issued.value.evidence)
  }
  const basis: CostCoverageBasis = { id: "metric-basis", version: 1, decisionType: "renewal-transition-v1",
    categoryIds: ["training"], additionalCategoryIds: [], sourceRefs: sources }
  const companion = mixed ? await procurementSource(fixture, call, period) : undefined
  const initial: DecisionCase = { ...caseRef, state: "comparing", objective: "Read deterministic criterion metadata", horizon: period, currency: "USD",
    participants: ["person"], criteria: [{ id: "cost", description: "Known subtotal difference", required: true }], sourceRefs: [...sources, ...(companion ? [companion] : [])],
    alternatives: [], costCoverageBases: [basis], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
  const seeded = await fixture.authority.state.transaction(fixture.request(), { namespace: "cases", expectedStorageVersion: 0,
    targetRef: fixture.authority.creationTarget.ref, targetIncarnation: fixture.authority.creationTarget.incarnation,
    idempotencyKey: "metric-case", commandDigest: digestSfValue(initial) }, async (state) => {
    state.cases[caseRef.id] = initial
    return { commit: true, value: true }
  })
  if (seeded.status !== "ok") throw new Error("Metric case fixture unavailable")
  fixture.business.bindForecastCoverage(async (reference, context) => {
    const source = await fixture.business.plannerSources.resolveForecastSource(reference, context)
    if (source.status !== "ok") return source
    return { status: "ok", value: { coverageRef: "fixture:metric-pending-coverage", basis,
      assessment: { basisId: basis.id, basisVersion: basis.version, alternativeId: source.value.versionId === "v0" ? "baseline" : "candidate", alternativeVersion: 1,
        currency: "USD", horizon: period, issues: ["fixture-training-unresolved"], evaluatedSourceRefs: [source.value.evidence], coverageState: "pending",
        entries: [{ status: "pending", categoryId: "training", reason: "Fixture has no training evidence" }], derivedMissingCategoryIds: ["training"] } } }
  })
  const produced = await deadline.phase("fixture.produce-scenarios", () => fixture.business.withCase(call, caseRef, {}, async () => {
    const alternatives: DecisionCase["alternatives"][number][] = []
    const resultRefs: string[] = []
    for (const [index, source] of sources.entries()) {
      const scenario = { baseRef: source.refId, operations: index && !options.sourceOnly ? [{ kind: "replace" as const, targetRef: "line:1", amount: 80,
        currency: "USD", period: { start: "2026-01-01", end: "2026-01-31" } }] : [], assumptions: [] }
      const result = await fixture.business.planner.simulateScenario(scenario, call)
      if (result.status !== "ok") return result
      const saved = await fixture.business.results.write({ kind: "scenario", result: result.value, caseRef,
        requestDigest: digestSfValue(scenario), sourceRefs: result.value.sourceRefs, idempotencyKey: `metric-result-${index}` }, call)
      if (saved.status !== "ok") return saved
      resultRefs.push(saved.value.resultRef)
      alternatives.push({ id: index ? "candidate" : "baseline", version: 1, title: index ? "Candidate" : "Baseline", scenario, result: result.value })
    }
    return { status: "ok", value: { alternatives, resultRefs } }
  }))
  if (produced.status !== "ok") throw new Error(`Actual metric scenario production failed: ${produced.reason}`)
  const current = await fixture.authority.state.read(fixture.request(), "cases", (state) => state.cases[caseRef.id])
  if (current.status !== "ok") throw new Error("Metric fixture versions unavailable")
  const bound = await fixture.authority.state.transaction(fixture.request(), { namespace: "cases", expectedStorageVersion: current.storageVersion,
    targetRef: caseRef.id, targetIncarnation: caseRef.incarnation, idempotencyKey: "metric-alternatives", commandDigest: digestSfValue(produced.value.alternatives) }, async (state) => {
    state.cases[caseRef.id] = { ...initial, alternatives: produced.value.alternatives }
    return { commit: true, value: true }
  })
  if (bound.status !== "ok") throw new Error("Produced metric alternatives could not be bound")
  const ruleInput = { caseRef, criterionId: "cost", metricRef: "planner:known-subtotal-difference", operator: "lte" as const, value: 0,
    unit: "USD", period, evidenceRefs: sources, expectedRuleVersion: 0 }
  const human = await fixture.authority.human.admit(fixture.request(), "decisions.criteria", ruleInput)
  if (human.status !== "ok") throw new Error("Actual human criterion admission unavailable")
  const rule = await fixture.business.withCase(human.value, caseRef, {}, () => fixture.portfolio.rules.register(ruleInput, human.value))
    .finally(() => fixture.authority.human.finish(human.value))
  if (rule.status !== "ok") throw new Error(`Actual criterion registration failed: ${rule.reason}`)
  const scenarios = fixture.business.plannerProduct.scenarios
  if (!scenarios) throw new Error("Actual stored scenario resolver unavailable")
  return { ...fixture, stateRequest: fixture.request, call, caseRef, sources, scenarios, period, companion,
    request: { caseRef, criterionId: "cost", ruleRef: rule.value.ruleRef, ruleVersion: rule.value.version,
      metricRef: "planner:known-subtotal-difference", baselineRef: produced.value.resultRefs[0]!, scenarioRef: produced.value.resultRefs[1]! } }
}



export function observePlannerPhase(fixture: Awaited<ReturnType<typeof plannerObservationFixture>>,
  deadline: ReturnType<typeof compositionTestDeadline>) {
  const faults: { afterRoot?: () => Promise<void>; afterAuthority?: (allowed: boolean) => void; afterEnvelope?: () => void;
    actor?: boolean; actorObserved?: boolean } = {}
  const counts = { physical: 0, roots: 0, sources: 0, sourcesInRoot: 0, coverage: 0, scalar: 0, batch: 0 }
  const transaction = fixture.store.transaction, all = fixture.store.transactionAll, root = fixture.store.readSnapshotRoot
  const source = fixture.business.plannerSources.resolveForecastSource, coverage = fixture.business.plannerSources.resolveForecastCoverage
  const scalar = fixture.scenarios.resolve, batch = fixture.scenarios.resolveMany, stateRead = fixture.authority.state.read
  fixture.store.transaction = (surface, work, options) => {
    if (!fixture.store.currentSnapshots()) counts.physical++
    return transaction(surface, work, options)
  }
  fixture.store.transactionAll = (work, options) => { counts.physical++; return all(work, options) }
  fixture.store.readSnapshotRoot = async (work, options) => {
    counts.physical++; counts.roots++
    const result = await root(work, options)
    const effect = faults.afterRoot
    faults.afterRoot = undefined
    await effect?.()
    return result
  }
  fixture.business.plannerSources.resolveForecastSource = (...args) => {
    counts.sources++
    if (fixture.store.currentSnapshots()) counts.sourcesInRoot++
    return source(...args)
  }
  fixture.business.plannerSources.resolveForecastCoverage = (...args) => { counts.coverage++; return coverage(...args) }
  fixture.scenarios.resolve = (...args) => { counts.scalar++; return scalar(...args) }
  if (batch) fixture.scenarios.resolveMany = (...args) => { counts.batch++; return batch(...args) }
  fixture.authority.state.read = async (request, namespace, read) => {
    const value = await stateRead(request, namespace, read)
    if (!fixture.store.currentSnapshots()) {
      const effect = faults.afterEnvelope
      faults.afterEnvelope = undefined
      effect?.()
    }
    return value
  }
  const host: DomainPortHost = { ...fixture.business.host,
    revalidate: async (call) => { const allowed = await fixture.business.host.revalidate(call); faults.afterAuthority?.(allowed); return allowed },
    authenticate: async (request, context) => {
      const value = await fixture.business.host.authenticate(request, context)
      if (!value || !faults.actor) return value
      const changed = { ...value, canWrite: !value.canWrite }
      faults.actorObserved = changed.canWrite !== value.canWrite
      return changed
    },
  }
  const input = { host, state: fixture.authority.state, sources: fixture.business.plannerSources,
    readerIdentity: () => fixture.business.evidence.current, lockedSourceFences: fixture.business.lockedSourceFences }
  const observe = createSfPlannerObservationBatch({ ...input, admissions: [sfPlannerCaseReadAdmission(input)],
    readerIdentities: () => [fixture.scenarios, ...Object.entries(fixture.scenarios).flatMap(([key, value]) => [key, value]),
      fixture.business.plannerSources, ...Object.entries(fixture.business.plannerSources).flatMap(([key, value]) => [key, value])] })
  const request = { scenarioRefs: [fixture.request.baselineRef, fixture.request.scenarioRef], criteria: [] as string[] }
  const phase = { kind: "comparison" as const, caseRef: fixture.caseRef, request }
  const canonical = (incoming = request) => {
    const selected = { caseRef: fixture.caseRef, request: incoming }
    return fixture.business.withCase(fixture.call, fixture.caseRef, {}, () =>
      fixture.business.withScenarioObservation(selected, fixture.call, () =>
        compareScenarios({ host: fixture.business.host, sources: fixture.business.plannerSources, scenarios: fixture.scenarios }, incoming, fixture.call)))
  }
  const snapshots = () => fixture.store.transactionAll(async (value) => ({ commit: false, value: structuredClone(value) }))
  const capture = async () => ({ snapshots: await snapshots(),
    state: await fixture.authority.state.read(fixture.stateRequest(), "cases", (state, actor) => ({ state, actor })) })
  deadline.own(() => {
    fixture.store.transaction = transaction
    fixture.store.transactionAll = all
    fixture.store.readSnapshotRoot = root
    fixture.business.plannerSources.resolveForecastSource = source
    fixture.business.plannerSources.resolveForecastCoverage = coverage
    fixture.scenarios.resolve = scalar
    fixture.scenarios.resolveMany = batch
    fixture.authority.state.read = stateRead
  })
  return { faults, counts, host, observe, phase, canonical, snapshots, capture,
    reset: () => { for (const key of Object.keys(counts) as (keyof typeof counts)[]) counts[key] = 0 } }
}

async function procurementSource(fixture: Awaited<ReturnType<typeof financialCompositionFixture>>,
  call: Awaited<ReturnType<typeof fixture.read>>, period: { start: string; end: string }) {
  await fixture.persistence.transaction("procurement", async (snapshot) => {
    snapshot.data.store = { settings: { currency: "USD", fxRates: [], minQuotes: 2, techWeight: 80, commWeight: 20,
      criteria: [{ name: "Technical suitability", weight: 1 }], commCriteria: [{ name: "Price", weight: 1, auto: true }], requireActiveSupplier: true },
      suppliers: [], requests: { "MIXED-1": { version: 1, by: "person", request: {
        number: "MIXED-1", status: "src_pending", createdBy: "person", createdAt: "2026-01-01T00:00:00.000Z",
        pr: { title: "Companion purchase source", type: "service", description: "Explicit source fixture", estAmount: 140,
          costCenter: "TEST", needBy: "2026-12-31", justification: "Observe the current mixed case", recurring: false },
        sourcing: { evaluator: "person", selectedId: null, approvalBaseCurrency: "USD", fxSnapshot: { USD: 1 }, quotes: [] },
      } } } }
    return { commit: true, value: undefined }
  })
  const intent = { purpose: "work-selection", period }
  const selection = await fixture.authority.ui.admit(fixture.request(), "sf_work_list", digestSfValue(intent))
  if (selection.status !== "ok" || !await fixture.authority.ui.validate(selection.value, "sf_work_list", digestSfValue(intent)))
    throw new Error("Actual Procurement selection admission unavailable")
  try {
    const selected = await fixture.business.procurementSelections.create(selection.value, period)
    if (selected.status !== "ok") throw new Error("Actual Procurement period selection unavailable")
  } finally { fixture.authority.ui.finish(selection.value) }
  const issued = await fixture.business.individual.issue("procurement-request", "MIXED-1", call)
  if (issued.status !== "ok") throw new Error(`Actual mixed source unavailable: ${issued.reason}`)
  const resolved = await fixture.business.individual.resolve(issued.value, call)
  if (resolved.status !== "ok") throw new Error(`Actual mixed projection unavailable: ${resolved.reason}`)
  return resolved.value.evidence
}

function ok<T>(result: PortResult<T>, label: string): T {
  if (result.status !== "ok") throw new Error(`${label}: ${JSON.stringify(result)}`)
  return result.value
}

// Real SQLite, scoped Planner source, C08 and consumed UI authority. The empty
// case is input data; both memory passes use the actual case/Atlas composition.
export async function memoryObservationFixture(deadline: ReturnType<typeof compositionTestDeadline>) {
  const fixture = await financialCompositionFixture({ atlas: true, signal: deadline.signal,
    beforeEnvironment: async () => deadline.check() })
  deadline.own(() => fixture.dispose())
  await fixture.persistence.transaction("planner", async (snapshot) => {
    snapshot.data.versions = [{ id: "memory-source", year: 2026, closed: 0,
      lines: [{ id: "line", name: "Recorded service", sec: "opex", el: "licenses", cur: "USD",
        b: Array(12).fill(100), a: Array(12).fill(null), f: Array(12).fill(100) }],
      fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }]
    return { commit: true, value: undefined }
  })
  await fixture.persistence.initializeSources("planner")
  const call = await fixture.read()
  deadline.own(() => fixture.authority.ui.finish(call))
  const source = ok(await fixture.business.plannerProduct.issueSource("memory-source", call), "Issue actual Planner source")
  const caseRef = { id: "memory-case", incarnation: "memory-case-incarnation", version: 1 }
  const initial: DecisionCase = { ...caseRef, state: "draft", objective: "Inspect current costs", currency: "USD",
    horizon: { start: "2026-01-01", end: "2026-12-31" }, criteria: [{ id: "cost", description: "Preserve full coverage", required: true }],
    participants: ["person"], sourceRefs: [source.evidence], alternatives: [], costCoverageBases: [], assumptions: [], questions: [],
    choices: [], preparedChanges: [], receipts: [], ledger: [] }
  const seeded = await fixture.authority.state.transaction(fixture.request("memory-case-empty"), { namespace: "cases", expectedStorageVersion: 0,
    targetRef: fixture.authority.creationTarget.ref, targetIncarnation: fixture.authority.creationTarget.incarnation,
    idempotencyKey: "memory-case-empty", commandDigest: digestSfValue(initial) }, async (state) => {
    state.cases[initial.id] = initial
    return { commit: true, value: true }
  })
  if (seeded.status !== "ok") throw new Error(`Empty case unavailable: ${JSON.stringify(seeded)}`)
  const selection = { currentCase: caseRef, query: "Inspect only this case and the empty authorized precedent scope.",
    recallScope: { cases: [], period: initial.horizon, includeHistorical: false } }
  // This adapter test does not start a model or manufacture a grant/output.
  const request = { caseRef, objective: selection.query, profileId: "sf_portfolio", profileVersion: "fixture",
    skillId: "sf-consultar-memoria-decisoria", skillVersion: "fixture", manifestDigest: "fixture",
    outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: ["sf_decision_recall"] }
  const dependencies = { cases: fixture.business.cases, planner: fixture.business.planner,
    procurement: fixture.business.procurement, context: fixture.business.context,
    host: fixture.business.host, caseRecall: fixture.business.caseRecall }
  return { ...fixture, stateRequest: fixture.request, call, caseRef, initial, seeded, selection, request, dependencies }
}
