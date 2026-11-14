import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { SourceRef } from "../contracts/context.ts"
import type { ChoiceRecord } from "../contracts/decisions.ts"
import type { PlannerPort } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { PlannerScenarioHost } from "./scenario-comparison-port.ts"
import { plannerScenarioDigest } from "./preview-comparison.ts"

type SignalSelection = { caseRef: { id: string; incarnation: string; version: number }; choiceId: string; source: SourceRef; evidence: Extract<BusinessEvidenceRef, { kind: "record" }>; fields: readonly string[]; period: { start: string; end: string }; criterionId: string; scenarioRefs: readonly [string, string] }

/** The caller must fence the human selection, chosen case and all source identities together in its own snapshot. */
export function createPlannerMateriality(input: { scenarios: PlannerScenarioHost; planner: Pick<PlannerPort, "compareScenarios">; verifyBinding: (selection: SignalSelection, choice: ChoiceRecord, context: TrustedDomainContext) => Promise<boolean> }) {
  return async (request: { selection: SignalSelection; choice: ChoiceRecord }, context: TrustedDomainContext) => {
    const selection = structuredClone(request.selection)
    const choice = structuredClone(request.choice)
    if (!selection || selection.source.surface !== "planner" || selection.evidence.target.surface !== "planner" || selection.choiceId !== choice.id || !selection.criterionId.trim() || !selection.fields.length || new Set(selection.fields).size !== selection.fields.length || selection.fields.some((field) => !selection.source.fields.includes(field) || !selection.evidence.target.fields.includes(field)) || selection.scenarioRefs.length !== 2 || selection.scenarioRefs[0] === selection.scenarioRefs[1] || selection.scenarioRefs.some((ref) => !ref.trim()) || selection.evidence.refDigest !== digestSfEvidenceRef(selection.evidence) || selection.evidence.installationId !== context.binding.installationId || selection.evidence.projectId !== context.binding.projectId || selection.evidence.target.recordType !== selection.source.type || selection.evidence.target.recordId !== selection.source.id || selection.evidence.target.incarnation !== selection.source.incarnation || selection.evidence.target.version !== selection.source.version || !selection.evidence.target.period || selection.evidence.target.period.start > selection.period.start || selection.evidence.target.period.end < selection.period.end || selection.source.period.start > selection.period.start || selection.source.period.end < selection.period.end) return { status: "needs-input", reason: "invalid-materiality-selection" } as const
    if (!await input.verifyBinding(selection, choice, context)) return { status: "denied", reason: "materiality-binding-unavailable" } as const
    const load = () => Promise.all(selection.scenarioRefs.map((ref) => input.scenarios.resolve(ref, context)))
    const scenarios = await load()
    if (scenarios[0].status !== "ok") return scenarios[0]
    if (scenarios[1].status !== "ok") return scenarios[1]
    const comparison = await input.planner.compareScenarios({ scenarioRefs: selection.scenarioRefs, criteria: [selection.criterionId] }, context)
    if (comparison.status !== "ok") return comparison
    if (comparison.value.baselineResultRef !== selection.scenarioRefs[0] || comparison.value.alternativeResultRef !== selection.scenarioRefs[1] || comparison.value.criterionResults.length !== 1 || comparison.value.criterionResults[0]?.criterionId !== selection.criterionId) return { status: "unavailable", reason: "materiality-comparison-unavailable" } as const
    const resultAfter = scenarios[1].value.result
    const afterRefs = resultAfter.sourceRefs.filter((ref): ref is Extract<BusinessEvidenceRef, { kind: "record" }> => ref.kind === "record" && ref.target.surface === selection.source.surface && ref.target.recordType === selection.source.type && ref.target.recordId === selection.source.id && ref.refDigest === digestSfEvidenceRef(ref) && ref.installationId === context.binding.installationId && ref.projectId === context.binding.projectId && !!ref.target.period && ref.target.period.start <= selection.period.start && ref.target.period.end >= selection.period.end && selection.fields.every((field) => ref.target.fields.includes(field)))
    if (afterRefs.length !== 1) return { status: "unavailable", reason: "materiality-source-unavailable" } as const
    const source = resultAfter.components.flatMap((component) => component.sourceRefs).find((ref) => ref.surface === afterRefs[0]!.target.surface && ref.type === afterRefs[0]!.target.recordType && ref.id === afterRefs[0]!.target.recordId && ref.incarnation === afterRefs[0]!.target.incarnation && ref.version === afterRefs[0]!.target.version)
    if (!source) return { status: "unavailable", reason: "materiality-source-unavailable" } as const
    const again = await load()
    const checked = await input.planner.compareScenarios({ scenarioRefs: selection.scenarioRefs, criteria: [selection.criterionId] }, context)
    if (again[0].status !== "ok" || again[1].status !== "ok" || plannerScenarioDigest(again[0].value.result) !== plannerScenarioDigest(scenarios[0].value.result) || plannerScenarioDigest(again[1].value.result) !== plannerScenarioDigest(resultAfter) || checked.status !== "ok" || digestSfValue(checked.value) !== digestSfValue(comparison.value) || !await input.verifyBinding(selection, choice, context)) return { status: "stale", reason: "materiality-binding-or-source-changed" } as const
    return { status: "ok", value: { source, fields: selection.fields, period: selection.period, before: [selection.evidence], after: afterRefs, availability: "available" as const, comparison: { before: choice.comparison, after: comparison.value, resultBefore: choice.result, resultAfter } } } as const
  }
}
