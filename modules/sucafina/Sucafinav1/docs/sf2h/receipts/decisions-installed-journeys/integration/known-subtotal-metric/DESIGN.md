# P7 — private known-subtotal metric proposal

Status: **DRAFT_STATIC_ONLY_NOT_RUN**. This is a complete two-file owner proposal against nominal09 W `0917b48676b2828b94ec85a9926f79db49e6076e`, not a repository change or a runtime acceptance result. No product code, compiler or tests were executed while preparing it.

## Decision and measured limits

The new private producer serves `planner:known-subtotal-difference` independently. It does not call the general comparison port or borrow an earlier comparison. The general comparator, criterion rule registry, human-choice policy and all five UI journeys remain unchanged.

Static call-path inspection explains the extra work when a numeric rule exists: the outer comparator evaluates the criterion twice; a conditioned metric short-circuits `verifyMetric`, so each evaluation invokes one `readMetric`; the existing metric invokes the general comparator with empty criteria, and each such comparison has two complete scenario-resolution phases. This identifies repeated work, not a measured duration for nominal09's third compare. D8 timings are not transferred to nominal09. No deadline or expected speedup is claimed.

An observation capability from the outer comparator was rejected for this proposal. Reusing its already observed metric would introduce provisional proof whose validity depends on the outer final fence and would remove the metric's independent source observations. That capability would also be unavailable to `resolveChoiceValues`, which calls `readMetric` independently after its comparison. The private producer supports both consumers without changing their rule or choice contracts.

## Public shape of the private module

`createSfKnownSubtotalMetric({ host, business })` returns a function with the existing registry's metric request type and a `Promise<PortResult<CriterionMetric> | typeof knownSubtotalMetricNotApplicable>` result.

`knownSubtotalMetricNotApplicable` is a unique symbol. Its only role is selecting the original metric implementation for a structurally unsupported shape. It is never a successful authorization or a metric value.

The dependency object contains only the actual result store, complete case reader, Planner source/coverage readers and the P6 factual Planner projector. Their methods and containing objects are captured per invocation and checked after awaited calls. No producer result is retained by the factory between invocations.

## Eligibility and fallback

Historical envelopes and the complete current case are read through their existing authorized readers before alternatives are selected. Each result reference must match the actual historical envelope, the same case id/incarnation, a producer version no later than the requested current case version, the result digest and exactly one current alternative's request/result digests.

The narrow path accepts only two distinct result references for zero-operation, zero-assumption Planner alternatives in USD. Every `result.sourceRefs` item must be a Planner record. Each alternative must have exactly one matching Planner/planner-version record for its `scenario.baseRef`; other Planner evidence is retained. A null stored subtotal selects the unchanged general producer before the narrow projection/coverage proof starts.

Operations, assumptions, non-USD currency, non-Planner result evidence or null subtotals produce the sentinel. Missing/duplicate matching sources, changed historical data, bad result/request relationships, wrong case versions, bad source digests or failed source/coverage/projection authority produce ordinary failure results. They never select fallback. All coverage evidence, including evidence outside Planner when admitted by the real coverage reader, retains its existing canonical checks.

## Observation order

All work is enclosed by `readPortfolioSnapshot`. It joins only the helper's matching live scope or creates the canonical root; its refusal does not retry or call the work directly. The underlying helper's established behavior for hosts without persistence remains unchanged.

For an eligible invocation the order is:

1. Revalidate the host and capture request, binding, lease and dependency identities.
2. Read both historical results with `readHistoricalScenarios`; preserve every canonical per-result authorization/source callback and the existing opaque-facade behavior.
3. Read the complete current case through `cases.read`; enforce exact requested current version and unique alternative/basis relationships.
4. For baseline, then candidate, invoke the actual P6 Planner projector, actual source resolver and actual case-coverage resolver. Clone each observation before another callback can reuse it.
5. Reconcile each result with its current projection, then call `comparePlannerScenarios` synchronously.
6. Invoke both Planner projectors, source resolvers and case-coverage resolvers again as a fresh second phase. Compare the full non-projection proofs and canonical projection digests, then compare the fresh pure-calculator result.
7. Read both historical envelopes again, compare complete envelope digests, and revalidate the host.
8. Read the complete case again after the preceding awaited callbacks and compare its full digest and exact current identity/version.
9. Return the cloned metric through the snapshot helper's final authority/read-root fence. The metric's value, currency, horizon, evidence and engine version come from these actual observations.

There are no in-flight-result shares, maps serving reads, cross-invocation caches, automatic retries, requests to mutation endpoints or alternate readers after failure.

## Reconciliation before arithmetic

The pure calculator's conditioned branch alone does not prove that stored subtotals still match a current financial projection. The new producer therefore requires all of the following before calling it:

- Current source reference digest, installation/project, source selector and record identity agree.
- Result currency/horizon agree with the complete case, its cost coverage, and the actual projection context.
- Projection principal, access revision and policy agree with the current call.
- Projection component IDs are unique; non-null component amounts are finite.
- `plannerComponentDigest(stored.components)` equals `plannerComponentDigest(actualProjection.components)`. Only the existing canonical read-timestamp normalization is used.
- The stored subtotal equals `plannerKnownSubtotal(actualProjection.components.map(amount))`, preserving component order and IEEE-754 behavior. A projection with no non-null amount cannot become zero. Explicit zero remains zero.
- The real coverage reader returns exactly the requested case coverage reference, current basis and complete assessment matching the selected alternative. It keeps its own evidence, authority and before/after checks.

The existing `comparePlannerScenarios` determines complete/conditioned/incompatible/unavailable. No result is upgraded to complete. The metric is confirmed only if that calculator returns complete; otherwise it remains conditioned. Its `engineVersion` is read from the actual candidate projection, without a hard-coded producer version.

## Identity and mutation guards

The invocation pins the original Request, a digest of method/URL/headers, original call binding object and digest, lease identity, request argument digest, host object/methods/persistence, business object, result-store object/read methods, case object/read method, source object/source and coverage methods, and projector method. A change is rejected after the corresponding await and again before return.

Projector source/selection arguments and case selector arguments are cloned and checked for mutation after the call. Historical outputs, complete cases and all producer outputs are cloned on observation; returned metric/evidence is cloned. Source and case authorization continue to run through canonical producers; object identity checks are supplementary and are not substitutes for authorization.

## Integration change

`portfolio-authority.ts` imports and instantiates the private producer, then invokes it immediately after the existing metric availability guard, before the old candidate historical read. A non-sentinel result is returned directly. The entire existing implementation from `const captured = structuredClone(request)` through its final metric return is byte-identical to P6 and remains the fallback.

The new file and this integration change are shared-owner proposals. They do not edit CurrentChoice46, Procurement/C12, Reports48, workflows45, the criterion registry, the general comparator, any UI title, assertion, budget or test identity. Runtime59 remains an isolated-composition dependency under the authority/release conditions recorded by the root.

## Structural work comparison and validation still required

For the nominal same-case pair whose stored producer versions differ, the old metric reaches four historical-batch calls plus its preliminary candidate read, eight complete-case calls, four projector calls and four explicit source/coverage calls. This proposed producer reaches two historical-batch calls, two complete-case calls, four projector calls and four explicit source/coverage calls. These are calls made by this layer, not counts of each reader's internal authorization work and not a latency estimate.

Required hosted validation includes independent authority/freshness and arithmetic/property cases for this new producer, unchanged fallback behavior, denial without fallback, provider/object mutation, wrong result selectors, stale complete-case changes, changed coverage, source/projection mismatch, explicit zero versus absent amounts, canonical floating-point order, fresh second invocation, plus all five exact original UI journeys. The unit proposal is being prepared independently. No result is assigned PASS by this design note.

## Revision2 admission classification

The source now explicitly returns denied when the original Request is absent or already aborted, before entering the snapshot callback. This preserves the initial authority failure instead of letting the final identity guard relabel it stale. The forged serialized UI-lease fixture keeps its denied assertion and zero historical reads. The change was identified by static source review; no test execution occurred. The original v1 material, patch and design note remain available as superseded evidence.
