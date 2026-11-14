# W20 — AI6 lifecycle composition

## Outcome and status

The six published WP12 producers at `8bb72c8cdeda149b000d91403c368642c3b53dec` form a compatible intake when accompanied by the WP10 adapter changes in this package. Git blob SHA and SHA256 were checked against every archived producer. Seven directly related published test files were fetched through GitHub MCP at that same commit and verified byte for byte. No product test, typecheck, build, provider turn or browser run was executed locally. This is a builder audit, not an independent review or acceptance result.

The seven WP10 paths are applied in staging and sealed in `package/`, with hashes in `change-manifest.json`. The base published candidate is W19, `d357de0b1f58abc33e86e79ad3f93b8715ba0e83`. The base for `host-context.ts` additionally contains the separately sealed C07 installed-publication provider. The AI host snapshot preserves that work. Later C17 G03 changes must be composed over it; do not replace a newer combined host with this package's older host snapshot.

## Exact published intake

All six paths below are under `modules/sucafina/Sucafinav1/product/ai/` and use the single PR36 commit above. `selection.json` supplies full paths, local paths and SHA256 values.

| File | Git blob | Semantic change |
| --- | --- | --- |
| analysis-host.ts | 79bc5b933253daf8db73171d20e84f77436f5bbe | Accepts the optional lifecycle scope, forwards the stale observation, and uses lifecycle reads for fail/settle. |
| analysis-port.ts | 3c78f724a50c37757570e80ba18af950a9469132 | Separates terminal metadata authority from execution/content; binds publication inputs before callbacks; pins one stale observation; separates progress from ready output reads. |
| run-store.ts | 978e4d54d2d54d1308152b7a4e9625f5c54b36ae | Adds `SfStaleRunObservation`; supports metadata-only reconciliation of an exact stored ready output; hardens lifecycle reads and terminal CAS. |
| continuation.ts | 940a98787420b7f88e625d7f7e9aeee39373f215 | Pins command, prior run, human response, admitted result, authority identity and final readback across awaits. |
| contribution-builder.ts | e0f70be52df22cac36dbaa88aa1ca7404f4abecc | Enforces reviewer independence for every reviewer-skill output, including an unresolved condition. |
| contribution-reader.ts | e7a20228f81e9e4af51cd29fda7fb4a76f3a7ef0 | Pins Request/binding/lease and returned bytes through fresh and historical reads; checks native current-case binding; returns isolated values. |

The first three form the API dependency chain for lifecycle settlement. The remaining three carry the published AI6 security closure for the adjoining readers/builders/continuation. No additional product dependency is required by their relative imports. `decodeSfContributionOutput` already exists in the selected schema-admission module; the new observation import resolves inside these six files.

## Why exact intake alone was insufficient

The prior WP10 stale wrapper exposed only three arguments to `markStale`. The new producer calls a fourth argument, the observation of the previously authorized run/publication. Discarding it would make a ready run impossible to reconcile through the metadata path. Both W19 and the proposed PR32 helper still had the three-argument wrapper.

The published analysis host defaults `withLifecycleContext` to `withRunContext`. WP10's strict context enters `business.withCase`, which calls the canonical case reader. That reader resolves evidence and scenario-operation proofs. A source whose authority cannot be reopened may therefore close the strict scope before a terminal metadata write. In addition, W19's host commit callback treated `failed`, `unavailable` and `needs-input` as fresh source commits. Merely installing the six producers would leave those writes dependent on superseded source proofs.

Three early native-admission failures also bypass `runSfAnalysis` settlement: unknown preparation outcome, rejected preparation and an admission that cannot be announced. Their native adapter previously used the strict scope directly.

## Own reconciliation

### Private lifecycle capability

`analysis-run-context.ts` keeps the existing strict function body unchanged and adds `createSfAnalysisLifecycleContext`.

The new scope admits the original human `analysis.start` intent on the original Request. It validates the run reference, original case identity/version, context fingerprint and complete intent digest. It independently requires current C08 grants for both `contributions` and `cases`, current membership in the same physical case, the same principal/policy/access revision, and a current case version at least as new as the original run.

Membership, raw run bytes and final authority revalidation share the real `transactionAll` read lock. The full snapshot digest is retained across those callbacks. No source resolver runs under that read scope. The frame also pins the binding object, lease object, Request association and binding bytes. Host disposal, Request abort, released leases, changed membership or changed case incarnation refuse the operation. Frames are deleted and the human lease is finished in `finally`.

This scope installs neither `business.withCase` selection nor `replayContexts` membership. Execution, source replay, native input production and ready output reads continue using the existing strict scope.

### Metadata commit boundary

The host dispatches C08 commit validation to the lifecycle helper only for a privately registered lifecycle frame. The helper accepts `stale`, `failed`, `unavailable` or `needs-input` over the exact predecessor captured by that frame. It verifies a single version increment and equality of every non-lifecycle field, including existing native provenance and output reference. It checks current case bytes and membership again inside the shared transaction and verifies record/snapshot stability after authority awaits.

It refuses caller output, Alternative capture, `ready`, `running`, creation/attachment and cancellation. C08 still owns storage versions, target access, idempotency, the transaction CAS and final authority checks. The foreign run store still owns the stale observation and stored-output digest checks. The private frame records the expected committed run digest, and successful egress verifies the actual durable run against it.

No observation is treated as authority. The producer permits only its exact original observed run or the narrow observed-running to committed-ready successor. A ready downgrade retains the already stored output bytes and checks them inside CAS; no caller output crosses the lifecycle boundary. Concurrent cancellation and another run/output remain conflicts or refusals. The own frame additionally refuses an intervening predecessor change after its admission.

### Stale preservation and cancellation

`analysis-stale-commit.ts` now captures and freezes a copy of the fourth `markStale` argument before its first await and forwards that copy. A registered lifecycle call uses the metadata-only store operation. Content preservation is explicitly unavailable in that scope.

Outside that scope, the existing source preflight, historical continuity, source fences, C08 commit guard and cancellation guard are byte-identical to the base. Cancellation still requires current, separate human `analysis.cancel` authority; lifecycle start intent cannot stand in for it. No PR32 helper wholesale replacement was applied.

### Native admission failures

`native-execution.ts` adds an optional lifecycle callback with the old strict callback as fallback. Only the three terminal failure callbacks use it. The create/attach admission path and the complete execute/collect/cancel/release implementation remain unchanged. `host-context.ts` injects the capability into both factories and uses it for the existing outcome-unknown catch.

## PR32 candidate kept as a reference

`apps/cli/src/sucafina-product/analysis-stale-commit.ts` at PR32 `f9990ecc7ade0d64122633d51258ddafe2c93802`, blob `299979047340dd76d7cc2db667b826da675a1e2e`, adds historical calculation handling and a new private human read lease. It is archived under `incoming/W20-wave/pr32` and was inspected, but not adopted as a complete replacement. The current W19 source/cache authority composition and the C17-owned calculation work must remain. Its separate historical-calculation proposal does not solve the dropped observation or independent lifecycle wiring by itself.

## Contraproofs and hosted selection

The new own integration file has four tests, each with a 120000 ms budget:

1. Current Request/C08 authority settles non-executing states after a real source-fence change and case advancement. The same scope cannot select fresh case data, obtain strict content, preserve a caller output, publish ready data or gain replay context.
2. A caller mutating the observation after entry cannot alter the captured observation. The exact stored output survives ready-to-stale reconciliation unchanged. Missing/changed observation and an already cancelled run are refused.
3. ACL loss, finished lease, another run, removed membership, replacement case incarnation, inactive host and Request abort cannot produce a metadata write.
4. An `analysis.start` lifecycle frame cannot cancel. A separately admitted current `analysis.cancel` intent can cancel with the existing own C08 cancellation guard even after the source changes.

The added CLI native-execution test uses the genuine `SfNativeHost` and actual C08. It creates only the exact preparing record, changes the source, receives the genuine native admission denial, and verifies terminal settlement without a native Session, loaded receipt or output. It also verifies that the strict read remains stale. This test covers the rejected-preparation branch; the unknown-preparation and announcement-failure call sites are statically reconciled and retain their existing runtime gates. No claim of successful native execution is made.

The integration fixture uses authentic Request, human leases, C08 and source-fence implementations. Its seeded run/output objects are explicitly structural upstream fixtures, not native witnesses. Source-content verification fails closed. Its only allowed fresh write is the one exact preparing record; it has no permissive output verifier.

The seven exact WP12 test files are in `foreign-tests/selection.json`, with original MCP responses in `foreign-tests/raw`. They cover the producer lifecycle, ready-content separation, contribution/reviewer integrity, historical reader and continuation changes. Across the six files present in staging before intake, no existing assertion line or test declaration was removed; the continuation file was not hydrated locally, so no local baseline preservation claim is made for that file. All seven have verified Git blobs and resolved dependencies.

`ci-selection.json` lists the necessary complete files. The root should deduplicate them against its planned W20 slices. Keep canonical timeouts, omni strict configuration and all existing budgets, including the 240000 ms historical-memory test and the 105-second Review browser deadline. No test-name filter is proposed.

## Limits

No hosted verdict exists for this own delta yet. No native/global acceptance, provider execution, successful continuation admission, native routine execution, Task approval or C07 native closure is inferred from these tests. New lifecycle authority is process-local, Request-bound and short-lived; it does not revive a stale ticket or persist a grant across restart. The separate C07 provider remains installed-publication only. Three independent reviewers and the root's hosted check/test gates remain required.
