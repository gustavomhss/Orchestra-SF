# CI performance: measured cost and execution ownership

Candidate: `29a4ea5d7a05c2afcb95d35a76555560b8184b9f`.
The infrastructure probe is [run 44658022066](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44658022066),
snapshot `8e5310af025120fb2f6b78c0261bbd42374e4c55`; its recorded state is **IN_PROGRESS**.
This document records code changes and diagnostic evidence, not a passing product qualification.

## Where the time went

The observations were captured at 2026-11-20 01:52:56 UTC (2026-11-19 in São Paulo).
These are eight historical `test-ci` requests, not eight successful release gates.
Durations below distinguish the whole job from its `Run tests` step; queue time is not included.
The [original observation snapshot](https://github.com/gustavomhss/Orchestra-SF/blob/99b7178d5f5721f7691dbcbb30c8897b481dbf2c/sf/ci/performance-observations.json)
records source SHAs, request URLs, completed-case timings and incomplete-log reasons.

| Shard | Run / original job log | Whole job | Test step | Status at capture |
| --- | --- | --- | --- | --- |
| 1 | [44646013868 / 135988658580](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44646013868/job/135988658580) | 45m18s | 43m37s | cancelled; incomplete suite |
| 2 | [44646018333 / 135988673159](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44646018333/job/135988673159) | 39m34s | 37m58s | failure |
| 3 | [44651344557 / 136006716047](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44651344557/job/136006716047) | incomplete capture | incomplete capture | in progress; truncated log |
| 4 | [44645900692 / 135988262742](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645900692/job/135988262742) | 43m18s | 41m21s | failure |
| 5 | [44645913808 / 135988306632](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645913808/job/135988306632) | 45m18s | 43m08s | cancelled; incomplete suite |
| 6 | [44651628624 / 136007663545](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44651628624/job/136007663545) | 39m24s | 37m07s | failure |
| 7 | [44645952434 / 135988445022](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645952434/job/135988445022) | 29m13s | 27m11s | failure |
| 8 | [44645956665 / 135988458050](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645956665/job/135988458050) | 18m11s | 16m45s | failure |

Shard 1 spent **96.3%** of its job inside tests: 2,617 of 2,718 seconds.
Its Bun setup took 39s, Omni 32s and sandbox dependencies 10s.
The six cache traces inspected for shards 1, 2, 4, 5, 7 and 8 missed the installed tree,
Bun packages, ripgrep and Omni caches. Cache repair removes repeated preparation; it cannot
by itself remove the roughly 43 minutes spent executing that shard's tests.
The 45-minute limit belongs to the surgical runner; `sf-ci` shards retain their 30-minute limit.

## One complete selection, distributed by historical cost

[`suites.json`](./suites.json) and [the gate](../../script/sf-ci/gate.mjs) remain authoritative.
[The planner](../../script/sf-ci/shard-plan.mjs) assigns the complete selected file list by
longest processing time first: the next most expensive file goes to the least-loaded shard.
Lexical file ordering and the lowest shard index break ties deterministically.
Every plan must be nonempty, complete and disjoint; duplicate paths and invalid costs fail closed.
The manifest selection grows from **883 to 884 files** because the static-contract regression
test was added. No selected file was excluded to achieve that change.

[`shard-costs.json`](./shard-costs.json) contains 170 weighted files from 777 observed files
across the eight sources. Its status is explicitly `HISTORICAL_RED_OR_PARTIAL`.
Weights are the maximum observed sum of completed Bun case durations per file, including failures.
Startup, imports, hooks and unfinished cases are not included; partial logs are lower bounds.
New files, omitted fast files and the four structurally changed static wrappers receive
the positive 10-second fallback. Invalidating a timing never removes its file from the selection.
An obsolete profile entry cannot introduce a file. `historicalLoadSeconds` is a scheduling
score, **not predicted wall time, a healthy latency baseline or evidence that tests passed**.
The same planner is used by selection, receipts and final verification; there is no second partition.

## Static execution has one owner

The four historical wrapper files retain their five cases as explicit wiring contracts.
They no longer start three additional Sucafina typechecks, four full repository guard runs
or repeated Git fetches inside the product suite. Their names describe contract checks.
The added regression file has 29 negative cases and one positive case.
It rejects missing commands, swallowed failures, environment injection, conditional ownership
and a verifier that stops requiring the actual static job.

`sf/static-and-contracts` still executes all seven package typechecks, generated-file checks,
E2E compiler inclusion, the Web build, spawn checks and guards against both required bases.
Its guard shell and approval bindings are preserved, including execution after an earlier failure.
The final `sf/verify` requires the real static conclusion and rejects failure, cancellation,
skipping or absence. Passing the wiring tests does not claim that these commands executed successfully.

## Cache scope and the job graph

The inherited cache warmer is disabled, including on the default `dev` branch.
The old actions restored caches while their save conditions excluded PRs and `ci-run-*` refs.
The updated `setup-bun` action keeps its keys and paths, adds an explicit save opt-in,
and reports exact hits, keys, install outcome and save-step outcomes in the job summary.
It also exposes `modules-cache-hit`, `bun-cache-hit` and `modules-cache-key`.

In the single `sf-ci` graph, preflight saves dependencies before product tests;
static and all Bun/UI consumers wait for it. The independent Omni producer saves its exact
binary cache and supplies same-run artifacts. Consumers then restore on the same PR/run ref.
An unsuccessful product test does not undo an already completed cache save.
A save-step success is not itself proof of a hit: the consumer must report an exact key match.

Ephemeral surgical branches remain restore-only. Sibling `ci-run-*` branches cannot read
each other's branch-scoped entries, so this patch does not make those requests warm.
The isolated [Linux-only shared-cache writer](https://github.com/gustavomhss/Orchestra-SF/blob/ef41c498af352b110cbe27c50510b12076e855f8/.github/workflows/sf-cache-warm.yml)
is implemented on `ci-cache-warm`; it binds one admitted source ref to its exact reviewed head SHA.
It must be installed and executed from the default branch before sibling reuse exists.
It is **not activated**. The inherited multi-platform workflow stays disabled.
The isolated probe checks producer/consumer reuse on one ref; it does not qualify the product.

## Updating weights without changing coverage

1. Capture original Actions logs and job timing metadata; retain run ID, job ID, source SHA,
   actual status and whether the suite and retrieved log completed.
2. Sum completed case durations under each file header, stop before repeated failure summaries,
   and retain failure/deadline costs. Never fill unfinished cases with invented successful durations.
3. Update source provenance and sparse costs together. Mark structurally changed timings invalid
   and keep the positive fallback. Preserve actual source statuses; a schema or method change
   requires its matching parser change, not relabeling a run to fit the existing schema.
4. In Actions, inspect `node script/sf-ci/gate.mjs plan CI-SF` and run planner/gate regression tests.
   Verify the selected-file union, disjointness and case inventory before comparing actual runtime.
5. Record any later performance claim against the exact tested SHA and observed cold/warm state.

## Qualification boundary

At this checkpoint the probe is still in progress, product runs remain red or incomplete,
and the authentic complete-run coverage baseline remains pending.
No source log, case assertion, guard, timeout or release-only ownership was relaxed.
A balanced plan or a warm cache does not authorize GO, change required checks or replace
a complete product run, its real receipts and the installed Linux/Azure acceptance evidence.
