# Installed create after assignment builder — complete diagnostic evidence

## Product and question

Parent product: `1e31da764179efa3b00dff88cfe35cf3a2921120`, tree
`d50a1692afcaf62e059f3f3d94ce128ab9bdd1e4`. This is the qualified V2
assignment builder over `cb1c440894b3aa2bb8d814569b96e9f284771d68`.
The builder creates a private null-prototype object, copies each already
captured string-key data descriptor by assignment, and restores Object.prototype
only after all child visits. It preserves the original capture/recursion/error
order, array handling, fresh graphs and all real C05 callbacks.

This candidate reapplies the unchanged installed observer from
`a35400f38ebe523ebbb03f786ae66f791068e161`. It asks whether the complete
original RPT02 reaches further create phases with V2, and which inclusive
clone/canonical/materialization costs are observed. This is a diagnostic,
not nominal Reports qualification or a controlled CPU benchmark.

## Exact composition

There are 13 changed paths relative to V2: the 11 exact non-LocalStore blobs of
the 6c630-to-a354 observer delta, the composed LocalStore, and this new manifest.
The original observer manifest remains a historical reference without edits.

The two reconstruction orders match: V2 LocalStore plus the eight original
observer hunks equals V1-profile LocalStore plus the single V1-to-V2 builder
hunk. Removing the observers reproduces V2 blob
`102020b97c0fa3cfebb654c8940f835e57f935c4` byte for byte. Reversing only the
V1-to-V2 builder hunk reproduces profile V1 blob
`10e8192c4e6010fafa0aeaa543630ae377c8778e` byte for byte.
The composed file has 37,429 characters, 717 newline-terminated lines and
22 awaits. SQL, receivers, external callback identities, authority checks and
existing timers are unchanged.

All other V2 files remain exact, including the five boundary cases with their
original 37 expects and the three added empty-object checks. No Native ACL
candidate, structuredClone hypothesis or other product delta is included.

## Unchanged selection and collection

Request: `2af4a561cfbde6278d8de11c42a5cb552ce0f297`.
Copied RPT02 spec: `42ce80921cbfd7c6c9194ce88745a21ea861dd50`.
Collector: `69c4fc79ef028254edf552efee012890acdac5d7`.

The complete original case remains literal: 19 direct expects, 31 awaits,
production 180000, original client 30000, workers 1, retries 0, OMNI 1.
The configuration declares trace/video/screenshot off. In this execution the
unchanged workflow added `--trace retain-on-failure`: the job log shows the
argument addition at line 842 and the actual Playwright command at line 938.
The terminal names `error-context.md`; the artifact body has not been read, so
this document makes no claim about actual retained trace attachments or effective
trace precedence. No filter, fixture, grant, assertion, timer, abort, retry or
workflow is added or changed.

ALS ownership, exact Request identity, numeric protocol, Node-free canonical
gateway, maintenance separation, closed-scope handling and best-effort output
remain the a354 blobs. Copying a diagnostic Request number from an earlier run
would be invalid; group by the numbers and modes actually emitted.

Any authorized execution must retain every accepted numeric record and original
ISO timestamp, plus run, job, cleanup and artifact metadata. Do not select only
the create records or only favorable completed spans.

## V1 installed result remains red

The V1 profile was candidate `0658f1ab8ae8b31f4c5782955bfc0f2f4da0f136`,
snapshot `7a9c332f717dc455236ad80e298862757528fa44`, run `44690149085`,
job `136133725978`, cleanup `136135833595` success.

It retained **142 valid records, zero rejected**, across five Requests.
The complete RPT02 timed out at the original 180000 ms: 0 pass, 1 fail.
The terminal finally error remained
`page.unroute: Target page, context or browser has been closed` at
`packages/app-shell/e2e/sucafina/reports-support/lost-created-thread-read.ts:142`,
via `human-answer-flow.ts:53` and the copied spec at line 33.

Create Request 43 completed review-fence in 24163.933933000008 ms and
mutation-fence in 70885.60053 ms. It entered the final thread C08 callback at
95102.780787 ms; the last retained progress was 99105.24953200002 ms, phase 26.
No checks-done phase 27, C08-done phase 28, egress, abort or settlement event
was retained. Callback entry is not proof of authorization, commit or response.

Its cumulative clone observation was 9290 calls / 50131.8219969982 ms;
canonical 667354 / 21915.323701998 ms; materialize
11905 / 1582.1619749999954 ms. Memo hits were 895 per surface, with no emitted
miss/decode/plan metric. These are inclusive observations, not exclusive CPU.

Complete V1 evidence is pinned outside this candidate:
[142 original records and timestamps](https://github.com/gustavomhss/Orchestra-SF/blob/baebef3c8b46621e08c39820c32f51f897690cd5/docs/handoff/diagnostics/REPORTS-COPY-BUILDER-PROFILE-44690149085.json),
blob `71caa299e115e397cc51b1f690a1f0ecea83b1ab`.
Artifact 14607814479 has 314028 bytes and SHA256
`a2186ed6708fbd0ef87795078adaa2c50fc11430cb4e221bf5f27e2a2415fcd1`.
The older a354 baseline, run 44684328393, retained only an incomplete mutation
prefix. These different completion states must remain explicit.

## Interpretation limits

First report actual arrival and completed phases: admission, review-fence
21→22, mutation-fence 23→24, final thread C08, egress, settlement and any
observed Request abort. Missing events remain missing. Server elapsed time
alone does not establish when or whether a client abort reached it.

Compare clone counts and inclusive times for corresponding completed spans.
Label incomplete prefixes as such. Keep canonical/materialize, queue and its
mirrored predecessor attribution, payload/plan units and partial observer
overhead separate; overlapping totals must not be added as exclusive CPU.

Actions runs can differ in scheduling, load, JIT/GC, concurrency, graph contents
and how much work finishes before teardown. Less measured time can mean less
work. Per-call averages mix graph shapes. No speedup, 30-second success or
four-scenario nominal closure is presumed from component/compiler greens.

The builder changes no authorization/provider callback and permits no memoized
grant or old mutable-target plan. All conditional successful-path validations
remain real; a partial profile does not prove they all completed.

## V2 product qualification

Four complete component files: run `44692617765`, job `136141768164`,
cleanup `136142163399`, success. 72 pass, 0 fail, 2 original UID skips;
1184 expects, 74 declared tests across four files, 6.73 s.

Real Sucafina and CLI compilers: run `44692619545`, job `136141774838`,
cleanup `136142699705`, success. 2 pass, 0 fail, 0 skip, 0 cancel;
60255.882515 ms, with exact V2 product markers. These gates qualify the V2
product tree; no installed performance result is claimed.

This CI-only composition received independent root and Operations review, then
one separately authorized compiler run and one separately authorized installed
diagnostic. Their exact results follow. No integration, new four-scenario
nominal, sf-ci, automatic rerun or observer beyond a354 is included.

## Exact composition compiler

Candidate `494459b34fe4f6e477dce0ce49b87234beb61b08`, tree
`7b75f1cb51697157402af9d98bb3748472658be4`, has the single V2 parent
`1e31da764179efa3b00dff88cfe35cf3a2921120`.
Its composed LocalStore is `ecb8f9b977458c382a77c6609bc6a12e8e585150`.

Compiler snapshot `7fbc4b2c45c6639bd8ebdcece2fb64f7b1bfa711`,
tree `923388c8e5ea80442992434caa496b5bbc55a471`, is a direct child
with only request `e359ff4033d50207f9770b1838b3667a6453321e` and
harness `37f6ad2aeba43762797855c938cf469bcf67449c`.
Both real `bun run typecheck` scripts emitted the exact candidate SHA marker.

Run [44694035451](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44694035451),
job `136146391720`, cleanup `136147069156`: success, attempt 1;
**2 pass, 0 fail, 0 skip, 0 cancel**, 59369.492038 ms.
Sucafina took 28920.778013 ms; CLI 30410.538035 ms. Cleanup succeeded.

## Exact installed diagnostic

Snapshot `67687ae1818ce4e699f81cc2d2786b79dea660c9` has the single
candidate parent `494459b34fe4f6e477dce0ce49b87234beb61b08` and the
**same tree** `7b75f1cb51697157402af9d98bb3748472658be4`.
The pre-trigger compare contained zero changed paths and the snapshot had no run
before its one `ci-run-linux-assignmentprofile` branch trigger.

Run [44694802955](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44694802955),
job `136148879352`, cleanup `136152112943`: **0 pass, 1 fail**, original
180000 ms timeout, attempt 1. It was created at 2026-11-20T07:25:02Z and reached
terminal metadata at 2026-11-20T07:33:20Z. Cleanup succeeded. There was no rerun.

The terminal signature remains
`page.unroute: Target page, context or browser has been closed` at
`packages/app-shell/e2e/sucafina/reports-support/lost-created-thread-read.ts:142`,
via `human-answer-flow.ts:53` and
`packages/app-shell/e2e/sucafina/reports-create-profile.spec.ts:33:29`.
This finally error does not identify the original internal pending await.

Artifact `14610672111`, `playwright-ubuntu-24.04-1`, has 314753 bytes,
SHA256 `e55d467de3ab303d3f594c47ed8f861031307b066b40d2be3d8c55f6e430eb3a`,
and expiry 2026-11-27T07:33:03Z. The API associates it with this exact snapshot.
Only metadata was inspected; no ZIP body, trace or domain payload was read.

## All retained observations

[Complete numeric evidence](REPORTS-COPY-ASSIGNMENT-PROFILE-44694802955.json)
contains **149 valid records, zero rejected**, with every original ISO timestamp
and all wire JSON keys, values and order preserved. ANSI and unrelated job output
are excluded. The five actual Request groups are all retained:

| Request | Mode | Records | Last elapsed ms | Last observed event |
| --- | --- | ---: | ---: | --- |
| 35 | review-thread-context | 16 | 13282.016656 | fulfilled, phase 9 |
| 37 | storage-version | 18 | 37.777304000002914 | fulfilled, phase 9 |
| 38 | review-thread-context | 16 | 13395.13244200001 | fulfilled, phase 9 |
| 39 | storage-version | 18 | 47.067657000006875 | fulfilled, phase 9 |
| 42 | collaboration-thread-create | 81 | 103014.69597299998 | fulfilled, phase 9 |

Create Request 42 began at 2026-11-20T07:31:10.9081077Z; its fulfilled event
was retained at 2026-11-20T07:32:53.9244743Z. Metric 17 records one exact
Request-identity match, with no mismatch metric. No Request abort event was
retained. This absence does not establish that the client stayed connected.

The following complete spans are calculated from the retained phase boundaries.
Displayed times are rounded to six decimals; the JSON retains original numbers.
Counts and time are inclusive, and nested rows must not be added to their parent.

| Span | Phase boundaries | Elapsed ms | Clone calls / ms | Canonical calls / ms | Materialize calls / ms |
| --- | --- | ---: | --- | --- | --- |
| Prepare review fence | 21→22 | 20896.330373 | 2836 / 7510.800614 | 171794 / 5855.205514 | 2461 / 639.893568 |
| Mutation fence | 23→24 | 59099.309246 | 5632 / 23258.849149 | 469278 / 16054.831098 | 9418 / 928.688961 |
| Final thread C08 | 25→28 | 7594.897879 | 1791 / 3019.123150 | 58309 / 1905.212375 | 3 / 1.568811 |
| Checks within final C08 | 26→27 | 7052.553076 | 1779 / 3018.941776 | 54760 / 1863.245665 | 0 / 0 |
| Egress | 29→31 | 15383.924388 | 1063 / 4428.181804 | 135515 / 4396.000184 | 2987 / 1021.995135 |

The last create record totals clone 11322 calls / 38216.95471700099 ms;
canonical 835334 / 28216.131487992476 ms; materialize
14892 / 2603.930887000228 ms. It records 1482 dashboard hits, 1483 planner
hits, 1483 procurement hits, one dashboard miss, four decodes
(18.927499999990687 ms) and one plan (6.873244999995222 ms).
Dashboard payload maximum is 1164047 implementation string units and plan
maximum is 1963436 units; these are not measured byte sizes.

Queue metric 12 is 552 observations / 1991.7977050002955 ms. Its Request
predecessor attribution, metric 14, is 1992.1917880002584 ms and overlaps it.
Write-lock metric 13 is 1483 / 12.395086999691557 ms.
Partial observer overhead is explicitly retained: 2600930 clock reads,
868590 bookkeeping observations / 85.82213499386853 ms, and 80 output
bookkeeping observations / 4.039194999873871 ms. These do not measure every
observer cost and must not be subtracted to assert exclusive product CPU.

## What progressed, and what remains unproved

The server reached checks-done 27, final C08-done 28, egress 29→30→31 and
fulfilled event 5. This is further observed progress than the baseline
(incomplete mutation prefix) and V1 (incomplete final C08 callback).
The observer callsites at
`modules/sucafina/Sucafinav1/product/collaboration/threads.ts:85–103`
place these events around the real final checks, state transaction and egress.
No phase is an invented grant or replacement for a callback.

That server progression does **not** prove the browser received the response,
its HTTP status, or completion of the original human-answer flow. The original
scenario still timed out. A successful HTTP delivery, 30-second client deadline
success and four-case Reports qualification remain unproved.

Two corresponding completed spans allow a descriptive comparison:

| Completed span | V1 elapsed / clone ms | V2 elapsed / clone ms | Clone counts |
| --- | --- | --- | --- |
| Prepare review fence | 24163.933933 / 11597.267750 | 20896.330373 / 7510.800614 | 2836 in each |
| Mutation fence | 70885.600530 / 36358.593231 | 59099.309246 / 23258.849149 | 5632 in each |

Counts of canonical calls and materializations also match within these two
spans, while their measured durations differ. The V2 prefix contains more
completed work overall, so cumulative V1 and V2 totals are not equivalent
workloads. Independent Actions runs and inclusive instrumentation do not
establish a controlled CPU speedup or causality from the builder alone.

No product promotion follows from this diagnostic. The separate source-scope
descriptor eligibility finding remains for its own compatibility correction
and qualification. The private native-clone proposal remains analysis only;
no such code, provenance mark, cache or test is present in this composition.
