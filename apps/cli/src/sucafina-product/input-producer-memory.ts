import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { DecisionRecallInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/skill-inputs.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createSfCaseRecall } from "../../../../modules/sucafina/Sucafinav1/product/decision-memory/case-recall.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { SfAnalysisDependencies } from "./analysis-verifier.ts"
import type { SfInputProducer } from "./input-producer-intent.ts"

function same(left: unknown, right: unknown) {
  return digestSfValue(left) === digestSfValue(right)
}

async function recallSelection(dependencies: SfAnalysisDependencies & { caseRecall: ReturnType<typeof createSfCaseRecall> }, value: DecisionRecallInput, call: TrustedDomainContext) {
  const current = await dependencies.cases.read({ caseRef: encodeCaseRef(value.currentCase) }, call)
  if (current.status !== "ok" || current.value.case.id !== value.currentCase.id || current.value.case.incarnation !== value.currentCase.incarnation || current.value.case.version !== value.currentCase.version || !await dependencies.host.revalidate(call)) return undefined
  const recalled = await dependencies.caseRecall({ caseRef: value.currentCase, limit: 50, scope: { query: value.query, recallScope: value.recallScope } }, call)
  if (recalled.status !== "ok" || recalled.accessRevision !== call.binding.accessRevision || recalled.matches.some((match) => !value.recallScope.cases.some((ref) => same(ref, match.caseRef)))) return undefined
  const refs = recalled.matches.flatMap((match) => match.evidenceRefs).filter((ref, index, all) => all.findIndex((item) => same(item, ref)) === index)
  const sources = await dependencies.context.context({ refs }, call)
  if (sources.length !== refs.length || sources.some((item, index) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef || !same(item.ref, refs[index]) || !same(item.currentRef, item.ref)) || !await dependencies.host.revalidate(call)) return undefined
  return { recalled, refs }
}

export function createSfMemoryInputProducer(dependencies: SfAnalysisDependencies & { caseRecall: ReturnType<typeof createSfCaseRecall> }): SfInputProducer {
  return {
    skillIds: ["sf-consultar-memoria-decisoria"],
    prepare: async (selection, request, call) => {
      if (call.kind !== "ui") return { status: "denied", reason: "fresh-human-authority-required" }
      const decoded = decodeSfSkillInput("DecisionRecallInput", selection)
      if (!decoded.ok || !decoded.value.query.trim() || decoded.value.query !== request.objective || !same(decoded.value.currentCase, request.caseRef)) return { status: "needs-input", reason: "invalid-analysis-input" }
      const value = decoded.value
      if (value.recallScope.includeHistorical) return { status: "unavailable", reason: "historical-memory-unavailable" }
      const first = await recallSelection(dependencies, value, call)
      const second = await recallSelection(dependencies, value, call)
      if (!first || !second || !same(first.recalled, second.recalled) || !same(first.refs, second.refs)) return { status: "unavailable", reason: "analysis-source-unavailable" }
      const checked = decodeSfSkillInput("DecisionRecallInput", value)
      return checked.ok ? { status: "ok", value: checked.value } : { status: "unavailable", reason: "analysis-input-producer-unavailable" }
    },
  }
}
