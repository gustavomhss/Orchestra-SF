import { expect, test } from "bun:test"
import { presentPortfolio } from "../../../product/analytics/portfolio-view.ts"
import type { PortfolioResult } from "../../../product/contracts/decisions.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { SfDomainValidation } from "../../../product/contracts/runtime.ts"
import type { TrustedDomainContext, TrustedUiLease } from "../../../product/contracts/sf-execution.ts"

const period = { start: "2027-01-01", end: "2027-12-31" }
const result: PortfolioResult = { limitations: ["exploration is bounded"], evidenceRefs: [], combinations: [{ id: "combination", caseRefs: ["case"], eligibility: "conditioned", comparisonStatus: "conditioned", costCoverageRefs: ["coverage"], conflicts: [], restrictions: ["training unknown"], components: [{ id: "known", amount: 0, currency: "USD", period, sourceRefs: [], evidenceState: "confirmed" }, { id: "missing", amount: null, currency: "USD", period, sourceRefs: [], evidenceState: "absent" }, { id: "invalid", amount: Infinity, currency: "USD", period, sourceRefs: [], evidenceState: "absent" }, { id: "placeholder", amount: 0, currency: "USD", period, sourceRefs: [], evidenceState: "absent" }] }] }

test("portfolio presentation keeps conditional coverage and unknown values without calculating totals", () => {
  const view = presentPortfolio(result)
  expect(view.combinations[0]?.eligibility).toBe("conditioned")
  expect(view.combinations[0]?.costCoverageRefs).toEqual(["coverage"])
  expect(view.combinations[0]?.components.map((component) => component.amount)).toEqual([0, null, null, null])
  expect(view.limitations).toEqual(["exploration is bounded"])
})

test("portfolio bundle is withheld when authorization changes after the domain read", async () => {
  const { readPortfolioBi } = await import("../../../product/analytics/portfolio.ts")
  const period = { start: "2027-01-01", end: "2027-12-31" }
  const context = { kind: "ui" as const, lease: {} as TrustedUiLease, binding: { installationId: "i", projectId: "p", principalRef: "u", requestId: "r", policyVersion: "v", accessRevision: "a", expiresAt: "2030-01-01T00:00:00Z" } }
  const authority: SfDomainValidation = { validateDomainContext: async () => true, revalidateDomainContext: async () => true, receiptFor: (_context, operation, inputDigest, resultDigest) => ({ kind: "ui", operation, handlerExport: "readBiView", inputDigest, resultDigest, principalRef: "u", callId: "r", requestId: "r", accessRevision: "a", at: "2027-01-01T00:00:00Z" }) }
  const projection: DomainProjection = { context: { installationId: "i", projectId: "p", principalRef: "u", policyVersion: "v", accessRevision: "a", surface: "planner", period, currency: "USD", sourceRefs: [], capabilities: [] }, version: 1, engineVersion: "v", values: [], components: [], missing: [] }
  let reads = 0
  const outcome = await readPortfolioBi({ viewId: "BI09", selectionRef: "selection", period }, context, { readView: async () => ({ status: "ok", value: { projection, presentation: { viewId: "BI09", series: [], limitations: [] }, portfolio: result } }), revalidate: async () => ++reads === 1 }, authority)
  expect(outcome).toEqual({ status: "denied", reason: "access-changed" })
})

test("portfolio binding rejects a different horizon before evaluation", async () => {
  const { bindPortfolioBiPort } = await import("../../../product/analytics/portfolio.ts")
  const period = { start: "2027-01-01", end: "2027-12-31" }
  const context = { kind: "ui" as const, lease: {} as TrustedUiLease, binding: { installationId: "i", projectId: "p", principalRef: "u", requestId: "r", policyVersion: "v", accessRevision: "a", expiresAt: "2030-01-01T00:00:00Z" } }
  let calls = 0
  const host = bindPortfolioBiPort({ portfolio: { evaluate: async () => { calls++; return { status: "ok", value: result } } }, resolve: async () => ({ status: "ok", value: { request: { scope: { horizon: { start: "2026-01-01", end: "2026-12-31" }, currency: "USD" }, candidateRefs: [], operations: [], constraints: [], priorities: [], explorationLimit: 1 }, project: () => { throw new Error("must not project") } } }), revalidate: async () => true })
  expect(await host.readView({ viewId: "BI09", selectionRef: "selection", period }, context)).toEqual({ status: "stale", reason: "period-mismatch" })
  expect(calls).toBe(0)
})

test("C16 portfolio source rejects metadata after its projection changes", async () => {
  const { createPortfolioBiSource } = await import("../../../product/analytics/portfolio.ts")
  const period = { start: "2027-01-01", end: "2027-12-31" }
  const context = { kind: "ui" as const, lease: {} as TrustedUiLease, binding: { installationId: "i", projectId: "p", principalRef: "u", requestId: "r", policyVersion: "v", accessRevision: "a", expiresAt: "2030-01-01T00:00:00Z" } }
  let projection: DomainProjection = { context: { installationId: "i", projectId: "p", principalRef: "u", policyVersion: "v", accessRevision: "a", surface: "planner", period, currency: "USD", sourceRefs: [], capabilities: [] }, version: 1, engineVersion: "v", values: [], components: [], missing: [] }
  const source = createPortfolioBiSource({ readView: async () => ({ status: "ok", value: { projection, presentation: { viewId: "BI09", series: [], limitations: [] }, portfolio: result } }), revalidate: async () => true })
  const request = { viewId: "BI09", selectionRef: "selection", period }
  const first = await source.read(request, context)
  expect(first.status).toBe("ok")
  if (first.status !== "ok") return
  projection = { ...projection, version: 2 }
  expect(await source.describe(request, context, first.value)).toEqual({ status: "stale", reason: "projection-changed" })
})

test("concurrent portfolio reads keep each request-local bundle isolated", async () => {
  const { readPortfolioBi } = await import("../../../product/analytics/portfolio.ts")
  const period = { start: "2027-01-01", end: "2027-12-31" }
  const context = (principalRef: string) => ({ kind: "ui" as const, lease: {} as TrustedUiLease, binding: { installationId: "i", projectId: "p", principalRef, requestId: `r-${principalRef}`, policyVersion: "v", accessRevision: "a", expiresAt: "2030-01-01T00:00:00Z" } })
  const authority: SfDomainValidation = { validateDomainContext: async () => true, revalidateDomainContext: async () => true, receiptFor: (input, operation, inputDigest, resultDigest) => input.kind === "ui" ? { kind: "ui", operation, handlerExport: "readBiView", inputDigest, resultDigest, principalRef: input.binding.principalRef, callId: input.binding.requestId, requestId: input.binding.requestId, accessRevision: input.binding.accessRevision, at: "2027-01-01T00:00:00Z" } : undefined }
  const host = { readView: async (_request: unknown, input: TrustedDomainContext) => {
    const projection: DomainProjection = { context: { installationId: "i", projectId: "p", principalRef: input.binding.principalRef, policyVersion: "v", accessRevision: "a", surface: "planner", period, currency: "USD", sourceRefs: [], capabilities: [] }, version: 1, engineVersion: "v", values: [], components: [], missing: [] }
    return { status: "ok" as const, value: { projection, presentation: { viewId: "BI09" as const, series: [], limitations: [] }, portfolio: { ...result, combinations: result.combinations.map((item) => ({ ...item, id: input.binding.principalRef })) } } }
  }, revalidate: async () => true }
  const first = context("first")
  const second = context("second")
  const request = { viewId: "BI09", selectionRef: "selection", period }
  const outcomes = await Promise.all([readPortfolioBi(request, first, host, authority), readPortfolioBi(request, second, host, authority)])
  expect(outcomes.map((outcome) => outcome.status === "ok" ? outcome.value.portfolio.combinations[0]?.id : outcome.status)).toEqual(["first", "second"])
})

test("portfolio source passes the expected projection to host revalidation", async () => {
  const { createPortfolioBiSource } = await import("../../../product/analytics/portfolio.ts")
  const period = { start: "2027-01-01", end: "2027-12-31" }
  const context = { kind: "ui" as const, lease: {} as TrustedUiLease, binding: { installationId: "i", projectId: "p", principalRef: "u", requestId: "r", policyVersion: "v", accessRevision: "a", expiresAt: "2030-01-01T00:00:00Z" } }
  const projection: DomainProjection = { context: { installationId: "i", projectId: "p", principalRef: "u", policyVersion: "v", accessRevision: "a", surface: "planner", period, currency: "USD", sourceRefs: [], capabilities: [] }, version: 1, engineVersion: "v", values: [], components: [], missing: [] }
  let seen: DomainProjection | undefined
  const source = createPortfolioBiSource({ readView: async () => ({ status: "ok", value: { projection, presentation: { viewId: "BI09", series: [], limitations: [] }, portfolio: result } }), revalidate: async (_request, _context, _bundle, expected) => { seen = expected; return true } })
  await source.revalidate({ viewId: "BI09", selectionRef: "selection", period }, context, projection)
  expect(seen).toBe(projection)
})

test("an eligible-complete claim with absent components is not displayed as complete", () => {
  const invalid: PortfolioResult = { ...result, combinations: [{ ...result.combinations[0]!, eligibility: "eligible-complete", comparisonStatus: "complete" }] }
  const combination = presentPortfolio(invalid).combinations[0]
  expect(combination?.eligibility).toBe("unavailable")
  expect(combination?.comparisonStatus).toBe("unavailable")
})

test("eligible portfolio without coverage references is not displayed as complete", () => {
  const invalid: PortfolioResult = { ...result, combinations: [{ ...result.combinations[0]!, eligibility: "eligible-complete", comparisonStatus: "complete", costCoverageRefs: [], components: [] }] }
  expect(presentPortfolio(invalid).combinations[0]?.eligibility).toBe("unavailable")
})
