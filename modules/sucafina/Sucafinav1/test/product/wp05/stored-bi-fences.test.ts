import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createStoredScenarioBiProjection } from "../../../product/analytics/stored-scenario.ts"
import { bindStoredScenarioBiPort } from "../../../product/analytics/scenario.ts"
import { bindPortfolioBiPort, bindStoredPortfolioBiPort } from "../../../product/analytics/portfolio.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { DecisionCase, PortfolioResult, ScenarioComparison, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { SensitivityResult } from "../../../product/contracts/outputs.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"

const period = { start: "2027-01-01", end: "2027-12-31" }
const request = { viewId: "BI09", selectionRef: "selection", period }

/** Real SQLite result persistence and UI admission; callbacks below exercise the host adapter boundary. */
async function fixture() {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "wp05-bi-fence-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const identity = { installationId: "i", projectId: "p", principalRef: "u", policyVersion: "v", accessRevision: "a" }
  const ui = createSfUiAuthority({ authorize: async () => identity, commandIdentity: async () => "command", createId: () => "request", now: () => Date.parse("2026-11-13T00:00:00Z") })
  const admitted = await ui.admit(new Request("https://example.test/wp05"), "sf_bi_view", digestSfValue(request))
  if (admitted.status !== "ok" || !await ui.validate(admitted.value, "sf_bi_view", digestSfValue(request))) throw new Error("UI admission unavailable")
  const context = admitted.value
  const source = ui.requestFor(context)
  if (!source) throw new Error("UI source unavailable")
  const caseRef = { id: "case", incarnation: "case-incarnation", version: 1 }
  const state = createSfProductState({ persistence: store, createId: () => "state", resolveTarget: async () => ({ incarnation: caseRef.incarnation }), authorize: async () => identity })
  const current: DecisionCase = { ...caseRef, state: "comparing", objective: "decision", currency: "USD", horizon: period, criteria: [], participants: ["u"], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
  const seeded = await state.transaction(source, { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "seed", commandDigest: digestSfValue(current), targetRef: caseRef.id, targetIncarnation: caseRef.incarnation }, async (value) => { value.cases[caseRef.id] = current; return { commit: true, value: true } })
  if (seeded.status !== "ok") throw new Error("Case seed unavailable")
  const ids = { next: 0 }
  const results = createSfDecisionResultStore({ state, host: { requestFor: (binding) => binding.kind === "ui" ? ui.requestFor(binding) : undefined, revalidate: (binding) => binding.kind === "ui" ? ui.revalidate(binding) : Promise.resolve(false) }, authorizeCase: async (value) => value.id === caseRef.id && value.participants.includes("u"), verifySources: async (_value, refs) => refs.length === 0, createId: () => `result-${++ids.next}`, now: () => "2026-11-13T00:00:00Z" })
  const scenario: ScenarioResult = { id: "alternative", version: 1, components: [], currency: "USD", horizon: period, sourceRefs: [], unresolvedConditions: ["training"], restrictions: [], comparisonStatus: "conditioned", knownSubtotal: 210000, total: null, costCoverage: { basisId: "basis", basisVersion: 1, alternativeId: "alternative", alternativeVersion: 1, currency: "USD", horizon: period, issues: [], evaluatedSourceRefs: [], coverageState: "pending", entries: [], derivedMissingCategoryIds: ["training"] } }
  const savedScenario = await results.write({ kind: "scenario", result: scenario, caseRef, requestDigest: digestSfValue(scenario), sourceRefs: [], idempotencyKey: "scenario" }, context)
  if (savedScenario.status !== "ok" || savedScenario.value.kind !== "scenario") throw new Error("Scenario persistence unavailable")
  const comparison: ScenarioComparison = { baselineResultRef: "baseline", alternativeResultRef: savedScenario.value.resultRef, costCoverageRefs: ["coverage"], criterionResults: [], unresolvedConditions: ["training"], comparisonStatus: "conditioned", knownDifference: 30000, completeDifference: null }
  const savedComparison = await results.write({ kind: "comparison", result: comparison, caseRef, requestDigest: digestSfValue(comparison), sourceRefs: [], idempotencyKey: "comparison" }, context)
  if (savedComparison.status !== "ok" || savedComparison.value.kind !== "comparison") throw new Error("Comparison persistence unavailable")
  const projection: DomainProjection = { context: { ...identity, surface: "planner", period: structuredClone(period), currency: "USD", sourceRefs: [], capabilities: [] }, version: 1, engineVersion: "planner", values: [], components: [], missing: [] }
  return {
    context, results, projection, caseRef, scenario, comparison, scenarioRecord: savedScenario.value, comparisonRecord: savedComparison.value,
    selection: { selectionRef: "selection", scenarioResultRef: savedScenario.value.resultRef, comparisonRef: savedComparison.value.resultRef },
    cleanup: async () => { ui.finish(context); await store.dispose(); await rm(directory, { recursive: true, force: true }) },
  }
}

test("persisted BI rejects a reused result object changed between its independent observations", async () => {
  const value = await fixture()
  try {
    const retained = structuredClone(value.scenarioRecord)
    const read = createStoredScenarioBiProjection({
      results: { read: async (input, context) => {
        if (input.kind === "scenario") return { status: "ok", value: retained }
        retained.result.knownSubtotal = 999999
        return value.results.read(input, context)
      } },
      readProjection: async () => ({ status: "ok", value: value.projection }),
      revalidateProjection: async () => true,
    })
    expect(await read(value.selection, value.context)).toEqual({ status: "stale", reason: "scenario-or-projection-changed" })
    const persisted = await value.results.read({ kind: "scenario", resultRef: value.selection.scenarioResultRef }, value.context)
    expect(persisted).toMatchObject({ status: "ok", value: { result: { knownSubtotal: 210000 } } })
  } finally { await value.cleanup() }
})

test("persisted BI rejects mutation of selection, projection or case by either host fence", async () => {
  const value = await fixture()
  try {
    for (const target of ["selection", "projection", "case"] as const) {
      for (const fence of [1, 2]) {
        const calls = { count: 0 }
        const read = createStoredScenarioBiProjection({ results: value.results, readProjection: async () => ({ status: "ok", value: value.projection }), revalidateProjection: async (selection, projection, caseRef) => {
          if (++calls.count === fence) {
            if (target === "selection") selection.selectionRef = "other"
            if (target === "projection") projection.version = 2
            if (target === "case") caseRef.version = 2
          }
          return true
        } })
        expect(await read(value.selection, value.context)).toEqual({ status: "stale", reason: fence === 1 ? "projection-changed" : "scenario-or-projection-changed" })
        expect(value.selection.selectionRef).toBe("selection")
        expect(value.projection.version).toBe(1)
        expect(value.caseRef.version).toBe(1)
      }
    }
  } finally { await value.cleanup() }
})

test("persisted BI detects a sensitivity object mutated by its reader on replay", async () => {
  const value = await fixture()
  try {
    const sensitivity: SensitivityResult = { scenarioRef: value.selection.scenarioResultRef, parameterRef: "training", bounds: { minimum: 0, maximum: 1, steps: 1 }, evaluated: [], threshold: null, thresholdEvidence: { state: "unavailable", reason: "missing" }, unit: "USD", parameterUnit: "USD", resultUnit: "USD", engineVersion: "planner", costCoverageRefs: ["coverage"], comparisonStatus: "conditioned", unresolvedConditions: [], evidenceRefs: [] }
    const retained = { sensitivityResultRef: "sensitivity", sensitivity, caseRef: value.caseRef }
    const reads = { count: 0 }
    const read = createStoredScenarioBiProjection({ results: value.results, readProjection: async () => ({ status: "ok", value: value.projection }), revalidateProjection: async () => true, readSensitivity: async () => { if (++reads.count === 2) retained.sensitivity.parameterRef = "different"; return { status: "ok", value: retained } } })
    expect(await read({ ...value.selection, sensitivityResultRef: "sensitivity" }, value.context)).toEqual({ status: "stale", reason: "scenario-or-projection-changed" })
  } finally { await value.cleanup() }
})

test("optional persisted advantage is copied only for the exact inverse pair and survives both complete source fences", async () => {
  const value = await fixture()
  try {
    const inverse: ScenarioComparison = { ...value.comparison, baselineResultRef: value.comparison.alternativeResultRef, alternativeResultRef: value.comparison.baselineResultRef, knownDifference: -30000 }
    const saved = await value.results.write({ kind: "comparison", result: inverse, caseRef: value.caseRef, requestDigest: digestSfValue(inverse), sourceRefs: [], idempotencyKey: "inverse-comparison" }, value.context)
    if (saved.status !== "ok" || saved.value.kind !== "comparison") throw new Error("Inverse boundary fixture unavailable")
    const record = saved.value
    const selection = { ...value.selection, advantageComparisonRef: record.resultRef }
    const create = () => createStoredScenarioBiProjection({ results: value.results, readProjection: async () => ({ status: "ok", value: value.projection }), revalidateProjection: async () => true })
    const absent = await create()(value.selection, value.context)
    expect(absent.status).toBe("ok")
    if (absent.status !== "ok") throw new Error("Original projection unavailable")
    expect(absent.value).not.toHaveProperty("comparison")
    expect(await create()({ ...selection, advantageComparisonRef: " " }, value.context)).toEqual({ status: "needs-input", reason: "scenario-selection-required" })
    expect(await create()({ ...selection, advantageComparisonRef: value.selection.comparisonRef }, value.context)).toEqual({ status: "stale", reason: "advantage-reference-mismatch" })
    const projected = await create()(selection, value.context)
    if (projected.status !== "ok" || !projected.value.comparison) throw new Error(`Inverse projection unavailable: ${JSON.stringify(projected)}`)
    expect(projected.value.comparison).toMatchObject({ comparisonRef: record.resultRef, context: value.projection.context, version: value.projection.version, engineVersion: value.projection.engineVersion })
    expect(projected.value.comparison?.values).toEqual([
      { id: "scenario:advantage-known-difference", value: record.result.knownDifference, unit: "money", currency: "USD", period, granularity: "aggregate", sourceRefs: record.sourceRefs, drilldown: null, evidenceState: "estimated" },
      { id: "scenario:advantage-comparison-status", value: "conditioned", period, granularity: "aggregate", sourceRefs: record.sourceRefs, drilldown: null, evidenceState: "confirmed" },
    ])
    for (const fault of ["case", "reference", "pair", "replay", "revoked", "final-selection"] as const) {
      const retained = structuredClone(record)
      if (fault === "case") retained.caseRef.version += 1
      if (fault === "reference") retained.resultRef = "unselected-comparison"
      if (fault === "pair") retained.result.alternativeResultRef = "unselected-baseline"
      const calls = { reads: 0, fences: 0 }
      const read = createStoredScenarioBiProjection({
        results: { read: async (request, context) => {
          if (request.resultRef !== record.resultRef) return value.results.read(request, context)
          calls.reads += 1
          if (calls.reads === 2 && fault === "replay") retained.result.knownDifference = 999999
          if (calls.reads === 2 && fault === "revoked") return { status: "denied", reason: "source-revoked" }
          return { status: "ok", value: retained }
        } },
        readProjection: async () => ({ status: "ok", value: value.projection }),
        revalidateProjection: async (selected) => { if (++calls.fences === 2 && fault === "final-selection") selected.advantageComparisonRef = "substituted"; return true },
      })
      const refused = await read(selection, value.context)
      expect(refused).toEqual(fault === "revoked" ? { status: "denied", reason: "source-revoked" } : { status: "stale", reason: fault === "replay" || fault === "final-selection" ? "scenario-or-projection-changed" : "advantage-reference-mismatch" })
      expect(refused).not.toHaveProperty("value")
      expect(selection.advantageComparisonRef).toBe(record.resultRef)
    }
    for (const fault of ["currency", "period", "conflict"] as const) {
      const source = structuredClone(value.projection)
      if (fault === "currency") source.context.currency = "EUR"
      if (fault === "period") source.context.period.end = "2027-11-30"
      if (fault === "conflict") source.comparison = projected.value.comparison
      const read = createStoredScenarioBiProjection({ results: value.results, readProjection: async () => ({ status: "ok", value: source }), revalidateProjection: async () => true })
      const refused = await read(selection, value.context)
      expect(refused.status).toBe("stale")
      expect(refused).not.toHaveProperty("value")
    }
    const forwarded: string[] = []
    const host = bindStoredScenarioBiPort({ resolve: async () => ({ status: "ok", value: { ...selection, present: () => ({ viewId: "BI09", series: [], limitations: [] }) } }), readProjection: async (selected, context) => { forwarded.push(selected.advantageComparisonRef ?? ""); return create()(selected, context) }, revalidate: async () => true })
    expect((await host.readView(request, value.context)).status).toBe("ok")
    expect(forwarded).toEqual([record.resultRef])
    const mismatched = bindStoredScenarioBiPort({ resolve: async () => ({ status: "ok", value: { ...selection, present: () => ({ viewId: "BI09", series: [], limitations: [] }) } }), readProjection: async () => ({ status: "ok", value: absent.value }), revalidate: async () => true })
    expect(await mismatched.readView(request, value.context)).toEqual({ status: "stale", reason: "advantage-reference-mismatch" })
  } finally { await value.cleanup() }
})

test("BI presentation cannot mutate the stored scenario or portfolio projection it describes", async () => {
  const value = await fixture()
  try {
    const scenarioProjection: DomainProjection = { ...value.projection, decision: { kind: "scenario", scenarioResultRef: value.selection.scenarioResultRef, scenario: value.scenario, comparisonRef: value.selection.comparisonRef, comparison: value.comparison } }
    const scenario = bindStoredScenarioBiPort({ resolve: async () => ({ status: "ok", value: { ...value.selection, present: (projection) => { projection.version = 99; return { viewId: "BI09", series: [], limitations: [] } } } }), readProjection: async () => ({ status: "ok", value: scenarioProjection }), revalidate: async () => true })
    expect(await scenario.readView(request, value.context)).toEqual({ status: "stale", reason: "projection-changed-by-presentation" })
    expect(scenarioProjection.version).toBe(1)
    const portfolioProjection: DomainProjection = { ...value.projection, decision: { kind: "portfolio", portfolioResultRef: "portfolio", portfolio: { combinations: [], limitations: [], evidenceRefs: [] } } }
    const portfolio = bindStoredPortfolioBiPort({ resolve: async () => ({ status: "ok", value: { portfolioResultRef: "portfolio", present: (projection) => { projection.version = 99; return { viewId: "BI09", series: [], limitations: [] } } } }), readProjection: async () => ({ status: "ok", value: portfolioProjection }), revalidate: async () => true })
    expect(await portfolio.readView(request, value.context)).toEqual({ status: "stale", reason: "projection-changed-by-presentation" })
    expect(portfolioProjection.version).toBe(1)
  } finally { await value.cleanup() }
})

test("BI projection cannot rewrite the canonical portfolio result to make a replacement agree", async () => {
  const value = await fixture()
  try {
    const portfolio: PortfolioResult = { combinations: [], limitations: ["bounded"], evidenceRefs: [] }
    const host = bindPortfolioBiPort({
      portfolio: { evaluate: async () => ({ status: "ok", value: portfolio }) },
      resolve: async () => ({ status: "ok", value: { request: { scope: { horizon: period, currency: "USD" }, candidateRefs: [], operations: [], constraints: [], priorities: [], explorationLimit: 1 }, project: (result) => { result.limitations = ["tampered"]; return { projection: { ...value.projection, decision: { kind: "portfolio", portfolioResultRef: "portfolio", portfolio: result } }, presentation: { viewId: "BI09", series: [], limitations: [] } } } } }),
      revalidate: async () => true,
    })
    expect(await host.readView(request, value.context)).toEqual({ status: "stale", reason: "portfolio-changed-by-projection" })
    expect(portfolio.limitations).toEqual(["bounded"])
  } finally { await value.cleanup() }
})
