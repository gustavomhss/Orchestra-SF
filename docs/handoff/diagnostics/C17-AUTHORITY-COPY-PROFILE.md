# C17 — physical copy diagnostic on the qualified authority fixture

## Status and question

This is CI-only observation code on product `feeda92842bc4f26aec83901b5162543e9ca4bdd`, tree `f911e18272648bbbb7c46017b7974448abc9d0af`. It is prepared with [skip ci] on its own branch. No compiler, diagnostic, nominal or sf-ci has run on this candidate.

The question is where whole Dashboard copies still occur: inside a physical readonly root, a physical single-surface mutable root, or a physical all-surface mutable root. The diagnostic distinguishes currentSnapshot(s) copies from copies passed to inherited transactions, their surface and their original materialize/clone/load branch. It also counts successful returns from the existing ACL projection and the existing refusal when the root lacks an own readOnly marker with value true.

This is not an optimization. No new root, lock, retry, authorization, grant, result cache, source identity or mutable projection is introduced. The original C17 remains the sole test. Its 105000 ms cooperative deadline and 120000 ms Bun budget are unchanged; the request retains --timeout 30000 and OMNI1.

The prior full functional run `44686066277` remains 83/6. The authority fixture's four counter failures were separately repaired and qualified by run `44690275245` (14/0/98 expects/487 ms) and Sucafina compiler `44690275700` (1/0/0 skip/0 cancel). Those results do not close C17 or mixed siblings and are not performance measurements. Complete prior evidence is `docs/handoff/evidence/c17-authority-rounds-44690275245.json` at `902a08f1762902178f8450485e2468169132ec06`.

The original CI-only profile d6dce1a6935cd894514d34290487d7b19619dbe4 was not executed. Static review exposed an inherited-marker eligibility bug in its product base. Product feeda fixes that classifier with one own-property guard; full local+consumer run 44694336416/job 136147372062/cleanup 136147782247 passed 34/0/234 expects in 1001.00 ms. Compiler2 run 44694338478/job 136147378330/cleanup 136148196730 passed 2/0/0 skip/0 cancel in 71946.664586 ms, with exact feeda markers. The new four controls cover inherited readOnly value/getter in both real mutable root kinds, requiring unsupported projection, original accessor errors and zero getters. These are component correctness results, not C17/performance evidence. Compared with d6, this profile retains the same numeric module, importing spec and request; only the observed eligibility guard and this manifest are adapted to feeda. Neither the old d6 profile nor this proposal has a diagnostic run.

## Five changed paths

1. `modules/sucafina/Sucafinav1/runtime/local-store.ts`: two timed copy boundaries, three physical-root registrations, and two ACL events.
2. `modules/sucafina/Sucafinav1/runtime/audit-authority-copy-profile.ts`: numeric, best-effort counters and one synchronous aggregate emitter.
3. `modules/sucafina/Sucafinav1/test/product/wp10/integration/authority-copy-cost.diagnostic.test.ts`: imports the complete original C17 and registers one synchronous afterAll flush. It declares no new test or assertion.
4. `.ci-run.json`: selects only that importing diagnostic file.
5. This manifest.

No existing test, fixture, workflow, harness, protected file or main handoff is changed.

## Observation boundaries

Line references in this section name the original LocalStore blob `077b5e2be53546451dfba0b75957b10cca481bce` at feeda.

- `copyCurrentSnapshot:148–153`: the original materializer lookup remains first. The clock then surrounds the existing materialize return or snapshot lookup, missing-snapshot error and cloneSnapshot return. Its finally records only the existing surface argument and the truthiness of the already-read local materialize variable. The return values and exceptions remain original. A clone-branch span can end with the existing missing-snapshot error before cloneSnapshot is entered; the metric is a branch span, not proof of a successful clone.
- `transaction:303–308`: original scope creation, materialize lookup, staged snapshot lookup and row/query evaluation remain in the same order. Only the original materialize / cloneSnapshot / loadSnapshot expression is timed. Classification reuses the materialize and staged locals; it does not read a snapshot, row payload or argument field for telemetry. This span excludes the preceding lookup and SQL.
- Physical roots are registered only immediately after their real scope is created at original lines 263, 372 and 444. The WeakMap key is the private root identity; its value contains only two enum numbers. No snapshot, Request, callback, SQL connection or authorization value is copied into a counter or emitted. Registration neither certifies a provider nor changes any production registry.
- Root kind comes from those three construction sites, not the surface of a nested callback. A nested Planner callback can therefore remain classified under a Dashboard or all-surface physical root.
- At original line 486, the existing short-circuit is split equivalently: absence of an own readOnly property returns after incrementing event 2 without reading any inherited value or getter; an own value other than true also returns with event 2. sameStore is checked only when both original marker conditions pass, exactly as before. requireScope stays before both. Closed/aborted scopes retain their original exception behavior. No other rejection, provider callback or current() check is added.
- The returned-projection event occurs immediately before the original return at line 523, after its fresh ACL copies were constructed. It does not invoke current(), inspect the selected-surfaces array or count an authorization grant.

## Numeric protocol

The module emits at most one line, prefixed `SF_AUTHORITY_COPY_PROFILE`, from the importing spec's synchronous afterAll. There are no per-call logs, timers, listeners, retries or asynchronous flushes. The body has only fixed keys and numeric arrays.

Codes:

| Dimension | Codes |
| --- | --- |
| caller | 1 = copyCurrentSnapshot; 2 = inherited transaction copy expression |
| physical root kind | 0 = unclassified; 1 = readonly; 2 = mutable single-surface; 3 = mutable all-surface |
| surface / physical target | 0 = none or unexpected; 1 = Dashboard; 2 = Planner; 3 = Procurement |
| original copy branch | 1 = materialize; 2 = clone; 3 = loadSnapshot (inherited only) |
| ACL event | 1 = projection returned; 2 = refused by the existing own-readOnly-true guard |

Rows:

- `roots`: [physicalRootKind, physicalTarget, registrations].
- `copies`: [caller, physicalRootKind, physicalTarget, copiedSurface, branch, closedSpans, timedSpans, inclusiveMilliseconds].
- `authority`: [event, physicalRootKind, physicalTarget, count].
- `clock`: [startAttempts, endAttempts, instrumentationFailures].

Only nonzero counter rows are emitted. Surface classification uses strict equality with three fixed strings; an unexpected value is not coerced and no property or iterator is read from it. The emitter iterates only its private numeric arrays after the test. Elapsed values are rounded to three decimal places only at emission. Closed spans include original throws; timedSpans permits clock failures to be distinguished from counted spans. Instrumentation failures are best-effort diagnostics, never a reason to change a production return or error. An emitter failure can leave no profile line and must be reported as missing evidence.

## Preservation checks

The in-memory inverse removes precisely eight observer edits and restores LocalStore feeda byte for byte. The file retains 22 await tokens, 19 async tokens and all 23 SQL query/exec sites in their original literal sequence. Existing method signatures and exported production entrypoints are unchanged. Neither requireScope nor any source, authentication or authority callback is wrapped or replaced.

Original C17 is retained at blob `0d9094ae67866a919573c9c172176ca2bc88d4dc`; its deadline helper remains `3eb140557b597156baf52578d8981d332e52aef3`. The importing file has no test() call, expect(), additional await, timeout override or fixture alteration. Its single afterAll hook flushes synchronously after the original test's own cleanup path. Root and Operations must review the exact commit before any compiler or test trigger.

## Interpretation limits

- These totals cover initialization, the entire completed or aborted test prefix, and cleanup observed before the single flush. They do not isolate a publication phase or a particular Request. If an outer timeout leaves work running past afterAll, those later events are outside the emitted prefix; no periodic recovery log is added.
- The clocks surround the two selected synchronous copy expressions. Inclusive elapsed time is not CPU time. No timing overhead is subtracted; the probe itself perturbs the original deadlines. The public test result, including a deadline failure, remains authoritative.
- This does not instrument canonical serialization, every materializeSnapshot/cloneSnapshot call, the state-provider structuredClone, SQL/lock waits, authentication, source projection, or initial physical-root decoding/materialization. In particular, ACL's first access to a private lazy graph and its fresh metadata copies are not inside these two copy timers.
- ACL counts cover only calls reaching the registered LocalStore reader. Opaque input/source/driver rejection before that reader is not an ACL event here. A returned projection is not proof that later provenance or authorization checks succeed.
- On a memo hit, projecting a private graph can require one initial full materialization. Removing a currentSnapshot copy call therefore does not imply an equal number of full materializations saved. This diagnostic makes no optimization or gain claim.
- Static reading found real state-authority calls in mutable Dashboard roots and in transactionAll during scenario request registration. It did not establish a hot C17 revalidation inside a physical Planner/Procurement root. The physical-root codes prevent that unproved interpretation from being manufactured from a nested callback's surface.
- The diagnostic records no payloads, source/result identifiers, paths from runtime data, headers, credential material, exception text or stack. The fixed test/metric labels and numbers are its only output.
