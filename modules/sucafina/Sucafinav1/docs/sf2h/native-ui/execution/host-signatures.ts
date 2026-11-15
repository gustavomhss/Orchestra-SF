/**
 * NORMATIVE PLANNING DECLARATIONS. No implementation, runtime proof or new service.
 * The imports in this document express type provenance; I00 places each type in
 * the owning package named below. Browser packages never import the private CLI
 * section. CONTRACTS.md defines validation/lifecycle; the catalog fixes operations.
 */
import type { Accessor, JSX } from "solid-js"
import type { Schema } from "effect"
import type {
  SfOwnerKey, SfEditScopeKey, SfDraftIdentity, SfDraftInput,
  SfDraftController, SfVersion,
} from "./component-signatures"
import type { SfResolvedRoute, SfOwnerSelection, SurfaceId } from "./route-signatures"
export type { SfResolvedRoute, SfOwnerSelection, SurfaceId } from "./route-signatures"

// F02 Schema/common publishes SfOperationId value/type from the CLOSED catalog
// literal set. The documentary query below specifies that set; no string fallback.
// Transport interfaces belong to Client/transport, not Schema service layers.
type Catalog = typeof import("./contract-catalog.json")
export type SfCatalogOperationId = keyof Catalog["operations"]
export type SfOperationId = SfCatalogOperationId
export type SfFamilyId = keyof Catalog["families"]
export type SfResourceKey = {
  [F in SfFamilyId]: Readonly<{ family: F; resource: keyof Catalog["families"][F]["resources"] }>
}[SfFamilyId]
export type SfJson = null | boolean | number | string | readonly SfJson[] | { readonly [key: string]: SfJson }
export type SfPublicHeaders = Readonly<{
  "content-type"?: string
  "content-disposition"?: string
  "x-sf-access-revision"?: string
  "x-sf-review-binding"?: string
  "x-sf-contract-revision"?: string
}>
export type SfTransportFailure = Readonly<{
  kind: "transport-error"
  reason: "aborted" | "network" | "invalid-response" | "contract-mismatch" | "contract-unavailable" | "outcome-unknown"
}>
export type SfTransportResult<Output> =
  | Readonly<{ kind: "response"; status: number; headers: SfPublicHeaders; body: Output }>
  | SfTransportFailure
export type SfCallOptions = Readonly<{ signal: AbortSignal; idempotencyKey?: string }>
export type SfOperation<Input, Output> = Readonly<{
  operationId: SfOperationId
  input: Schema.Schema<Input>
  output: Schema.Schema<Output>
}>
// Input/output bindings MUST be the same-name public schema exports in the catalog.
// The schemas are not passed over IPC. Method/path/header policies are private table data.
export type SfOperationRegistration<Input, Output> = SfOperation<Input, Output> & Readonly<{
  method: "GET" | "POST"
  pathTemplate: string // exact literal per operation from catalog; never caller supplied
  fixedQuery?: Readonly<Record<string, string>>
  fixedBodyDiscriminator?: Readonly<Record<string, string>>
  effect: "read" | "preview" | "prepare" | "mutation" | "authentication"
  maxRequestBytes?: number
  responseMode: "json" | "bytes" | "empty" | "navigation"
}>
// I00 packages/schema/src/sucafina/operation-registry.ts exports SfOperationRegistry:
// full readonly METADATA for all 305 IDs, no import of any unfinished family leaf.
// I00 packages/schema/src/sucafina/index.ts exports SfNativeOperationBindings:
// only canonical concrete codecs present/admitted in C, using the shape below.
// The admitted subset is materialized statically, never filled with permissive
// codecs. Each decoder delegates to the SAME canonical schema exported by owner.
// Missing binding fails contract-unavailable before any network. No generic RPC.
export type SfWireDecodeResult =
  | Readonly<{ status: "ok"; value: SfJson | undefined }>
  | Readonly<{ status: "invalid" }>
export type SfOperationCodec = Readonly<{
  decodeInput(value: unknown): SfWireDecodeResult
  decodeOutput(value: unknown): SfWireDecodeResult
}>
export type SfOperationBindings = Readonly<Partial<Record<SfOperationId, SfOperationCodec>>>
// Browser data and main broker receive that SAME immutable admitted map from
// I00; they never dynamically import missing leaf files. Pilot admits ctx+A03;
// final requires all 305 catalog entries covered, including dedicated auth/SDK
// bindings, before GLOBAL_RELEASE. Authentication/navigation/bytes entries use
// their declared modes and never a JSON permissive fallback.
export type SfTransport = Readonly<{
  execute<Input, Output>(operation: SfOperation<Input, Output>, input: Input, options: SfCallOptions): Promise<SfTransportResult<Output>>
}>

// F01 Schema/context ONLY: descriptor/list/stamp/context/result + route types.
// F01 App/context/contracts: owner identity, ContextState, dependencies and drafts.
// The allocation table in CONTRACTS section6.2 governs each declaration below.
// No Location directory or credentials in a descriptor/context.
export type SfInstallationDescriptor = Readonly<{
  installationId: string
  projectId: string
  hostId: string // current loaded installation/runtime, not a grant
  publicOrigin: string
  mount: string
  contractRevision: "sf-native-ui/1"
  authMode: "microsoft" | "local-operator"
}>
export type SfInstallationList = Readonly<{ installations: readonly SfInstallationDescriptor[] }>
// A deep link uses ids and never requires Location.directory from another selection.
// serverKey resolves the approved connection outside HTTP query, not an SF grant.
export type SfInstallationSelector =
  | Readonly<{ select: "ids"; installationId: string; projectId: string }>
  | Readonly<{ select: "location"; location: Readonly<{ directory: string; workspace?: string }> }>
export type SfExpectedContextBinding = Readonly<{ installationId: string; projectId: string; hostId: string }>
export type SfNativeOwnerExpectation = SfExpectedContextBinding & Readonly<{ principalRef: string }>
// X-SF-Native-Owner only carries an expectation; verify real actor+tuple inside producer transaction.
export type SfContextStamp = Readonly<{
  installationId: string; projectId: string; hostId: string; principalRef: string
  policyVersion: string; accessRevision: string
}>
export type SfOperationAvailability = Readonly<{ operationId: SfCatalogOperationId }> & (
  | Readonly<{ state: "ready"; reason: null; operational: true }>
  | Readonly<{ state: "denied"; reason: string; operational: false }>
  | Readonly<{ state: "unavailable"; reason: string; operational: false }>
)
export type SfResourceAvailability = SfResourceKey & Readonly<{
  state: "ready" | "partial" | "denied" | "unavailable"
  operations: readonly SfOperationAvailability[]
}>
export type SfContext = Readonly<{
  stamp: SfContextStamp
  contractRevision: "sf-native-ui/1"
  authMode: "microsoft" | "local-operator"
  destinations: readonly Readonly<{
    capabilityId: SurfaceId
    surface: "dashboard" | "planner" | "procurement"
    page: string // exact sourcePage literal for that SurfaceId in the frozen manifest
    canRead: boolean
    allowedActionIds: readonly string[] // source actions for that destination only
  }>[]
  availability: readonly SfResourceAvailability[]
}>
export type SfContextResult =
  | Readonly<{ status: "ok"; value: SfContext }>
  | Readonly<{ status: "unauthenticated" }>
  | Readonly<{ status: "denied" }>
  | Readonly<{ status: "unavailable"; reason: "identity-unavailable" | "host-unavailable" | "contract-mismatch" }>
export type SfOwnerIdentity = Readonly<{
  serverKey: string; transportIdentity: string; publicOrigin: string
  projectId: string; installationId: string; principalRef: string; authEpoch: number
}>
export type SfContextState =
  | Readonly<{ status: "resolving"; selection: SfOwnerSelection }>
  | Readonly<{ status: "choose-installation"; selection: SfOwnerSelection; installations: readonly SfInstallationDescriptor[] }>
  | Readonly<{ status: "unauthenticated"; selection: SfOwnerSelection; binding: SfInstallationDescriptor }>
  | Readonly<{ status: "denied"; selection: SfOwnerSelection }>
  | Readonly<{ status: "unavailable"; selection: SfOwnerSelection; reason: "installation-unavailable" | "identity-unavailable" | "host-unavailable" | "connection-auth-unavailable" | "connection-unapproved" | "network" | "contract-mismatch" }>
  | Readonly<{ status: "context-mismatch"; selection: SfOwnerSelection }>
  | Readonly<{ status: "ready"; ownerKey: SfOwnerKey; owner: SfOwnerIdentity; binding: SfInstallationDescriptor; context: SfContext }>

// F01 app-shell/context; S03 factory is injected by I00. No F01 -> F02 factory import.
export type SfPublicDraftController<Value> = Pick<SfDraftController<Value>,
  "snapshot" | "edit" | "discard" | "receiveRemote" | "setPhase" | "setPending" | "confirmSave">
export type SfDraftReadBinding = Readonly<{
  operationId: SfCatalogOperationId // catalog effect=read, source belongs to this surface
  input: SfJson | undefined // exact validated input codec, not arbitrary request options
  fieldPaths: readonly string[] // fields present in the ORIGINAL authorized projection
  actionIds: readonly string[] // exact actions required to edit this draft
}>
export type SfDraftRegistry = Readonly<{
  acquire<Value>(input: Omit<SfDraftInput<Value>, "ownerKey"> & Readonly<{ revalidation: SfDraftReadBinding }>): SfPublicDraftController<Value>
  discard(selection: Readonly<{ surfaceId: SurfaceId; identity: SfDraftIdentity; editScopeKey: SfEditScopeKey }>): void
}>
export type SfDraftRevalidationInput = Readonly<{
  surfaceId: SurfaceId; identity: SfDraftIdentity; editScopeKey: SfEditScopeKey
  originalOwner: SfOwnerIdentity; read: SfDraftReadBinding
}>
export type SfDraftRevalidation =
  | Readonly<{ status: "authorized"; stamp: SfContextStamp; authority: "unchanged"; sourceVersion: SfVersion | null }>
  | Readonly<{ status: "denied" | "authority-changed" }>
  | Readonly<{ status: "unavailable" }>
export type SfContextDependencies = Readonly<{
  listInstallations(selection: SfOwnerSelection, signal: AbortSignal): Promise<SfInstallationList>
  loadContext(binding: SfInstallationDescriptor, signal: AbortSignal): Promise<SfContextResult> // sends exactly SfExpectedContextBinding query, verifies returned stamp/hostId
  createTransport(binding: SfInstallationDescriptor, generation: number): SfTransport
  resolveTransportIdentity(selection: SfOwnerSelection): string
  createDraft<Value>(input: SfDraftInput<Value>): SfDraftController<Value>
  revalidateDraft(input: SfDraftRevalidationInput, fresh: SfContext, transport: SfTransport, signal: AbortSignal): Promise<SfDraftRevalidation>
}>
export type SfContextProviderProps = Readonly<{
  selection: Accessor<SfOwnerSelection>; dependencies: SfContextDependencies; children: JSX.Element
}>
export declare function SfContextProvider(props: SfContextProviderProps): JSX.Element
export declare function useSfContext(): Readonly<{
  state: Accessor<SfContextState>
  generation: Accessor<number>
  ready: Accessor<Readonly<{ context: SfContext; transport: SfTransport; drafts: SfDraftRegistry }> | undefined>
  reload: () => Promise<void>
  invalidate: (reason: "logout" | "revoked" | "owner-changed" | "host-changed") => void
}>
// Registry key = owner + surfaceId + identity + editScopeKey; baseVersion is payload.
// Repeated acquire returns the same controller without replacing its value/base.
// Leaf unmount does not dispose it. A generic Value mismatch is invalid-contract.
// Registry never returns raw controllers. While quarantined/revoked, all public
// mutating methods are inert/rejected; no public call changes availability.
// revalidateDraft uses the same frozen read operation and current authenticated
// transport. It validates entity/selection identity, all fieldPaths still present
// after producer redaction, and all actionIds still admitted. No cache/offline
// answer, client-supplied authorization flag, or 401/503 may return authorized.
// F01 alone compares SAME serverKey/transportIdentity/publicOrigin/project/install/
// principal plus current policy scope. It transfers quarantine explicitly to the
// new authEpoch only after success; changed sourceVersion retains dirty + stale.
// Pending command/review admission is invalidated and requires new current review.
// S03 restoreSameAuthority is private to this registry and its argument is the NEW
// owner key after that proof. Revoked/logout/owner-changed drafts cannot restore.
export declare function createSfContextClient(transport: SfTransport): Readonly<{
  "ctx.context"(input: undefined, options: SfCallOptions): Promise<SfTransportResult<SfContextResult>>
}>

// F02 Client/transport. SfResolvedRoute is the closed F01 union in COMPONENT-CONTRACTS.

export type SfDesktopBinding = Readonly<{ bindingHandle: string; generation: number; descriptor: SfInstallationDescriptor }>
export declare function createSfTransport(options: Readonly<{
  binding: SfInstallationDescriptor; generation: number; currentGeneration: () => number
  fetch: typeof globalThis.fetch; operations: SfOperationBindings; desktop?: SfDesktopCapability; desktopBinding?: SfDesktopBinding
}>): SfTransport
export declare function createSfAuthActions(options: Readonly<{
  binding: SfInstallationDescriptor; desktop?: SfDesktopCapability; desktopBinding?: SfDesktopBinding
  navigate: (validatedSameOriginUrl: string) => void; transport: SfTransport
}>): Readonly<{ login(returnRoute: SfResolvedRoute): Promise<void>; logout(): Promise<void> }>

// D01 public capability; callbacks/AbortSignal are adapted locally, never serialized.
// Only registerConnection can carry a candidate connection; bind/invoke cannot.
export type SfConnectionCandidate = Readonly<{
  serverKey: string; projectId: string
  baseUrl: string // exact canonical origin; no path/query/fragment/userinfo
  location?: Readonly<{ directory: string; workspace?: string }> // required only for select=location; select=ids uses trusted connection/installation identity
  credentials: Readonly<{ kind: "none" }> | Readonly<{ kind: "basic"; username: string; password: string }>
}>
export type SfRegisterConnectionResult =
  | Readonly<{ status: "approved"; serverKey: string; projectId: string; transportIdentity: string; generation: number }>
  | Readonly<{ status: "cancelled" }>
  | Readonly<{ status: "unavailable"; reason: "connection-auth-unavailable" | "invalid-connection" | "owner-rejected" }>
export type SfDesktopInvalidation = Readonly<{
  bindingHandle: string; generation: number
  reason: "logout" | "owner-changed" | "server-removed" | "host-changed" | "session-expired" | "access-revoked"
}>
export type SfDesktopBindResult =
  | (Readonly<{ status: "ok" }> & SfDesktopBinding)
  | Readonly<{ status: "denied" | "context-mismatch" }>
  | Readonly<{ status: "unavailable"; reason: "connection-unapproved" | "connection-auth-unavailable" | "installation-unavailable" | "network" | "contract-mismatch" }>
export type SfDesktopOwnerRequest = Readonly<{ bindingHandle: string; generation: number }>
export type SfDesktopInvocation = SfDesktopOwnerRequest & (
  | Readonly<{ kind: "request"; requestId: string; operationId: SfCatalogOperationId; input: SfJson | undefined; upload?: Readonly<{ fileName: string; mediaType: string; bytes: Uint8Array }>; idempotencyKey?: string }>
  | Readonly<{ kind: "response-chunk"; requestId: string; responseHandle: string; sequence: number }>
)
export type SfDesktopInvocationResult =
  | Readonly<{ kind: "json-response"; status: number; headers: SfPublicHeaders; body: SfJson | null }>
  | Readonly<{ kind: "byte-response"; status: number; headers: SfPublicHeaders; responseHandle: string }>
  | Readonly<{ kind: "byte-chunk"; sequence: number; bytes: Uint8Array; done: boolean }>
  | Readonly<{ kind: "empty-response"; status: number; headers: SfPublicHeaders }>
  | SfTransportFailure
export type SfDesktopLoginResult =
  | Readonly<{ status: "authenticated"; context: SfContext }>
  | Readonly<{ status: "cancelled" }>
  | Readonly<{ status: "denied" }>
  | Readonly<{ status: "unavailable"; reason: "auth-unavailable" | "identity-unavailable" | "enrollment-unavailable" | "network" | "contract-mismatch" }>
export type SfDesktopCapability = Readonly<{
  registerConnection(candidate: SfConnectionCandidate): Promise<SfRegisterConnectionResult>
  bind(selection: Readonly<{ serverKey: string; projectId: string; installationId: string }>, onInvalidated: (event: SfDesktopInvalidation) => void): Promise<SfDesktopBindResult>
  invoke(request: SfDesktopInvocation): Promise<SfDesktopInvocationResult>
  abort(request: SfDesktopOwnerRequest & Readonly<{ requestId: string }>): Promise<void>
  login(request: SfDesktopOwnerRequest & Readonly<{ returnRoute: SfResolvedRoute }>): Promise<SfDesktopLoginResult>
  logout(request: SfDesktopOwnerRequest): Promise<Readonly<{ status: "cleared"; remote: "confirmed" | "unavailable" }>>
  release(request: (SfDesktopOwnerRequest & Readonly<{ kind: "binding" }>) | Readonly<{ kind: "connection"; serverKey: string; projectId: string; generation: number; reason: "server-removed" }>): Promise<void>
}>
// Preload channels: sf-native-register-connection, sf-native-bind, sf-native-invoke,
// sf-native-abort, sf-native-login, sf-native-logout, sf-native-release.
// Main->preload event sf-native-invalidated is filtered by active handle/generation.
// bind callback stays in preload/renderer memory; release disposes that listener.
// Streaming is pull-only: one outstanding chunk per response, monotonic sequence,
// <= RESPONSE_DOWNLOAD_CHUNK_BYTES from existing response-download; no new magic size.
// release/abort/navigation closes stream. Upload is legal only on upload catalog
// operations, validated MIME/size; no filesystem path and no generic headers.

// D01 PRIVATE main/CLI declarations. These types never enter Schema/Client exports.
export type SfLocalEnrollment = Readonly<{
  installationId: string; projectId: string; publicOrigin: string; mount: string
  url: string; expiresAt: number // epoch milliseconds, <= now + producer 10 minute TTL
}>
export type SfNativeEnrollmentReply = SfLocalEnrollment & Readonly<{
  kind: "sf-native-local-enrollment"; launchId: string; requestId: string
}>
export type SfDesktopBrokerDependencies = Readonly<{
  electron: Pick<typeof import("electron"), "app" | "BrowserWindow" | "ipcMain" | "session" | "net" | "dialog">
  operations: SfOperationBindings
  isRendererUrl: (url: string) => boolean
  isMainWindow: (window: import("electron").BrowserWindow) => boolean
  ownedConnection: () => Pick<SfConnectionCandidate, "serverKey" | "baseUrl" | "credentials"> | undefined // only actual main-owned process config; no invented project/Location
  requestLocalEnrollment: (request: Readonly<{ serverKey: string; projectId: string; installationId: string; requestId: string }>) => Promise<SfNativeEnrollmentReply>
}>
export declare function createSfDesktopBroker(deps: SfDesktopBrokerDependencies): Readonly<{
  invalidateServer(serverKey: string): Promise<void>
  dispose(): Promise<void>
}>
export declare function createSfDesktopPreloadCapability(ipc: Pick<typeof import("electron").ipcRenderer, "invoke" | "on" | "removeListener">): SfDesktopCapability
export declare function createSfDesktopCapability(preload: SfDesktopCapability): SfDesktopCapability
export declare function attachSfNativeEnrollment(options: Readonly<{
  transport: NonNullable<ReturnType<typeof import("@orchestra/app-dock/socket-transport").fromEnv>>
  launchId: string; descriptor: SfInstallationDescriptor
  enrollNativeLocal: () => Promise<SfLocalEnrollment>
}>): Readonly<{ dispose(): void }>
// attach adds kind/launchId/current requestId to the producer payload; the no-arg
// factory cannot invent/request the Dock correlation IDs. No token is logged.

// A09 NEW PRIVATE optional scheduleDetails contract. Existing BusinessPorts is
// unchanged. I00 adds this to SfHostServices.nativeUiProducts and binds only an
// actual approved producer reader; absence has the exact unavailable result below.
export type SfScheduleDetail = Readonly<{
  scheduleRef: string; version: number; state: string
  conditionRef: string; recipeRef: string; recurrence: string; timezone: string
}>
export type SfScheduleDetailResult =
  | Readonly<{ status: "ok"; value: SfScheduleDetail }>
  | Readonly<{ status: "not-found"; reason: "schedule-not-found" }>
  | Readonly<{ status: "needs-input" | "stale" | "denied" | "unavailable" | "conflict" | "provider-conflict" | "failed"; reason: string }>
// This extends the *new port result*, not legacy PortResult itself, to represent
// an authorized negative lookup explicitly. HTTP404 only for that not-found arm.
export type SfScheduleDetailsPort<TrustedDomainContext> = Readonly<{
  read(request: Readonly<{ scheduleRef: string }>, binding: TrustedDomainContext): Promise<SfScheduleDetailResult>
}>
// The private generic is instantiated ONLY with the original TrustedDomainContext
// imported from product/contracts/sf-execution.ts by the private host contract.
