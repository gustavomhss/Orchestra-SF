import { afterEach, expect, test } from "bun:test"
import type { AuthorizedCaseProjection } from "../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { ScenarioResult } from "../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import { decisionChoiceForm } from "../../../modules/sucafina/Sucafinav1/product/ui/decision-choice.ts"
import { portfolioScript, portfolioWidget } from "../../../modules/sucafina/Sucafinav1/product/ui/portfolio.ts"

afterEach(() => document.body.replaceChildren())

test("portfolio initialization keeps the choice button separate from the real widget", () => {
  // Rendering scope only: this is not authority or a simulated successful domain command.
  const horizon = { start: "2027-01-01", end: "2027-12-31" }
  const result: ScenarioResult = { id: "result", version: 1, components: [], currency: "USD", horizon, sourceRefs: [],
    unresolvedConditions: [], restrictions: [], comparisonStatus: "conditioned", knownSubtotal: 0, total: null,
    costCoverage: { basisId: "coverage", basisVersion: 1, alternativeId: "alternative", alternativeVersion: 1,
      currency: "USD", horizon, entries: [], derivedMissingCategoryIds: [], coverageState: "pending", issues: [], evaluatedSourceRefs: [] } }
  const projection: AuthorizedCaseProjection = {
    context: { kind: "ui", installationId: "installation", projectId: "project", principalRef: "person", policyVersion: "policy", accessRevision: "access" },
    case: { id: "case", incarnation: "incarnation", version: 1, state: "comparing", objective: "Compare", horizon, currency: "USD",
      criteria: [{ id: "cost", description: "Cost", required: true }], participants: ["person"], sourceRefs: [],
      alternatives: ["baseline", "alternative"].map((id) => ({ id, version: 1, title: id,
        scenario: { baseRef: "rendered-source", operations: [], assumptions: [] }, result: { ...result, id: id + "-result" } })),
      costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] },
    events: [], evidenceRefs: [], checkedAt: "2026-11-19T00:00:00Z",
  }
  document.body.innerHTML = decisionChoiceForm(projection) + portfolioWidget
  const choice = document.querySelector<HTMLButtonElement>("form[data-decision-choice] button[data-portfolio]")!
  const widget = document.querySelector<HTMLElement>("section[data-portfolio]")!
  expect(document.querySelectorAll("[data-portfolio]")).toHaveLength(2)
  expect(choice.textContent).toBe("Use these alternatives in portfolio")
  expect(() => new Function(portfolioScript)()).not.toThrow()
  expect(widget.dataset.sfPortfolioReady).toBe("true")
  expect(choice.dataset.sfPortfolioReady).toBeUndefined()
  expect(choice.disabled).toBe(true)
  expect(() => new Function(portfolioScript)()).not.toThrow()
  expect(choice.dataset.sfPortfolioReady).toBeUndefined()
})
