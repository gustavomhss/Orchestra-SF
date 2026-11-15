import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { reassessScenarioCoverage, validateScenarioCoverage } from "../../../product/decisions/cost-coverage.ts"
import { domain } from "../../../runtime/planner.ts"
import { createWp05ComparisonFixture, wp05Horizon } from "../wp05/engine-fixture.ts"
import { numericCoverageFixture } from "./numeric-fixture.ts"

const cases = [
  { training: "omitted", subtotal: 210000, total: null, coverage: "pending", comparison: "conditioned", direct: -30000 },
  { training: "confirmed", subtotal: 250000, total: 250000, coverage: "complete", comparison: "complete", direct: 10000 },
  { training: "zero", subtotal: 210000, total: 210000, coverage: "complete", comparison: "complete", direct: -30000 },
  { training: "null", subtotal: 210000, total: null, coverage: "pending", comparison: "conditioned", direct: -30000 },
  { training: "bundled", subtotal: 210000, total: 210000, coverage: "complete", comparison: "complete", direct: -30000 },
] as const

// WP11.T02.CHK.01/.03/.20/.21 and INV.20: amounts come from the actual
// Planner producer. Existing explicit synthetic N/A declarations are reused;
// this does not prove an installed applicability producer or human approval.
for (const expected of cases) test(`C10 numeric ${expected.training} training keeps canonical totals and stable reassessment`, async () => {
  const value = await numericCoverageFixture(expected.training)
  try {
    const { fixture, coverage, scenario, resolveEvidence } = value
    const before = digestSfValue({ scenario, entries: coverage.entries, assessment: coverage.assessment })
    expect(scenario).toMatchObject({ knownSubtotal: expected.subtotal, total: expected.total, comparisonStatus: expected.comparison,
      currency: "USD", horizon: wp05Horizon, costCoverage: { coverageState: expected.coverage, alternativeId: "selected", alternativeVersion: 1,
        basisId: fixture.basis.id, basisVersion: fixture.basis.version } })
    expect(fixture.baselineResult.knownSubtotal).toBe(240000)
    expect(scenario.costCoverage.issues).toEqual([])
    expect(fixture.comparison.knownDifference).toBe(expected.direct)
    expect(new Set(scenario.components.map((item) => item.id)).size).toBe(scenario.components.length)
    expect(scenario.components.filter((item) => item.id === "implementation:11")).toMatchObject([{ amount: 45000, evidenceState: "confirmed" }])
    const implementation = coverage.entries.find((entry) => entry.categoryId === "implementation")
    const migration = coverage.entries.find((entry) => entry.categoryId === "migration")
    if (implementation?.status !== "included" || migration?.status !== "included") throw new Error("Shared quote classification unavailable")
    expect(migration.componentRefs).toEqual(implementation.componentRefs)
    expect(scenario.costCoverage.entries.filter((entry) => entry.status === "not-applicable").map((entry) => entry.categoryId).sort()).toEqual(["contract_exit", "internal_costs", "other_relevant_costs"])

    if (expected.training === "omitted") {
      expect(coverage.entries.some((entry) => entry.categoryId === "training")).toBe(false)
      expect(scenario.components.some((component) => component.id.startsWith("training:"))).toBe(false)
      expect(scenario.costCoverage.derivedMissingCategoryIds).toEqual(["training"])
      expect(scenario.costCoverage.entries).toContainEqual({ categoryId: "training", status: "pending", reason: "missing-category" })
    }
    if (expected.training === "confirmed" || expected.training === "zero" || expected.training === "null") {
      expect(scenario.costCoverage.derivedMissingCategoryIds).toEqual([])
      expect(scenario.components.find((component) => component.id === "training:11")).toMatchObject({ amount: expected.training === "confirmed" ? 40000 : expected.training === "zero" ? 0 : null,
        evidenceState: expected.training === "null" ? "absent" : "confirmed" })
      expect(scenario.costCoverage.entries.find((entry) => entry.categoryId === "training")?.status).toBe(expected.training === "null" ? "pending" : "included")
    }
    if (expected.training === "bundled") {
      const training = coverage.entries.find((entry) => entry.categoryId === "training")
      if (training?.status !== "included") throw new Error("Bundled training classification unavailable")
      expect(training.componentRefs).toEqual(implementation.componentRefs)
      expect(scenario.components.some((component) => component.id.startsWith("training:"))).toBe(false)
    }
    if (expected.training === "null") {
      const withoutEvidence = coverage.assess(coverage.entries.map((entry) => entry.categoryId === "training" && entry.status === "included" ? { ...entry, evidenceRefs: [] } : entry))
      expect(withoutEvidence.coverageState).toBe("pending")
      expect(withoutEvidence.entries).toContainEqual({ categoryId: "training", status: "pending", reason: "evidence-unavailable" })
      expect(scenario.components.find((component) => component.id === "training:11")?.amount).toBeNull()
    }

    expect(validateScenarioCoverage(scenario, fixture.basis, scenario.costCoverage)).toBeUndefined()
    const reassessed = await reassessScenarioCoverage({ scenario, basis: fixture.basis, baseline: scenario.costCoverage,
      entries: scenario.costCoverage.entries, resolveEvidence, supports: coverage.supports })
    expect(reassessed).toEqual(scenario)
    if (!reassessed) throw new Error("Canonical no-op reassessment was refused")
    expect(validateScenarioCoverage(reassessed, fixture.basis, scenario.costCoverage)).toBeUndefined()
    expect(reassessed.id).toBe(scenario.id)
    expect(reassessed.version).toBe(scenario.version)
    expect(reassessed.costCoverage.alternativeVersion).toBe(1)
    const changedVersion = structuredClone(scenario)
    changedVersion.costCoverage.alternativeVersion = 2
    expect(validateScenarioCoverage(changedVersion, fixture.basis, scenario.costCoverage)).toBe("alternative-basis-mismatch")
    if (expected.training === "confirmed") {
      expect(validateScenarioCoverage(changedVersion, fixture.basis, changedVersion.costCoverage)).toBeUndefined()
      const revised = await reassessScenarioCoverage({ scenario: changedVersion, basis: fixture.basis, baseline: scenario.costCoverage,
        entries: scenario.costCoverage.entries, resolveEvidence, supports: coverage.supports })
      expect(revised?.costCoverage.alternativeVersion).toBe(2)
      for (const version of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
        const invalid = structuredClone(scenario)
        invalid.costCoverage.alternativeVersion = version
        expect(validateScenarioCoverage(invalid, fixture.basis, invalid.costCoverage)).toBe("alternative-basis-mismatch")
      }
    }
    expect(digestSfValue({ scenario, entries: coverage.entries, assessment: coverage.assessment })).toBe(before)
    const persisted = await fixture.results.read({ kind: "scenario", resultRef: fixture.selectedRef }, fixture.context)
    if (persisted.status !== "ok" || persisted.value.kind !== "scenario") throw new Error("Original C08 scenario unavailable")
    expect(persisted.value.result).toEqual(fixture.selectedResult)
    expect(persisted.value.caseRef).toEqual(fixture.caseRef)
    const decision = await fixture.state.read(fixture.request, "cases", (state) => state.cases[fixture.caseRef.id])
    expect(decision).toMatchObject({ status: "ok", value: { id: fixture.caseRef.id, incarnation: fixture.caseRef.incarnation, version: fixture.caseRef.version,
      choices: [], preparedChanges: [], receipts: [] } })
  } finally { await value.fixture.cleanup() }
}, 180000)

test("C10 refuses unsupported N/A and component currency, period or source changes", async () => {
  const value = await numericCoverageFixture("confirmed")
  try {
    const { coverage, fixture, scenario } = value
    const alteredStatement = coverage.assess(coverage.entries.map((entry) => entry.categoryId === "contract_exit" && entry.status === "not-applicable"
      ? { ...entry, justification: "An unsupported replacement statement" } : entry))
    expect(alteredStatement.coverageState).toBe("pending")
    expect(alteredStatement.entries).toContainEqual({ categoryId: "contract_exit", status: "pending", reason: "scope-not-supported" })
    const sourceUnavailable = coverage.assess(coverage.entries, coverage.actual.components, coverage.evidence.map((entry) => entry.ref.refId === coverage.statement.refId ? { ...entry, state: "stale" as const } : entry))
    expect(sourceUnavailable.coverageState).toBe("pending")
    expect(sourceUnavailable.entries).toContainEqual({ categoryId: "contract_exit", status: "pending", reason: "evidence-unavailable" })
    for (const fault of ["currency", "period-start", "period-end", "source-version", "source-incarnation"] as const) {
      const incompatible = structuredClone(scenario)
      incompatible.components = incompatible.components.map((component) => {
        if (component.id !== "training:11") return component
        if (fault === "currency") return { ...component, currency: "EUR" }
        if (fault === "period-start") return { ...component, period: { ...component.period, start: "2026-11-01" } }
        if (fault === "period-end") return { ...component, period: { ...component.period, end: "2028-11-30" } }
        return { ...component, sourceRefs: component.sourceRefs.map((source) => fault === "source-version" ? { ...source, version: source.version + 1 } : { ...source, incarnation: "replaced-source" }) }
      })
      const assessment = coverage.assess(coverage.entries, incompatible.components)
      expect(assessment.coverageState).toBe("pending")
      expect(assessment.entries).toContainEqual({ categoryId: "training", status: "pending", reason: "component-unresolved" })
      expect(validateScenarioCoverage(incompatible, fixture.basis, scenario.costCoverage)).toBe("incomplete-cost-coverage")
    }
  } finally { await value.fixture.cleanup() }
}, 180000)

test("C10 source reassessment refuses changed quote bytes and source revocation with an active session", async () => {
  const value = await numericCoverageFixture("confirmed")
  try {
    const { fixture, coverage, scenario, source, resolveEvidence } = value
    const before = digestSfValue(scenario)
    const changed = await fixture.store.transaction("planner", async (snapshot) => {
      const result = domain.execute(snapshot, { id: "fixture-quote-author", roles: ["admin"], canWrite: true, assigned: [], domains: [] },
        { page: "OPEX", action: "save", id: "training", version: snapshot.versions[`${source.refId}:lines:training`]?.version ?? 0,
          values: { versionId: source.refId, f10: 40001 } }, { at: "2026-11-13T00:00:00Z", id: () => "numeric-quote-revision", directory: [] })
      return { commit: result.ok, value: result }
    })
    expect(changed.ok).toBe(true)
    expect((await resolveEvidence([source]))[0]?.state).toBe("stale")
    const reassess = () => reassessScenarioCoverage({ scenario, basis: fixture.basis, baseline: scenario.costCoverage,
      entries: scenario.costCoverage.entries, resolveEvidence, supports: coverage.supports })
    expect(await reassess()).toBeUndefined()
    fixture.revokeSource(source.refId)
    expect(await fixture.host.revalidate(fixture.context)).toBe(true)
    expect((await resolveEvidence([source]))[0]?.state).toBe("revoked")
    expect(await reassess()).toBeUndefined()
    expect(await fixture.results.read({ kind: "scenario", resultRef: fixture.selectedRef }, fixture.context)).toEqual({ status: "denied", reason: "result-access-unavailable" })
    expect(digestSfValue(scenario)).toBe(before)
  } finally { await value.fixture.cleanup() }
}, 180000)

test("C10 keeps the real missing-FX Planner amount unavailable rather than zero", async () => {
  const fixture = await createWp05ComparisonFixture({ mode: "eur-missing-fx" })
  try {
    const current = await fixture.planner.compareForecast({ baseRef: fixture.scenario.baseRef, candidateRef: fixture.scenario.baseRef, period: wp05Horizon, currency: "USD" }, fixture.context)
    if (current.status !== "ok") throw new Error(`Missing-FX projection unavailable: ${current.reason}`)
    expect(current.value.candidate.values.find((entry) => entry.id === "fx:EUR")).toMatchObject({ value: null, unit: "USD/EUR", evidenceState: "absent" })
    expect(current.value.candidate.values.find((entry) => entry.id === "line:11:forecast")).toMatchObject({ value: 112000, currency: "EUR", evidenceState: "confirmed" })
    expect(current.value.candidate.components.find((entry) => entry.id === "line:11")).toMatchObject({ amount: null, currency: "USD", evidenceState: "absent" })
    expect(current.value.candidate.missing).toContainEqual({ field: "line:11:fx", reason: "missing-fx" })
    expect(fixture.selectedResult).toMatchObject({ knownSubtotal: null, total: null, comparisonStatus: "conditioned", costCoverage: { coverageState: "pending" } })
    expect(validateScenarioCoverage(fixture.selectedResult, fixture.basis, fixture.selectedResult.costCoverage)).toBeUndefined()
  } finally { await fixture.cleanup() }
}, 180000)
