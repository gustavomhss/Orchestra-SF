# W17/A05 e2 — integration fragments exclusively for 114

**Author**: W17 / `sf-ux-w17`; **implementation**: `3f5e279a432dbadd6533587de07e3d5232cca744`; **status**: ARTIFACT_READY (not INTEGRATED, QUALIFIED, or GLOBAL_RELEASE). No local tests/typecheck/guards were run.

This is not a request to create a second product engine. All ten JSON operations exist in the pinned original `createSfPortfolioHttp` producer (blob `6cbfc373ea72a90351e4f9997f65663e0f5fc775`). The code now implements `SfPortfolio` (ten closed input/output operation descriptors), `createSfPortfolioClient` (ten typed F02 transport methods), `createSfPortfolioNativeAdapter` (delegates the original, unmodified `Request`), and an exclusive spec. No shared files were written.

## Exact shared export patches (114 only)

Both files remain unchanged at the author's HEAD:

```diff
diff --git a/packages/schema/package.json b/packages/schema/package.json
--- a/packages/schema/package.json
+++ b/packages/schema/package.json
@@ "exports"
     ".": "./src/index.ts",
+    "./sucafina/portfolio": "./src/sucafina/portfolio.ts",
```

Preimage blob `adc53ecfa8f4ac83fee37854db2dc0ec2bb9136a`. This is an insertion in the `exports` object, not a replacement of its other keys. `@orchestra/schema/sucafina/portfolio` is imported by the new Client file. The author did not edit this manifest.

```diff
diff --git a/packages/client/package.json b/packages/client/package.json
--- a/packages/client/package.json
+++ b/packages/client/package.json
@@ "exports"
     ".": "./src/index.ts",
+    "./sucafina/portfolio": "./src/sucafina/portfolio.ts",
```

Preimage blob `4cd0244e98ff18b5e65d3c2808196705095b6691`. Preserve other exports. Optionally re-export the client factory in I00's shared native client barrel if that is its chosen composition surface. Do not create a second Protocol API or hand-edit generated clients.

## F02 + I00 host/SDK composition fragment (114 only)

1. F02 `packages/client/src/sucafina/transport.ts` must provide `SfTransport` and `SfCallOptions` with the frozen `host-signatures.ts` semantics; both are type-only dependencies of the A05 client. At the A05 snapshot this file was absent, so **no preimage/postimage exists for F02** and this is intentionally an additive registration instruction, not a fabricated patch.
2. When composing `SfNativeOperationBindings`, include **exactly the ten keys** in `SfPortfolio`. Bind each key's `input` and `output` to its *same-name* concrete schema decoder. Keep metadata/method/path from frozen `contract-catalog.json`, not from a frontend URL. Codec decode failures are `invalid-response` or contract refusal; known but unintegrated bindings return `contract-unavailable` before network.
3. In the existing `apps/cli/src/sucafina-product/native-ui/router.ts` ingress pipeline, mount `createSfPortfolioNativeAdapter` using the actual installed `createSfPortfolioHttp` dependencies (original product, authority, business and mutations). Pass the exact original `Request` and current surface. Do not generate another Request, synthetic authorization, independent service, re-serialization of `caseRef`, or a new portfolio calculator.
4. Fixed routes are **POST** `{mount}/{surface}?sf=<source-action>`. Every operation is JSON, content-type/accept JSON, source action selected by frozen `fixedQuery.sf`. Preserve canonical human admission and status headers. F02 owns client-side origin, credentials, generation, timeout, unique idempotency keys, aborted/outcome-unknown. Adapter does not retry.
5. Only after F01 owner/context, F02 router/transport, I00 bindings/exports and real `product` injection are integrated may the installed flow be qualified. A05 source `portfolio-http.ts` remains unmodified. No valid financial values or evidence should be fabricated for tests.

## Scope / source semantics

- Ten source operations: evaluate, preview, read, reconcile, results, prepare, promote, sensitivity-evaluate, sensitivity-read, sensitivity-units.
- Inputs are strict caseRef + source request/selection. Human actions and CAS are host-owned. The producer strictly refuses extra request fields, stale source versions, changed access, invalid source requests and ambiguous mutations.
- Returns are original `PortResult<T>` envelopes; `needs-input`, `stale`, `denied`, `unavailable`, `conflict`, `provider-conflict`, `failed` remain distinct. An `outcome-unknown` from F02 is **not retryable by this client**.
- Sensitivity units' returned `scenario` is a versioned **ScenarioRequest** from the source, not a computed `ScenarioResult`. Reconciliation is read-only and preserves historical C08/choice/receipt evidence.
- Conditioned/incompatible/unavailable portfolio coverage is never turned into complete financial certainty. Null vs 0 preserved.

## Proving and routing

- Preimages of the four W17 leaf paths: **ABSENT**, as observed at fence HEAD `7f82184799d70ae95c3f02d8ed8509df70b37670`.
- Postimages (full blobs) and commits are in `ARTIFACT-READY-e2.json`; no unreviewed shared mutation was made.
- W17 spec: `modules/sucafina/Sucafinav1/test/native-ui-contract/portfolio.test.ts`.
- **120 / PR106**: request surgical GitHub Actions test selection after 114 registers the leaves; dedupe by candidate tree/selection. **119 / PR107**: typecheck/guards via appointed Actions/runner, not local. F01/F02 and auth-installed product remain explicit blockers for end-to-end qualification.
- No local tests, mocks of authorization, generated manual edits, reset, rebase, force, merge, deploy, or reactivation of the native Goal. 114 owns integration, source family acceptance and shared patch application.
