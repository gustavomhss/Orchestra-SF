# C12 receipt recovery — implementation checkpoint

Status: IMPLEMENTED / HOSTED VALIDATION NOT YET RUN.

## Authority and provenance

Mission 19 uses the existing procurement-apply branch and PR60. The delivered head 8e23e592602fb9f2fae9ce8f824322a073073e23 was read again before publication. Its terminal handoff under receipts/review-fixes/procurement-apply/attempt-01/ hands off an implementation delivered for review, and the PR timeline has no later writer activity. The user's new mission is the successor authority for the exact paths in c12-receipt-recovery.json. No authority is assumed over another branch or over sf2-stack.

- Mission: a32285b2683b5000dafe93df99289547c7f410fb, c12-receipt-recovery.json, blob e015b2e8de1bb0bdd4a81a422f3f9c397eedb49d.
- Parallel COMMON: c708ec0609dbfc95b259707d8c38481617f74f11, blob e54d84e3cdfa0046225518e253baf9dcf377fa7c.
- Normative plan: dbf9547211d9b0fade619790de7c19c0869b7c7d, campaign digest 703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba.
- Complete S4-A pack: docs/sf2h-plan/execution/actors/S4-A.json, blob 75ead4aae6187f440df6d9f9cdda6b10e444da13; COMMON d61f32af03fe10747a50274233f953af044decf6. Parent and three scoped helpers read primary criteria/contracts, dependency/numeric context, resident reference context, proof bindings and applicable appendices. Helpers do not own remote writes or test dispatch.
- Operations input: d48065d391e1557d43b63525bdc7f55b168d5206, c12-owner-handoff.md blob 26895bea48214e36d92293adc77c7dbd3e956cd6; proposal blobs 3aba750c7dd1f48e91ebc507eab75c5d8c61a411 and d6f9d45a2e05996e78b8c636594c34caffe7727c.
- Historical run43624678702 remains a reproduction of 409 -> 409 -> 409, not positive recovery.
- Prior OPS-REV-02 implementation and receipts remain intact. Its prior tests are regression inputs, not evidence of this new delta.

## Implemented boundary

Only these product files change:

1. product/decisions/apply.ts: explicit receipt-only mode permits a historical case version only for an already recorded authoritative receipt. No receipt exits before producer review, confirmation or dispatch. Normal Apply preserves its case-version fence. Reconciliation uses the current case captured at recovery entry and the current storage CAS, so it preserves a prior legitimate edit and rejects a further concurrent edit. Receipt snapshots and classification outputs are copied, canonical receipt/proof metadata are checked in the write, and every success has a final authorized state retention check.
2. product/procurement/decision-host.ts: immutable original application intent is captured in a protected C08 transaction before the first domain dispatch, after real producer review and human confirmation. Its stable key identifies case id/incarnation, choice and change; its digest binds original admitted request/review digest, principal, installation/project, prepared payload/target/intent and physical incarnation. Current recovery admission remains separate from the original evidence. No browser key, digest cache or old credential is required for canonical recovery. An existing ambiguous attempt, including one from another principal, cannot open a new dispatch.
3. product/procurement/decision-http.ts: closed private decision-recover POST accepts either the original exact Apply proof or a fresh canonical selector with purpose=recover. Both use the existing human decisions.apply authority, real Request and current case/source checks. It adds no MCP operation or public Protocol/Server API.
4. product/ui/decision-apply.ts: explicit Recover recorded receipt action uses the original in-page intention when available, or the canonical authorized selector after reload/new session. It never automatically retries a mutation. No sessionStorage/localStorage is used as recovery authority or a prerequisite.

No new wiring in interface/http.ts or contracts/host-context.ts was necessary: the existing private Procurement HTTP adapter is already mounted. No Finance, Memory, CLI, shared fixture, E2E spec, workflow, policy or domain producer file is changed.

## Preimages and Finance seam

| Product file | PR60 preimage |
| --- | --- |
| decisions/apply.ts | 4bdd12ac162d61465557363953e25dfd99fad5e8 |
| procurement/decision-host.ts | 23d9291b3dcedda36edc4aa4f38856024e3c58f4 |
| procurement/decision-http.ts | e169d335f091c446bb380ee73f450083f917946f |
| ui/decision-apply.ts | 2e6c081ad2a5282654707f7fc7278183e7dfb20d |

The installed PR60 executor is the original Operations variant. The Finance executor was independently read at finance-resume@9a2ab893be9f2af2078f67ca867c13892452752e and remains blob f8404c18abc040c49cf111eb4561ce4c2873a4c6. Its application-attempt.ts dependency is absent from this branch and outside this mission's write paths. We do not transplant the old executor over Finance, import an absent helper or edit the Finance lane. The additive receipt-only gate and compatible receipt retention checks are implemented on the actual PR60 preimage. Session14 must reconcile that shared file with the Finance version, preserving its reservation/retention/reconciliation increments. A separate compatible integration delta will be provided with exact pins if needed; it is not an integrated or executed Finance change.

## Proof obligations

New tests are isolated under test/product/c12-receipt-recovery/. They consume the real producer/review, private HTTP, human authority, C08 and SQLite. The browser uses production decisionApplyForms/decisionApplyScript with the existing AppProcess/Omni browser driver. Controlled scheduling and transport loss are fault injection only: domain replies and receipts are never fabricated. Choices are explicitly seeded and do not prove native model execution.

Required observations include real commit and response loss, legitimate concurrent case edit, same-body/key retry, reload, closing/reopening SQLite and services, fresh browser context with empty storage/new human admission, identical receipt, unchanged financial values/versions/history and no duplicate effects. Negative observations must cover absent receipt, mismatched proof/payload/identity, revoked final read, physical replacement, further case concurrency and a pending other domain.

Primary scope: I-OPS-02, C03/C08/C12, WP11.T04.CHK.02/DOD.01/DOD.02/INV.01/QLT.01 and associated E10/E12 obligations. Partial-domain negatives and OPS-REV-02 regressions are bounded evidence, not whole-WP or AM04 acceptance. The campaign remains 15 WPs / 74 tasks / 17 contracts / 1610 criteria; no global C/D, AM01-06 or release claim.

## Validation and historical limits

This checkpoint claims no test, typecheck, guard or independent acceptance. Only canonical deduplicated hosted Actions runs may supply those results. Product tests were not run locally. W/S, request, tree/blob identities, run/jobs, actual results and limitations will be appended after execution.

Legacy effects committed before durable intent capture cannot reconstruct an unretained review digest from a one-way hash. Their exact original proof remains usable in receipt-only mode under current authority; canonical cacheless recovery returns unavailable if the original durable intent is absent. It never invents a receipt or an original review. Reopened composition means a real new SQLite driver, authority and services in the same Bun test process; no Orchestra restart or native process restart is claimed.

Consumer: session14, sole product integrator into sf2-stack. PR60 retains its existing base. No merge or integration is performed by this lane.

