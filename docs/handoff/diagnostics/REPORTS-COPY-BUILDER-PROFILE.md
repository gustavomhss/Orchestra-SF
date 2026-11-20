# Installed create after copy builder — reviewed CI-only preparation

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

Prepared after independent root and Operations cold reviews. This commit records
the reviewed composition. No compiler or installed diagnostic has run on this
composition; execution remains pending a separate authorization.
No integration, new nominal, sf-ci or automatic rerun is included.
