# Mission175 — A05 Portfolio strict decoder generics: terminal handoff

**Status: ARTIFACT_READY source only; NOT INTEGRATED; NOT QUALIFIED.** Native Goal paused, `GLOBAL_RELEASE=false`. Existing branch `sf-ux-w17`, existing PR #134; epoch `native-fix-e1-browser175`. Actual responding model GPT-6 (not Astra); no runtime session ID exposed; GitHub actor `gustavomhss`. The predecessor `ux-native-w17-e3` is fenced for future writes on these paths only; no runtime process termination claimed.

## Source and consumer provenance (read back after write)

| Item | PRE | POST |
| --- | --- | --- |
| Source original HEAD | `b1238d1d43308739f915111708d88bfb729d4799` / tree `7c53b243e4a94c26115da86017f1c285cfd576b2` | ACK `7ece75e873ce3d3ef39182085f3ab9d5f222959f` / tree `f894f20e6a988e395c5335363bf2484d1a36c023` → implementation `04318ca003007bca89bda535af6bc0e1f6100289` / tree `1fe07a18d8a473a6471ae24a9f529ea5e83fa339` |
| Source `packages/schema/src/sucafina/portfolio.ts` blob | `708731dbbaf1fe69664715a4f34007976a4b0476` | `5ace759126c6e810d9718df01ce22779146193ce` |
| Source `modules/sucafina/Sucafinav1/test/native-ui-contract/portfolio.test.ts` blob | `3820d0dea2470e7ad620bbf48ee50120ccdaece6` | **same** `3820d0dea2470e7ad620bbf48ee50120ccdaece6` |
| Consumer `sf2-stack` / PR65 | **current observed** HEAD `913b6b8f143e6c3e869eee293d02f04259c7cdd1`, tree `99d4788774ce548d4cd64a96c0f2481db1fb15eb`, portfolio blob `708731dbbaf1fe69664715a4f34007976a4b0476`, test blob `3820d0dea2470e7ad620bbf48ee50120ccdaece6` | **PENDING 162**: no consumer commit/tree/postimage or ACK fabricated. Expected portfolio blob `5ace759126c6e810d9718df01ce22779146193ce` only if exact patch applied. |

Author fix: [commit 04318ca003007bca89bda535af6bc0e1f6100289](https://github.com/gustavomhss/Orchestra-SF/commit/04318ca003007bca89bda535af6bc0e1f6100289). Full four-hunk inert [PATCH-175.patch](https://github.com/gustavomhss/Orchestra-SF/blob/04318ca003007bca89bda535af6bc0e1f6100289/modules/sucafina/Sucafinav1/docs/sf2h/receipts/fix175/PATCH-175.patch) (Git blob `dbcd700f7f02ae51b8ea7e223bca287665e8fd3c`). Detailed [SOURCE-PATCH-175.json](https://github.com/gustavomhss/Orchestra-SF/blob/04318ca003007bca89bda535af6bc0e1f6100289/modules/sucafina/Sucafinav1/docs/sf2h/receipts/fix175/SOURCE-PATCH-175.json). ACK before write at `7ece75e873ce3d3ef39182085f3ab9d5f222959f`. The source patch changes only FOUR annotations in the schema; there are no shared files, tests, fixtures, assertions, timeouts or generated sources changed.

## Causal repair, not a type escape

GitHub Actions compiler163 [run43766055614](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43766055614), job132971280139, on material W `690a34cdd81c12d7311f3717c19679b950276161` (tree `07133fe09922121f3cca3bffd6b4463053b48ece`) and actual Effect `4.0.0-beta.83` emitted `TS2345` in `portfolio.ts:256` and `:260`, repeated in Schema/Client/CLI typechecks. Verified installed-version API: `Schema.decodeUnknownOption` and `Schema.decodeUnknownSync` require `Schema.Decoder<unknown>` with service-free decoder default `never`. `Schema.Top` and original `Schema.Schema<EvidenceRefType>` erase that guarantee.

This patch changes the recursive EvidenceRef annotation to `Schema.Decoder<EvidenceRefType>`, and `envelope`, `closed` and `operation` generic bounds to `Schema.Decoder<unknown>`. The **original unknown input** still passes the same `onExcessProperty:"error"` filter and decode against each concrete original schema; nested EvidenceRef, arrays, status/reason refusal and CaseRef CAS remain strict. No `any`, cast, permissive schema, suppression, stub or dependency upgrade. The exact original ten operation IDs and producer `portfolio-http.ts` (blob `6cbfc373ea72a90351e4f9997f65663e0f5fc775`) are untouched.

Original A05-AC01 (source field/zero/null/version), A05-AC02 (closed operation/input/refusal) and A05-AC03 (operation/CAS/source version) are **preserved in source, NOT requalified**. WP13.T01–T04, 68 WP13 criteria and global 15 WPs/74 tasks/17 contracts/1610 criteria remain unchanged and not autoaccepted.

## Validation: real history vs new material

- Compiler163 on W690: **FAIL** with cited two TS2345; **new source fix hosted compiler NOT_RUN** (no permission to compile locally). Other type errors and guard gate failures remain outside this patch.
- CI164 [run43765725305](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43765725305), job132970248049: existing `portfolio.test.ts` **9/9 PASS ON OLD W690**, while decisions import errored from unrelated `Schema.minLength`; no transfer of qualification to this commit.
- CI164 [browser run43766970018](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43766970018) / job132974180913: **FAIL unrelated F03/S01/S05**, portfolio not selected. This run is not a portfolio regression.
- **After fix:** local parser, build, test and typecheck **NOT_RUN per policy**; hosted typechecks and guards **NOT_RUN until new 162 integration**. SDK regeneration **NOT_RUN/not needed from this type-only change**, since Protocol/Server HttpApi were untouched. Full epic/FINAL/AM01–06/G7/G8 unproven.

## Exact handoff

1. **162 / PR65 / sole `sf2-stack` integrator:** reread current consumer HEAD/tree and `portfolio.ts` blob (observed `913b6b8f143e6c3e869eee293d02f04259c7cdd1` / `708731dbbaf1fe69664715a4f34007976a4b0476`). Apply **only** `PATCH-175.patch` four hunks with GitHub CAS and `force=false`, reconciling any intervening commits. No whole-file/whole-branch historical import, reset, duplicate controller, generated-path changes, or edits to other owners. Validate new consumer actual SHA/tree/path blob (expected `5ace759126c6e810d9718df01ce22779146193ce`) and untouched test blob `3820d0dea2470e7ad620bbf48ee50120ccdaece6`. Publish real consumer ACK with coherent W/tree and dependency closure before requesting gates.
2. **163 / PR107 / sole compiler:** **after 162 publishes a genuinely new coherent W/tree and ACK**, deduplicate by W/tree, lock, ordered selection and affected source pre/post. Request hosted `bun typecheck` individually from `packages/schema`, `packages/client`, `apps/cli`; record precise exits and verify `portfolio.ts:256/260 TS2345` are gone without concealing other diagnostics. Only scope guards if new causal input warrants it. Reuse existing SDK artifact whenever generator inputs unchanged; do not rerun unchanged broken compiler input, launch new local typecheck or dispatcher.
3. **164 / PR106 / only product test dispatcher:** **no new `portfolio.test.ts` run solely for four type annotations** (no behavior delta); preserve the previous 9 PASS only as scoped historical evidence. If 162 finds a causally changed runtime/dependency or new behavioral break, select exact existing `Sucafinav1/test/native-ui-contract/portfolio.test.ts` through the current hosted `test:ci` dispatcher, with new W/S/selector/fixture/dedup and no assertion/fixture/timeout weakening. Do not rerun unrelated red cases for an unchanged input.

**Output terminal:** source author lease ends at this artifact; 162 has sole right to integrate. Consumer ACK `PENDING`, compiler new-W `NOT_RUN`, product qualification `NOT_RUN`. This is **NOT a release**, with Goal paused and `GLOBAL_RELEASE=false`.
