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

const supplier: BusinessEvidenceRef = { schema: "sf-evidence-v1", refId: "supplier", installationId: "i", projectId: "p", refDigest: "digest", evidenceLevel: "observed", kind: "record", target: { surface: "procurement", recordType: "procurement-supplier", recordId: "S-1", incarnation: "sup", version: 2, fields: ["legalName"], period, projectionDigest: "digest" } }
const sameRequest: BusinessEvidenceRef = { schema: "sf-evidence-v1", refId: "same", installationId: "i", projectId: "p", refDigest: "digest", evidenceLevel: "observed", kind: "record", target: { surface: "procurement", recordType: "procurement-request", recordId: "42", incarnation: "inc1", version: 3, fields: ["status"], period, projectionDigest: "digest" } }
const otherVersion: BusinessEvidenceRef = { schema: "sf-evidence-v1", refId: "version", installationId: "i", projectId: "p", refDigest: "digest", evidenceLevel: "observed", kind: "record", target: { surface: "procurement", recordType: "procurement-request", recordId: "42", incarnation: "inc1", version: 4, fields: ["ageDays"], period, projectionDigest: "digest" } }
const otherIdentity: BusinessEvidenceRef = { schema: "sf-evidence-v1", refId: "identity", installationId: "i", projectId: "p", refDigest: "digest", evidenceLevel: "observed", kind: "record", target: { surface: "procurement", recordType: "procurement-request", recordId: "99", incarnation: "inc1", version: 3, fields: ["ageDays"], period, projectionDigest: "digest" } }
const otherIncarnation: BusinessEvidenceRef = { schema: "sf-evidence-v1", refId: "incarnation", installationId: "i", projectId: "p", refDigest: "digest", evidenceLevel: "observed", kind: "record", target: { surface: "procurement", recordType: "procurement-request", recordId: "42", incarnation: "inc2", version: 3, fields: ["ageDays"], period, projectionDigest: "digest" } }

test("an aging row is refused when procurement-request evidence disagrees on version or record identity", async () => {
  const byVersion: DomainProjection = { ...aging, values: [{ id: "ageDays", value: 12, unit: "days", period, granularity: "record", sourceRefs: [ref, otherVersion], drilldown: ref, evidenceState: "confirmed" }] }
  const byIdentity: DomainProjection = { ...aging, values: [{ id: "ageDays", value: 12, unit: "days", period, granularity: "record", sourceRefs: [ref, otherIdentity], drilldown: ref, evidenceState: "confirmed" }] }
  const versionSource = createProcurementBiSource({ list: async () => ({ status: "ok", value: { stock, aging: [byVersion] } }), revalidate: async () => true })
  const identitySource = createProcurementBiSource({ list: async () => ({ status: "ok", value: { stock, aging: [byIdentity] } }), revalidate: async () => true })
  expect(await versionSource.read({ viewId: "BI06", selectionRef: "selection", period }, binding)).toEqual({ status: "unavailable", reason: "inconsistent-request-reference" })
  expect(await identitySource.read({ viewId: "BI06", selectionRef: "selection", period }, binding)).toEqual({ status: "unavailable", reason: "inconsistent-request-reference" })
})

test("an aging row is refused when its request drilldown names another incarnation", async () => {
  const row: DomainProjection = { ...aging, values: [{ id: "ageDays", value: 12, unit: "days", period, granularity: "record", sourceRefs: [ref], drilldown: otherIncarnation, evidenceState: "confirmed" }] }
  const source = createProcurementBiSource({ list: async () => ({ status: "ok", value: { stock, aging: [row] } }), revalidate: async () => true })
  expect(await source.read({ viewId: "BI06", selectionRef: "selection", period }, binding)).toEqual({ status: "unavailable", reason: "inconsistent-request-reference" })
})

test("an aging row keeps every producer value when other evidence accompanies one request", async () => {
  const row: DomainProjection = { ...aging, values: [{ id: "ageDays", value: 12, unit: "days", period, granularity: "record", sourceRefs: [ref, sameRequest, supplier], drilldown: ref, evidenceState: "confirmed" }, { id: "status", value: "pr_pending", period, granularity: "record", sourceRefs: [ref, supplier], drilldown: sameRequest, evidenceState: "confirmed" }], missing: [{ field: "holder", reason: "missing" }] }
  const source = createProcurementBiSource({ list: async () => ({ status: "ok", value: { stock, aging: [row] } }), revalidate: async () => true })
  const result = await source.read({ viewId: "BI06", selectionRef: "selection", period }, binding)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") return
  expect(result.value.values.map((value) => [value.id, value.value, value.evidenceState])).toEqual([["42:inc1:ageDays", 12, "confirmed"], ["42:inc1:status", "pr_pending", "confirmed"]])
  expect(result.value.values[0]?.sourceRefs).toEqual([ref, sameRequest, supplier])
  expect(result.value.values[1]?.sourceRefs).toEqual([ref, supplier])
  expect(result.value.values[0]?.drilldown).toEqual(ref)
  expect(result.value.values[1]?.drilldown).toEqual(sameRequest)
  expect(result.value.missing).toEqual([{ field: "42:inc1:holder", reason: "missing" }])
})

test("stock snapshot preserves producer stage counts without inventing a conversion", async () => {
  const stage = (status: string): BusinessEvidenceRef => ({ schema: "sf-evidence-v1", refId: `stage-${status}`, installationId: "i", projectId: "p", refDigest: "digest", evidenceLevel: "observed", kind: "record", target: { surface: "procurement", recordType: "procurement-request-selection", recordId: "all", incarnation: "inc", version: 1, fields: ["status"], period, projectionDigest: "digest" } })
  const current: DomainProjection = { ...stock, values: [["pr_pending", 7], ["src_pending", 2], ["po_pending", 3]].map(([status, value]) => ({ id: `stock:${status}`, value, unit: "requests", period, granularity: "aggregate" as const, sourceRefs: [ref], drilldown: stage(String(status)), evidenceState: "confirmed" as const })) }
  const source = createProcurementBiSource({ list: async () => ({ status: "ok", value: { stock: current, aging: [] } }), revalidate: async () => true })
  const result = await readBiPresentation({ viewId: "BI05", selectionRef: "selection", period }, binding, source, authority)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") return
  expect(result.value.projection.values.map((value) => value.value)).toEqual([7, 2, 3])
  expect(result.value.projection.values.map((value) => value.drilldown?.refId)).toEqual(["stage-pr_pending", "stage-src_pending", "stage-po_pending"])
  expect(result.value.presentation.limitations.join(" ")).toContain("não representa coorte ou conversão")
  expect(result.value.projection.values.some((value) => /conversion|cohort|rate/.test(value.id))).toBe(false)
})
