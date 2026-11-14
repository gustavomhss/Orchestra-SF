import { expect, test } from "bun:test"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../product/contracts/business-context.ts"
import type { CostCoverageAssessment, CostCoverageEntry, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { PlannerSourceHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { assessCostCoverage, reassessScenarioCoverage } from "../../../product/decisions/cost-coverage.ts"
import { classifyCoverage, supportsCoverageClassification } from "../../../product/decisions/coverage-classification.ts"
import { comparePlannerScenarios, plannerScenarioCostPresentation } from "../../../product/planner/comparison.ts"
import { createPlannerPort, projectPlannerSource } from "../../../product/planner/port.ts"
import { simulatePlannerOperations } from "../../../product/planner/scenario.ts"
import { domain } from "../../../runtime/planner.ts"
import { createWp05SensitivityFixture, wp05Horizon } from "../wp05/engine-fixture.ts"
import { renewalCoverage } from "./renewal-coverage-fixture.ts"

type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>
const at = "2026-11-14T12:00:00Z"
const reader = { id: "finance", roles: ["finance"], canWrite: true, assigned: [], domains: [] }

/** Synthetic confirmed quotes and scope declarations; all amounts and comparisons come from Planner.
 * The 70000 quote is entered into a copied source by the real domain command. No simulation becomes a fact.
 */
test("AI-RENEWAL observes a confirmed 70000 implementation quote as 235000 total and 5000 savings with complete shared coverage", async () => {
  const fixture = await createWp05SensitivityFixture({ mode: "renewal-usd", training: "bundled", composed: true })
  try {
    const original = fixture.sourceRefs.find((ref) => ref.refId === fixture.scenario.baseRef)
    const renewal = fixture.sourceRefs.find((ref) => ref.refId === fixture.baselineScenario.baseRef)
    if (!original || !renewal) throw new Error("Canonical quote sources unavailable")
    const versionId = "transition-implementation70000"
    const allocated = { value: 0 }
    const author = { ...reader, id: "fixture-quote-author", roles: ["admin"] }
    const environment = { at, id: () => ++allocated.value === 1 ? versionId : `implementation-quote-${allocated.value}`, directory: [] }
    const revised = await fixture.store.transaction("planner", async (snapshot) => {
      const oldProjection = projectPlannerSource(snapshot, reader, original.refId)
      if (!oldProjection) throw new Error("Original quote projection unavailable")
      const originalDigest = digestSfValue(oldProjection)
      const copied = domain.execute(snapshot, author, { page: "Versions", action: "copy", id: original.refId, version: snapshot.versions[`versions:${original.refId}`]?.version ?? 0, values: { name: "Confirmed implementation quote 70000 with migration and training included" } }, environment)
      if (!copied.ok || copied.value !== versionId) throw new Error(`Canonical copy rejected: ${JSON.stringify(copied)}`)
      const changed = domain.execute(snapshot, author, { page: "OPEX", action: "save", id: "implementation", version: snapshot.versions[`${versionId}:lines:implementation`]?.version ?? 0, values: { versionId, f10: 70000 } }, environment)
      if (!changed.ok) throw new Error(`Canonical quote rejected: ${JSON.stringify(changed)}`)
      expect(digestSfValue(projectPlannerSource(snapshot, reader, original.refId))).toBe(originalDigest)
      const projection = projectPlannerSource(snapshot, reader, versionId)
      if (!projection) throw new Error("Revised quote projection unavailable")
      const unsigned: RecordEvidence = { schema: "sf-evidence-v1", kind: "record", refId: versionId, installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "observed", target: { surface: "planner", recordType: "planner-version", recordId: versionId, incarnation: `planner-${versionId}`, version: snapshot.versions[`versions:${versionId}`]?.version ?? 1, fields: Object.keys(projection), period: wp05Horizon, projectionDigest: digestSfValue({ versionId, projection }) } }
      return { commit: true, value: { ...unsigned, refDigest: digestSfEvidenceRef(unsigned) } }
    })
    const sourceRefs = [...fixture.sourceRefs, revised]
    const basis = { ...fixture.basis, version: fixture.basis.version + 1, sourceRefs }
    const assessments = new Map<string, CostCoverageAssessment>()
    const currentSource = async (ref: BusinessEvidenceRef, context: TrustedDomainContext) => {
      if (!await fixture.host.revalidate(context) || ref.kind !== "record" || !sourceRefs.some((known) => digestSfValue(known) === digestSfValue(ref))) return false
      const projection = await fixture.store.transaction("planner", async (snapshot) => ({ commit: false, value: projectPlannerSource(snapshot, reader, ref.target.recordId) }))
      return !!projection && digestSfValue({ versionId: ref.target.recordId, projection }) === ref.target.projectionDigest
    }
    const evidence: BusinessContextService = { ...fixture.evidence,
      resolve: async (ref, context) => ({ state: await currentSource(ref, context) ? "fresh" : "revoked", ref, accessRevision: context.binding.accessRevision, checkedAt: at }),
      context: async ({ refs }, context) => Promise.all(refs.map((ref) => evidence.resolve(ref, context))),
    }
    const sources: PlannerSourceHost = {
      resolveForecastSource: async (reference, context) => {
        const source = sourceRefs.find((ref) => ref.refId === reference)
        return source && await currentSource(source, context) ? { status: "ok", value: { versionId: source.refId, evidence: source } } : { status: "unavailable", reason: "quote-source-unavailable" }
      },
      resolveForecastCoverage: async (reference, context) => {
        const source = sourceRefs.find((ref) => ref.refId === reference)
        const assessment = assessments.get(reference)
        if (source && assessment && await currentSource(source, context)) return { status: "ok", value: { coverageRef: `quote-coverage:${reference}`, basis, assessment } }
        return { status: "unavailable", reason: "quote-inventory-unavailable" }
      },
    }
    const planner = createPlannerPort({ host: fixture.host, sources })
    const inventories = new Map<string, Awaited<ReturnType<typeof renewalCoverage>>>()
    for (const source of [original, revised]) {
      const scenario = { baseRef: source.refId, operations: [], assumptions: [] }
      const inventory = await renewalCoverage({ ...fixture, planner, sources, sourceRefs, basis, evidence, scenario }, "bundled")
      expect(inventory.assessment).toMatchObject({ coverageState: "complete", derivedMissingCategoryIds: [], issues: [] })
      expect(inventory.entries).toHaveLength(basis.categoryIds.length)
      for (const categoryId of ["implementation", "migration", "training"]) {
        const included = inventory.entries.find((entry) => entry.categoryId === categoryId)
        expect(included?.status).toBe("included")
        if (included?.status !== "included") throw new Error(`Missing shared category:${categoryId}`)
        expect(included.componentRefs).toContain("implementation:11")
      }
      assessments.set(source.refId, inventory.assessment)
      inventories.set(source.refId, inventory)
    }

    const renewalProjection = await planner.compareForecast({ baseRef: renewal.refId, candidateRef: renewal.refId, period: wp05Horizon, currency: "USD" }, fixture.context)
    if (renewalProjection.status !== "ok") throw new Error(renewalProjection.reason)
    const justification = "The final synthetic renewal service price includes taxes; transition-only costs do not apply to retained service."
    const unsigned: RecordEvidence = { schema: "sf-evidence-v1", kind: "record", refId: "renewal-complete-scope", installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "observed", target: { surface: "planner", recordType: "synthetic-scope", recordId: "renewal-complete-scope", incarnation: "renewal-complete-scope-1", version: 1, fields: [...basis.categoryIds], period: wp05Horizon, projectionDigest: digestSfValue({ justification, source: renewal }) } }
    const statement = { ...unsigned, refDigest: digestSfEvidenceRef(unsigned) }
    const entries: CostCoverageEntry[] = basis.categoryIds.map((categoryId) => categoryId === "service" || categoryId === "taxes"
      ? { categoryId, status: "included", componentRefs: renewalProjection.value.baseline.components.map((component) => component.id), evidenceRefs: [renewal], scopeNote: "One final service contribution including taxes." }
      : { categoryId, status: "not-applicable", justification, evidenceRefs: [statement] })
    const classification = classifyCoverage({ caseRef: fixture.caseRef, source: renewal, basis, entries, expectedVersion: 0 }, renewalProjection.value.baseline, 1)
    const resolutions: BusinessEvidenceResolution[] = [...await evidence.context({ refs: sourceRefs }, fixture.context), { state: "fresh", ref: statement, accessRevision: "access", checkedAt: at }]
    const renewalAssessment = assessCostCoverage({ basis, alternativeId: "renewal", alternativeVersion: 1, currency: "USD", horizon: wp05Horizon, entries, components: renewalProjection.value.baseline.components, evidence: resolutions, supports: (entry, resolved) => supportsCoverageClassification(classification, entry, resolved) && (entry.status === "included" || entry.justification === justification) })
    expect(renewalAssessment).toMatchObject({ coverageState: "complete", derivedMissingCategoryIds: [], issues: [] })
    assessments.set(renewal.refId, renewalAssessment)

    const afterQuote = await fixture.store.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))
    const observe = async (source: RecordEvidence) => {
      const result = await planner.simulateScenario({ baseRef: source.refId, operations: [], assumptions: [] }, fixture.context)
      if (result.status !== "ok") throw new Error(`Source observation unavailable:${result.reason}`)
      expect(result.value).toMatchObject({ comparisonStatus: "complete", costCoverage: { coverageState: "complete" }, unresolvedConditions: [], restrictions: [] })
      expect(result.value.components.every((component) => component.evidenceState === "confirmed")).toBe(true)
      expect(new Set(result.value.components.map((component) => component.id)).size).toBe(result.value.components.length)
      return result.value
    }
    const baseline = await observe(renewal)
    const before = await observe(original)
    const after = await observe(revised)
    expect(baseline).toMatchObject({ knownSubtotal: 240000, total: 240000 })
    expect(before).toMatchObject({ knownSubtotal: 210000, total: 210000 })
    expect(after).toMatchObject({ knownSubtotal: 235000, total: 235000 })
    expect(after.components.filter((component) => component.id === "implementation:11")).toMatchObject([{ amount: 70000 }])
    expect(after.components.filter((component) => component.amount !== 0).map((component) => component.id).sort()).toEqual(["bridge:11", "implementation:11", "new-service:11"])
    const compare = (alternative: ScenarioResult, source: RecordEvidence, comparisonBase: ScenarioResult = baseline) => comparePlannerScenarios({ baselineRef: comparisonBase.id, alternativeRef: alternative.id, baselineCoverageRef: "renewal-inventory", alternativeCoverageRef: `inventory:${source.refId}`, baseline: comparisonBase, alternative, baselineProof: { basis, projection: renewalProjection.value.baseline, source: renewal }, alternativeProof: { basis, projection: inventories.get(source.refId)!.actual, source } })
    const originalComparison = compare(before, original)
    const revisedComparison = compare(after, revised)
    expect(originalComparison).toMatchObject({ comparisonStatus: "complete", knownDifference: -30000, completeDifference: -30000 })
    expect(plannerScenarioCostPresentation(originalComparison)).toMatchObject({ knownSavings: 30000, completeSavings: 30000 })
    expect(revisedComparison).toMatchObject({ comparisonStatus: "complete", knownDifference: -5000, completeDifference: -5000 })
    expect(plannerScenarioCostPresentation(revisedComparison)).toMatchObject({ knownSavings: 5000, completeSavings: 5000, savingsDefinition: "baseline minus alternative" })

    const hypothetical = await planner.simulateScenario({ ...fixture.scenario, operations: fixture.scenario.operations.map((operation) => operation.targetRef === "implementation:11" ? { ...operation, amount: 70000 } : operation) }, fixture.context)
    expect(hypothetical).toMatchObject({ status: "ok", value: { knownSubtotal: 235000, total: null, comparisonStatus: "conditioned", restrictions: ["preview-not-applied"] } })

    // The real operation executor refuses inclusion of a contribution already priced in this source.
    const duplicated = await fixture.store.transaction("planner", async (snapshot) => {
      const originalSnapshot = digestSfValue(snapshot)
      const result = simulatePlannerOperations(snapshot, reader, environment, revised.refId, [{ kind: "include", targetRef: "implementation:11", amount: 70000, currency: "USD" }])
      expect(digestSfValue(snapshot)).toBe(originalSnapshot)
      return { commit: false, value: result }
    })
    expect(duplicated).toEqual({ status: "needs-input", reason: "contribution-already-present" })
    expect(await fixture.store.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))).toBe(afterQuote)

    const discounted = await planner.simulateScenario({ baseRef: revised.refId, operations: [{ kind: "replace", targetRef: "implementation:11", amount: 35000, currency: "USD" }], assumptions: [] }, fixture.context)
    expect(discounted).toMatchObject({ status: "ok", value: { knownSubtotal: 200000, total: null, comparisonStatus: "conditioned", restrictions: ["preview-not-applied"] } })
    if (discounted.status !== "ok") throw new Error(`Hypothetical discount unavailable:${discounted.reason}`)
    expect(discounted.value.components.find((component) => component.id === "implementation:11")).toMatchObject({ amount: 35000, evidenceState: "hypothetical" })
    expect(compare(discounted.value, revised)).toMatchObject({ comparisonStatus: "conditioned", knownDifference: -40000, completeDifference: null })

    // Change a coverage INPUT and let C10 reassess the complete observation; never assign its result status.
    const inventory = inventories.get(revised.refId)!
    const completeObservationDigest = digestSfValue(after)
    const pendingExit = await reassessScenarioCoverage({ scenario: after, basis, baseline: inventory.assessment,
      entries: inventory.entries.map((entry) => entry.categoryId === "contract_exit" ? { categoryId: entry.categoryId, status: "pending" as const, reason: "termination-price-awaiting-confirmation" } : entry),
      resolveEvidence: async (refs) => Promise.all(refs.map(async (ref) => digestSfValue(ref) === digestSfValue(inventory.statement) && await fixture.host.revalidate(fixture.context)
        ? { state: "fresh" as const, ref, accessRevision: fixture.context.binding.accessRevision, checkedAt: at }
        : evidence.resolve(ref, fixture.context))),
      supports: inventory.supports,
    })
    expect(pendingExit).toMatchObject({ knownSubtotal: 235000, total: null, comparisonStatus: "conditioned", costCoverage: { coverageState: "pending" } })
    if (!pendingExit) throw new Error("Canonical exit-cost reassessment unavailable")
    expect(pendingExit.costCoverage.entries).toContainEqual({ categoryId: "contract_exit", status: "pending", reason: "termination-price-awaiting-confirmation" })
    expect(compare(pendingExit, revised)).toMatchObject({ comparisonStatus: "conditioned", knownDifference: -5000, completeDifference: null })
    expect(digestSfValue(after)).toBe(completeObservationDigest)

    // The canonical comparator, rather than a fixture status, rejects incompatible base metadata.
    expect(compare(after, revised, { ...baseline, currency: "EUR" })).toMatchObject({ comparisonStatus: "incompatible", knownDifference: null, completeDifference: null, unresolvedConditions: ["currency-or-horizon-mismatch"] })
    expect(compare(after, revised, { ...baseline, horizon: { start: "2028-01-01", end: "2028-12-31" } })).toMatchObject({ comparisonStatus: "incompatible", knownDifference: null, completeDifference: null, unresolvedConditions: ["currency-or-horizon-mismatch"] })
    const invalidTarget = await planner.simulateScenario({ baseRef: revised.refId, operations: [{ kind: "replace", targetRef: "implementation:13", amount: 35000, currency: "USD" }], assumptions: [] }, fixture.context)
    expect(invalidTarget).toEqual({ status: "needs-input", reason: "invalid-or-duplicate-target" })
    expect(await fixture.store.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))).toBe(afterQuote)
    expect(await fixture.state.read(fixture.request, "cases", (state) => state.cases[fixture.caseRef.id])).toMatchObject({ status: "ok", value: { choices: [], preparedChanges: [], receipts: [] } })
  } finally { await fixture.cleanup() }
}, 180000)
