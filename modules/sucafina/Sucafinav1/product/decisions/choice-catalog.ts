import { digestSfValue } from "../contracts/canonical.ts"
import type { DecisionCasePort, DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { encodeCaseRef } from "./case-port.ts"

type CaseRef = { id: string; incarnation: string; version: number }

/** List recorded choices from the currently authorized case, without deriving new choices. */
export function createDecisionChoiceCatalog(input: { cases: DecisionCasePort; host: Pick<DomainPortHost, "revalidate"> }) {
  return async (request: { caseRef: CaseRef }, context: TrustedDomainContext): Promise<PortResult<readonly { choiceId: string; label: string; alternativeId: string; alternativeVersion: number; at: string }[]>> => {
    try {
      if (!await input.host.revalidate(context)) return { status: "denied", reason: "choice-catalog-unavailable" }
      const read = () => input.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, context)
      const current = await read()
      if (current.status !== "ok") return current
      if (current.value.case.version !== request.caseRef.version) return { status: "stale", reason: "case-changed" }
      const choices = current.value.case.choices.map((choice) => ({ choiceId: choice.id, label: choice.reason, alternativeId: choice.alternativeId, alternativeVersion: choice.alternativeVersion, at: choice.at }))
      const again = await read()
      if (again.status !== "ok" || digestSfValue(again.value.case) !== digestSfValue(current.value.case) || !await input.host.revalidate(context)) return { status: "stale", reason: "choice-catalog-changed" }
      return { status: "ok", value: choices }
    } catch { return { status: "unavailable", reason: "choice-catalog-unavailable" } }
  }
}
