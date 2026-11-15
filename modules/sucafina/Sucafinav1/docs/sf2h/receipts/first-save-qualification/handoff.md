# 87 · First-save producer · terminal handoff to 71 / UI52

## Identity and authority
- Actor: S4-A continuation, GPT-6; actual GitHub authenticated login gustavomhss; session host ID not exposed (not invented).
- Lease: first-save-browser87. PR: #92 (existing draft); branch: minimal-first-save; base: sf2-stack.
- Mission file: modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/parallel-closure/87.json @ b9935108fccc20776c60e5536a9eeddcbbaa3c83.
- Fixed plan: dbf9547211d9b0fade619790de7c19c0869b7c7d. Starting HEAD: dfa65de05a104bd50b4cad7a341eeb811420fdc2.
- Existing mission82 producer files: product/decisions/hot-topic-draft.ts (blob d880fe5a5f7fd3c9c4fa249dbc374620a39a43a7), apps/cli/src/sucafina-product/dashboard-decisions.ts (b4d70dfb9467d59e3ac8861e0b4fc1c628d09bc6), dashboard-http.ts (934c4807916b23c7ecd80ecb1a3aa76d3bcd7201). No modifications to these production blobs by mission87.
- Mission87 product origin HEAD f42988d08ff29548bfb2af54c0a6d856315c7487; tree 46415d45859bfe682138fcd47705f4bedee2949a; new test path modules/sucafina/Sucafinav1/test/product/minimal-first-save/first-save-recovery.test.ts, blob 566e765f201d1a45677c0c52c75eb92ecb16d482.

## Actual hosted proof
- Initial test run 43677229458 / job 132699926676 / snapshot f2757ad6b55d8d19245b1d9d347233f30230d604: 5 PASS / 1 FAIL (incorrect test expectation: HTTP missing-key admission responds 403, not the assumed 503). Fixed only test assertion with commit f42988d08ff29548bfb2af54c0a6d856315c7487. Do not present initial run as green.
- Focused GitHub Actions test-ci success: run 43677408316, job 132700463020, snapshot 3407ce622dbec4f4a241ecbce8a3688cc4b1ca3c; 6 PASS / 0 FAIL; 70 expect() calls; one named file. Log confirms actual Bun test in Actions, not local.
- Regression GitHub Actions test-ci success: run 43677629469, job 132701135606, snapshot 31dea43e98e15be73c9b2487c4ea5c278a36f795; 13 PASS / 0 FAIL; 226 expect() calls; three named files (new first-save recovery, existing WP11 hot-topic-draft-domain, existing WP11 hot-topic-snapshot).
- Both green snapshots have parent product HEAD f42988d08ff29548bfb2af54c0a6d856315c7487 and differ by ONLY the .ci-run.json temporary request; no alternate source/proposal was substituted. Selection is package=sucafina, directory=modules/sucafina, runner=bun, timeout=120000. GitHub Actions used the pre-existing test-ci request/workflow; no local tests, epic or production environment changes. Focused omni control reports NOT APPLICABLE, not PASS.

## Proven invariants (SOURCE only)
1. ACK lost after C08 commit; client supplies only original caseRef and original Idempotency-Key to authenticated outcome HTTP after SQLite dispose/reopen. The original registered draftRef/version=1 returns, including after case version advances.
2. Two original first-save commands with identical text, different keys get different durable refs; lookup returns each exact transaction, never a timestamp/text-selected substitute.
3. Wrong actor, key, case, incarnation, version, missing key and unexpected payload field fail. Recreated case incarnation does not inherit old receipt.
4. Case participant removal, access revision change, entire grant revocation and changed official Dashboard source suppress ACK, without lookup writes.
5. Superseding the active draft leaves the historical first-save receipt intact, but old lookup is rejected by active/history parity.
6. A revocation scheduled between final C08 lookup selector and its second authorization rejects egress. SQL snapshot digests and transaction counters show no lookup writes/redispatch; no new decisions.apply action or Apply entitlement.
7. Adjacent existing WP11 tests remain green for Dashboard snapshot, source edit race, case edit race, authority race and replacement during read/list callback.

## Contract sent to UI52
- Endpoint POST {mount}/dashboard?sf=dashboard-hot-topic-draft-outcome (use actual installed mount; avoid adding a second slash). Authenticated same-origin human decisions.edit request. Header Idempotency-Key = the ORIGINAL register key. Body contains ONLY {caseRef: originalCaseRef}. Version must be the original request's version even if current version advanced.
- 200/ok value {draftRef,version:1} represents original human draft only; not a second register, not Apply. 400 invalid, 403 denied, 409 stale/conflict, 503 indeterminate are NOT success. Never retry registration blindly or select by timestamp/text.
- Full standalone consumer52 adapter is in consumer52-adapter.md; must be applied and browser-tested by UI52, NOT modified by87. The adapter intentionally persists only caseRef/key before the original dispatch, blocks uncertain new saves, recovers only on explicit click after reload, and never auto-applies.

## Integration / ACK protocol
- To71: pick the exact producer/test blobs from PR92, reconcile sf2-stack HEAD/paths before composition, run composed checks separately, consume this receipt and request source/test provenance. Publish explicit ACK71 with the integrated commit/tree/blob identity; absence of response is NOT an ACK.
- To52: apply adapter only in UI-owned paths, prove installed reload and egress. Publish ACK52 with UI commit, test run/job, and exact consumed producer SHA.
- To45/S0: add required typecheck/guard/final candidate selections only under authorized dispatcher; no invented status.
- Source qualification status: SOURCE_QUALIFIED. Composed candidate: NOT_RUN. UI consumer: NOT_APPLIED / NOT_RUN. Typecheck and check:guards: NOT_RUN under GH-only, no allowed existing surgical command runner; requesting formal gate owner to execute. Independent release review: NOT_RUN. GLOBAL_RELEASE: false.
- No merge to dev, no deploy, no Azure/credential/engine changes, no Orchestra restart. Existing PR92 remains draft.

See receipt.json for full machine-readable IDs, request argv, coverage and gaps. Require explicit consumption ACK from 71 and 52.
