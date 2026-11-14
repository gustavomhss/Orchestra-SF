import { expect, test } from "bun:test"
import { createSfBiFactory } from "../../../product/analytics/factory.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { SfDomainValidation } from "../../../product/contracts/runtime.ts"

test("producer selection cannot switch between read and revalidation in one bound call", async () => {
  const authority: SfDomainValidation = { validateDomainContext: async () => false, revalidateDomainContext: async () => true, receiptFor: () => undefined }
  const request = { viewId: "BI01", selectionRef: "selection", period: { start: "2027-01-01", end: "2027-12-31" } }
  const ui = createSfUiAuthority({ authorize: async () => ({ installationId: "i", projectId: "p", principalRef: "u", policyVersion: "1", accessRevision: "1" }), commandIdentity: async () => "command", createId: () => "request", now: () => Date.parse("2026-11-13T00:00:00Z") })
  const admitted = await ui.admit(new Request("https://example.test"), "sf_bi_view", digestSfValue(request))
  if (admitted.status !== "ok") throw new Error(admitted.reason)
  const choice: { producer: "dashboard" | "planner" } = { producer: "dashboard" }
  const unavailable = async () => ({ status: "unavailable" as const, reason: "fixture-selection" })
  const factory = createSfBiFactory({ authority, select: async () => ({ status: "ok", value: choice.producer }),
    dashboard: { views: ["BI01"], host: { dashboard: { read: unavailable }, resolve: unavailable, revalidate: async () => true } },
    planner: { views: ["BI01"], host: { planner: { compareForecast: unavailable, compareScenarios: unavailable, simulateScenario: unavailable, evaluateSensitivity: unavailable }, resolve: unavailable, revalidate: async () => true } },
  })
  expect(await factory.source.revalidate(request, admitted.value)).toBe(true)
  choice.producer = "planner"
  expect(await factory.source.read(request, admitted.value)).toEqual({ status: "stale", reason: "producer-selection-changed" })
  expect(await factory.source.revalidate(request, admitted.value)).toBe(false)
  const next = await ui.admit(new Request("https://example.test"), "sf_bi_view", digestSfValue(request))
  if (next.status !== "ok") throw new Error(next.reason)
  expect(await factory.source.revalidate(request, next.value)).toBe(true)
})
