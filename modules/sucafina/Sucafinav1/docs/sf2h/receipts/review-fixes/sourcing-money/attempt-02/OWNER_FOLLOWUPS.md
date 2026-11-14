# External follow-ups — proposed patches only

These patches are not applied to product and are not covered by the sourcing-money functional green. All observed source blobs are unchanged from base ba8a09e371ce8d93eb917eabb102caaee5affaf4 to tested product aa5d8c0ee49777ea82bc707df8c976d311728292.

## Legacy monetary value
- Owner: WP04/runtime consumer (outside this mission's two product write paths).
- Path: modules/sucafina/Sucafinav1/runtime/procurement.ts.
- Preimage blob: 6cd5783d5b4f6f9c9ed3e15547d59f79ccb5ef72.
- Execution: run43625920456, job132541573935; sourcing-money:pending diagnostic records rawLegacyValue200 with C02/C06/comparison108 and sameFingerprint true.
- Reproduction: create and approve PR; save complete EUR100 quote atFX1.08; select_quote; submit_sourcing; Settings EURFX2. Domain view request.value is200, whereas the corrected C02-backed queue and detail summary are108.
- Proposed patch legacy-value-owner.patch reuses the shared stage-aware monetary projection for domain.view.value and removes its now-unused requestValue import. It is a consumer proposal, not authorization to edit runtime in this mission.
- Owner validation: apply against the preimage or reconcile later changes; exercise the unmounted Requests table and separate order-difference text, export/register consumers, PO and cancelled states with focused CI.

## Inherited package typecheck error
- Owner: WP14 test / composition.
- Path: modules/sucafina/Sucafinav1/test/product/wp14/source-access-atlas.test.ts:167.
- Preimage blob: fbe627ffde443ff7e2d3b1204bbcf67523404f41.
- Required callee: apps/cli/src/sucafina-product/business-services.ts, blob9aee116a091c684ba467f81316d2fb915b3f8758; createSfBusinessServices requires procurementEvidenceWrites: WeakSet<object>.
- Both blobs are identical at the initial mission base and tested product. This is not a sourcing-money product delta.
- Execution: check run43626182880, job132542383185, Sucafina typecheck TS2741 Property 'procurementEvidenceWrites' is missing.
- Proposed patch wp14-typecheck-owner.patch adds an empty evidence-write WeakSet to that test's existing real-service construction. It grants no evidence marker and changes no production policy.
- Owner validation: apply/reconcile on the authorized WP14 branch, run package bun typecheck and the relevant source-access test when its inputs change. This mission does not edit that file or claim this patch tested.
