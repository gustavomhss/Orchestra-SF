import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { PortfolioCompositionInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/skill-inputs.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { decisionCoverageRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/coverage-access.ts"
import { encodeCaseRef, parseCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import { createDecisionCandidateResolver, portfolioCandidateRef } from "../../../../modules/sucafina/Sucafinav1/product/portfolio/candidates.ts"
import type { SfAnalysisDependencies, SfAnalysisRequest } from "./analysis-verifier.ts"
import type { SfInputProducer } from "./input-producer-intent.ts"

function same(left: unknown, right: unknown) {
  return digestSfValue(left) === digestSfValue(right)
}

function strings(value: unknown): readonly string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim().length > 0) ? value : undefined
}

function humanPortfolioSelection(value: unknown): { candidateRefs: readonly string[]; constraints: readonly string[]; priorities: readonly string[]; explorationLimit: number; operations: unknown } | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const entries = Object.entries(value)
  if (entries.length !== 5 || entries.some(([key]) => key !== "candidateRefs" && key !== "constraints" && key !== "priorities" && key !== "explorationLimit" && key !== "operations")) return undefined
  const candidateRefs = strings(entries.find(([key]) => key === "candidateRefs")?.[1])
  const constraints = strings(entries.find(([key]) => key === "constraints")?.[1])
  const priorities = strings(entries.find(([key]) => key === "priorities")?.[1])
  const explorationLimit = entries.find(([key]) => key === "explorationLimit")?.[1]
  const operations = entries.find(([key]) => key === "operations")?.[1]
  if (!candidateRefs || !constraints || !priorities || typeof explorationLimit !== "number" || !Number.isSafeInteger(explorationLimit) || explorationLimit < 1 || operations === undefined) return undefined
  return { candidateRefs, constraints, priorities, explorationLimit, operations }
}

function parseCandidate(ref: string) {
  const match = /^portfolio-candidate:([^:]+):([1-9]\d*):([^:]+):([1-9]\d*)$/.exec(ref)
  if (!match) return undefined
  const caseVersion = Number(match[2])
  const alternativeVersion = Number(match[4])
  const decoded = [match[1], match[3]].map((part) => { try { return decodeURIComponent(part!) } catch { return "" } })
  const caseRef = decoded[0] ? parseCaseRef(decoded[0]) : undefined
  if (!caseRef || !decoded[1] || !Number.isSafeInteger(caseVersion) || !Number.isSafeInteger(alternativeVersion) || portfolioCandidateRef({ caseRef: decoded[0]!, caseVersion, alternativeId: decoded[1], alternativeVersion }) !== ref) return undefined
  return { ref, caseRef, caseVersion, alternativeId: decoded[1], alternativeVersion }
}

async function compose(dependencies: SfAnalysisDependencies, human: ReturnType<typeof humanPortfolioSelection> & object, request: SfAnalysisRequest, call: TrustedDomainContext): Promise<PortfolioCompositionInput | undefined> {
  const current = await dependencies.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, call)
  if (current.status !== "ok" || current.value.case.id !== request.caseRef.id || current.value.case.incarnation !== request.caseRef.incarnation || current.value.case.version !== request.caseRef.version || !current.value.case.currency.trim() || current.value.case.horizon.start > current.value.case.horizon.end) return undefined
  const submitted = { scope: { horizon: current.value.case.horizon, currency: current.value.case.currency }, candidateRefs: human.candidateRefs, operations: human.operations, constraints: human.constraints, priorities: human.priorities, explorationLimit: human.explorationLimit }
  const decodedRequest = decodeSfOperationInput("sf_portfolio_evaluate", submitted)
  if (!decodedRequest.ok || !same(decodedRequest.value.operations, human.operations) || !decodedRequest.value.candidateRefs.length || new Set(decodedRequest.value.candidateRefs).size !== decodedRequest.value.candidateRefs.length) return undefined
  const resolveCandidate = createDecisionCandidateResolver(dependencies.cases)
  const rows = await Promise.all(decodedRequest.value.candidateRefs.map(async (ref) => {
    const parsed = parseCandidate(ref)
    if (!parsed) return undefined
    const resolved = await resolveCandidate(ref, call)
    if (resolved.status !== "ok" || !resolved.value.result || resolved.value.ref !== ref || resolved.value.caseRef !== encodeCaseRef(parsed.caseRef) || !resolved.value.operations.length || !same(resolved.value.operations, resolved.value.scenario.operations)) return undefined
    const source = await dependencies.cases.read({ caseRef: encodeCaseRef(parsed.caseRef) }, call)
    if (source.status !== "ok" || source.value.case.version !== parsed.caseVersion || source.value.case.currency !== current.value.case.currency || !same(source.value.case.horizon, current.value.case.horizon)) return undefined
    const alternative = source.value.case.alternatives.find((item) => item.id === parsed.alternativeId && item.version === parsed.alternativeVersion)
    if (!alternative || !same(alternative.result, resolved.value.result)) return undefined
    return { case: { id: parsed.caseRef.id, incarnation: parsed.caseRef.incarnation, version: parsed.caseVersion }, alternativeRef: ref, result: resolved.value.result, coverageRef: decisionCoverageRef(parsed.caseRef, parsed.alternativeId, parsed.alternativeVersion) }
  }))
  if (rows.some((row) => !row)) return undefined
  const selected = rows.filter((row): row is NonNullable<typeof row> => row !== undefined)
  const built: PortfolioCompositionInput = { request: decodedRequest.value, candidates: selected.map((row) => ({ case: row.case, alternativeRef: row.alternativeRef, result: row.result })), constraints: decodedRequest.value.constraints, costCoverageRefs: selected.map((row) => row.coverageRef) }
  const refs = selected.flatMap((row) => [...row.result.sourceRefs, ...row.result.costCoverage.evaluatedSourceRefs, ...row.result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]).filter((ref, index, all) => all.findIndex((item) => same(item, ref)) === index)
  const sources = await dependencies.context.context({ refs }, call)
  if (sources.length !== refs.length || sources.some((item, index) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef || !same(item.ref, refs[index]) || !same(item.currentRef, item.ref)) || !await dependencies.host.revalidate(call)) return undefined
  return built
}

export function createSfPortfolioInputProducer(dependencies: SfAnalysisDependencies): SfInputProducer {
  return {
    skillIds: ["sf-compor-portfolio"],
    prepare: async (selection, request, call) => {
      if (call.kind !== "ui") return { status: "denied", reason: "fresh-human-authority-required" }
      const human = humanPortfolioSelection(selection)
      if (!human || !request.caseRef.id.trim() || !request.caseRef.incarnation.trim() || !Number.isSafeInteger(request.caseRef.version)) return { status: "needs-input", reason: "invalid-analysis-input" }
      const first = await compose(dependencies, human, request, call)
      const second = await compose(dependencies, human, request, call)
      if (!first || !second || !same(first, second)) return { status: "unavailable", reason: "analysis-source-unavailable" }
      const decoded = decodeSfSkillInput("PortfolioCompositionInput", first)
      return decoded.ok ? { status: "ok", value: decoded.value } : { status: "unavailable", reason: "analysis-input-producer-unavailable" }
    },
  }
}
