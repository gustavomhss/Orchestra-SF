import { expect, test } from "bun:test"
import { resolveBiPresentation } from "../../../product/analytics/semantics.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { BiPresentation } from "../../../product/analytics/semantics.ts"

const period = { start: "2027-01-01", end: "2027-12-31" }
const projection: DomainProjection = { context: { installationId: "i", projectId: "p", principalRef: "u", policyVersion: "v", accessRevision: "a", surface: "planner", currency: "USD", period, sourceRefs: [], capabilities: [] }, version: 1, engineVersion: "v", components: [], missing: [], values: [{ id: "a", value: 20, unit: "money", currency: "USD", period, granularity: "year", sourceRefs: [], drilldown: null, evidenceState: "confirmed" }, { id: "b", value: null, unit: "money", currency: "EUR", period, granularity: "year", sourceRefs: [], drilldown: null, evidenceState: "absent" }] }
const presentation: BiPresentation = { viewId: "BI01", series: [{ id: "budget", label: "Budget", unit: "money", role: "budget", valueIds: ["a"] }], limitations: ["annual only"] }

test("producer supplies roles, unresolved values remain visible and no months are inferred", () => {
  const result = resolveBiPresentation(projection, presentation)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") return
  expect(result.series[0]?.values).toEqual([projection.values[0]])
  expect(result.unassigned).toEqual([projection.values[1]])
  expect(result.limitations).toEqual(["annual only"])
})

test("rejects unknown references and mixed currencies in one series", () => {
  expect(resolveBiPresentation(projection, { ...presentation, series: [{ ...presentation.series[0]!, valueIds: ["missing"] }] })).toEqual({ status: "unavailable", reason: "unknown-series-value" })
  expect(resolveBiPresentation(projection, { ...presentation, series: [{ ...presentation.series[0]!, valueIds: ["a", "b"] }] })).toEqual({ status: "unavailable", reason: "incompatible-currency" })
})

test("alignment keys must uniquely identify every provided value", () => {
  expect(resolveBiPresentation(projection, { ...presentation, series: [{ ...presentation.series[0]!, alignmentKeys: [] }] })).toEqual({ status: "unavailable", reason: "invalid-alignment-keys" })
})

test("annual and monthly financial points cannot be blended into one series", () => {
  const mixed = { ...projection, values: [projection.values[0]!, { ...projection.values[1]!, currency: "USD", granularity: "month" as const }] }
  expect(resolveBiPresentation(mixed, { ...presentation, series: [{ ...presentation.series[0]!, valueIds: ["a", "b"] }] })).toEqual({ status: "unavailable", reason: "unsupported-financial-granularity" })
})

test("a producer cannot relabel a currency as another currency", () => {
  const single = { ...projection, values: [{ ...projection.values[0]!, unit: undefined }] }
  expect(resolveBiPresentation(single, { ...presentation, series: [{ ...presentation.series[0]!, unit: "EUR" }] })).toEqual({ status: "unavailable", reason: "incompatible-unit" })
})

test("ticket categories cannot masquerade as consecutive monthly points", () => {
  const tickets = { ...projection, values: projection.values.map((value) => ({ ...value, unit: "tickets", currency: undefined, granularity: "month" as const })) }
  const input: BiPresentation = { viewId: "BI07", series: [{ id: "open", label: "Opened", unit: "tickets", role: "opened", valueIds: ["a", "b"] }], limitations: [] }
  expect(resolveBiPresentation(tickets, input)).toEqual({ status: "unavailable", reason: "duplicate-series-period" })
})

test("a numeric point with missing currency cannot share a priced series", () => {
  const values = [projection.values[0]!, { ...projection.values[1]!, value: 3, currency: undefined, period: { start: "2028-01-01", end: "2028-12-31" } }]
  expect(resolveBiPresentation({ ...projection, values }, { ...presentation, series: [{ ...presentation.series[0]!, valueIds: ["a", "b"] }] })).toEqual({ status: "unavailable", reason: "currency-missing" })
})

test("series identifiers must be unique", () => {
  expect(resolveBiPresentation(projection, { ...presentation, series: [presentation.series[0]!, { ...presentation.series[0]!, valueIds: [] }] })).toEqual({ status: "unavailable", reason: "duplicate-series-id" })
})
