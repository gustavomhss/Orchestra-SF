# Portfolio27 — Planner and capture caller diagnostic

**Result: diagnostic failure; no qualification increment.** The full original first analytics declaration reached its first native portfolio preview request, then failed at the unchanged 60,000 ms `page.waitForResponse` deadline. The preview, result readbacks and sensitivity journey did not complete. This archive records QA evidence only; it selects no product optimization and does not update global qualification rollups.

## Run and source

| Item | Pinned value |
|---|---|
| Run | [45042950403](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45042950403), attempt 1, completed failure |
| Test job | 137271221351, completed failure at 2026-11-22T16:26:03Z |
| Cleanup job | 137273862287, completed success at 2026-11-22T16:26:08Z |
| Product | `e4cc03bb3fa6deaed5c66f0050ffebf878dfef5d` |
| Diagnostic snapshot | `e3062c97b3b32bcf28a1005cb6a0fd0f6fa6d951` |
| Snapshot tree | `6f1307013e0a562545657f26fa3ce9ad55e421a6` |
| Snapshot parent | Portfolio26 `48faf8ddcc242ed1ffb10d01f4619534b169a52b` |
| Selected spec | `db1d7f4f0d770e5eed811070b0814c0363083c62` |
| Request | `a11922821a47594d76397582be38f9b7940177ca` |
| QA parent | `63586d34bada482921fae693dae4ecbe3b892610` |
| QA parent tree | `8aaa2eab26ae2898576a315ce3acbf55694701e6` |

The selected spec is the full literal first declaration, including its original prefix helpers, from permanent spec `f4eb9a534b7a22fcf79e7ccb20bbfd9f8251ae74`. Its journey and deadlines were not truncated. The snapshot has **20 cumulative diagnostic/request/spec overlay paths** relative to the product. The QA archive contains none of those overlays.

### New instrumentation metadata

The seven-file delta from Portfolio26 adds **ten literal direct-caller labels** and one conditional synchronous `bcs.capture.stable` span. The labels cover Planner projection, selector, envelope and role-map hashes, Planner evidence projection checks, run source fences, and BCS capture sources/snapshots/extras/captures. The started record declares 21 digest labels in total. Original digest operands, evaluation order, guards, callbacks and one span per digest are retained; no memoization or product optimization is introduced.

| Delta path | Snapshot blob |
|---|---|
| `apps/cli/src/sucafina-product/planner-evidence.ts` | `774396d11a891ff62245782dc5edc03c396fdde3` |
| `modules/sucafina/Sucafinav1/product/ai/run-store.ts` | `d89c92f339d280296fbbe5a1d6c50041074cf936` |
| `modules/sucafina/Sucafinav1/product/contracts/canonical.ts` | `49008ab130f03fa25004c8263ac975913274d215` |
| `modules/sucafina/Sucafinav1/product/host-binding/business-context.ts` | `ee3f8748cf49683140e41cf80d30a2c7341fe893` |
| `modules/sucafina/Sucafinav1/product/integration/planner-sources.ts` | `f1e38598b222cb6dc3b05ef227aa7041cb023f91` |
| `modules/sucafina/Sucafinav1/product/integration/source-projections.ts` | `d52733255c1dae0ebc8f11f0fe47d2c97256374a` |
| `modules/sucafina/Sucafinav1/product/portfolio/diagnostic-timing.ts` | `5acdf660647a086050c7a5a3abc6dd078222eaec` |

The stable-body span starts inside the existing `stable` callback of `captureObservations.read`, when that callback is reached through `readSfMemoryCaptureIntegrity`. It covers the synchronous body, including original `currentSnapshots` and argument work when reached; **initial snapshot capture is outside this span**. Nested digest times overlap its duration. Its instrumentation preserves the original expression inside `try/finally` with begin/end bookkeeping.

**Only 18 of the 21 digest labels were emitted in this prefix.** `bcs.capture.snapshots`, `bcs.capture.extras`, `bcs.capture.captures`, and the `bcs.capture.stable` span are **absent from the emitted observations**. They are represented as unavailable/null in the aggregates, not as measured zero calls or zero duration for the request.

The diagnostic adds literal-label selection, clock reads, counters, checkpoint and output overhead. The conditional stable span adds its own begin/finally/end bookkeeping when reached. It installs no global intrinsic hooks, adds no authority/provider query and selects no cache or product change. These observations support no causal performance comparison with earlier attempts.

[receipt.json](receipt.json) preserves completed run/job/step metadata, source provenance, failure location, History readbacks, profiler-start metadata and artifact receipt. The final log was acquired only after completed metadata; no new execution or replay was performed for this archive.

## Original outcome and History

The first native preview is `POST` sequence 3 for `decision-portfolio-preview`, emitted at **2026-11-22T16:24:55.4113636Z**, source line **1229**. There is no matching preview response in the final log. Source line **1797** reports:

> TimeoutError: page.waitForResponse: Timeout 60000ms exceeded while waiting for event "response"

The original failure location is `packages/app-shell/e2e/sucafina/design-wave-five-analytics.spec.ts:72:32`, at source line **1806**. One selected test failed. The last stage event is `decisions-ready`; the failure and page-closed diagnostics have empty console/page-error arrays.

Both preparatory History responses were acquired in this execution:

| Sequence | Request line | Response line | Original response |
|---|---:|---:|---|
| 1 | 1193 | 1195 | HTTP 200, `status: ok`, `valueShape: array`, 420 ms |
| 2 | 1213 | 1231 | HTTP 200, `status: ok`, `valueShape: array`, 810 ms |

Neither sequence has a `native-request-failed` or response-body-unavailable event. Sequence 2's response is emitted after the preview request. These readbacks do not qualify the failed preview or establish the cause of its timeout.

The failure JPEG visibly retains **Running**, **Preview is not yet available**, loading placeholders and an empty History. Earlier captures show the authorized list, responsive list, empty case and prepared candidate configuration. No capture establishes a completed preview, persisted result or sensitivity view.

## Last checkpoint: 50,001 ms

All **271 original profiler records** are retained: one started record, 265 bucket rows and five periodic summaries. Each checkpoint has **53 unique keys** and the same inventory. All use the settled-span checkpoint trigger. Calls equal settled plus pending, cumulative calls/settlements/inclusive times are monotonic, and summary pending counts match bucket rows. All emitted summaries report zero bucket/root/line drops, diagnostic errors and skipped thresholds. **No final snapshot was emitted.**

| Snapshot | Elapsed ms | Keys | Pending spans | Digest calls across 18 surfaces | Digest inclusive ms |
|---|---:|---:|---:|---:|---:|
| 1 | 10,000 | 53 | 2 | 177,618 | 3,047 |
| 2 | 20,000 | 53 | 1 | 405,859 | 6,678 |
| 3 | 30,000 | 53 | 2 | 674,032 | 10,542 |
| 4 | 40,000 | 53 | 2 | 913,907 | 14,158 |
| 5 | 50,001 | 53 | 3 | 1,139,046 | 17,732 |

The following populations identify direct `digestSfValue` callers. They may be summed within the `canonical.digest` bucket name; they do not decompose all request ancestry or CPU work.

| Direct-caller surface | Calls | Inclusive ms |
|---|---:|---:|
| `principal.direct` | 153,763 | 1,684 |
| `source.scope-validation` | 99,496 | 499 |
| `source.other` | 60,038 | 2,547 |
| `finance.current` | 748 | 2 |
| `finance.other` | 705 | 356 |
| `bcs.planner.projection-period` | 1,962 | 3 |
| `bcs.planner.expected-period` | 1,962 | 3 |
| `bcs.planner.source-ref` | 308,034 | 1,912 |
| `bcs.planner.expected-ref` | 308,034 | 2,019 |
| `canonical.evidence-ref` | 11,797 | 108 |
| `planner.source.projection` | 5,390 | 221 |
| `planner.source.selector` | 42,960 | 98 |
| `planner.source.envelope` | 10,740 | 443 |
| `planner.evidence.projection` | 6,858 | 267 |
| `planner.source.role-map` | 43,000 | 331 |
| `source.run-fence` | 291 | 120 |
| `bcs.capture.sources` | 979 | 5,182 |
| `unlabelled` | 82,289 | 1,937 |
| **Digest total** | **1,139,046** | **17,732** |

### BCS capture and remaining unattributed hashes

`bcs.capture.sources` records **979 calls / 5,182 inclusive ms**. The label is present on the original sources-value hash at initial capture and within the conditional stable check. No stable-body bucket was emitted, and no snapshot/extras/captures digest bucket was emitted. The aggregate does not identify individual object provenance, repeated aliases, object sizes or a safe optimization boundary.

The remaining `unlabelled` population records **82,289 calls / 1,937 inclusive ms**. Added attribution and bookkeeping differ from earlier runs; the change in label populations is not a measured performance gain.

The original BCS projection expression still has two period hashes and two reference hashes for each value whose `sourceRefs.length === 1` guard passes. Here the two period labels each record **1,962 calls / 3 ms**, for **3,924 / 6 ms** together. The two reference labels each record **308,034 calls**, for **616,068 / 3,931 inclusive ms** together. All four sites total **619,992 calls / 3,937 inclusive ms**. Equal reference counts in this prefix do not prove completed comparisons or accepted results.

### Other spans and pending work

`canonical.direct` records **1,917 calls / 489 inclusive ms** outside internal digest canonicalization. `authority.principal` has **51,255 calls, 51,254 settled, one pending and 10,884 inclusive ms**. `principal.direct` has **153,763 hashes = 3 × 51,254 + 1**; the pending principal span permits a checkpoint between its original hash sites. This does not justify removing any live principal check.

`state.read.total` records **1,548 calls, 1,547 settled, one pending and 4,469 inclusive ms**. The HTTP preview also has one pending entry. These three pending spans may be nested; their counts are not independent unfinished requests, and no final snapshot establishes completion or unwind.

The canonical, principal, state and HTTP span families overlap. Their durations must not be added into CPU or wall time. Inclusive durations are rounded to integer milliseconds, and an unsettled span is not a zero-cost completed operation.

### Context proof, selector and Root

| Observed path at 50,001 ms | Business | Root |
|---|---:|---:|
| Context captures | 104 | 7 |
| Attested captures | 104 | 7 |
| Current checks | 459 | 97 |
| Fast current checks | 459 | 97 |
| Provenance/environment hits | 667 | 111 |
| Current inclusive ms | 3 | 1 |

The counts satisfy `667 = 2 × 104 + 459` and `111 = 2 × 7 + 97`. Mint proof-attempt and registration each occur once. No fallback, provenance-miss or environment-rejection bucket was emitted in this prefix. This proves recorded use of the immutable-context path in the frame; it does not replace live authorization.

The case-identity selector has **103** factory, registration, eligible-read, narrow-span and original callback entries. Its narrow clone/project/await span settles all 103 calls and records **52 inclusive ms**. The full clone/callback/await span settles **817 calls / 3,139 inclusive ms**. Both spans include the original callbacks and awaits; their different populations are not a controlled cloning benchmark.

`state.read.identity-absent` has **1,444** entries across namespaces and arbitrary callbacks. It is not a count of missed private-selector opportunities. The total state-read span includes one pending entry, so the final prefix is not a completed-call partition.

Root prepare, initialize, owned-ready and physical-callback entries each occur **seven** times. No `root.caller.*` bucket was emitted; those caller counters cover **PlannerCalculationServices only**, excluding the direct Finance caller. Their absence does not mean Root was unused or attribute every Root entry to Finance.

## Interpretation boundaries

- The full original declaration and its readbacks are required for qualification. This incomplete diagnostic adds no accepted surface.
- Scope begins **before human.admit**. Added labels and instrumentation impose overhead; no causal comparison or performance gain is claimed.
- Durations are cumulative, inclusive and rounded. Do not add overlapping families or checkpoint totals across time. Only the 18 emitted same-name digest populations are combined.
- Three declared capture digest labels and the conditional stable span were not emitted. They remain unavailable rather than request-wide zero measurements.
- Direct-caller labels do not identify complete ancestry. `canonical.direct` excludes internal digest canonicalization; neither canonical bucket measures all serialization or CPU.
- A `baseline-accessor` rejection precedes getter/setter identity comparison and would not prove those identities equal. No such rejection bucket was emitted.
- Physical-callback entries are not independently identified physical roots, accepted commits or completed requests. Aggregate counts are not per-object joins.
- Zero drops/errors apply to emitted checkpoints. HTTP, principal and state each have pending work in the last prefix, and no final snapshot exists.
- Both History responses have HTTP 200/`status: ok`; they do not qualify the preview or explain its timeout.
- No product, runtime, tests, rollups, global counters or root-review file is changed by this archive. No additional CI or replay is performed.

[aggregates.json](aggregates.json) retains all **53** last-checkpoint buckets, per-snapshot audits, the **18** observed digest populations and unavailable-label distinctions. [profile.json](profile.json) retains every original profiler payload, timestamp and source line, including `scopeOrigin`, caps, pending counts and summaries.

## Original evidence and visual review

The final log contains **934,420 characters** and **1,908 split lines**, including its trailing empty line. **The raw log is not archived.** All **385 structured emissions** are preserved by original payload or exact reversible image-chunk reconstruction.

| Marker | Original emissions | Archive |
|---|---:|---|
| `SF_PORTFOLIO_READONLY` | 271 | [profile.json](profile.json) |
| `SF_DESIGN_STAGE` | 46 | [source-events.json](source-events.json) |
| `SF_ANALYTICS_SOURCE` | 24 | [source-events.json](source-events.json) |
| `SF_ANALYTICS_CONTEXT` | 2 | [source-events.json](source-events.json) |
| `SF_ANALYTICS_CAPTURE` | 6 | [source-events.json](source-events.json) |
| `SF_DESIGN_DIAGNOSTICS` | 3 | [source-events.json](source-events.json) |
| `SF_DESIGN_PREVIEW` | 33 | Original JPEGs and [manifest.json](manifest.json) chunk records |

The 33 preview chunks are complete, unique and **1-based**, with consistent totals. They reconstruct **seven original JPEGs totalling 536,415 bytes**. Canonical base64 round-trips, JPEG boundaries and dimensions were checked. Remote image readbacks match the original reconstructed base64 exactly. Image and chunk hashes, timestamps, source lines, chunk lengths and original emission order are retained. The original JSON chunk payload can be reconstructed exactly from each JPEG and the manifest's recorded lengths and property order.

| Original JPEG | Dimensions | Bytes | Visible state |
|---|---|---:|---|
| [UI42-list-dark-desktop-test-data](gallery/UI42-list-dark-desktop-test-data.jpg) | 1440 × 1100 | 80,599 | Two authorized cases, versions 2 and 6 |
| [UI42-list-light-desktop-test-data](gallery/UI42-list-light-desktop-test-data.jpg) | 1440 × 1100 | 85,846 | Two authorized cases, versions 2 and 6 |
| [UI42-list-dark-390-test-data](gallery/UI42-list-dark-390-test-data.jpg) | 390 × 844 | 28,650 | Stacked readable case cards |
| [UI42-list-light-320-test-data](gallery/UI42-list-light-320-test-data.jpg) | 320 × 800 | 27,453 | Stacked readable case cards |
| [UI42-empty-authorized-case-test-data](gallery/UI42-empty-authorized-case-test-data.jpg) | 1440 × 1100 | 97,767 | No eligible scenario; preview inactive; history empty |
| [UI42-configure-focused-candidate-test-data](gallery/UI42-configure-focused-candidate-test-data.jpg) | 1440 × 1100 | 106,137 | Candidate v1 and constraint v2 selected; limit 4 |
| [FAILED-native-wave-three-test-data](gallery/FAILED-native-wave-three-test-data.jpg) | 1440 × 1100 | 109,963 | Running; preview unavailable; history empty |

`/root/root_cost` viewed every original JPEG individually. [visual-review.json](visual-review.json) records image-specific observations and limits. It does not attribute visual review to root.

Artifact [14762488189](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45042950403/artifacts/14762488189), `playwright-ubuntu-24.04-1`, is **8,826,009 bytes**, with digest `sha256:1af24c70617cf6760af4e4b2436485b78e43e16aea5175dd6e99cc89e6ec9e2f` and reported expiry **2026-11-29T16:25:58Z**. The ZIP was not downloaded. The seven original emitted JPEGs are preserved here independently of that expiry.
