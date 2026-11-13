import { digestSfValue } from "../contracts/canonical.ts"
import type { DomainProjection } from "../contracts/context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { SensitivityResult } from "../contracts/outputs.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createSfDecisionResultStore } from "../decisions/result-store.ts"
import { validReviewDecision } from "./decision.ts"

type Decision = NonNullable<DomainProjection["decision"]>
type CaseRef = { id: string; incarnation: string; version: number }

/** Reopens WP11 C08 results and WP13 sensitivity with their actual source and case checks. */
export function createReviewDecisionAccess(input: {
  host: Pick<DomainPortHost, "revalidate">
  results: Pick<ReturnType<typeof createSfDecisionResultStore>, "read">
  sensitivity: { read: (ref: string, context: TrustedDomainContext) => Promise<PortResult<{ sensitivityResultRef: string; sensitivity: SensitivityResult; caseRef: CaseRef }>> }
}) {
  const inspect = async (decision: Decision, context: TrustedDomainContext): Promise<string | undefined> => {
    if (!validReviewDecision(decision)) return undefined
    if (decision.kind === "scenario") {
      const scenario = await input.results.read({ kind: "scenario", resultRef: decision.scenarioResultRef }, context)
      const comparison = await input.results.read({ kind: "comparison", resultRef: decision.comparisonRef }, context)
      if (scenario.status !== "ok" || scenario.value.kind !== "scenario" || comparison.status !== "ok" || comparison.value.kind !== "comparison" || digestSfValue(scenario.value.result) !== digestSfValue(decision.scenario) || digestSfValue(comparison.value.result) !== digestSfValue(decision.comparison) || digestSfValue(scenario.value.caseRef) !== digestSfValue(comparison.value.caseRef)) return undefined
      const sensitivityRef = (decision as typeof decision & { sensitivityResultRef?: string }).sensitivityResultRef
      if (!decision.sensitivity) return digestSfValue([scenario.value, comparison.value])
      if (!sensitivityRef) return undefined
      const sensitivity = await input.sensitivity.read(sensitivityRef, context)
      if (sensitivity.status !== "ok" || sensitivity.value.sensitivityResultRef !== sensitivityRef || sensitivity.value.sensitivity.scenarioRef !== decision.scenarioResultRef || digestSfValue(sensitivity.value.sensitivity) !== digestSfValue(decision.sensitivity) || digestSfValue(sensitivity.value.caseRef) !== digestSfValue(scenario.value.caseRef)) return undefined
      return digestSfValue([scenario.value, comparison.value, sensitivity.value])
    }
    const portfolio = await input.results.read({ kind: "portfolio", resultRef: decision.portfolioResultRef }, context)
    if (portfolio.status !== "ok" || portfolio.value.kind !== "portfolio" || digestSfValue(portfolio.value.result) !== digestSfValue(decision.portfolio)) return undefined
    const nested = await Promise.all(decision.portfolio.combinations.flatMap((combination) => combination.analysis ? [inspect({ kind: "scenario", ...combination.analysis }, context)] : []))
    if (nested.some((result) => !result)) return undefined
    return digestSfValue([portfolio.value, nested])
  }
  return async (context: TrustedDomainContext, decisions: readonly Decision[]) => {
    if (!await input.host.revalidate(context)) return false
    const first = await Promise.all(decisions.map((decision) => inspect(decision, context)))
    if (first.some((result) => !result) || !await input.host.revalidate(context)) return false
    const second = await Promise.all(decisions.map((decision) => inspect(decision, context)))
    return !second.some((result) => !result) && digestSfValue(first) === digestSfValue(second) && await input.host.revalidate(context)
  }
}
