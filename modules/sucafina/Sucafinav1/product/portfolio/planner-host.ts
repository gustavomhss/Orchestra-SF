import { digestSfValue } from "../contracts/canonical.ts"
import type { PortfolioRequest, ScenarioOperation, ScenarioRequest } from "../contracts/operations.ts"
import type { PortfolioCombination, ScenarioResult } from "../contracts/decisions.ts"
import type { PlannerPort, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { PortfolioCandidate, PortfolioHost } from "./port.ts"

/** Composition seam: business selectors and current authorization come from the host. */
export function createPortfolioPlannerHost(input: {
  planner: PlannerPort
  resolveCandidate: PortfolioHost["resolveCandidate"]
  revalidate: PortfolioHost["revalidate"]
  revalidateEvaluation: PortfolioHost["revalidateEvaluation"]
  sensitivity?: PortfolioHost["sensitivity"]
  scenarioRequest: (request: PortfolioRequest, candidates: readonly PortfolioCandidate[], operations: readonly ScenarioOperation[], context: TrustedDomainContext) => Promise<PortResult<ScenarioRequest>>
  assess: (request: PortfolioRequest, candidates: readonly PortfolioCandidate[], result: ScenarioResult, context: TrustedDomainContext, scenario: ScenarioRequest) => Promise<PortResult<{ costCoverageRefs: readonly string[]; analysis?: PortfolioCombination["analysis"]; constraints: readonly { ref: string; state: "satisfied" | "failed" | "unknown"; reason: string }[] }>>
}): PortfolioHost {
  return {
    resolveCandidate: input.resolveCandidate,
    revalidate: input.revalidate,
    revalidateEvaluation: input.revalidateEvaluation,
    sensitivity: input.sensitivity ?? ((request, context) => input.planner.evaluateSensitivity(request, context)),
    evaluate: async ({ request, candidates, operations }, context) => {
      const scenario = await input.scenarioRequest(request, candidates, operations, context)
      if (scenario.status !== "ok") return scenario
      if (candidates.some((candidate) => candidate.scenario.baseRef !== scenario.value.baseRef || candidate.scenario.assumptions.some((assumption) => !scenario.value.assumptions.some((item) => digestSfValue(item) === digestSfValue(assumption))))) return { status: "conflict", reason: "candidate-base-or-assumptions-mismatch" }
      if (digestSfValue(scenario.value.operations) !== digestSfValue(operations)) return { status: "conflict", reason: "scenario-operations-mismatch" }
      const result = await input.planner.simulateScenario(scenario.value, context)
      if (result.status !== "ok") return result
      const assessment = await input.assess(request, candidates, result.value, context, scenario.value)
      if (assessment.status !== "ok") return assessment
      if (!await input.revalidate(context)) return { status: "stale", reason: "authority-changed" }
      return { status: "ok", value: { scenario: result.value, ...assessment.value } }
    },
  }
}
