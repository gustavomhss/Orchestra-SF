import { enterSfE15Route, runSfE15Route, returnedSfE15Route, finishSfE15Route } from "../../runtime/preview-progress-e15-diagnostic.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { DecisionCasePort, DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import type { createSfDecisionResultStore } from "./result-store.ts"
import { encodeCaseRef } from "./case-port.ts"
import { selectSfScenarioCandidates } from "../host-binding/state-provider.ts"

/** Resolve a current alternative to an actually persisted and currently authorized C08 result. */
export function createDecisionScenarioLookup(input: { cases: DecisionCasePort; state: SfProductStatePort; results: ReturnType<typeof createSfDecisionResultStore>; host: Pick<DomainPortHost, "requestFor" | "revalidate"> }) {
  return async (request: { caseRef: { id: string; incarnation: string; version: number }; alternativeId: string; alternativeVersion: number }, context: TrustedDomainContext): Promise<PortResult<{ resultRef: string; requestDigest: string; resultDigest: string }>> => {
    const e15Lookup = enterSfE15Route("lookup")
    let e15Threw = false
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
      const records = returnedSfE15Route(e15Lookup, "candidate-read-returned", await runSfE15Route(e15Lookup, "candidate-read", () => input.state.read(source, "cases", selectSfScenarioCandidates(request, requestDigest, resultDigest, context))))
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
    } catch { e15Threw = true; return { status: "unavailable", reason: "scenario-result-unavailable" } }
    finally { finishSfE15Route(e15Lookup, e15Threw) }
  }
}
