# Mission80 — canonical C10 correction

## Defect and correction

The source62 diagnosis identified a mismatch between original assessment and reassessment of normalized coverage. The causal Actions run R1 now reproduces it on the unchanged product blob `e913189a675bbcfa81a657f58d2255eac3b6dce2`: an included component whose amount is null becomes a pending row, which has no componentRefs in the canonical contract. The old assessment collected included references from the pre-normalized input; a later reassessment collected none for that pending row and added `uncategorized-component`. Identical financial inputs therefore produced different assessments.

The correction collects included references from the normalized entries and only establishes an orphan once the inventory has no pending row. Pending inventory still prevents completeness. A genuinely unassigned component in an otherwise resolved inventory remains rejected, and validateScenarioCoverage independently verifies every component before a complete seal. Existing null expectations (`issues: []`) remain intact.

## Ownership and identity

Assessment captures the basis, horizon, alternative identity/version, components and evidence identity before evaluating coverage. Reassessment captures its scenario, baseline and entries before the resolver's asynchronous boundary. The resolver receives independent references; a mutation of its request cannot rewrite the expected reference set. The returned scenario and assessment own their DTO fields, so later mutations of caller-owned values cannot change the result.

The installed coverage wrapper uses a WeakMap keyed by the original CostCoverageEntry. A blanket clone before calling supports would destroy that capability. The small captureCoverageEntries adapter retains the original entry for the existing classifier, evaluates and returns detached entries, and checks the original entry digest both before and after the callback. Callback receivers are preserved with bind. The classifier remains the real supportsCoverageClassification implementation in the positive fixtures.

Evidence state/ref are captured once, including accessor-backed resolutions. Authorized projection payloads remain opaque and are not deeply copied. No evidence is invented, and the resolver's result must still contain the exact requested fresh references. Unknown inventory, absent or changed evidence, incompatible currency/period/source and unsupported applicability keep their existing refusal behavior.

validateScenarioCoverage evaluates a single detached DTO observation. Existing rules for basis, version, Planner/Procurement source, component amounts, completeness and totals are unchanged. A baseline registration can legitimately use a different generated alternative identity/version from a revised scenario; the scenario's alternative version is preserved and validated, not overwritten by the baseline.

## Numeric contract

The Planner still owns every amount and formula. Source tests reuse the published quote fixtures and actual producer, registry, C08 and SQLite paths. Omitted training has no input row and no pre-seeded pending row; the inventory derives missing-category. A source-confirmed training quote of40000, a confirmed0, an unresolvednull and shared coverage are distinct. Synthetic scope declarations are explicitly identified in the fixtures; they do not prove installed human applicability authority.

The immutable legacy tests remain selected for implementation70000 ->235000/advantage5000, solver55000/15000 and the durable original ChoiceRecord. Their actual outcome belongs in the run receipts, never inferred from a pure coverage test. The new persisted regression exercises baseline.register, readClassification and a real Planner no-op scenario; it preserves the observed case, classification and preferences, but it does not pretend that an empty fixture case is a historical nonempty ChoiceRecord.

## Evidence and integration

R1 contains6 observed failures and2 passing controls on the preimage. The exact stability.test.ts blob `32dd80e500aabb7d7bc746925a7591acad5a1508` is reused in R2. No assertion or timeout was weakened. R2 selects23 tests in7 named files through the existing Actions request lane, with no local product test, compiler, guard, browser POST replay or P03 rerun.

The complete code/test patch, full product preimage/postimage and per-file hashes are in [PATCH-MANIFEST.json](PATCH-MANIFEST.json). The exact W tree and unchanged dependencies are in [DEPENDENCIES.json](DEPENDENCIES.json). Execution outcomes and unclosed criteria are recorded separately in the final criteria matrix and run receipts. Owner45 has the concrete package-check request. Owner71 alone integrates the target. Source evidence is not a global release, an installed BI acceptance or an integrated candidate proof.

## Final source qualification

The corrected assertion inputs were requalified in [R3](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43675129605):9 PASS,0 FAIL,53 expectations. The log observes `assertionEntriesArray=false` on the disposable matcher subject while `borrowedEntriesArray=true` remains on the real input. This confirms the test-instrumentation cause. The same expected values remain in all three assertions and a full equality check of the original assessment was added.

The implementation is supported by the exact Bun1.3.14 source: [toMatchObject](https://github.com/oven-sh/bun/blob/0d9b296af33f2b851fcbf4df3e9ec89751734ba4/src/test_runner/expect/toMatchObject.zig) enables asymmetric replacement, and [the binding](https://github.com/oven-sh/bun/blob/0d9b296af33f2b851fcbf4df3e9ec89751734ba4/src/jsc/bindings/bindings.cpp) writes a matched property into the received object. No production clone boundary was weakened to accept matcher objects.

[R2](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43674446763) remains a failed run in the audit:21 PASS,2 FAIL. Its14 passing tests in five unchanged files are reused because the exact product, fixtures, execution config and those files are identical in the final W. R3 reran all9 tests in the two changed files. Thus23 unique selected tests have passing witnesses; there is no claim that R2 was a successful workflow. The detailed mapping is [QUALIFICATION.json](QUALIFICATION.json).

The unchanged legacy choice-history test actually reached both55000 and15000 assertions, revised the same durable case, retained the original ChoiceRecord digest, reopened SQLite, restarted the store and read the history with an authorized second participant. The new C08 registration test also passes its full no-op reassessment equality. These are source fixture proofs; installed human N/A and UI/native/BI qualification remain separate.

Final material W:`11859ee19d231738b7dce8a88e00866892d61ac9`; tree:`83331236901857301f3e6747ebb4291cb98ecb34`. Compiler/guards45 are requested but have no observed result. The release is bounded to this source payload and does not grant integrated or global acceptance.
