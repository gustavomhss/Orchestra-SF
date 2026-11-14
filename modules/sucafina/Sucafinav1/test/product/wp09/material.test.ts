import { expect, test } from "bun:test"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { DomainProjection, SourceRef } from "../../../product/contracts/context.ts"
import { routineProjectionMaterial } from "../../../product/routines/material.ts"
import { compareProjections } from "../../../product/routines/review.ts"

function projection(age: number | null): DomainProjection {
  const period = { start: "2027-01-01", end: "2027-01-31" }
  const source: SourceRef = { surface: "procurement", type: "requests", id: "request", incarnation: "request-inc", version: 1, fields: ["ageDays", "stageEnteredAt"], period, observedAt: "2027-01-10T00:00:00Z" }
  const unsigned: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", kind: "record", refId: "evidence", refDigest: "", installationId: "i", projectId: "p", evidenceLevel: "observed", target: { surface: "procurement", recordType: "requests", recordId: "request", incarnation: "request-inc", version: 1, fields: ["ageDays"], period, projectionDigest: digestSfValue({ stageEnteredAt: "2027-01-01T00:00:00Z" }) } }
  const evidence = { ...unsigned, refDigest: digestSfEvidenceRef(unsigned) }
  return { context: { installationId: "i", projectId: "p", principalRef: "reader", accessRevision: "1", policyVersion: "1", surface: "procurement", period, currency: "USD", sourceRefs: [source], capabilities: [] }, version: 1, engineVersion: "procurement-v1", components: [], missing: [], values: [
    { id: "ageDays", value: age, unit: "days", period, granularity: "record", evidenceState: age === null ? "absent" : "confirmed", sourceRefs: [evidence], drilldown: evidence },
    { id: "stageEnteredAt", value: "2027-01-01T00:00:00Z", period, granularity: "record", evidenceState: "confirmed", sourceRefs: [evidence], drilldown: evidence },
  ] }
}

test("elapsed Procurement stage age alone is not a material change or new review delta", () => {
  const before = projection(9)
  const after = projection(10)
  expect(digestSfValue(routineProjectionMaterial(before))).toBe(digestSfValue(routineProjectionMaterial(after)))
  expect(compareProjections(before, after)).toEqual([])
  expect(before.values[0]?.value).toBe(9)
  expect(after.values[0]?.value).toBe(10)
})

test("stage entry, absence and evidence remain material while clock-derived age is normalized", () => {
  const before = projection(9)
  const after = projection(10)
  after.values = after.values.map((value) => value.id === "stageEnteredAt" ? { ...value, value: "2027-01-02T00:00:00Z" } : value)
  expect(digestSfValue(routineProjectionMaterial(before))).not.toBe(digestSfValue(routineProjectionMaterial(after)))
  expect(compareProjections(before, after)).toMatchObject([{ state: "changed", current: { id: "stageEnteredAt" }, delta: null }])
  expect(compareProjections(projection(null), projection(0))).toMatchObject([{ state: "changed", current: { id: "ageDays", value: 0 }, delta: null }])
})

test("an ageDays label without the canonical Procurement producer is never normalized", () => {
  const before = { ...projection(9), engineVersion: "another-engine" }
  const after = { ...projection(10), engineVersion: "another-engine" }
  expect(digestSfValue(routineProjectionMaterial(before))).not.toBe(digestSfValue(routineProjectionMaterial(after)))
  expect(compareProjections(before, after)).toMatchObject([{ state: "changed", delta: 1 }])
})
