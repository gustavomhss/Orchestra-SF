import { expect, test } from "bun:test"
import { resolveWaterfall } from "../../../product/analytics/waterfall.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { WaterfallPlan } from "../../../product/analytics/waterfall.ts"

const period = { start: "2027-01-01", end: "2027-12-31" }
const projection: DomainProjection = { context: { installationId: "i", projectId: "p", principalRef: "u", policyVersion: "v", accessRevision: "a", surface: "planner", period, currency: "USD", sourceRefs: [], capabilities: [] }, version: 1, engineVersion: "v", components: [], missing: [], values: [["initial", 100], ["up", 20], ["middle", 120], ["down", -5], ["end", 115], ["final", 115]].map(([id, value]) => ({ id: String(id), value, unit: "money", currency: "USD", period, granularity: "aggregate" as const, sourceRefs: [], drilldown: null, evidenceState: "confirmed" as const })) }
const plan: WaterfallPlan = { segments: [{ label: "Increase", startValueId: "initial", endValueId: "middle", componentValueId: "up" }, { label: "Decrease", startValueId: "middle", endValueId: "end", componentValueId: "down" }], finalValueId: "final", reconciliation: "reconciled" }

test("projected endpoints reconcile without inventing a residual", () => {
  const valid = resolveWaterfall(projection, plan)
  expect(valid.status).toBe("ok")
  if (valid.status !== "ok") return
  expect(valid.reconciliation).toBe("reconciled")
  expect(valid.segments.map((segment) => segment.amount)).toEqual([20, -5])
  const altered = resolveWaterfall({ ...projection, values: projection.values.map((value) => value.id === "final" ? { ...value, value: 116 } : value) }, plan)
  expect(altered.status === "ok" && altered.reconciliation).toBe("unreconciled")
  expect(altered.status === "ok" && altered.segments).toHaveLength(2)
})

test("the producer must attest financial reconciliation", () => {
  const result = resolveWaterfall(projection, { ...plan, reconciliation: "unavailable" })
  expect(result.status === "ok" && result.reconciliation).toBe("unavailable")
})
