import type { SfAnalysisRequest } from "./analysis-verifier.ts"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { ScenarioComparisonInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/skill-inputs.ts"
import type { DecisionCasePort, PlannerPort, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"

export type SfInputProducer = { skillIds: readonly string[]; prepare: (selection: unknown, request: SfAnalysisRequest, call: TrustedDomainContext) => Promise<PortResult<unknown>> }

export type SfScenarioAlternativeSelection = { readonly id: string; readonly version: number }
export type SfScenarioComparisonSelection = {
  readonly caseRef: { readonly id: string; readonly incarnation: string; readonly version: number }
  readonly alternatives: readonly [SfScenarioAlternativeSelection, SfScenarioAlternativeSelection]
}
type ScenarioLookup = (
  request: { caseRef: SfScenarioComparisonSelection["caseRef"]; alternativeId: string; alternativeVersion: number },
  call: TrustedDomainContext,
) => Promise<PortResult<{ resultRef: string; requestDigest: string; resultDigest: string }>>

/** The host supplies the human selection and the already constructed case, lookup, planner, and context ports. */
export function createSfScenarioComparisonInput(input: {
  cases: DecisionCasePort
  scenarioLookup: ScenarioLookup
  planner: Pick<PlannerPort, "compareScenarios">
  context: Pick<BusinessContextService, "context">
  revalidate: (call: TrustedDomainContext) => Promise<boolean>
  authorizeSelection: (call: TrustedDomainContext, selection: SfScenarioComparisonSelection) => Promise<boolean>
}) {
  const prepare = async (call: TrustedDomainContext, selection: SfScenarioComparisonSelection): Promise<PortResult<ScenarioComparisonInput>> => {
    const wanted = structuredClone(selection)
    const [first, second] = wanted.alternatives
    if (!wanted.caseRef.id.trim() || !wanted.caseRef.incarnation.trim() || !Number.isSafeInteger(wanted.caseRef.version) || wanted.caseRef.version < 0 || !first.id.trim() || !second.id.trim() || first.id === second.id || !Number.isSafeInteger(first.version) || !Number.isSafeInteger(second.version) || first.version < 0 || second.version < 0)
      return { status: "needs-input", reason: "scenario-selection-invalid" }
    if (call.kind === "native" && (call.binding.caseId !== wanted.caseRef.id || call.binding.caseIncarnation !== wanted.caseRef.incarnation || call.binding.caseVersion !== wanted.caseRef.version))
      return { status: "denied", reason: "scenario-selection-unauthorized" }
    if (!await input.authorizeSelection(call, wanted) || !await input.revalidate(call))
      return { status: "denied", reason: "scenario-selection-unauthorized" }
    const current = await input.cases.read({ caseRef: encodeCaseRef(wanted.caseRef) }, call)
    if (current.status !== "ok") return current
    const domain = current.value.case
    if (domain.id !== wanted.caseRef.id || domain.incarnation !== wanted.caseRef.incarnation || domain.version !== wanted.caseRef.version || !domain.participants.includes(call.binding.principalRef))
      return { status: "denied", reason: "scenario-case-unauthorized" }
    const chosen = wanted.alternatives.map((selected) => domain.alternatives.filter((alternative) => alternative.id === selected.id && alternative.version === selected.version))
    if (chosen.some((matches) => matches.length !== 1)) return { status: "unavailable", reason: "scenario-alternative-unavailable" }
    const alternatives = chosen.map((matches) => matches[0]!)
    const located = [await input.scenarioLookup({ caseRef: wanted.caseRef, alternativeId: alternatives[0]!.id, alternativeVersion: alternatives[0]!.version }, call), await input.scenarioLookup({ caseRef: wanted.caseRef, alternativeId: alternatives[1]!.id, alternativeVersion: alternatives[1]!.version }, call)]
    const failed = located.find((item) => item.status !== "ok")
    if (failed) return failed
    if (located[0].status !== "ok" || located[1].status !== "ok") return { status: "unavailable", reason: "scenario-result-unavailable" }
    const scenarioRefs = [located[0].value.resultRef, located[1].value.resultRef]
    if (scenarioRefs.some((ref) => !ref.trim()) || scenarioRefs[0] === scenarioRefs[1]) return { status: "unavailable", reason: "scenario-result-unavailable" }
    const replay = await input.planner.compareScenarios({ scenarioRefs, criteria: [] }, call)
    if (replay.status !== "ok") return replay
    if (replay.value.baselineResultRef !== scenarioRefs[0] || replay.value.alternativeResultRef !== scenarioRefs[1])
      return { status: "stale", reason: "scenario-comparison-changed" }
    const refs = uniqueRefs(alternatives.flatMap((alternative) => alternative.result.sourceRefs))
    if (!refs.length || refs.some((ref) => !current.value.evidenceRefs.some((allowed) => digestSfValue(allowed) === digestSfValue(ref))))
      return { status: "denied", reason: "scenario-source-outside-case" }
    const resolutions = await input.context.context({ refs }, call)
    const again = await input.cases.read({ caseRef: encodeCaseRef(wanted.caseRef) }, call)
    const confirmed = [await input.scenarioLookup({ caseRef: wanted.caseRef, alternativeId: alternatives[0]!.id, alternativeVersion: alternatives[0]!.version }, call), await input.scenarioLookup({ caseRef: wanted.caseRef, alternativeId: alternatives[1]!.id, alternativeVersion: alternatives[1]!.version }, call)]
    if (resolutions.length !== refs.length || resolutions.some((item) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef || digestSfValue(item.currentRef) !== digestSfValue(item.ref)) || again.status !== "ok" || again.value.case.id !== domain.id || again.value.case.incarnation !== domain.incarnation || again.value.case.version !== domain.version || !again.value.case.participants.includes(call.binding.principalRef) || digestSfValue(again.value.case.alternatives) !== digestSfValue(domain.alternatives) || digestSfValue(again.value.evidenceRefs) !== digestSfValue(current.value.evidenceRefs) || confirmed[0].status !== "ok" || confirmed[1].status !== "ok" || confirmed[0].value.resultRef !== scenarioRefs[0] || confirmed[1].value.resultRef !== scenarioRefs[1] || !await input.revalidate(call) || !await input.authorizeSelection(call, wanted))
      return { status: "stale", reason: "scenario-source-changed" }
    const fresh = wanted.alternatives.map((selected) => again.value.case.alternatives.filter((alternative) => alternative.id === selected.id && alternative.version === selected.version))
    if (fresh.some((matches) => matches.length !== 1)) return { status: "stale", reason: "scenario-source-changed" }
    const selectedAlternatives = fresh.map((matches) => matches[0]!)
    return { status: "ok", value: structuredClone({
      alternatives: selectedAlternatives.map((alternative) => ({ id: alternative.id, version: alternative.version, title: alternative.title, result: alternative.result })),
      costCoverageBases: again.value.case.costCoverageBases,
      operations: selectedAlternatives.flatMap((alternative) => alternative.scenario.operations),
      currency: again.value.case.currency,
      horizon: again.value.case.horizon,
    }) }
  }
  return { prepare }
}

function uniqueRefs(refs: readonly BusinessEvidenceRef[]) {
  return refs.filter((ref, index) => refs.findIndex((item) => item.refDigest === ref.refDigest) === index)
}
