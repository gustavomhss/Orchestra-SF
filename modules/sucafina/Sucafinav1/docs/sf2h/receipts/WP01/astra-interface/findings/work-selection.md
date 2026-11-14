# WP01 finding: first-cycle authorized work selection

## Current producer and remaining consumer dependency

The group composition has the existing period-only `procurementSelections.create(context, period)` consumer. The published integration head `ff7a99753d1fd1bc8b68b4f2642fed26e3cadbdf` additionally publishes collaboration HTTP, work projection and routine discovery. Those capabilities are **published dependencies pending composition**, not absent implementations.

The remaining first-cycle gap is specific: the shared host contract cannot discover or accept an explicit set of records and directory-confirmed responsible people. `product/interface/http.ts` accepts only `sf/start/end` for `workbench-work-select`; `SfHostServices.procurementSelections.create` receives only `Period`; `business-services.ts` binds `{purpose:'work-selection', period}` and creates the Procurement collection. `product/collaboration/work-port.ts` correctly limits My work to the admitted principal. A UI dropdown alone cannot satisfy this requirement and must not silently expand that scope.

Criteria: WP01.T04.CMP.02, WP01.T04.CMP.01, WP01.T04.SUC.01; WP01.T04.INV.01 and WP01.INV.01 remain mandatory constraints.

## Proposed additive private seam for the integration owner

Add an optional `workSelections` service to `product/contracts/host-context.ts`, leaving the existing Procurement-only consumer functional while the richer service is adopted. Suggested shape:

```ts
type WorkSelectionRequest = {
  period: Period
  recordChoices: readonly string[]
  responsibleIds: readonly string[]
  expectedDiscoveryRevision: string
}

workSelections?: {
  discover: (context: TrustedUiContext, input: { period: Period }) => Promise<PortResult<{
    state: 'unconfigured' | 'ready'
    discoveryRevision: string
    records: readonly { choiceRef: string; label: string; surface: 'dashboard' | 'planner' | 'procurement'; context: string }[]
    responsible: readonly { id: string; name: string }[]
  }>>
  create: (context: TrustedUiContext, input: WorkSelectionRequest) => Promise<PortResult<{
    selectionRef: string
    label: string
    period: Period
  }>>
}
```

This is a proposal for a producer-owned contract; it is not an installed capability or a passing product proof. `choiceRef` must resolve to a host-issued canonical source reference, never an ID reconstructed from a label or DOM. A selection is a read scope, not a grant and not a task assignment. If assigning responsibility requires a domain mutation, expose that as a separate explicit domain action with its own preview, authority and receipt.

### Producer changes and checks

1. `apps/cli/src/sucafina-product/business-services.ts`: `discover` binds the admitted intent to `{purpose:'work-selection-discovery', period}` and exposes only current authorized source labels and directory people. `create` binds the entire canonical `WorkSelectionRequest`, resolves every record choice, and checks selected directory IDs and `expectedDiscoveryRevision` immediately before issuing the private selection token. Recheck access after reading sources; do not trust options merely because they were once displayed.
2. `modules/sucafina/Sucafinav1/product/collaboration/selection.ts`: represent the selected canonical members and any selected recipient filter in the private token. Resolve and `contains` must verify current membership, incarnation, source revision, period and principal/access/policy scope. Preserve Procurement collection continuity checks.
3. `product/collaboration/work-port.ts`: consume the issued filter without broadening its existing authority. A responsible-person filter may restrict already-authorized results; it does not authorize reading that person's work. The host must distinguish no configuration, denied access, and a valid empty work projection.
4. `apps/cli/src/sucafina-product/host-context.ts`: publish the additive service from the actual composition. Do not expose request objects, identity bindings, authority tickets, or raw snapshots to the browser.

### UI consumer once the seam is published

`product/interface/http.ts` and a shared widget under `product/ui/` can offer period first, then authorized records and responsible people, preserve the choices on transient failure, clear them on revocation, and submit exact selected opaque references. The resulting work route keeps `selectionRef` and period and consumes the current real projection. The first page distinguishes “Configure a work selection”, “Work access unavailable”, and “No pending work in this selection”; none are represented as an invented task.

### Required GitHub Actions proof

Use real host/auth/source stores: discover and select one permitted record/person; demonstrate no forbidden titles/counts/IDs; tampered or revoked choice fails before selection creation; changed period/record incarnation/discovery revision requires fresh review; selecting a different person does not grant access; no config differs from valid empty work; reload/open destination revalidates the issued selection. Include an HTTP/browser consumer assertion rather than only a registry unit test. Native/global acceptance remains with S0/WP10.

No foreign source file was changed for this finding.
