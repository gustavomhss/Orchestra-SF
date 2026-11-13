import { digestSfValue } from "../contracts/canonical.ts"
import type { DecisionCasePort, DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import type { createSfDecisionResultStore } from "./result-store.ts"
import { encodeCaseRef } from "./case-port.ts"

/** Resolve a current alternative to an actually persisted and currently authorized C08 result. */
export function createDecisionScenarioLookup(input: { cases: DecisionCasePort; state: SfProductStatePort; results: ReturnType<typeof createSfDecisionResultStore>; host: Pick<DomainPortHost, "requestFor" | "revalidate"> }) {
  return async (request: { caseRef: { id: string; incarnation: string; version: number }; alternativeId: string; alternativeVersion: number }, context: TrustedDomainContext): Promise<PortResult<{ resultRef: string; requestDigest: string; resultDigest: string }>> => {
    try {
      const source = input.host.requestFor(context)
      if (!source || !await input.host.revalidate(context)) return { status: "denied", reason: "scenario-access-unavailable" }
      const current = await input.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, context)
      if (current.status !== "ok") return current
      if (current.value.case.version !== request.caseRef.version) return { status: "stale", reason: "case-changed" }
      const alternatives = current.value.case.alternatives.filter((item) => item.id === request.alternativeId && item.version === request.alternativeVersion)
      if (alternatives.length !== 1) return { status: "unavailable", reason: "alternative-unavailable" }
      const requestDigest = digestSfValue(alternatives[0]!.scenario)
      const resultDigest = digestSfValue(alternatives[0]!.result)
      const records = await input.state.read(source, "cases", (state, authority) => authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision ? Object.values(state.decisionResults ?? {}).filter((item) => item.kind === "scenario" && item.caseRef.id === request.caseRef.id && item.caseRef.incarnation === request.caseRef.incarnation && item.caseRef.version <= request.caseRef.version && item.requestDigest === requestDigest && item.resultDigest === resultDigest) : undefined)
      if (records.status !== "ok" || !records.value?.length) return { status: "unavailable", reason: "scenario-result-unavailable" }
      const newest = Math.max(...records.value.map((item) => item.caseRef.version))
      const matches = records.value.filter((item) => item.caseRef.version === newest)
      if (matches.length !== 1) return { status: "conflict", reason: "scenario-result-ambiguous" }
      const resultRef = matches[0]!.resultRef
      const stored = await input.results.readHistoricalScenario({ resultRef }, context)
      if (stored.status !== "ok" || stored.value.kind !== "scenario" || stored.value.requestDigest !== requestDigest || stored.value.resultDigest !== resultDigest) return { status: "unavailable", reason: "scenario-result-unavailable" }
      const again = await input.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, context)
      const resultAgain = await input.results.readHistoricalScenario({ resultRef }, context)
      if (again.status !== "ok" || again.value.case.version !== request.caseRef.version || digestSfValue(again.value.case.alternatives) !== digestSfValue(current.value.case.alternatives) || resultAgain.status !== "ok" || digestSfValue(resultAgain.value) !== digestSfValue(stored.value) || source.signal.aborted || !await input.host.revalidate(context)) return { status: "stale", reason: "scenario-result-changed" }
      return { status: "ok", value: { resultRef, requestDigest, resultDigest } }
    } catch { return { status: "unavailable", reason: "scenario-result-unavailable" } }
  }
}
