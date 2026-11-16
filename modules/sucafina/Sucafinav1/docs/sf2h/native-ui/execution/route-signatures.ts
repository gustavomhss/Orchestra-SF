/**
 * NORMATIVE PLANNING SPECIFICATION — F01 public context/route types.
 * No runtime, parser implementation or authority is provided here.
 * Product location: packages/schema/src/sucafina/context.ts (F01).
 * packages/app-shell/.../context/contracts.ts REEXPORTS these public types and
 * adds SfSurfaceProps; Client/Protocol/Desktop never import app-shell types.
 * This file is derived from the frozen surface-manifest routes, not a generic
 * router or permission system. Params contain original decoded opaque refs.
 */
// Documentary type provenance only. Product Schema/context REEXPORTS the
// closed catalog operation union from F02 Schema/common; it owns no new brand.
export type { SfOperationId } from "./host-signatures"
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
  year?: number
  month?: number
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
  [Current in Id]: Readonly<{
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
