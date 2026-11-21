import { digestSfValue } from "../contracts/canonical.ts"
import type { ScenarioResult } from "../contracts/decisions.ts"
import type { DecisionCasePort, DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import type { createSfDecisionResultStore } from "./result-store.ts"
import { encodeCaseRef } from "./case-port.ts"

type CaseRef = { id: string; incarnation: string; version: number }

/** Resolve a chosen preview to an existing authorized C08 result; never invent a reference. */
export function createDecisionChoiceResultLookup(input: { cases: DecisionCasePort; state: SfProductStatePort; results: ReturnType<typeof createSfDecisionResultStore>; host: Pick<DomainPortHost, "requestFor" | "revalidate"> }) {
  return async (request: { caseRef: CaseRef; choiceId: string; preview: ScenarioResult }, context: TrustedDomainContext): Promise<PortResult<{ previewRef: string }>> => {
    try {
      const source = input.host.requestFor(context)
      if (!source || !await input.host.revalidate(context)) return { status: "denied", reason: "preview-access-unavailable" }
      const readCase = () => input.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, context)
      const current = await readCase()
      if (current.status !== "ok") return current
      const choices = current.value.case.choices.filter((choice) => choice.id === request.choiceId)
      if (current.value.case.version !== request.caseRef.version || choices.length !== 1 || digestSfValue(choices[0]!.result) !== digestSfValue(request.preview)) return { status: "stale", reason: "choice-preview-changed" }
      const choice = choices[0]!
      const readResults = () => input.state.read(source, "cases", (state, authority) => authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision ? Object.values(state.decisionResults ?? {}).filter((value) => value.kind === "scenario" && value.caseRef.id === request.caseRef.id && value.caseRef.incarnation === request.caseRef.incarnation && value.caseRef.version <= request.caseRef.version && value.requestDigest === digestSfValue(choice.scenario) && value.resultDigest === digestSfValue(choice.result)) : undefined)
      const found = await readResults()
      if (found.status !== "ok" || !found.value) return { status: "unavailable", reason: "preview-result-unavailable" }
      if (found.value.length !== 1) return { status: found.value.length > 1 ? "conflict" : "unavailable", reason: found.value.length > 1 ? "preview-result-ambiguous" : "preview-result-unavailable" }
      const result = await input.results.readHistoricalScenario({ resultRef: found.value[0]!.resultRef }, context)
      if (result.status !== "ok" || result.value.kind !== "scenario" || digestSfValue(result.value) !== digestSfValue(found.value[0])) return { status: "unavailable", reason: "preview-result-unavailable" }
      const again = await readCase()
      const resultsAgain = await readResults()
      if (again.status !== "ok" || digestSfValue(again.value.case) !== digestSfValue(current.value.case) || resultsAgain.status !== "ok" || digestSfValue(resultsAgain.value) !== digestSfValue(found.value) || source.signal.aborted || !await input.host.revalidate(context)) return { status: "stale", reason: "preview-result-changed" }
      return { status: "ok", value: { previewRef: result.value.resultRef } }
    } catch { return { status: "unavailable", reason: "preview-result-unavailable" } }
  }
}
