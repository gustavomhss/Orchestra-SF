# Portfolio metric batch forwarding

Status: **qualified for capability forwarding and source/authority equivalence**. Installed Portfolio preview latency remains open.

## Exact candidate and execution

The product candidate is [ad5ed29c582752b72ee91ddd03bb2622bff7299a](https://github.com/gustavomhss/Orchestra-SF/commit/ad5ed29c582752b72ee91ddd03bb2622bff7299a), based on `84c85b406f55dbb9c4f62e7ded29fee8abcdcbbf`. Its only two changes are `apps/cli/src/sucafina-product/portfolio-authority.ts` (blob `3404aa793a7c73f370a750c4dadc9f6410379706`) and the original Finance integration test (blob `b11a8727790131190664d21d4e230a59b74ae453`).

[Actions run 45000105434](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45000105434) used the existing `test-ci` workflow, snapshot `e2f0c197c39302b04fc3151a762e23fa3c037210`, Linux `ubuntu-24.04`, strict Omni and the production channel. The request and snapshot-only wrapper are byte-identical to Comparison2 snapshot `e89f34c8a94bbece6e4443c77f561aee977b71c0`; its filter selects only the following two gates.

| Gate | Outcome |
|---|---|
| CLI package typecheck | Passed; exit code 0 |
| Original Finance integration | Passed; one group, 145 assertions, zero failures |

Test job `137139546983` and cleanup job `137140053936` both succeeded. This execution did not run app-shell types, E2E types or a browser journey.

The [machine-readable receipt](attempt-01.json) retains the measurements and exact source/configuration identities. The original execution log remains in [Actions test job 137139546983](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45000105434/job/137139546983). The raw job-log copy was removed from the repository in response to the original `agent-scratch` guard; no renamed copy or guard exception is used. GitHub returned no workflow artifacts for this Bun run; no artifact ZIP or SHA-256 is claimed.

## What changed

The metric consumer previously supplied only `resolve` even though its canonical scenario producer offered `resolveMany`. The candidate forwards that existing capability through the original `resolvePlannerScenarioBatch` helper. It retains the helper's cardinality and cloning fence, keeps both independent comparator phases, and records only invocation-local observations for the existing final stored-result comparison.

The original planner owner, scenario object and reader functions are pinned before awaited work. A changed method or owner is rejected without invoking the replacement or replaying the comparison. If the optional batch capability is absent, the four original scalar calls remain.

No producer, schema, source data, grant, admission, comparison cache, lease or workflow changed.

## Verified behavior

| Measurement | Scalar calls | Batch calls | Scenario references | Result |
|---|---:|---:|---:|---|
| Metric using original batch | 0 | 2 | 4 | Exact full value equals scalar fallback |
| Metric without batch capability | 4 | 0 | 4 | Original scalar fallback succeeds |
| Public conditioned comparison | 0 | 7 | 14 | Full result equal with and without physical grouping |
| Missing rule | 0 | 3 | 6 | Original unknown result; no owned root |
| Replaced batch method | 0 | 1 | 2 | Stale; replacement invoked zero times |
| Replaced planner owner | 0 | 1 | 2 | Stale; replacement invoked zero times |
| Short batch derived from actual results | 0 | 1 | 2 | Unavailable: `scenario-batch-invalid` |

The two metric batches retained the exact original pair and ordering in separate phases. Repetition returned the same complete values and counters. Existing revocation, source drift, changed human rule, changed resolver, changed lookup after final root and changed owner after final root remained refusals. These checks retain original producers and authority; the malformed short batch is explicitly a negative specimen derived from their actual returned values.

### Counter interpretation

The old Comparison2 `work=8` counted only scalar-facade calls. It omitted batch calls made by the outer comparator. The new logs include `scenarioReads.scalar`, `scenarioReads.batch` and `scenarioReads.references`; metric/comparison `work` counts those reference occurrences. The new 14 and the old 8 are different measurements, not evidence that original work was removed or duplicated.

Within this run, an ungrouped metric used 2,041 physical reads with its original batch and 2,501 with the scalar capability fallback; values remained equal. The corresponding observed durations were 1,176 ms and 1,399 ms. An owned pair used two roots, 118 physical reads and 985 ms; its repeat used 961 ms. These are measurements from this one integration fixture, not a promise about the installed UI.

## Practical limits and next diagnostic boundary

The original Finance fixture stores both scenarios at the same historical case revision. The installed fixture promotes alternatives sequentially. The producer groups cases by the complete historical case reference, so those installed revisions may continue to require separate case observations.

Portfolio16 independently confirmed that physical roots were entered in the installed path and that the old metric facade omitted an available batch capability. This qualification proves the forwarding correction. It does not establish that the installed preview meets its unchanged 60-second budget, and it does not replace a corrected installed journey.

The next proposed diagnostic is a disposable observation of the original call chain, with no additional provider reads:

1. `modules/sucafina/Sucafinav1/product/decisions/case-port.ts`: separate the initial/final namespace reads, each evidence-access phase and each original scenario-operation guard.
2. `apps/cli/src/sucafina-product/scenario-operation-access.ts`: retain the source-fence and source/project/source order; aggregate durations by the existing phase and root.
3. `apps/cli/src/sucafina-product/planner-evidence.ts`: separate first source resolution, first authorized snapshot projection, synchronous financial projection, second snapshot read and final source resolution.

An invocation-local diagnostic parent can distinguish evidence-driven projections from operation-guard projections. No production edit or additional CI for that proposal is part of this receipt.

## Attempt ledger

| Attempt | Product | Snapshot | Outcome |
|---|---|---|---|
| 01 | `ad5ed29c582752b72ee91ddd03bb2622bff7299a` | `e2f0c197c39302b04fc3151a762e23fa3c037210` | Both gates and cleanup passed |

