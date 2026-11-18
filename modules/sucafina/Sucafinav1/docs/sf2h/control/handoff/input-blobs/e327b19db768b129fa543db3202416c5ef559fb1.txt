import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainPortHost, DecisionCasePort, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { encodeCaseRef } from "./case-port.ts"

type Assumption = { id: string; value: string | number | boolean | null; evidenceRefs: readonly BusinessEvidenceRef[]; state: "confirmed" | "estimated" | "hypothetical" | "absent" }
type Observation = { value: string | number | boolean | null; evidenceRefs: readonly BusinessEvidenceRef[] }

/** Observations come from the source owner; this never updates an official source. */
export function createAssumptionDivergenceService(input: {
  cases: DecisionCasePort
  host: Pick<DomainPortHost, "revalidate">
  observe: (assumption: Assumption, context: TrustedDomainContext) => Promise<PortResult<Observation>>
}) {
  return async (request: { caseRef: { id: string; incarnation: string; version: number }; alternativeId: string; alternativeVersion: number }, context: TrustedDomainContext): Promise<PortResult<readonly { assumptionId: string; proposed: Assumption["value"]; observed: Observation["value"]; state: "matches" | "diverges" | "unavailable"; evidenceRefs: readonly BusinessEvidenceRef[] }[]>> => {
    try {
      const reference = encodeCaseRef(request.caseRef)
      const current = await input.cases.read({ caseRef: reference }, context)
      if (current.status !== "ok") return current
      if (current.value.case.version !== request.caseRef.version) return { status: "stale", reason: "case-changed" }
      const alternatives = current.value.case.alternatives.filter((item) => item.id === request.alternativeId && item.version === request.alternativeVersion)
      if (alternatives.length !== 1) return { status: "unavailable", reason: "alternative-unavailable" }
      const assumptions = alternatives[0]!.scenario.assumptions
      if (new Set(assumptions.map((item) => item.id)).size !== assumptions.length) return { status: "conflict", reason: "assumption-identity-conflict" }
      const observed = await Promise.all(assumptions.map((item) => input.observe(item, context)))
      const again = await input.cases.read({ caseRef: reference }, context)
      if (again.status !== "ok" || again.value.case.version !== current.value.case.version || digestSfValue(again.value.case.alternatives) !== digestSfValue(current.value.case.alternatives) || !await input.host.revalidate(context)) return { status: "stale", reason: "case-changed" }
      const checked = await Promise.all(assumptions.map((item) => input.observe(item, context)))
      if (checked.some((value, index) => digestSfValue(value) !== digestSfValue(observed[index])) || !await input.host.revalidate(context)) return { status: "stale", reason: "assumption-source-changed" }
      return { status: "ok", value: assumptions.map((item, index) => {
        const value = observed[index]
        if (!value || value.status !== "ok" || !value.value.evidenceRefs.length) return { assumptionId: item.id, proposed: item.value, observed: null, state: "unavailable" as const, evidenceRefs: [] }
        return { assumptionId: item.id, proposed: item.value, observed: value.value.value, state: digestSfValue(item.value) === digestSfValue(value.value.value) ? "matches" as const : "diverges" as const, evidenceRefs: value.value.evidenceRefs }
      }) }
    } catch {
      return { status: "unavailable", reason: "assumption-observation-unavailable" }
    }
  }
}
