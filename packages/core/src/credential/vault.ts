export * as CredentialVault from "./vault"

import { Schema, type Effect } from "effect"
import type { ConnectionAccess } from "@orchestra/schema/connection-access"
import type { TeamProfile } from "@orchestra/schema/sucafina/team-profile"

export class Denied extends Schema.TaggedErrorClass<Denied>()("CredentialVault.Denied", {
  reason: Schema.Literals(["unavailable", "forbidden", "conflict", "invalid-value"]),
}) {
  override get message() { return "The personal connection is unavailable in the current profile." }
}
export interface Stored {
  readonly metadata: ConnectionAccess.Metadata
  readonly encodedValue?: string
}
/** Process-local only. Secret values are consumed by provider/MCP adapters, never browser metadata. */
export interface Interface {
  readonly owner: TeamProfile.Owner
  readonly check: (action: ConnectionAccess.Action, resource: ConnectionAccess.Resource) => Effect.Effect<void, Denied>
  readonly list: (category: ConnectionAccess.Category, resourceId?: string) => Effect.Effect<ReadonlyArray<ConnectionAccess.Metadata>, Denied>
  readonly read: (key: ConnectionAccess.Key) => Effect.Effect<Stored | undefined, Denied>
  readonly write: (input: ConnectionAccess.Write) => Effect.Effect<Stored, Denied>
  readonly remove: (input: ConnectionAccess.Remove) => Effect.Effect<void, Denied>
}
/** The Owner service supplies a private generation fence for the final SQL authorization boundary. */
export type Factory = (fence: () => Effect.Effect<boolean>) => Effect.Effect<Interface | undefined>
