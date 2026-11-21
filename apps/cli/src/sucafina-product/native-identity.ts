import { Location } from "@orchestra/core/location"
import { ModelV2 } from "@orchestra/core/model"

/** Match Core SessionStore's persisted identity before grants and run records capture it. */
export function sfNativeLocationRef(ref: Location.Ref) {
  return Location.Ref.make({ directory: ref.directory, workspaceID: ref.workspaceID })
}

export function sfNativeModelRef(ref: ModelV2.Ref) {
  return ModelV2.Ref.make({ providerID: ref.providerID, id: ref.id,
    variant: ref.variant ?? ModelV2.VariantID.make("default") })
}
