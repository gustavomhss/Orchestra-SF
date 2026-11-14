import { digestSfValue } from "../contracts/canonical.ts"
import type { DomainProjection } from "../contracts/context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { SensitivityResult } from "../contracts/outputs.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createSfDecisionResultStore } from "../decisions/result-store.ts"
import type { createPortfolioHistory } from "../decisions/portfolio-history.ts"
import { validReviewDecision } from "./decision.ts"

type Decision = NonNullable<DomainProjection["decision"]>
type CaseRef = { id: string; incarnation: string; version: number }

/** Reopens WP11 C08 results and WP13 sensitivity with their actual source and case checks. */
export function createReviewDecisionAccess(input: {
  host: Pick<DomainPortHost, "revalidate">
  results: Pick<ReturnType<typeof createSfDecisionResultStore>, "read"> & Partial<Pick<ReturnType<typeof createSfDecisionResultStore>, "readHistoricalScenario">>
  sensitivity: { read: (ref: string, context: TrustedDomainContext) => Promise<PortResult<{ sensitivityResultRef: string; sensitivity: SensitivityResult; caseRef: CaseRef }>> }
  portfolioHistory?: Pick<ReturnType<typeof createPortfolioHistory>, "read">
  currentCase?: (context: TrustedDomainContext) => Promise<PortResult<CaseRef>>
}) {
  const inspect = async (decision: Decision, context: TrustedDomainContext): Promise<string | undefined> => {
    if (!validReviewDecision(decision)) return undefined
    if (decision.kind === "scenario") {
      const scenario = input.results.readHistoricalScenario ? await input.results.readHistoricalScenario({ resultRef: decision.scenarioResultRef }, context) : await input.results.read({ kind: "scenario", resultRef: decision.scenarioResultRef }, context)
      const comparison = await input.results.read({ kind: "comparison", resultRef: decision.comparisonRef }, context)
      if (scenario.status !== "ok" || scenario.value.kind !== "scenario" || comparison.status !== "ok" || comparison.value.kind !== "comparison" || scenario.value.resultRef !== decision.scenarioResultRef || comparison.value.resultRef !== decision.comparisonRef || digestSfValue(scenario.value.result) !== digestSfValue(decision.scenario) || digestSfValue(comparison.value.result) !== digestSfValue(decision.comparison) || !sameCaseAtOrAfter(comparison.value.caseRef, scenario.value.caseRef)) return undefined
      const sensitivityRef = (decision as typeof decision & { sensitivityResultRef?: string }).sensitivityResultRef
      if (!decision.sensitivity) return digestSfValue([scenario.value, comparison.value])
      if (!sensitivityRef) return undefined
      const sensitivity = await input.sensitivity.read(sensitivityRef, context)
      if (sensitivity.status !== "ok" || sensitivity.value.sensitivityResultRef !== sensitivityRef || sensitivity.value.sensitivity.scenarioRef !== decision.scenarioResultRef || digestSfValue(sensitivity.value.sensitivity) !== digestSfValue(decision.sensitivity) || !sameCaseAtOrAfter(sensitivity.value.caseRef, scenario.value.caseRef)) return undefined
      return digestSfValue([scenario.value, comparison.value, sensitivity.value])
    }
    const portfolio = await input.results.read({ kind: "portfolio", resultRef: decision.portfolioResultRef }, context)
    if (portfolio.status !== "ok") {
      if (!input.portfolioHistory || !input.currentCase) return undefined
      const current = await input.currentCase(context)
      if (current.status !== "ok") return undefined
      const historical = await input.portfolioHistory.read({ caseRef: current.value, resultRef: decision.portfolioResultRef }, context)
      if (historical.status !== "ok" || historical.value.state !== "historical" || historical.value.resultRef !== decision.portfolioResultRef || digestSfValue(historical.value.result) !== digestSfValue(decision.portfolio) || !sameCaseAtOrAfter(current.value, historical.value.originalCaseRef)) return undefined
      return digestSfValue(historical.value)
    }
    if (portfolio.value.kind !== "portfolio" || portfolio.value.resultRef !== decision.portfolioResultRef || digestSfValue(portfolio.value.result) !== digestSfValue(decision.portfolio)) return undefined
    const nested = await Promise.all(decision.portfolio.combinations.flatMap((combination) => combination.analysis ? [inspect({ kind: "scenario", ...combination.analysis }, context)] : []))
    if (nested.some((result) => !result)) return undefined
    return digestSfValue([portfolio.value, nested])
  }
  return async (context: TrustedDomainContext, decisions: readonly Decision[]) => {
    try {
      if (!await input.host.revalidate(context)) return false
      const first = await Promise.all(decisions.map((decision) => inspect(decision, context)))
      if (first.some((result) => !result) || !await input.host.revalidate(context)) return false
      const second = await Promise.all(decisions.map((decision) => inspect(decision, context)))
      return !second.some((result) => !result) && digestSfValue(first) === digestSfValue(second) && await input.host.revalidate(context)
    } catch { return false }
  }
}

function sameCaseAtOrAfter(current: CaseRef, original: CaseRef) {
  return current.id === original.id && current.incarnation === original.incarnation && Number.isSafeInteger(current.version) && Number.isSafeInteger(original.version) && original.version >= 0 && current.version >= original.version
}
