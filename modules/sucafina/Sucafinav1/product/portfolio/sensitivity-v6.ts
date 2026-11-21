import type { SensitivityResult } from "../contracts/outputs.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { SensitivityRequest } from "../contracts/operations.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"

// C07 keeps mathematical threshold precision separate from C10 decision completeness.
export type SensitivityThresholdEvidence = SensitivityResult["thresholdEvidence"]
export type SensitivityResultV6 = SensitivityResult
export type SensitivityLegacyResult = Omit<SensitivityResult, "costCoverageRefs" | "unit" | "engineVersion" | "thresholdEvidence">

export function attachSensitivityV6(input: {
  result: SensitivityLegacyResult
  costCoverageRefs: readonly string[]
  unit: string
  engineVersion: string
  thresholdEvidence: SensitivityThresholdEvidence
}): PortResult<SensitivityResultV6> {
  if (!input.result.parameterUnit?.trim() || !input.result.resultUnit?.trim()) return { status: "unavailable", reason: "sensitivity-units-unavailable" }
  if (!input.unit.trim() || !input.engineVersion.trim() || !input.costCoverageRefs.length || input.costCoverageRefs.some((ref) => !ref.trim())) return { status: "needs-input", reason: "sensitivity-provenance-required" }
  const evidence = input.thresholdEvidence
  if (evidence.state === "exact" && (["incompatible", "unavailable"].includes(input.result.comparisonStatus) || !Number.isFinite(evidence.value) || evidence.value < input.result.bounds.minimum || evidence.value > input.result.bounds.maximum || input.result.threshold !== evidence.value || !evidence.evidenceRefs.length || input.result.evaluated.some((point) => point.value === null))) return { status: "conflict", reason: "threshold-evidence-mismatch" }
  if (evidence.state === "sampled" && (input.result.threshold !== null || !Number.isFinite(evidence.interval.minimum) || !Number.isFinite(evidence.interval.maximum) || evidence.interval.minimum > evidence.interval.maximum || evidence.interval.minimum < input.result.bounds.minimum || evidence.interval.maximum > input.result.bounds.maximum || !input.result.evaluated.some((point) => point.parameterValue === evidence.interval.minimum) || !input.result.evaluated.some((point) => point.parameterValue === evidence.interval.maximum) || !evidence.evidenceRefs.length)) return { status: "conflict", reason: "sampled-interval-mismatch" }
  if (evidence.state === "unavailable" && (input.result.threshold !== null || !evidence.reason.trim())) return { status: "conflict", reason: "threshold-unavailable-mismatch" }
  return { status: "ok", value: { ...input.result, costCoverageRefs: input.costCoverageRefs, unit: input.unit, engineVersion: input.engineVersion, thresholdEvidence: evidence } }
}

/** Attach the published C07 metadata and revalidate current coverage before disclosure. */
export function createSensitivityV6Evaluator(input: {
  evaluate: (request: SensitivityRequest, context: TrustedDomainContext) => Promise<PortResult<SensitivityLegacyResult>>
  describe: (result: SensitivityLegacyResult, context: TrustedDomainContext) => Promise<PortResult<{ costCoverageRefs: readonly string[]; unit: string; engineVersion: string; thresholdEvidence: SensitivityThresholdEvidence }>>
  revalidate: (result: SensitivityResultV6, context: TrustedDomainContext) => Promise<boolean>
}) {
  return async (request: SensitivityRequest, context: TrustedDomainContext): Promise<PortResult<SensitivityResultV6>> => {
    const result = structuredClone(await input.evaluate(structuredClone(request), context))
    if (result.status !== "ok") return result
    const described = structuredClone(result.value)
    const describedDigest = digestSfValue(described)
    const description = structuredClone(await input.describe(described, context))
    if (digestSfValue(described) !== describedDigest) return { status: "stale", reason: "source-or-authority-changed" }
    if (description.status !== "ok") return description
    const enriched = attachSensitivityV6({ result: result.value, ...description.value })
    if (enriched.status !== "ok") return enriched
    const observed = structuredClone(enriched.value)
    const observedDigest = digestSfValue(observed)
    if (!await input.revalidate(observed, context) || digestSfValue(observed) !== observedDigest) return { status: "stale", reason: "source-or-authority-changed" }
    return { status: "ok", value: structuredClone(enriched.value) }
  }
}
