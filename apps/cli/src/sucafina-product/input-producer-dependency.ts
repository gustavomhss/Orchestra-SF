import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DependencyReviewInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/skill-inputs.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createCollaborationHost } from "../../../../modules/sucafina/Sucafinav1/product/collaboration/host.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { SfAnalysisDependencies, SfAnalysisRequest } from "./analysis-verifier.ts"
import type { SfInputProducer } from "./input-producer-intent.ts"

type Relations = Pick<ReturnType<typeof createCollaborationHost>, "relations">

function same(left: unknown, right: unknown) {
  return digestSfValue(left) === digestSfValue(right)
}

function ids(value: unknown): readonly string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim().length > 0) && new Set(value).size === value.length ? value : undefined
}

function humanDependencySelection(value: unknown): { relationRefIds: readonly string[]; commitmentIds: readonly string[]; milestoneIds: readonly string[]; declaredConstraints: readonly string[] } | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const entries = Object.entries(value)
  if (entries.length !== 4 || entries.some(([key]) => key !== "relationRefIds" && key !== "commitmentIds" && key !== "milestoneIds" && key !== "declaredConstraints")) return undefined
  const relationRefIds = ids(entries.find(([key]) => key === "relationRefIds")?.[1])
  const commitmentIds = ids(entries.find(([key]) => key === "commitmentIds")?.[1])
  const milestoneIds = ids(entries.find(([key]) => key === "milestoneIds")?.[1])
  const declaredConstraints = ids(entries.find(([key]) => key === "declaredConstraints")?.[1])
  if (!relationRefIds || !commitmentIds || !milestoneIds || !declaredConstraints) return undefined
  return { relationRefIds, commitmentIds, milestoneIds, declaredConstraints }
}

function onCase(refs: readonly BusinessEvidenceRef[], allowed: readonly BusinessEvidenceRef[]) {
  return refs.every((ref) => allowed.some((item) => same(item, ref)))
}

async function loadRelations(collaboration: Relations, relationRefIds: readonly string[], allowed: readonly BusinessEvidenceRef[], call: TrustedDomainContext) {
  if (!relationRefIds.length) return { status: "ok" as const, value: [] as DependencyReviewInput["relations"] }
  const read = await collaboration.relations.readVersioned(relationRefIds, call)
  if (read.status !== "ok") return read
  const relations = read.value.filter((relation, index) => read.value.findIndex((item) => same(item, relation)) === index)
  const endpoints = relations.flatMap((relation) => [relation.from.refId, relation.to.refId])
  const refs = relations.flatMap((relation) => [relation.from, relation.to, ...relation.evidenceRefs])
  if (relationRefIds.some((id) => !endpoints.includes(id)) || !onCase(refs, allowed)) return { status: "unavailable" as const, reason: "analysis-source-unavailable" }
  return { status: "ok" as const, value: relations }
}

async function compose(dependencies: SfAnalysisDependencies & { collaboration: Relations }, human: ReturnType<typeof humanDependencySelection> & object, request: SfAnalysisRequest, call: TrustedDomainContext): Promise<DependencyReviewInput | undefined> {
  const current = await dependencies.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, call)
  if (current.status !== "ok" || current.value.case.id !== request.caseRef.id || current.value.case.incarnation !== request.caseRef.incarnation || current.value.case.version !== request.caseRef.version) return undefined
  const relations = await loadRelations(dependencies.collaboration, human.relationRefIds, current.value.evidenceRefs, call)
  if (relations.status !== "ok") return undefined
  const refs = relations.value.flatMap((relation) => [relation.from, relation.to, ...relation.evidenceRefs]).filter((ref, index, all) => all.findIndex((item) => same(item, ref)) === index)
  const sources = await dependencies.context.context({ refs }, call)
  if (sources.length !== refs.length || sources.some((item, index) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef || !same(item.ref, refs[index]) || !same(item.currentRef, item.ref)) || !await dependencies.host.revalidate(call)) return undefined
  return { relations: relations.value, commitments: [], milestones: [], declaredConstraints: [] }
}

export function createSfDependencyInputProducer(dependencies: SfAnalysisDependencies & { collaboration: Relations }): SfInputProducer {
  return {
    skillIds: ["sf-revisar-dependencias"],
    prepare: async (selection, request, call) => {
      if (call.kind !== "ui") return { status: "denied", reason: "fresh-human-authority-required" }
      const human = humanDependencySelection(selection)
      if (!human || !request.caseRef.id.trim() || !request.caseRef.incarnation.trim() || !Number.isSafeInteger(request.caseRef.version)) return { status: "needs-input", reason: "invalid-analysis-input" }
      if (human.commitmentIds.length || human.milestoneIds.length || human.declaredConstraints.length) return { status: "unavailable", reason: "analysis-input-producer-unavailable" }
      const first = await compose(dependencies, human, request, call)
      const second = await compose(dependencies, human, request, call)
      if (!first || !second || !same(first, second)) return { status: "unavailable", reason: "analysis-source-unavailable" }
      const decoded = decodeSfSkillInput("DependencyReviewInput", first)
      return decoded.ok ? { status: "ok", value: decoded.value } : { status: "unavailable", reason: "analysis-input-producer-unavailable" }
    },
  }
}
