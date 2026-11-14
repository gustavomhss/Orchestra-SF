import { expect, test } from "bun:test"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { SourceRef } from "../../../product/contracts/context.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createReviewPort, validChart, validSectionProjection } from "../../../product/reviews/port.ts"
import type { ReviewSection } from "../../../product/reviews/port.ts"
import { validReviewOutcome } from "../../../product/reviews/outcome.ts"
import { testPersistence } from "./persistence.ts"

const period = { start: "2026-01-01", end: "2026-12-31" }
const identity = { installationId: "installation", projectId: "project", principalRef: "reviewer", accessRevision: "access", policyVersion: "policy" }
const context = { kind: "ui", binding: identity } as unknown as TrustedDomainContext

function fixture() {
  const source = (id: string): SourceRef => ({ surface: "dashboard", type: "projects", id, incarnation: id + "-original", version: 1, fields: ["amount"], period, observedAt: "2026-11-14T00:00:00Z" })
  const evidence = (id: string): BusinessEvidenceRef => ({ schema: "sf-evidence-v1", refId: id, installationId: identity.installationId, projectId: identity.projectId, refDigest: id, evidenceLevel: "observed", kind: "record", target: { surface: "dashboard", recordType: "projects", recordId: id, incarnation: id + "-original", version: 1, fields: ["amount"], period, projectionDigest: id } })
  const productContext = { ...identity, surface: "dashboard" as const, period, currency: "USD", sourceRefs: [source("main")], capabilities: [] }
  const section: ReviewSection = { id: "budget", title: "Budget comparison", period, recordCount: 1, projection: {
    context: productContext, version: 1, engineVersion: "fixture-v1", missing: [],
    components: [{ id: "component", amount: 10, currency: "USD", period, sourceRefs: [source("component-source")], evidenceState: "confirmed" }],
    values: [{ id: "amount", value: 1320, currency: "USD", period, granularity: "year", sourceRefs: [evidence("main")], drilldown: evidence("detail-only"), evidenceState: "confirmed" }],
    comparison: { metricRef: "baseline", comparisonRef: "comparison", context: { ...productContext, sourceRefs: [source("comparison-source")] }, version: 1, engineVersion: "fixture-v1", values: [{ id: "baseline", value: 1000, currency: "USD", period, granularity: "year", sourceRefs: [evidence("comparison-value")], drilldown: evidence("comparison-detail"), evidenceState: "confirmed" }] },
  } }
  const denied = new Set<string>()
  const storage = testPersistence()
  const state = createSfProductState({ persistence: storage.persistence, createId: () => "state", resolveTarget: async () => ({ incarnation: "workspace-inc" }), authorize: async () => identity })
  const port = createReviewPort({
    state, creationTarget: { ref: "workspace", incarnation: "workspace-inc" }, now: () => "2026-11-14T00:00:00Z", requestFor: () => new Request("https://example.test"),
    select: async () => ({ status: "ok", value: [section] }),
    authorizeSections: async () => true, authorizeComments: async () => true, authorizeOutcomeComparison: async () => true, authorizeOutcome: async () => true, authorizeDecision: async () => true, authorizeSensitivity: async () => true,
    revalidate: async (_context, refs) => refs.every((ref) => !denied.has(ref.id)),
    revalidateEvidence: async (_context, refs) => refs.every((ref) => !denied.has(ref.refId)),
  })
  return { section, denied, port, evidence }
}

test("review preview and preserved reads revalidate comparison sources, components and drilldown-only evidence", async () => {
  const f = fixture()
  expect((await f.port.preview("selected", ["budget"], context)).status).toBe("ok")
  const preserved = await f.port.preserve({ id: "saved", selectionRef: "selected", sectionRefs: ["budget"], expectedStorageVersion: 0, idempotencyKey: "save", targetIncarnation: "workspace-inc" }, context)
  expect(preserved.status).toBe("ok")
  for (const restricted of ["comparison-source", "component-source", "detail-only", "comparison-value", "comparison-detail"]) {
    f.denied.add(restricted)
    const preview = await f.port.preview("selected", ["budget"], context)
    const saved = await f.port.read("saved", context)
    expect(preview.status).toBe("denied")
    expect(saved.status).toBe("denied")
    expect(JSON.stringify(preview)).not.toContain("1320")
    expect(JSON.stringify(saved)).not.toContain("1000")
    f.denied.clear()
  }
  expect((await f.port.read("saved", context)).status).toBe("ok")
  f.section.projection.comparison!.context.principalRef = "other-reader"
  expect(await f.port.preview("selected", ["budget"], context)).toEqual({ status: "denied", reason: "context-mismatch" })
})

test.each(["projection", "value", "component", "missing", "comparison", "drilldown"])("review admission rejects unknown private bytes inside %s", async (path) => {
  const f = fixture()
  expect(validSectionProjection(f.section)).toBe(true)
  const privateDiagnostic = { privateDiagnostic: { salary: 123 } }
  if (path === "projection") Object.assign(f.section.projection, privateDiagnostic)
  if (path === "value") Object.assign(f.section.projection.values[0]!, privateDiagnostic)
  if (path === "component") Object.assign(f.section.projection.components[0]!, privateDiagnostic)
  if (path === "missing") f.section.projection.missing = [Object.assign({ field: "missing", reason: "unavailable" as const }, privateDiagnostic)]
  if (path === "comparison") Object.assign(f.section.projection.comparison!.context, privateDiagnostic)
  if (path === "drilldown") Object.assign(f.section.projection.values[0]!.drilldown!.target, privateDiagnostic)
  expect(validSectionProjection(f.section)).toBe(false)
  const preview = await f.port.preview("selected", ["budget"], context)
  expect(preview.status).toBe("unavailable")
  expect(JSON.stringify(preview)).not.toContain("salary")
})

test("known chart and outcome extensions reject unknown nested metadata", () => {
  const f = fixture()
  const chart = { status: "ok" as const, viewId: "BI01", series: [{ id: "amount", label: "Amount", unit: "USD", role: "budget", valueIds: ["amount"], values: f.section.projection.values }], limitations: [], unassigned: [] }
  expect(validChart(f.section.projection, chart)).toBe(true)
  expect(validChart(f.section.projection, { ...chart, timeline: { status: "unavailable", reason: { privateDiagnostic: "salary" } } } as unknown as typeof chart)).toBe(false)
  for (const key of ["sensitivity", "waterfall", "timeline"] as const) expect(validChart(f.section.projection, { ...chart, [key]: null } as unknown as typeof chart)).toBe(false)
  Object.assign(chart.series[0]!, { privateDiagnostic: { salary: 123 } })
  expect(validChart(f.section.projection, chart)).toBe(false)
  const outcome = { caseRef: { id: "case", incarnation: "case-inc", version: 1 }, expected: 1000, observed: 1320, cutoff: "2026-12-31T00:00:00Z", currency: "USD", sourceRefs: [f.evidence("outcome")], limitations: [] }
  expect(validReviewOutcome(outcome)).toBe(true)
  Object.assign(outcome.caseRef, { privateDiagnostic: { salary: 123 } })
  expect(validReviewOutcome(outcome)).toBe(false)
})
