import { expect, test } from "bun:test"
import { prepareForecastReview } from "../../../product/routines/forecast.ts"
import type { ForecastCompareRequest } from "../../../product/contracts/operations.ts"
import type { FinancialAnalysis, PlannerPort } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"

const context = {} as TrustedDomainContext
const request = {} as ForecastCompareRequest
const projection = { values: [], components: [], missing: [] }
const canonical = { knownDifference: 12000, completeDifference: 12000, baseline: projection, candidate: projection, comparison: { comparisonStatus: "complete" }, gaps: [] } as unknown as FinancialAnalysis

test("forecast review preserves canonical comparison and scoped confirmation", async () => {
  const host = {
    planner: { compareForecast: async () => ({ status: "ok", value: canonical } as const) } as unknown as PlannerPort,
    confirmations: async () => ({ status: "ok", value: [{ state: "valid", confirmationId: "january", evaluatedSourceVersion: 8, evaluatedAt: "2026-01-01", reason: "unchanged-scope", scopeFingerprint: "same" }] } as const),
    revalidate: async () => true,
  }
  const result = await prepareForecastReview({ request, context, host })
  expect(result.status === "ok" && result.value).toMatchObject({ comparison: canonical, pendingConfirmationIds: [], complete: false, measured: { budgetMargin: { status: "unavailable" } } })
  const denied = await prepareForecastReview({ request, context, host: { ...host, revalidate: async () => false } })
  expect(denied).toEqual({ status: "denied", reason: "access-changed" })
  const restricted = await prepareForecastReview({ request, context, host: { ...host, planner: { compareForecast: async () => ({ status: "ok", value: { ...canonical, baseline: { ...projection, missing: [{ field: "private", reason: "restricted" }] } } } as unknown as Awaited<ReturnType<PlannerPort["compareForecast"]>>) } as PlannerPort } })
  expect(restricted).toEqual({ status: "unavailable", reason: "review-source-unavailable" })
})

test("forecast facets are withheld if their producer evidence loses access", async () => {
  const result = await prepareForecastReview({ request, context, host: {
    planner: { compareForecast: async () => ({ status: "ok", value: canonical }) } as unknown as PlannerPort,
    confirmations: async () => ({ status: "ok", value: [] }),
    facts: async () => ({ status: "ok", value: { budgetMargin: { value: 3, currency: "USD", evidenceRefs: [{} as BusinessEvidenceRef] }, absentActual: [], inheritedBudget: [], responsibles: [] } }),
    revalidateFacts: async () => false,
    revalidate: async () => true,
  } })
  expect(result).toEqual({ status: "denied", reason: "access-changed" })
})
