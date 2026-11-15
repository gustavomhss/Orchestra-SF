# W19 → 114 / 120 / 119 — U11.title-save P0

**Candidate status:** `AUTHOR_CANDIDATE_REMOTE_COMMITTED_BUT_UNADMITTED`. Neither ACK publication, commit, nor draft PR implies integration or permission to deploy. The sole 114 admission decision is still unobserved. This branch is **not** a release-ready integration.

- Branch: `sf-ux-w19` @ `91d824d8bef4666b7c51c0641588c72bcd54cf16` / cohort `f8e4426`.
- Draft PR: https://github.com/gustavomhss/Orchestra-SF/pull/128 → `sf2-stack`.
- ACK: https://github.com/gustavomhss/Orchestra-SF/blob/31dea05a8b8f0808e556a9f8c8282d9260a27429/modules/sucafina/Sucafinav1/docs/sf2h/receipts/native-ui/W19/ACK.json
- Admission request: https://github.com/gustavomhss/Orchestra-SF/pull/65#issuecomment-6896745931
- Lease: `ux-native-w19-e1`, **reserved but not active**.
- No tests, compiler checks, guards or local build were run by W19; 120/119 own the qualification of the composed tree.

## Authored leaves — exact allowlist

1. `packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/title/model.ts`: typed **only** authorized CAP25 response narrow; checks matching installation/project/host/principal/accessRevision; exact request and canonical `versions['requests:'+id].version`; no fallback to synthetic empty data, no business computations.
2. `packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/title/index.tsx`: `SfRequestTitleEdit(props:SfSurfaceProps)` as nested CAP25 detail/requisition component; reads `domain.page.CAP25` with `{request:requestRef}`, S03 draft/review, non-financial title-only command, one idempotency key/intent, current-owner+generation checks and authorized post-save refetch.
3. `packages/app-shell/src/i18n/orchestra-chapters/sf-u11.ts`: `SF_U11_COPY`, `SF_U11_COPY_BR`. Frozen CAP25 title/primary, legacy source labels kept exactly English when baseline has no pt-BR translation, new messages have explicit EN/PT-BR.
4. `packages/app-shell/e2e/sucafina/native/journeys/u11.spec.ts`: five **real producer** P0 tests, not mock-based proof; environment-restricted and SKIPPED if F04 fixture is absent (skip does NOT qualify product).
5. `modules/sucafina/Sucafinav1/docs/sf2h/receipts/native-ui/W19/ACK.json`: remote preflight proof.

Diff from cohort verified before handoff: **5 authored/ACK paths**; final branch adds exactly three receipts (`HANDOFF-114.md`, `EVIDENCE.json`, `SHARED-PATCH-114.diff`) for **8 total changed paths**. All remain inside W19 allowlist. No shared registry, generated client, producer, Azure, merge, deployment or policy edit.

## Exactly what is / is not delivered

- Read: authoritative A03 `domain.page.CAP25` with `request` selector, matching stamp and per-record version.
- Edit eligibility: `draft` or `pr_rejected`, current context `save` action, source authorized projection. Foreign role/actor still rejected by producer; button visibility is not authorization.
- Mutation: A03 `domain.command.CAP25.save` with JSON `{page:"Requests",action:"save",id,version,values:{pr:{title}}}`, no other PR/PO/sourcing or approval fields, version only from source. The source increments the requests:id CAS slot.
- Review: S03 display/carrier; `confirmation:"presentation-only"` adds no producer approval/body field; no `submit_pr`, `approve`, `reject`, M31 change or C12 receipt.
- Outcome: one command per admitted intent; `Idempotency-Key` generated once and retained with digest; aborted/network/unexpected successful response produce `outcome-unknown` and **never** auto-reissue. Only recognized canonical `ok:true` followed by fresh authorized matching projection is displayed as saved; otherwise known success without verified projection is disclosed separately.
- 409 is **not** automatically classified as a safe CAS conflict: it can be I00 owner/host fence; user must reread/review.
- F01 controls owner-change, quarantine and revocation; W19 does not persist content in URL/localStorage.

## Integration handoff to sole 114 (shared changes are NOT applied by W19)

**A. Dictionary patch (complete diff):** `modules/sucafina/Sucafinav1/docs/sf2h/receipts/native-ui/W19/SHARED-PATCH-114.diff` inserts `SF_U11_COPY`/BR imports and spreads into `packages/app-shell/src/i18n/orchestra.ts`; apply/reconcile only as I00 after other workers' changes. No concurrent write from W19.

**B. Component mount:** import `SfRequestTitleEdit` from `.../procurement/requests/title`, render only as the nested Requests CAP25 detail/requisition fragment with the **F01-resolved** `SfSurfaceProps`. Do **not** create U11 full routes, generic dispatcher, new browser API, HTML parser or approval control. Registry concrete preimage is not published at this cohort and must be composed by its I00 owner rather than fabricated by W19.

**C. Public contract composition:** F01 context provider and owner registry; F02 typed transport; F03 state panel; S01 detail container; S03 `SfChangeReview` and draft store; A03 `createSfProcurementClient(transport)` (W11 currently exposes the exact method names), plus I00 schema/client package exports and real CAP25 projection/SDK bindings. `@orchestra/schema/sucafina/context` / `@orchestra/client/sucafina/procurement` are **planned exports**, unavailable in the cohort base until I00. Missing bindings must return unavailable instead of installing a stub.

**D. Server-side owner fence — blocking:** W19 cannot edit `modules/sucafina/Sucafinav1/runtime/application.ts`. I00 must compose `nativeCommandPrecondition` after authenticate, **inside** the original transaction and before `Domain.execute`, comparing decoded `X-SF-Native-Owner` to trusted current installation/host/project/principal and precondition Request. Invalid/different owner is denied; a missing hook with header returns 503 and no effect. A browser-only precheck never qualifies security.

**E. Admission:** 114 must reply with per-output `U11.title-save` GO / specific HOLD and activate the epoch, reconciling source and 3 shared dependencies. The branch artifact is a **candidate** under reserved, unapproved lease. Do not merge or mark installed on silent receipt.

## 120 — Actions only; exact proof selection

Test path: `packages/app-shell/e2e/sucafina/native/journeys/u11.spec.ts`. The existing Orchestra Playwright `orchestra/**/*.spec.ts` runner does **not** automatically include this file; 120/I00 must register the exact selection with the existing CI dispatcher, no duplicate dispatcher. W05 must provide isolated real producer/browser sessions with these URLs:

- `SF_NATIVE_P0_DRAFT_URL`: existing editable draft with fresh version.
- `SF_NATIVE_P0_REJECTED_URL`: editable real `pr_rejected`.
- `SF_NATIVE_P0_SECOND_ACTOR_URL`: different unauthorized actor/owner, source projection fenced.
- `SF_NATIVE_P0_STALE_CAS_URL`: real stale version or owner mismatch; expected HTTP409 and no false saved indication.
- `SF_NATIVE_P0_LOST_RESPONSE_URL`: F04 controlled **post-send** response-loss injection on real producer, not a mocked 200; assert exactly one POST and persistent unknown status on explicit refresh.

Checks: command JSON has only `values.pr.title`, `page/action/id/version` match A03, version equals authorized read, native owner header and idempotency present, producer returns real `ok:true`, value survives reload, foreign actor sees no private field, stale/owner failure doesn't show saved, loss never retries. **No test was run here.** Missing fixture or any SKIP is not passing evidence.

## 119 — compiler/guards

Run on 114's composed tree after actual producer adapter F02/F03/S03 and dictionary patches exist. Check typed imports, full A03 page/command schema, no `Core/Server` imports in browser, no generated direct edit, no shared conflict, and capability/allowlist/admission. A03 W11 currently defines `PageSelection.request` and `domainCommand("Requests","save",PrValues|SourcingValues|PoValues)`; W19 restricts payload itself to PR title. Do not claim green until 119 supplies a run ID.

## Source replay + drift

C58 `runtime/application.ts@a0deff8a` differs from historical source by reauthorized downloads/private visibility; title producer transaction unaffected. C58 `runtime/procurement.ts@a4ab021` changes permission-before-conflict to masked 404 and amount display; preserve that branch. Frozen contracts match catalog `31dbec17`/CONTRACTS `94553a3`; `EXECUTION-PROTOCOL` observed `4a50abf` vs historic `0151a8e` changes only superseded 105/101/45 dispatcher references (COMMON defines 114/120/119), not title semantics.

**Status: candidate for 114 review, not integrated/qualified.** No merge, deploy, Azure or changes outside allowlist.
