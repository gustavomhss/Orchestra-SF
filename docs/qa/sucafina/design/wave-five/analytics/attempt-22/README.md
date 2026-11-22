# Portfolio25 — caller and direct-canonical diagnostic

**Result: diagnostic failure; no qualification increment.** The original first analytics declaration reached its first native portfolio preview request, then failed at the unchanged 60,000 ms `page.waitForResponse` deadline. It did not complete the preview, result readbacks or sensitivity journey. This archive contains evidence only and does not change the product or global qualification rollups.

## Run and source

| Item | Pinned value |
|---|---|
| Run | [45037958471](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45037958471), attempt 1, completed failure |
| Test job | 137255778039, completed failure at 2026-11-22T15:33:53Z |
| Cleanup job | 137259046881, completed success at 2026-11-22T15:34:02Z |
| Product | `e4cc03bb3fa6deaed5c66f0050ffebf878dfef5d` |
| Diagnostic snapshot | `fe306be28d7543d4ed3890a6e78d3d010e494486` |
| Snapshot tree | `12425b4db72fba250c11ba22cc3bbd6736e53609` |
| Snapshot parent | Portfolio24 `912deed79badd8684298ae9c3799f8ef5f15e016` |
| Selected spec | `db1d7f4f0d770e5eed811070b0814c0363083c62` |
| Request | `a11922821a47594d76397582be38f9b7940177ca` |
| QA parent | `5abb86723f00b287325e3ac274388bdda8adec8b` |
| QA parent tree | `bf2001eb939fb55c70e8a40f58f87b49a9144bf5` |

The selected spec is the full literal first declaration, with its original prefix helpers, from the permanent analytics spec `f4eb9a534b7a22fcf79e7ccb20bbfd9f8251ae74`. Its journey and deadlines were not truncated. The snapshot retains the 15 diagnostic/request/spec overlays; its two-file delta from Portfolio24 adds direct `canonicalSfValue` measurement outside active digest canonicalization. The QA commit contains none of those code overlays.

[receipt.json](receipt.json) preserves completed run/job/step metadata, snapshot provenance, the failure location and artifact receipt. Logs were acquired only after completed metadata; no additional execution or replay was performed for this archive.

## Original outcome

The first preview request is `POST` sequence 3 for `decision-portfolio-preview`, emitted at **2026-11-22T15:32:44.2291970Z**, source line 1252. There is no matching native response in the final log. The error at source line 1698 is:

> TimeoutError: page.waitForResponse: Timeout 60000ms exceeded while waiting for event "response"

The original failure location is `packages/app-shell/e2e/sucafina/design-wave-five-analytics.spec.ts:72:32` (source line 1707). Both earlier native history requests returned HTTP 200 with `ok`; those preparation responses do not qualify the preview or later journey. The final stage event is `decisions-ready`. The failure and page-closed diagnostics contain empty console/page-error arrays.

The failure JPEG visibly retains **Running**, **Preview is not yet available**, loading placeholders and an empty History. The six earlier captures cover the authorized list, responsive list, empty case and prepared candidate configuration. No image shows a completed preview, recorded result or sensitivity view.

## Profile at the last emitted checkpoint

The archive preserves **211 profiler records**: one started record, 205 bucket rows and five periodic summaries. All five checkpoints were emitted by settled spans. Each contains 41 distinct keys; their inventory is unchanged across the five snapshots. Calls equal settled plus pending, cumulative values are monotonic, and summary pending counts match the bucket rows. All five summaries report zero bucket/root/line drops, diagnostic errors and skipped periodic thresholds. There is **no final snapshot**.

| Snapshot | Elapsed ms | Keys | Pending spans | Digest calls across six surfaces | Digest inclusive ms |
|---|---:|---:|---:|---:|---:|
| 1 | 10,006 | 41 | 1 | 85,669 | 2,702 |
| 2 | 20,000 | 41 | 1 | 265,093 | 6,218 |
| 3 | 30,001 | 41 | 3 | 401,445 | 9,395 |
| 4 | 40,000 | 41 | 2 | 575,307 | 12,960 |
| 5 | 50,041 | 41 | 3 | 697,487 | 16,167 |

The last `canonical.digest` population is partitioned by five direct-caller labels plus `unlabelled`. There is one digest span per invocation; the following rows may be summed **within that bucket name**.

| Direct-caller surface | Calls | Inclusive ms |
|---|---:|---:|
| `unlabelled` | 504,197 | 10,914 |
| `source.scope-validation` | 60,829 | 476 |
| `principal.direct` | 94,080 | 1,762 |
| `source.other` | 37,376 | 2,630 |
| `finance.other` | 489 | 383 |
| `finance.current` | 516 | 2 |
| **Digest total** | **697,487** | **16,167** |

`canonical.direct` records **1,167 calls / 428 inclusive ms**, excluding internal digest canonicalization. `authority.principal` records **31,360 calls / 12,715 inclusive ms**. These are overlapping span families: their durations must not be added to the digest total or treated as exclusive CPU time. The large `unlabelled` population has not been assigned to a caller by this measurement.

At 50,041 ms, three entries remain pending: `http.preview` (1 call, 0 settled), `state.read.total` (954 calls, 953 settled), and `state.read.full.clone-callback-await` (507 calls, 506 settled). They may be nested. Zero or rounded millisecond values do not establish zero cost, and the absence of a final summary does not establish backend completion.

### Context proof, selector and Root observations

| Observed path at 50,041 ms | Business | Root |
|---|---:|---:|
| Context captures | 64 | 5 |
| Attested captures | 64 | 5 |
| Current checks | 301 | 67 |
| Fast current checks | 301 | 67 |
| Provenance/environment hits | 429 | 77 |
| Current inclusive ms | 3 | 0, rounded |

Each provenance/environment count equals two capture checks plus current checks: `429 = 2 × 64 + 301` and `77 = 2 × 5 + 67`. Mint proof-attempt and registration each occur once. No fallback, provenance-miss or environment-rejection bucket was emitted in this observed prefix. The context proof describes immutable data; these counters do not turn it into a live authorization grant.

The case-identity selector has 63 factory, registration, eligible-read, narrow-span and original callback entries. The narrow clone/project/await span settles all 63 calls and records 52 inclusive ms. The full clone/callback/await span records 2,713 inclusive ms with one entry still pending. These spans include the callbacks and awaits; their populations differ, so they are not a controlled cloning benchmark.

Root prepare, initialize, owned-ready and physical-callback entries each occur five times. No `root.caller.*` bucket is present. Those caller counters cover **PlannerCalculationServices only**, excluding the direct Finance caller; their absence cannot establish that Root was unused or attribute all Root entries to Finance.

## Interpretation boundaries

- This is an incomplete diagnostic journey. The original declaration and readbacks are required for qualification; screenshots and preparation HTTP responses cannot replace them.
- The scope begins **before human.admit**. Diagnostic bookkeeping and direct-canonical measurement add overhead. No causal speed comparison with Portfolio23 or earlier attempts is claimed.
- Inclusive times overlap, use integer-millisecond rounding and describe cumulative prefixes. Only the six same-name digest populations are combined here.
- Digest labels identify direct labelled call sites, not full ancestry. `canonical.direct` excludes internal digest canonicalization; neither bucket is a complete measure of serialization or CPU.
- `state.read.identity-absent` is 891 across namespaces and arbitrary callbacks; it is not a count of missed private-selector opportunities.
- A `baseline-accessor` rejection would occur before getter/setter identity comparison; it would not prove those identities equal. No such bucket was emitted here.
- Physical-callback entries are not independently identified physical roots, accepted commits or completed requests. Aggregate counts do not provide per-object joins.
- Zero loss/error counters apply to the emitted checkpoints only. Three spans remain pending and no final snapshot exists.
- The diagnostic does not install global intrinsic hooks or add authority/provider queries. This archive selects no product change.

[aggregates.json](aggregates.json) retains all 41 last-checkpoint buckets, per-checkpoint audits, six-surface digest totals and the interpretation limits. [profile.json](profile.json) contains every original profiler payload, timestamp and source line, including `scopeOrigin`, limits, pending values and periodic summaries.

## Evidence preservation and visual review

The final log contained 913,949 characters and 1,809 split lines including its trailing empty line. **The raw log is not archived.** All **325 structured emissions** are retained by value or by exact reversible image-chunk reconstruction:

| Marker | Original emissions | Archive |
|---|---:|---|
| `SF_PORTFOLIO_READONLY` | 211 | [profile.json](profile.json) |
| `SF_DESIGN_STAGE` | 46 | [source-events.json](source-events.json) |
| `SF_ANALYTICS_SOURCE` | 24 | [source-events.json](source-events.json) |
| `SF_ANALYTICS_CONTEXT` | 2 | [source-events.json](source-events.json) |
| `SF_ANALYTICS_CAPTURE` | 6 | [source-events.json](source-events.json) |
| `SF_DESIGN_DIAGNOSTICS` | 3 | [source-events.json](source-events.json) |
| `SF_DESIGN_PREVIEW` | 33 | Original JPEGs plus [manifest.json](manifest.json) chunk records |

The 33 preview chunks are complete, unique and **1-based**, with consistent declared totals. Their original bytes reconstruct seven JPEGs totalling **536,633 bytes**. Canonical base64 round-trips, JPEG boundaries and dimensions were checked. Each remote image readback exactly matched its original reconstructed base64. The manifest records image and chunk hashes, source timestamps/line numbers, chunk lengths and original emission order; the exact chunk data can be recovered from those lengths and each original JPEG.

| Original JPEG | Dimensions | Bytes | Visible state |
|---|---|---:|---|
| [Dark desktop list](gallery/UI42-list-dark-desktop-test-data.jpg) | 1440 × 1100 | 80,564 | Two authorized cases, versions 2 and 6 |
| [Light desktop list](gallery/UI42-list-light-desktop-test-data.jpg) | 1440 × 1100 | 85,857 | Two authorized cases, versions 2 and 6 |
| [Dark list at 390 px](gallery/UI42-list-dark-390-test-data.jpg) | 390 × 844 | 28,670 | Stacked readable case cards |
| [Light list at 320 px](gallery/UI42-list-light-320-test-data.jpg) | 320 × 800 | 27,442 | Stacked readable case cards |
| [Empty authorized case](gallery/UI42-empty-authorized-case-test-data.jpg) | 1440 × 1100 | 97,838 | No eligible scenario; preview inactive; history empty |
| [Focused candidate configuration](gallery/UI42-configure-focused-candidate-test-data.jpg) | 1440 × 1100 | 106,232 | Candidate v1 and constraint v2 selected; limit 4 |
| [Failure state](gallery/FAILED-native-wave-three-test-data.jpg) | 1440 × 1100 | 110,030 | Running; preview unavailable; history empty |

`/root/root_cost` viewed every original JPEG individually. [visual-review.json](visual-review.json) records image-specific observations and limits. It does not attribute a review to root.

Artifact [14760498775](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45037958471/artifacts/14760498775), `playwright-ubuntu-24.04-1`, is 8,826,358 bytes with digest `sha256:ff4e70307b7057a21e4449ba4f74f91b284e907f165bb9a874c6309137342dd6`; its reported expiry is **2026-11-29T15:33:47Z**. The ZIP was not downloaded. The seven original emitted JPEGs are preserved here independently of that artifact expiry.
