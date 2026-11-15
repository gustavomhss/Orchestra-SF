# 137 / W03-F02 — terminal correction handoff (epoch e3)

**Authority:** new ChatGPT GPT-6 session, browser session ID not exposed. S0 fence `f7e11ba51a2a1d200f28cfd9e0ba3b5410d09cf5`, actual ACK `071ffb525b4b5466229b8ed44c8a9d5d1bbdc1ed`, prior e2 future-write authority revoked without deleting historical commits. Existing branch `sf-ux-w03`; same draft PR [#122](https://github.com/gustavomhss/Orchestra-SF/pull/122); no new writer.

## Finding and real correction

Compiler128 C64 hosted run [43738074189](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43738074189) reported TS2339 at `router.ts:57:16` and `:57:72`: `SfOperationRegistry` is a `const` literal union; not every member declares `maxRequestBytes`. In the exact C64 registry `e18f1fa448b7fcff8a2691dd1b0778640b3f6a84`, all 11 `/api/ui/` POST projections have `maxRequestBytes: 65536`; GET projections do not. This is a historical failure, **not** proof of the new patch.

[Fix commit](https://github.com/gustavomhss/Orchestra-SF/commit/ab83adc9493bd49621889b33f52cb6a2b55b7278) uses the sound `"maxRequestBytes" in meta` narrowing, fails closed at route mount for POST with missing/invalid/nonpositive bound, and preserves exact per-operation cap for POST plus bodyless GET behavior. No `any`, cast, generic fallback, weakened schema or cap, new network read, Request cloning, handler semantics, permissions or producer modification. A request with undeclared length still requires the **real producer** to enforce streamed byte limits; `Content-Length` is preflight only.

## Exclusive file preimages → postimages

| Path | Source preimage (also C64 and latest observed C) | e3 postimage |
|---|---|---|
| `apps/cli/src/sucafina-product/native-ui/router.ts` | `860d44eb7c215aafe05eba0df265a721c563c148` | `17db52d914ca49934953e1161461b03856eb29c5` |
| `modules/sucafina/Sucafinav1/test/native-ui-contract/transport.test.ts` | `7fe06cad2bff509039e1a093bbd6224d2fd2c262` | `0789f34911cd97d82a870dcee2f17fa37c8b4578` |

Actual consumer `sf2-stack` observed HEAD **`fc8840207377a363d4e6844aab496b4f1521f83c`**; both consumer file blobs matched the above preimages at observation. Reconfirm before apply: 132 is the sole integration writer, and this receipt is **not** an integration ACK.

The complete two-file patch is [PATCH-137-e3.patch](./PATCH-137-e3.patch) and the machine-readable map is [SOURCE-MANIFEST-e3.json](./SOURCE-MANIFEST-e3.json). Integrate **only these exact two files/deltas** after consumer preimage check; do not merge the entire inherited `sf-ux-w03` branch or overwrite later changes. No shared file needs an authored patch in this narrow correction; export/registry/composition remain 132-owned.

## Authored regressions — no fake green

- `F02-C137-POST-LIMIT`: `routines.catalog` POST with Content-Length 65537 -> 413 before handler; malformed 0001 -> 400; exact 65536 -> 200 and same Request identity.
- `F02-C137-GET-NO-CAP`: `projection.search` GET without length -> 200 and exact Request identity; declared GET body -> 400.
- Existing F02 regressions remain unchanged and present.

**New code test/typecheck/guards/SDK/hosted CI: `NOT_RUN`.** This is required by the current division of labor, not a PASS. No local parser/test/validator/typecheck, dispatcher, force/reset, deploy, release or Goal resume.

## Consumer chain / qualification

1. **132 (sole I00 integrator, PR65):** review the precise patch and source/consumer preimages, compose into one coherent C, publish independent real source→consumer SHA/epoch ACK; source PR alone is ARTIFACT_READY, not INTEGRATED.
2. **128 (compiler/SDK, PR107):** after 132 integration and F01 closure, run the authorized hosted `apps/cli` typecheck and needed directed Schema/Client checks; real `packages/client bun run generate` only via 128 if public HttpApi changed, no handwritten generated files. Keep other C64 findings open.
3. **129 (product CI, PR106):** only at that same coherent accepted C, dispatch the surgical `modules/sucafina/Sucafinav1/test/native-ui-contract/transport.test.ts` selection once with dedup by SHA/config/fixtures; publish real run/job/result or NOT_RUN. No epic on this source patch.

**Terminal author status: `ARTIFACT_READY_CORRECTION_ONLY`.** Still **INTEGRATED=NO / QUALIFIED=NO / GLOBAL_RELEASE=false**. Native Goal stays paused, all canonical criteria, remaining UI tasks, gates, independent FINAL and C/G7–D/G8 remain in force. Non-authorized paths, earlier authors and their commits untouched.
