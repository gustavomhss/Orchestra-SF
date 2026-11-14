import { expect, test } from "bun:test"
import { presentTickets } from "../../../product/analytics/tickets.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"

const period = { start: "2027-01-01", end: "2027-01-31" }
const projection: DomainProjection = { context: { installationId: "i", projectId: "p", principalRef: "u", policyVersion: "v", accessRevision: "a", surface: "dashboard", period, currency: "USD", sourceRefs: [], capabilities: [] }, version: 1, engineVersion: "dashboard", components: [], missing: [], values: [
  { id: "open", value: 3, unit: "tickets", period, granularity: "record", sourceRefs: [], drilldown: null, evidenceState: "confirmed" },
  { id: "closed", value: null, unit: "tickets", period, granularity: "record", sourceRefs: [], drilldown: null, evidenceState: "absent" },
] }

test("ticket snapshot remains a snapshot and preserves missing values", () => {
  const result = presentTickets(projection, { mode: "snapshot", series: [
    { id: "opened", label: "Open now", unit: "tickets", role: "opened", valueIds: ["open"] },
    { id: "closed", label: "Closed", unit: "tickets", role: "closed", valueIds: ["closed"] },
  ] })
  expect(result?.viewId).toBe("BI07")
  expect(result?.limitations).toEqual(["Fotografia atual; não representa histórico de entradas ou conclusões."])
  expect(projection.values[1]?.value).toBeNull()
  const aggregate = { ...projection, values: projection.values.map((value) => ({ ...value, granularity: "aggregate" as const })) }
  expect(presentTickets(aggregate, { mode: "snapshot", series: [{ id: "current", label: "Current stock", unit: "tickets", role: "opened", valueIds: ["open"] }, { id: "closed", label: "Closed", unit: "tickets", role: "closed", valueIds: ["closed"] }] })?.limitations).toEqual(["Fotografia atual; não representa histórico de entradas ou conclusões."])
})

test("ticket history requires producer supplied dated aggregates", () => {
  const dated = { ...projection, values: projection.values.map((value, index) => ({ ...value, period: index ? { start: "2027-02-01", end: "2027-02-28" } : value.period, granularity: "month" as const })) }
  const result = presentTickets(dated, { mode: "dated-series", series: [{ id: "opened", label: "Entered", unit: "tickets", role: "opened", valueIds: ["open", "closed"] }] })
  expect(result?.limitations).toEqual([])
  expect(presentTickets(projection, { mode: "dated-series", series: [{ id: "opened", label: "Entered", unit: "tickets", role: "opened", valueIds: ["open", "closed"] }] })).toBeNull()
})
