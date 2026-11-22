# Canonical clones — Portfolio diagnostic attempt 01

**Outcome: the instrumented first-preview request timed out at the original 60,000 ms waiter. No visual qualification or causal performance gain is established.**

[Run 45054828500](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45054828500) used product `9bb7eeff9ba5a5ed501514144b4fd629b46f5ee0` with diagnostic snapshot `9ca5887b65d0b3f479f179838d98ebba64f6995f` / tree `ea51662fec0b02b5d235a5493315b54172997718`. Test job `137307621294` failed at 18:33:11 UTC on 2026-11-22. Cleanup `137310417616` succeeded at 18:33:17 UTC.

## Source and failure

The snapshot is one child of the product and has exactly **10 overlays**: six source-instrumentation paths, two stdout-forwarding paths, the original request `a11922821a47594d76397582be38f9b7940177ca`, and analytics spec prefix `db1d7f4f0d770e5eed811070b0814c0363083c62`. The complete first declaration and its helpers are byte-identical to the prefix of permanent spec `f4eb9a534b7a22fcf79e7ccb20bbfd9f8251ae74`; 376 later lines are omitted, while the selected journey and its original deadlines are intact. This source is instrumented and must remain distinct from the clean product.

The preview POST is native sequence **3**, recorded at log line **1234**, 18:32:03.1241274Z. No corresponding response appears in the completed log. The waiter fails at [spec line 72](https://github.com/gustavomhss/Orchestra-SF/blob/9ca5887b65d0b3f479f179838d98ebba64f6995f/packages/app-shell/e2e/sucafina/design-wave-five-analytics.spec.ts#L72), column 32; log line **1270** records the **60,000 ms** timeout. The footer reports **1 failed**.

Both prior History requests succeeded: sequence 1 at lines **1196/1198** reports HTTP 200 / status ok / array shape / **596 ms**; sequence 2 at **1216/1218** reports the same status and shape / **754 ms**. The events do not preserve array cardinality. Their successful responses do not establish preview completion.

## Original diagnostic records and clock

[profiler.json](profiler.json) preserves all **six original `SF_PORTFOLIO_READONLY` payloads** with their locators, exact `sf-clone-cost-v1` schema/legends, decoded snapshots and consistency checks.

- Started: line **1236**, diagnostic request **1**, scope **before-human-admit**, clock **safe-flush**, totals **settled-within-window**.
- Periodic: lines **1238, 1240, 1242, 1244, 1246**, at **10,000 / 20,002 / 30,000 / 40,000 / 50,000 ms**.
- The schema defines 38 bucket IDs; **18 rows** were emitted in each snapshot.
- There is **no final record**. Pending counts are **0 / 0 / 0 / 0 / 1**; the last pending span is `comparison.scenario-fences`, **52 entries / 51 settled**.
- Parse errors, collector errors, line drops, unknown buckets, numeric clipping and skipped thresholds are all zero.
- The largest complete diagnostic line is **3,018 characters**, below the 4,096-character cap; the largest periodic line is **917**.
- Diagnostic request 1 and native POST sequence 3 use different numbering systems.

The scope is bounded to 60 seconds and safe-flush checkpoints. Log timestamps are emission locators; the profiler's elapsed clock defines its windows. Missing rows and the unobserved tail are not replaced with whole-request zeros.

### Last periodic snapshot: 50,000 ms

These durations are **inclusive and rounded**. They overlap through nesting; do not sum rows, sum cumulative checkpoints, subtract them to claim exclusive cost, or call them CPU time.

| Span | Surface | Calls | Settled | Inclusive ms | Pending |
|---|---|---:|---:|---:|---:|
| `canonical.total` | `unlabelled` | 969642 | 969642 | 10620 | 0 |
| `canonical.total` | `bcs.capture.sources` | 854 | 854 | 5545 | 0 |
| `canonical.total` | `direct` | 778 | 778 | 226 | 0 |
| `canonical.digest` | `unlabelled` | 969642 | 969642 | 13109 | 0 |
| `canonical.digest` | `bcs.capture.sources` | 854 | 854 | 6196 | 0 |
| `clone.operation` | `none` | 854 | 854 | 1573 | 0 |
| `clone.registration` | `none` | 2440 | 2440 | 703 | 0 |
| `comparison.sample` | `none` | 103 | 103 | 1292 | 0 |
| `comparison.scenario-fences` | `none` | 52 | 51 | 18500 | 1 |

The BCS surface entered the clone-tree traversal **854** times: **488 admitted**, **366 refused**, with every recorded refusal attributed to **units**. The estimated unit ceiling is **4,194,304**; maximum complete units are **3,471,592** and maximum refusal observed is **5,207,380**. These are conservative estimates, **not measured bytes**. Maximum node checks are 1,126, own-property prefix 5,837, memo hits 1,425, complete expansion 26,861 and complete height 9. These maxima need not describe one common graph.

BCS helper time is **1,650 ms**, inside canonical total **5,545 ms**, inside digest **6,196 ms**. The archive records the nesting without adding those durations. Its aggregate timing does not split admitted and refused calls.

Unlabelled canonicalization has **969,642** calls: **963,580 root-unregistered** and **6,062 admitted**. Direct canonicalization has **778** calls, all root-unregistered. No canonical throw or checked-environment refusal was reported for these measured populations.

Clone registration records **2,440** trusted clone attempts and completed walkers, with **915,000 node markings** cumulatively. This is a registration count, not a global unique-object count. Registration's **703 ms** is inside clone operation's **1,573 ms**.

Comparison shows one criteria invocation created, six prior-invocation selections, 26 batch-present checks, one cold batch producer and **25 batch proof hits**. Those hits select a branch that still needs its final fence; they do not represent 25 successful authorized egresses. HTTP phase counters reached admitted, with-case-entered and preview-producer; with-case-returned was not emitted.

Instrumentation adds clocks, trace objects, counters, safe-flush work and output. Its overhead is not separately quantified. The failed run does not support a causal comparison against earlier attempts.

## Preserved source and images

[source-events.json](source-events.json) retains **all 120 original SF emissions**, in order, with exact payloads, timestamps and 1-based source lines: **46 stage + 24 source + 2 context + 6 capture + 3 diagnostics + 6 profiler + 33 preview chunks**. [receipt.json](receipt.json) records pinned source, completed jobs, artifact metadata, failure and History locators. [manifest.json](manifest.json) records chunks, hashes, dimensions and individual visual observations.

All **seven original JPEGs** were individually viewed by **root_cost**; no root visual review is attributed.

| Original image | Dimensions | Bytes | Chunks |
|---|---:|---:|---:|
| [UI42-list-dark-desktop-test-data](gallery/UI42-list-dark-desktop-test-data.jpg) | 1440×1100 | 80591 | 5 |
| [UI42-list-light-desktop-test-data](gallery/UI42-list-light-desktop-test-data.jpg) | 1440×1100 | 85900 | 5 |
| [UI42-list-dark-390-test-data](gallery/UI42-list-dark-390-test-data.jpg) | 390×844 | 28676 | 2 |
| [UI42-list-light-320-test-data](gallery/UI42-list-light-320-test-data.jpg) | 320×800 | 27478 | 2 |
| [UI42-empty-authorized-case-test-data](gallery/UI42-empty-authorized-case-test-data.jpg) | 1440×1100 | 97929 | 6 |
| [UI42-configure-focused-candidate-test-data](gallery/UI42-configure-focused-candidate-test-data.jpg) | 1440×1100 | 106221 | 6 |
| [FAILED-native-wave-three-test-data](gallery/FAILED-native-wave-three-test-data.jpg) | 1440×1100 | 110037 | 7 |

The lists show two authorized cases in desktop and mobile views. The empty case shows no eligible scenarios and a dimmed Preview action. The configured case shows candidate v1 and constraint v2 selected, with limit 4 focused. The final image retains that selection with dimmed controls, **Running**, **“Preview is not yet available.”** and History showing no recorded results. It does not show a completed preview or prove any later server outcome.

All **33** chunk sequences are complete and 1-based. The seven JPEGs total **536,832 bytes**. No image conversion or recompression occurred. Base64 roundtrips, JPEG markers, dimensions, SHA-256 values and independently computed Git content addresses were verified; every GitHub-created blob SHA matches. Separate binary content readback is deferred until composition into a commit.

Artifact `14767625900` is `playwright-ubuntu-24.04-1`, **8,823,794 bytes**, SHA-256 `282a9e704b63f01ea6967c017fcef6d0fac3a74f46aed4fb994a4eb0541704fa`, expiring **2026-11-29T18:33:05Z**. The ZIP and original PNG attachments were not downloaded or verified.

## Delivery scope

This delivery contains **five text blobs and seven JPEG blobs** under `diagnostic-01/`. It creates no tree, commit, ref, CI run, runtime change, rollup, top-level README change or root review. Raw logs and the Omni control value are excluded.

The earlier eight technical PASS gates remain scoped to run 45048665481 on product `d6bce5d81d0fd578a190b9bacac2a1a4250109a1` / snapshot `c18b97d8a316992b95abcbb57ef9b6c6754b1518`; this diagnostic does not rerun or reattribute them. UI42–44 qualification and acceptance counts remain unchanged.
