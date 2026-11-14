import { expect, test } from "bun:test"
import { readSfDecisionCoverage } from "../../../../../../apps/cli/src/sucafina-product/decision-coverage-read.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../product/contracts/business-context.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { CostCoverageEntry } from "../../../product/contracts/decisions.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import { classifyCoverage, classificationDigest, supportsCoverageClassification } from "../../../product/decisions/coverage-classification.ts"
import { assessCostCoverage } from "../../../product/decisions/cost-coverage.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"

// Adapter contract tests use canonical C10 classification and real UI leases.
// The two read-port responses are explicit component fixtures, not an installed
// journey, persisted case, provider run, or evidence of C12 execution.
async function fixture(amount: number | null = 0) {
  const state = { allowed: true, sequence: 0, calls: 0, afterRead: () => {} }
  const request = new Request("https://example.test/decision-controls")
  const identity = { installationId: "install", projectId: "project", principalRef: "reader", accessRevision: "access", policyVersion: "policy" }
  const ui = createSfUiAuthority({ authorize: async (incoming) => incoming === request && state.allowed ? identity : undefined,
    commandIdentity: async () => "coverage-read", createId: () => `read-${++state.sequence}`, now: () => Date.parse("2026-11-14T00:00:00Z") })
  const host: Pick<DomainPortHost, "requestFor" | "revalidate"> = { requestFor: (call) => call.kind === "ui" ? ui.requestFor(call) : undefined,
    revalidate: (call) => call.kind === "ui" ? ui.revalidate(call) : Promise.resolve(false) }
  const period = { start: "2027-01-01", end: "2027-12-31" }
  const record = { surface: "planner", type: "planner-version", id: "forecast", incarnation: "forecast-inc", version: 1, fields: ["lines"], period, observedAt: "2026-11-14T00:00:00Z" } as const
  const unsigned: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", kind: "record", refId: "forecast", installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "observed",
    target: { surface: "planner", recordType: "planner-version", recordId: record.id, incarnation: record.incarnation, version: record.version, fields: record.fields, period, projectionDigest: digestSfValue({ lines: "fixture" }) } }
  const source = { ...unsigned, refDigest: digestSfEvidenceRef(unsigned) }
  const selection = { caseRef: { id: "case", incarnation: "case-inc", version: 4 }, source }
  const basis = { id: "basis", version: 1, decisionType: "renewal-transition-v1", categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: [source] }
  const projection: DomainProjection = { context: { ...identity, surface: "planner", period, currency: "USD", sourceRefs: [record], capabilities: [] }, version: 1, engineVersion: "fixture", values: [], missing: [],
    components: [{ id: "service", amount, currency: "USD", period, sourceRefs: [record], evidenceState: amount === null ? "absent" : "confirmed" }] }
  const entries: CostCoverageEntry[] = [{ categoryId: "service", status: "included", componentRefs: ["service"], evidenceRefs: [source], scopeNote: "Explicit service amount" },
    { categoryId: "training", status: "pending", reason: "Awaiting the authorized training source" }]
  const proposed = classifyCoverage({ ...selection, basis, entries, expectedVersion: 0 }, projection, 1)
  const evidence: BusinessEvidenceResolution[] = [{ state: "fresh", ref: source, accessRevision: identity.accessRevision, checkedAt: "2026-11-14T00:00:00Z" }]
  const assessment = assessCostCoverage({ basis, alternativeId: "baseline", alternativeVersion: 1, currency: "USD", horizon: period, entries, components: projection.components, evidence,
    supports: (entry, resolved) => supportsCoverageClassification(proposed, entry, resolved) })
  const classification = classifyCoverage({ ...selection, basis, entries: assessment.entries, expectedVersion: 0 }, projection, 1)
  const stored = { classification, coverage: { coverageRef: "opaque-registered-coverage", basis, assessment } }
  const baseline: Parameters<typeof readSfDecisionCoverage>[0]["baseline"] = {
    readClassification: async (selector) => { expect(selector).toBe(source.refId); state.calls++; return { status: "ok", value: structuredClone(stored.classification) } },
    resolveForecastCoverage: async (selector) => { expect(selector).toBe(source.refId); state.calls++; state.afterRead(); return { status: "ok", value: structuredClone(stored.coverage) } },
  }
  const admit = async () => {
    const admitted = await ui.admit(request, "sf_case_read", digestSfValue(selection))
    if (admitted.status !== "ok" || !await ui.validate(admitted.value, "sf_case_read", digestSfValue(selection))) throw new Error("Real read admission unavailable")
    return admitted.value
  }
  return { ui, input: { host, baseline }, selection, stored, projection, state, admit, context: await admit() }
}

for (const amount of [0, null] as const) test(`coverage reread preserves canonical pending versus ${amount === null ? "absent" : "zero"} after a fresh admission`, async () => {
  const value = await fixture(amount)
  const before = structuredClone(value.stored)
  const result = await readSfDecisionCoverage(value.input, value.selection, value.context)
  expect(result).toEqual({ status: "ok", value: { expectedVersion: 1, classification: before.classification, coverage: before.coverage } })
  if (result.status !== "ok") throw new Error("Coverage read failed")
  expect(result.value.coverage.assessment.coverageState).toBe("pending")
  expect(result.value.coverage.assessment.entries.find((entry) => entry.categoryId === "training")).toEqual({ categoryId: "training", status: "pending", reason: "Awaiting the authorized training source" })
  expect(result.value.coverage.assessment.entries.find((entry) => entry.categoryId === "service")?.status).toBe(amount === null ? "pending" : "included")
  expect(result.value.coverage.assessment.derivedMissingCategoryIds).toContain("migration")
  expect(value.projection.components[0]?.amount).toBe(amount)
  value.ui.finish(value.context)
  const next = await value.admit()
  expect(next.binding.requestId).not.toBe(value.context.binding.requestId)
  expect(await readSfDecisionCoverage(value.input, value.selection, next)).toEqual(result)
  expect(value.stored).toEqual(before)
  value.ui.finish(next)
})

test("coverage reread rejects a replaced case or source and mixed active classification revisions", async () => {
  const value = await fixture()
  expect(await readSfDecisionCoverage(value.input, { ...value.selection, caseRef: { ...value.selection.caseRef, version: 0 } }, value.context)).toEqual({ status: "denied", reason: "decision-coverage-read-authority-unavailable" })
  const replaced = { ...value.selection, caseRef: { ...value.selection.caseRef, incarnation: "replaced" } }
  expect(await readSfDecisionCoverage(value.input, replaced, value.context)).toEqual({ status: "stale", reason: "decision-coverage-read-selection-changed" })
  const source = { ...value.selection.source, target: { ...value.selection.source.target, version: 2 } }
  source.refDigest = digestSfEvidenceRef(source)
  expect(await readSfDecisionCoverage(value.input, { ...value.selection, source }, value.context)).toEqual({ status: "stale", reason: "decision-coverage-read-selection-changed" })
  value.stored.coverage.assessment = { ...value.stored.coverage.assessment, alternativeVersion: 2 }
  expect(await readSfDecisionCoverage(value.input, value.selection, value.context)).toEqual({ status: "stale", reason: "decision-coverage-read-classification-changed" })
  value.ui.finish(value.context)
})

test("coverage reread requires the canonical classification digest and matching basis contents", async () => {
  const value = await fixture()
  const original = structuredClone(value.stored)
  value.stored.classification.classificationDigest = "0".repeat(64)
  expect(await readSfDecisionCoverage(value.input, value.selection, value.context)).toEqual({ status: "stale", reason: "decision-coverage-read-selection-changed" })
  value.stored.classification = original.classification
  value.stored.coverage.basis = { ...original.coverage.basis, sourceRefs: [] }
  expect(await readSfDecisionCoverage(value.input, value.selection, value.context)).toEqual({ status: "stale", reason: "decision-coverage-read-classification-changed" })
  expect(value.stored.classification.classificationDigest).toBe(classificationDigest(value.stored.classification))
  value.ui.finish(value.context)
})

for (const end of ["finish", "revoke", "selection-change"] as const) test(`coverage reread releases no data after ${end} while the canonical reader awaits`, async () => {
  const value = await fixture()
  value.state.afterRead = () => {
    if (end === "finish") value.ui.finish(value.context)
    if (end === "revoke") value.state.allowed = false
    if (end === "selection-change") value.selection.caseRef.version++
  }
  const result = await readSfDecisionCoverage(value.input, value.selection, value.context)
  expect(result).toEqual({ status: "denied", reason: "decision-coverage-read-authority-unavailable" })
  expect(result).not.toHaveProperty("value")
  value.ui.finish(value.context)
})

test("coverage reread does not turn canonical failure or a forged UI object into coverage", async () => {
  const value = await fixture()
  const missing = { ...value.input, baseline: { ...value.input.baseline, readClassification: async () => ({ status: "unavailable" as const, reason: "classification-unavailable" }) } }
  expect(await readSfDecisionCoverage(missing, value.selection, value.context)).toEqual({ status: "unavailable", reason: "classification-unavailable" })
  const forged = { ...value.context, binding: { ...value.context.binding, principalRef: "other" } } as TrustedUiContext
  expect(await readSfDecisionCoverage(value.input, value.selection, forged)).toEqual({ status: "denied", reason: "decision-coverage-read-authority-unavailable" })
  expect(value.state.calls).toBe(0)
  value.ui.finish(value.context)
})
