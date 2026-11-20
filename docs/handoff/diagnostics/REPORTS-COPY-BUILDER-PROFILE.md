# Installed create after copy builder — reviewed CI-only observations

## Scope

Parent: `cb1c440894b3aa2bb8d814569b96e9f284771d68`, tree
`324fea20029d802f1ed9c3d54e6adbd6fe2a220f`. Reapply the unchanged observer from
`a35400f38ebe523ebbb03f786ae66f791068e161`, whose product base was
`6c6303f5a52cd6123762f8875b33822ba28e1ed8`.

This asks which real installed create phases complete after the fresh-copy
builder change and what clone, canonical and materialization costs are observed.
It is a diagnostic of the complete original RPT02, not nominal Reports
qualification or a controlled CPU benchmark.

## Exact composition

Copy the 11 non-LocalStore blobs of the 6c630-to-a354 delta without alteration,
including its historical manifest, request, copied spec and protected collector.
Compose only `modules/sucafina/Sucafinav1/runtime/local-store.ts`: the eight
original observer hunks plus the exact approved cb1c builder. This separate
manifest is the thirteenth changed path relative to cb1c.

Both reconstruction orders are equal: a354 LocalStore plus the builder equals
cb1c LocalStore plus the eight observer hunks. Removing the observers reproduces
blob `2dff8e2d8073c2ffe01fbc59b7b76ab84c1bd587`; removing the builder reproduces
blob `6192ecf2ab083dc84218cd2b67ed9dff36fa928f`, both byte for byte. The composed
file has 37,548 characters, 719 newline-terminated lines and the same 22 awaits.
No new runtime observer, callback, SQL, receiver or authority rule is introduced.

All other cb1c paths remain exact. No Native ACL candidate or other product
delta enters this diagnostic. The original Reports spec, helpers and production
config remain unchanged except the already qualified output collector.

## Selection and evidence

Request blob: `2af4a561cfbde6278d8de11c42a5cb552ce0f297`.
Copied RPT02 spec blob: `42ce80921cbfd7c6c9194ce88745a21ea861dd50`.
Collector blob: `69c4fc79ef028254edf552efee012890acdac5d7`.

The case remains literal, with 19 direct expects, 31 awaits, production 180000,
the original client 30000 deadline, workers 1, retries 0, OMNI 1, and trace,
video and screenshot off. There is no added filter, timer, abort, retry,
assertion, fixture or grant.

ALS ownership, exact Request identity, Node-free canonical gateway, maintenance
separation, closed-scope handling, progress at existing completions, numeric
protocol and best-effort emission remain the a354 implementations. Preserve
every accepted numeric record and ISO timestamp. Group by the actual emitted
Request and mode; do not assume the baseline sequence number 42 repeats.

## Interpretation

Report admission, review-fence 21→22, mutation-fence 23→24, final thread C08,
egress, settlement and any abort actually observed. Missing phases remain
missing; do not infer commit, rollback or abort from elapsed time.

Baseline run 44684328393 reached create with the same Request. Its Request 42
completed review-fence in 25074.433959 ms, then retained a 70123.382321 ms
incomplete mutation-fence prefix. There was no phase 24, final thread C08,
settlement or observed abort in that retained prefix. Inclusive clone measures
were 2836 calls / 11824.994619 ms during preparation and 5530 calls /
36293.008527 ms during the incomplete mutation prefix.

Compare completed corresponding phases and label incomplete prefixes explicitly.
Keep clone counts/time, canonical/materialize, queue/predecessor, payload/plan
units and observer overhead separate. Inclusive spans overlap; do not sum them
or subtract measured bookkeeping as though it captured all observer overhead.

Scheduling, JIT/GC, runner load, concurrency and completed work can differ across
Actions runs. A smaller clone total can reflect less work; per-call means mix
graph shapes. These are observational results, not exclusive CPU measurements.
Do not claim the 30-second deadline or four-scenario nominal is closed from this
single diagnostic.

## Prior qualification and state

cb1c functional: run 44688042967, job 136126970493, cleanup 136127313388;
72 pass, 0 fail, 2 original UID skips, 1172 expects, 74 tests / 4 files, 6.66 s.

cb1c compiler2: run 44688044573, job 136126975445, cleanup 136127766526;
2 pass, 0 fail, 0 skip, 0 cancel; 59266.563454 ms. Sucafina 32095.071225 ms;
CLI 27122.0614 ms; both real-script markers identify the full cb1c SHA.

Preparation commit `0658f1ab8ae8b31f4c5782955bfc0f2f4da0f136` was independently
reviewed by root and Operations. Its compiler and one installed diagnostic have
now executed under separate authorizations; the complete results follow.
All observer additions remain CI-only. No integration, new nominal, sf-ci or
automatic rerun occurred.

## Compiler of the exact composed tree

Run `44689742109`, test job `136132427685`, cleanup `136133251947`: success.
Snapshot `a082a8b0859d24e2179787f3d021212d08df2484`, parent `0658f1ab`, tree
`1e8574f548e1babf334a46954f28069b0ca05291`. Only request
`e359ff4033d50207f9770b1838b3667a6453321e` and harness
`935f59e35fc5bdf37b56feab3b47767a0e92d903` differ from the candidate.

Both real package scripts passed with full `0658f1ab` markers: 2 pass, 0 fail,
0 skip, 0 cancel; 84691.477259 ms total. Sucafina: 43337.329809 ms; CLI:
41290.644372 ms. Attempt 1 only; cleanup succeeded.

## Single installed diagnostic: timeout retained

Run `44690149085`, test job `136133725978`, cleanup `136135833595`.
Snapshot `7a9c332f717dc455236ad80e298862757528fa44` is a direct child of
`0658f1ab8ae8b31f4c5782955bfc0f2f4da0f136`, with the same tree
`36f4b47e738a5188a33118f85c1570d717325c68` and zero changed paths.
Request, spec and collector retain the exact blobs listed above.

The one complete RPT02 failed at its original 180000 ms timeout: 0 pass, 1 fail.
The retained terminal error is
`page.unroute: Target page, context or browser has been closed`, at
`packages/app-shell/e2e/sucafina/reports-support/lost-created-thread-read.ts:142`,
via `reports-support/human-answer-flow.ts:53` and
`reports-create-profile.spec.ts:33`. The finally error still masks the internal
browser wait; the server phase observations below are separate evidence.

The run was created at 2026-11-20T06:46:13Z and last updated at
2026-11-20T06:51:53Z, attempt 1, terminal conclusion failure. Cleanup succeeded.
No retry, rerun or cancellation occurred.

Artifact `14607814479`, `playwright-ubuntu-24.04-1`, 314028 bytes,
SHA256 `a2186ed6708fbd0ef87795078adaa2c50fc11430cb4e221bf5f27e2a2415fcd1`.
Artifact metadata names the same snapshot. No artifact body or trace was read.

## Complete numeric evidence

[REPORTS-COPY-BUILDER-PROFILE-44690149085.json](REPORTS-COPY-BUILDER-PROFILE-44690149085.json)
contains **all 142 accepted wire records**, their original ISO timestamps and
the execution/artifact metadata. Zero records were rejected. Removing only
`at` and serializing each remaining object reproduces the original JSON wire
string exactly; ANSI terminal control sequences are excluded. No Request group
was omitted.

| Request | Mode | Records | Last elapsed ms | Last observed event |
|---:|---|---:|---:|---|
| 35 | review-thread-context | 17 | 15680.943054999996 | fulfilled |
| 37 | storage-version | 18 | 34.160541999997804 | fulfilled |
| 38 | review-thread-context | 17 | 15707.141321999996 | fulfilled |
| 40 | storage-version | 18 | 33.07275199999276 | fulfilled |
| 43 | thread-create | 72 | 99105.24953200002 | progress, phase 26 |

Request 43 began at 2026-11-20T06:49:56.8930889Z. Its final retained progress
record is timestamped 2026-11-20T06:51:35.9987104Z. Metric 17 records one exact
Request match; no mismatch metric was emitted. Admission completed at
14.510818000009749 ms; review state was read by 31.929650000005495 ms.

| Create phase | Start elapsed ms | End elapsed ms | Span ms | Complete? |
|---|---:|---:|---:|---|
| review-fence 21→22 | 35.85667900000408 | 24199.79061200001 | 24163.933933000008 | yes |
| mutation-fence 23→24 | 24199.850275000004 | 95085.450805 | 70885.60053 | yes |
| final thread C08 entry 25→last | 95086.451546 | 99105.24953200002 | 4018.7979860000196 | no |
| final thread C08 callback 26→last | 95102.780787 | 99105.24953200002 | 4002.46874500002 | no |

These phases are emitted at the existing create expressions in
`modules/sucafina/Sucafinav1/product/collaboration/threads.ts:75–102` on the
diagnostic candidate. The last completed boundary is callback entry at line 87.
No phase 27 at line 89 (checks done), phase 28 at line 93 (C08 done), egress,
abort or settlement event is retained. Entry into the callback does not prove
successful authorization, a committed thread, rollback or a delivered response.
The earlier fences themselves also use real readonly C08 groups.

### Inclusive costs by phase

| Observed span | clone calls / ms | canonical calls / ms | materialize calls / ms |
|---|---|---|---|
| baseline complete review-fence | 2836 / 11824.99461899983 | 171794 / 5537.539534004682 | 2461 / 687.766544000202 |
| builder complete review-fence | 2836 / 11597.26774999946 | 171794 / 5455.177158995735 | 2461 / 648.5126700004039 |
| baseline incomplete mutation prefix | 5530 / 36293.00852700026 | 443696 / 14742.308984004761 | 8724 / 573.4766649981902 |
| builder complete mutation-fence | 5632 / 36358.59323099957 | 469278 / 15591.849687002847 | 9418 / 920.1494209995872 |
| builder incomplete C08 callback | 816 / 2175.8730799991754 | 25824 / 856.9945679993252 | 0 / 0 |

The complete preparation spans have equal counts in these three metrics; their
measured timings differ. The mutation rows have different completeness and work
counts, so their totals are not matched-work speed measurements. The new C08
callback prefix has no corresponding retained baseline span.

### Last cumulative values for create Request 43

- Fresh clone: 9290 calls, 50131.8219969982 ms.
- Canonical: 667354 calls, 21915.323701998 ms.
- Materialize: 11905 calls, 1582.1619749999954 ms.
- Queue wait: 300 calls, 936.0660730000382 ms. The same waits have Request
  predecessor attribution totaling 936.2492029999412 ms; do not add the two.
- Write lock: 895 calls, 7.315157999866642 ms.
- Memo hits: 895 per surface. No miss, decode or plan metric was emitted.
- Maximum payload units: dashboard 1156258, planner 705, procurement 977;
  materialization plan 1950032 units. These are string/plan units, not bytes.
  Baseline dashboard/plan maxima were 1156242 / 1950000; captured strings are
  not asserted byte-identical across installations.
- Observer clock reads: 2075348. Bookkeeping: 692730 updates /
  68.42845100624254 ms. Output bookkeeping: 71 prior emissions /
  3.3731649999972433 ms. These are partial overhead observations.

## Outcome and remaining limits

The timeout remains. This run reached the final thread C08 callback after
completing mutation-fence, while the earlier baseline retained only an
incomplete mutation prefix. That is an observed progress difference, not proof
of a causal performance improvement or successful thread creation.

The completed preparation still took about 24 seconds and mutation-fence about
71 seconds before final C08 checks. The copied scenario does not demonstrate
completion within the client's original 30-second deadline. The server emitted
no abort event; elapsed time alone is not evidence that abort reached it.

Every real authorization/source/provider callback remains unchanged. This
diagnostic neither validates all 28 conditional successful-path validations as
completed nor permits removing any of them. The fresh-copy builder's semantic
gates remain green, but installed Reports and the final sf-ci remain open.
