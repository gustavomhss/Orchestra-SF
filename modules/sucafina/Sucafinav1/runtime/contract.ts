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
      stored?: unknown
      by?: string
    }
export type View = {
  data: Record<string, unknown>
  versions: Snapshot["versions"]
}
export type NativeText = { en: string; br: string }
export type NativePath = readonly (string | number)[]
export type NativeChoice = { value: string | number | boolean | null; label: NativeText }
export type NativeScalar = {
  kind: "text" | "textarea" | "number" | "date" | "select" | "checkbox"
  path: NativePath
  label: NativeText
  required?: boolean
  readOnly?: boolean
  blank?: "omit" | "null" | "empty"
  min?: number
  max?: number
  step?: number
  options?: readonly NativeChoice[]
}
export type NativeGroup = { kind: "group"; label?: NativeText; fields: readonly NativeField[] }
export type NativeList = {
  kind: "list"
  path: NativePath
  label: NativeText
  fields: readonly NativeField[]
  add?: Record<string, unknown>
  remove?: boolean
  readOnly?: boolean
  minimum?: number
  maximum?: number
}
export type NativeField = NativeScalar | NativeGroup | NativeList
export type NativeAction = {
  key: string
  label: NativeText
  group?: NativeText
  target?: { collection: string; id: string }
  command: Command
  fields: readonly NativeField[]
  confirm?: NativeText
  danger?: boolean
}
export type NativeCommandContext = {
  page: string
  year: number
  month: number
  query: Readonly<Record<string, string>>
  view: View
}
export type Domain = {
  execute: (snapshot: Snapshot, actor: Actor, command: Command, environment: Environment) => Result
  view: (snapshot: Snapshot, actor: Actor, environment: Environment) => View
  commands?: (snapshot: Snapshot, actor: Actor, environment: Environment, context: NativeCommandContext) => readonly NativeAction[]
}
export type TransactionOptions = { signal?: AbortSignal }

export type Persistence = {
  // Installation contract: serializable durable commit of data, versions, sequences, audit and notices together.
  // Concurrent different-record writes both survive; identical-version writes produce one success and a stale result.
  // Callback executes once against an isolated snapshot. Never blindly replay it; it may acquire private blob staging.
  // commit=false, cancellation, callback failure or commit failure writes nothing, including after restart.
  // Production adapters must run the conformance suite against their real driver; the test Map adapter is not durability proof.
  transaction: <T>(surface: Surface, work: (snapshot: Snapshot) => Promise<{ commit: boolean; value: T }>, options?: TransactionOptions) => Promise<T>
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
  if ((current?.version ?? 0) !== command.version) return { ok: false, status: 409, stored, by: current?.by }
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
