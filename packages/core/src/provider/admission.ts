export * as ProviderAdmission from "./admission"

import { Schema, type Effect } from "effect"
import type { ProviderAccess } from "@orchestra/schema/provider-access"
import type { TeamProfile } from "@orchestra/schema/sucafina/team-profile"

export class Denied extends Schema.TaggedErrorClass<Denied>()("ProviderAdmission.Denied", {
  reason: Schema.Literals(["unavailable", "forbidden", "stale"]),
}) {
  override get message() { return "The private provider is unavailable in the current profile." }
}
/** Server-created capability. These declarations never contain credentials or executable adapters. */
export interface Interface {
  readonly owner: TeamProfile.Owner
  readonly list: () => Effect.Effect<ProviderAccess.Bindings, Denied>
  readonly verify: (binding: ProviderAccess.Binding) => Effect.Effect<void, Denied>
}
export type Factory = (fence: () => Effect.Effect<boolean>) => Effect.Effect<Interface | undefined>
