import { expect, test } from "bun:test"
import { createPlannerPort, projectPlannerSource } from "../../../product/planner/port.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { CostCoverageBasis, CostCoverageAssessment, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { DomainPortHost, PlannerSourceHost } from "../../../product/contracts/ports.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import { resolve } from "../../../src/identity.ts"
import { testPersistence } from "../../fixture/persistence.ts"

const period = { start: "2027-01-01", end: "2027-12-31" }
const binding = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "finance", requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedDomainContext
const actor = { id: "finance", roles: ["finance"], canWrite: true, assigned: [], domains: [] }
const initial = (): Snapshot => ({
  data: { roleMap: [{ surface: "planner", role: "finance", entra: "finance-group", version: 1, by: "admin" }], versions: [72000, 84000].map((license, index) => ({ id: `v${index}`, year: 2027, closed: 9, lines: [{ id: "line", sec: "opex", el: "licenses", cur: "USD", b: [40000,45000,45000,50000,50000,50000,50000,50000,50000,50000,60000,60000], a: [40000,40000,45000,45000,45000,45000,45000,45000,50000,null,null,null], f: [null,null,null,null,null,null,null,null,null,38000,40000+license,40000] }], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} })) }, versions: {}, sequences: {}, audit: [], notices: [],
})

test("forecast port compares the real engine, and detects source changes", async () => {
  const storage = testPersistence({ planner: initial() })
  const refs = ["v0", "v1"].map((id): Extract<BusinessEvidenceRef, { kind: "record" }> => {
    const projection = projectPlannerSource(storage.state.planner, actor, id)!
    const evidence: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", refId: id, installationId: "i", projectId: "p", refDigest: "", evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "planner-version", recordId: id, incarnation: `inc-${id}`, version: 1, fields: Object.keys(projection), period, projectionDigest: digestSfValue({ versionId: id, projection }) } }
    evidence.refDigest = digestSfEvidenceRef(evidence)
    return evidence
  })
  const basis: CostCoverageBasis = { id: "basis", version: 1, decisionType: "renewal-transition-v1", categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: refs }
  const assessments = refs.map((ref): CostCoverageAssessment => ({ basisId: "basis", basisVersion: 1, alternativeId: `alternative-${ref.refId}`, alternativeVersion: 1, currency: "USD", horizon: period, issues: [], evaluatedSourceRefs: [ref], coverageState: "complete", derivedMissingCategoryIds: [], entries: RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => ({ status: "included", categoryId, componentRefs: Array.from({ length: 12 }, (_, index) => `line:${index + 1}`), evidenceRefs: [ref], scopeNote: "included in source" })) }))
  const coverageMode: { available: boolean; scenario?: CostCoverageAssessment } = { available: false }
  const scenarioRecords: Record<string, { result: ScenarioResult; coverageRef: string; basis: CostCoverageBasis; projection: DomainProjection; source: Extract<BusinessEvidenceRef, { kind: "record" }> }> = {}
  const host: DomainPortHost = { persistence: storage.persistence, authenticate: async (_request, context) => resolve("finance", [...context!.roleMap], (group) => group === "finance-group"), environment: async () => ({ at: "2026-11-13T00:00:00Z", id: () => "unused", directory: [] }), requestFor: () => new Request("https://example.test"), revalidate: async () => true }
  const sources: PlannerSourceHost = { resolveForecastSource: async (reference) => { const evidence = refs.find((ref) => ref.refId === reference); return evidence ? { status: "ok", value: { versionId: reference, evidence } } : { status: "unavailable", reason: "missing" } }, resolveForecastCoverage: async (reference) => coverageMode.available ? { status: "ok", value: { coverageRef: reference === "coverage-scenario" ? "coverage-scenario" : reference === "v0" || reference === "coverage-v0" ? "coverage-v0" : "coverage-v1", basis, assessment: reference === "coverage-scenario" && coverageMode.scenario ? coverageMode.scenario : assessments[reference === "v0" || reference === "coverage-v0" ? 0 : 1] } } : { status: "unavailable", reason: "missing" } }
  const port = createPlannerPort({ host, sources, scenarios: { resolve: async (reference) => scenarioRecords[reference] ? { status: "ok", value: scenarioRecords[reference] } : { status: "unavailable", reason: "missing" } } })
  const before = structuredClone(storage.state.planner)
  const result = await port.compareForecast({ baseRef: "v0", candidateRef: "v1", period, currency: "USD" }, binding)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") return
  expect(result.value.knownDifference).toBe(12000)
  expect(result.value.comparison.comparisonStatus).toBe("conditioned")
  expect(result.value.completeDifference).toBeNull()
  expect(result.value.baseline.components.reduce((sum, component) => sum + (component.amount ?? 0), 0)).toBe(590000)
  expect(storage.state.planner).toEqual(before)
  coverageMode.available = true
  const covered = await port.compareForecast({ baseRef: "v0", candidateRef: "v1", period, currency: "USD" }, binding)
  expect(covered.status).toBe("ok")
  if (covered.status === "ok") expect(covered.value.completeDifference).toBe(12000)
  const simulated = await port.simulateScenario({ baseRef: "v0", operations: [{ kind: "replace", targetRef: "line:11", amount: 124000, currency: "USD" }], assumptions: [] }, binding)
  expect(simulated.status).toBe("ok")
  if (simulated.status === "ok") {
    expect(simulated.value.knownSubtotal).toBe(602000)
    expect(simulated.value.total).toBeNull()
    expect(simulated.value.costCoverage.coverageState).toBe("pending")
    expect(simulated.value.components[10].evidenceState).toBe("hypothetical")
    if (covered.status === "ok") {
      const baseline: ScenarioResult = { id: "baseline", version: 1, components: covered.value.baseline.components, currency: "USD", horizon: period, sourceRefs: [refs[0]], costCoverage: assessments[0], comparisonStatus: "conditioned", knownSubtotal: 590000, total: null, unresolvedConditions: ["hypothetical"], restrictions: [] }
      scenarioRecords.base = { result: baseline, coverageRef: "coverage-v0", basis, projection: covered.value.baseline, source: refs[0] }
      scenarioRecords.candidate = { result: simulated.value, coverageRef: "coverage-v0", basis, projection: covered.value.baseline, source: refs[0] }
      expect(await port.compareScenarios({ scenarioRefs: ["base", "candidate"], criteria: [] }, binding)).toMatchObject({ status: "stale", reason: "scenario-source-or-coverage-changed" })
      coverageMode.scenario = simulated.value.costCoverage
      scenarioRecords.candidate.coverageRef = "coverage-scenario"
      const compared = await port.compareScenarios({ scenarioRefs: ["base", "candidate"], criteria: [] }, binding)
      expect(compared).toMatchObject({ status: "ok", value: { comparisonStatus: "conditioned", knownDifference: 12000, completeDifference: null } })
      const withCriterion = await port.compareScenarios({ scenarioRefs: ["base", "candidate"], criteria: ["cost"] }, binding)
      expect(withCriterion).toMatchObject({ status: "ok", value: { comparisonStatus: "conditioned", criterionResults: [{ criterionId: "cost", state: "unknown" }] } })
      delete scenarioRecords.candidate
      expect(await port.compareScenarios({ scenarioRefs: ["base", "candidate"], criteria: [] }, binding)).toMatchObject({ status: "unavailable" })
    }
  }
  expect(storage.state.planner).toEqual(before)
  const fresh = { value: true }
  const evidence: BusinessContextService = { resolve: async (ref) => ({ state: fresh.value ? "fresh" : "revoked", ref, accessRevision: "1", checkedAt: "2026-11-13T00:00:00Z" }), context: async () => [], recall: async () => [], emitFromLedger: async () => { throw new Error("not used") } }
  const november = { start: "2027-11-01", end: "2027-11-30" }
  const sourced = createPlannerPort({ host, sources, evidence, scenarioInputs: { verifyAssumption: async () => ({ status: "ok", value: { fingerprint: "confirmed-scope" } }), resolveAmount: async () => ({ status: "ok", value: { amount: 124000, currency: "USD", period: november, source: { surface: "planner", type: "planner-version", id: "v0", incarnation: refs[0].target.incarnation, version: 1, fields: ["summary"], period: november, observedAt: "2026-11-13T00:00:00Z" }, evidence: refs[0] } }) } })
  const sourcedRequest = { baseRef: "v0", operations: [{ kind: "replace" as const, targetRef: "line:11", replacementRef: "amount-ref" }], assumptions: [{ id: "source", value: 1, evidenceRefs: [refs[0]], state: "confirmed" as const }] }
  const sourcedResult = await sourced.simulateScenario(sourcedRequest, binding)
  expect(sourcedResult).toMatchObject({ status: "ok", value: { knownSubtotal: 602000, comparisonStatus: "conditioned" } })
  fresh.value = false
  expect(await sourced.simulateScenario(sourcedRequest, binding)).toMatchObject({ status: "stale", reason: "scenario-evidence-not-current" })
  expect(await port.simulateScenario({ baseRef: "v0", operations: [{ kind: "defer", targetRef: "line:11" }], assumptions: [] }, binding)).toMatchObject({ status: "needs-input" })
  expect(storage.state.planner).toEqual(before)
  expect(await port.simulateScenario({ baseRef: "v0", operations: [], assumptions: [{ id: "unproven", value: 1, evidenceRefs: [], state: "confirmed" }] }, binding)).toMatchObject({ status: "needs-input", reason: "confirmed-assumption-needs-evidence" })
  const validAssessment = assessments[0]
  assessments[0] = { ...validAssessment, evaluatedSourceRefs: [] }
  expect(await port.simulateScenario({ baseRef: "v0", operations: [{ kind: "replace", targetRef: "line:11", amount: 124000 }], assumptions: [] }, binding)).toMatchObject({ status: "needs-input", reason: "coverage-source-mismatch" })
  assessments[0] = validAssessment
  coverageMode.available = false
  const versions = storage.state.planner.data.versions as { lines: { f: (number | null)[] }[] }[]
  versions[1].lines[0].f[10] = 1
  expect(await port.compareForecast({ baseRef: "v0", candidateRef: "v1", period, currency: "USD" }, binding)).toMatchObject({ status: "stale" })
  const modified = storage.state.planner.data.versions as { lines: { cur: string }[]; fx: unknown[] }[]
  modified[1].lines[0].cur = "EUR"
  modified[1].fx = [{ id: "EUR", cur: "EUR", rate: null }]
  const current = projectPlannerSource(storage.state.planner, actor, "v1")!
  refs[1].target.projectionDigest = digestSfValue({ versionId: "v1", projection: current })
  refs[1].refDigest = digestSfEvidenceRef(refs[1])
  const unknownFx = await port.compareForecast({ baseRef: "v0", candidateRef: "v1", period, currency: "USD" }, binding)
  expect(unknownFx.status).toBe("ok")
  if (unknownFx.status === "ok") {
    expect(unknownFx.value.knownDifference).toBeNull()
    expect(unknownFx.value.candidate.missing.some((entry) => entry.reason === "missing-fx")).toBe(true)
    expect(unknownFx.value.candidate.components.every((component) => component.amount === null && component.evidenceState === "absent")).toBe(true)
  }
  coverageMode.available = true
  const scenarioWithoutFx = await port.simulateScenario({ baseRef: "v1", operations: [{ kind: "replace", targetRef: "line:11", amount: 124000, currency: "EUR" }], assumptions: [] }, binding)
  expect(scenarioWithoutFx.status).toBe("ok")
  if (scenarioWithoutFx.status === "ok") expect(scenarioWithoutFx.value.components[10]).toMatchObject({ amount: null, evidenceState: "absent" })
  coverageMode.available = false
  modified[1].lines[0].cur = "USD"
  const actual = storage.state.planner.data.versions as { lines: { a: (number | null)[] }[] }[]
  actual[1].lines[0].a[0] = null
  actual[1].lines[0].a[1] = 0
  const missingActualProjection = projectPlannerSource(storage.state.planner, actor, "v1")!
  refs[1].target.projectionDigest = digestSfValue({ versionId: "v1", projection: missingActualProjection })
  refs[1].refDigest = digestSfEvidenceRef(refs[1])
  const missingActual = await port.compareForecast({ baseRef: "v0", candidateRef: "v1", period, currency: "USD" }, binding)
  expect(missingActual.status).toBe("ok")
  if (missingActual.status === "ok") {
    expect(missingActual.value.candidate.components[0]).toMatchObject({ amount: null, evidenceState: "absent" })
    expect(missingActual.value.candidate.components[1]).toMatchObject({ amount: 0, evidenceState: "confirmed" })
    expect(missingActual.value.candidate.components[2].amount).toBe(45000)
  }
})
