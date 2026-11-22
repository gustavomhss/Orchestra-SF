import type { SessionEventTransport } from "@orchestra/protocol/groups/session"
import type { SessionEvent } from "@orchestra/schema/session-event"
import type { Schema } from "effect"

export type SessionEventEncoded = Schema.Codec.Encoded<typeof SessionEvent.Durable>

/** Installed streams label the unchanged durable event with its current owner namespace. */
export type SessionEventTransportEncoded = Schema.Codec.Encoded<typeof SessionEventTransport>
