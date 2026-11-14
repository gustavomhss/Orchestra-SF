import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { MeetingMaterialInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/skill-inputs.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createSfDecisionResultStore } from "../../../../modules/sucafina/Sucafinav1/product/decisions/result-store.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import { reviewInclusion } from "../../../../modules/sucafina/Sucafinav1/product/reviews/inclusion.ts"
import type { ReviewCapabilityHost } from "../../../../modules/sucafina/Sucafinav1/product/reviews/capabilities.ts"
import type { SfAnalysisDependencies, SfAnalysisRequest } from "./analysis-verifier.ts"
import type { SfInputProducer } from "./input-producer-intent.ts"

function same(left: unknown, right: unknown) {
  return digestSfValue(left) === digestSfValue(right)
}

function caseRefs(value: unknown): MeetingMaterialInput["decisionRefs"] | undefined {
  if (!Array.isArray(value) || value.some((item) => !item || typeof item !== "object" || Array.isArray(item))) return undefined
  const refs = value.flatMap((item) => {
    const fields = Object.entries(item)
    if (fields.length !== 3 || fields.some(([key]) => key !== "id" && key !== "incarnation" && key !== "version")) return []
    const id = fields.find(([key]) => key === "id")?.[1]
    const incarnation = fields.find(([key]) => key === "incarnation")?.[1]
    const version = fields.find(([key]) => key === "version")?.[1]
    return typeof id === "string" && id.trim() && typeof incarnation === "string" && incarnation.trim() && typeof version === "number" && Number.isSafeInteger(version) ? [{ id, incarnation, version }] : []
  })
  return refs.length === value.length && new Set(refs.map((ref) => digestSfValue(ref))).size === refs.length ? refs : undefined
}

function humanMeetingSelection(value: unknown): { reviewRef: { id: string; version: number }; decisionRefs: MeetingMaterialInput["decisionRefs"]; sectionRefs: readonly string[]; routineResultRefs: readonly string[] } | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const entries = Object.entries(value)
  if (entries.length !== 4 || entries.some(([key]) => key !== "reviewRef" && key !== "decisionRefs" && key !== "sectionRefs" && key !== "routineResultRefs")) return undefined
  const review = entries.find(([key]) => key === "reviewRef")?.[1]
  const decisionRefs = caseRefs(entries.find(([key]) => key === "decisionRefs")?.[1])
  const sectionRefs = entries.find(([key]) => key === "sectionRefs")?.[1]
  const routineResultRefs = entries.find(([key]) => key === "routineResultRefs")?.[1]
  if (!review || typeof review !== "object" || Array.isArray(review) || !decisionRefs || !Array.isArray(sectionRefs) || !Array.isArray(routineResultRefs)) return undefined
  const reviewFields = Object.entries(review)
  const id = reviewFields.find(([key]) => key === "id")?.[1]
  const version = reviewFields.find(([key]) => key === "version")?.[1]
  if (reviewFields.length !== 2 || typeof id !== "string" || !id.trim() || typeof version !== "number" || !Number.isSafeInteger(version) || version < 1 || !sectionRefs.length || new Set(sectionRefs).size !== sectionRefs.length || sectionRefs.some((item) => typeof item !== "string" || !item.trim()) || routineResultRefs.some((item) => typeof item !== "string" || !item.trim())) return undefined
  return { reviewRef: { id, version }, decisionRefs, sectionRefs, routineResultRefs }
}

async function compose(dependencies: SfAnalysisDependencies & {
  reviews: ReviewCapabilityHost["reviews"]
  results: Pick<ReturnType<typeof createSfDecisionResultStore>, "read">
}, human: ReturnType<typeof humanMeetingSelection> & object, request: SfAnalysisRequest, call: TrustedDomainContext): Promise<MeetingMaterialInput | undefined> {
  const current = await dependencies.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, call)
  if (current.status !== "ok" || current.value.case.version !== request.caseRef.version) return undefined
  const opened = await Promise.all(human.decisionRefs.map((ref) => dependencies.cases.read({ caseRef: encodeCaseRef(ref) }, call)))
  if (opened.some((item, index) => item.status !== "ok" || item.value.case.id !== human.decisionRefs[index]!.id || item.value.case.incarnation !== human.decisionRefs[index]!.incarnation || item.value.case.version !== human.decisionRefs[index]!.version)) return undefined
  const review = await dependencies.reviews.read(human.reviewRef.id, call)
  if (review.status !== "ok" || review.value.id !== human.reviewRef.id || review.value.version !== human.reviewRef.version || human.sectionRefs.some((id) => !review.value.sections.some((section) => section.id === id))) return undefined
  const inclusion = reviewInclusion(review.value, human.sectionRefs)
  if (!inclusion) return undefined
  const rows = inclusion.sections.flatMap((section) => section.decisionResults)
  const linked = await Promise.all(rows.map(async (row) => {
    const scenario = await dependencies.results.read({ resultRef: row.resultRef, kind: "scenario" }, call)
    const comparison = await dependencies.results.read({ resultRef: row.comparisonRef, kind: "comparison" }, call)
    if (scenario.status !== "ok" || comparison.status !== "ok" || scenario.value.resultRef !== row.resultRef || scenario.value.resultDigest !== row.resultDigest || comparison.value.resultRef !== row.comparisonRef || comparison.value.resultDigest !== row.comparisonDigest || !same(scenario.value.caseRef, comparison.value.caseRef)) return undefined
    return scenario.value.caseRef
  }))
  if (linked.some((item) => !item) || human.decisionRefs.some((ref) => !linked.some((item) => same(item, ref))) || linked.some((item) => !human.decisionRefs.some((ref) => same(item, ref)))) return undefined
  const refs = inclusion.sections.flatMap((section) => section.sourceRefs).filter((ref, index, all) => all.findIndex((candidate) => same(candidate, ref)) === index)
  const sources = await dependencies.context.context({ refs }, call)
  if (sources.length !== refs.length || sources.some((item, index) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef || !same(item.ref, refs[index]) || !same(item.currentRef, item.ref)) || !await dependencies.host.revalidate(call)) return undefined
  return { preservedReviewRef: { id: review.value.id, version: review.value.version }, decisionRefs: human.decisionRefs, factualRoutineResults: [], authorizedSections: human.sectionRefs }
}

export function createSfMeetingInputProducer(dependencies: SfAnalysisDependencies & {
  reviews: ReviewCapabilityHost["reviews"]
  results: Pick<ReturnType<typeof createSfDecisionResultStore>, "read">
}): SfInputProducer {
  return {
    skillIds: ["sf-produzir-material-reuniao"],
    prepare: async (selection, request, call) => {
      if (call.kind !== "ui") return { status: "denied", reason: "fresh-human-authority-required" }
      const human = humanMeetingSelection(selection)
      if (!human || !request.caseRef.id.trim() || !request.caseRef.incarnation.trim() || !Number.isSafeInteger(request.caseRef.version)) return { status: "needs-input", reason: "invalid-analysis-input" }
      if (human.routineResultRefs.length) return { status: "unavailable", reason: "review-result-link-unavailable" }
      const first = await compose(dependencies, human, request, call)
      const second = await compose(dependencies, human, request, call)
      if (!first || !second || !same(first, second)) return { status: "unavailable", reason: "analysis-source-unavailable" }
      const decoded = decodeSfSkillInput("MeetingMaterialInput", first)
      return decoded.ok ? { status: "ok", value: decoded.value } : { status: "unavailable", reason: "analysis-input-producer-unavailable" }
    },
  }
}
