# Portfolio26 — BCS and evidence-reference diagnostic

**Result: diagnostic failure; no qualification increment.** The original first analytics declaration reached its first native portfolio preview request, then failed at the unchanged 60,000 ms `page.waitForResponse` deadline. It did not complete the preview, result readbacks or sensitivity journey. This archive changes only QA evidence; it selects no product optimization and does not update global qualification rollups.

## Run and source

| Item | Pinned value |
|---|---|
| Run | [45040443689](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45040443689), attempt 1, completed failure |
| Test job | 137263467188, completed failure at 2026-11-22T16:00:32Z |
| Cleanup job | 137266432739, completed success at 2026-11-22T16:00:39Z |
| Product | `e4cc03bb3fa6deaed5c66f0050ffebf878dfef5d` |
| Diagnostic snapshot | `48faf8ddcc242ed1ffb10d01f4619534b169a52b` |
| Snapshot tree | `0e4f596c26a6de6a85e25633e1a981ca38052a58` |
| Snapshot parent | Portfolio25 `fe306be28d7543d4ed3890a6e78d3d010e494486` |
| Selected spec | `db1d7f4f0d770e5eed811070b0814c0363083c62` |
| Request | `a11922821a47594d76397582be38f9b7940177ca` |
| QA parent | `3ea2ba60f6ce0271a252b752bbb39661a6d1bdb2` |
| QA parent tree | `bbcf484b4515b66d65f1090477a8fdf694dc7bc3` |

The selected spec is the full literal first declaration, including its original prefix helpers, from the permanent analytics spec `f4eb9a534b7a22fcf79e7ccb20bbfd9f8251ae74`. Its journey and deadlines were not truncated. The snapshot retains 15 diagnostic/request/spec overlay paths; the QA commit contains none of them.

The three-file delta from Portfolio25 adds **five literal labels**: the original BCS projection-period, expected-period, source-reference and expected-reference hash sites, plus the hash invoked by `digestSfEvidenceRef`. The original operands, evaluation order, `sourceRefs.length === 1` guard and short circuit remain present. There are still **two period hash sites when that comparison is reached and two reference hash sites per value whose length guard passes**. No memoization is introduced, and each digest invocation retains one diagnostic span.

[receipt.json](receipt.json) preserves completed run/job/step metadata, source provenance, native history acquisition limits, failure location and artifact receipt. Logs were acquired only after completed metadata; this archive required no new execution or replay.

## Original outcome and acquisition limits

The first native preview request is `POST` sequence 3 for `decision-portfolio-preview`, emitted at **2026-11-22T15:59:25.7399373Z**, source line 1247. There is no matching preview response in the final log. Source line 1745 reports:

> TimeoutError: page.waitForResponse: Timeout 60000ms exceeded while waiting for event "response"

The original failure location is `packages/app-shell/e2e/sucafina/design-wave-five-analytics.spec.ts:72:32` at source line 1754. One selected test failed. The last stage event is `decisions-ready`; the failure and page-closed diagnostics contain empty console/page-error arrays.

Native History acquisition differs between its two requests:

| Sequence | Original evidence | What is established |
|---|---|---|
| 1 | Request at line 1209; `native-request-failed` at line 1211; HTTP 200 with `acquisitionFailure: response-body-unavailable` at line 1213 | HTTP status was observed, but no application-level body readback or `status: ok` is confirmed for that response |
| 2 | Request at line 1231; HTTP 200 and `status: ok` at line 1249 | The second body readback was observed; its response event follows the preview request in emission order |

These original events are retained unchanged. They do not establish the cause of the preview timeout, and an HTTP status alone is not treated as successful qualification.

The failure JPEG visibly retains **Running**, **Preview is not yet available**, loading placeholders and an empty History. Earlier captures show the authorized list, responsive list, empty case and prepared candidate configuration. No image establishes completed preview, persisted result or sensitivity behavior.

## Last checkpoint: 50,008 ms

All **236 original profiler records** are preserved: one started record, 230 bucket rows and five periodic summaries. Each checkpoint has **46 unique keys** and the same inventory. All are triggered by settled spans. Calls equal settled plus pending; cumulative calls, settlements and inclusive times are monotonic; summary pending counts match bucket rows. Every emitted summary reports zero bucket/root/line drops, diagnostic errors and skipped periodic thresholds. **No final snapshot was emitted.**

| Snapshot | Elapsed ms | Keys | Pending spans | Digest calls across 11 surfaces | Digest inclusive ms |
|---|---:|---:|---:|---:|---:|
| 1 | 10,000 | 46 | 2 | 112,201 | 2,856 |
| 2 | 20,000 | 46 | 2 | 305,382 | 6,385 |
| 3 | 30,000 | 46 | 2 | 454,512 | 9,617 |
| 4 | 40,000 | 46 | 2 | 647,524 | 13,144 |
| 5 | 50,008 | 46 | 1 | 788,629 | 16,246 |

The 11 `canonical.digest` populations identify direct labelled call sites. They may be summed **within this one bucket name**; they are not an ancestry decomposition of all work.

| Direct-caller surface | Calls | Inclusive ms |
|---|---:|---:|
| `principal.direct` | 106,491 | 1,672 |
| `source.scope-validation` | 68,920 | 585 |
| `source.other` | 41,978 | 2,545 |
| `finance.current` | 525 | 2 |
| `finance.other` | 493 | 333 |
| `bcs.planner.projection-period` | 1,357 | 3 |
| `bcs.planner.expected-period` | 1,357 | 3 |
| `bcs.planner.source-ref` | 213,005 | 1,728 |
| `bcs.planner.expected-ref` | 213,004 | 1,772 |
| `canonical.evidence-ref` | 8,167 | 97 |
| `unlabelled` | 133,332 | 7,506 |
| **Digest total** | **788,629** | **16,246** |

`canonical.direct` records **1,316 calls / 402 inclusive ms**, outside internal digest canonicalization. `authority.principal` records **35,497 calls / 13,245 inclusive ms**; `state.read.total` records **1,075 / 3,960 ms**. These span families overlap. Their durations must not be added to the digest total or interpreted as exclusive CPU time.

### The four original BCS sites

The two period populations each have 1,357 calls and 3 inclusive ms: **2,714 period hashes / 6 ms** together. The two reference populations have 213,005 and 213,004 calls: **426,009 reference hashes / 3,500 ms** together. All four BCS sites total **428,723 hashes / 3,506 inclusive ms**.

The original expression evaluates the source-reference hash before the expected-reference hash. A settled-span checkpoint can occur between them. The one-call difference is compatible with that prefix cut; it is **not evidence of mismatch, a skipped hash, memoization or 213,005 completed comparisons**. Both original sites remain in the diagnostic source.

The remaining `unlabelled` population has **133,332 calls / 7,506 inclusive ms** and remains unattributed. The measured BCS counts do not select an optimization or establish how much wall time a hypothetical change would save.

At the last checkpoint, only `http.preview` is pending: 1 call, 0 settled, 1 pending. Earlier snapshots also include an unfinished principal span. These are cumulative prefixes; no final summary establishes backend completion or unwind. Integer rounding and unsettled spans can produce zero millisecond values.

### Context proof, selector and Root

| Observed path at 50,008 ms | Business | Root |
|---|---:|---:|
| Context captures | 72 | 5 |
| Attested captures | 72 | 5 |
| Current checks | 320 | 68 |
| Fast current checks | 320 | 68 |
| Provenance/environment hits | 464 | 78 |
| Current inclusive ms | 2 | 0, rounded |

The counts satisfy `464 = 2 × 72 + 320` and `78 = 2 × 5 + 68`. Mint proof-attempt and registration each occur once. No fallback, provenance-miss or environment-rejection bucket was emitted in this prefix. The context proof concerns immutable data; it does not replace live authorization.

The case-identity selector has **71** factory, registration, eligible-read, narrow-span and original callback entries. The narrow clone/project/await span settles all 71 calls and records 41 inclusive ms. The full clone/callback/await span settles 567 calls and records 2,692 inclusive ms. Both spans include their original callbacks and awaits, so they are not a controlled cloning benchmark.

Root prepare, initialize, owned-ready and physical-callback entries each occur five times. No `root.caller.*` bucket is present; those caller counters cover **PlannerCalculationServices only** and exclude the direct Finance caller. Their absence does not mean Root was unused or attribute every Root entry to Finance.

## Interpretation boundaries

- The full original declaration and readbacks are required for qualification. This incomplete diagnostic adds no accepted surface.
- Scope begins **before human.admit**. Added labels and diagnostic bookkeeping impose overhead; no causal comparison with Portfolio25, Portfolio23 or earlier runs is claimed.
- Durations are cumulative, inclusive and rounded. Do not add overlapping families or add checkpoint totals across time. Only the 11 same-name digest populations are combined for the digest total.
- Direct-caller labels do not identify complete ancestry. `canonical.direct` excludes internal digest canonicalization; neither canonical bucket measures all serialization or CPU.
- `state.read.identity-absent` is **1,004** across namespaces and arbitrary callbacks, not a count of missed private-selector opportunities.
- A `baseline-accessor` rejection would precede getter/setter identity comparison and would not prove those identities equal. No such rejection bucket was emitted.
- Physical-callback entries are not independently identified physical roots, accepted commits or completed requests. Aggregate counts are not per-object joins.
- Zero drop/error counters apply to emitted checkpoints. The HTTP span is pending and no final snapshot exists.
- The first History body was unavailable despite HTTP 200; the second has `status: ok`. No causal relation to the preview timeout is asserted.
- No global intrinsic hooks or extra authority/provider queries are introduced by the diagnostic. This archive authorizes no product change.

[aggregates.json](aggregates.json) preserves all 46 last-checkpoint buckets, per-snapshot audits, totals for the 11 digest populations, the original BCS site split and all interpretation limits. [profile.json](profile.json) preserves every profiler payload, timestamp and source line, including the original `scopeOrigin`, limits, pending counts and periodic summaries.

## Original evidence and visual review

The final log contains **922,845 characters** and **1,856 split lines** including its trailing empty line. **The raw log is not archived.** All **351 structured emissions** are preserved by original payload or exact reversible image-chunk reconstruction.

| Marker | Original emissions | Archive |
|---|---:|---|
| `SF_PORTFOLIO_READONLY` | 236 | [profile.json](profile.json) |
| `SF_DESIGN_STAGE` | 46 | [source-events.json](source-events.json) |
| `SF_ANALYTICS_SOURCE` | 25 | [source-events.json](source-events.json) |
| `SF_ANALYTICS_CONTEXT` | 2 | [source-events.json](source-events.json) |
| `SF_ANALYTICS_CAPTURE` | 6 | [source-events.json](source-events.json) |
| `SF_DESIGN_DIAGNOSTICS` | 3 | [source-events.json](source-events.json) |
| `SF_DESIGN_PREVIEW` | 33 | Original JPEGs and [manifest.json](manifest.json) chunk records |

The 33 preview chunks are complete, unique and **1-based**, with consistent totals. They reconstruct seven original JPEGs totalling **536,652 bytes**. Canonical base64 round-trips, JPEG boundaries and dimensions were checked. Remote image readbacks match the original reconstructed base64 exactly. Image and chunk hashes, timestamps, source lines, chunk lengths and original emission order are retained; the original chunk data can be reconstructed from each JPEG and its recorded lengths.

| Original JPEG | Dimensions | Bytes | Visible state |
|---|---|---:|---|
| [UI42-list-dark-desktop-test-data](gallery/UI42-list-dark-desktop-test-data.jpg) | 1440 × 1100 | 80,513 | Two authorized cases, versions 2 and 6 |
| [UI42-list-light-desktop-test-data](gallery/UI42-list-light-desktop-test-data.jpg) | 1440 × 1100 | 85,798 | Two authorized cases, versions 2 and 6 |
| [UI42-list-dark-390-test-data](gallery/UI42-list-dark-390-test-data.jpg) | 390 × 844 | 28,672 | Stacked readable case cards |
| [UI42-list-light-320-test-data](gallery/UI42-list-light-320-test-data.jpg) | 320 × 800 | 27,434 | Stacked readable case cards |
| [UI42-empty-authorized-case-test-data](gallery/UI42-empty-authorized-case-test-data.jpg) | 1440 × 1100 | 97,845 | No eligible scenario; preview inactive; history text empty |
| [UI42-configure-focused-candidate-test-data](gallery/UI42-configure-focused-candidate-test-data.jpg) | 1440 × 1100 | 106,284 | Candidate v1 and constraint v2 selected; limit 4 |
| [FAILED-native-wave-three-test-data](gallery/FAILED-native-wave-three-test-data.jpg) | 1440 × 1100 | 110,106 | Running; preview unavailable; history empty |

`/root/root_cost` viewed each original JPEG individually. [visual-review.json](visual-review.json) records image-specific observations and limits. It does not attribute a visual review to root.

Artifact [14761482458](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45040443689/artifacts/14761482458), `playwright-ubuntu-24.04-1`, is **8,816,416 bytes**, with digest `sha256:1048c7e46c0359bef60a982dda6a735425bd8f1e76e7c2c42b8692bf4c253ec2` and reported expiry **2026-11-29T16:00:29Z**. The ZIP was not downloaded. The seven original emitted JPEGs are preserved here independently of that expiry.
