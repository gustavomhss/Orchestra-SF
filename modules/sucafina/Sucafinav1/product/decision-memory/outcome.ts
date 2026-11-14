import { digestSfValue } from "../contracts/canonical.ts"
import type { Period } from "../contracts/context.ts"
import type { ChoiceRecord, ObservedResultProjection } from "../contracts/decisions.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import { isSfObservationTime, sfObservationTimeAdvances } from "./observation-time.ts"

/** Metadata must be supplied by the authorized observation producer, never inferred from totals. */
export function compareSfExpectedObserved(input: {
  caseRef: ObservedResultProjection["caseRef"]
  choice: ChoiceRecord
  observation: ObservedResultProjection
  metric: { criterionRef: string; unit: string; period: Period; coverage: "complete" | "partial" | "unknown" }
}) {
  const baseline = input.choice.values.filter((value) => value.criterionRef === input.metric.criterionRef && digestSfValue(value.horizon) === digestSfValue(input.metric.period))
  const value = baseline.length === 1 ? baseline[0] : undefined
  const observation = input.observation
  const reason = digestSfValue(input.caseRef) !== digestSfValue(observation.caseRef) ? "case-mismatch"
    : !value || !input.metric.unit || value.unit !== input.metric.unit ? "metric-or-unit-mismatch"
    : digestSfValue(value.horizon) !== digestSfValue(input.metric.period) ? "period-mismatch"
    : value.currency !== observation.currency ? "currency-mismatch"
    : input.choice.comparisonStatus !== "complete" || input.choice.comparison.comparisonStatus !== "complete" || input.choice.result.comparisonStatus !== "complete" || input.choice.costCoverage.coverageState !== "complete" || input.choice.result.costCoverage.coverageState !== "complete" || input.metric.coverage !== "complete" ? "coverage-incomplete"
    : digestSfValue(input.choice.costCoverage) !== digestSfValue(input.choice.result.costCoverage) || input.choice.result.currency !== value.currency || input.choice.result.horizon.start > input.metric.period.start || input.choice.result.horizon.end < input.metric.period.end ? "baseline-mismatch"
    : value.value === null || observation.expected === null || observation.observed === null ? "observation-incomplete"
    : !Number.isFinite(value.value) || !Number.isFinite(observation.expected) || !Number.isFinite(observation.observed) || value.value !== observation.expected ? "baseline-mismatch"
    : !Number.isFinite(observation.observed - value.value) ? "observation-out-of-range"
    : !observation.sourceRefs.length || !isSfObservationTime(observation.cutoff) ? "observation-unavailable"
    : undefined
  const compatibility = { metric: !!value, unit: !!value && value.unit === input.metric.unit && !!input.metric.unit, period: !!value && digestSfValue(value.horizon) === digestSfValue(input.metric.period), currency: !!value && value.currency === observation.currency, coverage: input.metric.coverage, compatible: !reason }
  if (reason || !value || value.value === null || observation.observed === null) return { status: "unavailable" as const, reason: reason ?? "observation-unavailable", compatibility, limitations: [...observation.limitations, "Observação não estabelece causalidade."] }
  return { status: "comparable" as const, caseRef: input.caseRef, choiceId: input.choice.id, criterionRef: value.criterionRef, unit: value.unit, currency: value.currency, period: value.horizon, expected: value.value, observed: observation.observed, delta: observation.observed - value.value, compatibility, summary: { facts: ["Comparação entre a base registrada e a observação autorizada."], pending: ["A observação, por si só, não confirma premissas nem estabelece causalidade."], causality: "not-attributed" as const }, cutoff: observation.cutoff, sourceRefs: observation.sourceRefs, baselineRefs: input.choice.evidenceRefs, limitations: [...observation.limitations, "Observação não estabelece causalidade."] }
}

/** The host must load the choice and observation under current case and source authority. */
export function createSfObservedOutcomeAccess(input: {
  load: (caseRef: ObservedResultProjection["caseRef"], choiceId: string, call: TrustedDomainContext) => Promise<Parameters<typeof compareSfExpectedObserved>[0] | undefined>
  authorizeEvidence: (refs: readonly BusinessEvidenceRef[], call: TrustedDomainContext) => Promise<boolean>
  revalidate: (call: TrustedDomainContext) => Promise<boolean>
}) {
  return async (request: { caseRef: ObservedResultProjection["caseRef"]; choiceId: string }, call: TrustedDomainContext) => {
    try {
      const wanted = structuredClone(request)
      const requestDigest = digestSfValue(wanted)
      const binding = digestSfValue([call.kind, call.binding])
      if (!wanted.caseRef.id.trim() || !wanted.caseRef.incarnation.trim() || !Number.isSafeInteger(wanted.caseRef.version) || wanted.caseRef.version < 1 || !wanted.choiceId.trim() || !await input.revalidate(call)) return { status: "unavailable" as const }
      const read = async () => {
        const loaded = await input.load(wanted.caseRef, wanted.choiceId, call)
        const value = loaded && structuredClone(loaded)
        if (!value || digestSfValue(value.caseRef) !== digestSfValue(wanted.caseRef) || value.choice.id !== wanted.choiceId) return undefined
        const valueDigest = digestSfValue(value)
        const evidence = outcomeEvidence(value)
        if (evidence.some((ref) => ref.installationId !== call.binding.installationId || ref.projectId !== call.binding.projectId) || !await input.authorizeEvidence(evidence, call) || digestSfValue(value) !== valueDigest) return undefined
        return value
      }
      const loaded = await read()
      const loadedDigest = digestSfValue(loaded)
      if (!loaded || !await input.revalidate(call) || digestSfValue(loaded) !== loadedDigest) return { status: "unavailable" as const }
      const again = await read()
      const againDigest = digestSfValue(again)
      if (!again || !await input.revalidate(call) || digestSfValue(loaded) !== loadedDigest || digestSfValue(again) !== againDigest || digestSfValue({ ...again, observation: { ...again.observation, cutoff: "" } }) !== digestSfValue({ ...loaded, observation: { ...loaded.observation, cutoff: "" } }) || !sfObservationTimeAdvances(loaded.observation.cutoff, again.observation.cutoff) || digestSfValue(wanted) !== requestDigest || digestSfValue(request) !== requestDigest || digestSfValue([call.kind, call.binding]) !== binding) return { status: "unavailable" as const }
      const result = compareSfExpectedObserved(again)
      return result.status === "comparable" ? { ...result, observation: structuredClone(again.observation) } : result
    } catch {
      return { status: "unavailable" as const }
    }
  }
}

function outcomeEvidence(value: Parameters<typeof compareSfExpectedObserved>[0]): readonly BusinessEvidenceRef[] {
  const choice = value.choice
  return [...choice.evidenceRefs, ...choice.scenario.assumptions.flatMap((item) => item.evidenceRefs), ...choice.result.sourceRefs, ...choice.costCoverage.evaluatedSourceRefs, ...choice.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs), ...choice.result.costCoverage.evaluatedSourceRefs, ...choice.result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs), ...value.observation.sourceRefs]
}
