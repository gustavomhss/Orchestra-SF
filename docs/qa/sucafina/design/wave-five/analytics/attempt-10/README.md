# Attempt 10 — Portfolio13 visible original request profile

The original 60-second preview wait failed. The diagnostic then observed the **same single POST**, without replay or an additional evaluation, until it returned HTTP 403 / denied / `decision-authority-changed` after 300,054ms. The original failure was rethrown. This remains a failed runtime qualification; UI43 and UI44 were not reached.

[Actions run 44992841677](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44992841677): test job `137117474010` failed; cleanup `137120612093` succeeded. Product `d8faa155002f0a9f3df029d946a026462af65e69`; diagnostic snapshot `754c9b996a5d9f63591acbf3ae3707da994fc885`. Existing workflow, production Playwright configuration, strict/prod environment. [Exact receipt](manifest.json).

## Evidence and limits

Two static snapshot-only stdout bridges forwarded the bounded `SF_PORTFOLIO_DIAGNOSTIC` JSON markers. Timers surrounded original method bodies; providers were not replaced. All original inputs, source checks, five-minute admission and permanent 60-second response budget remained intact. The overlays listed in the manifest must not enter product.

The logs contain 538 parseable records from 11 requests, including 294 records for preview request 11. There were **zero periodic snapshot records**. Start/end records nevertheless show 20 completed metrics and 80 completed canonical scenario resolves, with no pending recorded span at the final response and `aborted:false`. Each metric took 5,868–6,055ms. This demonstrates continuing finite work through the final metric at 295,313ms; it does not establish an outstanding resolve in deadlock.

The original Finance wrapper was invoked 20 times. These markers count logical invocations, **not physical read roots**. The logs cannot establish whether the wrapper owned a root or followed its original fallback.

| Recorded span | Calls completed | Inclusive milliseconds |
| --- | ---: | ---: |
| Preview handler | 1 | 299,998 |
| Selection read | 2 | 135,884 |
| Canonical comparison | 4 | 135,813 |
| Metric reader | 20 | 119,270 |
| Metric pair observation | 20 | 113,923 |
| Canonical scenario resolve | 80 | 99,876 |
| Metric historical read | 20 | 5,277 |

These categories nest. **Do not add their durations.** Four comparisons contain the first eight metrics. The two selection intervals are 4,157–72,019ms and 72,495–140,516ms. After the second selection, 159,482ms remain before handler completion. The twelve subsequent metric intervals account for 71,644ms of that disjoint interval; 87,838ms remain unassigned by these spans. Rounded begin/end offsets can differ by 1ms from an independently rounded duration.

[All profile events](profile.json) and [preview intervals](preview-intervals.json) preserve underlying counters and timestamps. The profile did not instrument the actual comparison-binding proof path or complete analysis tail, so the unassigned intervals are not relabeled as proof, assess or persistence duration.

## Source interpretation

The unchanged source explains additional comparisons and direct rule evaluations after selection: `portfolio/analysis.ts` invokes the planner comparator, `planner/persistence.ts` validates before and after its original write, and `decisions/criterion-comparison.ts` validates binding proofs and rules around its own original write. In this conditioned fixture, a successful comparison evaluates the criterion twice and each evaluation takes one metric read. The confirmed-metric branch would execute additional verification reads; that is not the branch counted here.

The twelve later metrics are consistent with the ordered source sequence 2+2+3+3+2 (analysis comparison; persistence validation; binding validation with direct rule evaluation; first binding-read validation; second replay comparison). This mapping is a **source inference**, not profiler call-site identity. The lease ended before the later selection rereads in `analysis.ts`; 20 metrics therefore do not represent the full successful workload.

The next candidate groups only the complete readonly comparator and each direct planner comparison, retaining original criteria and all revalidation. It does not group preview, selection registration, analysis, persistence or binding writes. No performance outcome is claimed until its own Actions measurement and clean native journey finish.

## Original source and captures

Original source comparisons returned 200/ok in 34,499ms and 34,238ms. Original human selection registration returned 200/ok in 103,014ms, with version 1, case version 6, exact original pair and criterion readbacks. Runner/instrumentation differences mean these times are not a controlled comparison against another attempt.

Seven original Chromium JPEGs are durable. Only [the final refusal](FAILED-native-wave-three-test-data.jpg) was emitted and visually inspected in this attempt. The source-changed notice and unavailable preview remain visible in the native surface; this is diagnostic content, not approval. The other six images are explicitly unreviewed. Canonical artifact `14742921298` retains full PNG/trace evidence; its digest is recorded in the manifest.

No UI43 result, UI44 sensitivity result, completed explicit evaluation or five-area acceptance is inferred from this attempt.
