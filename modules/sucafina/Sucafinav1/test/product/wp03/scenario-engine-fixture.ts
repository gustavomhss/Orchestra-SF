import type { Snapshot } from "../../../runtime/contract.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { CostCoverageAssessment, CostCoverageBasis } from "../../../product/contracts/decisions.ts"
import type { PlannerSourceHost } from "../../../product/contracts/ports.ts"
import { createPlannerPort } from "../../../product/planner/port.ts"
import { plannerFixture } from "./planner-fixture.ts"

export const scenarioMonth = { start: "2027-11-01", end: "2027-11-30" }

/** Real domain, SQLite, scoped source issuer and private UI admission; classification remains explicitly pending. */
export async function scenarioEngineFixture(snapshot: Snapshot) {
  const fixture = await plannerFixture(snapshot)
  try {
    const context = await fixture.admit("sf-human:planner.read", {}, "finance", true)
    const issued = await fixture.issueSource("v0", context)
    if (issued.status !== "ok") throw new Error("Scenario source unavailable")
    const source = issued.value.evidence
    const coverageRef = "scenario-engine-coverage"
    const basis: CostCoverageBasis = { id: "scenario-engine-basis", version: 1, decisionType: "renewal-transition-v1", categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: [source] }
    const assessment: CostCoverageAssessment = { basisId: basis.id, basisVersion: basis.version, alternativeId: "source", alternativeVersion: 1, currency: "USD", horizon: scenarioMonth, evaluatedSourceRefs: [source], coverageState: "pending", entries: RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => ({ categoryId, status: "pending", reason: "Human cost classification not supplied" })), derivedMissingCategoryIds: [...RENEWAL_TRANSITION_CATEGORIES], issues: ["human-cost-classification-required"] }
    const sources: PlannerSourceHost = { resolveForecastSource: fixture.sources.resolveForecastSource, resolveForecastCoverage: async (reference, binding) => {
      if (reference !== source.refId && reference !== coverageRef) return { status: "unavailable", reason: "unknown-scenario-coverage" }
      const current = await fixture.sources.resolveForecastSource(source.refId, binding)
      if (current.status !== "ok") return current
      if (current.value.evidence.refDigest !== source.refDigest) return { status: "stale", reason: "scenario-source-changed" }
      return { status: "ok", value: { coverageRef, basis, assessment } }
    } }
    const planner = createPlannerPort({ host: fixture.host, sources })
    return { ...fixture, context, source, coverageRef, basis, assessment, sources, planner }
  } catch (error) { await fixture.close(); throw error }
}
