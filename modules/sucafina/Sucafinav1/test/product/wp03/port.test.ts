import { expect, test } from "bun:test"
import { createPlannerPort, projectPlannerSource } from "../../../product/planner/port.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { CostCoverageBasis, CostCoverageAssessment } from "../../../product/contracts/decisions.ts"
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
  const coverageMode = { available: false }
  const port = createPlannerPort({
    host: { persistence: storage.persistence, authenticate: async (_request, context) => resolve("finance", [...context!.roleMap], (group) => group === "finance-group"), environment: async () => ({ at: "2026-11-13T00:00:00Z", id: () => "unused", directory: [] }), requestFor: () => new Request("https://example.test"), revalidate: async () => true },
    sources: { resolveForecastSource: async (reference) => { const evidence = refs.find((ref) => ref.refId === reference); return evidence ? { status: "ok", value: { versionId: reference, evidence } } : { status: "unavailable", reason: "missing" } }, resolveForecastCoverage: async (reference) => coverageMode.available ? { status: "ok", value: { coverageRef: `coverage-${reference}`, basis, assessment: assessments[reference === "v0" ? 0 : 1] } } : { status: "unavailable", reason: "missing" } },
  })
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
