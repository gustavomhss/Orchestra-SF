import { expect, type Page } from "@playwright/test"
import { waveFourDecisionsData } from "./wave-four-decisions-data"
import { array, controls, object, sourceText, type AnalyticsOwner } from "./wave-five-analytics"

export const parameterizedTitle = "Design test data · Regional monthly amount hypothesis"

/**
 * The canonical four-decisions fixture contains source-only alternatives.
 * Add one explicit monthly hypothesis through the installed decision producer.
 * All identities, the amount, units, period and pending-coverage receipt below
 * come from a fresh authorized Planner projection; no result is manufactured.
 */
export async function prepareParameterizedScenario(page: Page, owner: AnalyticsOwner, reference: string) {
  const before = object((await controls(page, owner, reference)).selected)
  const decision = object(before.decision)
  const alternatives = array(decision.alternatives).map(object)
  const candidate = alternatives.find((entry) => entry.title === waveFourDecisionsData.plannerCandidate)
  const baseline = alternatives.find((entry) => entry.title === waveFourDecisionsData.plannerBaseline)
  expect(candidate).toBeDefined()
  expect(baseline).toBeDefined()
  const originalScenario = object(candidate!.scenario)
  expect(array(originalScenario.operations)).toHaveLength(0)
  const forecasts = array(before.forecasts).map(object)
  const selectedSource = forecasts.map((entry) => object(entry.source))
    .find((entry) => entry.refId === originalScenario.baseRef)
  expect(selectedSource).toBeDefined()

  const response = await page.request.get(owner.publicOrigin + owner.mount + "/dashboard", {
    params: { sf: "decision-controls", format: "json", case: reference, source: sourceText(selectedSource!.refDigest) },
  })
  const body = object(await response.json())
  console.info("SF_ANALYTICS_SOURCE " + JSON.stringify({ operation: "parameter-source-read", http: response.status(), status: body.status, reason: body.reason }))
  expect(response.status()).toBe(200)
  expect(body.status).toBe("ok")
  const source = object(object(body.value).selected)
  const forecast = object(source.forecast)
  const projection = object(forecast.projection)
  const values = array(projection.values).map(object)
  const amountValues = values.filter((entry) => typeof entry.id === "string" && entry.id.endsWith(":forecast") &&
    !entry.id.startsWith("HR:") && entry.granularity === "month" && entry.evidenceState === "confirmed" &&
    typeof entry.value === "number" && Number.isFinite(entry.value) &&
    sourceText(object(entry.period).start).endsWith("-02-01"))
  expect(amountValues).toHaveLength(1)
  const amount = amountValues[0]!
  const targetRef = sourceText(amount.id).slice(0, -":forecast".length)
  const components = array(projection.components).map(object).filter((entry) => entry.id === targetRef)
  expect(components).toHaveLength(1)
  expect(components[0]!.amount).toBe(amount.value)
  expect(components[0]!.evidenceState).toBe("confirmed")
  const currencies = values.filter((entry) => entry.id === targetRef + ":currency-declared")
  expect(currencies).toHaveLength(1)
  expect(currencies[0]!.evidenceState).toBe("confirmed")
  expect(currencies[0]!.value).toBe(amount.currency)
  expect(array(amount.sourceRefs).map(object).some((entry) => entry.refDigest === selectedSource!.refDigest)).toBe(true)
  const coverage = object(forecast.coverage)
  const operation = { kind: "replace", targetRef, amount: amount.value,
    currency: sourceText(amount.currency), period: object(amount.period) }
  const promoted = await page.request.post(owner.publicOrigin + owner.mount + "/dashboard?sf=decision-promote", {
    headers: { origin: owner.publicOrigin, "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
    data: { caseRef: object(source.caseRef), coverageRef: sourceText(coverage.coverageRef),
      title: parameterizedTitle, scenario: { baseRef: sourceText(selectedSource!.refId), operations: [operation], assumptions: [] } },
  })
  const promotion = object(await promoted.json())
  console.info("SF_ANALYTICS_SOURCE " + JSON.stringify({ operation: "decision-promote-parameter", http: promoted.status(),
    status: promotion.status, reason: promotion.reason, parameterPeriod: operation.period, parameterUnit: operation.currency }))
  expect(promoted.status()).toBe(200)
  expect(promotion.status).toBe("ok")
  const receipt = object(promotion.value)
  const selected = object((await controls(page, owner, reference)).selected)
  expect(selected.caseRef).toEqual(receipt.caseRef)
  const accepted = array(object(selected.decision).alternatives).map(object).filter((entry) => entry.title === parameterizedTitle)
  expect(accepted).toHaveLength(1)
  const published = array(selected.scenarios).map(object).filter((entry) => entry.alternativeId === accepted[0]!.id)
  expect(published).toHaveLength(1)
  expect(published[0]!.ref).toBe(sourceText(receipt.resultRef))
  expect(array(published[0]!.parameters).map(object)).toEqual([expect.objectContaining({ ref: targetRef })])
  return { selected, scenarioRef: sourceText(published[0]!.ref), alternativeId: sourceText(accepted[0]!.id),
    baselineAlternativeId: sourceText(baseline!.id), parameterRef: targetRef, parameterValue: amount.value as number }
}
