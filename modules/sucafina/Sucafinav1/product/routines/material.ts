import type { DomainProjection, ProductContext } from "../contracts/context.ts"

export function routineContextMaterial(context: ProductContext) {
  return { ...context, sourceRefs: context.sourceRefs.map((ref) => ({ ...ref, observedAt: "" })) }
}

/** Reading the same authorized source later changes its observation time, not its material content. */
export function routineProjectionMaterial(projection: DomainProjection) {
  return {
    ...projection,
    context: projection.context ? routineContextMaterial(projection.context) : undefined,
    // Procurement's stage age advances with the read clock; its source identity,
    // availability and stage entry date remain material and are still compared.
    values: projection.values.map((value) => routineValueMaterial(projection, value)),
    components: projection.components.map((component) => ({ ...component, sourceRefs: component.sourceRefs.map((ref) => ({ ...ref, observedAt: "" })) })),
  }
}

export function routineValueMaterial(projection: DomainProjection, value: DomainProjection["values"][number]) {
  return projection.context.surface === "procurement" && projection.engineVersion === "procurement-v1" && value.id === "ageDays" && value.unit === "days" && typeof value.value === "number" && Number.isFinite(value.value) && value.sourceRefs.length > 0 && value.sourceRefs.every((ref) => ref.kind === "record" && ref.target.surface === "procurement" && ref.target.recordType === "requests" && ref.target.fields.includes("ageDays"))
    ? { ...value, value: "derived-stage-age" } : value
}

