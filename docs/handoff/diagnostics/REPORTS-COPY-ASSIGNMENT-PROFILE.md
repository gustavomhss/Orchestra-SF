# Installed create after assignment builder — reviewed CI-only preparation

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
production 180000, original client 30000, workers 1, retries 0, OMNI 1,
trace/video/screenshot off. No filter, fixture, grant, assertion, timer, abort,
retry or workflow is added or changed.

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

## V2 product qualification; this composition not executed

Four complete component files: run `44692617765`, job `136141768164`,
cleanup `136142163399`, success. 72 pass, 0 fail, 2 original UID skips;
1184 expects, 74 declared tests across four files, 6.73 s.

Real Sucafina and CLI compilers: run `44692619545`, job `136141774838`,
cleanup `136142699705`, success. 2 pass, 0 fail, 0 skip, 0 cancel;
60255.882515 ms, with exact V2 product markers. These gates qualify the V2
product tree; no installed performance result is claimed.

This is a prepared CI-only composition after independent root and Operations
composition review. No compiler or installed diagnostic has run on this exact
composition. Both require separate root authorization. No integration, new
nominal, sf-ci, automatic rerun or probe beyond a354 is included.
