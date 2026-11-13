import { expect, test } from "bun:test"
import { presentDashboardBi, resolveDashboardBiSelection } from "../../../product/dashboard/bi-metadata.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"

const period = { start: "2026-01-01", end: "2026-12-31" }
const source = { surface: "dashboard" as const, type: "dashboard-page", id: "Budget Overview", incarnation: "inc", version: 1, fields: ["budgetSeries"], period, observedAt: "2026-11-13T00:00:00Z" }
const projection: DomainProjection = { context: { installationId: "i", projectId: "p", principalRef: "a", accessRevision: "1", policyVersion: "1", surface: "dashboard", period, currency: "unspecified", sourceRefs: [source], capabilities: [] }, version: 1, engineVersion: "dashboard-runtime-v1", components: [], values: [{ id: "budget:2026-01:effective", value: 10, currency: "unspecified", period: { start: "2026-01-01", end: "2026-01-31" }, granularity: "month", sourceRefs: [], drilldown: null, evidenceState: "estimated" }], missing: [] }

test("BI selections use producer fields and enforce their period", () => {
  expect(resolveDashboardBiSelection("BI01", period)).toEqual({ page: "Budget Overview", fields: ["budgetSeries"] })
  expect(resolveDashboardBiSelection("BI07", { start: "2026-02-01", end: "2026-02-28" })).toEqual({ page: "IT Operations", fields: ["opsTickets"] })
  expect(resolveDashboardBiSelection("BI08", period)).toEqual({ page: "Portfolio Dashboard", fields: ["milestoneDates"] })
  expect(resolveDashboardBiSelection("BI01", { start: "2026-01-01", end: "2026-01-31" })).toEqual({ page: "Budget Overview", fields: ["budgetSeries"] })
  expect(resolveDashboardBiSelection("BI01", { start: "2026-01-02", end: "2026-01-31" })).toBeUndefined()
  expect(resolveDashboardBiSelection("BI07", { start: "2026-02-02", end: "2026-02-28" })).toBeUndefined()
  expect(resolveDashboardBiSelection("BI02", period)).toBeUndefined()
})

test("BI presentation binds source and declares budget semantics without inventing currency", () => {
  const result = presentDashboardBi("BI01", projection)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") return
  expect(result.value.series).toContainEqual(expect.objectContaining({ id: "effective", role: "budget", unit: "unspecified", valueIds: ["budget:2026-01:effective"] }))
  expect(presentDashboardBi("BI07", projection)).toMatchObject({ status: "unavailable" })
  expect(presentDashboardBi("BI01", { ...projection, values: [...projection.values, projection.values[0]!] })).toMatchObject({ status: "unavailable", reason: "duplicate-value-id" })
  const empty = presentDashboardBi("BI01", { ...projection, values: [] })
  expect(empty.status === "ok" && empty.value.limitations).toContain("No measurements are available for this selection.")
})

test("ticket and milestone views use the producer's explicit semantics", () => {
  const ticket = { ...projection.values[0]!, id: "tickets:2026-01:Infrastructure|Incidents|Open", value: 3, unit: "tickets", currency: undefined, evidenceState: "confirmed" as const }
  const operations = { ...projection, context: { ...projection.context, sourceRefs: [{ ...source, id: "IT Operations", fields: ["opsTickets"] }] }, values: [ticket] }
  const tickets = presentDashboardBi("BI07", operations)
  expect(tickets.status).toBe("ok")
  if (tickets.status === "ok") expect(tickets.value.series).toContainEqual(expect.objectContaining({ role: "opened", unit: "tickets", valueIds: [ticket.id] }))
  const milestone = { ...projection.values[0]!, id: "milestone:p:m:date", value: "2026-02-03", unit: "date", currency: undefined, granularity: "record" as const }
  const projects = { ...projection, context: { ...projection.context, sourceRefs: [{ ...source, id: "Portfolio Dashboard", fields: ["milestoneDates"] }] }, values: [milestone] }
  const timeline = presentDashboardBi("BI08", projects)
  expect(timeline.status).toBe("ok")
  if (timeline.status === "ok") expect(timeline.value.series).toContainEqual(expect.objectContaining({ role: "planned", unit: "date", valueIds: [milestone.id] }))
})
