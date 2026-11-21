import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { MaterialChangeEvent, MaterialCondition } from "../../../../modules/sucafina/Sucafinav1/product/decision-memory/materiality.ts"
import { classifySfMaterialChange } from "../../../../modules/sucafina/Sucafinav1/product/decision-memory/materiality.ts"
import type { createCollaborationHost } from "../../../../modules/sucafina/Sucafinav1/product/collaboration/host.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { SfAnalysisDependencies, SfAnalysisRequest, SfAnalysisVerifier } from "./analysis-verifier.ts"
import { readSfDependencyComposition, sfDeclaredConstraintConditions, sfDependencyHumanSelection } from "./analysis-dependency-readers.ts"
import type { SfDependencyBindings } from "./analysis-dependency-readers.ts"

export function createSfCommitmentReevaluationVerifier(dependencies: SfAnalysisDependencies & {
  selectedMaterialChanges: (caseRef: SfAnalysisRequest["caseRef"], call: TrustedDomainContext) => Promise<PortResult<readonly { condition: MaterialCondition; change: MaterialChangeEvent }[]>>
  collaboration: Pick<ReturnType<typeof createCollaborationHost>, "relations">
}): SfAnalysisVerifier {
  return {
    skillIds: ["sf-reavaliar-compromissos"],
    verify: async (input, request, call) => {
      const decoded = decodeSfSkillInput("CommitmentReevaluationInput", input)
      if (!decoded.ok) return { status: "needs-input", reason: "invalid-analysis-input" }
      const value = decoded.value
      const read = async (currentCall: TrustedDomainContext) => {
        const current = await dependencies.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, currentCall)
        if (current.status !== "ok" || current.value.case.version !== request.caseRef.version) return undefined
        const original = current.value.case.choices.find((choice) => choice.id === value.originalChoice.id)
        if (!original || digestSfValue(original) !== digestSfValue(value.originalChoice)) return undefined
        const selected = await dependencies.selectedMaterialChanges(request.caseRef, currentCall)
        if (selected.status !== "ok" || !selected.value.length || selected.value.some((item) => digestSfValue(item.condition.choice) !== digestSfValue(original))) return undefined
        const classified = selected.value.map((item) => classifySfMaterialChange(item.condition, item.change).impact)
        if (digestSfValue(classified) !== digestSfValue(value.changes) || selected.value.some((item, index) => item.change.comparison ? digestSfValue(item.change.comparison.before) !== digestSfValue(original.comparison) || digestSfValue(item.change.comparison.after) !== digestSfValue(value.currentComparison) : item.change.availability !== "unavailable" || classified[index]?.state !== "unknown")) return undefined
        const actual = await dependencies.planner.compareScenarios({ scenarioRefs: [value.currentComparison.baselineResultRef, value.currentComparison.alternativeResultRef], criteria: original.criteria }, currentCall)
        if (actual.status !== "ok" || digestSfValue(actual.value) !== digestSfValue(value.currentComparison)) return undefined
        if (value.confirmedDependencyRefs.length) {
          const relations = await dependencies.collaboration.relations.readVersioned(value.confirmedDependencyRefs.map((ref) => ref.refId), currentCall)
          if (relations.status !== "ok" || value.confirmedDependencyRefs.some((ref) => !relations.value.some((relation) => [relation.from, relation.to, ...relation.evidenceRefs].some((item) => digestSfValue(item) === digestSfValue(ref))))) return undefined
        }
        const refs = [...new Map([...value.confirmedDependencyRefs, ...value.changes.flatMap((item) => [...item.chosen, ...item.current])].map((ref) => [digestSfValue(ref), ref])).values()]
        if (refs.some((ref) => !current.value.evidenceRefs.some((item) => digestSfValue(item) === digestSfValue(ref)))) return undefined
        const sources = await dependencies.context.context({ refs }, currentCall)
        if (sources.length !== refs.length || sources.some((item, index) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef || digestSfValue(item.ref) !== digestSfValue(refs[index]) || digestSfValue(item.currentRef) !== digestSfValue(item.ref)) || !await dependencies.host.revalidate(currentCall)) return undefined
        return { current: current.value.case, original, selected: selected.value, impacts: classified, comparison: actual.value, refs, sources }
      }
      const proof = await read(call)
      if (!proof) return { status: "unavailable", reason: "analysis-source-unavailable" }
      return { status: "ok", value: { current: proof.current, input: value, sources: proof.sources, acceptsOutput: async (output, currentCall) => {
        const fresh = await read(currentCall)
        if (!fresh || digestSfValue(fresh.selected) !== digestSfValue(proof.selected) || output.state !== "ready" || output.kind !== "ReconsiderationProposal") return { status: "unavailable", reason: "analysis-output-unverified" }
        const proposal = output.payload
        const affected = fresh.selected.filter((_item, index) => fresh.impacts[index]?.state === "material" || fresh.impacts[index]?.state === "unknown").map((item) => item.condition.id)
        const evidenceRefs = [...new Map(fresh.refs.map((ref) => [digestSfValue(ref), ref])).values()]
        if (proposal.caseRef !== encodeCaseRef(request.caseRef) || proposal.choiceRef !== fresh.original.id || digestSfValue(proposal.impacts) !== digestSfValue(fresh.impacts) || digestSfValue(proposal.affectedConditionRefs) !== digestSfValue(affected) || proposal.choiceChanged !== false || proposal.beforeResultRef !== fresh.original.comparison.alternativeResultRef || proposal.currentResultRef !== fresh.comparison.alternativeResultRef || digestSfValue(proposal.evidenceRefs) !== digestSfValue(evidenceRefs) || digestSfValue(output.evidenceRefs) !== digestSfValue(evidenceRefs)) return { status: "unavailable", reason: "analysis-output-unverified" }
        return { status: "ok", value: true }
      } } }
    },
  }
}

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
        const missing = [...current.value.case.alternatives.flatMap((alternative) => alternative.result.costCoverage.derivedMissingCategoryIds), ...current.value.case.choices.flatMap((choice) => choice.costCoverage.derivedMissingCategoryIds)]
        if (value.unresolvedConditions.some((condition) => !pending.some((entry) => entry.categoryId === condition.category && entry.reason === condition.reason && entry.questionRef === condition.questionRef) && !(condition.reason === "missing-required-cost-category" && missing.includes(condition.category) && !condition.questionRef && !condition.evidenceRefs.length))) return undefined
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

export function createSfDependencyVerifier(dependencies: SfAnalysisDependencies & SfDependencyBindings): SfAnalysisVerifier {
  return {
    skillIds: ["sf-revisar-dependencias"],
    verify: async (input, request, call) => {
      const decoded = decodeSfSkillInput("DependencyReviewInput", input)
      if (!decoded.ok) return { status: "needs-input", reason: "invalid-analysis-input" }
      const value = decoded.value
      const read = async (currentCall: TrustedDomainContext) => {
        const selected = dependencies.readHumanSelection ? await dependencies.readHumanSelection(request.caseRef, "sf-revisar-dependencias", currentCall) : undefined
        const human = selected?.status === "ok" ? sfDependencyHumanSelection(selected.value.selection) :
          !dependencies.readHumanSelection && !value.commitments.length && !value.milestones.length && !value.declaredConstraints.length
            ? { relationRefIds: [...new Set(value.relations.flatMap((relation) => [relation.from.refId, relation.to.refId]))], commitmentIds: [], milestoneIds: [], declaredConstraints: [] } : undefined
        if (!human) return undefined
        const actual = await readSfDependencyComposition(dependencies, human, request, currentCall)
        return actual && digestSfValue(actual.input) === digestSfValue(value) ? actual : undefined
      }
      const proof = await read(call)
      if (!proof) return { status: "unavailable", reason: "analysis-source-unavailable" }
      return { status: "ok", value: { current: proof.current, input: value, sources: proof.sources, acceptsOutput: async (output, currentCall) => {
        if (output.state !== "ready" || (output.kind !== "DeliveryAssessment" && output.kind !== "DependencyConflict")) return { status: "unavailable", reason: "analysis-output-unverified" }
        const current = await read(currentCall)
        if (!current) return { status: "unavailable", reason: "analysis-output-unverified" }
        if (output.kind === "DependencyConflict") {
          const conflict = output.payload
          const relations = current.input.relations.filter((relation) => relation.state === "confirmed" && relation.from.refId === conflict.fromRef && relation.to.refId === conflict.toRef)
          if (conflict.state !== "needs-input" || relations.length !== 1) return { status: "unavailable", reason: "analysis-output-unverified" }
          const relation = relations[0]!
          const refs = [...relation.evidenceRefs, relation.from, relation.to].filter((ref, index, all) => all.findIndex((other) => digestSfValue(other) === digestSfValue(ref)) === index)
          const declaration = sfDeclaredConstraintConditions(current.input.declaredConstraints).find((condition) => condition.id === conflict.constraintRef)
          const milestones = current.input.milestones.filter((milestone) => {
            const identity = /^milestone:([^:]+):([^:]+)$/.exec(milestone.id)
            if (milestone.id !== conflict.constraintRef || !identity || !refs.some((ref) => digestSfValue(ref) === digestSfValue(milestone.projectRef))) return false
            // The selected page can carry multiple projects; only the relation's exact project endpoint is pertinent.
            return [relation.from, relation.to].some((ref) => ref.kind === "record" && ref.target.surface === "dashboard" && ref.target.recordType === "projects" && ref.target.recordId === decodeURIComponent(identity[1]!))
          })
          // C09 commitments carry identities and evidence, not a required delivery date or available capacity.
          // This branch can prove the missing constraint, but cannot upgrade it to a factual conflict.
          const reason = declaration?.reason ?? (milestones.length === 1
            ? `Unverified dependency constraint for selected milestone ${milestones[0]!.id} at ${milestones[0]!.at} (${milestones[0]!.state}); required delivery date or capacity rule is unavailable`
            : undefined)
          if (!reason || conflict.reason !== reason || digestSfValue(conflict.evidenceRefs) !== digestSfValue(refs) || digestSfValue(output.evidenceRefs) !== digestSfValue(refs)) return { status: "unavailable", reason: "analysis-output-unverified" }
          return { status: "ok", value: true }
        }
        const assessment = output.payload
        const missing = current.current.alternatives.filter((item) => assessment.candidateRefs.includes(item.id)).flatMap((item) => item.result.costCoverage.derivedMissingCategoryIds)
        const declarations = sfDeclaredConstraintConditions(value.declaredConstraints)
        const declared = assessment.unresolvedConditions.filter((condition) => condition.category === "human-declared-constraint")
        const unresolved = assessment.unresolvedConditions.filter((condition) => condition.category !== "human-declared-constraint")
        if (assessment.caseRef !== encodeCaseRef(request.caseRef) || !assessment.candidateRefs.length || new Set(assessment.candidateRefs).size !== assessment.candidateRefs.length || new Set(value.relations.map((relation) => relation.id)).size !== value.relations.length || assessment.candidateRefs.some((id) => !current.current.alternatives.some((item) => item.id === id)) || digestSfValue(assessment.capacityConstraints) !== digestSfValue(value.declaredConstraints) || digestSfValue(declared) !== digestSfValue(declarations) ||
          assessment.dependencies.length !== value.relations.length || assessment.dependencies.some((dependency) => dependency.state !== "confirmed" || !value.relations.some((relation) => relation.from.refId === dependency.fromRef && relation.to.refId === dependency.toRef && digestSfValue(relation.evidenceRefs) === digestSfValue(dependency.sourceRefs))) ||
          value.relations.some((relation) => !assessment.dependencies.some((dependency) => dependency.fromRef === relation.from.refId && dependency.toRef === relation.to.refId && digestSfValue(dependency.sourceRefs) === digestSfValue(relation.evidenceRefs))) ||
          missing.some((category) => !unresolved.some((condition) => condition.category === category)) ||
          unresolved.some((condition) => !condition.reason.trim() || !missing.includes(condition.category) || condition.evidenceRefs.some((ref) => !current.refs.some((item) => digestSfValue(item) === digestSfValue(ref)))) ||
          output.evidenceRefs.some((ref) => !current.refs.some((item) => digestSfValue(item) === digestSfValue(ref))) || current.refs.some((ref) => !output.evidenceRefs.some((item) => digestSfValue(item) === digestSfValue(ref)))) return { status: "unavailable", reason: "analysis-output-unverified" }
        return { status: "ok", value: true }
      } } }
    },
  }
}
