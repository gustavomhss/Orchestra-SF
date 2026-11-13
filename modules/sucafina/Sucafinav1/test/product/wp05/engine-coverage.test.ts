import { expect, test } from "bun:test"
import { createStoredScenarioBiProjection } from "../../../product/analytics/stored-scenario.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../product/contracts/business-context.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { CostCoverageEntry } from "../../../product/contracts/decisions.ts"
import { assessCostCoverage } from "../../../product/decisions/cost-coverage.ts"
import { classifyCoverage, supportsCoverageClassification } from "../../../product/decisions/coverage-classification.ts"
import { createWp05SensitivityFixture, wp05Horizon } from "./engine-fixture.ts"

type Fixture = Awaited<ReturnType<typeof createWp05SensitivityFixture>>

async function projection(fixture: Fixture) {
  const read = await fixture.planner.compareForecast({ baseRef: fixture.scenario.baseRef, candidateRef: fixture.scenario.baseRef, period: wp05Horizon, currency: "USD" }, fixture.context)
  if (read.status !== "ok") throw new Error(`Planner projection unavailable: ${JSON.stringify(read)}`)
  return read.value.candidate
}

async function readBi(fixture: Fixture) {
  const current = await projection(fixture)
  const selection = { selectionRef: "authorized-selection", scenarioResultRef: fixture.selectedRef, comparisonRef: fixture.comparisonRef, sensitivityResultRef: fixture.saved.sensitivityResultRef }
  const read = createStoredScenarioBiProjection({
    results: fixture.results,
    readSensitivity: fixture.persistent.read,
    readProjection: async (reference) => reference === selection.selectionRef ? { status: "ok", value: current } : { status: "unavailable", reason: "selection-unavailable" },
    revalidateProjection: async (selected, actual, caseRef, context) => digestSfValue(selected) === digestSfValue(selection) && digestSfValue(actual) === digestSfValue(current) && await fixture.host.revalidate(context) && (await fixture.comparisonBindings.read({ caseRef, resultRef: selected.comparisonRef }, context)).status === "ok",
  })
  const result = await read(selection, fixture.context)
  if (result.status !== "ok" || result.value.decision?.kind !== "scenario") throw new Error(`BI scenario unavailable: ${JSON.stringify(result)}`)
  return result.value.decision
}

/** Classify the pack's unique Planner components; category reuse must never add money. */
async function assess(fixture: Fixture, actual: DomainProjection, training: "bundled" | "omitted" | "confirmed" | "zero" | "null") {
  const source = fixture.sourceRefs.find((ref) => ref.refId === fixture.scenario.baseRef)
  if (!source) throw new Error("Planner source unavailable")
  const statements = {
    contract_exit: "Synthetic scope: the documented termination has no exit penalty.",
    internal_costs: "Synthetic scope: the supplied inventory finds no incremental internal cost.",
    other_relevant_costs: "Synthetic scope: this reviewed inventory has no other identified category.",
  }
  const statementIdentity: Extract<BusinessEvidenceRef, { kind: "record" }> = {
    schema: "sf-evidence-v1", kind: "record", refId: `SYN-APPLICABILITY-${training}`, installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "observed",
    target: { surface: "planner", recordType: "synthetic-scope-statement", recordId: `scope-${training}`, incarnation: `scope-${training}-v1`, version: 1, fields: Object.keys(statements), period: wp05Horizon, projectionDigest: digestSfValue(statements) },
  }
  const statement: BusinessEvidenceRef = { ...statementIdentity, refDigest: digestSfEvidenceRef(statementIdentity) }
  const componentRefs = (line: string) => actual.components.filter((item) => item.id.startsWith(`${line}:`)).map((item) => item.id)
  const included = (categoryId: string, refs: string[], scopeNote: string): CostCoverageEntry => ({ categoryId, status: "included", componentRefs: refs, evidenceRefs: [source], scopeNote })
  const entries: CostCoverageEntry[] = [
    included("service", componentRefs("new-service"), "New service at the supplied final price."),
    included("service_overlap", componentRefs("bridge"), "Bridge service has a distinct cost contribution."),
    included("implementation", componentRefs("implementation"), training === "bundled" ? "Implementation includes migration and training in the same price." : "This independent quote includes migration and explicitly excludes training."),
    included("migration", componentRefs("implementation"), "Migration is a sub-scope of implementation, with no additional component."),
    included("taxes", actual.components.map((item) => item.id), "The synthetic quotes declare final prices; no additional tax is inferred."),
    ...Object.entries(statements).map(([categoryId, justification]): CostCoverageEntry => ({ categoryId, status: "not-applicable", justification, evidenceRefs: [statement] })),
    ...(training === "omitted" ? [] : [included("training", componentRefs(training === "bundled" ? "implementation" : "training"), training === "bundled" ? "Training is already included in implementation." : "The separate training quote supplies the additional component.")]),
  ]
  const evidence: BusinessEvidenceResolution[] = [...await Promise.all(fixture.sourceRefs.map((ref) => fixture.evidence.resolve(ref, fixture.context))), { state: "fresh", ref: statement, accessRevision: "access", checkedAt: "2026-11-13T00:00:00Z" }]
  const request = { caseRef: fixture.caseRef, source, basis: fixture.basis, entries, expectedVersion: 0 }
  const classification = classifyCoverage(request, actual, 1)
  const assessment = assessCostCoverage({
    basis: fixture.basis, alternativeId: "selected", alternativeVersion: 1, currency: "USD", horizon: wp05Horizon, entries, components: actual.components, evidence,
    supports: (entry, resolved) => entry.status === "included"
      ? supportsCoverageClassification(classification, entry, resolved)
      : Object.entries(statements).some(([categoryId, text]) => categoryId === entry.categoryId && text === entry.justification) && entry.evidenceRefs.length === 1 && digestSfValue(entry.evidenceRefs[0]) === digestSfValue(statement) && resolved.some((item) => item.state === "fresh" && digestSfValue(item.ref) === digestSfValue(statement)),
  })
  return { entries, assessment, classification }
}

test("Planner's canonical known-subtotal solver proves the 55000 boundary; its integrated sensitivity still discloses pending coverage", async () => {
  const fixture = await createWp05SensitivityFixture({ mode: "renewal-usd", training: "bundled" })
  try {
    expect(fixture.baselineResult.knownSubtotal).toBe(240000)
    expect(fixture.selectedResult.knownSubtotal).toBe(210000)
    // C02 is alternative minus baseline: transition relative to renewal costs 30000 less.
    expect(fixture.comparison.knownDifference).toBe(-30000)
    const atBoundary = await fixture.preview({ baselineRef: fixture.baselineRef, scenario: { ...fixture.scenario, operations: [{ ...fixture.scenario.operations[0]!, amount: 55000 }] } }, fixture.context)
    const aboveBoundary = await fixture.preview({ baselineRef: fixture.baselineRef, scenario: { ...fixture.scenario, operations: [{ ...fixture.scenario.operations[0]!, amount: 55001 }] } }, fixture.context)
    expect(atBoundary.status).toBe("ok")
    expect(aboveBoundary.status).toBe("ok")
    if (atBoundary.status !== "ok" || aboveBoundary.status !== "ok") throw new Error("Planner boundary preview unavailable")
    expect(atBoundary.value.sample.knownSubtotal).toBe(220000)
    expect(atBoundary.value.metric.value).toBe(-20000)
    expect(aboveBoundary.value.metric.value).toBe(-19999)
    const exact = await fixture.exact(fixture.sensitivityRequest, fixture.baselineRef, fixture.context)
    expect(exact.status).toBe("ok")
    if (exact.status !== "ok") throw new Error(`Canonical Planner solver unavailable: ${JSON.stringify(exact)}`)
    // The canonical solver certifies an IEEE boundary, which may include a sub-cent plateau.
    expect(exact.value.value).toBeCloseTo(55000, 8)
    expect(exact.value.evidenceRefs.length).toBeGreaterThan(0)
    expect(fixture.exactCalls.count).toBe(0)
    const bi = await readBi(fixture)
    expect(bi.scenario).toEqual(fixture.selectedResult)
    expect(bi.comparison).toEqual(fixture.comparison)
    expect(bi.sensitivity).toEqual(fixture.saved.sensitivity)
    expect(bi.sensitivity?.threshold).toBeNull()
    expect(bi.sensitivity?.thresholdEvidence).toMatchObject({ state: "sampled", interval: { minimum: 40000, maximum: 70000 } })
    expect(bi.sensitivity?.comparisonStatus).toBe("conditioned")
    expect(bi.sensitivity?.unresolvedConditions.some((item) => item.reason.includes("unresolved coverage can change the decision"))).toBe(true)

    // Seed WP11 rejects the pack's legitimate reuse of a component across coverage categories.
    // This characterizes an upstream blocker; it is not acceptance of T05's complete fixture.
    const coverage = await assess(fixture, await projection(fixture), "bundled")
    expect(coverage.assessment.derivedMissingCategoryIds).toEqual([])
    expect(coverage.assessment.entries.every((entry) => entry.status !== "pending")).toBe(true)
    expect(coverage.assessment.coverageState).toBe("pending")
    expect(coverage.assessment.issues).toEqual(["uncategorized-component"])
  } finally {
    await fixture.cleanup()
  }
}, 180000)

test("real Planner results retain omitted training as unknown, then include its 40000 source without mutating the original result", async () => {
  const before = await createWp05SensitivityFixture({ mode: "renewal-usd", training: "omitted" })
  try {
    const beforeSnapshot = structuredClone(before.selectedResult)
    const beforeProjection = await projection(before)
    expect(beforeProjection.components.some((item) => item.id.startsWith("training:"))).toBe(false)
    const omitted = await assess(before, beforeProjection, "omitted")
    expect(omitted.entries.some((entry) => entry.categoryId === "training")).toBe(false)
    expect(omitted.assessment.derivedMissingCategoryIds).toEqual(["training"])
    expect(omitted.assessment.entries.find((entry) => entry.categoryId === "training")).toEqual({ categoryId: "training", status: "pending", reason: "missing-category" })
    expect(omitted.assessment.coverageState).toBe("pending")
    expect(before.selectedResult.knownSubtotal).toBe(210000)
    const originalBi = await readBi(before)
    expect(originalBi.scenario.total).toBeNull()
    expect(originalBi.sensitivity?.threshold).toBeNull()
    // Express the pack's advantage using the same canonical comparator with an explicit order.
    const advantageBefore = await before.plannerWithCriteria.compareScenarios({ scenarioRefs: [before.selectedRef, before.baselineRef], criteria: [] }, before.context)
    expect(advantageBefore.status).toBe("ok")
    if (advantageBefore.status !== "ok") throw new Error("Planner advantage comparison unavailable")
    expect(advantageBefore.value.knownDifference).toBe(30000)

    const after = await createWp05SensitivityFixture({ mode: "renewal-usd", training: "confirmed" })
    try {
      const afterProjection = await projection(after)
      expect(afterProjection.components.find((item) => item.id === "training:11")).toMatchObject({ amount: 40000, currency: "USD", evidenceState: "confirmed" })
      const confirmed = await assess(after, afterProjection, "confirmed")
      expect(confirmed.assessment.derivedMissingCategoryIds).toEqual([])
      expect(confirmed.assessment.entries.find((entry) => entry.categoryId === "training")?.status).toBe("included")
      expect(after.selectedResult.knownSubtotal).toBe(250000)
      expect(after.comparison.knownDifference).toBe(10000)
      const advantageAfter = await after.plannerWithCriteria.compareScenarios({ scenarioRefs: [after.selectedRef, after.baselineRef], criteria: [] }, after.context)
      expect(advantageAfter.status).toBe("ok")
      if (advantageAfter.status !== "ok") throw new Error("Revised Planner advantage comparison unavailable")
      expect(advantageAfter.value.knownDifference).toBe(-10000)
      const exact = await after.exact(after.sensitivityRequest, after.baselineRef, after.context)
      expect(exact.status).toBe("ok")
      if (exact.status !== "ok") throw new Error(`Revised canonical solver unavailable: ${JSON.stringify(exact)}`)
      expect(exact.value.value).toBeCloseTo(15000, 8)
      const revisedBi = await readBi(after)
      expect(revisedBi.scenario.knownSubtotal).toBe(250000)
      expect(revisedBi.scenario.total).toBeNull()
      expect(revisedBi.comparison.comparisonStatus).toBe("conditioned")
      expect(revisedBi.sensitivity?.threshold).toBeNull()
      expect(revisedBi.sensitivity?.thresholdEvidence).toMatchObject({ state: "sampled", interval: { minimum: 10000, maximum: 40000 } })
      // Shared-category coverage and the preview gate remain upstream blockers after training.
      expect(confirmed.assessment.coverageState).toBe("pending")
      expect(confirmed.assessment.issues).toEqual(["uncategorized-component"])
      expect(after.sourceRefs.find((ref) => ref.refId === after.scenario.baseRef)?.refDigest).not.toBe(before.sourceRefs.find((ref) => ref.refId === before.scenario.baseRef)?.refDigest)
      const original = await before.results.read({ kind: "scenario", resultRef: before.selectedRef }, before.context)
      expect(original.status).toBe("ok")
      if (original.status !== "ok" || original.value.kind !== "scenario") throw new Error("Original persisted scenario unavailable")
      expect(original.value.result).toEqual(beforeSnapshot)
      expect((await readBi(before)).scenario).toEqual(beforeSnapshot)
    } finally {
      await after.cleanup()
    }
  } finally {
    await before.cleanup()
  }
}, 180000)


test("real Planner and persisted BI distinguish explicit zero training from an unresolved price", async () => {
  for (const training of ["zero", "null"] as const) {
    const fixture = await createWp05SensitivityFixture({ mode: "renewal-usd", training })
    try {
      const actual = await projection(fixture)
      const expected = { amount: training === "zero" ? 0 : null, currency: "USD", evidenceState: training === "zero" ? "confirmed" : "absent" }
      expect(actual.components.find((component) => component.id === "training:11")).toMatchObject(expected)
      expect(fixture.selectedResult.components.find((component) => component.id === "training:11")).toMatchObject(expected)
      const assessed = await assess(fixture, actual, training)
      expect(assessed.assessment.derivedMissingCategoryIds).toEqual([])
      const category = assessed.assessment.entries.find((entry) => entry.categoryId === "training")
      if (training === "zero") {
        expect(category?.status).toBe("included")
        if (category?.status !== "included") throw new Error("Explicit zero training was not included")
        expect(category.componentRefs).toContain("training:11")
        expect(category.evidenceRefs.some((ref) => ref.refId === fixture.scenario.baseRef)).toBe(true)
      }
      if (training === "null") expect(category).toEqual({ categoryId: "training", status: "pending", reason: "component-unresolved" })
      // Shared-category completeness remains an upstream blocker; no fixture promotes it.
      expect(assessed.assessment.coverageState).toBe("pending")
      expect(assessed.assessment.issues).toContain("uncategorized-component")
      expect(fixture.selectedResult.knownSubtotal).toBe(210000)
      expect(fixture.comparison.knownDifference).toBe(-30000)
      const bi = await readBi(fixture)
      expect(bi.scenario).toEqual(fixture.selectedResult)
      expect(bi.scenario.components.find((component) => component.id === "training:11")).toMatchObject(expected)
      expect(bi.scenario.total).toBeNull()
      expect(bi.comparison.comparisonStatus).toBe("conditioned")
      expect(bi.sensitivity).toEqual(fixture.saved.sensitivity)
      expect(bi.sensitivity?.threshold).toBeNull()
    } finally {
      await fixture.cleanup()
    }
  }
}, 180000)

test("source-specific revocation with a valid UI session withholds persisted BI values and coverage", async () => {
  const fixture = await createWp05SensitivityFixture({ mode: "renewal-usd", training: "confirmed" })
  try {
    const current = await projection(fixture)
    const selected = fixture.sourceRefs.find((ref) => ref.refId === fixture.scenario.baseRef)
    if (!selected) throw new Error("Selected Planner source missing")
    const selection = { selectionRef: "authorized-selection", scenarioResultRef: fixture.selectedRef, comparisonRef: fixture.comparisonRef, sensitivityResultRef: fixture.saved.sensitivityResultRef }
    const observations = { projectionReads: 0 }
    const read = createStoredScenarioBiProjection({
      results: fixture.results,
      readSensitivity: fixture.persistent.read,
      readProjection: async (reference) => {
        observations.projectionReads++
        return reference === selection.selectionRef ? { status: "ok", value: current } : { status: "unavailable", reason: "selection-unavailable" }
      },
      revalidateProjection: async (incoming, actual, caseRef, context) => digestSfValue(incoming) === digestSfValue(selection) && digestSfValue(actual) === digestSfValue(current) && await fixture.host.revalidate(context) && (await fixture.comparisonBindings.read({ caseRef, resultRef: incoming.comparisonRef }, context)).status === "ok",
    })
    expect((await read(selection, fixture.context)).status).toBe("ok")
    const before = observations.projectionReads
    fixture.revokeSource(selected.refId)
    // The session/case remains admitted; it is the source grant that changed.
    expect(await fixture.host.revalidate(fixture.context)).toBe(true)
    expect((await fixture.evidence.resolve(selected, fixture.context)).state).toBe("revoked")
    const assessed = await assess(fixture, current, "confirmed")
    expect(assessed.assessment.coverageState).toBe("unavailable")
    expect(assessed.assessment.entries).toEqual([])
    expect(assessed.assessment.issues).toEqual(["evidence-unavailable"])
    expect(assessed.assessment.evaluatedSourceRefs.some((ref) => ref.refId === selected.refId)).toBe(false)
    const denied = { status: "denied", reason: "result-access-unavailable" }
    expect(await fixture.results.read({ kind: "scenario", resultRef: fixture.selectedRef }, fixture.context)).toEqual(denied)
    expect(await fixture.results.readHistoricalScenario({ resultRef: fixture.selectedRef }, fixture.context)).toEqual(denied)
    expect(await fixture.results.read({ kind: "comparison", resultRef: fixture.comparisonRef }, fixture.context)).toEqual(denied)
    expect(await read(selection, fixture.context)).toEqual(denied)
    expect(observations.projectionReads).toBe(before)
  } finally {
    await fixture.cleanup()
  }
}, 180000)
