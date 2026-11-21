import type { SfContext } from "@orchestra/schema/sucafina/context"
import type { SfNativeRouteCandidate } from "../route-registry"

const views = ["BI01", "BI02", "BI03", "BI04", "BI05", "BI06", "BI07", "BI08", "BI09", "BI10", "BI11"] as const
export function isBiSurface(id: string): boolean {
  return id === "UI45" || id === "UI46"
}
/** Opaque path decoding is already done by Q01. A valid ID is still only a selector. */
export function validBiRoute(candidate: SfNativeRouteCandidate, params: URLSearchParams): boolean {
  if (candidate.chapterId !== "sf-bi" || candidate.kind !== "entry" ||
      !(candidate.surfaceId === "UI45" || candidate.surfaceId === "UI46")) return false
  if (candidate.surfaceId === "UI46" && !views.some((id) => id === candidate.parameters.viewId)) return false
  const keys = [...params.keys()]
  if (new Set(keys).size !== keys.length || keys.some((key) => !["server", "project", "installation"].includes(key))) return false
  const selectors = ["server", "project", "installation"].map((key) => params.get(key))
  return selectors.every((value) => value === null) || selectors.every((value) => !!value)
}
/** Availability is a prerequisite; original producer reads remain authoritative. */
export function biRouteAvailable(context: SfContext, candidate: SfNativeRouteCandidate): boolean {
  const ready = (id: string, resources: readonly string[]) => context.availability.some((resource) =>
    resource.family === "bi" && resources.includes(resource.resource) &&
    resource.operations.some((operation) => operation.operationId === id && operation.state === "ready" && operation.operational))
  if (!ready("bi.bi-options", ["catalog"])) return false
  return candidate.surfaceId === "UI45" ||
    candidate.surfaceId === "UI46" && ready("bi.bi-data", ["catalog", "visual"])
}
