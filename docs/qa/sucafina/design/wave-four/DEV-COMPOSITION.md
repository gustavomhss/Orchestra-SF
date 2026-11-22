# Composition with dev3ce1acd0

Status: **IN_PROGRESS**. Candidate `331cafc50bee2112f6366ff428658de938c6f58e` incorporates upstream dev `3ce1acd0a60d9b3685f55ae58f4d99c7d13cd5d1` as a commit parent. The prior incorporated dev was `d9ab14b6d9cab74843b0689d5d67d1c70d45cc02`.

## Source reconciliation

Ten existing upstream commits changed46 paths. Forty-five paths had no intersection with the redesign and were copied by their exact upstream blob hashes. The sole overlapping path was `apps/cli/src/sucafina-product/host-context.ts`: upstream adds FSUtil to the node dependency list, acquires its service in the outer effect and removes the inner acquisition. Those exact changes were composed with this block's native source-health installation; neither change was discarded.

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

No workflow, guard, allowlist or permission mechanism was edited for this reconciliation. Repository work used GitHub MCP; executable verification uses disposable test-ci snapshots only.

## Hosted verification

| Scope | Run | State |
| --- | --- | --- |
| Application/E2E/fullCLI types, exact new-dev guards, palette parity and84 regressions | [44965223657](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44965223657) | Running;13 checks |
| Planner and previous six native areas | [44965221018](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44965221018) | Running;4 original journeys |
| Procurement five-area journey | [44965165654](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44965165654) | Running;4 original journeys |
| Work and Decisions | Pending final correction and composition rounds | Earlier snapshots kept separately |

The earlier fullCLI audit failed with exactly seven diagnostics present in the old dev baseline. Upstream now contains repairs for those diagnostics; a green composed fullCLI result must be observed before marking that issue resolved. Historical failures remain in [attempts.json](attempts.json).

The copy audit remains valid through product `27079d76cafa63eda998bcd84fabb229e584a64d`: none of its ten catalog paths changed after the audited `0f762e71` source. The ten catalogs preserve574 existing English literals, add9 English literals with explicit Portuguese, and contain583 current keys with no missing Portuguese literal. Other source paths are not counted by this catalog audit.
