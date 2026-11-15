# Mission82 — terminal producer handoff to71 / consumer contract to52

Status: **IMPLEMENTED_UNVERIFIED**. Branch: `minimal-first-save`; PR draft: https://github.com/gustavomhss/Orchestra-SF/pull/92. Head after three source commits: `0ec5b861f5a2fedb72c49954af6f591210377d68`. Target: `sf2-stack` (sole writer 71). Actor: S4-A; lease: `first-save-browser82`. Source package pinned at `28711501cd86f1019ccefb2c344a1a0724263e2f`. Model effective: GPT-6; session ID not available via connector.

## Source / exact CAS
| Path | Preimage blob | Published blob |
|---|---|---|
| `modules/sucafina/Sucafinav1/product/decisions/hot-topic-draft.ts` | `a0c1d07be1ddd63492e7bcc3ff5980c0666b432a` | `d880fe5a5f7fd3c9c4fa249dbc374620a39a43a7` |
| `apps/cli/src/sucafina-product/dashboard-decisions.ts` | `3061f529e1417ba29f9976c3f132c1a08ead0742` | `b4d70dfb9467d59e3ac8861e0b4fc1c628d09bc6` |
| `apps/cli/src/sucafina-product/dashboard-http.ts` | `c6c24f4a66315c75dd8b0903ddd70c89b9b9e19c` | `934c4807916b23c7ecd80ecb1a3aa76d3bcd7201` |

All source preimages matched the three archived proposal blobs of 65. No modifications to UI52 / runtime73 / Apply65 / other branches.

## Produced API and consumer patch specification for52
HTTP: `POST {mount}/dashboard?sf=dashboard-hot-topic-draft-outcome`. Set original `Idempotency-Key`, `Origin` equal configured origin, `Content-Type: application/json`; body exactly `{ "caseRef": { "id": "...", "incarnation": "...", "version": 1 } }` where caseRef is **original first-register** ref, even if current case has advanced. Use same-origin authenticated human `decisions.edit` admission, no transformed key. Response `{status:"ok",value:{draftRef:string,version:1}}` only on validated original C08 transaction. Status mapping uses existing denied 403, stale/conflict 409, needs-input 400, unavailable 503. Response cache-control no-store.

Consumer52 patch (NOT APPLIED; owned by52):
1. Persist only original `caseRef` and exact admitted idempotency key in the pending-first-save checkpoint before the first register; do not persist fields/body/private evidence.
2. On reload of that pending checkpoint, ask for a new human action/admission, call outcome endpoint with the **same** original key and caseRef, never register, never scan list by time or text.
3. On complete valid `ok` ACK, bind returned original draftRef/version and clear pending; do not interpret as Apply permission. On any denial, missing/ambiguous record, expired/changed authority or non-ok, preserve blocked state; do not create another draft automatically.
4. Show safe failure/retry control; do not expose draftRef or confirm existence on unauthorized outcomes. Preserve 73 privacy semantics.

## Producer invariants (code inspection, not executed evidence)
- C08 read by `[principalRef,"preferences",caseId,"hot-topic-draft:"+operationIdentity]`; no `register` invocation by lookup.
- Read target transaction must be committed for original incarnation; reconstructed original first-save request (version0/no draftRef) must match stored command digest; exactly version1 original outcome.
- Requires case participant + grants/authority and exact original case identity; checks current active and historical draft, target/sources, access/policy revision; final locked C08 comparison/fence before returning only identity ACK.
- Lookup returns no write receipt, no Apply grant, no selection by timestamp or latest record.

## Required hosted gates, NOT EXECUTED
- Actions only, existing surgical test:ci request interface; request/dedup through central lane. No W/S/run/job IDs in this session.
- Real SQLite/C08 lost-first-register ACK and re-open services with only caseRef/key; prove same original outcome and **zero additional writes**.
- Two same-text same-target independent admitted keys; wrong/missing key; actor/case/incarnation mismatch; recreate, grant revoke and access/policy revision; changed/advanced draft and source replacement; legitimately advanced case version; corrupted/absent transaction and final-egress revocation.
- Verify 409/privacy semantics and no redispatch. 52 separate browser owner proof after reload. Ask45 for authorized typecheck/guards. Do not credit retained-body tests65 as proof.

## Integrator71
Review 65 archived proposal and the three precise blob deltas, recheck destination HEAD, coordinate producer validation with45/52 and integrate only with real hosted test results. PR is draft and **NOT READY TO MERGE**. Retain missing evidence as mandatory gap; no C12 installed-pass claim.
