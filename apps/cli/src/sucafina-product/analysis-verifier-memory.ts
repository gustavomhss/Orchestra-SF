import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { SfSkillInputMap } from "../../../../modules/sucafina/Sucafinav1/product/contracts/skill-inputs.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { createSfAtlasMemory, rankSfAtlasRecall } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/atlas-memory.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { SfAnalysisDependencies, SfAnalysisVerifier } from "./analysis-verifier.ts"

export function createSfDecisionMemoryVerifier(dependencies: SfAnalysisDependencies & {
  memory: Pick<ReturnType<typeof createSfAtlasMemory>, "recall">
  rankRecall: (input: SfSkillInputMap["DecisionRecallInput"], call: TrustedDomainContext) => ReturnType<typeof rankSfAtlasRecall>
  resolveMemoryRecord: (recordDigest: string, caseRef: SfSkillInputMap["DecisionRecallInput"]["currentCase"], call: TrustedDomainContext) => Promise<PortResult<{ memoryRecordRef: string }>>
}): SfAnalysisVerifier {
  return {
    skillIds: ["sf-consultar-memoria-decisoria"],
    verify: async (input, request, call) => {
      const decoded = decodeSfSkillInput("DecisionRecallInput", input)
      if (!decoded.ok) return { status: "needs-input", reason: "invalid-analysis-input" }
      const value = decoded.value
      if (digestSfValue(value.currentCase) !== digestSfValue(request.caseRef) || value.query !== request.objective || !value.query.trim() || !value.recallScope.cases.length || new Set(value.recallScope.cases.map((ref) => encodeCaseRef(ref))).size !== value.recallScope.cases.length) return { status: "needs-input", reason: "analysis-input-mismatch" }
      if (value.recallScope.includeHistorical) return { status: "unavailable", reason: "historical-memory-unavailable" }
      const read = async (currentCall: TrustedDomainContext) => {
        const current = await dependencies.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, currentCall)
        if (current.status !== "ok" || current.value.case.version !== request.caseRef.version) return undefined
        const reads = await Promise.all(value.recallScope.cases.map((ref) => dependencies.memory.recall(ref, currentCall)))
        if (reads.some((item) => item.status !== "ok")) return undefined
        const records = reads.flatMap((item) => item.status === "ok" ? item.records : [])
        if (records.some((record) => !record.envelope.caseRef || !value.recallScope.cases.some((ref) => digestSfValue(ref) === digestSfValue(record.envelope.caseRef)) || record.case.case.horizon.end < value.recallScope.period.start || record.case.case.horizon.start > value.recallScope.period.end)) return undefined
        const ranked = await dependencies.rankRecall(value, currentCall)
        if (ranked.status !== "ok" || ranked.cases.some((item) => !records.some((record) => digestSfValue(record.envelope.caseRef) === digestSfValue(item.candidateCaseRef) && record.recordDigest === item.atlasTrace.recordDigest && JSON.stringify(record.entry).toLowerCase().includes(value.query.trim().toLowerCase()))) || !await dependencies.host.revalidate(currentCall)) return undefined
        const sources = records.flatMap((record) => record.resolutions).filter((item, index, all) => all.findIndex((other) => digestSfValue(other.ref) === digestSfValue(item.ref)) === index)
        if (sources.some((item) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef || digestSfValue(item.ref) !== digestSfValue(item.currentRef))) return undefined
        return { current: current.value.case, sources, records, ranked: ranked.cases }
      }
      const proof = await read(call)
      if (!proof) return { status: "unavailable", reason: "analysis-source-unavailable" }
      return { status: "ok", value: { current: proof.current, input: value, sources: proof.sources, acceptsOutput: async (output, currentCall) => {
        if (output.state !== "ready" || output.kind !== "MatchExplanation" && output.kind !== "CaseRecall") return { status: "unavailable", reason: "analysis-output-unverified" }
        const current = await read(currentCall)
        if (!current || digestSfValue(current.ranked) !== digestSfValue(proof.ranked)) return { status: "unavailable", reason: "analysis-output-unverified" }
        if (output.kind === "CaseRecall") {
          const matches = await Promise.all(current.ranked.map(async (item) => {
            const record = current.records.find((candidate) => candidate.recordDigest === item.atlasTrace.recordDigest && digestSfValue(candidate.envelope.caseRef) === digestSfValue(item.candidateCaseRef))
            if (!record || item.atlasTrace.operation !== "createMemoryRead.recall") return undefined
            const resolved = await dependencies.resolveMemoryRecord(record.recordDigest, item.candidateCaseRef, currentCall)
            if (resolved.status !== "ok" || !resolved.value.memoryRecordRef.trim()) return undefined
            return { item, record, memoryRecordRef: resolved.value.memoryRecordRef }
          }))
          if (matches.some((match) => !match)) return { status: "unavailable", reason: "analysis-output-unverified" }
          const expectedMatches = matches.flatMap((match) => match ? [{ caseRef: match.item.candidateCaseRef, memoryRecordRef: match.memoryRecordRef,
            explanation: { candidateCaseRef: match.item.candidateCaseRef, matchedCriteria: match.item.matchedCriteria, currentDifferences: match.item.currentDifferences, sourceStates: match.item.sourceStates, limitations: match.item.limitations }, evidenceRefs: match.record.envelope.evidenceRefs }] : [])
          const limitations = [...new Set(current.ranked.flatMap((item) => item.limitations))]
          const evidenceRefs = [...new Map(matches.flatMap((match) => match ? match.record.envelope.evidenceRefs : []).map((ref) => [digestSfValue(ref), ref])).values()]
          const again = await read(currentCall)
          if (!again || digestSfValue(again.ranked) !== digestSfValue(current.ranked) || digestSfValue(again.records.map((record) => record.recordDigest)) !== digestSfValue(current.records.map((record) => record.recordDigest))) return { status: "unavailable", reason: "analysis-output-unverified" }
          return digestSfValue(output.payload.matches) === digestSfValue(expectedMatches) && digestSfValue(output.payload.limitations) === digestSfValue(limitations) &&
            output.payload.accessRevision === currentCall.binding.accessRevision && digestSfValue(output.evidenceRefs) === digestSfValue(evidenceRefs) && await dependencies.host.revalidate(currentCall)
            ? { status: "ok", value: true } : { status: "unavailable", reason: "analysis-output-unverified" }
        }
        const explanation = output.payload
        const match = current.ranked.find((item) => digestSfValue(item.candidateCaseRef) === digestSfValue(explanation.candidateCaseRef))
        const record = match && current.records.find((item) => item.recordDigest === match.atlasTrace.recordDigest && digestSfValue(item.envelope.caseRef) === digestSfValue(match.candidateCaseRef))
        if (!match || !record || match.atlasTrace.operation !== "createMemoryRead.recall") return { status: "unavailable", reason: "analysis-output-unverified" }
        const expected = { candidateCaseRef: match.candidateCaseRef, matchedCriteria: match.matchedCriteria, currentDifferences: match.currentDifferences, sourceStates: match.sourceStates, limitations: match.limitations }
        return digestSfValue(expected) === digestSfValue(explanation) && digestSfValue(output.evidenceRefs) === digestSfValue(record.envelope.evidenceRefs)
          ? { status: "ok", value: true } : { status: "unavailable", reason: "analysis-output-unverified" }
      } } }
    },
  }
}
