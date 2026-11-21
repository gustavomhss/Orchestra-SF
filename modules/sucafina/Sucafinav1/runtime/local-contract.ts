import type { Persistence } from "./contract.ts"
import type { AssetPersistence } from "./assets.ts"
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
export type LocalStore = Persistence & AssetPersistence & { secrets: CorporateLocalSecrets; dispose: () => Promise<void> }
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
export type EntraTeamsSessionResult = EntraTeamsResult | Readonly<{ state: "unauthenticated" }>
export type EntraTeamsInput = Readonly<{
  tokens: Pick<EntraTokens, "accessToken" | "expiresAt" | "grantedScopes">
  principal: Readonly<{ tenantId: string; principalObjectId: string }>
}>
export type EntraClient = {
  readonly tenantId?: string
  readonly clientId?: string
  readonly profile?: "local-public" | "web-confidential"
  joinedTeams?: (input: EntraTeamsInput) => Promise<EntraTeamsResult>
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
  tenantId: string
  clientId: string
  fetch?: (request: Request) => Promise<Response>
  now?: () => Date
  directoryLimit?: number
}
export type LocalIdentity = {
  /** Reads direct Teams from the current encrypted session. */
  teamDirectory?: (request: Request) => Promise<EntraTeamsSessionResult>
  handle: (request: Request) => Promise<Response | undefined>
  /** Refreshes credentials before entering the business transaction. */
  prepare: (request: Request) => Promise<void>
  /** Read-only credential lookup and fresh directory membership; never writes a nested SQL transaction. */
  authenticate: (request: Request, context?: { surface: Surface; roleMap: readonly RoleRow[] }) => Promise<ResolvedActor | null>
  directory: (request: Request) => Promise<DirectoryPerson[]>
  person: (request: Request) => Promise<DirectoryPerson | null>
}
