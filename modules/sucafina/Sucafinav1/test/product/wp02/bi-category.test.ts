import { expect, test } from "bun:test"
import { dashboardBiPresentation } from "../../../product/dashboard/bi.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"

test("BI07 preserves category delimiters and keeps distinct categories separate", () => {
  const period = { start: "2026-01-01", end: "2026-01-31" }
  const projection: DomainProjection = { context: { installationId: "i", projectId: "p", principalRef: "a", accessRevision: "1", policyVersion: "1", surface: "dashboard", period, currency: "unspecified", sourceRefs: [], capabilities: [] }, version: 1, engineVersion: "dashboard", components: [], missing: [], values: ["Infrastructure|Site|Incidents|Open", "Site|Incidents|Open", "Infrastructure|Incidents|Closed"].map((group) => ({ id: `tickets:2026-01:${group}`, value: 1, unit: "tickets", period, granularity: "month", sourceRefs: [], drilldown: null, evidenceState: "confirmed" })) }
  const series = dashboardBiPresentation("BI07", projection).series
  expect(series.find((entry) => entry.id === "Infrastructure|Site|Incidents|Open")).toMatchObject({ label: "Infrastructure|Site — Incidents — Opened", role: "opened", valueIds: ["tickets:2026-01:Infrastructure|Site|Incidents|Open"] })
  expect(series.find((entry) => entry.id === "Site|Incidents|Open")).toMatchObject({ label: "Site — Incidents — Opened", role: "opened", valueIds: ["tickets:2026-01:Site|Incidents|Open"] })
  expect(series.find((entry) => entry.id === "Infrastructure|Incidents|Closed")).toMatchObject({ role: "closed" })
})
