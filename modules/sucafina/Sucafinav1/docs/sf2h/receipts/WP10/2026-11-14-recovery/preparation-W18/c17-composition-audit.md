# C17 historical composition — builder audit

Status: own composition implemented and source-audited; product execution, hosted candidate CI, native acceptance and independent campaign review remain unexecuted by this builder. This document does not count as any of the three independent reviews.

## Exact inputs and boundary

The immutable base is W17 `2ec17b2c8204d5e953eec3186b7e236c0faaad47`, tree `526f67866223b8b73e1bcae16e45ec9377b1af2e`. The incoming published group is PR32 at `35b9fd4f532abeb1058f00281d4ad8885ca9966f`. Every fetched source was checked by Git blob identity and SHA256. `selection.json` records the source path, commit, blob, SHA256, local path, selection mode, reason and resulting own-file hashes. `diffs/` contains complete PR32-to-candidate and W17-to-candidate differences.

Only the five authorized own host files and three authorized own fixture/test files were written. No foreign product source, previous receipt, archived input, branch or remote object was changed by this builder. The exact foreign BCS payload remains at `incoming/c17/business-context-pr32.ts` for the root builder to compose through the intake.

## Finding and composition

R1-W17-CALCULATION-HISTORY-01 concerns an actual gap between strict fresh C17 replay and Analysis lifecycle reentry. W17 reopens a persisted request/result against the original case version. When the same physical case advances from v1 to v2 while its ledger retains the v1 calculation, the fresh request reader correctly refuses the old version. BCS therefore cannot project the retained calculation, and case projection fails before the stale lifecycle can settle.

The PR32 historical adapter supplies a separate proof: the exact calculation must belong to an actual current ledger event, the current principal must still participate in the same physical case, an original capture must be read through canonical Atlas, persisted result/request bytes must match, and canonical record-only replay must reproduce the exact original calculation reference. It returns `historical`, keeps the original projection/reference, and explicitly reports the case-version difference. It neither creates a result/request nor promotes the original to fresh.

The published group alone had a second host composition conflict. Its current-case replay entered `withCalculationCase(v2)`, but Analysis reentry deliberately retains its original private selector v1. Once that selector was installed, the fresh scope correctly refused v2. The own overlay therefore adds a distinct lexical historical scope. It never writes or substitutes `caseBindings`. It binds the original Request, trusted binding, original scope identity, current case identity and current C08 membership before/after replay; native calls still require the exact current native-bound version. The scope closes in `finally` and rejects use after closure.

Historical coverage is constructed privately and passed only to a dedicated record-only historical replay port. The exposed Planner and baseline registry retain W17's strict `selectedCase` route. A new fresh operation cannot inherit current v2 through the historical coverage route. The scope checks Request/binding and the original scope identity again at coverage entry and final egress. The producer then checks protected capture/state/source/day continuity after that egress.

## Selected source group

| File | Treatment | Decision |
|---|---|---|
| `planner-calculation-history.ts` | Exact PR32, blob `9805676b50cb5d12f37a4a91350f01ba227a168f` | Protected original + actual ledger + read-only stores + canonical record-only replay. |
| `recorded-planner-operation-access.ts` | Exact PR32, blob `38b832f73b0eaa615d5fdf2d7838b0e5635440fa` | Reads only already stored scenario/operation selectors after record-source drift; proves original projections and current C08 membership twice. |
| `scenario-operation-access.ts` | Exact PR32, blob `aa1be4cfb8f501b3fccddb269efce5567bcdd447` | Uses that reader only for stale Planner selectors, preserving Request/binding and final source fences. |
| `planner-calculation-services.ts` | PR32 plus own overlay | Keeps fresh record-source validation and full nested BCS replay; adds the separately supplied historical scope and coverage port. |
| `business-services.ts` | Required PR32 wiring over W17 | Keeps W17 dashboard evidence, `basePersist` canonical `replay: planner`, fresh selectors and scope retainers; adds only the private historical composition described above. |
| `planner-recorded-history.test.ts` | Exact PR32, blob `432ca1f9c72fbbb3d278a8cb687b9c65ddaadb0a` | Two real producer/store/Atlas stored-operation history scenarios. |
| `planner-calculation.test.ts` | W17 plus three PR32 cases and one own lifecycle case | All 16 prior test cases remain byte-for-byte; candidate declares 20 cases. |
| `financial-composition-fixture.ts` | Exact PR32, blob `febb795303b8c4ada5fb6f39d6373667ee71dac1` | Adds only optional `atlas` namespace support, retaining original grants, optional `humanActions`, and authority guard wiring. |

The complete published `business-services.ts` was not copied. Its full replacement would discard W17's dashboard evidence wiring and canonical base-persistence replay. Those changes were rejected; their intact W17 forms remain in the own overlay. No selected producer was found to require relaxed fresh equality.

## Minimal foreign dependency

The only new foreign blob required by this group is:

| Path | Published commit | Git blob | SHA256 |
|---|---|---|---|
| `modules/sucafina/Sucafinav1/product/host-binding/business-context.ts` | `35b9fd4f532abeb1058f00281d4ad8885ca9966f` | `5cca27ce239c92a8e3c9f9f92f816f5224562904` | `9791fd4c605693711a4508b3b496c0fb67a407c1009d734408659ed10664fefc` |

This source adds `calculationHistorical`, accepts only an identical calculation reference for historical continuity, checks two separately reopened historical proofs before disclosure, and uses `freshPlanner` in the fresh recall scope. It preserves the existing source/Request/binding fences. The builder has not applied it.

The historical calculation matcher, decision result store, scenario request store, canonical calculation producer and Atlas recall scope are already composed in W17. Their current bytes were compared against the immutable frozen W17 snapshot. `selection.json` pins those five dependencies to W17; no additional foreign replacement was found necessary.

## Meaningful prepared coverage

The original 16 W17 calculation cases remain an exact suffix of the file, SHA256 `136055f24c2cb23312aee6cb7355d6d4c5208d9e3c17fd8ef4929a97ac435be2`. This preserves the eight late-drift counterproof variants, fresh UI/BCS checks, lexical recall isolation and original time budgets. The separate ancestry suite remains unchanged and is selected for hosted regression coverage.

The three incoming history cases cover protected-original retention after case advance; absent/duplicate ledger event, incarnation, request/result/capture and source corruption; principal revocation and Request/lease loss. The own additions also assert from inside historical replay that exposed fresh selectors/baseline coverage remain unavailable. The unselected UI case additionally checks the exposed Planner coverage route stays unavailable.

The fourth new test, `Analysis lifecycle reentry preserves a real historical calculation without upgrading its original case selector`, uses:

1. A real SQLite store and real product authority, canonical Planner result persistence, actual scenario request registration, real Atlas/scanner capture emission, and SQLite/Atlas reopening.
2. An explicit fixture ledger event persisted through the real C08 transaction. This is a durable fixture, not evidence that a C09 human acceptance workflow ran.
3. Explicitly **unexecuted native lifecycle metadata** from the existing WP12 fixture. No Task, Session, model or observed skill load is claimed.
4. A real C08 transaction that advances the same case from v1 to v2 while retaining the calculation/ledger and admitting the fixture lifecycle record.
5. Production `createSfAnalysisRunContext`, `createSfStaleAnalysisAccess` and `createSfRunStore.preserveStale`, with real BCS resolution and the original v1 selector. The assertions require historical C17 state, unchanged reference, explicit version difference, unavailable fresh selectors/issuance, and preserved output digest/native metadata.
6. Actual Request/run-scope cleanup and revoked-principal reentry refusal without changing the preserved output.

The lifecycle case remains within the existing 105000 ms cooperative / 120000 ms outer budget. The two recorded-operation cases retain their published 165000/180000 ms budgets. These are prepared tests, not passing evidence. No local product test, typecheck, build, browser, formatter or product import was run.

## Limits and required next steps

Historical calculation support is intentionally conservative. Its closure must consist of records whose current source projections remain fresh; nested/mixed calculations, unsupported assumptions/replacement selectors and changed-source historical calculation replay are refused. The separate recorded-operation reader can authorize an already stored Planner operation after record-source drift; that is not authority to recompute or apply a fresh scenario. Its WeakMap recursion sentinel contains no successful grant and overlapping same-context history reads may fail closed.

The root builder must compose the exact BCS blob, freeze/publish the successor, and run the selected hosted candidate gates. The selection includes calculation/history, stored-operation history, fresh ancestry, Analysis run context, the root-owned historical-memory suite and dashboard review history. Candidate typecheck and the required ownership/Atlas/spawn guards remain root CI responsibilities. Run IDs, product/tree/snapshot bindings and terminal results must come from those runs; this package claims none.

R1 must reassess the lifecycle finding against the published successor. R3 must reassess temporal/source/binding counterproofs, and the campaign still requires all three independent reviewers. This builder audit and the read-only helper audit are not substitutes for their verdicts. Native/global acceptance remains unexecuted.

## Review files

- `selection.json`: exact pins, modes, output hashes, retained dependencies, CI paths and evidence boundary.
- `history-safety-audit.md`: read-only builder source audit of PR32 history/operation adapters and BCS.
- `diffs/*.w17.diff`: complete own changes against W17.
- `diffs/*.pr32.diff`: complete own overlays against the exact published PR32 bytes.
- `baseline.json` and `baseline/`: pre-edit own source hashes and bytes.
- `prepare-selection.py`: deterministic byte/hash/diff packaging only; it never imports or executes product code.
