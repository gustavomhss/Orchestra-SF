import { digestSfValue } from "../contracts/canonical.ts"
import type { DecisionCase, CostCoverageAssessment, CostCoverageBasis } from "../contracts/decisions.ts"
import type { DomainPortHost, PlannerSourceHost } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfProductStatePort } from "../contracts/state.ts"

export function decisionCoverageRef(caseRef: { id: string; incarnation: string }, alternativeId: string, alternativeVersion: number) {
  return `case-coverage:${encodeURIComponent(caseRef.id)}:${encodeURIComponent(caseRef.incarnation)}:${encodeURIComponent(alternativeId)}:${alternativeVersion}`
}

export function createDecisionCoverageAccess(input: {
  state: SfProductStatePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  authorizeCase: (value: DecisionCase, context: TrustedDomainContext) => Promise<boolean>
  verifyEvidence: (basis: CostCoverageBasis, assessment: CostCoverageAssessment, context: TrustedDomainContext) => Promise<boolean>
}): PlannerSourceHost["resolveForecastCoverage"] {
  return async (reference, context) => {
    try {
      const parts = /^case-coverage:([^:]+):([^:]+):([^:]+):(0|[1-9]\d*)$/.exec(reference)
      if (!parts) return { status: "needs-input", reason: "invalid-coverage-reference" }
      const id = decodeURIComponent(parts[1]!)
      const incarnation = decodeURIComponent(parts[2]!)
      const alternativeId = decodeURIComponent(parts[3]!)
      const version = Number(parts[4])
      if (!id.trim() || !incarnation.trim() || !alternativeId.trim() || !Number.isSafeInteger(version) || decisionCoverageRef({ id, incarnation }, alternativeId, version) !== reference) return { status: "needs-input", reason: "invalid-coverage-reference" }
      const source = input.host.requestFor(context)
      if (!source || source.signal.aborted || !await input.host.revalidate(context)) return { status: "denied", reason: "coverage-access-unavailable" }
      const read = async () => input.state.read(source, "cases", (state, authority) => authority.principalRef === context.binding.principalRef && authority.policyVersion === context.binding.policyVersion && authority.accessRevision === context.binding.accessRevision ? state.cases[id] : undefined)
      const current = await read()
      if (current.status !== "ok") return { status: "unavailable", reason: "coverage-unavailable" }
      const decision = current.value
      if (!decision || decision.incarnation !== incarnation || !decision.participants.includes(context.binding.principalRef) || (context.kind === "native" && (context.binding.caseId !== id || context.binding.caseIncarnation !== incarnation || context.binding.caseVersion !== decision.version)) || !await input.authorizeCase(decision, context)) return { status: "denied", reason: "coverage-access-unavailable" }
      const alternatives = decision.alternatives.filter((item) => item.id === alternativeId && item.version === version)
      if (alternatives.length !== 1) return { status: "unavailable", reason: "coverage-unavailable" }
      const assessment = alternatives[0]!.result.costCoverage
      const bases = decision.costCoverageBases.filter((item) => item.id === assessment.basisId && item.version === assessment.basisVersion)
      if (bases.length !== 1 || assessment.alternativeId !== alternativeId || assessment.alternativeVersion !== version || !await input.verifyEvidence(bases[0]!, assessment, context)) return { status: "unavailable", reason: "coverage-evidence-unavailable" }
      const again = await read()
      if (again.status !== "ok" || !again.value || again.value.incarnation !== incarnation || again.value.version !== decision.version || digestSfValue(again.value) !== digestSfValue(decision) || !await input.authorizeCase(again.value, context) || !await input.verifyEvidence(bases[0]!, assessment, context) || source.signal.aborted || !await input.host.revalidate(context)) return { status: "stale", reason: "coverage-changed" }
      return { status: "ok", value: { coverageRef: reference, basis: bases[0]!, assessment } }
    } catch {
      return { status: "unavailable", reason: "coverage-unavailable" }
    }
  }
}
