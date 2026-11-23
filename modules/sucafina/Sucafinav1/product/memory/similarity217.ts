/**
 * S1-R1-207-001 / WP14.T02,T05 / A14 / U26.
 * A server-side projection of the EXISTING CaseRecall + C09/C17 authority.
 * No Atlas store access, private selector, local rank, fake result, or new ACL.
 * The HTTP binding must retain the original Request and current UI admission.
 */
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DecisionCasePort, DomainPortHost } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { encodeCaseRef } from "../decisions/case-port.ts"
import type { createSfCaseRecall } from "../decision-memory/case-recall.ts"

export type SfSimilarity217Case = Readonly<{ id: string; incarnation: string; version: number }>
export type SfSimilarity217Period = Readonly<{ start: string; end: string }>
export type SfSimilarity217Request = Readonly<{
  caseId: string
  incarnation: string
  version: number
  query: string
  period: SfSimilarity217Period
  includeHistorical: boolean
  candidates: readonly SfSimilarity217Case[]
}>

type Dependencies = Readonly<{
  caseRecall: ReturnType<typeof createSfCaseRecall>
  cases: Pick<DecisionCasePort, "read">
  context: Pick<BusinessContextService, "context">
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
}>
const validVersion = (v: number) => Number.isSafeInteger(v) && v > 0
const validCase = (ref: SfSimilarity217Case) =>
  typeof ref.id === "string" && !!ref.id.trim() &&
  typeof ref.incarnation === "string" && !!ref.incarnation.trim() && validVersion(ref.version)
const validPeriod = (p: SfSimilarity217Period) =>
  !!p && /^\d{4}-\d{2}-\d{2}$/.test(p.start) && /^\d{4}-\d{2}-\d{2}$/.test(p.end) &&
  !Number.isNaN(Date.parse(p.start)) && !Number.isNaN(Date.parse(p.end)) && p.start <= p.end
const identity = (ref: SfSimilarity217Case) => JSON.stringify([ref.id, ref.incarnation, ref.version])
const same = (a: unknown, b: unknown) => digestSfValue(a) === digestSfValue(b)

function allowedSource(source: Awaited<ReturnType<BusinessContextService["resolve"]>>,
  expected: BusinessEvidenceRef, call: TrustedDomainContext, historical: boolean) {
  if (source.accessRevision !== call.binding.accessRevision ||
    !source.authorizedProjection || !source.currentRef || !same(source.ref, expected)) return false
  for (const ref of [source.ref, source.currentRef]) {
    if (ref.installationId !== call.binding.installationId || ref.projectId !== call.binding.projectId ||
      digestSfEvidenceRef(ref) !== ref.refDigest) return false
  }
  return source.state === "fresh" ? same(source.currentRef, source.ref)
    : historical && source.state === "historical" && Array.isArray(source.differences)
}

/**
 * The original selected candidate set is explicit and versioned. A hit is
 * admissible only if its real Atlas record and all C17 evidence remain visible
 * at egress. Any revoked/replaced/missing source suppresses the WHOLE response,
 * including match counts, reasons and field differences.
 */
export function createSfSimilarCases217(deps: Dependencies) {
  return async (input: SfSimilarity217Request, call: TrustedDomainContext) => {
    console.info("SF_DESIGN_STAGE recall-similarity-start")
    if (call.kind !== "ui") return { status: "denied" as const, reason: "similarity-current-ui-authority-required" }
    const ref = { id: input.caseId, incarnation: input.incarnation, version: input.version }
    const candidates = input.candidates
    if (!validCase(ref) || typeof input.query !== "string" || !input.query.trim() ||
      !validPeriod(input.period) || typeof input.includeHistorical !== "boolean" ||
      !Array.isArray(candidates) || candidates.length > 50 || candidates.some((item) => !validCase(item)) ||
      new Set(candidates.map(identity)).size !== candidates.length ||
      candidates.some((item) => item.id === ref.id && item.incarnation === ref.incarnation))
      return { status: "needs-input" as const, reason: "invalid-similar-cases-selection" }
    const request = deps.host.requestFor(call)
    if (!request || request.signal.aborted || !await deps.host.revalidate(call))
      return { status: "denied" as const, reason: "similarity-authority-unavailable" }
    const captured = digestSfValue(input)
    const binding = digestSfValue([call.kind, call.binding])
    const current = () => !request.signal.aborted && deps.host.requestFor(call) === request &&
      captured === digestSfValue(input) && binding === digestSfValue([call.kind, call.binding])
    try {
      console.info("SF_DESIGN_STAGE recall-similarity-source-start")
      const original = await deps.cases.read({ caseRef: encodeCaseRef(ref) }, call)
      console.info(original.status === "ok" ? "SF_DESIGN_STAGE recall-similarity-source-ok" : "SF_DESIGN_STAGE recall-similarity-source-unavailable")
      if (original.status !== "ok" || original.value.case.version !== ref.version ||
        !same(original.value.case.horizon, input.period) || !current())
        return { status: "denied" as const, reason: "similarity-current-case-unavailable" }
      const recallInput = {
        caseRef: ref,
        limit: 50,
        scope: { query: input.query, recallScope: { cases: candidates, period: input.period, includeHistorical: input.includeHistorical } },
      }
      // Original C09 case read + real Atlas memory rank/retrace. No local rank.
      console.info("SF_DESIGN_STAGE recall-similarity-first-start")
      const first = await deps.caseRecall(recallInput, call)
      console.info(first.status === "ok" ? "SF_DESIGN_STAGE recall-similarity-first-ok" : "SF_DESIGN_STAGE recall-similarity-first-unavailable")
      if (first.status !== "ok" || first.accessRevision !== call.binding.accessRevision || !current()) {
        console.info("SF_DESIGN_STAGE recall-similarity-first-refused")
        return { status: "unavailable" as const, reason: "similarity-source-unavailable" }
      }
      const dedup = new Map<string, (typeof first.matches)[number]>()
      for (const match of first.matches) {
        if (!candidates.some((item) => same(item, match.caseRef)) ||
          !same(match.caseRef, match.explanation.candidateCaseRef) ||
          !match.memoryRecordRef || !match.evidenceRefs.length ||
          !match.explanation.matchedCriteria.includes("decision-type") ||
          !input.includeHistorical && match.explanation.sourceStates.includes("historical")) {
          console.info("SF_DESIGN_STAGE recall-similarity-match-refused")
          return { status: "unavailable" as const, reason: "similarity-source-unavailable" }
        }
        const key = JSON.stringify([identity(match.caseRef), match.memoryRecordRef])
        const previous = dedup.get(key)
        if (previous && !same(previous, match))
          return { status: "unavailable" as const, reason: "similarity-collision" }
        if (!previous) dedup.set(key, match)
      }
      const matches = [...dedup.values()]
      const refs = [...new Map(matches.flatMap((m) => m.evidenceRefs).map((e) => [e.refDigest, e])).values()]
      // All matches have the same original current-access scope; no public Atlas dump.
      console.info("SF_DESIGN_STAGE recall-similarity-evidence-start")
      const sources = await deps.context.context({ refs }, call)
      console.info("SF_DESIGN_STAGE recall-similarity-evidence-end")
      if (sources.length !== refs.length || sources.some((source, index) =>
        !allowedSource(source, refs[index]!, call, input.includeHistorical)))
        return { status: "denied" as const, reason: "similarity-source-revoked" }
      console.info("SF_DESIGN_STAGE recall-similarity-second-start")
      const second = await deps.caseRecall(recallInput, call)
      console.info(second.status === "ok" ? "SF_DESIGN_STAGE recall-similarity-second-ok" : "SF_DESIGN_STAGE recall-similarity-second-unavailable")
      const again = await deps.cases.read({ caseRef: encodeCaseRef(ref) }, call)
      if (second.status !== "ok" || second.accessRevision !== first.accessRevision ||
        !same(second.matches, first.matches) || !same(second.limitations, first.limitations) ||
        again.status !== "ok" || !same(again.value.case, original.value.case) ||
        !same(again.value.evidenceRefs, original.value.evidenceRefs) ||
        !current() || !await deps.host.revalidate(call) || !current())
        return { status: "unavailable" as const, reason: "similarity-scope-changed" }
      console.info("SF_DESIGN_STAGE recall-similarity-ok")
      return {
        status: "ok" as const, matches,
        limitations: first.limitations, accessRevision: first.accessRevision,
        cutoff: { caseRef: ref, period: input.period, includeHistorical: input.includeHistorical },
      }
    } catch {
      console.info("SF_DESIGN_STAGE recall-similarity-caught")
      return { status: "unavailable" as const, reason: "similarity-source-unavailable" }
    }
  }
}
