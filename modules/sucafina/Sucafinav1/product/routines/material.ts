import type { DomainProjection } from "../contracts/context.ts"

/** Reading the same authorized source later changes its observation time, not its material content. */
export function routineProjectionMaterial(projection: DomainProjection) {
  return {
    ...projection,
    context: projection.context ? { ...projection.context, sourceRefs: projection.context.sourceRefs.map((ref) => ({ ...ref, observedAt: "" })) } : undefined,
    components: projection.components.map((component) => ({ ...component, sourceRefs: component.sourceRefs.map((ref) => ({ ...ref, observedAt: "" })) })),
  }
}
