/**
 * Frozen F01 public context/route types and wire schemas.
 * Runtime codecs validate types, not authority or admission.
 * packages/app-shell/.../context/contracts.ts REEXPORTS these public types and
 * adds SfSurfaceProps; Client/Protocol/Desktop never import app-shell types.
 * This file is derived from the frozen surface-manifest routes, not a generic
 * router or permission system. Params contain original decoded opaque refs.
 */
// Documentary type provenance only. Product Schema/context REEXPORTS the
// closed catalog operation union from F02 Schema/common; it owns no new brand.
export type { SfOperationId } from "./common"
declare const sfOpaque: unique symbol
export type SfOpaque<Tag extends string> = string & { readonly [sfOpaque]: Tag }
export type SfOwnerKey = SfOpaque<"owner-key-from-F01">
export type SfRef = SfOpaque<"opaque-original-domain-ref">
export type SfIntentRef = SfOpaque<"local-unsaved-intent-from-F01">
export type SfFileSelectionRef = SfOpaque<"local-file-selection-handle">
export type SfEditScopeKey = SfOpaque<"stable-edit-selection-from-F01">
export type SurfaceId =
  | "CAP01" | "CAP02" | "CAP03" | "CAP04" | "CAP05" | "CAP06" | "CAP07" | "CAP08" | "CAP09" | "CAP10"
  | "CAP11" | "CAP12" | "CAP13" | "CAP14" | "CAP15" | "CAP16" | "CAP17" | "CAP18" | "CAP19" | "CAP20"
  | "CAP21" | "CAP22" | "CAP23" | "CAP24" | "CAP25" | "CAP26" | "CAP27" | "CAP28"
  | "UI29" | "UI30" | "UI31" | "UI32" | "UI33" | "UI34" | "UI35" | "UI36" | "UI37" | "UI38" | "UI39" | "UI40"
  | "UI41" | "UI42" | "UI43" | "UI44" | "UI45" | "UI46" | "UI47" | "UI48" | "UI49" | "UI50"
  | "UI51" | "UI52" | "UI53" | "UI54" | "UI55" | "UI56" | "UI57" | "UI58" | "UI59" | "UI60"
  | "UI61" | "UI62" | "UI63" | "UI64" | "UI65" | "UI66" | "UI67" | "UI68" | "UI69" | "UI70"
export type SfHref = SfOpaque<"same-owner-internal-route-from-F01">
export type SfOperationRef = SfOpaque<"current-operation-identity-from-client">
export type SfVersion = string | number // keep the producer type/value; never coerce

export type SfServerKey = SfOpaque<"server-key-validated-by-SDK">
export type SfOwnerSelection = Readonly<{
  serverKey: SfServerKey
  projectId: SfRef
  installationId?: SfRef
}>
/**
 * A presentation carrier, NOT a global API allowlist. Per surface/resource,
 * admit only the fields and exact values validated by operation inputRef in
 * contract-catalog.json. Preserve source period/version/filter semantics.
 * Never forward this entire object as an API body. Text search, notes, salary,
 * prompt, document content and drafts remain in memory, never in this query.
 * returnTo must already be a same-owner internal href validated by F01.
 */
export type SfResolvedQuery = Readonly<{
  procurementProposal?: Readonly<{ choiceId: string; caseVersion: number }>
  /** Prefills only the native agenda source; discovery remains an explicit action. */
  sourcePage?: string
  /** Original personal view identity only; private filters are reread after admission. */
  savedView?: SfRef
  year?: number
  month?: number
  /** CAP01 presentation priorities only; never forwarded as a producer input or authority. */
  signalPriority?: readonly string[]
  period?: string
  version?: SfRef
  status?: string
  filter?: string
  sort?: string
  cursor?: SfRef
  selection?: SfRef
  tab?: string
  case?: SfRef
  source?: SfRef
  returnTo?: SfHref
  entity?: SfRef
  allocation?: SfRef
  element?: string
  request?: SfRef
  supplier?: SfRef
  previousReview?: SfRef
  currentReview?: SfRef
  /** Selects only an original section in an authorized preserved review. */
  sectionRef?: SfRef
}>
export type SfNoParams = Readonly<Record<string, never>>
export type SfResolvedRouteMap = {
  readonly CAP01:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
  readonly CAP02:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
    | Readonly<{ kind: "new"; params: SfNoParams }>
    | Readonly<{ kind: "detail"; params: Readonly<{ topicRef: SfRef }> }>
    | Readonly<{ kind: "edit"; params: Readonly<{ topicRef: SfRef }> }>
  readonly CAP03:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
  readonly CAP04:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
    | Readonly<{ kind: "new"; params: SfNoParams }>
    | Readonly<{ kind: "detail"; params: Readonly<{ lineRef: SfRef }> }>
    | Readonly<{ kind: "edit"; params: Readonly<{ lineRef: SfRef }> }>
  readonly CAP05:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
    | Readonly<{ kind: "new"; params: SfNoParams }>
    | Readonly<{ kind: "detail"; params: Readonly<{ projectRef: SfRef }> }>
    | Readonly<{ kind: "edit"; params: Readonly<{ projectRef: SfRef }> }>
  readonly CAP06:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
  readonly CAP07:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
    | Readonly<{ kind: "cio"; params: SfNoParams }>
    | Readonly<{ kind: "leader"; params: Readonly<{ personRef: SfRef }> }>
    | Readonly<{ kind: "new-member"; params: SfNoParams }>
    | Readonly<{ kind: "member"; params: Readonly<{ personRef: SfRef }> }>
    | Readonly<{ kind: "member-edit"; params: Readonly<{ personRef: SfRef }> }>
  readonly CAP08:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
    | Readonly<{ kind: "member"; params: Readonly<{ personRef: SfRef }> }>
    | Readonly<{ kind: "edit"; params: Readonly<{ personRef: SfRef }> }>
    | Readonly<{ kind: "import"; params: SfNoParams }>
    | Readonly<{ kind: "export"; params: SfNoParams }>
  readonly CAP09:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
  readonly CAP10:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
    | Readonly<{ kind: "new"; params: SfNoParams }>
    | Readonly<{ kind: "detail"; params: Readonly<{ projectRef: SfRef }> }>
    | Readonly<{ kind: "edit"; params: Readonly<{ projectRef: SfRef }> }>
    | Readonly<{ kind: "milestones"; params: Readonly<{ projectRef: SfRef }> }>
  readonly CAP11:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
    | Readonly<{ kind: "edit-month"; params: SfNoParams }>
    | Readonly<{ kind: "settings"; params: SfNoParams }>
    | Readonly<{ kind: "import"; params: SfNoParams }>
  readonly CAP12:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
    | Readonly<{ kind: "edit-kpi"; params: SfNoParams }>
    | Readonly<{ kind: "campaign"; params: Readonly<{ recordRef: SfRef }> }>
    | Readonly<{ kind: "incident"; params: Readonly<{ recordRef: SfRef }> }>
    | Readonly<{ kind: "action"; params: Readonly<{ recordRef: SfRef }> }>
  readonly CAP13:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
    | Readonly<{ kind: "new"; params: SfNoParams }>
    | Readonly<{ kind: "detail"; params: Readonly<{ riskRef: SfRef }> }>
    | Readonly<{ kind: "edit"; params: Readonly<{ riskRef: SfRef }> }>
  readonly CAP14:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
    | Readonly<{ kind: "new"; params: SfNoParams }>
    | Readonly<{ kind: "detail"; params: Readonly<{ contractRef: SfRef }> }>
    | Readonly<{ kind: "edit"; params: Readonly<{ contractRef: SfRef }> }>
  readonly CAP15:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
    | Readonly<{ kind: "new"; params: SfNoParams }>
    | Readonly<{ kind: "detail"; params: Readonly<{ stakeholderRef: SfRef }> }>
    | Readonly<{ kind: "edit"; params: Readonly<{ stakeholderRef: SfRef }> }>
  readonly CAP16:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
    | Readonly<{ kind: "item"; params: Readonly<{ itemRef: SfRef }> }>
    | Readonly<{ kind: "subitem"; params: Readonly<{ itemRef: SfRef; subitemRef: SfRef }> }>
  readonly CAP17:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
  readonly CAP18:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
    | Readonly<{ kind: "line"; params: Readonly<{ lineRef: SfRef }> }>
    | Readonly<{ kind: "line-edit"; params: Readonly<{ lineRef: SfRef }> }>
    | Readonly<{ kind: "review"; params: SfNoParams }>
  readonly CAP19:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
    | Readonly<{ kind: "line"; params: Readonly<{ lineRef: SfRef }> }>
    | Readonly<{ kind: "line-edit"; params: Readonly<{ lineRef: SfRef }> }>
    | Readonly<{ kind: "project"; params: Readonly<{ projectRef: SfRef }> }>
    | Readonly<{ kind: "review"; params: SfNoParams }>
  readonly CAP20:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
    | Readonly<{ kind: "position"; params: Readonly<{ positionRef: SfRef }> }>
    | Readonly<{ kind: "position-edit"; params: Readonly<{ positionRef: SfRef }> }>
    | Readonly<{ kind: "rates"; params: SfNoParams }>
    | Readonly<{ kind: "settings"; params: SfNoParams }>
    | Readonly<{ kind: "roster-review"; params: SfNoParams }>
  readonly CAP21:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
    | Readonly<{ kind: "entity"; params: Readonly<{ entityRef: SfRef }> }>
    | Readonly<{ kind: "allocation"; params: Readonly<{ allocationRef: SfRef }> }>
  readonly CAP22:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
  readonly CAP23:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
    | Readonly<{ kind: "new"; params: SfNoParams }>
    | Readonly<{ kind: "detail"; params: Readonly<{ versionRef: SfRef }> }>
    | Readonly<{ kind: "compare"; params: SfNoParams }>
  readonly CAP24:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
  readonly CAP25:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
    | Readonly<{ kind: "new"; params: SfNoParams }>
    | Readonly<{ kind: "detail"; params: Readonly<{ requestRef: SfRef }> }>
    | Readonly<{ kind: "requisition"; params: Readonly<{ requestRef: SfRef }> }>
    | Readonly<{ kind: "sourcing"; params: Readonly<{ requestRef: SfRef }> }>
    | Readonly<{ kind: "quotes"; params: Readonly<{ requestRef: SfRef }> }>
    | Readonly<{ kind: "po"; params: Readonly<{ requestRef: SfRef }> }>
    | Readonly<{ kind: "history"; params: Readonly<{ requestRef: SfRef }> }>
  readonly CAP26:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
    | Readonly<{ kind: "detail"; params: Readonly<{ requestRef: SfRef }> }>
    | Readonly<{ kind: "review"; params: Readonly<{ requestRef: SfRef }> }>
  readonly CAP27:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
    | Readonly<{ kind: "new"; params: SfNoParams }>
    | Readonly<{ kind: "detail"; params: Readonly<{ supplierRef: SfRef }> }>
    | Readonly<{ kind: "edit"; params: Readonly<{ supplierRef: SfRef }> }>
  readonly CAP28:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
  readonly UI29:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
  readonly UI30:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
  readonly UI31:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
  readonly UI32:
    | Readonly<{ kind: "entry"; params: Readonly<{ viewId: SfRef }> }>
    | Readonly<{ kind: "list"; params: SfNoParams }>
    | Readonly<{ kind: "new"; params: SfNoParams }>
  readonly UI33:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
    | Readonly<{ kind: "new"; params: SfNoParams }>
  readonly UI34:
    | Readonly<{ kind: "entry"; params: Readonly<{ caseRef: SfRef }> }>
  readonly UI35:
    | Readonly<{ kind: "entry"; params: Readonly<{ caseRef: SfRef }> }>
    | Readonly<{ kind: "new"; params: Readonly<{ caseRef: SfRef }> }>
    | Readonly<{ kind: "detail"; params: Readonly<{ caseRef: SfRef; alternativeRef: SfRef }> }>
  readonly UI36:
    | Readonly<{ kind: "entry"; params: Readonly<{ caseRef: SfRef }> }>
  readonly UI37:
    | Readonly<{ kind: "entry"; params: Readonly<{ caseRef: SfRef }> }>
  readonly UI38:
    | Readonly<{ kind: "entry"; params: Readonly<{ caseRef: SfRef }> }>
  readonly UI39:
    | Readonly<{ kind: "entry"; params: Readonly<{ caseRef: SfRef; changeRef: SfRef }> }>
    | Readonly<{ kind: "list"; params: Readonly<{ caseRef: SfRef }> }>
  readonly UI40:
    | Readonly<{ kind: "entry"; params: Readonly<{ caseRef: SfRef; receiptRef: SfRef }> }>
    | Readonly<{ kind: "history"; params: Readonly<{ caseRef: SfRef }> }>
  readonly UI41:
    | Readonly<{ kind: "entry"; params: Readonly<{ caseRef: SfRef; analysisRef: SfRef }> }>
    | Readonly<{ kind: "list"; params: Readonly<{ caseRef: SfRef }> }>
  readonly UI42:
    | Readonly<{ kind: "entry"; params: Readonly<{ caseRef: SfRef }> }>
    | Readonly<{ kind: "list"; params: SfNoParams }>
  readonly UI43:
    | Readonly<{ kind: "entry"; params: Readonly<{ caseRef: SfRef; resultRef: SfRef }> }>
  readonly UI44:
    | Readonly<{ kind: "entry"; params: Readonly<{ caseRef: SfRef; resultRef: SfRef }> }>
    | Readonly<{ kind: "selection"; params: SfNoParams }>
  readonly UI45:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
  readonly UI46:
    | Readonly<{ kind: "entry"; params: Readonly<{ viewId: SfRef }> }>
  readonly UI47:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
  readonly UI48:
    | Readonly<{ kind: "entry"; params: Readonly<{ reviewRef: SfRef }> }>
    | Readonly<{ kind: "list"; params: SfNoParams }>
    | Readonly<{ kind: "present"; params: Readonly<{ reviewRef: SfRef }> }>
  readonly UI49:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
  readonly UI50:
    | Readonly<{ kind: "entry"; params: Readonly<{ reviewRef: SfRef }> }>
    | Readonly<{ kind: "list"; params: SfNoParams }>
  readonly UI51:
    | Readonly<{ kind: "entry"; params: Readonly<{ relationRef: SfRef }> }>
    | Readonly<{ kind: "new"; params: SfNoParams }>
    | Readonly<{ kind: "case-alias"; params: Readonly<{ caseRef: SfRef }> }>
  readonly UI52:
    | Readonly<{ kind: "entry"; params: Readonly<{ threadRef: SfRef }> }>
  readonly UI53:
    | Readonly<{ kind: "entry"; params: Readonly<{ selectionRef: SfRef }> }>
  readonly UI54:
    | Readonly<{ kind: "entry"; params: Readonly<{ proposalRef: SfRef }> }>
  readonly UI55:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
  readonly UI56:
    | Readonly<{ kind: "entry"; params: Readonly<{ manifestId: SfRef }> }>
  readonly UI57:
    | Readonly<{ kind: "entry"; params: Readonly<{ manifestId: SfRef }> }>
    | Readonly<{ kind: "review"; params: Readonly<{ manifestId: SfRef }> }>
    | Readonly<{ kind: "history"; params: SfNoParams }>
  readonly UI58:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
    | Readonly<{ kind: "new"; params: SfNoParams }>
    | Readonly<{ kind: "detail"; params: Readonly<{ documentRef: SfRef }> }>
  readonly UI59:
    | Readonly<{ kind: "entry"; params: Readonly<{ documentRef: SfRef }> }>
  readonly UI60:
    | Readonly<{ kind: "entry"; params: Readonly<{ documentRef: SfRef }> }>
  readonly UI61:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
    | Readonly<{ kind: "chapter-root"; params: SfNoParams }>
  readonly UI62:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
  readonly UI63:
    | Readonly<{ kind: "entry"; params: Readonly<{ selectionRef: SfRef }> }>
    | Readonly<{ kind: "selection"; params: SfNoParams }>
  readonly UI64:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
    | Readonly<{ kind: "recipe"; params: Readonly<{ recipeRef: SfRef }> }>
    | Readonly<{ kind: "admission"; params: Readonly<{ admissionRef: SfRef }> }>
  readonly UI65:
    | Readonly<{ kind: "entry"; params: Readonly<{ runRef: SfRef }> }>
    | Readonly<{ kind: "list"; params: SfNoParams }>
  readonly UI66:
    | Readonly<{ kind: "entry"; params: Readonly<{ scheduleRef: SfRef }> }>
    | Readonly<{ kind: "list"; params: SfNoParams }>
    | Readonly<{ kind: "new"; params: SfNoParams }>
  readonly UI67:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
  readonly UI68:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
  readonly UI69:
    | Readonly<{ kind: "entry"; params: SfNoParams }>
  readonly UI70:
    | Readonly<{ kind: "entry"; params: SfNoParams }>

}
export type SfResolvedRoute<Id extends SurfaceId = SurfaceId> = {
  // Build the complete discriminated map first, then select Id. A generic Id
  // otherwise becomes a broad union in the payload while surfaceId remains
  // uncorrelated, preventing valid routes from flowing through typed links.
  [Current in SurfaceId]: Readonly<{
    surfaceId: Current
    ownerSelection: SfOwnerSelection
    href: SfHref
    pathname: string
    query: SfResolvedQuery
  }> & SfResolvedRouteMap[Current]
}[Id]
/**
 * F01 creates this only after route syntax, ref codec, owner selection and the
 * applicable source query validators pass. It can exist before SF login and
 * carries NO principal, grants, lease or authenticated client. F01 context
 * readiness separately gates data reads/actions; a decoded ref is not access.
 * pathname and href must roundtrip to the manifest template for surface/kind.
 * Unknown params/query keys for that specific resource are rejected, not copied.
 */

import { Schema } from "effect"
import { SfOperationId } from "./common"

/** Frozen UI inventory; route parsing never implies a principal or grant. */
export const SurfaceIdSchema = Schema.Literals(["CAP01", "CAP02", "CAP03", "CAP04", "CAP05", "CAP06", "CAP07", "CAP08", "CAP09", "CAP10", "CAP11", "CAP12", "CAP13", "CAP14", "CAP15", "CAP16", "CAP17", "CAP18", "CAP19", "CAP20", "CAP21", "CAP22", "CAP23", "CAP24", "CAP25", "CAP26", "CAP27", "CAP28", "UI29", "UI30", "UI31", "UI32", "UI33", "UI34", "UI35", "UI36", "UI37", "UI38", "UI39", "UI40", "UI41", "UI42", "UI43", "UI44", "UI45", "UI46", "UI47", "UI48", "UI49", "UI50", "UI51", "UI52", "UI53", "UI54", "UI55", "UI56", "UI57", "UI58", "UI59", "UI60", "UI61", "UI62", "UI63", "UI64", "UI65", "UI66", "UI67", "UI68", "UI69", "UI70"]).annotate({ identifier: "Sucafina.SurfaceId" })
const NonEmpty = Schema.NonEmptyString
const AuthMode = Schema.Literals(["microsoft", "local-operator"])

export const SfInstallationDescriptor = Schema.Struct({
  installationId: NonEmpty,
  projectId: NonEmpty,
  hostId: NonEmpty,
  publicOrigin: NonEmpty,
  mount: NonEmpty,
  contractRevision: Schema.Literal("sf-native-ui/1"),
  authMode: AuthMode,
}).annotate({ identifier: "Sucafina.InstallationDescriptor" })
export interface SfInstallationDescriptor extends Schema.Schema.Type<typeof SfInstallationDescriptor> {}
export const SfInstallationList = Schema.Struct({
  installations: Schema.Array(SfInstallationDescriptor),
}).annotate({ identifier: "Sucafina.InstallationList" })
export interface SfInstallationList extends Schema.Schema.Type<typeof SfInstallationList> {}
export const SfInstallationSelector = Schema.Union([
  Schema.Struct({ select: Schema.Literal("ids"), installationId: NonEmpty, projectId: NonEmpty }),
  Schema.Struct({ select: Schema.Literal("location"), location: Schema.Struct({ directory: NonEmpty, workspace: Schema.optional(NonEmpty) }) }),
]).annotate({ identifier: "Sucafina.InstallationSelector" })
export type SfInstallationSelector = Schema.Schema.Type<typeof SfInstallationSelector>
/**
 * The HttpApi SDK generator requires a top-level Struct for query fields.
 * This is a transport projection, not the semantic selector. The server must
 * parse the ORIGINAL raw URL with parseSfInstallationSelector before discovery:
 * that closed discriminated union rejects missing, mixed, unknown and duplicate
 * fields, including cross-owner or stale Location fallback attempts.
 * Do not infer authority from an SDK-decoded query.
 */
export const SfInstallationQuery = Schema.Struct({
  select: Schema.Literals(["ids", "location"]),
  installationId: Schema.optional(NonEmpty),
  projectId: Schema.optional(NonEmpty),
  location: Schema.optional(Schema.Struct({
    directory: NonEmpty,
    workspace: Schema.optional(NonEmpty),
  })),
}).annotate({ identifier: "Sucafina.InstallationQuery" })
export const SfExpectedContextBinding = Schema.Struct({
  installationId: NonEmpty, projectId: NonEmpty, hostId: NonEmpty,
}).annotate({ identifier: "Sucafina.ExpectedContextBinding" })
export interface SfExpectedContextBinding extends Schema.Schema.Type<typeof SfExpectedContextBinding> {}
export const SfNativeOwnerExpectation = Schema.Struct({
  installationId: NonEmpty, projectId: NonEmpty, hostId: NonEmpty, principalRef: NonEmpty,
}).annotate({ identifier: "Sucafina.NativeOwnerExpectation" })
export interface SfNativeOwnerExpectation extends Schema.Schema.Type<typeof SfNativeOwnerExpectation> {}
export const SfContextStamp = Schema.Struct({
  installationId: NonEmpty, projectId: NonEmpty, hostId: NonEmpty, principalRef: NonEmpty,
  policyVersion: NonEmpty, accessRevision: NonEmpty,
}).annotate({ identifier: "Sucafina.ContextStamp" })
export interface SfContextStamp extends Schema.Schema.Type<typeof SfContextStamp> {}

export const SfResourceKey = Schema.Union([
  Schema.Struct({ family: Schema.Literal("ctx"), resource: Schema.Literal("context") }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("CAP01") }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("CAP02") }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("CAP03") }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("CAP04") }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("CAP05") }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("CAP06") }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("CAP07") }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("CAP08") }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("CAP09") }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("CAP10") }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("CAP11") }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("CAP12") }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("CAP13") }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("CAP14") }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("CAP15") }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("CAP16") }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("home") }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("work") }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("search") }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("local-admin") }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("views") }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("hot-topic-proposal") }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("questions") }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("threads") }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("relations") }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("confirmations") }),
  Schema.Struct({ family: Schema.Literal("planner"), resource: Schema.Literal("CAP17") }),
  Schema.Struct({ family: Schema.Literal("planner"), resource: Schema.Literal("CAP18") }),
  Schema.Struct({ family: Schema.Literal("planner"), resource: Schema.Literal("CAP19") }),
  Schema.Struct({ family: Schema.Literal("planner"), resource: Schema.Literal("CAP20") }),
  Schema.Struct({ family: Schema.Literal("planner"), resource: Schema.Literal("CAP21") }),
  Schema.Struct({ family: Schema.Literal("planner"), resource: Schema.Literal("CAP22") }),
  Schema.Struct({ family: Schema.Literal("planner"), resource: Schema.Literal("CAP23") }),
  Schema.Struct({ family: Schema.Literal("procurement"), resource: Schema.Literal("CAP24") }),
  Schema.Struct({ family: Schema.Literal("procurement"), resource: Schema.Literal("CAP25") }),
  Schema.Struct({ family: Schema.Literal("procurement"), resource: Schema.Literal("CAP26") }),
  Schema.Struct({ family: Schema.Literal("procurement"), resource: Schema.Literal("CAP27") }),
  Schema.Struct({ family: Schema.Literal("procurement"), resource: Schema.Literal("CAP28") }),
  Schema.Struct({ family: Schema.Literal("decisions"), resource: Schema.Literal("cases") }),
  Schema.Struct({ family: Schema.Literal("decisions"), resource: Schema.Literal("case-intent") }),
  Schema.Struct({ family: Schema.Literal("decisions"), resource: Schema.Literal("alternatives") }),
  Schema.Struct({ family: Schema.Literal("decisions"), resource: Schema.Literal("comparison") }),
  Schema.Struct({ family: Schema.Literal("decisions"), resource: Schema.Literal("portfolio-catalog") }),
  Schema.Struct({ family: Schema.Literal("decisions"), resource: Schema.Literal("assumptions") }),
  Schema.Struct({ family: Schema.Literal("decisions"), resource: Schema.Literal("choice") }),
  Schema.Struct({ family: Schema.Literal("decisions"), resource: Schema.Literal("prepared-changes") }),
  Schema.Struct({ family: Schema.Literal("decisions"), resource: Schema.Literal("receipts") }),
  Schema.Struct({ family: Schema.Literal("portfolio"), resource: Schema.Literal("campaign") }),
  Schema.Struct({ family: Schema.Literal("portfolio"), resource: Schema.Literal("results") }),
  Schema.Struct({ family: Schema.Literal("portfolio"), resource: Schema.Literal("sensitivity") }),
  Schema.Struct({ family: Schema.Literal("files"), resource: Schema.Literal("import-admit") }),
  Schema.Struct({ family: Schema.Literal("files"), resource: Schema.Literal("import-preview") }),
  Schema.Struct({ family: Schema.Literal("files"), resource: Schema.Literal("import-apply") }),
  Schema.Struct({ family: Schema.Literal("files"), resource: Schema.Literal("documents") }),
  Schema.Struct({ family: Schema.Literal("files"), resource: Schema.Literal("evidence") }),
  Schema.Struct({ family: Schema.Literal("files"), resource: Schema.Literal("document-scenario") }),
  Schema.Struct({ family: Schema.Literal("files"), resource: Schema.Literal("exports") }),
  Schema.Struct({ family: Schema.Literal("reviews"), resource: Schema.Literal("agenda") }),
  Schema.Struct({ family: Schema.Literal("reviews"), resource: Schema.Literal("preserved") }),
  Schema.Struct({ family: Schema.Literal("reviews"), resource: Schema.Literal("compare") }),
  Schema.Struct({ family: Schema.Literal("reviews"), resource: Schema.Literal("report-export") }),
  Schema.Struct({ family: Schema.Literal("bi"), resource: Schema.Literal("catalog") }),
  Schema.Struct({ family: Schema.Literal("bi"), resource: Schema.Literal("visual") }),
  Schema.Struct({ family: Schema.Literal("intelligence"), resource: Schema.Literal("routine-runs") }),
  Schema.Struct({ family: Schema.Literal("intelligence"), resource: Schema.Literal("residents") }),
  Schema.Struct({ family: Schema.Literal("intelligence"), resource: Schema.Literal("signals") }),
  Schema.Struct({ family: Schema.Literal("intelligence"), resource: Schema.Literal("similar-cases") }),
  Schema.Struct({ family: Schema.Literal("intelligence"), resource: Schema.Literal("outcomes") }),
  Schema.Struct({ family: Schema.Literal("intelligence"), resource: Schema.Literal("analysis") }),
  Schema.Struct({ family: Schema.Literal("intelligence"), resource: Schema.Literal("routine-admission") }),
  Schema.Struct({ family: Schema.Literal("intelligence"), resource: Schema.Literal("schedules") })
]).annotate({ identifier: "Sucafina.ResourceKey" })
export type SfResourceKey = Schema.Schema.Type<typeof SfResourceKey>
export const SfOperationAvailability = Schema.Union([
  Schema.Struct({ operationId: SfOperationId, state: Schema.Literal("ready"), reason: Schema.Null, operational: Schema.Literal(true) }),
  Schema.Struct({ operationId: SfOperationId, state: Schema.Literals(["denied", "unavailable"]), reason: NonEmpty, operational: Schema.Literal(false) }),
]).annotate({ identifier: "Sucafina.OperationAvailability" })
export type SfOperationAvailability = Schema.Schema.Type<typeof SfOperationAvailability>
const ResourceStatus = Schema.Literals(["ready", "partial", "denied", "unavailable"])
const ResourceOperations = Schema.Array(SfOperationAvailability)
export const SfResourceAvailability = Schema.Union([
  Schema.Struct({ family: Schema.Literal("ctx"), resource: Schema.Literal("context"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("CAP01"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("CAP02"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("CAP03"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("CAP04"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("CAP05"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("CAP06"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("CAP07"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("CAP08"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("CAP09"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("CAP10"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("CAP11"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("CAP12"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("CAP13"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("CAP14"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("CAP15"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("CAP16"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("home"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("work"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("search"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("local-admin"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("views"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("hot-topic-proposal"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("questions"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("threads"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("relations"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("domain-read"), resource: Schema.Literal("confirmations"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("planner"), resource: Schema.Literal("CAP17"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("planner"), resource: Schema.Literal("CAP18"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("planner"), resource: Schema.Literal("CAP19"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("planner"), resource: Schema.Literal("CAP20"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("planner"), resource: Schema.Literal("CAP21"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("planner"), resource: Schema.Literal("CAP22"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("planner"), resource: Schema.Literal("CAP23"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("procurement"), resource: Schema.Literal("CAP24"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("procurement"), resource: Schema.Literal("CAP25"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("procurement"), resource: Schema.Literal("CAP26"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("procurement"), resource: Schema.Literal("CAP27"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("procurement"), resource: Schema.Literal("CAP28"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("decisions"), resource: Schema.Literal("cases"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("decisions"), resource: Schema.Literal("case-intent"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("decisions"), resource: Schema.Literal("alternatives"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("decisions"), resource: Schema.Literal("comparison"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("decisions"), resource: Schema.Literal("portfolio-catalog"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("decisions"), resource: Schema.Literal("assumptions"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("decisions"), resource: Schema.Literal("choice"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("decisions"), resource: Schema.Literal("prepared-changes"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("decisions"), resource: Schema.Literal("receipts"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("portfolio"), resource: Schema.Literal("campaign"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("portfolio"), resource: Schema.Literal("results"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("portfolio"), resource: Schema.Literal("sensitivity"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("files"), resource: Schema.Literal("import-admit"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("files"), resource: Schema.Literal("import-preview"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("files"), resource: Schema.Literal("import-apply"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("files"), resource: Schema.Literal("documents"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("files"), resource: Schema.Literal("evidence"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("files"), resource: Schema.Literal("document-scenario"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("files"), resource: Schema.Literal("exports"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("reviews"), resource: Schema.Literal("agenda"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("reviews"), resource: Schema.Literal("preserved"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("reviews"), resource: Schema.Literal("compare"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("reviews"), resource: Schema.Literal("report-export"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("bi"), resource: Schema.Literal("catalog"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("bi"), resource: Schema.Literal("visual"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("intelligence"), resource: Schema.Literal("routine-runs"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("intelligence"), resource: Schema.Literal("residents"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("intelligence"), resource: Schema.Literal("signals"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("intelligence"), resource: Schema.Literal("similar-cases"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("intelligence"), resource: Schema.Literal("outcomes"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("intelligence"), resource: Schema.Literal("analysis"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("intelligence"), resource: Schema.Literal("routine-admission"), state: ResourceStatus, operations: ResourceOperations }),
  Schema.Struct({ family: Schema.Literal("intelligence"), resource: Schema.Literal("schedules"), state: ResourceStatus, operations: ResourceOperations })
]).annotate({ identifier: "Sucafina.ResourceAvailability" })
export type SfResourceAvailability = Schema.Schema.Type<typeof SfResourceAvailability>
export const SfContext = Schema.Struct({
  stamp: SfContextStamp,
  contractRevision: Schema.Literal("sf-native-ui/1"),
  authMode: AuthMode,
  destinations: Schema.Array(Schema.Struct({
    capabilityId: SurfaceIdSchema,
    surface: Schema.Literals(["dashboard", "planner", "procurement"]),
    page: NonEmpty,
    canRead: Schema.Boolean,
    allowedActionIds: Schema.Array(Schema.String),
  })),
  availability: Schema.Array(SfResourceAvailability),
}).annotate({ identifier: "Sucafina.Context" })
export interface SfContext extends Schema.Schema.Type<typeof SfContext> {}
export const SfContextResult = Schema.Union([
  Schema.Struct({ status: Schema.Literal("ok"), value: SfContext }),
  Schema.Struct({ status: Schema.Literal("unauthenticated") }),
  Schema.Struct({ status: Schema.Literal("denied") }),
  Schema.Struct({ status: Schema.Literal("unavailable"), reason: Schema.Literals(["identity-unavailable", "host-unavailable", "contract-mismatch"]) }),
]).annotate({ identifier: "Sucafina.ContextResult" })
export type SfContextResult = Schema.Schema.Type<typeof SfContextResult>

/** Runtime authority check after schema decode: reject undeclared family/resource pairs. */
export function sfIsCatalogResource(input: Readonly<{ family: string; resource: string }>): input is SfResourceKey {
  return Schema.is(SfResourceKey)(input)
}
