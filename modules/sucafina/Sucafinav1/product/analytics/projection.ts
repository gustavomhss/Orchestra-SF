import type { DomainProjection } from "../contracts/context.ts"
import { digestSfValue } from "../contracts/canonical.ts"

/** Observation time changes on each authorized read; source identity and all data stay compared. */
export function sameBiProjection(left: DomainProjection, right: DomainProjection) {
  const normalize = (projection: DomainProjection) => ({
    ...projection,
    context: { ...projection.context, sourceRefs: projection.context.sourceRefs.map((reference) => ({ ...reference, observedAt: "" })) },
    components: projection.components.map((component) => ({ ...component, sourceRefs: component.sourceRefs.map((reference) => ({ ...reference, observedAt: "" })) })),
  })
  return digestSfValue(normalize(left)) === digestSfValue(normalize(right))
}
