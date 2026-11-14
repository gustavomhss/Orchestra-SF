import type { DomainProjection, ProductContext } from "../contracts/context.ts"

export function routineContextMaterial(context: ProductContext) {
  return { ...context, sourceRefs: context.sourceRefs.map((ref) => ({ ...ref, observedAt: "" })) }
}

/** Reading the same authorized source later changes its observation time, not its material content. */
export function routineProjectionMaterial(projection: DomainProjection) {
  return {
    ...projection,
    context: projection.context ? routineContextMaterial(projection.context) : undefined,
    components: projection.components.map((component) => ({ ...component, sourceRefs: component.sourceRefs.map((ref) => ({ ...ref, observedAt: "" })) })),
  }
}
