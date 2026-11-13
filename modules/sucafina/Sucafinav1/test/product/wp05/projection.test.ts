import { expect, test } from "bun:test"
import { sameBiProjection } from "../../../product/analytics/projection.ts"
import type { DomainProjection, SourceRef } from "../../../product/contracts/context.ts"

const period = { start: "2027-01-01", end: "2027-12-31" }
const ref: SourceRef = { surface: "planner", type: "planner-version", id: "v1", incarnation: "inc1", version: 1, fields: ["lines"], period, observedAt: "2027-01-01T00:00:00Z" }
const projection: DomainProjection = { context: { installationId: "i", projectId: "p", principalRef: "u", policyVersion: "v", accessRevision: "a", surface: "planner", period, currency: "USD", sourceRefs: [ref], capabilities: [] }, version: 1, engineVersion: "engine", values: [], missing: [], components: [{ id: "line", amount: 1, currency: "USD", period, sourceRefs: [ref], evidenceState: "confirmed" }] }

test("observation timestamps do not create stale data, while source and value changes do", () => {
  const later = { ...ref, observedAt: "2027-01-01T00:00:01Z" }
  expect(sameBiProjection(projection, { ...projection, context: { ...projection.context, sourceRefs: [later] }, components: [{ ...projection.components[0]!, sourceRefs: [later] }] })).toBe(true)
  expect(sameBiProjection(projection, { ...projection, context: { ...projection.context, sourceRefs: [{ ...later, version: 2 }] } })).toBe(false)
  expect(sameBiProjection(projection, { ...projection, components: [{ ...projection.components[0]!, amount: 2 }] })).toBe(false)
})
