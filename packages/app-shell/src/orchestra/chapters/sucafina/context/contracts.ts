import type { Accessor, JSX } from "solid-js"
import type {
  SfContext, SfReadableContext, SfContextResult, SfContextStamp, SfEditScopeKey, SfExpectedContextBinding,
  SfInstallationDescriptor, SfInstallationList, SfOwnerKey, SfOwnerSelection,
  SfResolvedRoute, SfVersion, SurfaceId, SfRef, SfOperationId, SfOperationRef,
} from "@orchestra/schema/sucafina/context"
import type { SfJson } from "@orchestra/schema/sucafina/common"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfDraftController, SfDraftIdentity, SfDraftInput } from "../shared/draft"
import type { SfNativeNavigationState, SfNativeTransitionResult } from "../navigation-state"
import type { SfExecutiveLink, SfExecutiveSourceRoute } from "../cross-links"
import type { SfTodayResumePort } from "../home"
import type { SfBudgetPeriodPort } from "../navigation-state/budget-period"

export type {
  SfContext, SfReadableContext, SfContextResult, SfContextStamp, SfEditScopeKey, SfExpectedContextBinding,
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
  | Readonly<{ status: "ready"; selection: SfOwnerSelection; ownerKey: SfOwnerKey; owner: SfOwnerIdentity; binding: SfInstallationDescriptor; context: SfReadableContext }>

export type SfPublicDraftController<Value> = Pick<
  SfDraftController<Value>, "snapshot" | "edit" | "discard" | "receiveRemote" | "setPhase" | "setPending" | "confirmSave" | "rejectSave"
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
  /** Without a ref, discard an unsent draft. With a ref, release only that confirmed result. */
  discard(selection: Readonly<{ surfaceId: SurfaceId; identity: SfDraftIdentity; editScopeKey: SfEditScopeKey }>, confirmedOperationRef?: SfOperationRef): void
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
/** The original ephemeral registry can revalidate either admitted context version. */
export type SfDraftDependencies<Context extends SfReadableContext = SfContext> = Readonly<{
  createDraft<Value>(input: SfDraftInput<Value>): SfDraftController<Value>
  revalidateDraft(input: SfDraftRevalidationInput, fresh: Context, transport: SfTransport, signal: AbortSignal): Promise<SfDraftRevalidation>
}>
export type SfContextDependencies = Readonly<{
  listInstallations(selection: SfOwnerSelection, signal: AbortSignal): Promise<SfInstallationList>
  loadContext(binding: SfInstallationDescriptor, signal: AbortSignal): Promise<SfContextResult>
  createTransport(binding: SfInstallationDescriptor, generation: number): SfTransport
  resolveTransportIdentity(selection: SfOwnerSelection): string
  createDraft<Value>(input: SfDraftInput<Value>): SfDraftController<Value>
  revalidateDraft(input: SfDraftRevalidationInput, fresh: SfContext, transport: SfTransport, signal: AbortSignal): Promise<SfDraftRevalidation>
  /** Generic notice only: retained edits were purged after access was revoked. */
  onDraftAccessRevoked?: () => void
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
  /** Only after explicit consent; quarantined unsent drafts may be purged, never pending/unknown operations. */
  discardDrafts: () => boolean
  ready: Accessor<Readonly<{ context: SfReadableContext; transport: SfTransport; drafts: SfDraftRegistry }> | undefined>
  reload: () => Promise<void>
  /** Session expiry quarantines for same-owner revalidation; other reasons purge. */
  invalidate: (reason: "logout" | "revoked" | "session-expired" | "owner-changed" | "host-changed") => void
  /** Canonical source ref -> fresh F01 authorization -> source re-read -> commit. */
  followExecutiveLink?: (from: SfExecutiveSourceRoute, target: SfExecutiveLink) => Promise<SfNativeTransitionResult["status"]>
  /** Canonical CAP03 period changes commit through the same live F01 owner. */
  changeBudgetPeriod?: SfBudgetPeriodPort
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

