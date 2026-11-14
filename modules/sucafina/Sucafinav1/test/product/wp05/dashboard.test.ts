import { expect, test } from "bun:test"
import { createDashboardBiSource } from "../../../product/analytics/dashboard.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { TrustedUiContext, TrustedUiLease } from "../../../product/contracts/sf-execution.ts"
import type { BiPresentation } from "../../../product/analytics/semantics.ts"

const period = { start: "2027-01-01", end: "2027-12-31" }
const context: TrustedUiContext = { kind: "ui", lease: {} as TrustedUiLease, binding: { installationId: "i", projectId: "p", principalRef: "u", requestId: "r", policyVersion: "v", accessRevision: "a", expiresAt: "2030-01-01T00:00:00Z" } }
const projection: DomainProjection = { context: { installationId: "i", projectId: "p", principalRef: "u", policyVersion: "v", accessRevision: "a", surface: "dashboard", period, currency: "USD", sourceRefs: [], capabilities: [] }, version: 1, engineVersion: "dashboard-v1", components: [], values: [], missing: [] }
const presentation: BiPresentation = { viewId: "BI07", series: [], limitations: ["Only a current snapshot is available"] }
const request = { viewId: "BI07", selectionRef: "selection", period }

test("dashboard adapter refuses metadata after the source version changes", async () => {
  let current = projection
  const source = createDashboardBiSource({ readView: async () => ({ status: "ok", value: { projection: current, presentation } }), revalidate: async () => true })
  const first = await source.read(request, context)
  expect(first.status).toBe("ok")
  if (first.status !== "ok") return
  current = { ...projection, version: 2 }
  expect(await source.describe(request, context, first.value)).toEqual({ status: "stale", reason: "projection-changed" })
})

test("dashboard binding forwards the original selection and period to the domain", async () => {
  const { bindDashboardBiPort } = await import("../../../product/analytics/dashboard.ts")
  let observed = ""
  const host = bindDashboardBiPort({ dashboard: { read: async (input) => { observed = `${input.selectionRef}:${input.period.start}:${input.fields.join(",")}`; return { status: "ok", value: projection } } }, resolve: async () => ({ status: "ok", value: { fields: ["opsTickets"], present: () => presentation } }), revalidate: async () => true })
  expect((await host.readView(request, context)).status).toBe("ok")
  expect(observed).toBe("selection:2027-01-01:opsTickets")
})
