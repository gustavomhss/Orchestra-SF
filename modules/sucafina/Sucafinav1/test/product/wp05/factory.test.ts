import { expect, test } from "bun:test"
import { createSfBiFactory } from "../../../product/analytics/factory.ts"
import type { SfDomainValidation } from "../../../product/contracts/runtime.ts"

const authority: SfDomainValidation = { validateDomainContext: async () => false, revalidateDomainContext: async () => false, receiptFor: () => undefined }

test("composition exposes the shared descriptor and rejects invalid or duplicate routes", () => {
  const procurement = { list: async () => ({ status: "unavailable" as const, reason: "no-selection" }), revalidate: async () => false }
  const factory = createSfBiFactory({ authority, procurement: { views: ["BI05", "BI06"], host: procurement } })
  expect(factory.descriptor.id).toBe("sf_bi_view")
  expect(() => createSfBiFactory({ authority, procurement: { views: ["BI01"], host: procurement } })).toThrow("BI_ROUTE_CONFIGURATION_INVALID")
  expect(() => createSfBiFactory({ authority, procurement: { views: ["BI05", "BI05"], host: procurement } })).toThrow("BI_ROUTE_CONFIGURATION_INVALID")
})

test("overlapping producer routes require a host selection and reject unregistered producers", async () => {
  const { createSfUiAuthority } = await import("../../../product/integration/ui-authority.ts")
  const { digestSfValue } = await import("../../../product/contracts/canonical.ts")
  const request = { viewId: "BI01", selectionRef: "selection", period: { start: "2027-01-01", end: "2027-12-31" } }
  const ui = createSfUiAuthority({ authorize: async () => ({ installationId: "i", projectId: "p", principalRef: "u", policyVersion: "v", accessRevision: "a" }), commandIdentity: async () => "command", createId: () => "request", now: () => Date.parse("2026-11-13T00:00:00Z") })
  const admitted = await ui.admit(new Request("https://example.test"), "sf_bi_view", digestSfValue(request))
  expect(admitted.status).toBe("ok")
  if (admitted.status !== "ok") return
  const dashboard = { views: ["BI01" as const], host: { dashboard: { read: async () => ({ status: "unavailable" as const, reason: "dashboard-read" }) }, resolve: async () => ({ status: "unavailable" as const, reason: "dashboard-selection" }), revalidate: async () => false } }
  const planner = { views: ["BI01" as const], host: { planner: { compareForecast: async () => ({ status: "unavailable" as const, reason: "planner-read" }), simulateScenario: async () => ({ status: "unavailable" as const, reason: "unused" }), compareScenarios: async () => ({ status: "unavailable" as const, reason: "unused" }), evaluateSensitivity: async () => ({ status: "unavailable" as const, reason: "unused" }) }, resolve: async () => ({ status: "unavailable" as const, reason: "planner-selection" }), revalidate: async () => false } }
  expect(() => createSfBiFactory({ authority, dashboard, planner })).toThrow("BI_ROUTE_CONFIGURATION_INVALID")
  const factory = createSfBiFactory({ authority, dashboard, planner, select: async () => ({ status: "ok", value: "planner" }) })
  expect(await factory.source.read(request, admitted.value)).toEqual({ status: "unavailable", reason: "planner-selection" })
  const invalid = createSfBiFactory({ authority, dashboard, planner, select: async () => ({ status: "ok", value: "portfolio" }) })
  expect(await invalid.source.read(request, admitted.value)).toEqual({ status: "denied", reason: "producer-selection-invalid" })
})
