import { expect, test } from "bun:test"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import { decisionFormContext } from "../../../product/ui/decision-alternatives.ts"
import { decisionEditScript, decisionProcurementEvidence } from "../../../product/ui/decision-edit.ts"

const period = { start: "2027-01-01", end: "2027-12-31" }
const authority = { kind: "ui" as const, installationId: "installation", projectId: "project", principalRef: "reader", accessRevision: "access", policyVersion: "policy" }
const scope: ReturnType<typeof decisionFormContext> = { scope: "scope", authority, caseRef: { id: "case", incarnation: "case-inc", version: 2 }, caseSelector: "case", horizon: period, currency: "USD", sourceRefs: [] }
function fixture() {
  const ref: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", kind: "record", installationId: authority.installationId, projectId: authority.projectId, refId: "canonical-request", refDigest: "a".repeat(64), evidenceLevel: "observed", target: { surface: "procurement", recordType: "procurement-request", recordId: "PR-2027-1", incarnation: "pr-inc", version: 2, fields: ["status", "stageChangedAt"], period, projectionDigest: "b".repeat(64) } }
  const projection: DomainProjection = { context: { ...authority, surface: "procurement", period, currency: "USD", sourceRefs: [], capabilities: [] }, version: 2, engineVersion: "fixture-only", components: [], missing: [{ field: "ageDays", reason: "unavailable" }], values: [{ id: "PR-2027-1:pr-inc:ageDays", value: null, unit: "days", period, granularity: "record", sourceRefs: [ref], drilldown: ref, evidenceState: "absent" }] }
  return { ref, projection }
}

test("Procurement evidence selector keeps the exact issued reference and never derives an amount from missing age", () => {
  const value = fixture()
  const original = structuredClone(value.projection)
  expect(decisionProcurementEvidence(value.projection, scope)).toEqual([value.ref])
  expect(value.projection).toEqual(original)
  expect(value.projection.values[0]?.value).toBeNull()
  expect(value.ref.target.fields).not.toContain("estAmount")
})

test("Procurement evidence selector rejects a different principal, revision, currency or horizon", () => {
  const { projection } = fixture()
  for (const context of [{ ...projection.context, principalRef: "other" }, { ...projection.context, accessRevision: "revoked" }, { ...projection.context, policyVersion: "changed" }, { ...projection.context, currency: "EUR" }, { ...projection.context, period: { start: "2026-01-01", end: "2026-12-31" } }])
    expect(() => decisionProcurementEvidence({ ...projection, context }, scope)).toThrow("procurement-source-unavailable")
})

test("Procurement evidence selector filters out foreign records and refuses ambiguous issued references", () => {
  const { projection, ref } = fixture()
  const foreign = { ...ref, projectId: "other-project" }
  const outside = { ...ref, target: { ...ref.target, period: { start: "2027-01-01", end: "2027-01-31" } } }
  const invalidVersion = { ...ref, target: { ...ref.target, version: 0 } }
  const row = projection.values[0]!
  expect(decisionProcurementEvidence({ ...projection, values: [{ ...row, sourceRefs: [foreign, outside, invalidVersion], drilldown: null }] }, scope)).toEqual([])
  const ambiguous = { ...ref, refDigest: "c".repeat(64) }
  expect(() => decisionProcurementEvidence({ ...projection, values: [{ ...row, sourceRefs: [ref, ambiguous] }] }, scope)).toThrow("ambiguous-procurement-source")
})

test("the mounted Edit initializer parses with both canonical evidence readers", () => {
  expect(() => new Bun.Transpiler({ loader: "js" }).transformSync(decisionEditScript)).not.toThrow()
})
