import { createPlannerExactThreshold } from "../../../../product/planner/exact-threshold.ts"
import type { createRenewalChoiceHistory } from "../../wp11/renewal-choice-fixture.ts"
import type { createFinanceJourneyTrace } from "./phase-trace.ts"

export type RenewalHistory = Awaited<ReturnType<typeof createRenewalChoiceHistory>>
export type JourneyTrace = ReturnType<typeof createFinanceJourneyTrace>

/** Decorate the same producer ports; the exact factory is the fixture's original factory. */
export function observeRenewalPhase(phase: RenewalHistory["before"], trace: JourneyTrace, label: string) {
  const issuer = {
    issue: trace.wrap(`${label}.units.issue`, phase.issuer.issue),
    resolve: trace.wrap(`${label}.units.resolve`, phase.issuer.resolve),
    revalidate: trace.wrap(`${label}.units.revalidate`, phase.issuer.revalidate),
  }
  const preview = trace.wrap(`${label}.preview`, phase.preview)
  const results = {
    ...phase.results,
    read: trace.wrap(`${label}.results.read`, phase.results.read),
    readHistoricalScenario: trace.wrap(`${label}.results.readHistoricalScenario`, phase.results.readHistoricalScenario),
    readByRequest: trace.wrap(`${label}.results.readByRequest`, phase.results.readByRequest),
    write: trace.wrap(`${label}.results.write`, phase.results.write),
  }
  const exact = trace.wrap(`${label}.exact`, createPlannerExactThreshold({ units: issuer, preview }))
  return { ...phase, issuer, preview, results, exact }
}
