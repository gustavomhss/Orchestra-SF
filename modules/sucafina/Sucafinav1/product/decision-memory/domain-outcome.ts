import { digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainProjection, Period } from "../contracts/context.ts"
import type { DecisionCasePort, DomainPortHost } from "../contracts/ports.ts"
import type { ObservedResultProjection } from "../contracts/decisions.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import { encodeCaseRef } from "../decisions/case-port.ts"
import { createSfObservedOutcomeAccess } from "./outcome.ts"

export type SfOutcomeSelection = { caseRef: ObservedResultProjection["caseRef"]; choiceId: string; criterionRef: string; valueId: string; period: Period; evidenceRefs: readonly BusinessEvidenceRef[] }

/** Host selection and the domain port own the observation, cutoff, coverage and authority. */
export function createSfDomainOutcomeAccess(input: {
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  cases: Pick<DecisionCasePort, "read">
  select: (request: { caseRef: ObservedResultProjection["caseRef"]; choiceId: string }, call: TrustedDomainContext) => Promise<SfOutcomeSelection | undefined>
  readProjection: (selection: SfOutcomeSelection, call: TrustedDomainContext) => Promise<{ projection: DomainProjection; unit: string; cutoff: string; coverage: "complete" | "partial" | "unknown"; limitations: readonly string[] } | undefined>
  authorizeEvidence: (refs: readonly BusinessEvidenceRef[], call: TrustedDomainContext) => Promise<boolean>
}) {
  return createSfObservedOutcomeAccess({ revalidate: input.host.revalidate, authorizeEvidence: input.authorizeEvidence, load: async (caseRef, choiceId, call) => {
    const request = input.host.requestFor(call)
    if (!request || request.signal.aborted || !await input.host.revalidate(call)) return undefined
    const selection = await input.select({ caseRef, choiceId }, call)
    if (!selection || digestSfValue(selection.caseRef) !== digestSfValue(caseRef) || selection.choiceId !== choiceId || !selection.criterionRef.trim() || !selection.valueId.trim() || !isSfPeriod(selection.period) || !selection.evidenceRefs.length) return undefined
    const current = await input.cases.read({ caseRef: encodeCaseRef(caseRef) }, call)
    if (current.status !== "ok" || current.value.case.id !== caseRef.id || current.value.case.incarnation !== caseRef.incarnation || current.value.case.version !== caseRef.version) return undefined
    const choices = current.value.case.choices.filter((choice) => choice.id === choiceId)
    if (choices.length !== 1 || !choices[0]!.criteria.includes(selection.criterionRef) || current.value.case.criteria.filter((criterion) => criterion.id === selection.criterionRef).length !== 1) return undefined
    const values = choices[0]!.values.filter((value) => value.criterionRef === selection.criterionRef && digestSfValue(value.horizon) === digestSfValue(selection.period))
    const expected = values.length === 1 ? values[0] : undefined
    if (!expected || expected.value === null || !Number.isFinite(expected.value)) return undefined
    const observed = await input.readProjection(selection, call)
    if (!observed || !Number.isFinite(Date.parse(observed.cutoff)) || !observed.unit.trim() || observed.projection.context.installationId !== call.binding.installationId || observed.projection.context.projectId !== call.binding.projectId || observed.projection.context.principalRef !== call.binding.principalRef || observed.projection.context.accessRevision !== call.binding.accessRevision || observed.projection.context.policyVersion !== call.binding.policyVersion || observed.projection.context.currency !== expected.currency || digestSfValue(observed.projection.context.period) !== digestSfValue(selection.period)) return undefined
    const matches = observed.projection.values.filter((value) => value.id === selection.valueId)
    const actual = matches.length === 1 ? matches[0] : undefined
    if (!actual || typeof actual.value !== "number" || !Number.isFinite(actual.value) || actual.evidenceState !== "confirmed" || !actual.unit || actual.unit !== observed.unit || actual.unit !== expected.unit || !actual.sourceRefs.length || actual.sourceRefs.some((ref) => (ref.kind === "record" && ref.target.surface !== observed.projection.context.surface) || !selection.evidenceRefs.some((allowed) => digestSfValue(ref) === digestSfValue(allowed))) || digestSfValue(actual.period) !== digestSfValue(selection.period) || observed.unit !== expected.unit || actual.currency !== expected.currency) return undefined
    const selectedAgain = await input.select({ caseRef, choiceId }, call)
    const projectionAgain = await input.readProjection(selection, call)
    const caseAgain = await input.cases.read({ caseRef: encodeCaseRef(caseRef) }, call)
    if (!selectedAgain || digestSfValue(selectedAgain) !== digestSfValue(selection) || !projectionAgain || projectionAgain.cutoff !== observed.cutoff || projectionFingerprint(projectionAgain) !== projectionFingerprint(observed) || caseAgain.status !== "ok" || caseAgain.value.case.id !== caseRef.id || caseAgain.value.case.incarnation !== caseRef.incarnation || digestSfValue(caseAgain.value.case) !== digestSfValue(current.value.case) || request.signal.aborted || !await input.host.revalidate(call)) return undefined
    return { caseRef, choice: choices[0]!, observation: { caseRef, expected: expected.value, observed: actual.value, cutoff: observed.cutoff, currency: expected.currency, sourceRefs: actual.sourceRefs, limitations: observed.limitations }, metric: { criterionRef: selection.criterionRef, unit: expected.unit, period: selection.period, coverage: observed.coverage } }
  } })
}

function projectionFingerprint(value: { projection: DomainProjection; unit: string; coverage: "complete" | "partial" | "unknown"; limitations: readonly string[] }) {
  const projection = value.projection
  return digestSfValue({ projection: { ...projection, context: { ...projection.context, sourceRefs: projection.context.sourceRefs.map((ref) => ({ ...ref, observedAt: "" })) }, components: projection.components.map((component) => ({ ...component, sourceRefs: component.sourceRefs.map((ref) => ({ ...ref, observedAt: "" })) })) }, unit: value.unit, coverage: value.coverage, limitations: value.limitations })
}
