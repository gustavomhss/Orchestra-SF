# Portfolio23: context integrity and case selector diagnostic

This attempt confirms that both new paths are exercised by the installed preview. Business and Root capture attested UI contexts and take the fast current path; the registered case selector reaches the narrow clone branch. The native preview still exceeds its original 60,000 ms deadline. The full first declaration did not complete, so this archive provides diagnostic evidence and **no qualification increment**.

## Provenance and result

- Run: [45033525825](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45033525825), workflow attempt 1, branch `ci-run-sf5portfolio23`.
- Test job: `137242109427`, completed with failure at `2026-11-22T14:41:08Z`. Cleanup `137244040727` completed successfully.
- Diagnostic snapshot: [7f9a1233a200c4da2e80baa2e546d70afbd87ff4](https://github.com/gustavomhss/Orchestra-SF/commit/7f9a1233a200c4da2e80baa2e546d70afbd87ff4), tree `3c154294157599d4f17e6e6b0d6a86b2ec2249cf`.
- Product base: `e4cc03bb3fa6deaed5c66f0050ffebf878dfef5d`. This QA archive is based on checkpoint `e08b28986b6eeebe17d2ab7e5f6a540201256893` and contains no diagnostic code overlays.
- Selected spec blob: `db1d7f4f0d770e5eed811070b0814c0363083c62`, the full literal first declaration and prefix helpers from permanent spec `f4eb9a534b7a22fcf79e7ccb20bbfd9f8251ae74`. The journey itself was not truncated.
- Request blob: `a11922821a47594d76397582be38f9b7940177ca`. Original request, fixtures and deadlines were retained.
- Collector `301dce3901504566ca746826bf95b918891d439a` retains collector817 and adds only the explicit `scopeOrigin: before-human-admit` metadata mark.

The original `decision-portfolio-preview` POST was observed at `2026-11-22T14:40:03.0054480Z`, with exact owner binding. No matching native response or completed preview readback appears in the acquired events. Playwright reported `page.waitForResponse: Timeout 60000ms exceeded` at `design-wave-five-analytics.spec.ts:72:32`. The remaining result/readback/sensitivity assertions were not reached. Earlier authenticated context and source readbacks remain preserved, but they do not complete this declaration. See [receipt.json](receipt.json) and [source-events.json](source-events.json).

## What the 50-second prefix demonstrates

| Observation | Business | Root |
|---|---:|---:|
| Capture calls | 132 | 9 |
| Attested captures | 132 | 9 |
| Current calls | 589 | 125 |
| Fast current calls | 589 | 125 |
| Private provenance hits | 853 | 143 |
| Environment checks accepted | 853 | 143 |

There is one observed mint registration. Provenance hits match the two capture checks plus the current checks for each consumer. No fallback, provenance-miss or environment-rejection bucket appears in the emitted prefix. All five checkpoint summaries report zero drops and diagnostic errors; this claim is limited to that prefix.

The case selector has 131 factory calls, 131 registrations, 131 eligible reads, 131 narrow-branch span calls and 131 callback calls. Its narrow clone/project/await span reports 51 ms inclusively. The equal aggregate counts do not add per-object correlation that the collector does not record.

Root reports nine prepare entries, nine owned-ready preparations and nine physical callback entries. Those callback entries are not an independently identified count of physical roots or completed/accepted transactions.

The profile also records:

| Span at 50,000 ms | Calls | Settled | Pending | Inclusive ms |
|---|---:|---:|---:|---:|
| `canonical.digest` | 1,414,970 | 1,414,970 | 0 | 17,879 |
| `authority.principal` | 63,608 | 63,608 | 0 | 13,371 |
| `state.read.total` | 1,923 | 1,923 | 0 | 4,538 |
| `state.read.full.clone-callback-await` | 1,032 | 1,032 | 0 | 3,226 |
| `state.read.identity-narrow.clone-project-await` | 131 | 131 | 0 | 51 |
| `http.preview` | 1 | 0 | 1 | 0 |

These are overlapping inclusive measurements. Their durations must not be summed. The HTTP duration is zero because its span has not settled, not because the preview took no time. Integer rounding also means a reported zero for a short settled span does not establish zero cost.

## Checkpoints and completeness

All five periodic checkpoints were emitted at settled-span boundaries. The collector retained its original 10–50 second checkpoints and 60-second observation window.

| Elapsed ms | Digest calls | Principal calls | Business fast | Root fast | Narrow branch | Physical callbacks | Total measured pending |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 10,000 | 245,887 | 11,041 | 82 | 10 | 27 | 1 | 2 |
| 20,003 | 532,505 | 23,950 | 205 | 39 | 51 | 3 | 1 |
| 30,000 | 814,742 | 36,656 | 328 | 68 | 75 | 5 | 2 |
| 40,006 | 1,100,065 | 49,507 | 451 | 97 | 99 | 7 | 1 |
| 50,000 | 1,414,970 | 63,608 | 589 | 125 | 131 | 9 | 1 |

The archive contains all 181 profiler records: one started record, 175 bucket rows and five snapshot summaries. Each snapshot has 35 distinct buckets. Calls equal settled plus pending in every row; summary pending totals match their rows. Every emitted checkpoint reports zero bucket drops, root drops, line drops, diagnostic errors and skipped thresholds.

There is **no final snapshot**. The 50,000 ms checkpoint still has one pending HTTP span. The evidence does not establish a complete backend unwind or request completion after that checkpoint. [profile.json](profile.json) preserves every original structured profiler value with its log timestamp and source line; [aggregates.json](aggregates.json) contains the integrity checks and final observed bucket table.

## Interpretation boundaries

- The clock begins **before human.admit**, so it includes minting. Portfolio21/attempt-18 used a different scope origin. These observations do not establish a causal before/after speed comparison.
- `canonical.digest` measures `digestSfValue` only. It excludes direct `canonicalSfValue` calls, including `plannerRequestIdentity`, and does not decompose all canonicalization or CPU work.
- `root.caller.*` covers **PlannerCalculationServices only**. It does not cover the direct Finance caller. Those buckets are absent here while Root prepare/capture/physical-callback buckets are present. The absence does not mean Root was unused and does not by itself assign those invocations to Finance.
- `state.read.identity-absent` totals 1,792 reads across namespaces and arbitrary callbacks. It is not a count of missed case-selector opportunities.
- The guard's `baseline-accessor` reason would reject before comparing getter/setter identities. It would not prove those identities equal. No such rejection bucket was observed in this prefix.
- The narrow and full clone spans include the original callback and await. Their populations differ; their average durations are not a controlled comparison of clone speed.
- Counters describe this one frame and observed prefix. They do not describe calls outside the frame, complete request lifetimes or uninstrumented work.
- Bookkeeping and bounded output add diagnostic overhead. The snapshot installed no intrinsic hooks and added no provider or authority queries.

The demonstrated conclusion is that both optimized paths are active, while this original preview deadline remains unmet. The profile does not establish which remaining caller dominates the full journey.

## Preserved native evidence

The archive preserves 24 source events, two authenticated context readbacks, six capture events, 46 installation stages and three diagnostics, in their original order with timestamps and source-line provenance. No structured JSON parse failed. No raw workflow log is archived.

All 33 `SF_DESIGN_PREVIEW` chunks use contiguous **1-based** part numbers. There are no missing parts, duplicates or inconsistent part totals. They reconstruct seven original JPEGs totaling **536,861 bytes**. Each JPEG has a recorded SHA-256, Git blob SHA, dimensions and per-chunk lengths/hashes. Base64 decode/encode round trips match, and GitHub binary readbacks match the original concatenated base64. See [manifest.json](manifest.json).

| Original JPEG | Dimensions | Chunks | Bytes |
|---|---:|---:|---:|
| [UI42-list-dark-desktop-test-data](gallery/UI42-list-dark-desktop-test-data.jpg) | 1440 × 1100 | 5 | 80,609 |
| [UI42-list-light-desktop-test-data](gallery/UI42-list-light-desktop-test-data.jpg) | 1440 × 1100 | 5 | 85,903 |
| [UI42-list-dark-390-test-data](gallery/UI42-list-dark-390-test-data.jpg) | 390 × 844 | 2 | 28,711 |
| [UI42-list-light-320-test-data](gallery/UI42-list-light-320-test-data.jpg) | 320 × 800 | 2 | 27,477 |
| [UI42-empty-authorized-case-test-data](gallery/UI42-empty-authorized-case-test-data.jpg) | 1440 × 1100 | 6 | 97,837 |
| [UI42-configure-focused-candidate-test-data](gallery/UI42-configure-focused-candidate-test-data.jpg) | 1440 × 1100 | 6 | 106,272 |
| [FAILED-native-wave-three-test-data](gallery/FAILED-native-wave-three-test-data.jpg) | 1440 × 1100 | 7 | 110,052 |

Each JPEG was displayed and reviewed individually. The desktop and narrow lists show the two authorized cases; the empty case shows no eligible scenarios; the configured case shows the selected candidate and exploration limit 4. The failure image retains that configuration with disabled controls, the action marked **Running**, **Preview is not yet available**, placeholder bars and empty history. It contains no completed preview/result/sensitivity screen. Detailed observations and the original failure image name are retained in [visual-review.json](visual-review.json).

The workflow artifact [14759345102](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45033525825/artifacts/14759345102) contains the original PNG/trace attachments: 8,827,785 bytes, SHA-256 `04321fe192484b030d364c872e8d25556f26f946272189d011a68d964ded3a43`, expiry `2026-11-29T14:41:05Z`. Its metadata is preserved in the receipt. The durable gallery is the original emitted JPEG preview set.

This QA commit adds only this attempt directory. It changes no product/runtime/test code, CI selector, global qualification count, existing QA ledger or product ref.
