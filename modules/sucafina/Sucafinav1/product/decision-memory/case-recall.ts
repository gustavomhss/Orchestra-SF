import { digestSfValue } from "../contracts/canonical.ts"
import { encodeCaseRef } from "../decisions/case-port.ts"
import type { AuthorizedCaseProjection } from "../contracts/business-context.ts"
import type { DecisionCasePort, DomainPortHost } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createSfAtlasMemory, rankSfAtlasRecall } from "../host-binding/atlas-memory.ts"
import type { DecisionRecallInput } from "../contracts/skill-inputs.ts"
import type { RecallFeatures } from "./recall.ts"

type CaseRef = { id: string; incarnation: string }
type ScopedRecall = Pick<DecisionRecallInput, "query" | "recallScope">
type RankInput = Parameters<typeof rankSfAtlasRecall>[0]

/** Host callbacks select candidates under business authority; case IDs alone never grant access. */
export function createSfCaseRecall(input: {
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  cases: DecisionCasePort
  memory: ReturnType<typeof createSfAtlasMemory>
  selectCandidates: (source: AuthorizedCaseProjection, call: TrustedDomainContext, scope?: ScopedRecall) => Promise<readonly CaseRef[] | undefined>
  featuresForCase: (value: AuthorizedCaseProjection, call: TrustedDomainContext) => Promise<RecallFeatures | undefined>
  runtimeVersions: RankInput["runtimeVersions"]
  proveContinuity: RankInput["proveContinuity"]
  rank: typeof rankSfAtlasRecall
}) {
  return async (request: { caseRef: CaseRef & { version?: number }; limit: number; scope?: ScopedRecall }, call: TrustedDomainContext) => {
    try {
      const wanted = structuredClone(request)
      const requestDigest = digestSfValue(wanted)
      const source = input.host.requestFor(call)
      const binding = digestSfValue([call.kind, call.binding])
      if (!source || source.signal.aborted || !wanted.caseRef.id || !wanted.caseRef.incarnation || !Number.isSafeInteger(wanted.limit) || wanted.limit < 1 || wanted.limit > 50 || !await input.host.revalidate(call)) return { status: "unavailable" as const }
      const read = async () => {
        const current = await input.cases.read({ caseRef: encodeCaseRef(wanted.caseRef) }, call)
        if (current.status !== "ok" || current.value.case.id !== wanted.caseRef.id || current.value.case.incarnation !== wanted.caseRef.incarnation || (wanted.caseRef.version !== undefined && current.value.case.version !== wanted.caseRef.version)) return undefined
        if (wanted.scope && (!wanted.scope.query.trim() || digestSfValue(wanted.scope.recallScope.period) !== digestSfValue(current.value.case.horizon))) return undefined
        const features = await input.featuresForCase(current.value, call)
        const refs = await input.selectCandidates(current.value, call, wanted.scope)
        if (!features || !refs || refs.some((ref) => !ref.id || !ref.incarnation) || new Set(refs.map((ref) => JSON.stringify([ref.id, ref.incarnation]))).size !== refs.length) return undefined
        for (const ref of refs) {
          const candidate = await input.cases.read({ caseRef: encodeCaseRef(ref) }, call)
          if (candidate.status !== "ok" || candidate.value.case.id !== ref.id || candidate.value.case.incarnation !== ref.incarnation) return undefined
          if (wanted.scope && !wanted.scope.recallScope.cases.some((allowed) => allowed.id === ref.id && allowed.incarnation === ref.incarnation && allowed.version === candidate.value.case.version)) return undefined
        }
        return { case: current.value.case, context: current.value.context, evidenceRefs: current.value.evidenceRefs, events: current.value.events, features, refs }
      }
      const selected = await read()
      if (!selected || source.signal.aborted || !await input.host.revalidate(call)) return { status: "unavailable" as const }
      const rankInput: RankInput = { memory: input.memory, caseRefs: selected.refs, features: selected.features, featuresForCase: input.featuresForCase, runtimeVersions: input.runtimeVersions, call, proveContinuity: input.proveContinuity, revalidate: input.host.revalidate }
      const ranked = await input.rank(rankInput)
      if (ranked.status !== "ok") return { status: "unavailable" as const }
      const eligible = ranked.cases.filter((item) => wanted.scope?.recallScope.includeHistorical !== false || !item.sourceStates.includes("historical"))
      if (wanted.scope && eligible.length > wanted.limit) return { status: "unavailable" as const }
      const matches = []
      for (const match of eligible.slice(0, wanted.limit)) {
        if (!selected.refs.some((ref) => ref.id === match.candidateCaseRef.id && ref.incarnation === match.candidateCaseRef.incarnation)) return { status: "unavailable" as const }
        const recalled = await input.memory.recall(match.candidateCaseRef, call)
        if (recalled.status !== "ok") return { status: "unavailable" as const }
        const records = recalled.records.filter((record) => record.recordDigest === match.atlasTrace.recordDigest)
        if (records.length !== 1) return { status: "unavailable" as const }
        matches.push({ caseRef: match.candidateCaseRef, memoryRecordRef: records[0]!.envelope.eventId, explanation: { candidateCaseRef: match.candidateCaseRef, matchedCriteria: match.matchedCriteria, currentDifferences: match.currentDifferences, sourceStates: match.sourceStates, limitations: match.limitations }, evidenceRefs: records[0]!.envelope.evidenceRefs })
      }
      const checked = await input.rank(rankInput)
      const again = await read()
      if (checked.status !== "ok" || digestSfValue(checked.cases) !== digestSfValue(ranked.cases) || !again || digestSfValue(again) !== digestSfValue(selected) || source.signal.aborted || digestSfValue([call.kind, call.binding]) !== binding || digestSfValue(wanted) !== requestDigest || !await input.host.revalidate(call)) return { status: "unavailable" as const }
      return { status: "ok" as const, matches, limitations: [...new Set(matches.flatMap((item) => item.explanation.limitations))], accessRevision: call.binding.accessRevision }
    } catch {
      return { status: "unavailable" as const }
    }
  }
}
