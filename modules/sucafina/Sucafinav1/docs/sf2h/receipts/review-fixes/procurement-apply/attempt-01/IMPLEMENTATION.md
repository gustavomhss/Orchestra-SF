# OPS-REV-02 — Procurement Apply

Status at this checkpoint: implementation prepared; hosted validation not yet run. This file records scope and expected behavior, not a passing receipt.

## Fixed inputs and ownership

- Repository: `gustavomhss/Orchestra-SF`.
- Branch: `procurement-apply`; PR target: `astra-operations`; no merge.
- Initial and pre-edit head: `ba8a09e371ce8d93eb917eabb102caaee5affaf4`.
- Mission and COMMON: `30e2215749d5295f81fdeafccb9e69ba21d0cdb8`, `docs/sf2h/control/handoff/astra/review-fixes/`.
- Complete WP04 pack and CI protocol: `a3d29d011ba3607a57914701300f09117a3e2de9`, `docs/sf2h/control/handoff/astra/`.
- Normative source: `dbf9547211d9b0fade619790de7c19c0869b7c7d`, `docs/sf2h-plan/`, including execution/COMMON, C03/C12, product-acceptance and resident-runtime.
- Product lease: only `product/procurement/prepared.ts`, `scenario-preparation.ts`, and `prepared-review.ts`. Tests and receipts remain under `review-fixes/procurement-apply/`.

The wider historical WP04 ownership does not expand this mission's lease. Runtime Procurement, UI decision-apply, C12 host/executor, policies and other writers remain unchanged. No external patch is required for the correction: the existing C12 bridge reconstructs the mutation through the strengthened producer before Apply.

## Cause and changed behavior

The real Procurement runtime allows a PO save in `po_draft` but only applies `values.pr` in `draft` or `pr_rejected`. The previous prepared producer accepted a successful save and a `Saved` event while checking untouched fields; it did not require each requested PR field to equal the submitted intent. C12 could therefore produce a success receipt for an ignored PR replacement.

The prepared producer now rejects PR preparation outside the two existing editable stages. Its shared preview/execution path checks every requested physical PR field after the real `domain.execute` call and before admitting staged state. Existing authority, source, incarnation, version/CAS, preview digest, history and untouched-field checks remain in place.

Scenario preparation reports `needs-input / requisition-stage-not-editable` for an incompatible stage. An exact value already present reports `needs-input / requisition-already-matches`. A complete no-op produces no prepared mutation, `Saved` event, CAS increment or success receipt; it does not imply a prior idempotent execution. A mixed command can retain one value while changing another.

Review revalidates the stage and compares each requested field with its projected result (`title` to `subject`, `justification` to `reason`, `estAmount` to `originalAmount`), preserving currency. An inconsistent preview is unavailable with `prepared-intent-mismatch`; a review with no actual changes is explicitly not applicable. The physical PR comparison remains the decisive post-condition because a monetary projection may otherwise refer to a PO or quote.

No new C12 state is introduced. A real replay still retrieves the prior authorized receipt through the existing idempotent path; equality of values alone is not a receipt.

## Criterion mapping

| Criterion | Delimited obligation |
| --- | --- |
| WP04.QLT.10 | Explicit stage/no-op/intent failure, verifiable version and digest |
| WP04.DOD.02 | Same real Procurement records, services, SQLite state and receipts |
| WP04.T02.SUC.02 / C03 | No confirmation of a substitution that did not persist; CAS preserved |
| WP04.INV.01 / WP04.INV.02 | Original authority, legal stages, history and identifiers preserved |
| C12 | Contextual review/Apply and receipt represent the exact domain result; retry has one effect |
| CAMP.QLT.03 / sf2h-integral-20261112.QLT.07 | Comprehensible refusal and confirmation only after effective persistence |
| CAMP.CMP.02 | Positive, incompatible stage, no-op, stale/digest, retry and revoked authority |

These mappings do not assert complete WP04, AM04, global campaign or release acceptance. The campaign remains 15 WPs, 74 tasks, 17 contracts and 1,610 criteria.

## Validation boundary

Tests use the real preparation, review, HTTP Apply and SQLite consumers with synthetic, explicitly seeded decision inputs. No AI execution or human timing is claimed. The PO fixture must be normalized by the real domain save before source issuance so that incidental normalization cannot explain the refusal.

Hosted tests will use the existing `test-ci` snapshot/request protocol. W is the committed product; S is its direct descendant containing only `.ci-run.json`. Selection, request, fixture/config equivalence, run/jobs, Omni control and true results belong in a separate immutable attempt receipt after observation. Typecheck and guards use the existing scoped operations check workflow against an explicitly recorded product and dev SHA. No product tests run locally; no epic/full suite, new workflow, global dispatcher or UI recovery mission is included.

## Product preimages

| File under product/procurement/ | Base blob |
| --- | --- |
| prepared.ts | `9c1b657dc4d6d5ba139c4f9fe854c1c8960cc95b` |
| scenario-preparation.ts | `8c83680aaffa06c7b265f17e612118b1e008615a` |
| prepared-review.ts | `d6382e93faeb7bf7b3118d592a9a47351d482fec` |

The initial finding predates this mission; this delta claims only its correction and the checks actually recorded for its own candidate.
