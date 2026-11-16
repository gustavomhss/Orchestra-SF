import type { Accessor, JSX } from "solid-js"
import type {
  SfContext, SfContextResult, SfContextStamp, SfEditScopeKey, SfExpectedContextBinding,
  SfInstallationDescriptor, SfInstallationList, SfOwnerKey, SfOwnerSelection,
  SfResolvedRoute, SfVersion, SurfaceId, SfRef, SfOperationId,
} from "@orchestra/schema/sucafina/context"
import type { SfJson } from "@orchestra/schema/sucafina/common"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfDraftController, SfDraftIdentity, SfDraftInput } from "../shared/draft"
import type { SfNativeNavigationState } from "../navigation-state"
import type { SfTodayResumePort } from "../home"

export type {
  SfContext, SfContextResult, SfContextStamp, SfEditScopeKey, SfExpectedContextBinding,
  SfInstallationDescriptor, SfInstallationList, SfOwnerKey, SfOwnerSelection,
  SfResolvedRoute, SfVersion, SurfaceId, SfRef,
} from "@orchestra/schema/sucafina/context"

export type SfSurfaceProps<Id extends SurfaceId = SurfaceId> = {
  [Current in Id]: Readonly<{ surfaceId: Current; route: SfResolvedRoute<Current> }>
}[Id]

export type SfOwnerIdentity = Readonly<{
  serverKey: string
  transportIdentity: string
  publicOrigin: string
  projectId: string
  installationId: string
  principalRef: string
  authEpoch: number
}>
export type SfContextState =
  | Readonly<{ status: "resolving"; selection: SfOwnerSelection }>
  | Readonly<{ status: "choose-installation"; selection: SfOwnerSelection; installations: readonly SfInstallationDescriptor[] }>
  | Readonly<{ status: "unauthenticated"; selection: SfOwnerSelection; binding: SfInstallationDescriptor }>
  | Readonly<{ status: "denied"; selection: SfOwnerSelection }>
  | Readonly<{ status: "unavailable"; selection: SfOwnerSelection; reason: "installation-unavailable" | "identity-unavailable" | "host-unavailable" | "connection-auth-unavailable" | "connection-unapproved" | "network" | "contract-mismatch" }>
  | Readonly<{ status: "context-mismatch"; selection: SfOwnerSelection }>
  | Readonly<{ status: "ready"; ownerKey: SfOwnerKey; owner: SfOwnerIdentity; binding: SfInstallationDescriptor; context: SfContext }>

export type SfPublicDraftController<Value> = Pick<
  SfDraftController<Value>, "snapshot" | "edit" | "discard" | "receiveRemote" | "setPhase" | "setPending" | "confirmSave"
>
export type SfDraftReadBinding = Readonly<{
  operationId: SfOperationId
  input: SfJson | undefined
  fieldPaths: readonly string[]
  actionIds: readonly string[]
}>
export type SfDraftRegistry = Readonly<{
  /** An existing draft is never fabricated by a read-only lookup. */
  peek<Value>(input: Readonly<{ surfaceId: SurfaceId; identity: SfDraftIdentity; editScopeKey: SfEditScopeKey }>): SfPublicDraftController<Value> | undefined
  acquire<Value>(input: Omit<SfDraftInput<Value>, "ownerKey"> & Readonly<{ revalidation: SfDraftReadBinding }>): SfPublicDraftController<Value>
  discard(selection: Readonly<{ surfaceId: SurfaceId; identity: SfDraftIdentity; editScopeKey: SfEditScopeKey }>): void
  /** Tracks submitted original correlation without fabricating a server operationRef. */
  markUnresolved(selection: Readonly<{ surfaceId: SurfaceId; identity: SfDraftIdentity; editScopeKey: SfEditScopeKey }>, unresolved: boolean): void
}>
export type SfDraftRevalidationInput = Readonly<{
  surfaceId: SurfaceId
  identity: SfDraftIdentity
  editScopeKey: SfEditScopeKey
  originalOwner: SfOwnerIdentity
  read: SfDraftReadBinding
}>
export type SfDraftRevalidation =
  | Readonly<{ status: "authorized"; stamp: SfContextStamp; authority: "unchanged"; sourceVersion: SfVersion | null }>
  | Readonly<{ status: "denied" | "authority-changed" }>
  | Readonly<{ status: "unavailable" }>
export type SfContextDependencies = Readonly<{
  listInstallations(selection: SfOwnerSelection, signal: AbortSignal): Promise<SfInstallationList>
  loadContext(binding: SfInstallationDescriptor, signal: AbortSignal): Promise<SfContextResult>
  createTransport(binding: SfInstallationDescriptor, generation: number): SfTransport
  resolveTransportIdentity(selection: SfOwnerSelection): string
  createDraft<Value>(input: SfDraftInput<Value>): SfDraftController<Value>
  revalidateDraft(input: SfDraftRevalidationInput, fresh: SfContext, transport: SfTransport, signal: AbortSignal): Promise<SfDraftRevalidation>
  /** I00 supplies only the genuine owner-bound F01 shell navigation instance. */
  navigation?: SfNativeNavigationState
}>
export type SfContextProviderProps = Readonly<{
  selection: Accessor<SfOwnerSelection>
  dependencies: SfContextDependencies
  children: JSX.Element
}>
export type SfContextHandle = Readonly<{
  state: Accessor<SfContextState>
  generation: Accessor<number>
  /** Reads the original owner draft registry, including quarantined edits. */
  hasDirtyDrafts: () => boolean
  /** Only after explicit discard consent; refuses pending/unknown or quarantined operations. */
  discardDrafts: () => boolean
  ready: Accessor<Readonly<{ context: SfContext; transport: SfTransport; drafts: SfDraftRegistry }> | undefined>
  reload: () => Promise<void>
  invalidate: (reason: "logout" | "revoked" | "owner-changed" | "host-changed") => void
  /** Only installed with the real F01 navigation; no optimistic fallback. */
  resumeCase?: SfTodayResumePort["resumeCase"]
  /** Consumes an owner/access-scoped returnRef once after Home renders. */
  claimResumeFocus?: (input: Readonly<{
    caseRef: string
    sourceVersion: number
    ownerKey: SfOwnerKey
    accessRevision: string
    returnRoute: SfResolvedRoute<"UI29">
  }>) => boolean
}>
