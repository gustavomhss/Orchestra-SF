import { expect, type Page } from "@playwright/test"
import { waveFourDecisionsData } from "./wave-four-decisions-data"
import { array, controls, object, readPortfolio, sourceText, type AnalyticsOwner } from "./wave-five-analytics"

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
  const currentDecision = object(selected.decision)
  const portfolioCriteria = array(currentDecision.criteria).map((entry) => sourceText(object(entry).id))
  expect(portfolioCriteria.length).toBeGreaterThan(0)
  // The existing seed deliberately registers only its comparison rule. Bind
  // sensitivity explicitly before any portfolio proof is created, using the
  // original authorized units reader and the original human registry action.
  expect(portfolioCriteria).toHaveLength(1)
  const criterionId = portfolioCriteria[0]!
  const baselines = array(selected.scenarios).map(object).filter((entry) => entry.alternativeId === baseline!.id)
  expect(baselines).toHaveLength(1)
  const unitSelection = { scenarioRef: sourceText(published[0]!.ref),
    baselineRef: sourceText(baselines[0]!.ref), parameterRef: targetRef }
  const readUnits = async () => {
    const issued = await page.request.get(owner.publicOrigin + owner.mount + "/dashboard", {
      params: { sf: "decision-controls", format: "json", case: reference,
        scenario: unitSelection.scenarioRef, baseline: unitSelection.baselineRef, parameter: unitSelection.parameterRef },
    })
    const result = object(await issued.json())
    console.info("SF_ANALYTICS_SOURCE " + JSON.stringify({ operation: "sensitivity-controls-units-read",
      http: issued.status(), status: result.status, reason: result.reason }))
    expect(issued.status()).toBe(200)
    expect(result.status).toBe("ok")
    const value = object(object(result.value).selected)
    expect(value.ref).toBe(reference)
    expect(value.caseRef).toEqual(selected.caseRef)
    expect(value.unitSelection).toEqual(unitSelection)
    expect(value.decision).toEqual(currentDecision)
    return value
  }
  const issuedSelection = await readUnits()
  const units = object(issuedSelection.units)
  expect(Object.keys(units).sort()).toEqual([
    "baselineRef", "engineVersion", "parameterRef", "parameterUnit", "resultUnit", "sourceRefs",
  ])
  expect(units.baselineRef).toBe(unitSelection.baselineRef)
  expect(units.parameterRef).toBe(targetRef)
  expect(units.parameterUnit).toBe(operation.currency)
  expect(units.resultUnit).toBe(currentDecision.currency)
  expect(sourceText(units.engineVersion).length).toBeGreaterThan(0)
  const unitSources = array(units.sourceRefs).map(object)
  expect(unitSources.length).toBeGreaterThan(0)
  for (const evidence of unitSources) {
    expect(evidence.installationId).toBe(owner.installationId)
    expect(evidence.projectId).toBe(owner.projectId)
    expect(sourceText(evidence.refId).length).toBeGreaterThan(0)
    expect(sourceText(evidence.refDigest)).toMatch(/^[a-f0-9]{64}$/)
  }
  const originalRules = array(issuedSelection.rules).map(object).filter((rule) => rule.id === criterionId)
  expect(originalRules).toHaveLength(1)
  expect(Number.isSafeInteger(originalRules[0]!.expectedVersion)).toBe(true)
  const expectedRuleVersion = originalRules[0]!.expectedVersion as number
  expect(expectedRuleVersion).toBeGreaterThan(0)
  const ruleInput = { caseRef: object(selected.caseRef), criterionId,
    metricRef: "planner:known-subtotal-difference", operator: "lte" as const, value: 2000,
    unit: sourceText(currentDecision.currency), period: object(currentDecision.horizon),
    evidenceRefs: array(currentDecision.sourceRefs), expectedRuleVersion, sensitivity: units }
  const ruleReceipt = object(await readPortfolio(page, owner, "decision-criteria", ruleInput))
  expect(Object.keys(ruleReceipt).sort()).toEqual(["ruleRef", "version"])
  expect(sourceText(ruleReceipt.ruleRef)).toMatch(/^criterion-rule:/)
  expect(ruleReceipt.version).toBe(expectedRuleVersion + 1)
  const confirmedUnits = await readUnits()
  expect(confirmedUnits.units).toEqual(units)
  expect(array(confirmedUnits.rules).map(object).filter((rule) => rule.id === criterionId))
    .toEqual([{ id: criterionId, expectedVersion: ruleReceipt.version }])
  // register() itself performs the original complete rule resolve. The HTTP
  // catalog publishes its receipt and controls publishes its current version;
  // it does not expose the complete stored rule as a separate read endpoint.
  console.info("SF_ANALYTICS_SOURCE " + JSON.stringify({
    operation: "sensitivity-rule-fixture-registered-readback", status: "ok",
    caseVersion: object(selected.caseRef).version, criterionId, ruleRef: ruleReceipt.ruleRef,
    previousVersion: expectedRuleVersion, ruleVersion: ruleReceipt.version,
    baselineRef: units.baselineRef, scenarioRef: unitSelection.scenarioRef, parameterRef: units.parameterRef,
    parameterUnit: units.parameterUnit, resultUnit: units.resultUnit, engineVersion: units.engineVersion,
    sourceReferences: unitSources.map((evidence) => ({ refId: evidence.refId, refDigest: evidence.refDigest })),
    originalCaseUnchanged: true, originalUnitsReadbackMatched: true,
    acquisition: "original-register-canonical-resolve-then-controls-units-and-version",
  }))
  const sensitivityRule = { criterionId, operator: ruleInput.operator, value: ruleInput.value,
    ruleRef: sourceText(ruleReceipt.ruleRef), version: ruleReceipt.version as number, units }
  const selectionInput = { caseRef: object(selected.caseRef),
    baselineAlternativeId: sourceText(baseline!.id), alternativeId: sourceText(candidate!.id),
    criteria: portfolioCriteria }
  const comparisonBefore = object(await readPortfolio(page, owner, "decision-compare", selectionInput))
  const scenarioRefs = array(object(comparisonBefore.request).scenarioRefs).map(sourceText)
  const currentScenarios = array(selected.scenarios).map(object)
  expect(scenarioRefs).toEqual([
    sourceText(currentScenarios.find((entry) => entry.alternativeId === baseline!.id)?.ref),
    sourceText(currentScenarios.find((entry) => entry.alternativeId === candidate!.id)?.ref),
  ])
  expect(object(comparisonBefore.comparison).comparisonStatus).toBe("conditioned")
  expect(object(comparisonBefore.comparison).completeDifference).toBeNull()
  // This new isolated fixture has never called decision-select-portfolio. The
  // original CAS alone decides whether version zero is still valid. There is
  // no retry, version reset or replacement of an existing human selection.
  // The legacy UI names decision-portfolio-selection, but this installed HTTP
  // composition exposes no handler for that read. register() itself returns
  // its canonical read() after checking the persisted selection.
  console.info("SF_ANALYTICS_SOURCE " + JSON.stringify({ operation: "portfolio-selection-fixture-basis",
    initialVersion: 0, basis: "new-isolated-fixture-with-no-prior-registration",
    caseVersion: object(selected.caseRef).version, criteriaCount: portfolioCriteria.length }))
  const registered = object(await readPortfolio(page, owner, "decision-select-portfolio", {
    ...selectionInput, expectedVersion: 0,
  }))
  expect(registered).toEqual(expect.objectContaining({ schema: "sf-portfolio-selection-v1",
    ...selectionInput, version: 1, baselineRef: scenarioRefs[0], alternativeRef: scenarioRefs[1] }))
  expect(sourceText(registered.selectionRef)).toMatch(/^portfolio-selection:/)
  expect(sourceText(registered.selectionDigest)).toMatch(/^[a-f0-9]{64}$/)
  const readback = object((await controls(page, owner, reference)).selected)
  expect(readback.caseRef).toEqual(selected.caseRef)
  expect(object(readback.decision).alternatives).toEqual(currentDecision.alternatives)
  expect(object(readback.decision).choices).toEqual(currentDecision.choices)
  const comparisonAfter = object(await readPortfolio(page, owner, "decision-compare", selectionInput))
  expect(comparisonAfter).toEqual(comparisonBefore)
  console.info("SF_ANALYTICS_SOURCE " + JSON.stringify({ operation: "portfolio-selection-registered-readback",
    status: "ok", selectionVersion: registered.version, caseVersion: object(registered.caseRef).version,
    originalAlternativePairMatched: true, originalCriteriaMatched: true, currentComparisonUnchanged: true,
    acquisition: "original-register-canonical-read-then-controls-and-comparison" }))
  return { selected: readback, scenarioRef: sourceText(published[0]!.ref), alternativeId: sourceText(accepted[0]!.id),
    baselineAlternativeId: sourceText(baseline!.id), parameterRef: targetRef, parameterValue: amount.value as number,
    portfolioCriteria, sensitivityRule }
}
