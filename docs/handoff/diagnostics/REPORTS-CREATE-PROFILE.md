# Installed Reports create profile — CI-only candidate

## State and question

Prepared over product `6c6303f5a52cd6123762f8875b33822ba28e1ed8`, tree
`a88331c0e06fccdaf41e946a30a7ce8f0b93d3a1`. The candidate completed two compiler checks and one installed diagnostic; results are recorded below.
All added observers, the copied diagnostic spec, request, and this manifest are
CI-only. None is an integration candidate. No workflow or product authorization
contract is changed.

The original nominal is run 44675679976, head46a4d879e86077a6ab35f0fd64b3df86e8807a33:
one passed and three timed out. Its retained RPT02 UI has an existing question
intent and an enabled Reconcile action after the missing response. That locates
the browser after context/storage preflights, but does not prove that the create
Request reached the server, committed, or failed at a particular server phase.

This diagnostic asks only:

1. Does the real collaboration-thread-create Request enter the installation?
2. Which existing admission, C05 preparation, mutation fence, C08, and egress
   phases complete before/after an abort actually observed on that same Request?
3. How many actual canonical traversals/materializations/copies and queue/lock
   waits occur within that Request, and how much inclusive time do they consume?

The browser client already has its original30000 ms fetch deadline. This observer
adds no deadline, timer, sleep, abort, retry, request, SQL, hash, or serialization
of domain values. If the server receives no abort event, the report must say so.
Server elapsed30s is not proof of a client abort or network delivery.

## Six runtime sites

| Site | Existing boundary | Observation only |
|---|---|---|
| local/entry.ts:275 | Actual installation handler | ALS starts before its first await, keeps the original Request, and records route/identity/native/business completion. |
| runtime/local-jobs.ts:263 | Existing run() call in runOnce | A separate maintenance owner prevents POST-inherited work from receiving Request metrics. The original work promise remains the result. |
| product/collaboration/http.ts:44–70 | Existing payload, admission, route invocation and finish | Numeric phase events around the original expressions and awaits. |
| product/collaboration/threads.ts:60–87 | Existing admission, prepareReviewFence, mutationFence, C08 callback and egress | Phase events only. Original callback identities, receivers, short-circuit expressions, conditions and returns stay intact. |
| runtime/local-store.ts | Existing memo observation, copy/decode/plan/materialize, queue wait and lock | Timers/counts inside the actual bodies, without replacing factory methods or adding a traversal. SQL, budgets and lock deadlines are unchanged. |
| product/contracts/canonical.ts:5–7 | Existing full canonicalSfValue invocation | One outer timer, including its existing canonical traversal and JSON.stringify. No per-node timer and no extra digest or canonical body. |

The two new support modules are private diagnostic infrastructure:
`runtime/reports-create-diagnostic.ts` owns ALS and the bounded numeric protocol;
`product/contracts/reports-create-metrics.ts` has no imports, Node dependencies,
globalThis, domain data, or authority logic. The latter only forwards start/end
observation to the installed server observer. Browser code can import canonical
without pulling async_hooks into its bundle.

Authentication retention starts at local/entry.ts:254, before the handler is
returned. Its interval is registered at runtime/auth-maintenance.ts:272 outside
Request ALS. This candidate does not edit authentication maintenance or attribute
its unobserved work to create. A queue predecessor not registered by an active
Request/local-maintenance scope remains unattributed.

## Identity, lifetime and observable semantics

The exact Request object receives an ephemeral number in a private WeakMap.
Numbers have no relationship to actor, review, source, project, receipt, session,
installation, mutation, thread, message or idempotency identifiers. No Request,
URL, body, header, cookie, token, reference, digest, path or domain text enters
the wire record.

ALS is established synchronously at handler entry. Only allowlisted modes
review-thread-context, collaboration-storage-version and
collaboration-thread-create enable emission and timing. Other Request scopes
remain separately counted, and local maintenance has its own disabled metric
scope. It cannot inherit foreground attribution even if runOnce is requested by
a successful POST. Its original coalesced active promise is preserved.

The observer attaches at most one abort listener per handler scope and removes
it in final cleanup. It does not abort or cancel work. It observes the original
work promise, returns that promise, and adds no await. Product completion closes
the scope, clears its Request reference and removes the scope from the active
set. Metric/phase calls from retained descendants after closure are ignored.
The settlement event is emitted at closure; active counts at that event still
include the closing scope, as in the previous qualified observer.

Diagnostic output and clock/bookkeeping failures are best effort. The canonical
gateway catches observer failures, including from a finally block, so they do
not replace a canonical value or original exception. No function recognized by
a private product registry is wrapped or replaced. Admission/fences still call
all real providers at their original places.

## Literal restoration and selection proof

Removing only the recorded imports/observer statements/wrappers reconstructs
each of the seven existing files byte for byte from 6c630. Await token counts are:

| File | Before | After |
|---|---:|---:|
| modules/sucafina/Sucafinav1/local/entry.ts | 54 | 54 |
| modules/sucafina/Sucafinav1/runtime/local-jobs.ts | 22 | 22 |
| modules/sucafina/Sucafinav1/product/contracts/canonical.ts | 0 | 0 |
| modules/sucafina/Sucafinav1/product/collaboration/http.ts | 8 | 8 |
| modules/sucafina/Sucafinav1/product/collaboration/threads.ts | 34 | 34 |
| modules/sucafina/Sucafinav1/runtime/local-store.ts | 22 | 22 |
| packages/app-shell/e2e/sucafina/reports-support/production-installation.ts | 15 | 15 |

The seventh existing file is the qualified output carrier,
`packages/app-shell/e2e/sucafina/reports-support/production-installation.ts`.
Its only change is the observer-parser import and two lines in the existing
Stream.runForEach after Stream.splitLines. The redacted8192-character tail,
readiness checks, Omni child ownership, timeouts and cleanup remain literal.

`reports.spec.ts` is unchanged, blob6dbbc7ca472b38c81a7a40538c58c9f1c40f423c.
The new `reports-create-profile.spec.ts` contains the entire original RPT02
block literally, including its19 direct expect calls, lost-response/read
reconciliation, edits, history and final assertions. Its imports, file-level
trace/video/screenshot off, describe and180000 budget are copied from the
original. It has no new behavioral assertion, skip, fixture, grant, or retry.
The other interaction helpers and original fixture/config remain byte-identical.

The request validator rejects Playwright name filters. The new named file is the
same mechanism used for the previously reviewed installed diagnostic; the
workflow/parser/selection rules are unchanged. The proposed request is:

```json
{"package":"app","runner":"playwright","config":"e2e/playwright.production.config.ts","args":["e2e/sucafina/reports-create-profile.spec.ts"],"env":{"ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER":"1"}}
```

This keeps production config, workers1, retries0, original fixture180000 and
startup120000, OMNI1, and the original wrapper. It selects one complete scenario
for diagnosis. A result cannot close the whole nominal Reports gate.

## Numeric wire protocol

Prefix: `SF_REPORTS_CREATE_DIAGNOSTIC `. The existing stdout splitLines consumer
forwards only a complete bounded line accepted by the new allowlist validator.
The record keys remain v,event,id,owner,mode,method,phase,elapsedMs,active,metrics.
The validator rejects extra keys, non-finite/negative values, oversized arrays,
duplicate metric codes and lines over16384 characters. No arbitrary line/chunk
is newly forwarded.

- v=1.
- event:1 begin after route classification; 2 phase; 3 progress at an existing
  metric completion after at least2000 ms; 4 observed Request abort; 5 fulfilled;
  6 rejected. There is no progress timer.
- owner:1 Request; 2 local maintenance. Maintenance emission stays disabled.
- mode:1 review-thread-context; 2 collaboration-storage-version; 3 collaboration-thread-create.
- method:0 other; 1 GET; 2 POST; 3 HEAD.
- active: [open Request scopes, open local-maintenance scopes].
- metrics: [code, call count, inclusive milliseconds, maximum numeric units].
  Units are existing string/plan lengths only; no body is serialized to measure size.

### Phases

| Code | Phase |
|---:|---|
| 1 | entry-route |
| 2 | entry-identity-enter |
| 3 | entry-identity-done |
| 4 | entry-prepare-enter |
| 5 | entry-prepare-done |
| 6 | entry-native-enter |
| 7 | entry-native-done |
| 8 | entry-business-enter |
| 9 | entry-business-done |
| 10 | http-enter |
| 11 | http-payload-enter |
| 12 | http-payload-done |
| 13 | http-admission-enter |
| 14 | http-admission-done |
| 15 | http-invoke-enter |
| 16 | http-invoke-done |
| 17 | http-finish |
| 18 | create-enter |
| 19 | create-admission-done |
| 20 | create-review-state-done |
| 21 | create-review-fence-enter |
| 22 | create-review-fence-done |
| 23 | create-mutation-fence-enter |
| 24 | create-mutation-fence-done |
| 25 | create-c08-enter |
| 26 | create-c08-callback-enter |
| 27 | create-c08-checks-done |
| 28 | create-c08-done |
| 29 | create-egress-enter |
| 30 | create-egress-read-done |
| 31 | create-egress-done |

create-c08-enter precedes the existing state.transaction expression, including
its original command digest and admission. create-c08-callback-enter is inside
the original callback. create-c08-checks-done follows the original full compound
authority condition. create-c08-done is after the original await. Their
differences distinguish admission/queue from callback checks and return.
An early refusal can jump directly to http-invoke-done; phases are not assumed
to have all occurred.

### Metrics

| Code | Metric |
|---:|---|
| 1 | canonical.value-inclusive |
| 2 | storage.memo-hit-dashboard |
| 3 | storage.memo-hit-planner |
| 4 | storage.memo-hit-procurement |
| 5 | storage.memo-miss-dashboard |
| 6 | storage.memo-miss-planner |
| 7 | storage.memo-miss-procurement |
| 8 | storage.materialize-plan |
| 9 | storage.clone-snapshot |
| 10 | storage.decode-snapshot |
| 11 | storage.plan-inclusive |
| 12 | storage.queue-wait-inclusive |
| 13 | storage.write-lock-inclusive |
| 14 | storage.queue-predecessor-request |
| 15 | storage.queue-predecessor-local-maintenance |
| 16 | storage.queue-predecessor-unattributed |
| 17 | request.same |
| 18 | request.mismatch |
| 19 | observer.clock-reads |
| 20 | observer.metric-bookkeeping |
| 21 | observer.output-bookkeeping |

Metrics8–11 use finally and therefore include throwing calls, with the original
exception unchanged. Queue predecessor14–16 mirrors queue wait12, and is only
the immediately preceding queued owner classification. It is not proof that a
whole wait was CPU spent by that owner. Materialization returns the same fresh
snapshot as before, with unchanged alias, absent-value and prototype handling.

Code19 counts observer performance.now reads, not clocks read by the product.
Code20 measures the metric-map update interval; it excludes the preceding ALS/
code lookup and some start bookkeeping. Code21 measures prior output emission
intervals; each record necessarily excludes its own ongoing output cost.
These overhead observations are lower bounds, not a subtraction that turns
wall time into CPU time. The observer adds clocks, Maps and output and can
affect scheduling.

## Interpretation limits and qualification state

Phase elapsed values and cumulative metric snapshots can locate the last
completed phase and counts/time accumulated while that phase was active.
Inclusive spans overlap: do not sum queue12 with14–16; canonical callbacks can
be reentrant, and a phase contains its child measurements and observer overhead.
Report phase wall time, individual inclusive totals and measured overhead
separately. Any remainder is unmeasured elapsed, not an exclusive CPU category
or evidence of a missing authorization.

No new provider cost, SQL connection/SELECT count, frontend timer, or maintenance
CPU instrumentation is added. This first profile answers create arrival/phase
progress and its canonical/materialization costs only. It does not infer a
production fix, allow fewer callbacks, or reuse a grant across Requests/leases.

Status: compiler 2 green; the single installed diagnostic reproduced the original
RPT02 timeout. No runtime fix, nominal retry, integration, sf-ci, or unchanged
diagnostic rerun follows from this evidence.

## Executed evidence — 2026-11-20 UTC

Candidate: `a35400f38ebe523ebbb03f786ae66f791068e161`, tree
`e56d8b0d4a7deccb1c73a779984a1078e64e0338`, over product 6c630.
Its only change after cold review of 01821 was a try/catch around the collector's
console.info; it cannot interrupt the original stream/readiness.

Compiler run **44683915808**, job **136113592209**, cleanup **136114496401**
completed successfully on snapshot
`c900d063d0aa627a74b299b57aaa282d250f72ea`, tree
`608c240a14666f2a5772024b64586aadce099629`. The only snapshot paths were request
e359ff4033d50207f9770b1838b3667a6453321e and the qualified compiler harness
fc4819c918d7326ae16628f625a9e39fd1b8ccff. Both actual bun run typecheck calls
printed the exact a354 candidate marker. Results: **2 pass, 0 fail, 0 skip, 0
cancel**, 60103.993249 ms; Sucafina32033.892852 ms, CLI28025.618151 ms.

The single installed diagnostic is run **44684328393**, job **136114936180**,
cleanup **136116721871**. Head
`5b12edd86f91c5458f57ad23964360596c7c471b` is a direct child of a354 with the
**same tree e56d8b0d4a7deccb1c73a779984a1078e64e0338 and zero changed paths**.
Request 2af4a561cfbde6278d8de11c42a5cb552ce0f297 and copied spec
42ce80921cbfd7c6c9194ce88745a21ea861dd50 were read back before the single trigger.

Attempt1 started05:56:23Z and completed failure at06:01:38Z; cleanup succeeded.
The complete RPT02 timed out at its original180000 ms. Its final stack was
page.unroute at lost-created-thread-read.ts:142 and the copied spec:33.
That final cleanup exception does not identify the internal stalled server
phase. No second attempt, cancel, nominal, or sf-ci was run.

Artifact 14606525451 is playwright-ubuntu-24.04-1, 313185 bytes, SHA256
4261b4c839d4ab8a43964e113a24dd5643bd34091e4121d4a92bb65d1ad2246e.
The following observations use only the completed job log. No artifact body or
trace was read.

### Exact retained records

[REPORTS-CREATE-PROFILE-44684328393.json](REPORTS-CREATE-PROFILE-44684328393.json)
preserves all **137** valid numeric records, each with its original ISO log
timestamp and no ANSI. No record was rejected. Removing the added at field and
serializing each wire object exactly reproduces its original JSON line.

Five observed Requests are distinct. Numbers below are ephemeral observer IDs:

| Request | Mode | Last elapsed ms | Last event |
|---:|---|---:|---|
|35|review-thread-context|15979.282834000005|fulfilled|
|37|collaboration-storage-version|37.06018299999414|fulfilled|
|38|review-thread-context|15973.910994999998|fulfilled|
|39|collaboration-storage-version|36.75556599999254|fulfilled|
|42|collaboration-thread-create|95240.13313899998|progress, not settled|

### Request 42 reached the real create

Its begin event is at05:59:44.2904371Z. HTTP admission completed at
17.175627999997232 ms, create entered at18.090775999997277 ms and its actual
captured Request matched the entry Request (metric 17 count1; no mismatch
record). The actual Review state read completed at37.30943299998762 ms.

prepareReviewFence entered at42.20078799998737 ms and completed at
25116.63474699999 ms: **25074.433959 ms** for that existing await.
mutationFence entered at25116.750818 ms. Its final retained progress record is
at06:01:19.5305977Z, 95240.13313899998 ms from server scope start.

There is **no phase 24 mutation-fence-done**, no final thread C08 phase 25–28,
no egress phase 29–31, and no fulfilled/rejected or abort event for this Request
in the retained prefix. Internal readonly C08 work exists within the earlier
fences, so absence of the final thread C08 phase is not absence of all C08 work.
No commit or rollback conclusion is inferred.

### Measured phases and costs

The table reports differences between cumulative metric snapshots. The second
row is a completed await. The third is only an observed prefix of an await.

| Phase | Observed wall ms | Canonical count / inclusive ms | Clone count / inclusive ms | Materialize count / inclusive ms | Queue inclusive ms |
|---|---:|---|---|---|---:|
|Before prepareReviewFence|42.147809999994934|426 /5.699363999912748|0 /0|23 /12.717974999992293|0.024254999996628612|
|prepareReviewFence completed|25074.433959|171794 /5537.539534004682|2836 /11824.99461899983|2461 /687.766544000202|996.8835999998555|
|mutationFence retained prefix, incomplete|70123.38232099998|443696 /14742.308984004761|5530 /36293.00852700026|8724 /573.4766649981902|0.7788929999805987|

At the last Request 42 record, cumulative observations were:

- Canonical:615916 calls, 20285.547882009356 ms.
- cloneSnapshot:8366 calls, 48118.00314600009 ms.
- Materialization-plan:11208 calls, 1273.9611839983845 ms.
- Queue wait:254 calls, 997.6867479998327 ms; the immediate predecessors were
  classified Request, not maintenance. Their mirrored997.8374749998766 ms
  includes the intervening observation and must not be added again.
- Write lock:676 calls, 6.5368650001473725 ms.
- Memo hits:676 for each of dashboard/planner/procurement. Maximum existing
  payload string units:1156242/705/978; plan units 1950000.
  No memo-miss, decode or planning metric was observed in Request 42.
- Observer clocks:1913960 reads. Metric-map bookkeeping638703 updates,
  49.1241289999889 ms. Prior output emission66 calls, 3.944314000022132 ms.
  These overhead intervals retain the lower-bound caveats above.

Full clone time is the largest measured inclusive subtotal, especially after
mutationFence starts. This is evidence for examining the actual clone callsites,
not evidence that callbacks, validations or authorization can be removed.
The three measured children do not form an exhaustive disjoint partition;
do not label their remainder exclusive CPU or add overlapping spans.

### Abort and completion limits

The observer saw **no server Request abort event**. The create continued emitting
beyond30s of server elapsed time, but this does not establish when/if a client
abort propagated. The client30000 ms timer remained unchanged. The last progress
record is not completion of the mutation fence, nor a terminal result. The
scenario/fixture teardown eventually stopped the installation with that work
still lacking a retained settlement event.

No product change or new run is authorized by this result. The next task is a
static causal proposal preserving every real callback and all28 conditional
successful-path validations already described in the [retained static triage](https://github.com/gustavomhss/Orchestra-SF/blob/ec6b8c6821716d9df40bdea31cd774bacfb4f8ac/docs/handoff/diagnostics/REPORTS-C05-CREATE-TRIAGE.md).
