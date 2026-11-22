/**
 * Durable ownership provenance. This event is deliberately absent from public
 * manifests. A payload is not authority: replay requires a separately admitted
 * owner mapping and must preserve the original owner and generation.
 */
import { Schema } from "effect"
import { Event } from "./event"
import { SessionID } from "./session-id"
import { DateTimeUtcFromMillis, PositiveInt } from "./schema"
import { TeamProfile } from "./sucafina/team-profile"

export * as SessionOwnerEvent from "./session-owner-event"

export const Bound = Event.define({
  type: "session.owner.bound",
  durable: { aggregate: "sessionID", version: 1 },
  schema: {
    sessionID: SessionID,
    timestamp: DateTimeUtcFromMillis,
    owner: TeamProfile.Owner,
    generation: PositiveInt,
  },
})
export type Bound = typeof Bound.Type

export const Definitions = [Bound] as const
