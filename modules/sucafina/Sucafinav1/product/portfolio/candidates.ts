import type { DecisionCasePort, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { parseCaseRef } from "../decisions/case-port.ts"
import type { PortfolioCandidate } from "./port.ts"

export function portfolioCandidateRef(input: { caseRef: string; caseVersion: number; alternativeId: string; alternativeVersion: number }) {
  return `portfolio-candidate:${encodeURIComponent(input.caseRef)}:${input.caseVersion}:${encodeURIComponent(input.alternativeId)}:${input.alternativeVersion}`
}

/** Candidate selectors identify an existing versioned decision alternative; they confer no access. */
export function createDecisionCandidateResolver(cases: DecisionCasePort) {
  return async (ref: string, context: TrustedDomainContext): Promise<PortResult<PortfolioCandidate>> => {
    const match = /^portfolio-candidate:([^:]+):([1-9]\d*):([^:]+):([1-9]\d*)$/.exec(ref)
    if (!match) return { status: "needs-input", reason: "invalid-candidate-reference" }
    const decoded = [match[1], match[3]].map((part) => {
      try { return decodeURIComponent(part) } catch { return "" }
    })
    const caseVersion = Number(match[2])
    const alternativeVersion = Number(match[4])
    if (!decoded[0] || !decoded[1] || !Number.isSafeInteger(caseVersion) || !Number.isSafeInteger(alternativeVersion) || portfolioCandidateRef({ caseRef: decoded[0], caseVersion, alternativeId: decoded[1], alternativeVersion }) !== ref) return { status: "needs-input", reason: "invalid-candidate-reference" }
    const requestedCase = parseCaseRef(decoded[0])
    if (!requestedCase) return { status: "needs-input", reason: "invalid-candidate-reference" }
    const result = await cases.read({ caseRef: decoded[0] }, context)
    if (result.status !== "ok") return result
    if (result.value.case.id !== requestedCase.id || result.value.case.incarnation !== requestedCase.incarnation || result.value.case.version !== caseVersion) return { status: "stale", reason: "case-changed" }
    const alternatives = result.value.case.alternatives.filter((item) => item.id === decoded[1] && item.version === alternativeVersion)
    if (alternatives.length !== 1) return { status: "stale", reason: "alternative-changed" }
    const alternative = alternatives[0]!
    return { status: "ok", value: { ref, caseRef: decoded[0], operations: structuredClone(alternative.scenario.operations), scenario: structuredClone(alternative.scenario), result: structuredClone(alternative.result) } }
  }
}
