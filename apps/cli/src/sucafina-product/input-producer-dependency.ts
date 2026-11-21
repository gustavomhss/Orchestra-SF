import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { SfAnalysisDependencies } from "./analysis-verifier.ts"
import type { SfInputProducer } from "./input-producer-intent.ts"
import { readSfDependencyComposition, sfDependencyHumanSelection } from "./analysis-dependency-readers.ts"
import type { SfDependencyBindings } from "./analysis-dependency-readers.ts"

export function createSfDependencyInputProducer(dependencies: SfAnalysisDependencies & SfDependencyBindings): SfInputProducer {
  return {
    skillIds: ["sf-revisar-dependencias"],
    prepare: async (selection, request, call) => {
      if (call.kind !== "ui") return { status: "denied", reason: "fresh-human-authority-required" }
      const human = sfDependencyHumanSelection(selection)
      if (!human || !request.caseRef.id.trim() || !request.caseRef.incarnation.trim() || !Number.isSafeInteger(request.caseRef.version)) return { status: "needs-input", reason: "invalid-analysis-input" }
      const first = await readSfDependencyComposition(dependencies, human, request, call)
      const second = await readSfDependencyComposition(dependencies, human, request, call)
      if (!first || !second || digestSfValue(first.input) !== digestSfValue(second.input)) return { status: "unavailable", reason: "analysis-source-unavailable" }
      const decoded = decodeSfSkillInput("DependencyReviewInput", first.input)
      return decoded.ok ? { status: "ok", value: decoded.value } : { status: "unavailable", reason: "analysis-input-producer-unavailable" }
    },
  }
}
