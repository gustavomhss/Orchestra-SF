# Repeated case observations in Planner consumers

## Observed failure and boundary

GitHub Actions run `43581792536` exceeded the unchanged test limits in four paths:

| Consumer | Observed duration | Existing limit |
| --- | ---: | ---: |
| WP03 composed threshold, training variants | 223.6 s | 180 s |
| WP03 UI/MCP scenario parity | 63.9 s | 60 s |
| WP05 engine omitted training to confirmed 40,000 | 219.9 s | 180 s |
| WP11 composite coverage variants | 227.9 s | 180 s |

The parity log completed its assertions and reported 322 evidence calls. Its first comparison increased the evidence counter from 42 to 182; the independent MCP comparison increased it from 182 to 322. The original log remains evidence of failure, not a successful timeout waiver. The local normalized log is `test4-clean.log`, SHA256 `04fbd846e55b390dc73495edfbbfab788f973d7b0edaa0f9ab3746a34f1f6cd3`.

Simple real scenario checks completed in less than half a second; the IEEE fallback check took approximately 3.7 seconds. Static tracing identifies repeated case authorization and operation verification in the composed consumers as a substantial additional cost. This diagnosis does not establish that all four paths fit their limits after the change; that requires a new scoped Actions result.

## Authorized change

`PlannerScenarioHost` gains an optional `resolveMany` extension in its producer-owned type. `createStoredPlannerScenarioHost` implements it. `compareScenarios` and `createPlannerSensitivityUnits` call a new batch for each of their existing observation phases. Hosts with only `resolve` continue through the individual path.

Each batch first reads every result independently through the existing result store. Only authenticated scenario records can participate in a case group. The group key includes the complete producing `caseRef`: ID, incarnation and version. Historical scenarios from different producing versions remain valid candidates in separate groups; the change does not introduce a new equality requirement between their producing versions.

For each group, the batch performs a canonical `cases.read` at the beginning and a distinct canonical `cases.read` at the end. It retains the exact-alternative request/result digest checks, coverage-basis selection, source identity, `compareForecast` per result, and final whole-case digest comparison. Every successful scenario still has two independent result-store reads. All final result-store reads finish before the final case phase begins.

The maps belong to one `resolveMany` invocation. They are never retained by the factory or carried between calls, consumers, contexts, initial/final phases, sensitivity samples or solver probes. Every observation is cloned after its awaited producer call; callers receive separate deep clones per result, including duplicate references. A refused batch result remains refused, and malformed cardinality produces an explicit refusal instead of falling back to an individual resolution.

The singleton path in `preview-comparison.ts` is unchanged. Its baseline observation before simulation and its observation after simulation remain independent. No financial formula, authorization policy, shared state provider, artifact store, host integration or shared contract was edited for this change.

## Static call accounting

Counts below describe a stable, successful observation of two alternatives from one producing case version. They count invocations of the canonical case port, not raw SQLite reads inside that port.

| Path | Previous case reads | Batched case reads | Retained work |
| --- | ---: | ---: | --- |
| Resolve two sibling scenarios once | 4 | 2 | 4 result-store reads; 2 forecast comparisons |
| `units.issue` | 10 | 6 | 12 result-store reads; 4 direct forecast comparisons; both external case reads and all evidence checks |
| `compareScenarios` without criteria | 8 | 4 | Initial and final scenario phases; per-result source/coverage checks and authority revalidation |
| Scenario observation phases of comparison with criteria | 12 | 6 | Initial, second and final scenario phases; criterion evaluation/re-evaluation unchanged |

For a case with two alternatives, each canonical case read invokes the real operation verifier twice for each alternative. Thus the `units.issue` change reduces those nested operation verifications from 40 to 24 while retaining their complete behavior whenever they run. The reduction comes from siblings using one authenticated case observation in a phase, not from memoizing an authorization decision across phases.

## Directed verification supplied

`test/product/wp11/scenario-batch-fixture.ts` uses the real private UI admission, scoped source issuer, Planner projection/scenario producers, operation verifier, C08 storage and case port. The fixture bootstraps an explicitly incomplete coverage inventory and seeds cases; this is not a resident-session or human-workflow proof.

`test/product/wp11/scenario-batch.test.ts` contains nine directed checks:

1. Exact counts and order for both case observations, both reads of each result, every forecast comparison, a fresh repeated call, and independent clones for duplicate references.
2. Identical sensitivity-unit bindings for the batched and legacy hosts, with six versus ten canonical case reads and unchanged store/forecast counts.
3. Independent initial/final comparison batches, concurrent calls for the same reference under separate admitted contexts, and rejection of a principal outside the case.
4. Separate groups for another case and for different producing versions, retaining order, cardinality and a missing-reference refusal.
5. Persisted ledger, alternative-title and coverage-basis changes between phases, including changes without a version bump, detected by the complete case digest.
6. Authority revoked after result rereads, rejected by the fresh final case observation.
7. A real Planner OPEX save during projection, rejected by existing scoped source and result-store checks.
8. Retained store/case callback objects modified after an await, unable to rewrite the saved initial observation.
9. Explicit refusal for malformed batch cardinality and denied results, with no success fallback; legacy-only hosts still resolve normally.

No existing assertion or timeout was removed or increased. Product tests have not been run locally. The original four timeout paths, financial goldens, source fences, hosted typecheck/guards and an independent authority review remain required at the exact published head. Until those results are attached, this receipt records an implemented optimization and proposed regression proof, not a passed gate or WP completion.

## S7 fixture correction

Run `43585919034` executed the batch tests and the existing resume/freshness tests. The batch's returned values and directed refusals reached the expected assertions, but eight batch tests stopped at their call-counter assertions: the fixture incremented counters inside an optional hook call, so JavaScript skipped each increment whenever that hook was absent. The event list still recorded the underlying canonical calls. The callback-alias test, which installed all three hooks, passed.

The correction increments each counter unconditionally before its optional hook. No expectation, result, authorization, product code or timeout was changed. The portions of the eight tests after their failing counter assertions still require execution at the corrected head.

The same run exposed two older preview tests that supplied an empty-operation source observation to the transient preview comparator. Since source observations now have `source-scenario:` identity, the comparator correctly refused them as `preview-unavailable`. Those two tests now construct an explicit hypothetical replacement from the actual current forecast amount, currency and period. Their expected 602,000 subtotal, 12,000 cost difference, stale-result refusal and source-state invariance remain unchanged; the product preview admission guard remains intact.

The normalized S7 log is `test7-clean.log`, SHA256 `0f234547fe04a71109aab8f14aba4b04eefa2bcc426634d632edaaaee2388c24`. This receipt does not promote that failed run into a passing result.
