import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { PortResult } from "../../../product/contracts/ports.ts"
import type { SensitivityRequest } from "../../../product/contracts/operations.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { classificationKey } from "../../../product/decisions/coverage-classification.ts"
import type { CoverageClassification } from "../../../product/decisions/coverage-classification.ts"
import type { PortfolioSelection } from "../../../product/decisions/portfolio-selection.ts"
import { createPortfolioCoveragePreview } from "../../../product/portfolio/coverage-preview.ts"
import type { PortfolioCoverageAuthority } from "../../../product/portfolio/coverage-preview.ts"
import { createPlannerSensitivity, plannerSensitivityScenario } from "../../../product/portfolio/planner-sensitivity.ts"
import { createPortfolioCoverageFixture } from "./coverage-preview-fixture.ts"
import { persistedServices } from "./sensitivity-read-scope-fixture.ts"
import { createRenewalChoiceHistory } from "../wp11/renewal-choice-fixture.ts"

for (const training of ["omitted", "bundled", "confirmed"] as const) {
  test(`WP13 persists ${training} training and recreates services with its real ${training === "confirmed" ? 15000 : 55000} sensitivity bound`, async () => {
    const fixture = await createPortfolioCoverageFixture(training)
    try {
      const request = endpointRequest(fixture.sensitivityRequest)
      const services = await persistedServices(fixture, training)
      const saved = await services.persistent.evaluateAndStore(request, fixture.caseRef, fixture.context)
      if (saved.status !== "ok") throw new Error(`Certified sensitivity persistence unavailable: ${JSON.stringify(saved)}`)
      const expected = training === "confirmed" ? 15000 : 55000
      expect(saved.value.sensitivity.comparisonStatus).toBe(training === "omitted" ? "conditioned" : "complete")
      expect(saved.value.sensitivity.threshold).toBeCloseTo(expected, 8)
      expect(saved.value.sensitivity.thresholdEvidence.state).toBe("exact")
      expect(saved.value.sensitivity.evaluated.map((point) => point.parameterValue)).toEqual([request.parameterBounds.minimum, request.parameterBounds.maximum])
      const units = await fixture.issuer.resolve(request, fixture.context)
      if (units.status !== "ok") throw new Error("Canonical coverage references unavailable")
      expect(saved.value.sensitivity.costCoverageRefs).toContain(units.value.baselineCoverageRef)
      expect(saved.value.sensitivity.costCoverageRefs).toContain(units.value.scenarioCoverageRef)
      expect(saved.value.sensitivity.costCoverageRefs.some((ref) => ref.startsWith("portfolio-coverage-interval:"))).toBe(false)
      expect(saved.value.sensitivity.unresolvedConditions.some((condition) => condition.category === "hypothesis")).toBe(true)
      if (training !== "omitted") expect(saved.value.sensitivity.evidenceRefs.some((ref) => ref.refId === fixture.selectedCoverage.statement.refId)).toBe(true)
      if (training === "omitted") {
        expect(fixture.selectedCoverage.assessment.coverageState).toBe("pending")
        expect(saved.value.sensitivity.unresolvedConditions.some((condition) => condition.reason === "missing-category:training")).toBe(true)
        expect(saved.value.sensitivity.unresolvedConditions.find((condition) => condition.id === "known-components-threshold")).toMatchObject({ category: "coverage", reason: expect.stringContaining("known components") })
        expect(saved.value.sensitivity.thresholdEvidence.state === "exact" && saved.value.sensitivity.thresholdEvidence.evidenceRefs.length).toBeGreaterThan(0)
        for (const amount of [55000, 55001]) {
          const preview = await fixture.preview({ baselineRef: fixture.baselineRef, scenario: fixture.withAmount(amount) }, fixture.context)
          if (preview.status !== "ok") throw new Error(`Omitted-training boundary witness unavailable: ${JSON.stringify(preview)}`)
          expect(preview.value.metric.value).toBe(amount === 55000 ? -20000 : -19999)
          expect(preview.value.sample.total).toBeNull()
          expect(preview.value.sample.components.some((component) => component.id === "training:11")).toBe(false)
        }
      }
      for (const point of saved.value.sensitivity.evaluated) {
        const sample = await services.results.read({ kind: "scenario", resultRef: point.resultRef }, fixture.context)
        if (sample.status !== "ok" || sample.value.kind !== "scenario") throw new Error("Persisted canonical sample unavailable")
        expect(sample.value.result.total).toBeNull()
        expect(sample.value.result.comparisonStatus).toBe("conditioned")
        expect(sample.value.result.restrictions).toContain("preview-not-applied")
        expect(sample.value.caseRef).toEqual(fixture.caseRef)
        if (training === "omitted") expect(sample.value.result.costCoverage.derivedMissingCategoryIds).toContain("training")
      }
      const reloaded = await persistedServices(fixture, training)
      // The LocalStore stays open. This recreates service/verifier state, without claiming SQLite or process restart.
      // This must be the first operation on the recreated service: no producer or verifier prewarms its proof maps.
      const replay = await reloaded.persistent.read(saved.value.sensitivityResultRef, fixture.context)
      if (replay.status !== "ok") throw new Error(`Fresh service replay unavailable: ${JSON.stringify(replay)}`)
      expect(replay.value).toEqual(saved.value)
      if (training === "confirmed") {
        const before = await services.state.read(fixture.request, "cases", (state) => Object.keys(state.decisionResults ?? {}))
        const again = await reloaded.persistent.evaluateAndStore(request, fixture.caseRef, fixture.context)
        if (again.status !== "ok") throw new Error(`Idempotent certified sensitivity unavailable: ${JSON.stringify(again)}`)
        expect(again.value.sensitivityResultRef).toBe(saved.value.sensitivityResultRef)
        expect(await services.state.read(fixture.request, "cases", (state) => Object.keys(state.decisionResults ?? {}))).toEqual(before)
      }
      if (training === "omitted") fixture.revokeSource(fixture.scenario.baseRef)
      if (training !== "omitted") fixture.revokeStatement()
      expect((await reloaded.persistent.read(saved.value.sensitivityResultRef, fixture.context)).status).not.toBe("ok")
      const current = await fixture.state.read(fixture.request, "cases", (state) => state.cases[fixture.caseRef.id])
      if (current.status !== "ok" || !current.value) throw new Error("Case unavailable after analysis")
      expect(current.value.choices).toEqual([])
      expect(current.value.receipts).toEqual([])
    } finally { await fixture.cleanup() }
  }, 300000)
}

test("WP13 withholds an exact bound for a real null price or missing FX before consulting an exact callback", async () => {
  for (const input of [{ training: "null", mode: "renewal-usd" }, { training: "bundled", mode: "eur-missing-fx" }] as const) {
    const fixture = await createPortfolioCoverageFixture(input.training, input.mode)
    try {
      const calls = { exact: 0 }
      const evaluate = createPlannerSensitivity({ results: fixture.results, resolve: fixture.issuer.resolve, revalidate: fixture.issuer.revalidate, preview: fixture.preview, coveragePreview: fixture.coverage, exactThreshold: async (request, binding, context) => { calls.exact++; return fixture.exact(request, binding.baselineRef, context) }, idempotencyKey: async () => `wp13-unpriced:${input.mode}:${input.training}` })
      const result = await evaluate(endpointRequest(fixture.sensitivityRequest), fixture.context)
      if (result.status !== "ok") throw new Error(`Unpriced sensitivity samples unavailable: ${JSON.stringify(result)}`)
      expect(fixture.selectedResult.components.some((component) => component.amount === null)).toBe(true)
      expect(fixture.selectedResult.total).toBeNull()
      expect(result.value.threshold).toBeNull()
      expect(result.value.thresholdEvidence.state).not.toBe("exact")
      expect(result.value.comparisonStatus).toBe("conditioned")
      expect(calls.exact).toBe(0)
      expect(result.value.unresolvedConditions.some((condition) => condition.category === "quantification")).toBe(true)
      if (input.mode === "eur-missing-fx") {
        expect(result.value.parameterUnit).toBe("EUR")
        expect(result.value.resultUnit).toBe("USD")
        expect(result.value.evaluated.every((point) => point.value === null)).toBe(true)
      }
    } finally { await fixture.cleanup() }
  }
}, 180000)

test("WP13 rejects a false scalar boundary even when it carries the real canonical source evidence", async () => {
  const fixture = await createPortfolioCoverageFixture("omitted")
  try {
    const request = endpointRequest(fixture.sensitivityRequest)
    const canonical = await fixture.exact(request, fixture.baselineRef, fixture.context)
    if (canonical.status !== "ok") throw new Error(`Canonical boundary proof unavailable: ${JSON.stringify(canonical)}`)
    expect(canonical.value.value).toBeCloseTo(55000, 8)
    const evaluate = createPlannerSensitivity({ results: fixture.results, resolve: fixture.issuer.resolve, revalidate: fixture.issuer.revalidate, preview: fixture.preview, coveragePreview: fixture.coverage, exactThreshold: async () => ({ status: "ok", value: { ...canonical.value, value: 55001 } }), idempotencyKey: async () => "wp13-false-scalar-certificate" })
    const result = await evaluate(request, fixture.context)
    if (result.status !== "ok") throw new Error(`Sampled fallback unavailable: ${JSON.stringify(result)}`)
    expect(result.value.threshold).toBeNull()
    expect(result.value.thresholdEvidence).toMatchObject({ state: "sampled", interval: { minimum: 10000, maximum: 70000 } })
    expect(result.value.comparisonStatus).toBe("conditioned")
    expect(result.value.unresolvedConditions.some((condition) => condition.reason === "missing-category:training")).toBe(true)
    expect(fixture.selectedResult.total).toBeNull()
  } finally { await fixture.cleanup() }
}, 180000)

test("WP13 keeps the human choice in one case while confirmed training changes the source-only analysis to the real 15000 boundary", async () => {
  const history = await createRenewalChoiceHistory()
  try {
    const before = history.before
    const priorEvaluate = createPlannerSensitivity({ results: before.results, resolve: before.issuer.resolve, revalidate: before.issuer.revalidate, preview: before.preview, exactThreshold: (request, binding, context) => before.exact(request, binding.baselineRef, context), idempotencyKey: async () => "wp13-before-training" })
    const prior = await priorEvaluate(endpointRequest(before.sensitivityRequest), history.fixture.context)
    if (prior.status !== "ok") throw new Error(`Omitted training analysis unavailable: ${JSON.stringify(prior)}`)
    expect(prior.value.threshold).toBeCloseTo(55000, 8)
    expect(prior.value.thresholdEvidence.state).toBe("exact")
    expect(prior.value.comparisonStatus).toBe("conditioned")
    expect(prior.value.unresolvedConditions.some((condition) => condition.id === "known-components-threshold" && condition.reason.includes("known components"))).toBe(true)
    expect(prior.value.unresolvedConditions.some((condition) => condition.reason === "missing-category:training")).toBe(true)
    expect(before.selectedResult.costCoverage.derivedMissingCategoryIds).toContain("training")
    const chosen = await history.choose()
    const originalChoice = digestSfValue(chosen.choice)
    const after = await history.resolveTraining()
    expect(after.caseRef.id).toBe(before.caseRef.id)
    expect(after.caseRef.incarnation).toBe(before.caseRef.incarnation)
    expect(after.scenario.operations).toEqual([])
    expect(after.selectedResult).toMatchObject({ knownSubtotal: 250000, total: 250000, comparisonStatus: "complete" })
    const resolveAuthority = async (request: SensitivityRequest, baselineRef: string, context: TrustedDomainContext): Promise<PortResult<PortfolioCoverageAuthority>> => {
      const binding = await after.issuer.resolve(request, context)
      if (binding.status !== "ok") return binding
      if (request.scenarioRef !== after.selectedRef || baselineRef !== after.baselineRef || digestSfValue(binding.value.caseRef) !== digestSfValue(after.caseRef)) return { status: "unavailable", reason: "choice-history-selection-mismatch" }
      const decision = await history.readCase()
      const classifications = await history.state.read(history.fixture.request, "preferences", (state) => ({ selected: state.preferences[classificationKey(after.caseRef, after.scenario.baseRef)], baseline: state.preferences[classificationKey(after.caseRef, after.baselineScenario.baseRef)] }))
      if (classifications.status !== "ok" || !classifications.value.selected || typeof classifications.value.selected !== "object" || !("classificationDigest" in classifications.value.selected) || !classifications.value.baseline || typeof classifications.value.baseline !== "object" || !("classificationDigest" in classifications.value.baseline)) return { status: "unavailable", reason: "choice-history-classification-unavailable" }
      const selected = classifications.value.selected as CoverageClassification
      const baseline = classifications.value.baseline as CoverageClassification
      const body = { schema: "sf-portfolio-selection-v1" as const, selectionRef: "wp13-human-history-selection", caseRef: after.caseRef, baselineAlternativeId: "baseline", alternativeId: "selected", baselineRef, alternativeRef: after.selectedRef, criteria: [request.criterion.id], comparisonDigest: digestSfValue(after.comparison), version: 1, principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, createdAt: "2026-11-13T02:00:00Z" }
      const selection: PortfolioSelection = { ...body, selectionDigest: digestSfValue(body) }
      const refs = [...after.basis.sourceRefs, ...after.selectedResult.sourceRefs, ...after.baselineResult.sourceRefs, ...after.selectedResult.costCoverage.evaluatedSourceRefs, ...after.baselineResult.costCoverage.evaluatedSourceRefs, selected.source, baseline.source, ...after.rule.evidenceRefs, ...binding.value.evidenceRefs].filter((ref, index, all) => all.findIndex((other) => digestSfValue(other) === digestSfValue(ref)) === index)
      const evidence = await after.evidence.context({ refs }, context)
      const decisionDigest = digestSfValue(decision)
      const classificationDigest = digestSfValue(classifications.value)
      return { status: "ok", value: { decision, selection, scenario: after.scenario, storedResult: after.selectedResult, rule: after.rule, basis: after.basis, classification: selected, baseline: { result: after.baselineResult, classification: baseline }, evidence, isStillValid: async (trusted) => {
        const current = await history.state.read(history.fixture.request, "preferences", (state) => ({ selected: state.preferences[classificationKey(after.caseRef, after.scenario.baseRef)], baseline: state.preferences[classificationKey(after.caseRef, after.baselineScenario.baseRef)] }))
        return current.status === "ok" && digestSfValue(current.value) === classificationDigest && digestSfValue(await history.readCase()) === decisionDigest && await after.issuer.revalidate(binding.value, trusted)
      } } }
    }
    const coveragePreview = createPortfolioCoveragePreview({ units: after.issuer, preview: after.preview, resolveAuthority })
    const evaluate = createPlannerSensitivity({ results: after.results, resolve: after.issuer.resolve, revalidate: after.issuer.revalidate, preview: after.preview, coveragePreview, exactThreshold: (request, binding, context) => after.exact(request, binding.baselineRef, context), idempotencyKey: async () => "wp13-after-training" })
    const request = endpointRequest(after.sensitivityRequest)
    const result = await evaluate(request, history.fixture.context)
    if (result.status !== "ok") throw new Error(`Source-only certified analysis unavailable: ${JSON.stringify(result)}`)
    expect(result.value.comparisonStatus).toBe("complete")
    expect(result.value.threshold).toBeCloseTo(15000, 8)
    expect(result.value.thresholdEvidence.state).toBe("exact")
    const binding = await after.issuer.resolve(request, history.fixture.context)
    if (binding.status !== "ok") throw new Error("Current source parameter unavailable")
    expect(binding.value.parameterOperation).toMatchObject({ targetRef: "implementation:11", amount: 45000, currency: "USD" })
    for (const amount of [15000, 15001]) {
      const preview = await after.preview({ baselineRef: after.baselineRef, scenario: plannerSensitivityScenario(binding.value, "implementation:11", amount) }, history.fixture.context)
      if (preview.status !== "ok") throw new Error(`Source-only threshold witness unavailable: ${JSON.stringify(preview)}`)
      expect(preview.value.metric.value).toBe(amount === 15000 ? -20000 : -19999)
      expect(preview.value.sample.total).toBeNull()
    }
    const decision = await history.readCase()
    expect(decision.choices).toHaveLength(1)
    expect(digestSfValue(decision.choices[0])).toBe(originalChoice)
    expect(decision.state).toBe("reconsidering")
    expect(decision.preparedChanges).toEqual([])
    expect(decision.receipts).toEqual([])
  } finally { await history.cleanup() }
}, 300000)

// Structural interval certification and canonical adjacent witnesses establish the full boundary.
function endpointRequest(request: SensitivityRequest): SensitivityRequest {
  return { ...request, parameterBounds: { ...request.parameterBounds, steps: 1 } }
}

