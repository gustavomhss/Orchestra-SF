# C17 — source and opaque-state boundary diagnostic candidate

## Status and question

This is a prepared CI-only diagnostic candidate on product feeda92842bc4f26aec83901b5162543e9ca4bdd, tree f911e18272648bbbb7c46017b7974448abc9d0af. Root and Operations reviewed the exact textual utility, observer edits and inverses with no remaining static blocker. The candidate still requires concrete commit/readback review; no compiler, diagnostic or nominal is authorized or has run. It contains no optimization, cache, new transaction root, authorization or grant.

The completed physical-copy diagnostic 44696207174 failed the original C17 cooperative deadline: 0 pass, 1 fail, 2 expects, case duration 105008.06 ms. Its 12 copy rows sum to 5680.990 inclusive ms across 221574 closed spans. Mutable Dashboard roots accounted for 1339.798 ms, of which 488.674 ms was Dashboard target copies and 851.124 ms was Planner/Procurement copies. The data does not justify extending mutable projection. Its full evidence is docs/handoff/evidence/c17-physical-copy-44696207174.json at 24e8e58ef23de5e9e20f481f0bb5c248f8516d3f.

The older synchronous diagnostic 44679705156 on a different product lineage measured 19045.196 ms in canonical.digest, including 17104.847 ms in canonical.bytes, inside one completed mixed producer span of 43561.955 ms. It did not attribute that cost to source guards, source-identity validation or opaque state cloning. These overlapping figures cannot be subtracted from the newer whole-test prefix.

This proposal asks which of six existing synchronous boundaries has material elapsed cost. It does not assume an immutable preimage cache is eligible. In particular, decoder validation alone does not certify source-identity shape or exclude an intervening provider wrapper; all existing validations and before/after guards continue to run.

## Six paths

1. modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts: measure its two existing guard preimage digests, the complete three-snapshot map, the existing finish body, and requireSourceIdentities.
2. modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts: measure only structuredClone(state) in the existing opaque-read arm.
3. modules/sucafina/Sucafinav1/runtime/audit-c17-boundary-profile.ts: six numeric aggregate buckets and a single synchronous emitter.
4. modules/sucafina/Sucafinav1/test/product/wp10/integration/source-boundary-cost.diagnostic.test.ts: import the original complete C17 and register one synchronous afterAll flush; no new test or assertion.
5. .ci-run.json: select only the importing file, with package sucafina, runner bun, --timeout 30000 and ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER=1.
6. This manifest at docs/handoff/diagnostics/C17-SOURCE-BOUNDARY-PROFILE.md.

LocalStore, canonical.ts, the original C17/deadline helper, every fixture, workflow, harness, public configuration and main handoff remain unchanged. This proposal does not include the previous physical-copy observers.

## Exact units and ordering

Line references below name the uninstrumented FEEDA source-lifecycle blob 75c9a9455ed543c48ffefc00be6b25efd2a32950 and state-provider blob 57d71858c8ceb411f907cae46450a0f16a6a5940.

| ID | Existing expression/body | Unit |
| --- | --- | --- |
| 1 | source-lifecycle:108 digestSfValue(snapshot.sfSources) | One original pre-work digest expression |
| 2 | source-lifecycle:110 digestSfValue(snapshot.audit) | One original pre-work audit digest expression |
| 3 | source-lifecycle:189 surfaces.map((surface) => digestSfValue(snapshots[surface])) | One complete original map expression, including its array allocation; up to three digests |
| 4 | source-lifecycle:112–125 existing finish callback body | One invocation of that existing callback, including thrown exits |
| 5 | source-lifecycle:257–260 requireSourceIdentities body | One complete validation invocation, including thrown exits |
| 6 | state-provider:256 structuredClone(state) | Only the original opaque-arm clone expression |

IDs 1, 2, 3 and 6 use a synchronous measure helper that invokes its private arrow exactly once inside try/finally. This adds an instrumentation closure and function call, not another production expression, read, clone or provider invocation. The collector does not retain that function, its arguments or its return value. IDs 4 and 5 add start/try/finally/end in place inside the original bodies.

The source guard's order stays digest(sfSources), audit.length, digest(audit), conditional business-restore clone, then the returned finish closure. No snapshot.audit or sfSources property is read in advance for telemetry. The transactionAll order stays original references, the complete map of three digests, map of guard closures, then the original awaited callback. Its snapshot replacement check and post-work digests stay unchanged.

ID 3 counts a map span, not three completed digest calls. If the map throws after an earlier entry, its closed span is still counted. No successful-call multiplier may be inferred from this counter.

The entire finish body remains literal apart from indentation and the observer. It includes requireSourceIdentities, mutation/audit fences, business-restore handling, enumerate, synchronizeSources, projectScope work through synchronizeScopes, and final validation. Its inclusive time overlaps ID 5, including validation invoked recursively through source lookups. The IDs are not an additive CPU breakdown.

At state-provider:256, only the argument becomes c17BoundaryMeasure(6, () => structuredClone(state)). The read callback is still called and awaited exactly once at its original position, outside the timing span. All preceding selectors, abort checks, final authorize and authority comparison remain unchanged.

## Numeric protocol

The only additional log is one SF_C17_BOUNDARY_PROFILE line from the importing spec's synchronous afterAll. Its fixed schema is {schemaVersion:1, spans, clock}. Each nonzero spans row is [metricId, closedSpans, timedSpans, inclusiveMilliseconds]. clock is [startAttempts, endAttempts, instrumentationFailures]. The emitter iterates only six private numeric buckets and rounds elapsed totals to three decimals at emission.

Start/end/flush bookkeeping is best-effort. Timing or logging failure must not replace an original return or exception. A start failure can produce a closed span without a timed span. An emitter failure can leave no profile line and must be reported as missing evidence. No per-node/per-request/per-root log, periodic timer, listener, asynchronous flush, retry or retained graph is added.

## Static preservation and intended review

The proposed inverse removes six source edits and two state-provider edits and restores both base files literally. Source-lifecycle retains 11 await and 11 async tokens; state-provider retains 21 await and 6 async tokens. Neither file contains SQL, and LocalStore is untouched. The helper has no imports, await, async, SQL, source identity or authorization state.

The original C17 blob remains 0d9094ae67866a919573c9c172176ca2bc88d4dc; its deadline helper remains 3eb140557b597156baf52578d8981d332e52aef3. The importing file adds no test(), expect(), await, fixture or timeout. The cooperative 105000 ms deadline and Bun 120000 ms budget remain original. The request timeout remains 30000.

Root and Operations passed the exact textual proposal before candidate preparation. The concrete commit still needs independent readback/review and explicitly authorized real compilers before any single diagnostic. No trigger is authorized by this document.

## Interpretation limits

- Totals include initialization, the completed/aborted test prefix and cleanup before the single flush. They are not phase-specific or Request-specific. Work left after an outer timeout and afterAll is outside the emitted prefix.
- Spans are inclusive elapsed time, not CPU time. Finish overlaps validation and may include real synchronous producer callbacks. Adding those totals would double count.
- The new closures, calls, try/finally and clocks perturb the deadline. Probe overhead is present and cannot be subtracted from the original result.
- This does not measure canonical per-node cost, SQL/open/close/queue/lock time, every state clone, or all materialization. ID 6 excludes selector clones and the awaited opaque read callback.
- Physical-root counts from the previous run are not source-guard counts: specialized raw transactions and inherited callbacks have different paths.
- A high preimage cost would establish an investigation target, not authorize a cache. Correct native-method admission before invocation, immutable provenance, normalization, failure ordering, business-restore behavior and opaque fallbacks remain unresolved design obligations.
- The Reports scoped-source composition is absent from this product. Its separate compatibility work cannot be inferred from this diagnostic.
- All original assertions and outcomes remain authoritative. The previous 83/6 result, C17 failure and mixed-siblings deadline remain open. No nominal, sf-ci, integration or automatic rerun is included.
- The protocol records only fixed labels and numbers. No payload, source/result ID, Request, credential, header, stack, snapshot or provider function is logged or retained by the counters.
