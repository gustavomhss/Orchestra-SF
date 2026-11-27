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
  microsoftGroupIdsOnly?: boolean
  at: string
  id: () => string
  directory: { id: string; name: string }[]
  directoryScope?: "team"
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
export type TransactionOptions = {
  signal?: AbortSignal
  // An installed staged writer keeps its target private and calls this false
  // before publishing to the root snapshot. Nested reads still get fresh copies.
  targetPreimageCurrent?: () => boolean
  // A scoped Dashboard source observation may ask for a detached domain view
  // of this exact held root. A missing or released root refuses the read.
  dashboardSourceRoot?: object
  /** Authorize only against the detached ACL from an installed read root. */
  dashboardAclRoot?: object
  // Fixed host-private C08 view, bound to the exact wrapped callback and owner.
  // It grants no source/business authority and never permits a nested write.
  dashboardProductRead?: Readonly<{ identity: object; work: object }>
  /** The callback cannot publish in a held installed preimage. */
  sealedRead?: true
}

export type SnapshotAuthorityRead = <S extends Surface>(surfaces: readonly S[]) => {
  snapshots: Record<S, Pick<Snapshot, "data">>
  identity: object
  /** Identity of the exact persisted bytes, independently read by this root. */
  bytesIdentity?: object
  current: () => boolean
} | undefined

export type SealedSnapshotRead = () => {
  identity: object
  bytesIdentity?: object
  current: () => boolean
  read: () => Readonly<Record<Surface, Snapshot>> | undefined
} | undefined
export type HoldTargetPreimage = () => { current: () => boolean; release: () => void }

export type Persistence = {
  // Installation contract: serializable durable commit of data, versions, sequences, audit and notices together.
  // Concurrent different-record writes both survive; identical-version writes produce one success and a stale result.
  // Callback executes once against an isolated snapshot. Never blindly replay it; it may acquire private blob staging.
  // commit=false, cancellation, callback failure or commit failure writes nothing, including after restart.
  // Production adapters must run the conformance suite against their real driver; the test Map adapter is not durability proof.
  transaction: <T>(surface: Surface, work: (snapshot: Snapshot) => Promise<{ commit: boolean; value: T }>, options?: TransactionOptions) => Promise<T>
  transactionAll?: <T>(work: (snapshots: Record<Surface, Snapshot>) => Promise<{ commit: boolean; value: T }>, options?: TransactionOptions) => Promise<T>
  // The installed SQLite driver holds the other surfaces under the same lock
  // when a command only writes Dashboard. Bind the capability to both methods.
  dashboardSourceFence?: Readonly<Required<Pick<Persistence, "transaction" | "transactionAll">> &
    Pick<Persistence, "currentSnapshots" | "currentSnapshot"> & {
      current: () => boolean
      holdTargetPreimage: HoldTargetPreimage
      observeAuthority?: SnapshotAuthorityRead
      readSealed?: SealedSnapshotRead
      hasSnapshotRoot?: () => boolean
      readDashboardAuthority?: <T>(work: () => Promise<T>, signal: AbortSignal) => Promise<T>
    }>
  currentSnapshots?: () => Readonly<Record<Surface, Snapshot>> | undefined
  // Detached content of one surface with the same scope checks as currentSnapshots.
  currentSnapshot?: (surface: Surface) => Snapshot | undefined
  // Lexical presence only: the same scope lifetime/abort checks, without copying
  // or validating snapshot contents. Never a source witness or authorization.
  // Adapters without this capability retain currentSnapshots for presence checks.
  hasCurrentSnapshots?: () => boolean
  // Internal root-only scope, not source admission or business authorization.
  // Consumers must still use their canonical transaction(surface, work) inside it
  // so every wrapper keeps its guards. No snapshot or commit capability is exposed.
  // Fresh SQL, independent copies, abort/lifetime fences and joined readers are
  // required. Any attempted write poisons the root even when its error is caught.
  // Older adapters omit this capability and retain their existing transaction path.
  readSnapshotRoot?: <T>(work: () => Promise<T>, options?: TransactionOptions) => Promise<T>
  // Metadata for the current scope only. No snapshot, authorization or write capability.
  currentSnapshotScope?: () => { identity: object; bytesIdentity?: object; readOnly: boolean; poisoned: boolean } | undefined
}

export function hasSfDashboardSourceFence(persistence: Persistence) {
  const property = Object.getOwnPropertyDescriptor(persistence, "dashboardSourceFence")
  const fence: Persistence["dashboardSourceFence"] = property && Object.hasOwn(property, "value") ? property.value : undefined
  return !!fence && fence.transaction === persistence.transaction && fence.transactionAll === persistence.transactionAll &&
    fence.currentSnapshots === persistence.currentSnapshots && fence.currentSnapshot === persistence.currentSnapshot && fence.current()
}

export function hasActiveSfSnapshot(persistence: Persistence) {
  const probe = hasSfDashboardSourceFence(persistence) && persistence.dashboardSourceFence?.hasSnapshotRoot
  return probe ? probe() : persistence.hasCurrentSnapshots?.() ?? !!persistence.currentSnapshots?.()
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
export function conflict(snapshot: Snapshot, key: string, command: Command, stored: unknown): Extract<Result, { ok: false }> | undefined {
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
