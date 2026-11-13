import { expect, test } from "bun:test"
import { readBiView } from "../../../product/analytics/capabilities.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { SfDomainValidation } from "../../../product/contracts/runtime.ts"
import type { TrustedUiContext, TrustedUiLease } from "../../../product/contracts/sf-execution.ts"

const binding: TrustedUiContext = { kind: "ui", lease: {} as TrustedUiLease, binding: { installationId: "installation", projectId: "project", principalRef: "user", requestId: "request", policyVersion: "v1", accessRevision: "r1", expiresAt: "2030-01-01T00:00:00Z" } }
const projection: DomainProjection = { context: { installationId: "installation", projectId: "project", principalRef: "user", policyVersion: "v1", accessRevision: "r1", surface: "dashboard", period: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD", sourceRefs: [], capabilities: [] }, version: 1, engineVersion: "v1", components: [], values: [], missing: [] }
const request = { viewId: "BI01", selectionRef: "selection", period: projection.context.period }
const authority: SfDomainValidation = { validateDomainContext: async () => true, revalidateDomainContext: async () => true, receiptFor: (_context, operation, inputDigest, resultDigest) => ({ kind: "ui", operation, handlerExport: "readBiView", inputDigest, resultDigest, principalRef: "user", callId: "request", requestId: "request", accessRevision: "r1", at: "2027-01-01T00:00:00Z" }) }

test("read requires current authorization before and after reading", async () => {
  let checks = 0
  const result = await readBiView(request, binding, { read: async () => ({ status: "ok", value: projection }), revalidate: async () => ++checks === 1 }, authority)
  expect(result).toEqual({ status: "denied", reason: "access-changed" })
})

test("read rejects a projection from a different principal or period", async () => {
  const source = { read: async () => ({ status: "ok" as const, value: { ...projection, context: { ...projection.context, principalRef: "other" } } }), revalidate: async () => true }
  expect(await readBiView(request, binding, source, authority)).toEqual({ status: "denied", reason: "context-mismatch" })
  expect(await readBiView({ ...request, period: { start: "2027-02-01", end: "2027-12-31" } }, binding, { ...source, read: async () => ({ status: "ok" as const, value: projection }) }, authority)).toEqual({ status: "stale", reason: "period-mismatch" })
})

test("presentation rejects references absent from the authorized projection", async () => {
  const { readBiPresentation } = await import("../../../product/analytics/capabilities.ts")
  const result = await readBiPresentation(request, binding, {
    read: async () => ({ status: "ok", value: projection }),
    revalidate: async () => true,
    describe: async () => ({ status: "ok", value: { viewId: "BI01", series: [{ id: "private", label: "Private", unit: "USD", role: "budget", valueIds: ["not-authorized"] }], limitations: [] } }),
  }, authority)
  expect(result).toEqual({ status: "unavailable", reason: "unknown-series-value" })
})

test("descriptor refuses an unconsumed direct call before reading the domain", async () => {
  const { createBiDescriptor } = await import("../../../product/analytics/capabilities.ts")
  let reads = 0
  const descriptor = createBiDescriptor({ read: async () => { reads++; return { status: "ok", value: projection } }, revalidate: async () => true }, { validateDomainContext: async () => true, revalidateDomainContext: async () => true, receiptFor: () => undefined })
  const result = await descriptor.handler(request, binding)
  expect(result.status).toBe("denied")
  expect(reads).toBe(0)
})

test("an unregistered view is explicitly unavailable", async () => {
  const { createBiSourceRouter } = await import("../../../product/analytics/capabilities.ts")
  expect(await readBiView(request, binding, createBiSourceRouter({}), authority)).toEqual({ status: "unavailable", reason: "producer-unavailable" })
})

test("a receipt bound to another principal is denied before source access", async () => {
  let reads = 0
  const wrong: SfDomainValidation = { ...authority, receiptFor: (context, operation, inputDigest, resultDigest) => {
    const receipt = authority.receiptFor(context, operation, inputDigest, resultDigest)
    return receipt ? { ...receipt, principalRef: "other" } : undefined
  } }
  const result = await readBiView(request, binding, { read: async () => { reads++; return { status: "ok", value: projection } }, revalidate: async () => true }, wrong)
  expect(result).toEqual({ status: "denied", reason: "authority-unavailable" })
  expect(reads).toBe(0)
})

test("a receipt for another input is denied before source access", async () => {
  let reads = 0
  const wrong: SfDomainValidation = { ...authority, receiptFor: (context, operation, inputDigest, resultDigest) => {
    const receipt = authority.receiptFor(context, operation, inputDigest, resultDigest)
    return receipt ? { ...receipt, inputDigest: "other" } : undefined
  } }
  const result = await readBiView(request, binding, { read: async () => { reads++; return { status: "ok", value: projection } }, revalidate: async () => true }, wrong)
  expect(result).toEqual({ status: "denied", reason: "authority-unavailable" })
  expect(reads).toBe(0)
})

test("a receipt from another UI request cannot read the projection", async () => {
  let reads = 0
  const wrong: SfDomainValidation = { ...authority, receiptFor: (context, operation, inputDigest, resultDigest) => {
    const receipt = authority.receiptFor(context, operation, inputDigest, resultDigest)
    return receipt?.kind === "ui" ? { ...receipt, requestId: "another-request" } : receipt
  } }
  const result = await readBiView(request, binding, { read: async () => { reads++; return { status: "ok", value: projection } }, revalidate: async () => true }, wrong)
  expect(result).toEqual({ status: "denied", reason: "authority-unavailable" })
  expect(reads).toBe(0)
})

test("duplicate value identifiers are unavailable instead of targeting the wrong detail", async () => {
  const row: DomainProjection["values"][number] = { id: "duplicate", value: 1, period: projection.context.period, granularity: "year", sourceRefs: [], drilldown: null, evidenceState: "confirmed" }
  const source = { read: async () => ({ status: "ok" as const, value: { ...projection, values: [row, row] } }), revalidate: async () => true }
  expect(await readBiView(request, binding, source, authority)).toEqual({ status: "unavailable", reason: "duplicate-value-id" })
})

test("decision views require persisted decision metadata in the projection", async () => {
  const input = { ...request, viewId: "BI09" }
  const source = { read: async () => ({ status: "ok" as const, value: projection }), revalidate: async () => true }
  expect(await readBiView(input, binding, source, authority)).toEqual({ status: "unavailable", reason: "decision-unavailable" })
  const canonical: DomainProjection = { ...projection, decision: { kind: "portfolio", portfolioResultRef: "portfolio-ref", portfolio: { combinations: [], limitations: ["no combinations"], evidenceRefs: [] } } }
  expect(await readBiView(input, binding, { ...source, read: async () => ({ status: "ok", value: canonical }) }, authority)).toEqual({ status: "ok", value: canonical })
  expect(await readBiView(input, binding, { ...source, read: async () => ({ status: "ok", value: { ...canonical, decision: { kind: "portfolio", portfolioResultRef: " ", portfolio: { combinations: [], limitations: [], evidenceRefs: [] } } } }) }, authority)).toEqual({ status: "unavailable", reason: "decision-unavailable" })
})
