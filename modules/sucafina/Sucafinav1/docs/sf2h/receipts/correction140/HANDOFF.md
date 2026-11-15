# 140 — Platform fixture correction / F03+S05

**Authoring state:** ARTIFACT_READY; **integration:** NOT_INTEGRATED; **qualification:** NOT_RUN. GitHub PR [#129](https://github.com/gustavomhss/Orchestra-SF/pull/129), existing branch `sf-ux-w04`. Source-only correction, not a release.

## Authority and input fence

Real session-140 ACK is `0d012288c625238bb1016895128e41a16f7f81ba` at `modules/sucafina/Sucafinav1/docs/sf2h/receipts/correction140/ACK.json`, model **GPT-6** (not the older Astra label; session ID not exposed). S0 fence `modules/sucafina/Sucafinav1/docs/sf2h/receipts/correction140/S0-FENCE.json` at `326a6162a6b6b555b64bbeee0d4d79057cff37ec`, observed source head matched exactly; predecessor epoch `ux-native-w04-e2` revoked for future writing, historical blobs preserved. The ACK and product commits fast-forwarded by GitHub CAS `expected_sha`, `force=false`. No foreign path changes.

Sources: canonical `dbf9547211d9b0fade619790de7c19c0869b7c7d`, normative UX `cbac654784714f68779ae1434d30e6ea8970c4d1`, C64 candidate `8f933d3249f49e1234b745036672d7c7a6aabcd4`. The F03 source test was already identical to C64 blob `0d0cd166eda9c2f81d2a77e034c89c0206c78c0f`. S05 **was ABSENT from the source branch**, but existed in C64 with blob `912d5f7cdee87a310cffb2b6baf794497ebdc182` and five intact cases. It was materialized from C64, not copied from an obsolete S05 product branch. See `MANIFEST.json` for exact pre/post blobs and `CORRECTION-140.patch` for complete source-branch patch.

## Concrete root cause and correction

In [C64 Actions run 43738907064/job 132887516559](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43738907064/job/132887516559), the DOM mount in `page-frame.test.ts` and `s05.test.ts` starts with `LanguageProvider`, which internally requires Orchestra `Platform` context. The real throw is `Platform context must be used within a context provider` (2026-11-15T17:04:42–44Z). F03 had 1 pure PASS / 7 mounted FAIL, S05 had five mounted FAIL.

The new `platform-fixture.ts` uses the **actual** `PlatformProvider` export from `packages/app-shell/src/context/platform.tsx` via the established `solidDom` loader, and the real exported `Platform` type. It provides only the structural web browser capabilities required by the context. All unexpected external side effects (openExternal, restart, notify) **throw**; they cannot silently pass. It provides no SF installation, principal, grant, reviewer, receipt, transport or authentication. Both suites now nest `PlatformProvider > LanguageProvider > component`, matching the real web app ordering in `apps/web/src/entry.tsx`.

All existing F03 state, denied/private-data, chart zero/missing, CAS/control and S05 relation/thread/question/confirmation assertions are retained verbatim. F03 gained one dedicated regression assertion resolving the actual `usePlatform().platform === "web"`.

## Strict consumer actions

**132 / PR65 (sole integrator):** reconcile actual `sf2-stack` HEAD and path-specific blobs; integrate the three files from `2f9308228277f48b42c6ff8cb1a968f9bff81b02` only. For F03, apply delta against preimage `0d0cd166...` or reconcile changed consumer. For S05, **do not blindly replace the current C64 file** with a whole file from the author branch: apply `S05-CONSUMER-C64.patch` against consumer preimage `912d5f7cdee87a310cffb2b6baf794497ebdc182` (minimal provider import and wrapper). Install fixture `72bc7ed9...` if absent. No copying stale UX envelope, shared registries, routes, i18n or generated output. Publish consumer ACK and resulting C SHA.

**128 / PR107 (compiler and guards):** after coherent integration, run the existing compiler/guards for `packages/app-shell`, record resulting C/run/job. This correction changes no Protocol/Server HttpApi or SDK binding: `bun run generate` is not needed *because of mission140*. If other integrated authors change public Protocol/HttpApi, generate through 128 only, never manually edit generated files.

**129 / PR106 (sole product CI executor):** only after 132's same-C integration, select surgical browser cases `packages/app-shell/test-browser/sucafina-native/page-frame.test.ts` and `packages/app-shell/test-browser/sucafina-native/s05.test.ts` with the existing GitHub Actions dispatcher and installed `happydom`/Solid module resolution. Dedup by C SHA, selection and environment, record run/job/outcome. Do not rerun unchanged C64 or dispatch a duplicate lane. Follow up on any *new* concrete failure without weakening assertions or expanding timeout.

**139 / PR125 (exclusive S01 owner):** the C64 log independently contains `S01 browser lane failed: 1` / SyntaxError, unrelated to this provider fix. The current W06 S01 test also mounts `LanguageProvider` without Platform. `S01-FOLLOWUP-139.patch` is a **suggestion only** based on `sf-ux-w06@b694342c`, blob `65c74a68a7658706b18e70c5f98e52a419910fb3`; it was NOT written to W06/S01. Recheck 139's new HEAD, apply only if still applicable, and coordinate dependency on 132 integrating the shared fixture before hosted execution. 140 has no authority over S01 product/test file.

## Evidence, criteria and terminal checkpoint

- C64 source failure evidence is **REAL**: GitHub log job `132887516559` with `Platform context must be used within a context provider` in seven mounted F03 cases and five S05 cases; the one pure F03 layout calculation passed.
- New implementation check: **NOT_RUN_BY_POLICY**; no Bun/test, validator, parser, typecheck or local execution, no new workflow/dispatcher. 128 compiler and 129 Actions are **NOT_RUN** for postimage `2f9308228277f48b42c6ff8cb1a968f9bff81b02`, awaiting same-C integrated material.
- F03-AC01/AC02 and S05-AC01/AC02: existing component assertions maintained; a passing result is **NOT_PROVEN** until authorized hosted CI. No release/visual/permission authority inferred.
- No permissions, routing, contract, schema, environment, engine, native Goal, controller or product source code modified.
- Preserve canonical 15 WPs / 74 tasks / 17 contracts / 1,610 criteria; native 78 orders / 70 surfaces / 305 operations. This slice cannot assert GLOBAL_RELEASE.

**Lease terminal:** correction epoch `native-platform-fixture-e1-browser140` — `ARTIFACT_READY`; authoring surrendered for follow-up only after S0/consumer acceptance; further writes require a new explicit fenced epoch. Native Goal remains paused, no merge/dev/deploy/force/reset.
