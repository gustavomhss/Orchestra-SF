import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { createSfCaseRecall } from "../../../../modules/sucafina/Sucafinav1/product/decision-memory/case-recall.ts"
import type { SfAnalysisDependencies } from "./analysis-verifier.ts"
import type { SfInputProducer } from "./input-producer-intent.ts"
import { readSfMemorySelection, sfMemoryReadIdentity } from "./analysis-memory-evidence.ts"

function same(left: unknown, right: unknown) {
  return digestSfValue(left) === digestSfValue(right)
}

export function createSfMemoryInputProducer(dependencies: SfAnalysisDependencies & { caseRecall: ReturnType<typeof createSfCaseRecall> }): SfInputProducer {
  return {
    skillIds: ["sf-consultar-memoria-decisoria"],
    prepare: async (selection, request, call) => {
      if (call.kind !== "ui") return { status: "denied", reason: "fresh-human-authority-required" }
      const decoded = decodeSfSkillInput("DecisionRecallInput", selection)
      if (!decoded.ok || !decoded.value.query.trim() || decoded.value.query !== request.objective || !same(decoded.value.currentCase, request.caseRef)) return { status: "needs-input", reason: "invalid-analysis-input" }
      const value = structuredClone(decoded.value)
      const first = await readSfMemorySelection(dependencies, value, call)
      if (!first) return { status: "unavailable", reason: "analysis-source-unavailable" }
      const second = await readSfMemorySelection(dependencies, value, call)
      if (!second || !same(sfMemoryReadIdentity(first), sfMemoryReadIdentity(second))) return { status: "unavailable", reason: "analysis-source-unavailable" }
      const checked = decodeSfSkillInput("DecisionRecallInput", value)
      return checked.ok ? { status: "ok", value: checked.value } : { status: "unavailable", reason: "analysis-input-producer-unavailable" }
    },
  }
}
