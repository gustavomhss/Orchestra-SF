# Wave four — Procurement (CAP24–CAP28)

## Scope and status

This leaf implements the five native Procurement areas over the existing producers and F01 ownership. The product commit is `9af9b0820ac3cd1be090c3dbb49a35870c0368e1`; the browser journey is `91331662a8cbd81d18a819d470ea148bc11bf556`. Both belong to `sf-twenty-procurement` and are integrated by the coordinating `sf-design-twenty` branch. The independent previous wave / PR 587 is a dependency, not an edit target.

No local build, test or browser was run by this leaf. The native browser spec is written and handed to the root Actions workflow. Passing screenshots, final visual approval and CI conclusions must be recorded from that workflow; the proposed capture names below are not a claim that screenshots already exist.

## Composition

| Area | Composition and primary work |
| --- | --- |
| CAP24 overview | A single five-part metric band above one request ledger. Status filtering remains source-backed. Missing holder/aging coverage is still available in a disclosure. |
| CAP25 requests and queues | Full-width list, deliberate transition to one record, separate requisition/order editors and a focused review. Returning to the list hides the editor without clearing its draft. The create action becomes “Resume draft” while that draft exists. |
| CAP25 sourcing | One bounded editor with quotation/evaluation groups, a distinct comparison ledger, and a focused operation review. Recorded proposal values remain read-only. Producer comparison and FX text are displayed unchanged. |
| CAP26 approvals | One list or selected record at a time. Submitted PR, sourcing and purchase-order facts stay source-bound; only the proposed decision is editable. Review does not compete with the browsing surface. |
| CAP27 suppliers | One supplier ledger, a source record detail, a four-group editor (identity, contacts, commercial, compliance), and a separate review. Privileged bank edits remain a separate draft and masked-source flow. |
| CAP28 settings | A single policy form with section navigation and hairline-separated groups. The review shows only changed source fields. Settings saving does not alter existing approval snapshots. |

The shared root owns the 1160 px frame, title, source navigation and 32/24/16 px gutters. Every native leaf exposes `data-sf-wave="four"` inside its page frame, including the visible read-failure/recovery root. Leaf CSS uses `--mx-sans`, existing Orchestra color/type/radius tokens, 44 px control targets, 20 px surface padding and 24 px major section spacing. Editors are bounded to 760–900 px according to density; reviews are bounded to 760 px. The source tables retain their own internal scroll/reflow behavior.

## Source and safety boundaries

- No producer, schema, policy/grant adapter, guard, allowlist, CI workflow or schema assertion is changed by this leaf.
- Existing owner stamps, record versions/CAS, source revisions, idempotency keys, frozen operation snapshots and dispatch fences stay in their original controllers.
- Cancelling a review returns to the same draft; it does not clear the draft or post a command.
- Cancel/Revise controls are disabled only while the owning operation is checking, submitting or verifying. Merely being in “reviewing” remains interactive.
- A lost response continues to use the original unknown-outcome/reconciliation path. No retry is synthesized and no receipt is invented.
- Missing monetary values remain distinct from a recorded zero; the browser performs no replacement financial or quotation-ranking calculation.
- Existing title ownership (W19), quote/PO row metadata retention, bank redaction and source navigation remain intact.
- Original English copy is preserved. The approved pt-BR pass fills the existing leaf dictionaries and CAP28 `sf-u36.ts`; stable acronyms and established terms such as Status, Incoterms and Sourcing remain intact.

## Canonical installation data

`seedWaveFourProcurement(snapshot, actor, environment, year)` is called inside the native store's `procurement` transaction. It returns no installation metadata. The fixture supplies its real enrolled operator with the explicitly configured native `localOperator.buyer` policy, producing the real `admin` and `buyer` roles. The environment directory uses that operator's real ID/name.

All writes use `ProcurementModule.domain.execute`. The seed does not install hand-built snapshots, authentication responses, grants, decisions, comparison totals or receipts. Default quotation thresholds, approval mode and self-approval policy are retained; L1/L2 holders are assigned to the real operator through the original settings command.

The fixture contains three suppliers and seven requests: absent estimate, recorded zero estimate, PR pending, editable sourcing with three quotations, sourcing pending, PO pending, and an internally issued order. One supplier is blocked by the producer. No bank secret is submitted. All names explicitly identify design test data.

`waveFourProcurementData` exports stable names. Browser tests obtain record references from actual rendered source rows; they do not predict identifiers. Other wave-four areas may read these same canonical pending requests.

## Verification handoff

The executable journey is `packages/app-shell/e2e/sucafina/design-wave-four-procurement.spec.ts`, using `design-support/wave-four` and the production browser runner. It exercises eleven original command kinds with explicit confirmation and source readback, plus cancel/resume paths, both themes, Portuguese and 320 px reflow.

See [route and state matrix](route-state-matrix.md), [evidence plan](evidence-plan.md) and [copy audit](copy-audit.json). Root integration owns the actual run, screenshot inspection, final scores and merge decision.
