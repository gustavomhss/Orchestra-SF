# Mission 176 — A11 SelectionResolved causal fix and terminal handoff

**Status: ARTIFACT_READY, not yet integrated or qualified.** Epoch `native-fix-e1-browser176`; actor ChatGPT, effective model GPT-6, authenticated GitHub login `gustavomhss`, session ID **not exposed**. Same branch `sf-ux-a11` and [PR #143](https://github.com/gustavomhss/Orchestra-SF/pull/143). Previous `ux-native-a11-e1` future write authority fenced; no claim that an old runtime died. ACK [ACK-176.json](./ACK-176.json). Native Goal paused; `GLOBAL_RELEASE=false`.

## Causal diagnosis and code fix

Real hosted [compiler163 run43766055614/job132971280139](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43766055614), W `690a34cdd81c12d7311f3717c19679b950276161` tree `07133fe09922121f3cca3bffd6b4463053b48ece`, reports `packages/schema/src/sucafina/operations.ts(297,59) TS2552 Cannot find name SelectionResolved`. The declared schemas are **different**: `SelectionResolvedCAP11` has `opsYear/operationsMonth`; `SelectionResolvedCAP12` has `secYear/securityMonth`, each requiring `year/month`. CAP12's existing projection uses those aliases, so the CAP12 *output* must reference `SelectionResolvedCAP12`, not CAP11 or an invented general type.

Complete one-line patch and inert 162 consumer afterimage: [PATCH-162.json](./PATCH-162.json).

```diff
diff --git a/packages/schema/src/sucafina/operations.ts b/packages/schema/src/sucafina/operations.ts
--- a/packages/schema/src/sucafina/operations.ts
+++ b/packages/schema/src/sucafina/operations.ts
@@ -294,7 +294,7 @@ export const SfDomainPageCap12 = {
     Schema.Struct({
       status: Schema.Literal("ok"), context: SfContextStamp,
       value: Schema.Struct({
-        capabilityId: Schema.Literal("CAP12"), selection: SelectionResolved,
+        capabilityId: Schema.Literal("CAP12"), selection: SelectionResolvedCAP12,
         data: SfOperationsPageData.CAP12, versions: Versions,
         allowedActionIds: Schema.Array(Schema.String),
       }),
```

The frozen catalog blob `31dbec1726fd8147156b01dc545726650ffd49e1` confirms 16 A11 bindings: two GET page projections and 14 existing authenticated POST commands. Read the current client and server-only producer, source declarations and original A11 tests. This code-only contract reference fix changes neither a runtime branch nor original Request, tenant/installation/project/host/principal, owner, policyVersion/accessRevision, authorization, source version revalidation, CAS/idempotency, field selection, null/zero or command payload. No `any`, cast, stub, alternative schema, Effect upgrade, test/assertion/timeout/fixture changes.

## Source and consumer lineage (exact Git identities)

| Stage | Commit | Tree | `operations.ts` blob |
|---|---|---|---|
| Fenced branch initial | `9344dda9486e803de2fae26179dada71b2f20314` | `7bec6f0ae6ecfe580dfaa0a9c1b111aa9cba95b8` | `d1f3b9b23c4d4ee2442f293ddb0816063062b63f` |
| ACK before edit | `5ce441418d044a94d70d3433f89bd33e3182daca` | `27fb42d2c9f279afccf3bc894db4245365930a0b` | same preimage |
| Code fix (remote readback) | [`05d1687e8697d204ce970da7d20363359c8243ca`](https://github.com/gustavomhss/Orchestra-SF/commit/05d1687e8697d204ce970da7d20363359c8243ca) | `73c21bed5ff07df16ba0f476b440b05366c178e5` | `d2f9e89c5815dff4207769f75c263d908c474ca1` |
| `sf2-stack` consumer preimage | `913b6b8f143e6c3e869eee293d02f04259c7cdd1` | `99d4788774ce548d4cd64a96c0f2481db1fb15eb` | `d1f3b9b23c4d4ee2442f293ddb0816063062b63f` |
| Consumer **inert** candidate | **no commit; NOT APPLIED** | `ae2ce8d5f4212383df483cd59dbc1f3b1c4f76ee` (created Git tree only) | proposed `d2f9e89c5815dff4207769f75c263d908c474ca1` |

Existing `modules/sucafina/Sucafinav1/test/native-ui-contract/operations.test.ts` stays unmodified, pre/post blob `0a692b53eadcab8eb619ee49298c3fa97516f70a`. It already covers CAP11/CAP12 selection/output/version, null/zero/absent, redaction, closed command input, current source and client forwarding; a test mirroring the fixed symbol is not useful. The source post-blob was re-read and exact one-line diff confirmed by GitHub after commit, but **no local tests, parser, build or typecheck** were run.

## Acceptance/failures/qualification

- **A11-AC01** — page CAP12 uses the declared CAP12-specific resolved selection and retains existing `context`, `data`, `versions`, `allowedActionIds`; static source repair done, hosted execution **NOT_RUN**.
- **A11-AC02** — 16 closed operation IDs, input field constraints and negative tests unchanged; no generic opaque dispatch. Hosted **NOT_RUN** on changed candidate.
- **A11-AC03** — original authenticated Request, tenant/owner/current source and version/CAS checks and no auto mutation retry untouched. Hosted **NOT_RUN** on changed candidate.
- **Compiler163 actual W690a:** 16 selected checks, 10 exit zero, 6 nonzero; typecheck schema/client/sucafina/CLI/app failed with other genuine independent owner errors; guards failed 66 GATE + 141 WARN, no waiver. SDK generation succeeded on W690a but not yet consumed; prior compiler PASS does not transfer to new W. Source: `sf-compiler-checks/receipts/validation163/{RESULTS-163,GUARDS-163,HANDOFF-163}`.
- **Product CI164 actual W6d42:** [browser run43766970018/job132974180913](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43766970018) had four files selected and failed 3 outer browser cases due to F03/S01/S05, unrelated to A11. Historical scoped 49/49 pass belongs to a different W; not A11 proof. Source: `sf-ci-validation/receipts/validation164/{FINDINGS-164,RUNS-164,HANDOFF-164}`.
- **Mission176 checks:** only remote source/commit/HEAD/PR readback + GitHub CAS confirmed. New hosted compiler `NOT_RUN`, product A11 test `NOT_RUN`, local checks `NOT_RUN`, EPIC/final8 `NOT_RUN`, Omni proof `NOT_RUN`. This is source `ARTIFACT_READY`, not product qualified.

## Exact routing after 162 applies on coherent current W/tree

**162 / PR#65 sole integrator:** Re-read actual `sf2-stack` current HEAD/tree + target blob; if already `d2f9e89c...` record `CONSUMED_WITH_PROOF_POINTER` without duplicate. If old preimage still `d1f3b9b...`, apply **only** this complete patch or exact post-blob to latest tree, GitHub MCP expected-head CAS/force=false. If drift, reconcile without overwrite/reset. Record actual consumer post-commit/tree/blob and an integration ACK. Do not merge entire author branch or alter unrelated shared code.

**163 / PR#107 compiler/SDK/guards owner:** Once 162 publishes a new *actual* integrated W/tree containing post-blob `d2f9e89c5815dff4207769f75c263d908c474ca1`, pin complete new source/runner/config/fixture fingerprint and de-duplicate. Request the existing compiler-only package commands `cd packages/schema && bun typecheck`, `cd packages/client && bun typecheck`, `cd modules/sucafina && bun typecheck`, `cd apps/cli && bun typecheck`, `cd packages/app-shell && bun typecheck` as impacted consumers, preserving existing guards/SDK canonical workflow and invalidation. Verify `TS2552 operations.ts:297` absent in actual hosted logs; independent source errors may still fail. Never rerun unchanged failed W690a or hand-edit SDK.

**164 / PR#106 sole hosted product CI dispatcher:** This is a type-only reference fix, not license for whole browser suite. When a genuinely changed integrated W is ready for A11 product qualification, re-use the existing `modules/sucafina/Sucafinav1/test/native-ui-contract/operations.test.ts` (unchanged blob) under existing `.github/workflows/test-ci.yml`: `package=sucafina`, `directory=modules/sucafina`, `runner=bun`, `args=["--timeout","120000","Sucafinav1/test/native-ui-contract/operations.test.ts"]`, `env={}`, Ubuntu24.04/Bun1.3.14 as observed. Confirm actual test selection, run/job W/S and outcome or record `NOT_RUN`. De-duplicate by full source/config/fixture input fingerprint; do not rerun unrelated failing browser cases without causal owner repair.

Shared seam patch is complete but **inert**; 162 alone applies. 163 alone compiles/generates/guards; 164 alone executes focused hosted product tests. No extra dispatcher, tests added, dev merge, deploy, Azure, engine, restart or secrets. AM01–AM06, independent FINAL reviews and same-C final gates stay separate. Native Goal **paused**, `GLOBAL_RELEASE=false`.
