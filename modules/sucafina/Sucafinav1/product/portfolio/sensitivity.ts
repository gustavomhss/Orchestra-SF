import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { ScenarioResult } from "../contracts/decisions.ts"
import type { SensitivityRequest } from "../contracts/operations.ts"
import type { UnresolvedCondition } from "../contracts/outputs.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SensitivityLegacyResult } from "./sensitivity-v6.ts"

type SensitivitySample = { resultRef: string; scenario: ScenarioResult; criterionValue: number | null; parameterUnit: string; resultUnit: string; unitMetadataRef: string; unitMetadataVersion: number }
export type SensitivitySampledResult = SensitivityLegacyResult & { parameterUnit: string; resultUnit: string }

export type SensitivityHost = {
  sample: (request: SensitivityRequest, parameterValue: number, context: TrustedDomainContext) => Promise<PortResult<SensitivitySample>>
  // Only a domain-proven exact threshold may be returned here; sampling alone is not proof.
  exactThreshold: (request: SensitivityRequest, context: TrustedDomainContext) => Promise<PortResult<{ value: number | null; evidenceRefs: readonly BusinessEvidenceRef[] }>>
  revalidate: (samples: readonly SensitivitySample[], thresholdEvidence: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => Promise<boolean>
}

export function createSensitivityEvaluator(host: SensitivityHost) {
  return async (incoming: SensitivityRequest, context: TrustedDomainContext): Promise<PortResult<SensitivitySampledResult>> => {
    const request = structuredClone(incoming)
    const bounds = request.parameterBounds
    if (!Number.isFinite(bounds.minimum) || !Number.isFinite(bounds.maximum) || bounds.minimum > bounds.maximum || !Number.isSafeInteger(bounds.steps) || bounds.steps < 1 || bounds.steps > 1024 || !Number.isFinite(request.criterion.value)) return { status: "needs-input", reason: "invalid-parameter-bounds" }
    const values = Array.from({ length: bounds.steps + 1 }, (_, index) => index === bounds.steps ? bounds.maximum : bounds.minimum + (bounds.maximum - bounds.minimum) * index / bounds.steps)
    if (values.some((value) => !Number.isFinite(value))) return { status: "needs-input", reason: "parameter-range-overflow" }
    const samples: (SensitivitySample & { parameterValue: number })[] = []
    for (const value of values) {
      const sample = await host.sample(structuredClone(request), value, context)
      if (sample.status !== "ok") return sample
      if (!sample.value.resultRef || typeof sample.value.parameterUnit !== "string" || !sample.value.parameterUnit.trim() || typeof sample.value.resultUnit !== "string" || !sample.value.resultUnit.trim() || typeof sample.value.unitMetadataRef !== "string" || !sample.value.unitMetadataRef.trim() || !Number.isSafeInteger(sample.value.unitMetadataVersion) || sample.value.unitMetadataVersion < 1 || (sample.value.criterionValue !== null && !Number.isFinite(sample.value.criterionValue))) return { status: "unavailable", reason: "invalid-domain-sample" }
      if (samples.some((previous) => previous.resultRef === sample.value.resultRef && previous.parameterValue !== value)) return { status: "unavailable", reason: "sample-reference-reused" }
      samples.push({ parameterValue: value, ...structuredClone(sample.value) })
    }
    if (samples.some((sample) => sample.scenario.currency !== samples[0].scenario.currency || sample.scenario.horizon.start !== samples[0].scenario.horizon.start || sample.scenario.horizon.end !== samples[0].scenario.horizon.end)) return { status: "unavailable", reason: "sample-scope-mismatch" }
    if (samples.some((sample) => sample.parameterUnit !== samples[0].parameterUnit || sample.resultUnit !== samples[0].resultUnit || sample.unitMetadataRef !== samples[0].unitMetadataRef || sample.unitMetadataVersion !== samples[0].unitMetadataVersion)) return { status: "unavailable", reason: "unit-metadata-mismatch" }
    const exact = structuredClone(await host.exactThreshold(structuredClone(request), context))
    if (exact.status !== "ok" && exact.status !== "unavailable") return exact
    const proposedThreshold = exact.status === "ok" ? exact.value.value : null
    if (proposedThreshold !== null && exact.status === "ok" && !exact.value.evidenceRefs.length) return { status: "unavailable", reason: "threshold-evidence-unavailable" }
    if (proposedThreshold !== null && (!Number.isFinite(proposedThreshold) || proposedThreshold < bounds.minimum || proposedThreshold > bounds.maximum)) return { status: "unavailable", reason: "invalid-domain-threshold" }
    if (!await host.revalidate(structuredClone(samples), exact.status === "ok" ? structuredClone(exact.value.evidenceRefs) : [], context)) return { status: "stale", reason: "source-or-authority-changed" }
    const incomplete = samples.some((sample) => sample.scenario.comparisonStatus !== "complete" || sample.criterionValue === null || sample.scenario.costCoverage.coverageState !== "complete" || sample.scenario.unresolvedConditions.length > 0 || sample.scenario.costCoverage.issues.length > 0 || sample.scenario.costCoverage.entries.length === 0 || sample.scenario.costCoverage.evaluatedSourceRefs.length === 0 || sample.scenario.costCoverage.entries.some((entry) => entry.evidenceRefs.length === 0) || sample.scenario.components.some((component) => component.amount === null || !Number.isFinite(component.amount) || component.evidenceState !== "confirmed" || component.sourceRefs.length === 0))
    const unavailable = samples.some((sample) => sample.scenario.comparisonStatus === "unavailable")
    const incompatible = samples.some((sample) => sample.scenario.comparisonStatus === "incompatible")
    const threshold = incomplete || unavailable || incompatible ? null : proposedThreshold
    const conditions: UnresolvedCondition[] = samples.flatMap((sample) => [...sample.scenario.unresolvedConditions, ...(sample.scenario.costCoverage.coverageState === "complete" ? [] : [`coverage:${sample.scenario.costCoverage.coverageState}`]), ...sample.scenario.costCoverage.issues, ...sample.scenario.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [`${entry.categoryId}:${entry.reason}`] : []), ...sample.scenario.costCoverage.derivedMissingCategoryIds.map((id) => `missing-category:${id}`)].map((reason) => ({ id: `${sample.resultRef}:${reason}`, category: "coverage", reason, evidenceRefs: sample.scenario.sourceRefs })))
    for (const sample of samples) {
      if (sample.criterionValue === null) conditions.push({ id: `${sample.resultRef}:criterion-unavailable`, category: "quantification", reason: "Criterion value is unavailable.", evidenceRefs: sample.scenario.sourceRefs })
      for (const component of sample.scenario.components.filter((item) => item.amount === null || item.evidenceState !== "confirmed" || !item.sourceRefs.length)) conditions.push({ id: `${sample.resultRef}:component:${component.id}`, category: "quantification", reason: `Component ${component.id} is not currently confirmed and quantified.`, evidenceRefs: sample.scenario.sourceRefs })
    }
    if (threshold === null) conditions.push({ id: "sampled-range", category: "precision", reason: "No exact threshold was established by the domain; values are sampled points only.", evidenceRefs: [] })
    return { status: "ok", value: { parameterUnit: samples[0].parameterUnit, resultUnit: samples[0].resultUnit, scenarioRef: request.scenarioRef, parameterRef: bounds.parameterRef, bounds: { minimum: bounds.minimum, maximum: bounds.maximum, steps: bounds.steps }, evaluated: samples.map((sample) => ({ parameterValue: sample.parameterValue, resultRef: sample.resultRef, value: sample.criterionValue })), threshold, comparisonStatus: unavailable ? "unavailable" : incompatible ? "incompatible" : incomplete ? "conditioned" : "complete", unresolvedConditions: conditions, evidenceRefs: [...samples.flatMap((sample) => [...sample.scenario.sourceRefs, ...sample.scenario.costCoverage.evaluatedSourceRefs, ...sample.scenario.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]), ...(threshold !== null && exact.status === "ok" ? exact.value.evidenceRefs : [])] } }
  }
}
