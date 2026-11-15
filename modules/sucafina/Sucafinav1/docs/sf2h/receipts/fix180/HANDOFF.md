# Mission180 — A14 public Schema import fix, terminal handoff

**Status:** ARTIFACT_READY for 162 intake · **epoch:** `native-fix-e1-browser180` · **actual model:** GPT-6 (Astra session not exposed) · **session ID:** not exposed. One existing branch `sf-ux-a14`, PR [#136](https://github.com/gustavomhss/Orchestra-SF/pull/136), no reset, force or foreign source writes. Native Goal paused; `GLOBAL_RELEASE=false`.

## Exact complete source patch

```diff
diff --git a/packages/schema/src/sucafina/memory.ts b/packages/schema/src/sucafina/memory.ts
--- a/packages/schema/src/sucafina/memory.ts
+++ b/packages/schema/src/sucafina/memory.ts
@@ -1,5 +1,5 @@
 import { Schema } from "effect"
-import { optional } from "../schema.ts"
+import { optional } from "../schema"
 
 // This leaf is a closed projection of memory-http.ts, not an Atlas store or a
 // second materiality engine. All permissions and source-digest checks remain in
```

The helper is still the exported `optional` in `packages/schema/src/schema.ts`. Existing Schema modules use extensionless internal imports. No type shape, operation (seven existing memory operations), source admission, ACL, Atlas, decoder, runtime or client wrapper is changed.

- Source pre: `a359cb6d9016cc18cedb863cb7ec20fe7242d804` / tree `78e8631baab1310a97431b44fad28e9bb84f859d` / source blob `d501d30c2e0f0693f8533c8fe4d217f0068cde86`
- ACK: `11df97cec650c17c4c239e3356b2a2972a600a6b` / tree `eb3bf389f1f27be86b019761c9c7304aba956057`
- Patch commit: [`9ded9ce8ef6077dfbc63171e3c9785204898231b`](https://github.com/gustavomhss/Orchestra-SF/commit/9ded9ce8ef6077dfbc63171e3c9785204898231b) / tree `d55836e4a85dacada3af10f44a666eefa5ae5afe` / source blob `554c07bbf881b89ab9df852cdbf61322547f6382`
- Remote GitHub compare `11df97c...9ded9ce`: **one** modified path, **one** addition, **one** deletion. Source readback matches postimage.

## 162 consumer/material pre/post

- Observed `sf2-stack`: `913b6b8f143e6c3e869eee293d02f04259c7cdd1` / tree `99d4788774ce548d4cd64a96c0f2481db1fb15eb` / memory source blob `d501d30c2e0f0693f8533c8fe4d217f0068cde86`.
- Consumer post: **PENDING**: post SHA/tree/blob unknown until 162 applies the source blob. Do not mislabel the source-only fix as integrated.
- Requested 162 action: retain single integrator PR#65, recheck current consumer head/preimage by CAS, consume **only** `554c07bbf881b89ab9df852cdbf61322547f6382` for `packages/schema/src/sucafina/memory.ts`, preserve other files; record actual post W/tree/blobs. No wholesale branch merge.

## Finding, criteria and validation

Compiler163 actual hosted [run 43766055614](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43766055614) / job 132971280139 on `W690a34` reports **TS5097 at memory.ts:2**. Source patch removes the disallowed `.ts` suffix, without enabling `allowImportingTsExtensions` globally. This is **source readback evidence**, not a passing compiler result. The baseline 163 run failed six of 16 checks and remains FAIL. CI164 [run 43766970018](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43766970018) / job 132974180913 is a separate failed browser input, not a memory import validation.

- Targeted TS5097: **SOURCE_PATCHED; TYPECHECK_NOT_RUN_AFTER_PATCH**.
- A14-AC01/02/03: original contracts unchanged, **NOT_RUN_AFTER_PATCH**; no fabricated overall A14 acceptance.
- Local tests/typecheck/parsers/validators/build and additional dispatcher: **NOT_RUN** by user instruction.

**Requests after 162 materializes a new coherent W:**

1. **163 / PR#107** — on that exact new W, `cd packages/schema && bun typecheck` then `cd packages/client && bun typecheck` via existing compiler owner (and owned SDK/guards work only as independently required). Record separate failure inventory; dedup input hash; do not rerun unchanged W690a34.
2. **164 / PR#106** — consult invalidation matrix, reuse existing `modules/sucafina/Sucafinav1/test/native-ui-contract/memory.test.ts` (pre-blob `b658352fdbdb336ef1eb57815ce2b457e6654dcb`) when needed, through the sole existing hosted product CI dispatcher. Focused selection `bun run test:ci sucafina Sucafinav1/test/native-ui-contract/memory.test.ts --os linux` is a request **not executed**; no mirroring test, full suite or identical failed-input retry.

**Lease terminal:** source artifact ready for owner 162; producer/runtime/ACL/test oracles untouched; global release not claimed. Machine-readable details in `TERMINAL.json`; preflight in `ACK.json`.
