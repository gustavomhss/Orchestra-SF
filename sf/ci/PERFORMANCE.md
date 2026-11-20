# CI performance: measured cost and execution ownership

The follow-up is integrated: [PR #425](https://github.com/gustavomhss/Orchestra-SF/pull/425) into
`sf-join-four` and [PR #429](https://github.com/gustavomhss/Orchestra-SF/pull/429) into `dev`.
The real default writer and a fresh canonical `test-ci` consumer both completed **SUCCESS**.
The consumer restored the exact `modules-v5` tree in **11.508s**, skipped installation and passed
**29 tests in two files**; its test job took **50s**. These are scoped observations, not a full-suite speedup.
The [closure record](#follow-up-closure-and-operational-proof) below retains all probe failures and remaining qualification gates.

The CI rescue is integrated into `sf-join-four` through
[PR #413](https://github.com/gustavomhss/Orchestra-SF/pull/413), merge
`72830e53adfcb2059575b249e76c88753beb04e8`.

The pre-integration implementation `8b65f3f1ec7b1a5f558a84b325b8bdbd4f4fc7ba`
passed [run 44658705334](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44658705334)
on snapshot `47a0973d517908487c1e908767052e05886f9651`: 155 focused tests,
Sucafina typecheck and same-ref cache reuse. That historical probe included
its isolated workflow, the original selector for equivalence and a copy of the cache writer.

The post-integration [probe 44661129868](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44661129868)
passed **176 focused tests and the real Sucafina typecheck** in 1m48s on snapshot
`d08f56805155240c9295cc6abfe6cf4951bf9500`. Its reviewed source candidate was
`e23e850fd30d450a67165b407b10b131f38f63e1`, including the explicit Planner fixture
precondition from [PR #418](https://github.com/gustavomhss/Orchestra-SF/pull/418), merged at
`c7fc8b4cfc809e8ba46ab7a3ad48dcae2ec46e61`. The exact probe scope and the earlier RED
result are recorded below. Shared default-branch caches are now installed and their
consumption from a fresh restore-only branch has been observed.

These are infrastructure and integration proofs. They do not measure or qualify the complete product suite.

## Follow-up: complete cache inputs, timings and reproducible shard requests

[PR #425](https://github.com/gustavomhss/Orchestra-SF/pull/425) merged at
`c74724c3e82f9a3fd3bdf2cd5492d966069caed8`. Its reviewed code source was
`b5312caba2a8825c2061dfafab926a3feed370cf`; the default companion
[PR #429](https://github.com/gustavomhss/Orchestra-SF/pull/429) merged at
`c777c057b23f40d835c2c26387954202d4bad4c4`.
Validation is recorded separately from the historical observations below.

The installed tree uses `modules-v5`. Its pre-install fingerprint includes the lockfile, root configuration,
workspace manifests from the admitted workspace patterns, declared patches, local package archives,
the actual node-pty postinstall source/configuration, the action/helper recipe, Bun version, Node ABI and production mode.
Discovery is bounded and never walks installed dependencies. Unsupported hooks or local dependency forms fail
explicitly; future dynamic postinstall inputs must be added to this policy. A miss installs with a frozen lockfile.
A hit skips installation and setuptools. Callers that already prepared Node 24 use `reuse-node: "true"`;
the action checks the major before using it.

A shared-cache source can be promoted through a reviewed change to `.github/sf-cache-source.json` on `dev`:

```json
{
  "schema": 1,
  "sourceRef": "sf-join-four",
  "sourceSha": "<exact reviewed 40-character integration head>"
}
```

The default-branch writer reads that promotion only when the file changed in the push.
Ordinary dependency pushes still use their own exact `dev` source; a stored promotion does not silently override them.
Both paths preserve the admitted-ref check, live-head equality, exact checkout, read-only token and Linux x64.
A source that advances before the writer verifies it fails closed; refresh the reviewed promotion instead of
bypassing its check. The retained pin records a past promotion, not a claim that the current head is still warm.

Bun jobs retain a separate `timings.json` from the JUnit they already produced, including green jobs.
The sidecar records source SHA, run/attempt, job name, suite/directory/shard, step conclusion, partial capture
and observed file/case durations. File cost is the sum of captured case durations; it does not claim to include
unreported fixture/setup time or to equal wall time. Missing or malformed reports from failed steps are explicit;
success without a report cannot become a complete timing observation.
Focused Sucafina `test-ci` requests also emit JUnit and are always marked partial.
These performance artifacts never use the acceptance-artifact prefix and do not change acceptance receipts.

The cost parser retains legacy v1 historical inputs and admits strict v2 `OBSERVED_TIMINGS` provenance.
No green weight is fabricated and the 170 historical weights remain unchanged.
New observations can be reviewed before recalibration; a smaller modeled load is not proof of a faster suite.

Before the next complete product batch, generate requests from the same integrated source and plan:

```sh
node script/sf-ci/gate.mjs plan CI-SF > sf-shard-plan.json
node script/sf-ci/shard-adoption.mjs generate \
  --plan sf-shard-plan.json --source <integrated-source-sha> --out <new-batch-directory>
```

Generation writes `batch.json` and eight requests; it does not dispatch tests. The publisher must create each new
ref without overwriting a prior attempt. Each snapshot has exactly one source parent and changes only `.ci-run.json`.
Before installing dependencies, `test-ci` checks its actual parent/diff/ref, regenerated plan digest and exact request.
Generated requests and manifest-selected Bun jobs prefix file arguments with `./`, matching the canonical uploader's
explicit-file behavior while leaving selection inventories and receipt digests unchanged.
The eight collected bindings can be checked with `verify-batch`; all are labeled `selection-only`.
Existing focused requests remain supported, but a managed shard ref without its binding fails.
An old snapshot cannot acquire this behavior by rerunning its old SHA.

Test steps now finish before their existing job ceilings: surgical 40/45 minutes, SF shards 26/30,
other Bun families 24/28 and UI journeys 20/24. Individual test deadlines, retries and assertions are unchanged.
The remaining time is a diagnostic opportunity, not a guarantee against a stalled setup or hard runner termination.

The full product run stays reserved until the active WPs are closed. The next integrated run must still provide
authentic case coverage, reconcile pending/stale baselines and measure actual shard wall times and runner minutes.

### Follow-up validation history

The first scoped [probe 44665814246](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44665814246),
snapshot `95bf65fdd974976d0c663c443718030600c97a8b`, remained **RED**.
It passed 133 of 134 Node controls and all 13 Python timing tests. The workflow ownership guard
correctly rejected an additional run script until timing collection received a narrow explicit contract.
The default-candidate fingerprint also exposed a Bun Transpiler limitation with the real postinstall shebang;
only the import-analysis string was corrected, while the fingerprint retains the original bytes.
No Bun product tests or real JUnit timing proof ran in that first attempt.


The second scoped [probe 44667265276](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44667265276),
snapshot `a2d58a3ecf23a645689fb37e204af5bc177ed229`, also remained **RED**.
All 287 targeted regressions passed: 137 Node, 13 Python, 102 Bun cache/runner and 35 real static-ownership cases.
The real JUnit collector and unchanged acceptance identity agreed on all five selected files; request generation
covered 888 files in eight disjoint parts without dispatching them. Frozen installs passed on both SF and the
default candidate, and the complete input fingerprint was unchanged after installation (64 inputs, 36 module paths).
The cold installs took 24.69s for SF and 20.26s for the default candidate; these are single install observations.
Core typecheck passed. Sucafina typecheck exposed the inherited `summary-settings.test.ts` fixture passing an
unbranded string as an `AbsolutePath`. The probe also wrote diagnostic logs inside the checkout, which the
scratch-file guard correctly rejected. Those logs belong in the runner temporary directory.
Two additional protected-path findings against `origin/dev` were already present in the SF source; they require
separate integration review and are not cleared by this CI optimization or by a successful focused guard.


### Follow-up closure and operational proof

The source-bound [probe 44668900773](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44668900773/job/136064849329)
executed snapshot `125b6f37d1353506cde20a01feb7c4d0c5cbd2b5`. Its only differences from the reviewed
source `b5312caba2a8825c2061dfafab926a3feed370cf` are two isolated proof files, neither merged into SF.

| Component actually executed | Result |
| --- | --- |
| Node gate/profile/cache-promotion/shard-binding controls | 137 pass, 0 fail |
| Python timing producer | 13 pass |
| Bun cache and surgical-runner controls | 102 pass, 0 fail |
| Static ownership and real explicit-file JUnit | 35 pass, 0 fail |
| Real Summary Settings fixture | 7 pass, 0 fail; 5,532 assertions preserved |
| Total targeted tests | **294 pass** |
| Core and Sucafina package typechecks | Both **SUCCESS** |
| Spawn imports | 5,157 files checked; 71 admitted sites; **SUCCESS** |
| Strict guard against pinned SF base `23f851dbc6b86c0a571dd95f4b2bb2558b9dc1cd` | 78 rules, 23 changed paths, **0 gates, 0 warnings, 0 errors** |

The whole run remains **RED**: preparation of the historical comparison worktree attempted to smudge a
missing 94 MB Git LFS quarantine object and failed before the default-base comparison. The earlier
[workflow-validation attempt 44668762966](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44668762966)
also remains RED; it created no jobs because the temporary probe used a runner context at the wrong YAML level.
The fixture fix and all executed checks above are not relabeled by either auxiliary failure.

The [guard supplement 44669419937](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44669419937/job/136066538518),
snapshot `f4909f2d9efe4bde784f30ed817deba50a7119c8`, adds only its isolated workflow to the same reviewed source.
It uses checkout-equivalent LFS handling and actually completed the inheritance comparison:
both SF baseline and candidate have the same two `protected-paths` findings against `dev`, with
`approved: []`, no bootstrap/setup errors, the same merge-base and **zero newly introduced gates**.
The protected blobs and guard engine were also checked unchanged.
Its focused guard reported 78 rules, 22 paths and zero gates/warnings/errors.
That whole supplement remains **RED** because a redundant spawn check lacked installed workspace dependencies;
the original source proof had already passed that check with dependencies installed.
The evidence is composed from these exact results, not a claim that either entire diagnostic workflow was green.

The global SF comparison with `dev` therefore remains **BLOCKED_INHERITED** for `godfile-waivers.json`
and `script/spawn-allowlist.json`. Their historical approvals in PRs #243 and #337 do not become approvals
for a new integration. This follow-up applied no approval label or simulated approval.

For the default writer, [run 44670478053](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44670478053)
completed **SUCCESS** on snapshot `e63efe1914ddcb2d86bb591bf97c4bf146b71e17`, adding only one proof workflow
to final default candidate `d49548646d0ca59b7712b9048d7047ee059cd541`.
The actual promotion resolved to reviewed SF source `95d3ffdc5478edcfa0ce012ba7f367ef7ab39259`;
22 promotion controls passed, and strict guards against `origin/dev` reported 78 rules, 9 paths and zero
gates/warnings/errors. The earlier [promotion proof 44670175392](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44670175392)
also passed. A concurrent SF advance changed only product/docs/test paths; the pin was refreshed and validated
before merging instead of bypassing the live-head check.

[Writer 44670593832](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44670593832),
[job 136070330738](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44670593832/job/136070330738),
completed **SUCCESS** after the default merge. The log confirms `reviewed-promotion`,
`Cache scope=refs/heads/dev`, live-head equality and checkout of
`sf-join-four@95d3ffdc5478edcfa0ce012ba7f367ef7ab39259`.
The installed tree missed; the frozen install completed 2,953 packages in **20.47s**, and the writer saved:

```text
Linux-X64-modules-v5-8203f9ed54ed7097f7b51057049bfe9b2d0639c34535573853b2bbee2a18a586
```

Bun downloads, ripgrep and Omni had exact hits. The writer job took **71s** (the run took 74s).

The fresh canonical [consumer 44670849654](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44670849654)
also completed **SUCCESS**. Snapshot `2f84c5a5a4523a6171cc4489d1763de89cff73fd` has exactly one parent,
the reviewed source above, and adds only `.ci-run.json` (blob `15fa51dfb94fca3c1320e2987467fad1cf314030`).
It ran on the previously nonexistent ref `ci-run-linux-cacheproof-95d3ffdc5478-44670593832`.

| Fresh consumer observation | Actual result |
| --- | --- |
| Installed dependency cache | Exact hit on the writer's `modules-v5-8203f9ed...` key |
| Fingerprint | 60 ms |
| Installed-tree restore | **11.508s** |
| Complete `setup-bun` step | **14s** |
| Second Node setup, Bun-download restore, setuptools, install and both saves | All skipped; save requested was false |
| Ripgrep and Omni caches | Both exact hits |
| Tests | **29 pass, 0 fail**, two explicit files; Bun reported **3.55s** |
| Test job / cleanup job | **50s / 4s**, both SUCCESS |
| Fresh ref after cleanup | Removed; subsequent lookup returned 404 |

The two files were Microsoft Entra client tests and the corrected Summary Settings fixture.
The real collector reported `capture: partial`, two files and 29 cases.
The separate [performance artifact](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44670849654/artifacts/14600206024)
has digest `sha256:da1a320900e7e7a5f98af2dd1468a53f398040739d59cb44e955c414910f5e20`.
Its observed retention ends on 2026-11-27; this document retains the measured summary and provenance.
The Omni control was correctly `not applicable` because none of these selected tests declared a spawn;
this proves a binary-cache hit, not execution through Omni.

The writer-to-new-ref reuse path is now observed end to end. The 71s writer, 50s focused consumer and
294-control source proof are different scopes; none is a before/after measurement of the complete product suite.
The 170 historical shard weights remain unchanged. No complete eight-shard batch or `sf-ci` was dispatched,
and pending baselines, product WPs, global integration clearance and Azure qualification remain open.

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
The rescue added its static-contract regression test, taking the pre-integration selection
from **883 to 884 files**. The first post-merge probe observed **886 files** after the concurrent Atlas and Planner test additions; the original and optimized selectors agreed exactly on that integrated tree. No selected file was excluded.

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
The first rescue kept the then-current keys and paths, added an explicit save opt-in,
and reports exact hits, keys, install outcome and save-step outcomes in the job summary.
It also exposes `modules-cache-hit`, `bun-cache-hit` and `modules-cache-key`.

In the single `sf-ci` graph, preflight saves dependencies before product tests;
static and all Bun/UI consumers wait for it. The independent Omni producer saves its exact
binary cache and supplies same-run artifacts. Consumers then restore on the same PR/run ref.
An unsuccessful product test does not undo an already completed cache save.
A save-step success is not itself proof of a hit: the consumer must report an exact key match.

Ephemeral surgical branches remain restore-only. Sibling `ci-run-*` branches cannot read
each other's branch-scoped entries; they reuse matching entries made available from the default branch.

The Linux-only shared-cache writer was installed on default `dev` by
[PR #408](https://github.com/gustavomhss/Orchestra-SF/pull/408), merge
`8e537a29fa5f1f8900d60d3231fa19625859accb`.
[Seed run 44660364678](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44660364678)
completed **SUCCESS** in 1m59s. Its [job 136036809773](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44660364678/job/136036809773)
confirmed `Cache scope=refs/heads/dev` and checked out the reviewed source
`sf-join-four@72830e53adfcb2059575b249e76c88753beb04e8`.
It saved installed dependencies, Bun downloads, ripgrep and Omni under these exact keys:

| Cache | Saved key |
| --- | --- |
| Installed dependencies | `Linux-X64-modules-v4-33ade1c6324fedd257063fa9cd550a093f21cb5b1f88b908cdddeecfdce0c812` |
| Bun downloads | `Linux-X64-bun-v3-9dba89b5073c640f02ea6a33dfbc2c175779544e55d5003358191ed07d5b15c7` |
| ripgrep | `ripgrep-archive-ripgrep-15.2.0-x86_64-unknown-linux-musl-33e15bcf1624b25cdd2a55813a47a2f95dbe126268203e76aa6a585d1e7b149c` |
| Omni | `omni-bin-v2-Linux-X64-97518c5742e25a49884d3106c8ac013f1765c5fc5eee51b24c8c175f8f5f5189` |

[Fresh-ref probe 44660638657](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44660638657)
ran restore-only from the new `ci-rescue-final` branch at
`de0f281cc824a84c064deb75266eb35d54ae5677`, whose source parent was `72830e53adfcb2059575b249e76c88753beb04e8`.
Its [job 136037730107](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44660638657/job/136037730107)
restored the exact installed-dependency key above and skipped installation, and restored the matching
ripgrep and Omni keys. This demonstrates consumption of the shared default-branch caches from
a different branch. The run remained **RED** because the real Sucafina typecheck found an inherited
Planner fixture error; the successful cache observations do not change that conclusion.
[PR #416](https://github.com/gustavomhss/Orchestra-SF/pull/416), merged into `dev` at
`69ac140f615c30d166af9038297a6462c6bdee3c`, removed the temporary bootstrap source pin.
The writer returned byte-for-byte to the reviewed 74-line workflow (blob
`db79f49db0b1e9d56ecd5d7510f8e9a7dc359f6e`). Automatic `dev` pushes use their own
ref and SHA; a manual SF refresh requires the admitted source branch and its exact reviewed head.
Default-branch scope, live source verification, Linux x86_64 and read-only permissions remain required.
The inherited multi-platform workflow remains disabled.

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

## Historical pre-integration validation

| Check | Actual result |
| --- | --- |
| Gate and LPT planner, Node test runner | 63 pass, 0 fail |
| Existing dependency-cache and surgical-runner tests | 57 pass, 0 fail; Omni positive control passed |
| Static ownership, including negative controls and the five former wrappers | 35 pass, 0 fail |
| Real Sucafina package typecheck | PASS; `bun run typecheck`, 35s in the final job |
| Original versus optimized selector on the same snapshot | Exact equality: 884 selected files |
| Eight shard partitions | Complete disjoint union, 110–111 files per part, no empty shard |
| Default-cache writer YAML | Parsed and checked for Linux/default-ref restrictions; not activated |
| Export evidence | Original 131,072 synthetic bytes and stored manifest matched their SHA-256; stdout under 2 KB |
| Consumer cache job | Exact same dependency key restored; install skipped |

The pre-integration contract job is [136031263507](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44658705334/job/136031263507).
The exact-hit consumer is [136032006969](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44658705334/job/136032006969).
The earlier [cold probe](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44658022066)
observed a real miss, 38.399s installing dependencies, then successful Bun and node_modules cache saves.
Its consumer restored node_modules in 16.026s and skipped installation.
That earlier run was RED because the new ownership helper had TypeScript narrowing errors;
those were fixed without casts or ignores before the final green run.

The optimized selector measured 164.95ms versus 763.18ms for the unchanged selector in the final
single-run comparison. This is an observed selector-only measurement, not an end-to-end speedup.
All 155 focused tests passed; the complete 884-file product suite was not run by that probe.

## Post-integration focused validation

The first integrated [probe 44660638657](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44660638657)
passed 175 focused tests and selection/cache checks, but remained **RED**: the real Sucafina
typecheck rejected `Period | undefined` in the Planner regression inherited from
[PR #400](https://github.com/gustavomhss/Orchestra-SF/pull/400). PR #418 added an explicit
failure when the canonical source has no period, preserving the original assertions.
The corrected probe also executed that real Planner regression.

[Run 44661129868](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44661129868)
completed **SUCCESS** at 2026-11-20 02:30:58 UTC after 1m48s;
its [job 136039361873](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44661129868/job/136039361873)
ran for 1m45s. Its snapshot `d08f56805155240c9295cc6abfe6cf4951bf9500` differs from
reviewed candidate `e23e850fd30d450a67165b407b10b131f38f63e1` in exactly three probe-only files:
the isolated workflow, the unchanged baseline-selector copy and the final default-branch
cache-writer YAML copy. None of those probe files is part of the CI rescue integration.

| Check | Observed result |
| --- | --- |
| Gate and LPT planner | 63 pass, 0 fail |
| Cache, surgical requests and source-PR guard context | 77 pass, 0 fail; 27 native Omni spawns, 0 delegated |
| Static ownership and former wrapper cases | 35 pass, 0 fail |
| Real Planner answer scope and host-reopen regression | 1 pass, 0 fail; 18.92s; 55 native Omni spawns, 0 delegated |
| Total focused tests | **176 pass, 0 fail** |
| Real Sucafina package typecheck | **PASS**, 53s |
| Original versus optimized selector | Exact equality, **886 files** |
| Eight shard partitions | Complete disjoint union; 110–111 files per part; no empty shard |
| Installed dependencies, ripgrep and Omni | Exact cache hits on the keys recorded above |
| Dependency preparation | 14s; installation and cache saves skipped; `CACHE_SAVE_REQUESTED=false` |

The observed selected-path SHA-256 was
`71054ee4a0525383ddfc2dea0b249d57c6e157b2669b941a86cb2a9e2acb12cc`.
The selector measured 262.04ms versus 1,220.52ms for the unchanged implementation in this
single observation. These numbers measure selection and preparation, not product-suite runtime.

This evidence is pinned to the candidate and probe snapshot above. Concurrent frontend
[PR #411](https://github.com/gustavomhss/Orchestra-SF/pull/411) changed the integration branch
outside the CI, cache and CI-SF selection paths. The focused probe does not assert whole-tree
equality with that later branch state or qualify all of its product behavior.

## Export logs and concurrent requests

Generated Office originals and their SHA-256 manifests stay on disk and are uploaded as artifacts
from both explicit export requests and product shards. Their base64 copy was removed from stdout.
The synthetic probe checked byte preservation and bounded output; it does not replace the existing
Office consumer/rendering proofs. Hard-cancelled jobs may finish before artifact upload can run.

Surgical runs now cancel an obsolete execution on the same ref. Independent refs remain independent.
Cancelled runs do not enter snapshot cleanup; completed cleanup also checks the observed head SHA
before deletion. The REST read/delete pair is best effort, not an atomic ref lease.

## Remaining product cost and qualification

Several original files consumed 8–11 minutes, including
`wp13/coverage-sensitivity-integration.test.ts` (662.77s observed) and
`integrated-proofs/am01/portfolio-recall-proof.test.ts` (579.80s, failed).
Their composition and revalidation work is separate from setup overhead.
[PR #401](https://github.com/gustavomhss/Orchestra-SF/pull/401) was already merged into `sf-join-four`
at `18a913220a6805bef1c62a58a26a310f991d6a0a`. Its repeated-BI-proof corrections are
included in the integrated candidate; the CI rescue preserves them.

This rescue has not produced a complete green product run. The authentic complete-run CI-SF
coverage baseline remains `PENDING_REAL_COMPLETE_RUN`. No baseline was fabricated. Product assertions, permission
checks, timeouts and release-only ownership are unchanged; static execution remains mandatory.
A subsequent complete run on the integrated candidate must measure actual shard durations and
provide authentic case/file evidence before any product-green or release claim.
