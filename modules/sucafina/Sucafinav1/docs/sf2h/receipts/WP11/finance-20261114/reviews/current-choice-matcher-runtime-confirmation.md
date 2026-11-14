# Current-choice runtime confirmation — S19

**The observed current-choice failure is resolved on the exact pinned scope, with its cause demonstrated in Actions.** No coverage basis, product guard, financial producer, authorization, source fence, or timeout was relaxed.

## Exact provenance

| Item | Pin |
| --- | --- |
| Product W30 | `bd168e193e7bb4a43893c24c5370c9c3fa205fc1` |
| Product tree | `7adcfb7d4687aa192b68eeddd3cce4fd0bf92d18` |
| CI snapshot S19 | `823311ee83c6a28273bc8d63bb1157e9bdcb01e7` |
| Snapshot tree | `4ccdd3979631b2df4344ca7fcfaf4828062509fa` |
| Branch | `ci-run-linux-astra-wp11-bd168e1-e10e1d8-a1` |
| Run / main job | `43594791351` / `132446885026` |
| Current-choice test blob | `7a5100d9e60a81f654cc31714efd2b1e7d0b68f5` |
| File SHA256 | `d8aa020d994c2ed6aa489a9b4968c44cfd3c0be4f3d76caaefc8b0b7470b6f4d` |
| Raw log SHA256 | `ccf1eccb4f0a88c94996930d7f8420ba28d309147e8e654d62fcff62fd1e9e5c` |
| ANSI-clean log SHA256 | `2ba78edece95bcc4a6c1cc4de75fac7571e15ccbe5ee2cc30be46d0d1d1ce613` |

[Actions run](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43594791351) completed successfully: **21 PASS, 0 FAIL, 448 assertions, 9 files, 407.80 seconds**. The current-choice lifecycle case passed in **52,028.22 ms**, within its unchanged **180,000 ms** limit. Its file retains the 40 original assertions and adds one producer-assessment integrity assertion, for 41.

## Demonstrated cause

The S19 log records at `2026-11-14T12:28:18.8381335Z`:

```json
{"beforeDigest":"1f6a8ffc54a20f5fa4f58b77e12031467560ae24db0af2a0ae970d633f20372f","afterError":"SF_CANONICAL_UNSUPPORTED","componentRefsAreArray":false}
```

The span between the before digest and this observation contains the existing `toMatchObject`/`expect.arrayContaining` assertion. On the run's Bun 1.3.14, that matcher changed the observed training entry: `componentRefs` ceased being an array and the object was no longer accepted by the canonical digest. Before isolation, this was the live entry shared by `coverage.entries` and the producer assessment. The classification held separate cloned entries.

This explains the earlier canonical reassessment refusal and the later `DataCloneError` when W22 diagnostics tried to clone the already contaminated assessment. The defensive producer correctly refused invalid coverage data; changing its basis guard or weakening validation would have hidden the fixture defect. In S18, baseline basis2 and selected basis2 already matched and all three references resolved fresh; scenario basis1 was the unclassified source inventory awaiting canonical reassessment, not evidence that the initial basis guard failed.

The fix keeps the exact existing assertion and gives it an exact clone of the entry. The new digest invariant passes for the untouched producer assessment. The matcher mutation remains visible on its disposable observation, proving that the fix isolates the test side effect rather than suppressing the negative product result. No product source file changed.

## What the passing lifecycle demonstrates

The real Planner producer resimulates the historical choice against the confirmed training source, and the current result is persisted under C08. A separate human permission is required to promote that result. The original ChoiceRecord remains unchanged, including through real store disposal/reopen; exact preview and persisted promotion retries remain idempotent. Source revocation and a concurrent case update are refused. After a fresh preview, case3 advances to case4 while retaining the historical choice. Planner snapshots remain unchanged: decision-result promotion is not application of its domain operations.

The original choice retains known subtotal **210,000** with omitted training. The current result has known subtotal **250,000** and complete cost coverage, while its `comparisonStatus` remains `conditioned` and its `total` remains `null`: its historical scenario operations are still hypothetical. Complete coverage is not a claim that those operations were applied.

S12 (`43587138878`), S14 (`43589528126`), S17 (`43591635600`) and S18 (`43593276333`) remain preserved as historical failed runs. Their current-choice finding is closed by this exact test scope and runtime cause; no failure record is erased or relabeled.

## Limits

This is a scoped Actions product proof using explicit fixture admissions. The Omni control is **not applicable**, nonce `bd50743eae7370c82a975444ed25bdba`, with zero spawns. It provides no native resident execution, installed UI witness, C/D completion, complete three-WP acceptance, or S0 integration epic. The separate post-W30 type guard for the read-scope test still requires its own exact-head typecheck and scoped run; S19 does not validate that later blob.

This report used the completed logs, local metadata and file hashes only. No local product test, Bun command, remote write or further code change was performed.
