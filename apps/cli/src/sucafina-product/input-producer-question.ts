import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { AuthorizedCaseProjection, BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { UnresolvedCondition } from "../../../../modules/sucafina/Sucafinav1/product/contracts/outputs.ts"
import type { QuestionPlanningInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/skill-inputs.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createCollaborationHost } from "../../../../modules/sucafina/Sucafinav1/product/collaboration/host.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { SfAnalysisDependencies, SfAnalysisRequest } from "./analysis-verifier.ts"
import type { SfInputProducer } from "./input-producer-intent.ts"

type Collaboration = Pick<ReturnType<typeof createCollaborationHost>, "relations" | "authority">
type VersionedRelation = Extract<Awaited<ReturnType<Collaboration["relations"]["readVersioned"]>>, { status: "ok" }>["value"]

function same(left: unknown, right: unknown) {
  return digestSfValue(left) === digestSfValue(right)
}

function stringList(value: unknown): readonly string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim().length > 0) && new Set(value).size === value.length ? value : undefined
}

function humanQuestionSelection(value: unknown): { readonly relationRefIds: readonly string[]; readonly directoryRefs: readonly string[] } | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const entries = Object.entries(value)
  if (entries.length !== 2 || entries.some(([key]) => key !== "relationRefIds" && key !== "directoryRefs")) return undefined
  const relationRefIds = stringList(entries.find(([key]) => key === "relationRefIds")?.[1])
  const directoryRefs = stringList(entries.find(([key]) => key === "directoryRefs")?.[1])
  return relationRefIds && directoryRefs ? { relationRefIds, directoryRefs } : undefined
}

function onCase(refs: readonly BusinessEvidenceRef[], allowed: readonly BusinessEvidenceRef[]) {
  return refs.every((ref) => allowed.some((item) => same(item, ref)))
}

function pendingConditions(current: AuthorizedCaseProjection, caseRef: SfAnalysisRequest["caseRef"]): readonly UnresolvedCondition[] {
  const rows = [
    ...current.case.alternatives.flatMap((alternative) => alternative.result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [{ owner: alternative.id, entry }] : [])),
    ...current.case.choices.flatMap((choice) => choice.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [{ owner: choice.id, entry }] : [])),
  ]
  const conditions = rows.flatMap((row) => {
    if (!row.owner.trim() || !row.entry.categoryId.trim() || !row.entry.reason.trim()) return []
    const condition: UnresolvedCondition = {
      id: `question:${digestSfValue({ caseRef, coverage: row.owner, categoryId: row.entry.categoryId })}`,
      category: row.entry.categoryId,
      reason: row.entry.reason,
      evidenceRefs: [],
      ...(row.entry.questionRef ? { questionRef: row.entry.questionRef } : {}),
    }
    return [condition]
  })
  const missing = [
    ...current.case.alternatives.flatMap((alternative) => alternative.result.costCoverage.derivedMissingCategoryIds.map((category) => ({ owner: alternative.id, category }))),
    ...current.case.choices.flatMap((choice) => choice.costCoverage.derivedMissingCategoryIds.map((category) => ({ owner: choice.id, category }))),
  ].filter((item) => !rows.some((row) => row.owner === item.owner && row.entry.categoryId === item.category)).map((item) => ({ id: `question:${digestSfValue({ caseRef, coverage: item.owner, categoryId: item.category })}`, category: item.category, reason: "missing-required-cost-category", evidenceRefs: [] }))
  return [...conditions, ...missing].filter((condition, index, all) => all.findIndex((item) => same(item, condition)) === index)
}

async function loadRelations(collaboration: Collaboration, relationRefIds: readonly string[], allowed: readonly BusinessEvidenceRef[], call: TrustedDomainContext) {
  if (!relationRefIds.length) return { status: "ok" as const, value: [] as VersionedRelation }
  const read = await collaboration.relations.readVersioned(relationRefIds, call)
  if (read.status !== "ok") return read
  const relations = read.value.filter((relation, index) => read.value.findIndex((item) => same(item, relation)) === index)
  const endpoints = relations.flatMap((relation) => [relation.from.refId, relation.to.refId])
  const refs = relations.flatMap((relation) => [relation.from, relation.to, ...relation.evidenceRefs])
  if (relationRefIds.some((id) => !endpoints.includes(id)) || !onCase(refs, allowed)) return { status: "unavailable" as const, reason: "analysis-source-unavailable" }
  return { status: "ok" as const, value: relations }
}

async function loadRecipients(collaboration: Collaboration, directoryRefs: readonly string[], call: TrustedDomainContext) {
  const recipients = await Promise.all(directoryRefs.map((id) => collaboration.authority.recipient(id, call)))
  return recipients.every((recipient, index) => recipient?.id === directoryRefs[index]) ? directoryRefs : undefined
}

export function createSfQuestionInputProducer(dependencies: SfAnalysisDependencies & { collaboration: Collaboration }): SfInputProducer {
  return {
    skillIds: ["sf-coordenar-perguntas"],
    prepare: async (selection, request, call) => {
      if (call.kind !== "ui") return { status: "denied", reason: "fresh-human-authority-required" }
      const human = humanQuestionSelection(selection)
      if (!human || !request.caseRef.id.trim() || !request.caseRef.incarnation.trim() || !Number.isSafeInteger(request.caseRef.version)) return { status: "needs-input", reason: "invalid-analysis-input" }
      const current = await dependencies.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, call)
      if (current.status !== "ok" || current.value.case.id !== request.caseRef.id || current.value.case.incarnation !== request.caseRef.incarnation || current.value.case.version !== request.caseRef.version) return { status: "unavailable", reason: "analysis-source-unavailable" }
      const relations = await loadRelations(dependencies.collaboration, human.relationRefIds, current.value.evidenceRefs, call)
      if (relations.status !== "ok") return relations.status === "needs-input" ? relations : { status: "unavailable", reason: "analysis-input-producer-unavailable" }
      const recipients = await loadRecipients(dependencies.collaboration, human.directoryRefs, call)
      if (!recipients) return { status: "unavailable", reason: "analysis-input-producer-unavailable" }
      const evidence = relations.value.flatMap((relation) => [relation.from, relation.to, ...relation.evidenceRefs]).filter((ref, index, all) => all.findIndex((item) => same(item, ref)) === index)
      const sources = await dependencies.context.context({ refs: evidence }, call)
      if (sources.length !== evidence.length || sources.some((item, index) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef || !same(item.ref, evidence[index]) || !same(item.currentRef, item.ref))) return { status: "unavailable", reason: "analysis-source-unavailable" }
      const again = await dependencies.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, call)
      const relationsAgain = await loadRelations(dependencies.collaboration, human.relationRefIds, again.status === "ok" ? again.value.evidenceRefs : [], call)
      const recipientsAgain = await loadRecipients(dependencies.collaboration, human.directoryRefs, call)
      if (again.status !== "ok" || again.value.case.version !== current.value.case.version || relationsAgain.status !== "ok" || !same(relationsAgain.value, relations.value) || !recipientsAgain || !same(recipientsAgain, recipients) || !await dependencies.host.revalidate(call)) return { status: "unavailable", reason: "analysis-source-unavailable" }
      const built: QuestionPlanningInput = { case: request.caseRef, unresolvedConditions: pendingConditions(current.value, request.caseRef), relations: relations.value, authorizedDirectoryRefs: recipients }
      const decoded = decodeSfSkillInput("QuestionPlanningInput", built)
      return decoded.ok ? { status: "ok", value: decoded.value } : { status: "unavailable", reason: "analysis-input-producer-unavailable" }
    },
  }
}
