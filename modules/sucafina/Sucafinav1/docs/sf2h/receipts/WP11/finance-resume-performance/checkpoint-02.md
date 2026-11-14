# Finance resume performance — checkpoint 02

## State

Continuation of PR42 / finance-resume, original head 3ea9dc2efe0de8d283f9625774697e431f55a0d7. This commit descends from W1 ab38a14c09d2292553670033b8c1eaea1d26f31f. Original implementation, authorship and receipts are preserved. Normative scope dbf9547211d9b0fade619790de7c19c0869b7c7d remains unchanged.

## Discriminating counterproof

S1 run43627723188 / job132547252223, W ab38a14c09d2292553670033b8c1eaea1d26f31f, S 4afc641b8f9e71be3e13ea7f3bdcff69ae29bb67.

The real omitted-training calculation returned ok/conditioned, threshold55000.000000000015. All financial, adjacent IEEE witness, current revalidation and next-operation revocation assertions passed. The regression failed precisely at searches2 versus expected1 (27 assertions;53.47s including fixture; measured evaluation42534ms). Search preview count18; search units4; consumer previews8; sample writes2; completed resolutions2; completed revalidations4. See S1-result.json.

## Small product delta

- portfolio/planner-sensitivity.ts: retain the one discovery search; final recertification uses fresh accepted and adjacent rejected witnesses for that candidate, plus the original binding/coverage checks and final live revalidation.
- portfolio/verification.ts and threshold-proof.ts: for exact persisted results only, recreate the canonical current direct-USD domain and recertify the persisted candidate, then repeat structural proof and witnesses at final egress. Full recomputed Finance result/evidence digest remains required. Nonexact fallback remains unchanged. The original readonly root, staged proof capture, concurrent-attempt fencing, Request/lease checks and poison handling remain intact.
- planner/sensitivity-units.ts: selected-result and full-case observations already read by resolve are private first observations of the same call. All later independent observations remain. No state is shared across calls. Detached data and retained Request/context fingerprints protect the await boundary; live host revalidation also occurs before propagating issue failures.

## Validation next

No product tests or typecheck executed locally. Next Actions selection is the new numeric regression, late revocation, persisted candidate/evidence/root tests, direct observation counts and awaited-rule mutations; add only affected existing request/source/fresh-scope/EUR-missing-FX boundaries. The long FIN-IND-005 journey will run only after this material correction passes targeted checks. All existing budgets remain unchanged.

## Exact external dependency

PR59 e80fdc933dfd25956a50c22dea76bf077e79815b proposes four-to-two envelope consolidation in product/integration/source-lifecycle.ts and planner-sources.ts. That integration belongs to WP10; no implementation is applied here. See docs/sf2h/receipts/diagnostics/calculation/proposed/manifest.json at that pin. PR56 finance-journey remains intact; its copied helpers live only in finance-resume-performance with source blobs recorded in inputs-01.json. No claim of global acceptance or installed/native acceptance.
