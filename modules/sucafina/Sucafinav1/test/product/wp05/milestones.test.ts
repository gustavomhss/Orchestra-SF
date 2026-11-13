import { expect, test } from "bun:test"
import { resolveTimeline } from "../../../product/analytics/milestones.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"

const period = { start: "2027-01-01", end: "2027-12-31" }
const projection: DomainProjection = { context: { installationId: "i", projectId: "p", principalRef: "u", policyVersion: "v", accessRevision: "a", surface: "dashboard", period, currency: "USD", sourceRefs: [], capabilities: [] }, version: 1, engineVersion: "v", components: [], missing: [], values: [{ id: "planned", value: "2027-03-01", period, granularity: "record", sourceRefs: [], drilldown: null, evidenceState: "estimated" }, { id: "unknown", value: null, period, granularity: "record", sourceRefs: [], drilldown: null, evidenceState: "absent" }, { id: "done", value: "2027-02-15", period, granularity: "record", sourceRefs: [], drilldown: null, evidenceState: "confirmed" }] }

test("planned, confirmed and undated milestones remain distinct", () => {
  const result = resolveTimeline(projection, { items: [{ label: "Planned", dateValueId: "planned", state: "planned" }, { label: "Unknown", dateValueId: "unknown", state: "completed" }, { label: "Completed", dateValueId: "done", state: "completed" }] })
  expect(result.status).toBe("ok")
  if (result.status !== "ok") return
  expect(result.items.map((item) => [item.state, item.date])).toEqual([["planned", "2027-03-01"], ["unknown", null], ["completed", "2027-02-15"]])
})
