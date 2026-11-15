# Missão 144 — N18 terminal / handoff to 132

Material N18 authored on `sf-ux-n18` / epoch `ux-native-n18-e2`. PR: https://github.com/gustavomhss/Orchestra-SF/pull/172 (**DRAFT; never merge wholesale**). Material SHA `2ba9f0c96598b8d89bc47eab7cd70da8c7941ccb`, tree `c9963affedbaabf7ce068384e44d09620fb82750`. ACK `ce26081cbcddde20eeb2d0eefb2b92b7ced6aaf7`. Terminal lives in this receipt namespace.

## Changes

- **U06 / CAP17:** reject a missing explicit source-version rather than substituting the producer default; distinguish not-found; guard comparison and original U20 import navigation by source authorization; preserve 0/null and producer monthly/period data.
- **U46 / CAP23:** establish absent CAS key as **0**, as source `runtime/contract.ts:conflict` and renderer require; enable creation of the first version and first official version of a year; omit unchanged year from locked/official rename; require dirty edit to review; create/copy uses exact producer-returned ID plus authorized readback, not just count; lock/unlock/official are readback/CAS verified; prevent replay while pending or uncertain and route safely after create/delete.
- **Compare:** side-by-side two distinct same-year producer CAP17 reads, zero vs missing retained and source-only 12-month chart/table. Partial state now reports partial, no client finance formula.
- **E2E authored:** U46 first-version review must not POST, comparison viewport matrix 320/768/1024/1280/1440 and 200% text; existing U06/U46 installed journeys preserved. **Nothing executed.**

## Blobs (prepared branch preimage -> immutable material postimage)

- `packages/app-shell/src/orchestra/chapters/sucafina/planner/overview/index.tsx` — `7adc277dc5bd3ab6b25bd2dea8859199942bae06` → `382886a44bd21a44c68d3f656f515b1701c3dc20` **changed**
- `packages/app-shell/src/orchestra/chapters/sucafina/planner/overview/overview.css` — `0bcab3cf79c21d1d8c77fd2c9ac63ed8e5e7fde0` → `0bcab3cf79c21d1d8c77fd2c9ac63ed8e5e7fde0` preserved
- `packages/app-shell/src/orchestra/chapters/sucafina/planner/versions/index.tsx` — `b5da0890283f8f8c0a1e7f08de33ed04a247cc8b` → `6b6d4d59e174e346e349aff7ecde33a6b89336b5` **changed**
- `packages/app-shell/src/orchestra/chapters/sucafina/planner/versions/model.ts` — `c5f654637ba24fcd078e2445dd7d795ca3b784e0` → `c5f654637ba24fcd078e2445dd7d795ca3b784e0` preserved
- `packages/app-shell/src/orchestra/chapters/sucafina/planner/versions/versions.css` — `295861176a0182f03f672964daa138bad06c5c10` → `295861176a0182f03f672964daa138bad06c5c10` preserved
- `packages/app-shell/src/orchestra/chapters/sucafina/planner/compare/index.tsx` — `8e5fdc7787c95e7cae8e596bf65459975f58b8aa` → `59c6111e5f6998da1d3365db1e40735532edfca8` **changed**
- `packages/app-shell/src/orchestra/chapters/sucafina/planner/compare/compare.css` — `31c4aa047567dae244f327bf75d1847be29f5a2c` → `31c4aa047567dae244f327bf75d1847be29f5a2c` preserved
- `packages/app-shell/src/i18n/orchestra-chapters/sf-u06.ts` — `4f4875fcb48a357bc36398dc54d75fd4f8afd5d4` → `4f4875fcb48a357bc36398dc54d75fd4f8afd5d4` preserved
- `packages/app-shell/src/i18n/orchestra-chapters/sf-u46.ts` — `93ef95161d4db47dcf48758ad32d634924341c1f` → `93ef95161d4db47dcf48758ad32d634924341c1f` preserved
- `packages/app-shell/e2e/sucafina/native/journeys/u06.spec.ts` — `af4f9a2640d6a3fb71c10e78a91d182ac166c5fe` → `af4f9a2640d6a3fb71c10e78a91d182ac166c5fe` preserved
- `packages/app-shell/e2e/sucafina/native/journeys/u46.spec.ts` — `5795c3603ca8810df64ec2893757d22b36af0f3b` → `c23568fcb4e35835ff93f88a90dad3e2f7777e5d` **changed**

## Import / composition fragment for 132

Use existing F01/S01 routes only: `CAP17:entry` -> `SfPlannerOverviewView`; `CAP23:entry/new/detail` -> `SfPlannerVersionsView`; `CAP23:compare` -> `SfPlannerCompareView`. Register `SF_U06_COPY` / `SF_U06_COPY_BR` and `SF_U46_COPY` / `SF_U46_COPY_BR` through the existing F03 global i18n. Bind the original U20 `/orchestra/sf-imports/new` UI for imports. Do **not** author an alternate import action, dispatcher, backend or finance engine.

`sf2-stack` had 21 commits unavailable on this writer branch and the PR comparison included 205 historical/unrelated paths at PR creation. 132 **must not merge the full branch**; copy/reconcile only the 11 owned material paths listed above and the receipts in `advance144/`, retaining all other authors. Check current preimage and expected source/owner before each update. Do not reset/force.

## Gates and source limitations

U06-AC01/02/03 and U46-AC01/02/03 are **authored/unvalidated**, never PASS. The missing/zero comparison is source-bound; **explicit inherited-budget origin is not in CAP17 MoneySummary**, so any inherited badge is blocked until A02 supplies authoritative provenance. U46 lists `planner.forecast.prepare`, but the compare surface does not expose an admitted caseRef/confirmation path; no speculative prepare dispatch. U20 admission requires installed integration. These findings cannot be waved through by a preliminary review.

All tests, compiler, typecheck, build, local validation and installed/browser CI are **NOT_RUN** for this exact material. 149/PR107 owns compiler; 150/PR106 owns focused and installed tests after 132 composes the coherent candidate. Goal **paused**, GLOBAL_RELEASE **false**, PR **draft**, fresh epoch writer closes with this handoff.

## Exact next action

**132**: fetch SHA `2ba9f0c96598b8d89bc47eab7cd70da8c7941ccb`, retrieve the 11 postimage blobs above, re-check current `sf2-stack` preimages, apply a path-scoped integration with CAS/force=false only on the authorized integrator branch, wire the three views and two copy pairs, retain U20 original import. Hand off the integrated exact C/SHA to 149 and 150 for actual checks; record source lineage limitations and do not mark PASS without their evidence.

See `TERMINAL.json` for machine-readable criteria, finding IDs, refs and source pins.
