import type { ScreenActor } from "../src/screen-shell.ts"
import type { Surface } from "../src/identity.ts"

export type Actor = ScreenActor & { domains?: string[] }
export type Command = {
  page: string
  action: string
  id?: string
  version: number
  values: Record<string, unknown>
  confirmed?: boolean
}
export type Audit = {
  who: string
  name?: string
  at: string
  record: string
  was: unknown
  became: unknown
}
export type Notice = {
  kind: "pending" | "approved" | "rejected" | "supplier-pending"
  to: string[]
  record: string
  at: string
}
export type Snapshot = {
  data: Record<string, unknown>
  versions: Record<string, { version: number; by: string }>
  sequences: Record<string, number>
  audit: Audit[]
  notices: Notice[]
  sfCommandPreviews?: Record<string, { principalRef: string; actorDigest: string; command: Command; baseDigest: string; commandDigest: string; ids: string[]; expiresAt: string; receipt?: Result }>
  // Host-private blob generations survive deletion and are updated atomically with blob bytes.
  sfBlobGenerations?: Record<string, number>
  // Host-private source lifecycle metadata. Business views and JSON export expose only data/versions.
  sfSources?: {
    schemaVersion: 1
    records: Record<string, { incarnation: string; version: number; alive: boolean; inputDigest: string }>
    scopes?: Record<string, {
      scope: { principalRef: string; accessRevision: string; policyVersion: string; recordType: string; recordId: string; selector: unknown }
      incarnation: string; sourceIncarnation: string; version: number; alive: boolean; inputDigest: string
    }>
  }
}
export type Environment = {
  at: string
  id: () => string
  directory: { id: string; name: string }[]
  bankKey?: Uint8Array
}
export type Result =
  | { ok: true; value?: unknown; warnings?: string[] }
  | {
      ok: false
      status: 400 | 403 | 404 | 409 | 422 | 503
      errors?: string[]
      fieldErrors?: { field: string; message: string }[]
      stored?: unknown
      by?: string
      currentVersionCAS?: number
    }
export type View = {
  data: Record<string, unknown>
  versions: Snapshot["versions"]
}
export type Domain = {
  execute: (snapshot: Snapshot, actor: Actor, command: Command, environment: Environment) => Result
  view: (snapshot: Snapshot, actor: Actor, environment: Environment) => View
}
export type TransactionOptions = { signal?: AbortSignal }

export type Persistence = {
  // Installation contract: serializable durable commit of data, versions, sequences, audit and notices together.
  // Concurrent different-record writes both survive; identical-version writes produce one success and a stale result.
  // Callback executes once against an isolated snapshot. Never blindly replay it; it may acquire private blob staging.
  // commit=false, cancellation, callback failure or commit failure writes nothing, including after restart.
  // Production adapters must run the conformance suite against their real driver; the test Map adapter is not durability proof.
  transaction: <T>(surface: Surface, work: (snapshot: Snapshot) => Promise<{ commit: boolean; value: T }>, options?: TransactionOptions) => Promise<T>
  transactionAll?: <T>(work: (snapshots: Record<Surface, Snapshot>) => Promise<{ commit: boolean; value: T }>, options?: TransactionOptions) => Promise<T>
  currentSnapshots?: () => Readonly<Record<Surface, Snapshot>> | undefined
}

export function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}
export function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (row): row is Record<string, unknown> => row !== null && typeof row === "object" && !Array.isArray(row),
      )
    : []
}
export function text(value: unknown): string {
  return typeof value === "string" ? value : ""
}
export function finite(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}
export function conflict(snapshot: Snapshot, key: string, command: Command, stored: unknown): Result | undefined {
  const current = snapshot.versions[key]
  if ((current?.version ?? 0) !== command.version) return { ok: false, status: 409, stored, by: current?.by, currentVersionCAS: current?.version ?? 0 }
}
export function changed(snapshot: Snapshot, key: string, actor: Actor, at: string, was: unknown, became: unknown) {
  snapshot.versions[key] = {
    version: (snapshot.versions[key]?.version ?? 0) + 1,
    by: actor.id,
  }
  snapshot.audit.push({
    who: actor.id,
    at,
    record: key,
    was: structuredClone(was),
    became: structuredClone(became),
  })
}
