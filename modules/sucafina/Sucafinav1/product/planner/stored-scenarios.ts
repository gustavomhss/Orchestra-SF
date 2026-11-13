import { digestSfValue } from "../contracts/canonical.ts"
import type { DecisionCasePort, PlannerPort } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createSfDecisionResultStore } from "../decisions/result-store.ts"
import { encodeCaseRef } from "../decisions/case-port.ts"
import type { PlannerScenarioHost } from "./scenario-comparison-port.ts"

/** Resolve a stored scenario only when it is the exact current, authorized case alternative. */
export function createStoredPlannerScenarioHost(input: {
  store: ReturnType<typeof createSfDecisionResultStore> & { readHistoricalScenario?: (request: { resultRef: string }, context: TrustedDomainContext) => ReturnType<ReturnType<typeof createSfDecisionResultStore>["read"]> }
  cases: DecisionCasePort
  planner: Pick<PlannerPort, "compareForecast">
  coverageRefFor: (caseRef: { id: string; incarnation: string; version: number }, alternative: { id: string; version: number }) => string
}): PlannerScenarioHost {
  return {
    async resolve(reference, context) {
      const read = () => input.store.readHistoricalScenario ? input.store.readHistoricalScenario({ resultRef: reference }, context) : input.store.read({ resultRef: reference, kind: "scenario" }, context)
      const stored = await read()
      if (stored.status !== "ok") return stored
      if (stored.value.kind !== "scenario") return { status: "unavailable", reason: "scenario-unavailable" }
      const current = await input.cases.read({ caseRef: encodeCaseRef(stored.value.caseRef) }, context)
      if (current.status !== "ok") return current
      if (current.value.case.version < stored.value.caseRef.version) return { status: "stale", reason: "case-changed" }
      const alternatives = current.value.case.alternatives.filter((alternative) => digestSfValue(alternative.scenario) === stored.value.requestDigest && digestSfValue(alternative.result) === stored.value.resultDigest)
      if (alternatives.length !== 1) return { status: "unavailable", reason: "scenario-not-current-case-alternative" }
      const alternative = alternatives[0]!
      const bases = current.value.case.costCoverageBases.filter((basis) => basis.id === alternative.result.costCoverage.basisId && basis.version === alternative.result.costCoverage.basisVersion)
      const refs = alternative.result.sourceRefs.filter((ref) => ref.kind === "record" && ref.refId === alternative.scenario.baseRef && ref.target.surface === "planner" && ref.target.recordType === "planner-version")
      if (bases.length !== 1 || refs.length !== 1 || refs[0].kind !== "record") return { status: "unavailable", reason: "scenario-proof-unavailable" }
      const projection = await input.planner.compareForecast({ baseRef: refs[0].refId, candidateRef: refs[0].refId, period: alternative.result.horizon, currency: alternative.result.currency }, context)
      if (projection.status !== "ok") return projection
      const coverageRef = input.coverageRefFor({ ...stored.value.caseRef, version: current.value.case.version }, alternative)
      if (!coverageRef.trim()) return { status: "unavailable", reason: "scenario-coverage-unavailable" }
      const again = await read()
      if (again.status !== "ok") return again
      if (digestSfValue(again.value) !== digestSfValue(stored.value)) return { status: "stale", reason: "scenario-changed" }
      const currentAgain = await input.cases.read({ caseRef: encodeCaseRef(stored.value.caseRef) }, context)
      if (currentAgain.status !== "ok") return currentAgain
      if (digestSfValue(currentAgain.value.case) !== digestSfValue(current.value.case)) return { status: "stale", reason: "case-changed" }
      return { status: "ok", value: { result: alternative.result, coverageRef, basis: bases[0]!, projection: projection.value.baseline, source: refs[0] } }
    },
  }
}
