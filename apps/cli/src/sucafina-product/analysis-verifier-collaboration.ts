import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createCollaborationHost } from "../../../../modules/sucafina/Sucafinav1/product/collaboration/host.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { SfAnalysisDependencies, SfAnalysisVerifier } from "./analysis-verifier.ts"

export function createSfQuestionVerifier(dependencies: SfAnalysisDependencies & {
  collaboration: Pick<ReturnType<typeof createCollaborationHost>, "relations" | "authority">
}): SfAnalysisVerifier {
  return {
    skillIds: ["sf-coordenar-perguntas"],
    verify: async (input, request, call) => {
      const decoded = decodeSfSkillInput("QuestionPlanningInput", input)
      if (!decoded.ok) return { status: "needs-input", reason: "invalid-analysis-input" }
      const value = decoded.value
      if (digestSfValue(value.case) !== digestSfValue(request.caseRef)) return { status: "needs-input", reason: "analysis-input-mismatch" }
      const read = async (currentCall: TrustedDomainContext) => {
        const current = await dependencies.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, currentCall)
        if (current.status !== "ok" || current.value.case.version !== request.caseRef.version) return undefined
        const pending = [...current.value.case.alternatives.flatMap((alternative) => alternative.result.costCoverage.entries), ...current.value.case.choices.flatMap((choice) => choice.costCoverage.entries)].filter((entry) => entry.status === "pending")
        if (value.unresolvedConditions.some((condition) => !pending.some((entry) => entry.categoryId === condition.category && entry.reason === condition.reason && entry.questionRef === condition.questionRef))) return undefined
        const refs = [...value.relations.flatMap((relation) => [relation.from, relation.to, ...relation.evidenceRefs]), ...value.unresolvedConditions.flatMap((condition) => condition.evidenceRefs)]
        if (refs.some((ref) => !current.value.evidenceRefs.some((item) => digestSfValue(item) === digestSfValue(ref)))) return undefined
        if (value.relations.length) {
          const actual = await dependencies.collaboration.relations.readVersioned(value.relations.flatMap((relation) => [relation.from.refId, relation.to.refId]), currentCall)
          if (actual.status !== "ok" || value.relations.some((relation) => !actual.value.some((item) => digestSfValue(item) === digestSfValue(relation)))) return undefined
        }
        const recipients = await Promise.all(value.authorizedDirectoryRefs.map((id) => dependencies.collaboration.authority.recipient(id, currentCall)))
        if (recipients.some((recipient, index) => !recipient || recipient.id !== value.authorizedDirectoryRefs[index])) return undefined
        const sources = await dependencies.context.context({ refs }, currentCall)
        if (sources.length !== refs.length || sources.some((item, index) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef || digestSfValue(item.ref) !== digestSfValue(refs[index]) || digestSfValue(item.currentRef) !== digestSfValue(item.ref)) || !await dependencies.host.revalidate(currentCall)) return undefined
        return { current: current.value.case, sources, refs }
      }
      const proof = await read(call)
      if (!proof) return { status: "unavailable", reason: "analysis-source-unavailable" }
      return { status: "ok", value: { current: proof.current, input: value, sources: proof.sources, acceptsOutput: async (output, currentCall) => {
        const current = await read(currentCall)
        if (!current || output.state !== "ready" || output.kind !== "QuestionProposal") return { status: "unavailable", reason: "analysis-output-unverified" }
        const question = output.payload
        if (question.caseRef !== encodeCaseRef(request.caseRef) || question.expectedCaseVersion !== request.caseRef.version || !question.question.trim() ||
          (question.criterionRef !== undefined && !current.current.criteria.some((criterion) => criterion.id === question.criterionRef)) ||
          (question.recipientRef !== undefined && !value.authorizedDirectoryRefs.includes(question.recipientRef)) ||
          digestSfValue(output.evidenceRefs) !== digestSfValue(question.evidenceRefs) || question.evidenceRefs.some((ref) => !current.refs.some((item) => digestSfValue(item) === digestSfValue(ref)))) return { status: "unavailable", reason: "analysis-output-unverified" }
        return { status: "ok", value: true }
      } } }
    },
  }
}
