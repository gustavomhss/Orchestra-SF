# UX20-W13-R2 / U13.pr-approval — successor e2 handoff to sole integrator 114

**Author delivery:** source files committed, scoped to persisted/submitted PR P1; **ready for integration review, not integrated, not typechecked, not qualified, no global release.**

## Evidence and fencing

- e2 successor: `modules/sucafina/Sucafinav1/docs/sf2h/control/native-ui/successors/W13-e2.json` at pin `49a92b9c6bd2c23cf30686a279aa17d2d7aabb5a`. Epoch `ux-native-w13-e2`; former e1 revoked. Fencing HEAD `04722e76566b706c9b79159ce84087b9e7087a86`, tree `1536ee00aaa1e06754993f1bf7b5ff482e7fa3e4`. S0 admitted exclusive product writing at `8852ed4a060f6eb3b49c142b894852d0af49740f`.
- New actual ACK `ACK-e2.json`, blob `739d786ac74756e68bc075a6b38df002c66710ae`, commit `38b8400e6eb629f3b30372a3c1f83d2a168d9457`. e1 ACK, source check and prior handoff retained as historical preflight, not current admission state.
- Branch: `sf-ux-w13`; existing PR [#115](https://github.com/gustavomhss/Orchestra-SF/pull/115), OPEN DRAFT against `sf2-stack`. Last author product commit `4ee90eb59abb7b5220e953b7e47285d4130a1e21`, tree `d8fac753917b9394e3d0a2e86fe40f0b3912d87e`; all moves were non-force expected-HEAD CAS. No reset, branch switch, merge, deploy, new backend, generated write or Goal reactivation.

## Material owned by W13 (new files, absent at e2 preimage)

| Path (relative to repo root) | Git blob |
| --- | --- |
| `packages/app-shell/src/orchestra/chapters/sucafina/procurement/approvals/pr/model.ts` | `21c9aa4edccb8eb29892913a1908e8ddb0620f3d` |
| `packages/app-shell/src/orchestra/chapters/sucafina/procurement/approvals/pr/index.tsx` | `847521e06a2cef99daae72bac5dbe42aaab02801` |
| `packages/app-shell/src/orchestra/chapters/sucafina/procurement/approvals/pr/draft.ts` | `c8e68bd1ead021f51b5f328f4d93d9710652e8b4` |
| `packages/app-shell/src/orchestra/chapters/sucafina/procurement/approvals/pr/copy.ts` | `f7ca941433cf5d0447a9039db75ababd9a7eabd8` |
| `packages/app-shell/test-browser/sucafina-native/w13-pr-approval.test.ts` | `88698bb72c399433f7f85d0c69b0e55ce39a8634` |

**Only take these five product/test files** from W13, not unrelated pre-existing docs visible in the coeval PR diff. Shared code files are exclusively 114-owned. The nine test cases are **authored only**; `NOT_RUN`.

## Exact implementation and limits

- F01 owner readiness, owner stamp and generation gate every CAP26 read, detail and mutation; old replies are ignored and abort on owner change. On revoked/expired state the private page is hidden. The ref is the opaque producer `request.number`, not title or an inferred identity. Principal ref is never compared to the producer's holder ID.
- A03 read `domain.page.CAP26`: only real persisted `status === "pr_pending"` with exactly one pending step and current queue membership may enter decision review. Holder, stage, submitted amount/currency, current CAS `versions["requests:"+id].version`, source stamp and current action admission are compared across review and immediately pre-command authorized refetch. Missing/cross-group/ambiguous source fails closed. Missing FX is shown as unavailable, never recalculated.
- S01 list/detail; F03 PageFrame/state; S03 ChangeReview and ReceiptView. Draft note/reason live in F01/S03 owner-scoped ephemeral registry with source version; a sending marker prevents silent replay on navigation. Approve and reject are distinct; reject requires nonempty reason. S03 review is explicit and uses a draft proposed state rather than a fabricated persisted result.
- Dispatches original A03 `domain.command.CAP26.approve` or `domain.command.CAP26.reject` with `page:"My approvals"`, original `id`, numeric CAS `version`, only `values.comment` or `values.reason`, and one browser-created `Idempotency-Key` per reviewed intent. No retry of an ambiguous write; failure/unknown state survives for source reread, not re-enactment. A successful producer response is **not** a C12 receipt. Author never changed M31/MI07 or financial authorization rules.
- Includes local row selection, full-page/detail switch and same-owner `returnTo` when F01 supplied it. **Not yet proven NAV-01**: I00/114 must compose the canonical typed route builders and history/focus restoration; W13 deliberately did not invent URL/route codecs in its exclusive leaf.

## Exact shared i18n patch proposed for 114 (NOT applied by W13)

Expected shared preimage at W13 author view:
`packages/app-shell/src/i18n/orchestra.ts` blob `2eeaa42e02a45b3301fc765c6c92635af5101079`.
The integrator must recheck actual HEAD and apply three minimal changes after reconciling existing shared imports/spreads:

```diff
+++ packages/app-shell/src/i18n/orchestra-chapters/sf-u13.ts
+export { SF_U13_PR_COPY as SF_U13_COPY, SF_U13_PR_COPY_BR as SF_U13_COPY_BR } from "@/orchestra/chapters/sucafina/procurement/approvals/pr/copy"
--- packages/app-shell/src/i18n/orchestra.ts
+++ packages/app-shell/src/i18n/orchestra.ts
@@ imports
+import { SF_U13_COPY, SF_U13_COPY_BR } from "./orchestra-chapters/sf-u13"
@@ within export const ORCHESTRA_COPY = { before its closing }
+  ...SF_U13_COPY,
@@ within export const ORCHESTRA_COPY_BR = { before its closing }
+  ...SF_U13_COPY_BR,
```

This exposes all `sf.cap26.*` and `sf.u13.*` keys via `useLanguage().t` without W13 editing the shared dictionary. 114 must reconcile key collisions/copy parity with the actual shared tree. Existing F03/S03/S01 copy remains owned by their respective producers.

## Required peer composition (not fabricated on W13 branch)

- F01: `packages/app-shell/src/orchestra/chapters/sucafina/context` (peer W02); F02 transport via injected ready context; A03 `createSfProcurementClient` and `SfProcurement` from W11. F03 `shared/frame`, `shared/states` (W04), S01 `shared/table`, `shared/detail` (W06), S03 `shared/draft`, `shared/change-review`, `shared/receipt` (W08).
- I00/114 registers CAP26 entry/detail/review and imports this leaf without any parallel backend, generated SDK edit or new policy. Route navigation beyond the local view and copy registry require this shared composition. Do not mark integrated before it is present.
- Source pins taken from C58: `runtime/application.ts@a0deff8`; `runtime/procurement.ts@a4ab021`; `src/procurement-screen.ts@510be5b`; `src/procurement.ts@eb486f5`. Original authorization/holder/self-approval logic remains exclusively in the producer.

## Verification delegated (NOT_RUN / NOT_PROVEN)

**120, Actions:** run the nine authored source-projection regression cases plus real authenticated/desktop consumer tests against integrated CAP26: submitted PR, wrong actor, unassigned holder, self-approval flag, missing permission, step consumed, stale CAS, absent FX/amount, rejection reason, 200+authorized refetch, 401/403/404/409/422/503, lost reply with no duplicate write, late response/revocation, cross-owner isolation, keyboard/320/768/1024/1280/1440 and focus/history. The pure fixtures are not authorization or installation evidence.

**119, compiler/guards:** only after 114 mounts the real F01/F02/F03/S01/S03/A03 exports, run app typecheck and ownership/generated/import-policy guards. No tests locally were run by W13.

**114:** review copy/route patches, reconcile peer contracts and owner authorization, integrate the five blobs by exact paths, assign 120 and 119. Preserve P1 limitation; `U13.complete`, `U11.title-save`, C12 receipts and other approvals remain outside W13. M31 and MI07 financial proof are `UNPROVEN`, no inferred pass. `GLOBAL_RELEASE=false`.

**Closure:** author product/test commits delivered with e2 admission; integration/qualification remain outstanding. PR #115 stays OPEN DRAFT.
