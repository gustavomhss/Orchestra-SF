# Mission 145 — inert consumer handoff to 132

This note is **not an applied patch**. No protected file was touched.

## Provenance / current guard

- S0 `sf-ux-n23` `3c92bcdd3e223d9e28f87000a6fd3539ac9a8c18`; ACK `ccbb404d7a01429cb3b2c6296350762c025c4e03`.
- PR [#173](https://github.com/gustavomhss/Orchestra-SF/pull/173) → `sf2-stack`; owned implementation snapshots in `HANDOFF.json`.
- W13 protected PR approvals come from [#115](https://github.com/gustavomhss/Orchestra-SF/pull/115), branch `sf-ux-w13`, `approvals/pr/index.tsx` blob `847521e06a2cef99daae72bac5dbe42aaab02801`. The canonical `approvals/index.tsx` was not found on `sf2-stack`, `sf-ux-n23` or `sf-ux-w13` during pre-handoff reads. **Do not infer any preimage or overwrite this path with a guessed implementation**.
- `sf-u13.ts` on this N23 branch imports protected W13 `approvals/pr/copy`: 132 must integrate the original W13 copy first; do not reconstruct it.

## Exact source symbols to compose (read the actual leaf implementations)

- `SfSourcingView` from `procurement/sourcing/index.tsx` — CAP25 `SfSurfaceProps<"CAP25">`, status `sourcing/src_rejected`, canonical producer `domain.page.CAP25` / `domain.command.CAP25.*`. `SfSourcingCaseComparison` from `sourcing/case-comparison.tsx` may mount only with a genuine admitted A03 decision caseRef (source digest/currency/period). Never manufacture case identity from an RFQ URL.
- `SfSuppliersView` from `procurement/suppliers/index.tsx` — CAP27 `SfSurfaceProps<"CAP27">`, original producer `domain.page.CAP27` and `domain.command.CAP27.*`, shared S01/S03 components. CSV remains disabled because no source-authorized export-byte binding exists.
- `SfPrApprovalView` from W13 `procurement/approvals/pr/index.tsx` and **this branch's** `SfRemainingApprovalsView` from `procurement/approvals/remaining/index.tsx` — both CAP26. On the canonical CAP26 entry/review route, consult an **authorized current** `domain.page.CAP26` projection under F01 owner/context stamp. Route a `pr_pending` source to the protected PR consumer; `src_pending`/`po_pending` to remaining; other statuses are read-only/not-pending. Queue entry must not take a route parameter as a permission or assume submitted currency. Do not render competing independent action composers or imply a PR decision grants Planner M31/MI07 financial approval.

### Consumer interface contract (inert sketch, not a file edit)

```ts
import { SfPrApprovalView } from "./pr"
import { SfRemainingApprovalsView } from "./remaining"

// 132 owns the CAP26 source-authenticated switch and protected index.
// Entry/review selects via current producer stage, not URL alone.
// CAP26 pr_pending => SfPrApprovalView
// CAP26 src_pending || po_pending => SfRemainingApprovalsView
// No submitted stage, missing currency or no holder authority => read-only.
```

## Surgical check routing

- [PR #107](https://github.com/gustavomhss/Orchestra-SF/pull/107): 149 owns compiler/codegen/guards **after 132 integrates**.
- [PR #106](https://github.com/gustavomhss/Orchestra-SF/pull/106): 150 owns F04 installed Playwright 15 scenarios for U12/U13/U14. Fixture refs required: `SF_NATIVE_U12_COMPARISON_REF,EDIT_REF,SELECTION_REF,LOST_RESPONSE_REF`; `SF_NATIVE_U13_SOURCING_REF,PO_REF,REJECT_REF,APPROVE_REF,LOST_RESPONSE_REF`; `SF_NATIVE_U14_EDIT_REF,BANK_REF,LOST_RESPONSE_REF`. Missing host/candidate/seed is failure, not an E2E pass. Capture 320/768/1024/1280/1440 and 200%-root 400% reflow evidence.
- Never rerun a lost mutation from a new idempotency key; re-read producer state/receipts only. `shared/draft/index.tsx` retains the pending fence on definite negative responses: escalating its negative-status recovery contract belongs the shared S03 owner, not N23.

**Status:** AUTHOR ARTIFACT READY; proof/CI/installed/desktop/visual/release **NOT_RUN/NOT_APPROVED**. Goal paused.
