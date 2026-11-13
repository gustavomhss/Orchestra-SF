import { decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { DomainProjection } from "../contracts/context.ts"
import type { ReviewChart } from "./port.ts"

/** A BI11 figure must name and exactly preserve the producer-owned sensitivity result. */
export function isReviewSensitivityBound(projection: DomainProjection, chart: ReviewChart | undefined) {
  if (!chart || chart.status !== "ok" || !chart.sensitivity || projection.decision?.kind !== "scenario") return false
  const decision = projection.decision as typeof projection.decision & { sensitivityResultRef?: string }
  return typeof decision.sensitivityResultRef === "string" && !!decision.sensitivityResultRef.trim() && !!decision.sensitivity && decodeSfOperationOutput("sf_sensitivity_evaluate", decision.sensitivity).ok && decodeSfOperationOutput("sf_sensitivity_evaluate", chart.sensitivity.result).ok && digestSfValue(decision.sensitivity) === digestSfValue(chart.sensitivity.result) && !!decision.sensitivity.parameterUnit && !!decision.sensitivity.resultUnit && decision.sensitivity.parameterUnit === chart.sensitivity.parameterUnit && decision.sensitivity.resultUnit === chart.sensitivity.resultUnit
}
