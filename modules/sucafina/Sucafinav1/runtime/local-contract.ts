import type { HoldTargetPreimage, Persistence, SnapshotAuthorityRead } from "./contract.ts"
import type { AssetPersistence } from "./assets.ts"
import type { TeamProfilePolicyStore } from "./team-profile-store.ts"
import type { RoleRow, ResolvedActor, Surface } from "../src/identity.ts"

/** Authentication records are separate from business snapshots and their backups. Payloads are encrypted by identity. */
export type LocalSecrets = {
  put: (key: string, value: Uint8Array, expiresAt: number) => Promise<void>
  get: (key: string, at: number) => Promise<Uint8Array | undefined>
  /** Read credential and revocation marker in the same store snapshot. */
  getActive?: (key: string, revokedKey: string, at: number) => Promise<Uint8Array | undefined>
  take: (key: string, at: number) => Promise<Uint8Array | undefined>
  remove: (key: string) => Promise<void>
}
export type CorporateLocalSecrets = LocalSecrets & {
  getActive: NonNullable<LocalSecrets["getActive"]>
  issueLogin: (namespace: string, key: string, value: Uint8Array, at: number, expiresAt: number) => Promise<boolean>
  retireSession: (key: string, revokedKey: string, at: number) => Promise<void>
  refreshSession: (key: string, revokedKey: string, expected: Uint8Array, value: Uint8Array, at: number) => Promise<void>
}
export type LocalStore = Persistence & AssetPersistence & {
  hasSnapshotRoot?: () => boolean
  holdTargetPreimage?: HoldTargetPreimage
  observeAuthority?: SnapshotAuthorityRead
  secrets: CorporateLocalSecrets
  /** Private installation policy; never a business snapshot or a generic Core DB. */
  teamProfiles?: TeamProfilePolicyStore
  dispose: () => Promise<void>
}
export type DirectoryPerson = { id: string; name: string }
export type EntraTokens = { accessToken: string; refreshToken?: string; idToken?: string; expiresAt: number; grantedScopes?: readonly string[] }
/** An observation available to the server for a verified Microsoft principal. */
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
export type EntraTeamsUnavailableReason = Extract<EntraTeamsResult, { state: "unavailable" }>["reason"]
export type EntraTeamResult =
  | Readonly<{
      state: "complete"
      tenantId: string
      principalObjectId: string
      source: "team"
      team: Readonly<{ teamObjectId: string; name: string; archived: boolean }>
    }>
  | Extract<EntraTeamsResult, { state: "unavailable" }>
export type EntraGroupMembershipResult =
  | Readonly<{
      state: "complete"
      tenantId: string
      principalObjectId: string
      groupObjectId: string
      source: "checkMemberGroups"
      membership: "transitive"
      member: boolean
    }>
  | Extract<EntraTeamsResult, { state: "unavailable" }>
/** Server-only proof captured from the original Microsoft session, never a business grant. */
export type TeamProfileAdministratorObservation =
  | Readonly<{
      status: "available"
      principal: Readonly<{ tenantId: string; principalObjectId: string }>
      /** Repeats the current supreme-group proof and the exact encrypted session fence. */
      verifyCurrent: () => Promise<boolean>
      readTeam?: (teamObjectId: string) => Promise<EntraTeamResult>
    }>
  | Readonly<{ status: "unauthenticated" }>
  | Readonly<{ status: "denied" }>
  | Readonly<{ status: "unavailable"; reason: EntraTeamsUnavailableReason }>
export type EntraTeamsSessionResult = EntraTeamsResult | Readonly<{ state: "unauthenticated" }>
export type EntraTeamsObservation = Readonly<{
  result: EntraTeamsSessionResult
  verifyCurrent?: () => Promise<boolean>
  readMembers?: (teamObjectId: string) => Promise<DirectoryPerson[]>
}>
export type EntraTeamsInput = Readonly<{
  tokens: Pick<EntraTokens, "accessToken" | "expiresAt" | "grantedScopes">
  principal: Readonly<{ tenantId: string; principalObjectId: string }>
}>
export type EntraTeamInput = EntraTeamsInput & Readonly<{ teamObjectId: string }>
export type EntraGroupMembershipInput = EntraTeamsInput & Readonly<{ groupObjectId: string }>
export type EntraClient = {
  readonly tenantId?: string
  readonly clientId?: string
  readonly profile?: "local-public" | "web-confidential"
  joinedTeams?: (input: EntraTeamsInput) => Promise<EntraTeamsResult>
  team?: (input: EntraTeamInput) => Promise<EntraTeamResult>
  checkGroupMembership?: (input: EntraGroupMembershipInput) => Promise<EntraGroupMembershipResult>
  teamMembers?: (input: EntraTeamsInput & { teamObjectId: string }) => Promise<DirectoryPerson[]>
  authorization: (input: { state: string; nonce: string; challenge: string; redirectUri: string }) => Promise<string>
  exchange: (input: { code: string; verifier: string; redirectUri: string; nonce: string }) => Promise<{ tokens: EntraTokens; person: DirectoryPerson }>
  refresh: (refreshToken: string) => Promise<EntraTokens>
  person: (accessToken: string) => Promise<DirectoryPerson>
  directory: (accessToken: string) => Promise<DirectoryPerson[]>
  resolve: (accessToken: string, map: readonly RoleRow[]) => Promise<ResolvedActor>
}
export type EntraOptions = {
  profile?: "local-public" | "web-confidential"
  clientSecret?: () => Promise<string>
  teams?: "direct"
  teamDirectory?: "members"
  tenantId: string
  clientId: string
  fetch?: (request: Request) => Promise<Response>
  now?: () => Date
  directoryLimit?: number
}
export type LocalIdentity = {
  /** Reads direct Teams from the current encrypted session. */
  teamDirectory?: (request: Request) => Promise<EntraTeamsSessionResult>
  /** Keeps the exact encrypted session generation server-side across business awaits. */
  observeTeams?: (request: Request) => Promise<EntraTeamsObservation>
  /** Current installation administration is independent of Team membership and business roles. */
  observeTeamProfileAdministrator?: (
    request: Request,
    groupId: string,
  ) => Promise<TeamProfileAdministratorObservation>
  /** System administration uses a current Entra group grant independent of Team membership. */
  observeCorporateRecoveryActor?: (
    request: Request,
    groupId: string,
  ) => Promise<{ principalId: string; verifyCurrent(): Promise<boolean> } | undefined>
  handle: (request: Request) => Promise<Response | undefined>
  /** Refreshes credentials before entering the business transaction. */
  prepare: (request: Request) => Promise<void>
  /** Read-only credential lookup and fresh directory membership; never writes a nested SQL transaction. */
  authenticate: (request: Request, context?: { surface: Surface; roleMap: readonly RoleRow[] }) => Promise<ResolvedActor | null>
  directory: (request: Request) => Promise<DirectoryPerson[]>
  person: (request: Request) => Promise<DirectoryPerson | null>
}
