# Composition with dev699ad1a1

Status: **TECHNICAL_PASS; DECISIONS_BROWSER_PENDING**. Product `218a5ee39935336c88abeb92b0a4d2cc980f21de` incorporates upstream dev `699ad1a1f837ef4a918b73ba89b06aa9cc0a10db`. Composition commit `cb5b92074c64b7087abeeba75a1effe52b01eff5` retains that upstream head as a parent. Since the actual PR #587 merge `d9ab14b6d9cab74843b0689d5d67d1c70d45cc02`, fourteen upstream commits changed 65 distinct paths in two stages. Counts below distinguish the stages from the cumulative set.

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

No workflow, guard, allowlist or permission mechanism was edited for this reconciliation. Repository work used GitHub MCP; executable verification uses disposable test-ci snapshots only.

## Hosted verification

| Scope | Run | State |
| --- | --- | --- |
| Application/E2E/full CLI types, exact-dev guards, palette parity and 87 regressions | [44968622344](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44968622344) | PASS; 14 checks / 87 regression cases; product218a5ee3 / dev699ad1a1 |
| Planner and previous six native areas | [44965221018](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44965221018) | Workflow and Run tests step PASS; combined log unavailable |
| Procurement five-area journey | [44965165654](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44965165654) | PASS; 4 original journeys, 11 POSTs/readbacks |
| Work, Search and Saved Views | [44965705732](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44965705732) | PASS; 3 original journeys |
| Decisions | [44968620170](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44968620170) | Running with positive original-content assertions and safe refusal diagnostics |

The combined Planner/previous-six workflow on the first composition (dev3ce1acd0) completed successfully, including the original test step and evidence upload. Two MCP attempts to retrieve its decoded log returned Transport closed. We do not infer a combined test/capture/write/error count. The [composition manifest](evidence/composition/manifest.json) records artifact identity and the exact selected specs; separately read Planner9 and Regression2 evidence retains its own source snapshots.

Gate15 tests the complete second composition, the final UI41 layout adjustment and the corrected diagnostic URL accessor. Application declarations, E2E semantics, full CLI types, exact-dev guards, palette parity and all 87 regression cases passed. The earlier Gate14 failure was confined to the new E2E diagnostic passing a URL method instead of calling it; the one-line correction is verified by Gate15.

The current composed full CLI typecheck passed with zero diagnostics. Its earlier seven diagnostics belonged to the previous dev baseline and were fixed by the incorporated upstream commits. No suppression or compiler flag change was used to accept them. Historical failures remain in [attempts.json](attempts.json).

The copy audit remains valid through product `218a5ee39935336c88abeb92b0a4d2cc980f21de`: none of its ten catalog paths changed after the audited `0f762e71` source. The ten catalogs preserve 574 existing English literals, add 9 English literals with explicit Portuguese, and contain 583 current keys with no missing Portuguese literal. Other source paths are not counted by this catalog audit.

The candidate is not merged and has no user acceptance for this block. Final qualification belongs in [VALIDATION.md](VALIDATION.md).
