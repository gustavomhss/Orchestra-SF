# Composition with qualified dev `2eeb1142`

Status: **COMPOSED_AND_VERIFIED_PENDING_USER_REVIEW**. Final technical candidate `0550c4bb8fc3b4b4e68561777010ca03483e2391` and functional product `e5494ff044ee46cdd80c1d754131c284538d4d31` incorporate dev `2eeb114266f8b9c9df9bb8f78a02ccf242cdc68b` through composition `d179d4abbc4c189d9135e5cc2d38487b6e4ba99c`. Since the actual PR #587 merge `d9ab14b6d9cab74843b0689d5d67d1c70d45cc02`, 21 upstream commits changed 80 distinct paths in three stages. Stage path counts are not added as distinct-file counts because some paths recur.

## Stage one — dev3ce1acd0

Ten existing upstream commits changed 46 paths. Forty-five paths had no intersection with the redesign and were copied by their exact upstream blob hashes. The sole overlapping path was `apps/cli/src/sucafina-product/host-context.ts`: upstream adds FSUtil to the node dependency list, acquires its service in the outer effect and removes the inner acquisition. Those exact changes were composed with this block's native source-health installation; neither change was discarded.

| Upstream change | Commit |
| --- | --- |
| fix(core): enforce recorded session permission denies (#589) | [eb381dcc](https://github.com/gustavomhss/Orchestra-SF/commit/eb381dcc7ccdd4b965adf360241e67a1714810b6) |
| fix(cli): resolve Sucafina typecheck diagnostics (#591) | [0a3e3408](https://github.com/gustavomhss/Orchestra-SF/commit/0a3e3408f4321021ced639cc69172b82d95ed157) |
| fix(sf): resume Apply with the original receipt (#590) | [3aff9018](https://github.com/gustavomhss/Orchestra-SF/commit/3aff901838a4eafc515e6a72faf14b5c6930eeba) |
| test(sf): reproduce purchase confirmation through Gateway (#592) | [6a644b1e](https://github.com/gustavomhss/Orchestra-SF/commit/6a644b1efeba283b1d5eed57f97df4e29b80bc80) |
| fix(sf): clear Sucafina typecheck diagnostics (#595) | [3e9c0210](https://github.com/gustavomhss/Orchestra-SF/commit/3e9c0210004ee3a8cdc797efc92dcd5f801ced75) |
| feat(sf): observe the Finance pair in a readonly scope (#596) | [d73672b2](https://github.com/gustavomhss/Orchestra-SF/commit/d73672b2293ee3d2db790b976301ced63b169cc3) |
| fix(sf): observe the exact portfolio coverage scenario pair (#597) | [bd1d3fae](https://github.com/gustavomhss/Orchestra-SF/commit/bd1d3fae5162f3a97cb48181f729db6d62a3955b) |
| feat(sf): scaffold reusable Gateway packs and synthetic proof (#598) | [385255c2](https://github.com/gustavomhss/Orchestra-SF/commit/385255c2c3466a298f4caaee537be0b8c9381203) |
| feat(sf): add read-only supplier review Gateway pack (#599) | [024f1ba6](https://github.com/gustavomhss/Orchestra-SF/commit/024f1ba6c739d448eb9c31c3dbc2d0dbc5f9fe4a) |
| test(sf): align Finance pair fixture with persistence contracts (#600) | [3ce1acd0](https://github.com/gustavomhss/Orchestra-SF/commit/3ce1acd0a60d9b3685f55ae58f4d99c7d13cd5d1) |

## Stage two — dev699ad1a1

Four further upstream commits changed 26 paths. Twenty-five non-overlapping paths were copied by their exact upstream blob hashes. The sole overlapping path remained `apps/cli/src/sucafina-product/host-context.ts`. All six upstream hunks matched exactly once and were applied to the composed host context, preserving the stage-one FSUtil acquisition and all native Decision, Analysis and Work/Search source-health installation. This brings in the upstream reviewer recall from prepared human selection and its guarded token executor.

| Upstream change | Commit |
| --- | --- |
| fix(claude-code): deny mapped calls without a text resource | [42ba9ce1](https://github.com/gustavomhss/Orchestra-SF/commit/42ba9ce19d22725c918ed47a7ab55718feed2309) |
| Merge pull request #602 from gustavomhss/claude-resource-required | [82670e1e](https://github.com/gustavomhss/Orchestra-SF/commit/82670e1e919bdf3f859bcdb2214e9eac0d194ea1) |
| feat(sf): add read-only contract review Gateway pack (#603) | [505698c9](https://github.com/gustavomhss/Orchestra-SF/commit/505698c9b7ce0a25d4327d46a2866a0e49b4c282) |
| fix(sf): autorizar recall do reviewer pela seleção humana (#594) | [699ad1a1](https://github.com/gustavomhss/Orchestra-SF/commit/699ad1a1f837ef4a918b73ba89b06aa9cc0a10db) |

## Stage three — dev2eeb1142

Seven further upstream commits changed 18 paths. The current candidate's 249-path delta from dev699ad1a1 had no intersection with those 18 paths; the comparison was not truncated. All 18 paths were copied by exact upstream blob SHA. This preserves the upstream purchase Gateway QA mount support, session adoption/scheduled receipt checks and desktop Live IPC sender validation. No native Decision case source was changed by this stage.

| Upstream change | Commit |
| --- | --- |
| fix(sf): support the QA mount in the purchase Gateway (#604) | [721c4247](https://github.com/gustavomhss/Orchestra-SF/commit/721c42478a61185a92eade55d8390227904de522) |
| fix(core): enforce session adoption identity | [653100ff](https://github.com/gustavomhss/Orchestra-SF/commit/653100ff0bd58bfd0b5621bf96c33f4f8d43a3df) |
| fix(core): require exact scheduled prompt receipts | [149572ef](https://github.com/gustavomhss/Orchestra-SF/commit/149572ef27bf44d2f92e0cf5bfd4144e635dbb00) |
| fix(core): reject conflicting scheduled run retries | [1f4701af](https://github.com/gustavomhss/Orchestra-SF/commit/1f4701afb115d1c39bfb3ae4e4438c82bc7267bb) |
| Merge pull request #605 from gustavomhss/session-adoption | [9effb3cb](https://github.com/gustavomhss/Orchestra-SF/commit/9effb3cbc91f87bcca6c8e76705f5fb8e856e43e) |
| fix(desktop): validate Live IPC senders | [5f40d11e](https://github.com/gustavomhss/Orchestra-SF/commit/5f40d11e0795c4103f4b238c359decb652431752) |
| Merge pull request #606 from gustavomhss/live-ipc-sender | [2eeb1142](https://github.com/gustavomhss/Orchestra-SF/commit/2eeb114266f8b9c9df9bb8f78a02ccf242cdc68b) |

No workflow, guard, allowlist or permission mechanism was changed by the redesign. The upstream changes above were preserved by exact blob or exact hunk composition. Repository work used GitHub MCP; executable verification uses disposable test-ci snapshots only.

## Hosted verification

| Scope | Run | State |
| --- | --- | --- |
| Application/E2E/full CLI types, exact-dev guards, palette parity and 89 regressions | [44972927162](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44972927162) | PASS; 15 checks / 89 regression cases; product 0550c4bb / dev2eeb1142 |
| Planner and previous six native areas | [44965221018](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44965221018) | Workflow and Run tests step PASS; combined log unavailable |
| Procurement five-area journey | [44965165654](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44965165654) | PASS; 4 original journeys, 11 POSTs/readbacks |
| Work, Search and Saved Views | [44965705732](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44965705732) | PASS; 3 original journeys |
| Decisions corrected journey | [44972048219](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44972048219) | PASS on product e5494ff0; 41 captures, 56 successful source reads and 21 reads after 300 seconds |

The combined Planner/previous-six workflow on the first composition (dev3ce1acd0) completed successfully, including the original test step and evidence upload. Two MCP attempts to retrieve its decoded log returned Transport closed. We do not infer a combined test/capture/write/error count. The [composition manifest](evidence/composition/manifest.json) records artifact identity and the exact selected specs; separately read Planner9 and Regression2 evidence retains its own source snapshots.

Gate16 passed the complete third composition before the case-scope correction. Gate17 then passed the corrected product and both new case-scope tests (81 assertions), while Decisions14 passed the complete browser journey with the same functional code. The additional changes between browser parent e5494ff0 and technical parent 0550c4bb are tests/documentation only. All temporary diagnostic/relay instrumentation from Decisions12/13 remained confined to disposable snapshots; final source inspection found no markers or temporary CI wrapper in the product.

Historically, Gate15 tested the complete second composition, the final UI41 layout adjustment and the corrected diagnostic URL accessor. Application declarations, E2E semantics, full CLI types, exact-dev guards, palette parity and all 87 regression cases passed. The earlier Gate14 failure was confined to the new E2E diagnostic passing a URL method instead of calling it; the one-line correction is verified by Gate15.

The current composed full CLI typecheck passed with zero diagnostics. Its earlier seven diagnostics belonged to the previous dev baseline and were fixed by the incorporated upstream commits. No suppression or compiler flag change was used to accept them. Historical failures remain in [attempts.json](attempts.json).

The copy audit remains valid through technical candidate `0550c4bb8fc3b4b4e68561777010ca03483e2391`: none of its ten catalog paths changed after the audited `0f762e71` source. The ten catalogs preserve 574 existing English literals, add 9 English literals with explicit Portuguese, and contain 583 current keys with no missing Portuguese literal. Other source paths are not counted by this catalog audit.

## Later dev observation

After qualification, dev advanced to `8bd7645767deb85b286b046a52a4e9f1db100262` through PR #607 (two commits). Its three changed paths are apps/desktop/src/main/index.ts, apps/desktop/src/main/wsl/ipc.ts and apps/desktop/src/main/wsl/ipc.test.ts. The exact comparison against the 251 paths in the qualified own delta was untruncated and found no overlap. These changes are confined to desktop WSL IPC sender validation and its tests, outside the native Sucafina/browser/CLI paths qualified here.

The final candidate retains its explicitly tested dev2eeb base. PR #607 was not incorporated or attributed to Gate17 or Decisions14. This observation prevents an unrelated advancing dev branch from being represented as an already tested composition.

The candidate is not merged and has no user acceptance for this block. Final qualification and material coverage limits are in [VALIDATION.md](VALIDATION.md).
