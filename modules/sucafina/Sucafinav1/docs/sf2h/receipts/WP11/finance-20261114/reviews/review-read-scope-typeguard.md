# Independent static review: renewal read-scope capability guard

**No static blocker. Hosted typecheck and product validation remain required on the new commit.**

Reviewed `modules/sucafina/Sucafinav1/test/product/wp11/renewal-read-scope.test.ts` from `d91a07ddb9dc9cc5d093121112b7603533d4e1fb` to `803a9a3154a2dcf99a8118253216bf97efb2e8f5` (SHA256 `bbd5494b1b38c4342819bf14e2dd033fe58648d5f5fda38840b8ccab3b5da653`). Reconstructing the previous file by removing only the added guard reproduces the supplied old blob exactly.

The added line rejects a missing `transactionAll` capability before either existing call. It neither skips a check nor introduces a fake snapshot/fallback. The fixture uses the actual `openLocalStore` object, whose implementation supplies this method; its contract exposes the member as optional, which explains the four hosted TS2722/TS18048 diagnostics across the two calls.

All three cases and all nine `expect` calls are unchanged: canonical operation/source-only admission leaves every durable snapshot unchanged; a subsequent invocation observes a canonical Planner edit; and a revoked UI lease during an awaited source callback is refused. Timeouts, operations, sources, authorizations, source fences and the implementation under test are unchanged. Cleanup remains in the existing `finally`, including when the new guard rejects.

This review performed file reads and hashing only, with no Bun command, product execution, typecheck, CI dispatch or remote write. S19 started before this one-line guard and must not be cited as validating the candidate bytes. Parent will record the next exact-head package typecheck and scoped three-case Actions result.
