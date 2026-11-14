import { digestSfValue } from "../contracts/canonical.ts"
import { encodeCaseRef } from "../decisions/case-port.ts"
import type { DecisionCasePort, DomainPortHost } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { createPlannerMateriality } from "../planner/materiality.ts"
import type { createSfSignalRegistry, SfSignalSelection } from "./signal-registry.ts"
import { createSfMaterialityAccess } from "./materiality.ts"

/** Connect the real Planner producer to one protected, human-selected case. */
export function createSfPlannerMaterialityAccess(input: {
  caseRef: SfSignalSelection["caseRef"]
  registry: Pick<ReturnType<typeof createSfSignalRegistry>, "list">
  cases: Pick<DecisionCasePort, "read">
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  produce: ReturnType<typeof createPlannerMateriality>
  authorizeEvidence: (refs: readonly BusinessEvidenceRef[], call: TrustedDomainContext) => Promise<boolean>
}) {
  return createSfMaterialityAccess({ revalidate: input.host.revalidate, authorizeEvidence: input.authorizeEvidence, load: async (conditionId, call) => {
    const request = input.host.requestFor(call)
    if (!request || request.signal.aborted || !await input.host.revalidate(call)) return undefined
    const bindings = await input.registry.list(input.caseRef, call)
    if (bindings.status !== "ok") return undefined
    const selected = bindings.records.filter((record) => record.id === conditionId)
    if (selected.length !== 1) return undefined
    const binding = selected[0]!
    const current = await input.cases.read({ caseRef: encodeCaseRef(input.caseRef) }, call)
    if (current.status !== "ok" || current.value.case.id !== input.caseRef.id || current.value.case.incarnation !== input.caseRef.incarnation || current.value.case.version !== input.caseRef.version || current.value.context.kind !== call.kind || current.value.context.installationId !== call.binding.installationId || current.value.context.projectId !== call.binding.projectId || current.value.context.principalRef !== call.binding.principalRef || current.value.context.accessRevision !== call.binding.accessRevision || current.value.context.policyVersion !== call.binding.policyVersion || (call.kind === "native" && (current.value.context.kind !== "native" || current.value.context.profileId !== call.binding.profileId || call.binding.caseId !== input.caseRef.id || call.binding.caseIncarnation !== input.caseRef.incarnation || call.binding.caseVersion !== input.caseRef.version))) return undefined
    const choices = current.value.case.choices.filter((choice) => choice.id === binding.selection.choiceId)
    if (choices.length !== 1 || digestSfValue(choices[0]) !== binding.choiceDigest || !choices[0]!.criteria.includes(binding.selection.criterionId)) return undefined
    const choice = choices[0]!
    const produced = await input.produce({ selection: binding.selection, choice }, call)
    if (produced.status !== "ok" || produced.value.source.surface !== binding.selection.source.surface || produced.value.source.type !== binding.selection.source.type || produced.value.source.id !== binding.selection.source.id || digestSfValue([...produced.value.fields].sort()) !== digestSfValue([...binding.selection.fields].sort()) || digestSfValue(produced.value.period) !== digestSfValue(binding.selection.period) || digestSfValue(produced.value.comparison?.before) !== digestSfValue(choice.comparison) || digestSfValue(produced.value.comparison?.resultBefore) !== digestSfValue(choice.result)) return undefined
    const again = await input.registry.list(input.caseRef, call)
    const refreshed = await input.cases.read({ caseRef: encodeCaseRef(input.caseRef) }, call)
    if (again.status !== "ok" || again.records.filter((record) => digestSfValue(record) === digestSfValue(binding)).length !== 1 || refreshed.status !== "ok" || digestSfValue(refreshed.value.case) !== digestSfValue(current.value.case) || request.signal.aborted || !await input.host.revalidate(call)) return undefined
    return { condition: { id: binding.id, source: binding.selection.source, fields: binding.selection.fields, period: binding.selection.period, criterionId: binding.selection.criterionId, choice }, change: produced.value }
  } })
}
