import type { Persistence } from "./contract.ts"
import type { AssetPersistence } from "./assets.ts"
import type { RoleRow, ResolvedActor, Surface } from "../src/identity.ts"

/** Authentication records are separate from business snapshots and their backups. Payloads are encrypted by identity. */
export type AuthLimits = { maxRecords: number; maxChallenges: number; maxBytes: number; maxPayloadBytes: number; batchSize: number }
export type AuthHandle = {
  kind: "login" | "session"
  state: "issued" | "pending" | "completed" | "active" | "revoked"
  expiresAt: number
  retainUntil: number
  parent?: string
}
export type AuthUsage = { records: number; handles: number; payloads: number; bytes: number; pendingRevocations: number }
export type AuthenticationSecrets = {
  readonly limits: Readonly<AuthLimits>
  /** Atomically admits an issued challenge or one session derived from a consumed challenge. */
  issue: (input: { key: string; value: Uint8Array; expiresAt: number; at: number; parent?: string }) => Promise<boolean>
  /** Fresh committed metadata; synchronous so cancellation can fence work before its first await. */
  inspect: (key: string, at: number) => AuthHandle | undefined
  revoke: (key: string, at: number) => Promise<void>
  collect: (at: number) => Promise<{ payloads: number; handles: number }>
  stats: () => Promise<AuthUsage>
}
export type LocalSecrets = {
  put: (key: string, value: Uint8Array, expiresAt: number, at?: number) => Promise<void>
  get: (key: string, at: number) => Promise<Uint8Array | undefined>
  take: (key: string, at: number) => Promise<Uint8Array | undefined>
  remove: (key: string) => Promise<void>
  /** Required by the Microsoft composition; optional only for retained local adapters. */
  authentication?: AuthenticationSecrets
}
export type LocalStore = Persistence & AssetPersistence & { secrets: LocalSecrets; dispose: () => Promise<void> }
export type DirectoryPerson = { id: string; name: string }
export type EntraTokens = { accessToken: string; refreshToken?: string; idToken?: string; expiresAt: number; grantedScopes?: readonly string[] }
/** A server-only Graph observation. It never grants product access or proves a login by itself. */
export type EntraTeamsResult =
  | Readonly<{
      state: "complete"
      tenantId: string
      principalObjectId: string
      source: "joinedTeams"
      membership: "direct"
      teams: readonly Readonly<{ teamObjectId: string; name: string; archived: boolean }>[]
    }>
  | Readonly<{
      state: "unavailable"
      reason: "capability_disabled" | "consent_required" | "token_expired" | "identity_mismatch" | "unauthenticated" | "forbidden" | "throttled" | "timeout" | "provider_unavailable" | "invalid_response" | "incomplete" | "limit_exceeded"
      retryAfterMs?: number
    }>
export type EntraTeamsSessionResult = EntraTeamsResult | Readonly<{ state: "unauthenticated" }>
export type EntraTeamsInput = Readonly<{
  /** Only credentials and principal restored from the verified Microsoft session may reach this reader. */
  tokens: Pick<EntraTokens, "accessToken" | "expiresAt" | "grantedScopes">
  principal: Readonly<{ tenantId: string; principalObjectId: string }>
}>
/** A positive check observes membership only; the configured supreme policy decides admission. */
export type EntraGroupMembershipInput = EntraTeamsInput & Readonly<{
  /** Immutable ID supplied by trusted current server policy, never a client-selected group. */
  groupObjectId: string
}>
export type EntraGroupMembershipResult =
  | Readonly<{
      state: "complete"
      tenantId: string
      principalObjectId: string
      groupObjectId: string
      source: "checkMemberGroups"
      membership: "transitive"
      /** False means not confirmed: Graph can omit groups the caller cannot evaluate. */
      member: boolean
    }>
  | Extract<EntraTeamsResult, { state: "unavailable" }>
export type EntraGroupMembershipSessionResult = EntraGroupMembershipResult | Readonly<{ state: "unauthenticated" }>
export type EntraTeamInput = EntraTeamsInput & Readonly<{ teamObjectId: string }>
/** Existence and tenant observation of one Team; this result never asserts membership. */
export type EntraTeamResult =
  | Readonly<{
      state: "complete"
      tenantId: string
      principalObjectId: string
      source: "team"
      team: Readonly<{ teamObjectId: string; name: string; archived: boolean }>
    }>
  | Extract<EntraTeamsResult, { state: "unavailable" }>
export type EntraTeamSessionResult = EntraTeamResult | Readonly<{ state: "unauthenticated" }>
/** Server-only closure over one verified session generation; it exposes no credentials. */
export type MicrosoftProfileSession = Readonly<{
  principal: Readonly<{ tenantId: string; principalObjectId: string }>
  teams: () => Promise<EntraTeamsSessionResult>
  groupMembership: (groupObjectId: string) => Promise<EntraGroupMembershipSessionResult>
  team: (teamObjectId: string) => Promise<EntraTeamSessionResult>
  /** Recheck after awaits and before committing; directory observations are not cached grants. */
  verifyCurrent: () => Promise<boolean>
}>
/** Complete server-only directory view; group IDs are transitive memberships. */
export type EntraGraphDirectory = Readonly<{
  users: readonly Readonly<{ id: string; name: string; department: string; jobTitle: string; managerId: string | null; groupIds: readonly string[] }>[]
  groups: readonly Readonly<{ id: string; name: string; team: boolean }>[]
}>
export type EntraClient = {
  /** Immutable issuer/application boundary; optional only for retained local test adapters. */
  readonly tenantId?: string
  readonly clientId?: string
  readonly profile?: "local-public" | "web-confidential"
  readonly teams?: "direct"
  authorization: (input: { state: string; nonce: string; challenge: string; redirectUri: string }) => Promise<string>
  exchange: (input: { code: string; verifier: string; redirectUri: string; nonce: string }) => Promise<{ tokens: EntraTokens; person: DirectoryPerson }>
  refresh: (refreshToken: string) => Promise<EntraTokens>
  person: (accessToken: string) => Promise<DirectoryPerson>
  directory: (accessToken: string) => Promise<DirectoryPerson[]>
  /** Direct memberships only; separate from roles, organization enumeration and channel associations. */
  joinedTeams?: (input: EntraTeamsInput) => Promise<EntraTeamsResult>
  /** Checks one policy-selected group under the signed-in user, independently of Team and RoleRows. */
  checkGroupMembership?: (input: EntraGroupMembershipInput) => Promise<EntraGroupMembershipResult>
  /** Looks up one immutable Team ID under the explicit Teams capability, without asserting membership. */
  team?: (input: EntraTeamInput) => Promise<EntraTeamResult>
  /** Reads complete Graph users, managers, groups and transitive members with a server-held delegated token. */
  graphDirectory?: (accessToken: string) => Promise<EntraGraphDirectory>
  resolve: (accessToken: string, map: readonly RoleRow[]) => Promise<ResolvedActor>
}
export type EntraOptions = {
  tenantId: string
  clientId: string
  profile?: "local-public" | "web-confidential"
  /** Explicit delegated read capability; omitted preserves minimum web-login scopes. */
  teams?: "direct"
  /** Server-private provider. Never expose this credential through browser or tool configuration. */
  clientSecret?: () => Promise<string>
  fetch?: (request: Request) => Promise<Response>
  now?: () => Date
  directoryLimit?: number
}
export type LocalIdentity = {
  handle: (request: Request) => Promise<Response | undefined>
  /** Refreshes credentials before entering the business transaction. */
  prepare: (request: Request) => Promise<void>
  /** Read-only credential lookup and fresh directory membership; never writes a nested SQL transaction. */
  authenticate: (request: Request, context?: { surface: Surface; roleMap: readonly RoleRow[] }) => Promise<ResolvedActor | null>
  directory: (request: Request) => Promise<DirectoryPerson[]>
  /** Server-only observation under the current verified Microsoft session; never a grant or bearer projection. */
  teamDirectory?: (request: Request) => Promise<EntraTeamsSessionResult>
  /** Captures a confidential Microsoft session for server authority checks, never for renderer projection. */
  microsoftSession?: (request: Request) => Promise<MicrosoftProfileSession | undefined>
  /** Available only in a confidential Microsoft installation; never returns a bearer token. */
  graphDirectory?: (request: Request) => Promise<EntraGraphDirectory>
  person: (request: Request) => Promise<DirectoryPerson | null>
}

