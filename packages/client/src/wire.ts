import type { SessionEventTransport } from "@orchestra/protocol/groups/session"
import type { Schema } from "effect"

/** Public stream envelope; the canonical durable event remains its unchanged event member. */
export type SessionEventEncoded = Schema.Codec.Encoded<typeof SessionEventTransport>
