import type { DomainProjection } from "../contracts/context.ts"
import { decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import { presentSensitivity } from "./catalog.ts"
import { resolveTimeline } from "./milestones.ts"
import { resolveBiPresentation } from "./semantics.ts"
import type { BiPresentation } from "./semantics.ts"
import { resolveWaterfall } from "./waterfall.ts"

/** Capture the same producer data as BI; the export host must reauthorize every source. */
export function captureBiReviewChart(projection: DomainProjection, presentation: BiPresentation) {
  const resolved = resolveBiPresentation(projection, presentation)
  if (resolved.status !== "ok") return resolved
  if ((presentation.viewId === "BI02" || presentation.viewId === "BI09") && !presentation.waterfall) return { status: "unavailable", reason: "waterfall-unavailable" } as const
  if ((presentation.viewId === "BI08" || presentation.viewId === "BI10") && !presentation.timeline) return { status: "unavailable", reason: "timeline-unavailable" } as const
  if (presentation.viewId === "BI04" && (!resolved.series.some((series) => series.role === "fte") || !resolved.series.some((series) => series.role === "cost") || resolved.series.some((series) => !series.alignmentKeys || JSON.stringify(series.alignmentKeys) !== JSON.stringify(resolved.series[0]?.alignmentKeys)))) return { status: "unavailable", reason: "capacity-alignment-unavailable" } as const
  if (["BI01", "BI03", "BI04", "BI05", "BI06", "BI07"].includes(presentation.viewId) && !resolved.series.some((series) => series.values.some((value) => value.evidenceState !== "absent" && typeof value.value === "number" && Number.isFinite(value.value)))) return { status: "unavailable", reason: "numeric-data-unavailable" } as const
  const sensitivity = projection.decision?.kind === "scenario" ? projection.decision.sensitivity : undefined
  if (presentation.viewId === "BI11") {
    if (projection.decision?.kind !== "scenario" || !("sensitivityResultRef" in projection.decision) || typeof projection.decision.sensitivityResultRef !== "string" || !projection.decision.sensitivityResultRef.trim() || !sensitivity || !sensitivity.parameterUnit?.trim() || !sensitivity.resultUnit?.trim() || !decodeSfOperationOutput("sf_sensitivity_evaluate", sensitivity).ok) return { status: "unavailable", reason: "sensitivity-unavailable" } as const
    const checked = presentSensitivity(sensitivity)
    if (!checked.evaluated.some((point) => point.parameterValue !== null && point.value !== null)) return { status: "unavailable", reason: "sensitivity-points-unavailable" } as const
    if (checked.thresholdEvidence.state !== sensitivity.thresholdEvidence.state || checked.threshold !== sensitivity.threshold || checked.comparisonStatus !== sensitivity.comparisonStatus) return { status: "unavailable", reason: "sensitivity-evidence-invalid" } as const
  }
  const waterfall = presentation.waterfall ? resolveWaterfall(projection, presentation.waterfall) : undefined
  const timeline = presentation.timeline ? resolveTimeline(projection, presentation.timeline) : undefined
  if (waterfall?.status === "ok") {
    const ids = new Set([presentation.waterfall!.finalValueId, ...presentation.waterfall!.segments.flatMap((segment) => [segment.startValueId, segment.endValueId, segment.componentValueId])])
    if (projection.values.some((value) => ids.has(value.id) && value.evidenceState === "absent" && value.value !== null)) return { status: "unavailable", reason: "waterfall-evidence-invalid" } as const
  }
  return {
    ...resolved,
    ...(waterfall ? { waterfall: waterfall.status === "ok" ? { ...waterfall, finalValueId: presentation.waterfall!.finalValueId } : waterfall } : {}),
    ...(timeline ? { timeline } : {}),
    ...(presentation.viewId === "BI11" && sensitivity?.parameterUnit?.trim() && sensitivity.resultUnit?.trim() ? { sensitivity: { result: sensitivity, parameterUnit: sensitivity.parameterUnit, resultUnit: sensitivity.resultUnit } } : {}),
  }
}
