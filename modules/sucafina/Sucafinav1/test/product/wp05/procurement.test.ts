import { expect, test } from "bun:test"
import { createProcurementBiSource } from "../../../product/analytics/procurement.ts"
import { createBiSourceRouter, readBiPresentation } from "../../../product/analytics/capabilities.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { SfDomainValidation } from "../../../product/contracts/runtime.ts"
import type { TrustedUiContext, TrustedUiLease } from "../../../product/contracts/sf-execution.ts"

const period = { start: "2027-01-01", end: "2027-12-31" }
const authority: SfDomainValidation = { validateDomainContext: async () => true, revalidateDomainContext: async () => true, receiptFor: (_context, operation, inputDigest, resultDigest) => ({ kind: "ui", operation, handlerExport: "readBiView", inputDigest, resultDigest, principalRef: "u", callId: "r", requestId: "r", accessRevision: "a", at: "2027-01-01T00:00:00Z" }) }
const binding: TrustedUiContext = { kind: "ui", lease: {} as TrustedUiLease, binding: { installationId: "i", projectId: "p", principalRef: "u", requestId: "r", policyVersion: "v", accessRevision: "a", expiresAt: "2030-01-01T00:00:00Z" } }
const ref: BusinessEvidenceRef = { schema: "sf-evidence-v1", refId: "ref", installationId: "i", projectId: "p", refDigest: "digest", evidenceLevel: "observed", kind: "record", target: { surface: "procurement", recordType: "procurement-request", recordId: "42", incarnation: "inc1", version: 3, fields: ["ageDays"], period, projectionDigest: "digest" } }
const stock: DomainProjection = { context: { installationId: "i", projectId: "p", principalRef: "u", policyVersion: "v", accessRevision: "a", surface: "procurement", currency: "USD", period, sourceRefs: [], capabilities: [] }, version: 1, engineVersion: "procurement-v1", components: [], missing: [], values: [] }
const aging: DomainProjection = { ...stock, version: 3, values: [{ id: "ageDays", value: null, unit: "days", period, granularity: "record", sourceRefs: [ref], drilldown: ref, evidenceState: "absent" }], missing: [{ field: "ageDays", reason: "unavailable" }] }

test("aging uses producer values and preserves an unknown age and request reference", async () => {
  const source = createProcurementBiSource({ list: async () => ({ status: "ok", value: { stock, aging: [aging] } }), revalidate: async () => true })
  const result = await readBiPresentation({ viewId: "BI06", selectionRef: "selection", period }, binding, createBiSourceRouter({ BI06: source }), authority)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") return
  expect(result.value.projection.values[0]?.value).toBeNull()
  expect(result.value.projection.values[0]?.drilldown).toEqual(ref)
  expect(result.value.projection.missing[0]?.reason).toBe("unavailable")
  expect(result.value.presentation.series[0]?.valueIds).toEqual(["42:inc1:ageDays"])
})

test("unknown request status is not asserted to be open", async () => {
  const source = createProcurementBiSource({ list: async () => ({ status: "ok", value: { stock, aging: [] } }), revalidate: async () => true })
  const unknown: DomainProjection = { ...stock, values: [{ id: "stock:unknown", value: 1, unit: "requests", period, granularity: "aggregate", sourceRefs: [ref], drilldown: ref, evidenceState: "confirmed" }] }
  const result = await source.describe({ viewId: "BI05", selectionRef: "selection", period }, binding, unknown)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") return
  expect(result.value.limitations.join(" ")).toContain("não são confirmados como abertos")
})
