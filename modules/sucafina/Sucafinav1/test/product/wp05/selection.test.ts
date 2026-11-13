import { expect, test } from "bun:test"
import { presentProjection } from "../../../product/analytics/catalog.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"

const period = { start: "2027-01-01", end: "2027-01-31" }
const ref: BusinessEvidenceRef = { schema: "sf-evidence-v1", refId: "ref", installationId: "i", projectId: "p", refDigest: "digest", evidenceLevel: "observed", kind: "record", target: { surface: "dashboard", recordType: "metric", recordId: "m", incarnation: "inc", version: 7, fields: ["value"], period, projectionDigest: "digest" } }
const projection: DomainProjection = { context: { installationId: "i", projectId: "p", principalRef: "u", policyVersion: "v", accessRevision: "a", surface: "dashboard", period, currency: "USD", sourceRefs: [], capabilities: [] }, version: 7, engineVersion: "engine-1", components: [], missing: [], values: [{ id: "zero", value: 0, currency: "USD", period, granularity: "month", sourceRefs: [ref], drilldown: ref, evidenceState: "confirmed" }, { id: "gap", value: null, currency: "USD", period, granularity: "month", sourceRefs: [ref], drilldown: null, evidenceState: "absent" }] }

test("selection retains authorized context, source, projection version and zero", () => {
  const rows = presentProjection(projection, "selection-1").rows
  expect(rows[0]?.value).toBe(0)
  expect(rows[1]?.value).toBeNull()
  expect(rows[0]?.selection).toEqual({ context: projection.context, selectionRef: "selection-1", projectionVersion: 7, engineVersion: "engine-1", valueId: "zero", reference: ref })
})

test("a numeric placeholder marked absent is not displayed as observed zero", () => {
  const value = { ...projection.values[0]!, id: "placeholder", value: 0, evidenceState: "absent" as const }
  expect(presentProjection({ ...projection, values: [value] }, "selection-1").rows[0]?.value).toBeNull()
  expect(presentProjection(projection, "selection-1").rows[0]?.value).toBe(0)
})
