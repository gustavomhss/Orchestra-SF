import { Schema } from "effect"
import { SessionID } from "./session-id"

export * as SessionAccess from "./session-access"

/** Explicit installation policy actions. Team eligibility and surface roles never supply these grants. */
export const Actions = ["read", "create", "fork", "move", "write", "prompt", "run", "model", "control", "replay"] as const
export const Action = Schema.Literals(Actions).annotate({ identifier: "SessionAccess.Action" })
export type Action = typeof Action.Type

/** Bound below SQLite's smallest supported parameter budget; overflow is unavailable, never truncated. */
export const ExcludedSessions = Schema.Array(SessionID).check(
  Schema.isMaxLength(500),
  Schema.makeFilter((ids) => new Set(ids).size === ids.length, { message: "Session resource exceptions must be unique" }),
).annotate({ identifier: "SessionAccess.ExcludedSessions" })
export type ExcludedSessions = typeof ExcludedSessions.Type
