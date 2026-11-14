import type { SensitivityResult } from "../contracts/outputs.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { SensitivityRequest } from "../contracts/operations.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"

// Prepared locally for the S0 contract delta; do not register against the v5 schema.
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
  if (evidence.state === "exact" && (input.result.comparisonStatus !== "complete" || !Number.isFinite(evidence.value) || evidence.value < input.result.bounds.minimum || evidence.value > input.result.bounds.maximum || input.result.threshold !== evidence.value || !evidence.evidenceRefs.length)) return { status: "conflict", reason: "threshold-evidence-mismatch" }
  if (evidence.state === "sampled" && (input.result.threshold !== null || !Number.isFinite(evidence.interval.minimum) || !Number.isFinite(evidence.interval.maximum) || evidence.interval.minimum > evidence.interval.maximum || evidence.interval.minimum < input.result.bounds.minimum || evidence.interval.maximum > input.result.bounds.maximum || !input.result.evaluated.some((point) => point.parameterValue === evidence.interval.minimum) || !input.result.evaluated.some((point) => point.parameterValue === evidence.interval.maximum) || !evidence.evidenceRefs.length)) return { status: "conflict", reason: "sampled-interval-mismatch" }
  if (evidence.state === "unavailable" && (input.result.threshold !== null || !evidence.reason.trim())) return { status: "conflict", reason: "threshold-unavailable-mismatch" }
  return { status: "ok", value: { ...input.result, costCoverageRefs: input.costCoverageRefs, unit: input.unit, engineVersion: input.engineVersion, thresholdEvidence: evidence } }
}

/** Compose only after the v6 schema is published and the host can resolve current coverage. */
export function createSensitivityV6Evaluator(input: {
  evaluate: (request: SensitivityRequest, context: TrustedDomainContext) => Promise<PortResult<SensitivityLegacyResult>>
  describe: (result: SensitivityLegacyResult, context: TrustedDomainContext) => Promise<PortResult<{ costCoverageRefs: readonly string[]; unit: string; engineVersion: string; thresholdEvidence: SensitivityThresholdEvidence }>>
  revalidate: (result: SensitivityResultV6, context: TrustedDomainContext) => Promise<boolean>
}) {
  return async (request: SensitivityRequest, context: TrustedDomainContext): Promise<PortResult<SensitivityResultV6>> => {
    const result = await input.evaluate(request, context)
    if (result.status !== "ok") return result
    const description = await input.describe(result.value, context)
    if (description.status !== "ok") return description
    const enriched = attachSensitivityV6({ result: result.value, ...description.value })
    if (enriched.status !== "ok") return enriched
    if (!await input.revalidate(enriched.value, context)) return { status: "stale", reason: "source-or-authority-changed" }
    return enriched
  }
}
