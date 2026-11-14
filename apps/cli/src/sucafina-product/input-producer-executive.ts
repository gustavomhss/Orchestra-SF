import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { Period } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { ExecutiveReviewInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/skill-inputs.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import { reviewChartEvidence } from "../../../../modules/sucafina/Sucafinav1/product/reviews/port.ts"
import type { ReviewCapabilityHost } from "../../../../modules/sucafina/Sucafinav1/product/reviews/capabilities.ts"
import type { SfAnalysisDependencies, SfAnalysisRequest } from "./analysis-verifier.ts"
import type { SfInputProducer } from "./input-producer-intent.ts"
import { sfConfirmationMaterial } from "./analysis-confirmation-readers.ts"
import type { SfExecutiveConfirmationBindings } from "./analysis-confirmation-readers.ts"

export type SfExecutiveHumanSelection = { selectionRef: string; sectionRefs: readonly string[]; decisionRefs: ExecutiveReviewInput["decisionRefs"]; period: Period; includeConfirmations: boolean; includeRoutineResults: boolean }
export function sfExecutiveMaterial(value: ExecutiveReviewInput) { return { ...value, confirmations: sfConfirmationMaterial(value.confirmations) } }

function same(left: unknown, right: unknown) {
  return digestSfValue(left) === digestSfValue(right)
}

function caseRefs(value: unknown): ExecutiveReviewInput["decisionRefs"] | undefined {
  if (!Array.isArray(value)) return undefined
  const refs = value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return []
    const fields = Object.entries(item)
    if (fields.length !== 3 || fields.some(([key]) => key !== "id" && key !== "incarnation" && key !== "version")) return []
    const id = fields.find(([key]) => key === "id")?.[1]
    const incarnation = fields.find(([key]) => key === "incarnation")?.[1]
    const version = fields.find(([key]) => key === "version")?.[1]
    return typeof id === "string" && id.trim() && typeof incarnation === "string" && incarnation.trim() && typeof version === "number" && Number.isSafeInteger(version) ? [{ id, incarnation, version }] : []
  })
  return refs.length === value.length && new Set(refs.map((ref) => digestSfValue(ref))).size === refs.length ? refs : undefined
}

function period(value: unknown): Period | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const fields = Object.entries(value)
  if (fields.length !== 2 || fields.some(([key]) => key !== "start" && key !== "end")) return undefined
  const start = fields.find(([key]) => key === "start")?.[1]
  const end = fields.find(([key]) => key === "end")?.[1]
  return typeof start === "string" && start.trim() && typeof end === "string" && end.trim() && start <= end ? { start, end } : undefined
}

export function sfExecutiveHumanSelection(value: unknown): SfExecutiveHumanSelection | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const entries = Object.entries(value)
  if (entries.length !== 6 || entries.some(([key]) => key !== "selectionRef" && key !== "sectionRefs" && key !== "decisionRefs" && key !== "period" && key !== "includeConfirmations" && key !== "includeRoutineResults")) return undefined
  const selectionRef = entries.find(([key]) => key === "selectionRef")?.[1]
  const sectionRefs = entries.find(([key]) => key === "sectionRefs")?.[1]
  const decisionRefs = caseRefs(entries.find(([key]) => key === "decisionRefs")?.[1])
  const selectedPeriod = period(entries.find(([key]) => key === "period")?.[1])
  const includeConfirmations = entries.find(([key]) => key === "includeConfirmations")?.[1]
  const includeRoutineResults = entries.find(([key]) => key === "includeRoutineResults")?.[1]
  if (typeof includeConfirmations !== "boolean" || typeof includeRoutineResults !== "boolean" || typeof selectionRef !== "string" || !selectionRef.trim() || !Array.isArray(sectionRefs) || !sectionRefs.length || new Set(sectionRefs).size !== sectionRefs.length || sectionRefs.some((item) => typeof item !== "string" || !item.trim()) || !decisionRefs || !selectedPeriod) return undefined
  return { selectionRef, sectionRefs, decisionRefs, period: selectedPeriod, includeConfirmations, includeRoutineResults }
}

export async function readSfExecutiveComposition(dependencies: SfAnalysisDependencies & SfExecutiveConfirmationBindings & { reviews: ReviewCapabilityHost["reviews"] }, human: SfExecutiveHumanSelection, request: SfAnalysisRequest, call: TrustedDomainContext) {
  if (human.includeRoutineResults) return undefined
  if (!human.decisionRefs.some((ref) => same(ref, request.caseRef))) return undefined
  const current = await dependencies.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, call)
  if (current.status !== "ok" || !same({ id: current.value.case.id, incarnation: current.value.case.incarnation, version: current.value.case.version }, request.caseRef) || !current.value.case.participants.includes(call.binding.principalRef)) return undefined
  const opened = await Promise.all(human.decisionRefs.map((ref) => dependencies.cases.read({ caseRef: encodeCaseRef(ref) }, call)))
  if (opened.some((item, index) => item.status !== "ok" || item.value.case.id !== human.decisionRefs[index]!.id || item.value.case.incarnation !== human.decisionRefs[index]!.incarnation || item.value.case.version !== human.decisionRefs[index]!.version || !item.value.case.participants.includes(call.binding.principalRef))) return undefined
  const review = await dependencies.reviews.preview(human.selectionRef, human.sectionRefs, call, human.period)
  if (review.status !== "ok" || review.value.some((section) => !Array.isArray(section.projection.values) || !Array.isArray(section.projection.missing))) return undefined
  const refs = [...review.value.flatMap((section) => [...section.projection.values.flatMap((item) => item.sourceRefs), ...reviewChartEvidence(section.chart)]),
    ...(human.includeConfirmations ? opened.flatMap((item) => item.status === "ok" ? item.value.evidenceRefs : []) : [])].filter((ref, index, all) => all.findIndex((item) => same(item, ref)) === index)
  const confirmation = human.includeConfirmations && dependencies.confirmations ? await dependencies.confirmations({ refs, period: human.period }, call) : undefined
  if (human.includeConfirmations && (!confirmation || confirmation.status !== "ok")) return undefined
  const confirmations = confirmation?.status === "ok" ? confirmation.value : []
  if (new Set(confirmations.map((item) => item.confirmationId)).size !== confirmations.length || confirmations.some((item) => item.state === "unavailable")) return undefined
  const sources = await dependencies.context.context({ refs }, call)
  if (sources.length !== refs.length || sources.some((item, index) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef || !same(item.ref, refs[index]) || !same(item.currentRef, item.ref)) || !await dependencies.host.revalidate(call)) return undefined
  const value: ExecutiveReviewInput = { reviewSelection: { selectionRef: human.selectionRef, period: human.period, sectionRefs: human.sectionRefs }, factualRoutineResults: [], decisionRefs: human.decisionRefs, confirmations }
  return { input: value, current: current.value.case, review: review.value, refs, sources }
}

export function createSfExecutiveInputProducer(dependencies: SfAnalysisDependencies & SfExecutiveConfirmationBindings & { reviews: ReviewCapabilityHost["reviews"] }): SfInputProducer {
  return {
    skillIds: ["sf-preparar-revisao-executiva"],
    prepare: async (selection, request, call) => {
      if (call.kind !== "ui") return { status: "denied", reason: "fresh-human-authority-required" }
      const human = sfExecutiveHumanSelection(selection)
      if (!human || !request.caseRef.id.trim() || !request.caseRef.incarnation.trim() || !Number.isSafeInteger(request.caseRef.version)) return { status: "needs-input", reason: "invalid-analysis-input" }
      if (human.includeRoutineResults) return { status: "unavailable", reason: "review-result-link-unavailable" }
      const first = await readSfExecutiveComposition(dependencies, human, request, call)
      const second = await readSfExecutiveComposition(dependencies, human, request, call)
      if (!first || !second || !same(sfExecutiveMaterial(first.input), sfExecutiveMaterial(second.input))) return { status: "unavailable", reason: "analysis-source-unavailable" }
      const decoded = decodeSfSkillInput("ExecutiveReviewInput", first.input)
      return decoded.ok ? { status: "ok", value: decoded.value } : { status: "unavailable", reason: "analysis-input-producer-unavailable" }
    },
  }
}
