import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { CommitmentReevaluationInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/skill-inputs.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { MaterialChangeEvent, MaterialCondition } from "../../../../modules/sucafina/Sucafinav1/product/decision-memory/materiality.ts"
import { classifySfMaterialChange } from "../../../../modules/sucafina/Sucafinav1/product/decision-memory/materiality.ts"
import type { createCollaborationHost } from "../../../../modules/sucafina/Sucafinav1/product/collaboration/host.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { SfAnalysisDependencies, SfAnalysisRequest } from "./analysis-verifier.ts"
import type { SfInputProducer } from "./input-producer-intent.ts"

function same(left: unknown, right: unknown) {
  return digestSfValue(left) === digestSfValue(right)
}

function humanReevaluationSelection(value: unknown): { choiceId: string; materialChangeIds: readonly string[]; confirmedDependencyRefIds: readonly string[] } | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const entries = Object.entries(value)
  if (entries.length !== 3 || entries.some(([key]) => key !== "choiceId" && key !== "materialChangeIds" && key !== "confirmedDependencyRefIds")) return undefined
  const choiceId = entries.find(([key]) => key === "choiceId")?.[1]
  const ids = entries.find(([key]) => key === "materialChangeIds")?.[1]
  const dependencyIds = entries.find(([key]) => key === "confirmedDependencyRefIds")?.[1]
  if (typeof choiceId !== "string" || !choiceId.trim() || !Array.isArray(ids) || !ids.length || ids.some((id) => typeof id !== "string" || !id.trim()) || new Set(ids).size !== ids.length || !Array.isArray(dependencyIds) || dependencyIds.some((id) => typeof id !== "string" || !id.trim()) || new Set(dependencyIds).size !== dependencyIds.length) return undefined
  return { choiceId, materialChangeIds: ids, confirmedDependencyRefIds: dependencyIds }
}

function linkedRefs(relations: Extract<Awaited<ReturnType<Pick<ReturnType<typeof createCollaborationHost>, "relations">["relations"]["readVersioned"]>>, { status: "ok" }>["value"], allowed: readonly BusinessEvidenceRef[], requested: readonly string[]) {
  const confirmed = requested.flatMap((id) => allowed.filter((ref) => ref.refId === id))
  if (confirmed.length !== requested.length) return undefined
  const covered = confirmed.every((ref) => relations.some((relation) => [relation.from, relation.to, ...relation.evidenceRefs].some((item) => same(item, ref))))
  return covered ? confirmed : undefined
}

async function compose(dependencies: SfAnalysisDependencies & {
  selectedMaterialChanges: (caseRef: SfAnalysisRequest["caseRef"], call: TrustedDomainContext) => Promise<PortResult<readonly { condition: MaterialCondition; change: MaterialChangeEvent }[]>>
  collaboration: Pick<ReturnType<typeof createCollaborationHost>, "relations">
}, human: ReturnType<typeof humanReevaluationSelection> & object, request: SfAnalysisRequest, call: TrustedDomainContext): Promise<CommitmentReevaluationInput | undefined> {
  const current = await dependencies.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, call)
  if (current.status !== "ok" || current.value.case.version !== request.caseRef.version) return undefined
  const original = current.value.case.choices.find((choice) => choice.id === human.choiceId)
  if (!original) return undefined
  const selected = await dependencies.selectedMaterialChanges(request.caseRef, call)
  if (selected.status !== "ok" || selected.value.length !== human.materialChangeIds.length || human.materialChangeIds.some((id) => !selected.value.some((item) => item.condition.id === id)) || selected.value.some((item) => !human.materialChangeIds.includes(item.condition.id) || !same(item.condition.choice, original))) return undefined
  const changes = selected.value.map((item) => classifySfMaterialChange(item.condition, item.change).impact)
  const after = selected.value.flatMap((item) => item.change.comparison ? [item.change.comparison.after] : [])
  if (!after.length || after.some((comparison) => !same(comparison, after[0])) || selected.value.some((item, index) => item.change.comparison ? !same(item.change.comparison.before, original.comparison) : item.change.availability !== "unavailable" || changes[index]?.state !== "unknown")) return undefined
  const currentComparison = after[0]!
  const actual = await dependencies.planner.compareScenarios({ scenarioRefs: [currentComparison.baselineResultRef, currentComparison.alternativeResultRef], criteria: original.criteria }, call)
  if (actual.status !== "ok" || !same(actual.value, currentComparison)) return undefined
  const relations = human.confirmedDependencyRefIds.length ? await dependencies.collaboration.relations.readVersioned(human.confirmedDependencyRefIds, call) : { status: "ok" as const, value: [] }
  if (relations.status !== "ok") return undefined
  const confirmedDependencyRefs = human.confirmedDependencyRefIds.length ? linkedRefs(relations.value, current.value.evidenceRefs, human.confirmedDependencyRefIds) : []
  if (!confirmedDependencyRefs) return undefined
  const refs = [...confirmedDependencyRefs, ...changes.flatMap((item) => [...item.chosen, ...item.current])].filter((ref, index, all) => all.findIndex((candidate) => same(candidate, ref)) === index)
  if (refs.some((ref) => !current.value.evidenceRefs.some((item) => same(item, ref)))) return undefined
  const sources = await dependencies.context.context({ refs }, call)
  if (sources.length !== refs.length || sources.some((item, index) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef || !same(item.ref, refs[index]) || !same(item.currentRef, item.ref)) || !await dependencies.host.revalidate(call)) return undefined
  return { changes, originalChoice: original, currentComparison, confirmedDependencyRefs }
}

export function createSfReevaluationInputProducer(dependencies: SfAnalysisDependencies & {
  selectedMaterialChanges: (caseRef: SfAnalysisRequest["caseRef"], call: TrustedDomainContext) => Promise<PortResult<readonly { condition: MaterialCondition; change: MaterialChangeEvent }[]>>
  collaboration: Pick<ReturnType<typeof createCollaborationHost>, "relations">
}): SfInputProducer {
  return {
    skillIds: ["sf-reavaliar-compromissos"],
    prepare: async (selection, request, call) => {
      if (call.kind !== "ui") return { status: "denied", reason: "fresh-human-authority-required" }
      const human = humanReevaluationSelection(selection)
      if (!human || !request.caseRef.id.trim() || !request.caseRef.incarnation.trim() || !Number.isSafeInteger(request.caseRef.version)) return { status: "needs-input", reason: "invalid-analysis-input" }
      const first = await compose(dependencies, human, request, call)
      const second = await compose(dependencies, human, request, call)
      if (!first || !second || !same(first, second)) return { status: "unavailable", reason: "analysis-source-unavailable" }
      const decoded = decodeSfSkillInput("CommitmentReevaluationInput", first)
      return decoded.ok ? { status: "ok", value: decoded.value } : { status: "unavailable", reason: "analysis-input-producer-unavailable" }
    },
  }
}
