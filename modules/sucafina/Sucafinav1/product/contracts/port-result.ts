export type PortResult<T> =
  | { status: "ok"; value: T }
  | { status: "needs-input" | "stale" | "denied" | "unavailable" | "conflict" | "provider-conflict" | "failed"; reason: string }
