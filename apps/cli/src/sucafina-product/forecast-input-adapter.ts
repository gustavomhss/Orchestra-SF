import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { SfHostServices } from "../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import type { SfAnalysisInputPort } from "../../../../modules/sucafina/Sucafinav1/product/interface/analysis-input-port.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { createSfBusinessServices } from "./business-services.ts"

/** Preserve the published Forecast form while preparing through the exact human-selection registry. */
export function createSfForecastInputAdapter(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  business: Pick<ReturnType<typeof createSfBusinessServices>, "cases">
  selected: SfHostServices["selected"]
  inputs: SfAnalysisInputPort
}): NonNullable<SfHostServices["forecastInputs"]> {
  return { prepare: async (call, incoming) => {
    const selection = structuredClone(incoming)
    const source = input.authority.host.requestFor(call)
    if (!source || call.kind !== "ui" || !await input.authority.ui.validate(call, "sf_forecast_compare", digestSfValue(selection)))
      return { status: "denied", reason: "forecast-selection-authority-unavailable" }
    const current = await input.business.cases.read({ caseRef: encodeCaseRef(selection.caseRef) }, call)
    if (current.status !== "ok" || current.value.case.version !== selection.caseRef.version) return { status: "stale", reason: "forecast-case-changed" }
    // The published form uses this same first installed profile/skill, with the current case objective.
    const parent = input.selected.find((value) => value.skills.some((skill) => skill.id === "sf-explicar-forecast"))
    const skill = parent?.skills.find((value) => value.id === "sf-explicar-forecast")
    if (!parent || !skill) return { status: "unavailable", reason: "forecast-analysis-profile-unavailable" }
    const wanted = { request: { caseRef: selection.caseRef, objective: current.value.case.objective,
      profileId: parent.profile.id, profileVersion: parent.profile.version, skillId: skill.id, skillVersion: skill.version,
      manifestDigest: parent.manifestDigest, outputSchemaVersion: "sf-contribution-v1" as const,
      requestedOperationScope: skill.allowedOperations.filter((operation) => parent.operationIds.includes(operation)) }, selection }
    const admitted = await input.authority.human.admit(source, "analysis.prepare", wanted)
    if (admitted.status !== "ok") return admitted
    try {
      const prepared = await input.inputs.prepare(admitted.value, wanted)
      if (prepared.status !== "ok") return prepared
      const decoded = decodeSfSkillInput("ForecastExplainInput", prepared.value)
      if (!decoded.ok || !await input.authority.human.authorize(admitted.value, "analysis.prepare", wanted) || !await input.authority.host.revalidate(call))
        return { status: "unavailable", reason: "forecast-analysis-preparation-changed" }
      return { status: "ok", value: decoded.value }
    } finally { input.authority.human.finish(admitted.value) }
  } }
}
