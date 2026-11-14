import { digestSfValue } from "../contracts/canonical.ts"
import type { DecisionCasePort, DomainPortHost, PlannerSourceHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { encodeCaseRef } from "./case-port.ts"
import { decisionCoverageRef } from "./coverage-access.ts"

type CaseRef = { id: string; incarnation: string; version: number }

/** Present only case-owned assessments whose evidence is currently readable. */
export function createDecisionCoverageCatalog(input: { cases: DecisionCasePort; host: Pick<DomainPortHost, "revalidate">; sources: Pick<PlannerSourceHost, "resolveForecastCoverage"> }) {
  return async (request: { caseRef: CaseRef }, context: TrustedDomainContext): Promise<PortResult<readonly { coverageRef: string; alternativeId: string; alternativeVersion: number; label: string; basisId: string; basisVersion: number; state: string }[]>> => {
    try {
      if (!await input.host.revalidate(context)) return { status: "denied", reason: "coverage-catalog-unavailable" }
      const current = await input.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, context)
      if (current.status !== "ok") return current
      if (current.value.case.version !== request.caseRef.version) return { status: "stale", reason: "case-changed" }
      const values = await Promise.all(current.value.case.alternatives.map(async (alternative) => {
        const coverageRef = decisionCoverageRef(request.caseRef, alternative.id, alternative.version)
        const result = await input.sources.resolveForecastCoverage(coverageRef, context)
        if (result.status !== "ok" || result.value.coverageRef !== coverageRef || digestSfValue(result.value.assessment) !== digestSfValue(alternative.result.costCoverage)) return undefined
        return { coverageRef, alternativeId: alternative.id, alternativeVersion: alternative.version, label: alternative.title, basisId: result.value.basis.id, basisVersion: result.value.basis.version, state: result.value.assessment.coverageState }
      }))
      const again = await input.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, context)
      if (again.status !== "ok" || digestSfValue(again.value.case) !== digestSfValue(current.value.case) || !await input.host.revalidate(context)) return { status: "stale", reason: "coverage-catalog-changed" }
      return { status: "ok", value: values.filter((value): value is NonNullable<typeof value> => value !== undefined) }
    } catch { return { status: "unavailable", reason: "coverage-catalog-unavailable" } }
  }
}
