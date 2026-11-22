import { expect, type Locator, type Page, type Request, type TestInfo } from "@playwright/test"
import { encodeSfRouteRef } from "../../src/orchestra/chapters/sucafina/navigation-state"
import { waveFourDecisionsData } from "./design-support/wave-four-decisions-data"
import { prepareParameterizedScenario } from "./design-support/wave-five-analytics-source"
import { scheme } from "./design-support/wave-four"
import {
  analyticsTest, array, object, sourceText, controls, readPortfolio, isOperation,
  enter, ready, observePage, observeAnalyticsContext, observeAnalyticsOperations,
  captureAnalytics, captureModes, withPortuguese,
} from "./design-support/wave-five-analytics"

analyticsTest("wave five analytics diagnostic: partial first-preview observation", async ({ page, browser, installation, owner }, info) => {
  analyticsTest.setTimeout(780_000)
  page.setDefaultTimeout(20_000)
  expect(info.project.metadata.bundle).toBe("production")
  expect(info.config.workers).toBe(1)
  const diagnostics = observePage(page)
  const contextReads = observeAnalyticsContext(page, owner)
  observeAnalyticsOperations(page, owner)
  const writes: Request[] = []
  page.on("request", (request) => {
    if (isOperation(request, "decision-portfolio-evaluate") || isOperation(request, "decision-sensitivity-evaluate")) writes.push(request)
  })
  const listing = await controls(page, owner)
  const cases = array(listing.cases).map(object)
  const main = cases.find((item) => item.title === waveFourDecisionsData.objective)
  const empty = cases.find((item) => item.title === waveFourDecisionsData.editableObjective)
  expect(main).toBeDefined()
  expect(empty).toBeDefined()
  const prepared = await prepareParameterizedScenario(page, owner, sourceText(main!.ref))
  const source = prepared.selected
  const decision = object(source.decision)
  const caseRef = object(source.caseRef)
  expect(array(decision.alternatives)).toHaveLength(3)
  expect(array(decision.choices)).toHaveLength(1)
  expect(array(decision.alternatives).map(object).every((entry) =>
    object(entry.result).total === null && object(entry.result).comparisonStatus === "conditioned")).toBe(true)

  await enter(page, owner, installation.origin + "/orchestra/sf-portfolio/scenarios", "Portfolio scenarios", 40_000)
  const scenarios = page.locator('[data-sf-scenarios]')
  await expect(scenarios).toHaveAttribute("data-sf-wave", "five")
  await expect(scenarios.locator(".sf-u19-case-list > li")).toHaveCount(cases.length)
  await contextReads("UI42-list")
  await captureModes(page, info, "UI42-list")
  await scenarios.locator(".sf-u19-case-list > li").filter({ hasText: waveFourDecisionsData.editableObjective }).getByRole("button").click()
  await ready(page, "Portfolio scenarios", 40_000)
  await expect(scenarios.getByText("No eligible scenarios in the authorized case.", { exact: true })).toBeVisible()
  await contextReads("UI42-empty-case", true)
  await expect(page.getByRole("button", { name: "Preview combinations", exact: true })).toBeDisabled()
  await captureAnalytics(page, info, "UI42-empty-authorized-case-test-data")
  await scenarios.getByRole("button", { name: "Choose a case", exact: true }).click()
  await scenarios.locator(".sf-u19-case-list > li").filter({ hasText: waveFourDecisionsData.objective }).getByRole("button").click()
  await ready(page, "Portfolio scenarios", 40_000)
  const scenariosHref = page.url()
  await expect(scenarios.getByRole("heading", { name: waveFourDecisionsData.objective, exact: true })).toBeVisible()
  const candidate = scenarios.locator(".sf-u19-candidates").getByRole("checkbox", { name: waveFourDecisionsData.plannerCandidate + " · v1", exact: true })
  await expect(candidate).toBeVisible()
  await candidate.check()
  const constraintControls = prepared.portfolioCriteria.map((criterion) => {
    const rules = array(source.rules).map(object).filter((rule) => rule.id === criterion)
    expect(rules).toHaveLength(1)
    expect(Number.isSafeInteger(rules[0]!.expectedVersion)).toBe(true)
    return scenarios.getByRole("group", { name: "Constraints", exact: true })
      .getByRole("checkbox", { name: criterion + " · v" + rules[0]!.expectedVersion, exact: true })
  })
  for (const constraint of constraintControls) await constraint.check()
  const limit = scenarios.getByLabel("Exploration limit", { exact: true })
  await limit.fill("4")
  await limit.focus()
  await expect(limit).toHaveCSS("outline-style", "solid")
  await captureAnalytics(page, info, "UI42-configure-focused-candidate-test-data")
  const previewResponse = page.waitForResponse((response) => isOperation(response.request(), "decision-portfolio-preview"), { timeout: 60_000 })
  await page.getByRole("button", { name: "Preview combinations", exact: true }).click()
  const originalPreview = await previewResponse
  expect(originalPreview.status()).toBe(200)
  expect(object(object(originalPreview.request().postDataJSON()).request).constraints).toEqual(prepared.portfolioCriteria)
  await expect(scenarios).toHaveAttribute("data-sf-stage", "preview")
  await expect(scenarios.locator(".sf-u19-picker")).toBeHidden()
  await expect(scenarios.locator("[data-sf-eligibility]")).toHaveCount(1)
  await expect(scenarios.locator("[data-sf-eligibility]")).toHaveText("conditioned")
  await expect(scenarios.getByText("No total is inferred from partial coverage.", { exact: true })).toBeVisible()
  await expect(scenarios.getByRole("button", { name: "Confirm evaluation", exact: true })).toBeDisabled()
  expect(writes).toHaveLength(0)
  await captureAnalytics(page, info, "UI42-preview-condition-preserved-test-data")
})
