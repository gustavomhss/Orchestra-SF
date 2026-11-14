# Dashboard C12: published inputs, compatible apply and readback closure

Date: 2026-11-14. Author: Astra interface / WP01 support. This is a source and ownership finding, not native acceptance or an independent final review. No product tests, checks, CI polling, remote mutations or product/foreign edits were performed for this analysis.

## Decision

The latest Operations `apply.ts` is a compatible one-file producer intake. Preserve the stronger local `prepared-apply.ts`. This does **not** close Dashboard apply plus authorized reload: the required evidence/history producer is already published in Compose, but its current composition is wider than two to five exact blobs.

The earlier lower bound of 25 paths belongs specifically to Compose `a1e9eb62aa7fa862322622cc38474ef0ff5a7d09`, compared with Interface `01633144c83fb1080e6d985ef226b8db2aa131cb`. It is not a completed closure and is not a count for the newer Compose head. The current head adds protected Planner calculation history and changes the BCS/business-context composition again. Do not overwrite that newer BCS with an older blob or an Interface-authored partial copy.

## Latest GitHub reconciliation

The current PR metadata, commit trees and compare endpoints were read through GitHub MCP.

| Input | Head | Tree | Qualification |
|---|---|---|---|
| PR34 / astra-operations, current | `ba8a09e371ce8d93eb917eabb102caaee5affaf4` | `eb427121bcfd8c2511aac31d908f3c0d52c1915e` | Current published producer input. |
| PR34, preceding delivery | `8ad7e16064e9f886b46519581aae5fb6182a2829` | `6264ac2e186a1455dbd9ad5fce16b3c1030769be` | Added 75 documentation/receipt files over c4a2; no product changes. |
| PR34, original requested pin | `c4a2f4ebeb88f5915e51569b921be06b3c37ddad` | `5cc00703f04845c62448a2a3239683d266d8d548` | Product blobs discussed below remain unchanged at current PR34. |
| PR32 / astra-compose, current | `35b9fd4f532abeb1058f00281d4ad8885ca9966f` | `051391628c61f6a4333c8f13567c5518c4ff8f86` | Current composition, including protected calculation history. |
| PR32, original requested pin | `a1e9eb62aa7fa862322622cc38474ef0ff5a7d09` | `2a61f73fc5bf404501d61f71f552861f5e1338e1` | Source of the previous 25-path lower-bound analysis. |
| Interface comparison baseline | `01633144c83fb1080e6d985ef226b8db2aa131cb` | `63f3a45a86dd33679a44cf113f8a620a2052bf4e` | W9 baseline, before the root-owned isolated apply intake. |

The `8ad7 -> ba8a` compare contains 18 documentation/receipt paths: four modified, twelve removed, two added. It contains no product or test code change. The removals are raw job-output artifacts; this analysis does not restore them.

The `a1e9 -> 35b9` compare contains 24 paths. Relevant current blobs are:

| Path | Current blob | Change over a1e9 |
|---|---|---|
| `apps/cli/src/sucafina-product/business-services.ts` | `4b02413b5a98e750187fa8f5fa54f3cb2415f4e3` | +2/-1; updates calculation composition. |
| `modules/sucafina/Sucafinav1/product/host-binding/business-context.ts` | `5cca27ce239c92a8e3c9f9f92f816f5224562904` | +30/-2; extends protected history handling. |
| `apps/cli/src/sucafina-product/planner-calculation-history.ts` | `9805676b50cb5d12f37a4a91350f01ba227a168f` | New, 133 lines. |
| `apps/cli/src/sucafina-product/planner-calculation-services.ts` | `bc224c0b2830fe54a02c3b2bc356cb6bf2b1c327` | +7/-3; consumes the new history service. |

Dashboard decision/evidence and case-port blobs are unchanged by this newer commit. The earlier BCS `4b96a408...` and business-context `5f9a4761...` are superseded and must not replace these current files.

Sources: [PR34](https://github.com/gustavomhss/Orchestra-SF/pull/34), [current Operations commit](https://github.com/gustavomhss/Orchestra-SF/commit/ba8a09e371ce8d93eb917eabb102caaee5affaf4), [PR32](https://github.com/gustavomhss/Orchestra-SF/pull/32), [current Compose commit](https://github.com/gustavomhss/Orchestra-SF/commit/35b9fd4f532abeb1058f00281d4ad8885ca9966f).

## Compatible apply input and the protected existing-receipt branch

### `product/decisions/apply.ts`

Prefix for this section: `modules/sucafina/Sucafinav1/`.

| Version | Blob |
|---|---|
| Interface W9 | `535c689f075db0d306cd2e8152930e875f6be13a` |
| Compose a1e9 | `fed7feb25d9af2fecebba8d2b1d2e2a6b1a3e0ac` |
| Operations current, compatible | `4bdd12ac162d61465557363953e25dfd99fad5e8` |

The whole-file comparison shows unchanged factory parameters and imports. Operations preserves the Interface reread of `cases.storageVersion` after the domain receipt transaction. It additionally re-reads the authoritative receipt, requires equality with the observed receipt, reauthorizes application, and requires the complete selected case to remain identical at reconciliation. A changed case produces `stale/case-changed-after-application`; it is not silently reconciled with a different case.

The old Compose `fed7...` uses `current.storageVersion` from before domain application. It must not overwrite the newer CAS recovery. Operations `4bdd...` is the published union that preserves that recovery and the review protections.

### `product/decisions/prepared-apply.ts`

| Version | Blob | Decision |
|---|---|---|
| Interface W9/current working tree | `a45436a6fef8598b7ef9eae33d061ddebf0aa43d` | Preserve. |
| Operations and Compose pins | `90c3e981d8418c562342660bd3d56d03f9995383` | Do not replace a454 with this older existing-receipt branch. |

Inside the transaction, Interface checks that an existing receipt has a `receiptProofTransactionKey`, that its proof command digest equals the captured review binding, and that the proof value equals the receipt. The published `90c3...` branch returns the existing receipt after checking only the receipt's command digest. Copying it would remove a relevant stronger assertion in production logic.

`product/decisions/receipt-review-binding.ts` is identical in Interface, Operations and Compose: `6987eddae37ae2c90fe03b2d8e81ea28e8b5221f`.

Root subsequently copied only `apply4bdd` to the working tree. A read-only hash inspection confirmed the intended pair: apply `4bdd12ac162d61465557363953e25dfd99fad5e8` and prepared-apply `a45436a6fef8598b7ef9eae33d061ddebf0aa43d`. This analysis did not perform that mutation.

## Is isolated apply necessary for the Interface branch?

It is **not a repair for the failures seen in Interface W9**. Interface already contained the post-domain CAS reread. The already downloaded W9 log `analysis/product-43586466170.log`, run `43586466170`, job `132421925833`, records PASS for:

- `C12 host persists the real draft and prepared binding, applies once, and reconciles its receipt`.
- `prepared host refuses replaced choice and forged metadata before touching the target or receipt`.
- `changing protected prepared content or its digest cannot substitute a C12 command`.
- `Dashboard contextual controls preserve a real agenda and record, then review and apply an existing C12 choice`.

The first host test asserts actual domain mutation, applied case/change state, one receipt, an identical replay result, rejection of another review digest and an unchanged final domain version. The browser test asserts the real Apply UI result, one HTTP write, persisted receipt/change state and the changed Hot Topic. It also retains the review across shell refreshes during the operation.

Neither test proves that the applied case can subsequently be reopened through the fully composed, currently authorized case/evidence readers. The browser test ends after raw authorized C08 inspection and domain state checks; it does not navigate to the applied case and exercise current published `verifyScenarioOperations` plus receipt/historical-source resolution. Thus its PASS does not close the reload gap.

Recommendation: accepting the isolated exact `4bdd` input is reasonable producer hardening and keeps Interface aligned with Operations; document it as that, not as the cause of W9 recovery or a solution for reload. It is also acceptable for S0 to consume the explicit dependency during composition if avoiding an isolated intake. Since root has chosen the isolated intake, retain the exact pair above and use the existing affected C12 host/browser consumers as surgical validation, without rerunning Operations H01-H08 as an equivalent group suite. Do not start a separate reload-only run until the published evidence/BCS composition is actually present.

Source of the observed own results: [Interface W9 run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43586466170). The run as a whole failed; individual PASS cases do not change that conclusion.

## Published Dashboard readback chain

| Required component | Current published blob | Responsibility |
|---|---|---|
| `apps/cli/src/sucafina-product/dashboard-decisions.ts` | `f8914c141ba5c72439f5fdba50e9153c4cd477d4` | Captures actual sources before prepare; records captures in the C12 binding; resolves an applied operation from its durable binding. |
| `apps/cli/src/sucafina-product/dashboard-decision-evidence.ts` | `4c205439aed7779dff66079a1ebaad1927d75d77` | Resolves original record captures and receipts under current authorization and physical continuity. |
| `product/host-binding/business-context.ts` | `5cca27ce239c92a8e3c9f9f92f816f5224562904` | Exports `createSfRecordHistory`, dispatches Dashboard receipts, and connects protected historical captures. |
| `apps/cli/src/sucafina-product/business-services.ts` | `4b02413b5a98e750187fa8f5fa54f3cb2415f4e3` | Passes `dashboardEvidence: dashboardDecisions` and wires real scenario-operation authorization. |
| `product/decisions/case-port.ts` | `67203e058f6e08d9e32e0c51e0b1a01e5fadf322` | Requires `verifyScenarioOperations` both before and after the protected case read. |

The `product/` rows use prefix `modules/sucafina/Sucafinav1/`.

There are two causal legs. First, applying a Hot Topic changes the current record projection, while the decision still refers to the authorized original projection. The new helper reads protected `sourceCaptures`, verifies their physical incarnation, issues the current authorized reference and proves continuity instead of relabeling old values as fresh. Second, an applied decision's scenario operation must resolve from its immutable prepared command and real receipt after its original draft ceases to be current. `resolveRecordedOperation` supplies that evidence under exact binding checks; the new BCS connects it to `verifyScenarioOperations`.

The helper deliberately reads protected cases/preferences/receipts directly after namespace grants, rather than recursively calling `cases.read -> evidence -> cases.read`. Receipt resolution correlates case, change, choice, command, original draft, receipt, durable proof and current target access. New preparation still requires live source capture and write fences.

The Interface W9 composition lacks the helper, lacks `createSfRecordHistory`, and does not pass `dashboardEvidence` to Atlas. Copying only the two Dashboard files cannot compile or connect the readback. Copying an evidence resolver without its BCS wiring cannot fix the real consumer.

Operations BCS `9aee116a091c684ba467f81316d2fb915b3f8758` is not a shortcut: it has no Dashboard services/decisions imports or return properties. Those Dashboard files are absent in that branch. Replacing our BCS with it would remove already implemented Dashboard wiring.

## Previous lower bound: 25 paths at a1e9, not a current complete closure

At the prior Compose pin, BCS and business-context directly or transitively imported these 19 modules absent from the Interface comparison checkout. Their source and imports were read through MCP. This table fixes the earlier analysis to its actual immutable input; a superseded blob is not an intake recommendation.

| Path | Blob at a1e9 |
|---|---|
| `product/planner/confirmation.ts` | `0d217f65b2a86aa9b5f5c78b70150128d17cc72b` |
| `product/host-binding/evidence-order.ts` | `6b3f78f6d8f4037829db6b83259edb76dc2436a5` |
| `product/documents/scenario-inputs.ts` | `566776cda673751c1b6fe78f55ef53f573e83b37` |
| `product/procurement/decision-host.ts` | `23d9291b3dcedda36edc4aa4f38856024e3c58f4` |
| `apps/cli/src/sucafina-product/planner-evidence.ts` | `692adcc1100cf0894817f9023bf5c45c9c28232c` |
| `apps/cli/src/sucafina-product/planner-calculation-services.ts` | `6678372b0c955d551e9910060e405a6765c79ccd` |
| `apps/cli/src/sucafina-product/scenario-operation-access.ts` | `aa1be4cfb8f501b3fccddb269efce5567bcdd447` |
| `apps/cli/src/sucafina-product/recorded-planner-operation-access.ts` | `38b832f73b0eaa615d5fdf2d7838b0e5635440fa` |
| `apps/cli/src/sucafina-product/decision-baseline-services.ts` | `1c5cc2cc2f3c0f5aff1ce730972a2eda80292dab` |
| `product/procurement/confirmation.ts` | `4fcda499e060bd77d595e4d567d7e9daed671fc4` |
| `product/procurement/queue-page.ts` | `91784d3ea3358565e19b62922c8867f134af9ac4` |
| `product/host-binding/atlas-recall-scope.ts` | `30697fcbeee6b7011cc7786a0a3bc64bd0d3449e` |
| `product/decisions/scenario-request-store.ts` | `0d677d2d0b3a9df7127f13b25fe3968757f0dceb` |
| `product/planner/calculation-evidence.ts` | `aaacc8bf7df9fa67870c4067154fe67a58c34a22` |
| `product/procurement/source-projection.ts` | `ab9814817d11c0b477636ee54d1b2763d365f405` |
| `product/procurement/confirmation-fields.ts` | `a1e45e803105e76f147e695a7e92246257de9b16` |
| `product/procurement/queue-view.ts` | `a03998f3b87df91c6c84b198f2b51aa9c391bcd2` |
| `product/decisions/calculation-history.ts` | `4e92219aae9046891f167502139412bf9c509529` |
| `product/procurement/monetary.ts` | `5ed7b1c7e8f140c2820d9e3095a7427374d10f69` |

The `product/` rows use prefix `modules/sucafina/Sucafinav1/`.

Arithmetic of that lower bound: 19 absent imported modules + the new Dashboard evidence helper + five changed existing inputs (apply, dashboard-decisions, BCS, business-context, case-port) = 25 paths. This excludes compatibility changes to other existing providers and callers. The required case-port `verifyScenarioOperations` parameter alone changes the creation contract and cannot be bypassed with a permissive callback.

Current Compose `35b9` retains that broad composition and adds `planner-calculation-history.ts`, wired by the changed calculation services and BCS. Its import graph includes the protected calculation-history/request-store/evidence services. No typecheck or full current closure validation has been performed here, and no new exact path count is claimed.

## Qualified Operations proof

Operations delivery at current PR34 preserves the structured result for run `43584405211`, snapshot `9e1d872f453c218909d328b480ffaf8bed6f0c82`: H01-H08 component cases PASS, aggregate run FAIL because startup/H09/lifecycle did not acquire Chromium. The delivery explicitly calls out the isolated branch's generic Dashboard/Planner HTTP binding as pending composition. Its Procurement component proof must not be substituted for Dashboard reload, full host composition, process restart or native acceptance.

Source: [Operations delivery](https://github.com/gustavomhss/Orchestra-SF/blob/ba8a09e371ce8d93eb917eabb102caaee5affaf4/modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP04/operations-20261114/OPERATIONS-DELIVERY.md).

## Integration action

Keep apply4bdd plus prepared-apply a454. Consume the latest Compose evidence/BCS composition through the integration owner, reconciling newer Operations and Interface inputs. If a smaller compatibility slice is desired, Compose must publish the narrow factory/history wiring as a concrete new input; do not implement a partial foreign BCS in Interface and do not replace newer Planner/history behavior with the old pin. The only owner patch found in the inspected WP10 owner-patches directory was the WP01 refresh seam, not a Dashboard C12 closure patch.

After a compatible producer bundle is published, exercise the actual Dashboard case reopen after Apply, old authorized projection versus current projection, receipt resolution, exact retry and revocation. Preserve all existing assertions and prove the scope of the consumer. No sf2-control input is part of this finding or recommendation.
