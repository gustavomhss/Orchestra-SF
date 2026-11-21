import { digestSfEvidenceRef, digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DependencyReviewInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/skill-inputs.ts"
import type { DashboardPort } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { UnresolvedCondition } from "../../../../modules/sucafina/Sucafinav1/product/contracts/outputs.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createCollaborationHost } from "../../../../modules/sucafina/Sucafinav1/product/collaboration/host.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { createSfAnalysisSelectionScope } from "./analysis-selection-scope.ts"
import type { SfAnalysisDependencies, SfAnalysisRequest } from "./analysis-verifier.ts"

export type SfDependencyHumanSelection = { relationRefIds: readonly string[]; commitmentIds: readonly string[]; milestoneIds: readonly string[]; declaredConstraints: readonly string[] }
export type SfDependencyBindings = {
  collaboration: Pick<ReturnType<typeof createCollaborationHost>, "relations">
  dashboard?: Pick<DashboardPort, "read">
  readHumanSelection?: ReturnType<typeof createSfAnalysisSelectionScope>["read"]
}
const same = (left: unknown, right: unknown) => digestSfValue(left) === digestSfValue(right)
const unique = (refs: readonly BusinessEvidenceRef[]) => refs.filter((ref, index) => refs.findIndex((item) => same(item, ref)) === index)
const ids = (value: unknown): readonly string[] | undefined => Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim().length > 0) && new Set(value).size === value.length ? value : undefined

export function sfDependencyHumanSelection(value: unknown): SfDependencyHumanSelection | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const entries = Object.entries(value)
  if (entries.length !== 4 || entries.some(([key]) => key !== "relationRefIds" && key !== "commitmentIds" && key !== "milestoneIds" && key !== "declaredConstraints")) return undefined
  const relationRefIds = ids(entries.find(([key]) => key === "relationRefIds")?.[1])
  const commitmentIds = ids(entries.find(([key]) => key === "commitmentIds")?.[1])
  const milestoneIds = ids(entries.find(([key]) => key === "milestoneIds")?.[1])
  const declaredConstraints = ids(entries.find(([key]) => key === "declaredConstraints")?.[1])
  return relationRefIds && commitmentIds && milestoneIds && declaredConstraints ? { relationRefIds, commitmentIds, milestoneIds, declaredConstraints } : undefined
}

/** Capacity text is a verbatim human declaration; the assessment must retain its unverified status. */
export function sfDeclaredConstraintConditions(constraints: readonly string[]): readonly UnresolvedCondition[] {
  return constraints.map((constraint, index) => ({ id: `human-declared-constraint:${index}`, category: "human-declared-constraint", reason: `Unverified human declaration: ${constraint}`, evidenceRefs: [] }))
}

function milestoneIdentity(id: string) {
  const match = /^milestone:([^:]+):([^:]+)$/.exec(id)
  if (!match) return false
  try { return match.slice(1).every((part) => !!decodeURIComponent(part) && encodeURIComponent(decodeURIComponent(part)) === part) } catch { return false }
}
function date(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
}

/** Reopen the exact C09 choices and published Dashboard milestone fields selected by the human. */
export async function readSfDependencyComposition(dependencies: SfAnalysisDependencies & SfDependencyBindings, human: SfDependencyHumanSelection, request: SfAnalysisRequest, call: TrustedDomainContext) {
  const current = await dependencies.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, call)
  if (current.status !== "ok" || !same({ id: current.value.case.id, incarnation: current.value.case.incarnation, version: current.value.case.version }, request.caseRef) || !current.value.case.participants.includes(call.binding.principalRef)) return undefined
  const allowed = current.value.evidenceRefs
  const onCase = (refs: readonly BusinessEvidenceRef[]) => refs.every((ref) => ref.refDigest === digestSfEvidenceRef(ref) && ref.installationId === call.binding.installationId && ref.projectId === call.binding.projectId && allowed.some((item) => same(item, ref)))
  const read = human.relationRefIds.length ? await dependencies.collaboration.relations.readVersioned(human.relationRefIds, call) : { status: "ok" as const, value: [] }
  if (read.status !== "ok") return undefined
  const relations = read.value.filter((relation, index) => read.value.findIndex((item) => same(item, relation)) === index)
  const endpoints = relations.flatMap((relation) => [relation.from.refId, relation.to.refId])
  if (human.relationRefIds.some((id) => !endpoints.includes(id)) || new Set(relations.map((relation) => relation.id)).size !== relations.length || !onCase(relations.flatMap((relation) => [relation.from, relation.to, ...relation.evidenceRefs]))) return undefined
  const commitments: DependencyReviewInput["commitments"][number][] = []
  for (const id of human.commitmentIds) {
    const choices = current.value.case.choices.filter((choice) => choice.id === id)
    if (choices.length !== 1 || !onCase(choices[0]!.evidenceRefs)) return undefined
    commitments.push({ id, case: { ...request.caseRef }, evidenceRefs: structuredClone(choices[0]!.evidenceRefs) })
  }
  const milestones: DependencyReviewInput["milestones"][number][] = []
  if (human.milestoneIds.length) {
    if (!dependencies.dashboard || human.milestoneIds.some((id) => !milestoneIdentity(id))) return undefined
    const records = unique(allowed).filter((ref): ref is Extract<BusinessEvidenceRef, { kind: "record" }> => ref.kind === "record" && ref.target.surface === "dashboard" && ref.target.recordType === "dashboard-page" && !!ref.target.period && ref.target.fields.some((field) => field === "projects" || field === "milestoneDates"))
    const projected = await Promise.all(records.map(async (ref) => {
      if (!onCase([ref])) return undefined
      const result = await dependencies.dashboard!.read({ selectionRef: ref.refId, fields: ref.target.fields, period: ref.target.period! }, call)
      if (result.status !== "ok" || result.value.version !== ref.target.version || result.value.context.surface !== "dashboard" || result.value.context.installationId !== call.binding.installationId || result.value.context.projectId !== call.binding.projectId || result.value.context.principalRef !== call.binding.principalRef || result.value.context.policyVersion !== call.binding.policyVersion || result.value.context.accessRevision !== call.binding.accessRevision || !same(result.value.context.period, ref.target.period)) return undefined
      return { ref, projection: result.value }
    }))
    if (projected.some((item) => !item)) return undefined
    for (const id of human.milestoneIds) {
      const matches = projected.flatMap((item) => item?.projection.values.some((value) => value.id === `${id}:date`) ? [item] : [])
      if (matches.length !== 1) return undefined
      const selected = matches[0]!
      const fields = ["date", "name", "status"].map((field) => selected.projection.values.filter((value) => value.id === `${id}:${field}`))
      if (fields.some((values) => values.length !== 1 || values[0]!.evidenceState !== "confirmed" || !same(values[0]!.sourceRefs, [selected.ref])) || selected.projection.missing.some((item) => item.field === "milestoneDates:identity" || item.field.startsWith(`${id}:`))) return undefined
      const at = fields[0]![0]!.value
      const name = fields[1]![0]!.value
      const state = fields[2]![0]!.value
      if (!date(at) || typeof name !== "string" || !name.trim() || typeof state !== "string" || !state.trim()) return undefined
      // projectRef is the actual evidence for the projection carrying this exact project/milestone ID.
      // No project record, completion status, or delivery feasibility is inferred from the field labels.
      milestones.push({ id, projectRef: selected.ref, at, state })
    }
  }
  const refs = unique([...relations.flatMap((relation) => [relation.from, relation.to, ...relation.evidenceRefs]), ...commitments.flatMap((choice) => choice.evidenceRefs), ...milestones.map((milestone) => milestone.projectRef)])
  const sources = await dependencies.context.context({ refs }, call)
  if (sources.length !== refs.length || sources.some((item, index) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef || !same(item.ref, refs[index]) || !same(item.currentRef, item.ref)) || !await dependencies.host.revalidate(call)) return undefined
  const value: DependencyReviewInput = { relations, commitments, milestones, declaredConstraints: [...human.declaredConstraints] }
  return { current: current.value.case, input: value, refs, sources }
}
