# Intelligence caller compatibility for C12 intake

Read-only review against preserved W12 `cccd00c568aea65bb0c1b5cb4a82c2a236c7e775`, Compose `35b9fd4f532abeb1058f00281d4ad8885ca9966f` and Intelligence PR36 `c21a990c57b714cd60bb7f915beb6be51acbafdb`. Remote files were read by GitHub MCP and local preserved files by pinned git object reads with lazy fetch disabled. No tests, checkers, CI queries, dispatches or product edits occurred. Exact SHA256/bytes and immutable URLs are in the companion JSON.

## Exact callers

| File | Preserved W12 blob | Compose35b9 blob | Intelligencec21 blob |
|---|---|---|---|
| `wp13/candidates-store.test.ts` | `0ffe2ce818f32f40662fd0c56ea8ca778644f7db` | `fbecfabcd66aab023279d9b7ee3c14beccf1fcad` | `fbecfabcd66aab023279d9b7ee3c14beccf1fcad` |
| `wp13/sensitivity-units-boundary.test.ts` | `2aa8d065edd25c94a90b84a64839c0fc72dce5c2` | `f81469e41928f9fe1d2fbc2303158cfe4e5b5809` | `dbbe5f7dc64d3accee536b38ae4196034562cf8f` |
| `wp13/production.test.ts` | `ec3969a0f9585a6bf02a8037d13c21ffaf78fed9` | `af3d903b5cf476649d213a417ea673f8114071ee` | `af3d903b5cf476649d213a417ea673f8114071ee` |
| `wp13/stored-store.test.ts` | `78e958d481319c3fdaf5871945be1898c88aa67f` | `601af4ad1f504c9c7be47dce4e72d84587a38856` | `601af4ad1f504c9c7be47dce4e72d84587a38856` |
| `wp14/source-access-atlas.test.ts` | `259cdbcdb90627d57a6ad10b6b323fe0b14bcdb1` | `d31c8dc6867bcbb7f389bde79df644a5133de51a` | `d44e2088e04ba96fa5eb88256f0ffc0a4517b463` |

## Operation admission

Compose `case-port.ts` blob `67203e058f6e08d9e32e0c51e0b1a01e5fadf322` makes `verifyScenarioOperations(value, context)` mandatory (line 20) and evaluates it before and after the protected read (80, 85).

The three WP13 files candidates-store, production and stored-store differ from the preserved versions only by an added access-boolean callback. Removing that property reproduces the exact preserved bytes. Therefore their original assertions and consumers are intact, but the callback does not verify an operation. candidates-store and production seed nonempty `replace` operations; sensitivity does too. stored-store seeds no operations and synthetic output provenance, so its original scope remains persisted-output authorization, not native execution or operation admission. A narrowly rejecting empty-operation verifier is feasible for that scope, but it is not what these published boolean callbacks currently express.

The sensitivity file upstream folds four named tests into one. Seventy-four old expect-bearing lines become seventy-five. Five unmatched expressions are variable renames; the initial Portfolio success check is subsumed by the same persisted Portfolio check; two separately scoped ID-no-allocation assertions become one assertion around Portfolio, comparison and sensitivity replay together. Three negative assertions are added. The substantive old conditions are still represented, but three original test titles and isolation are lost. Do not overwrite the four preserved tests with that monolith. Publish an additive owner patch retaining their assertions and wiring the real operation verifier instead.

## Atlas event source access

Both published WP14 fixtures move from the old `{cases}` factory to `{state, authorizeCase, authorizeEvidence}`. The main event fixture uses a fail-closed verifier restricted to empty alternative/choice operations and zero prepared changes; its seed satisfies that restriction. Participant membership is read from the protected case, nested evidence is resolved through real Dashboard/event ports with ancestry tracking, and an evidence revocation denies reads. The latest Intelligence version additionally revalidates the host in its case authorizer.

The original cross-principal original-source, continuity, forgery, revocation and recall assertions remain. The scanner version now comes from a real pinned scanner process rather than an environment string. The old committed expectation now applies to a nested ledger event and is followed by exact replay assertions. These changes add real scanner/SQLite/process-restart scope; they do not create a native SessionV2 witness.

There is an additional incompatible caller: Compose's required `test/product/wp14/atlas-restart-reader.ts`, blob `9268b8797955057559bf22c0625b3b302c49cfe5`, is absent in W12 and omits `verifyScenarioOperations` at line 53. With Compose case-port this violates the constructor type, and a runtime case read reaches an undefined callback and is caught as unavailable. Intelligence publishes helper `f4fcfa9f961f5087eead1e4ce54296625c93172d`; line 74 adds the explicit empty-operation verifier, and its real Atlas ACL avoids reopening all evidence as an ACL substitute. This is a published narrow repair, not proof that the rest of a mixed closure is compatible.

The latest Intelligence WP14 test also passes `authorizeRecallCase` (lines 119 and 149) to source access. Compose source-access blob `41741c5131ea66242c881126c22c6d03cfd9c3c3` has no such parameter. Intelligence source-access `e4e648feecb4e12ace3da41e1b91c45b527c7247` adds it and the related request/binding fences. Copying the latest fixture alone into a Compose-only closure would therefore be incompatible. It also adds a real C17 document test with dependencies on WP06 runtime, document authority/services, BusinessServices and ledger outbox. Those imports must be resolved as a separate closure; they are listed in the JSON.

The new fixture and restart helper require `case-features.ts`, absent in W12 and published at Intelligence blob `ff95a311352c0c04b9ca42ab6523783284a8001e`.

## Intake implication

The evidence does not support treating the four WP13 access booleans as a real semantic compatibility solution. The published WP14 helper and source-access fixes are available, but selecting them requires their precise compatible dependencies and preservation of the original test scopes. This is a concrete contract/assertion boundary, not a rejection based on closure size. The consuming owners should publish additive corrections or provide a complete compatible input manifest; no foreign paths were overwritten by this review.
