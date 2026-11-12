import type { Persistence } from "./contract.ts"
import type { AssetPersistence } from "./assets.ts"
import type { RoleRow, ResolvedActor, Surface } from "../src/identity.ts"

/** Authentication records are separate from business snapshots and their backups. Payloads are encrypted by identity. */
export type LocalSecrets = {
  put: (key: string, value: Uint8Array, expiresAt: number) => Promise<void>
  get: (key: string, at: number) => Promise<Uint8Array | undefined>
  take: (key: string, at: number) => Promise<Uint8Array | undefined>
  remove: (key: string) => Promise<void>
}
export type LocalStore = Persistence & AssetPersistence & { secrets: LocalSecrets; dispose: () => Promise<void> }
export type DirectoryPerson = { id: string; name: string }
export type EntraTokens = { accessToken: string; refreshToken?: string; idToken?: string; expiresAt: number }
export type EntraClient = {
  authorization: (input: { state: string; nonce: string; challenge: string; redirectUri: string }) => Promise<string>
  exchange: (input: { code: string; verifier: string; redirectUri: string; nonce: string }) => Promise<{ tokens: EntraTokens; person: DirectoryPerson }>
  refresh: (refreshToken: string) => Promise<EntraTokens>
  person: (accessToken: string) => Promise<DirectoryPerson>
  directory: (accessToken: string) => Promise<DirectoryPerson[]>
  resolve: (accessToken: string, map: readonly RoleRow[]) => Promise<ResolvedActor>
}
export type EntraOptions = {
  tenantId: string
  clientId: string
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
  person: (request: Request) => Promise<DirectoryPerson | null>
}
