# OPS-REV-01 — sourcing-money / attempt 01 preparation

Status: IMPLEMENTED_AWAITING_HOSTED_VALIDATION. No acceptance or test PASS is claimed by this preparation receipt.

## Authority and input
- Repository: gustavomhss/Orchestra-SF.
- Mission/ref: review-fixes/sourcing-money.json and COMMON.md at 30e2215749d5295f81fdeafccb9e69ba21d0cdb8.
- WP04 pack and CI protocol: a3d29d011ba3607a57914701300f09117a3e2de9.
- Normative planning: dbf9547211d9b0fade619790de7c19c0869b7c7d; campaign SHA256 703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba.
- Observed branch and target head before editing: ba8a09e371ce8d93eb917eabb102caaee5affaf4; tree eb427121bcfd8c2511aac31d908f3c0d52c1915e.
- Product preimage monetary.ts blob: 5ed7b1c7e8f140c2820d9e3095a7427374d10f69.
- confirmation-fields.ts blob a1e45e803105e76f147e695a7e92246257de9b16 is unchanged: it consumes the shared monetary facts.
- The full WP04 pack, root AGENTS (blob 643ec9f8f960895b2e3294f7f2cc25db6f8488e4), execution/COMMON and actual producer/consumer implementations were inspected.
- Concurrent operations-fixes at ee2e14ac940ba62177052f44c0f0e781132e7564 only changes documents/C12. Its run 43624678702 is not sourcing-money evidence. No existing sourcing-money PR or equivalent run was found during initial inspection.

## Change
select_quote creates a future PO with lines while sourcing is still in progress. Both the monetary-facts selector and requestValue previously treated those lines as the current decision, bypassing the sourcing submission snapshot. The fix excludes future PO inputs in sourcing, src_pending and src_rejected. Conversion still uses requestValue with a temporary read-only view of the same record whose PO is hidden only for those stages. The persisted record is never rewritten by projection. PO, PR and cancelled stage semantics are preserved.

No financial policies, thresholds, scoring, persisted snapshots, producer commands, other session files or workflows are changed. The monetary rule identifier stays procurement-money-v3 because this restores its intended contract; C06 material inputs naturally follow the corrected sourcing selection.

## Discriminating behavior tests
All new tests and fixture are under test/product/review-fixes/sourcing-money/.
The fixture uses the durable local-store adapter on the hosted runner, source lifecycle, real UI admission, real C02 source resolver/port/collection, real C06 observer, and the real Procurement renderer. Setup traverses create, submit_pr, assigned-holder approve, save sourcing and select_quote before each test. It does not inject a pending approval or future PO.

1. Real submit_sourcing freezes EUR100 at1.08 to USD108 despite future PO lines. Legal Settings FX2 leaves C02, C06, comparison, mounted queue, detail and summary at108. C06 scope/source/dependency fingerprints stay unchanged; the persisted request and scoring are preserved. Revocation remains unavailable.
2. Assigned-holder sourcing approval releases po_draft. Real submit_po atFX2 creates USD200 approval; Settings FX3 leaves the PO decision at200 while the earlier sourcing comparison remains108.
3. Removal of live EUR FX before sourcing submission yields absent conversion, never zero; real submit_sourcing rejects and does not commit.
4. Changing the base to GBP makes current-base comparison unavailable while submitted108USD and its1.08 rate remain explicit; C06 fingerprint changes.
5. Real sourcing rejection clears its FX snapshot by the existing producer rule; retained future PO/live FX must not replace the missing source snapshot.

Existing money, finance-material, projection, comparison-review and confirmation tests will be named explicitly in the closing request to check affected monetary and confirmation behavior. No product test has run locally.

## Criteria mapping
- WP04.T03.CHK.03: cases1/3/4/5; actual PO counterproof case2.
- WP04.T03.DOD.02: monetary fields, currencies, states, FX source and submitted provenance in cases1–5.
- WP04.T03.SUC.02 and WP04.T04.QLT.02: same real request across detail/summary/mounted C02 queue/C06/comparison.
- WP04.INV.02, WP04.T03.INV.01, WP04.T03.INV.02, CAMP.INV.01, CAMP.INV.03: immutable submitted record, unchanged policies/scoring, real domain projection, explicit absence.
- C02/C06: real source-scoped read and observer, stable frozen-money fingerprint and unavailable access after revocation.
These are intended coverage links, not whole-WP acceptance.

## External boundary
runtime/procurement.ts still derives the legacy raw request.value through requestValue without stage scoping. The Requests table without a mounted C02 queue, and the separate legacy order-difference text, can therefore retain a current-FX future-PO value. The required monetary block, record summary and C02-backed queue use procurementMonetaryFacts and are covered. The regression logs the observed legacy value without locking that defect in as an expected permanent behavior. Runtime/src are outside this mission's write paths; this receipt does not claim those fallback consumers are fixed.

## Closing protocol
Publish product W on sourcing-money, create official request-only snapshot S directly from W, dedupe selection/config/fixtures/tree and run one surgical test-ci selection on Linux. Use the inherited astra-operations-check workflow in a separate request-only check snapshot for package/CLI typechecks and guards against a pinned current dev SHA. Record W/S, trees, run/job IDs, actual conclusions and artifacts in a new receipt, then open a delta PR to astra-operations without merge or epic.
