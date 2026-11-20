# Internal Dashboard agenda discovery candidate

## Status and lineage

- Product base: `094d8919819dcbad73dc6d7f02ef7b8dd4faefd4`, tree `dd393e68458c578f190b41047f593ca9b9c9e985`.
- Isolated candidate only; no integration into `audit-one`, no CI trigger and no claim of qualification.
- No original test, assertion, timeout, request, workflow, grant, receipt, public digest or renderer version is changed.
- No diagnostic instrumentation from the Reports installed profile is part of this candidate.

## Evidence and interpretation limits

The unique installed RPT03 diagnostic ran on product `9bcfc9de18a0ddd0dc00edecbddc221649db07c3` with diagnostic candidate `7724b11a0a521bc9373833e75c9a12ef1e7998af`, snapshot `44746f15f15f1d4826a2557ed350c452db33e103`, run **44659526852**, job **136034025483**, artifact **14594673867**. It failed **0 passed / 1 failed** at the unchanged 180-second budget, with `apiRequestContext.get: read ECONNRESET` at `reports-support/model.ts:54`, called by `review-flow.ts:171`. Compiler4 of the diagnostic was green in run **44659144398**, job **136032748245**, snapshot `c13dec0f02806225b03338a0a5756251b7257bd0`.

Sanitized numeric evidence is durable at `reports-profile-evidence@6d8bc9fb3866af8e89fed6955a4a8a4a6b11f445`, file `docs/handoff/diagnostics/REPORTS-INSTALLED-PROFILE-44659526852.json`, blob `49debeb892fc984be23208709f85ebbfb638c531`.

Scope 38 was an HTML `sf=review` request still executing after 102,257 ms, with 16 completed canonical producer reads and 15 legacy C08 proof reads. Its 6,709 Dashboard memo observations were hits; there were no decode/plan misses in that request. Its one producer-result clone and four scoped proofs are compatible with one primary review producer plus historical reopens in the update loop. The instrumentation intentionally omitted query parameters and producer IDs: that precise branch attribution remains an inference. No new `review-read` request entered the instrumented local handler after scope 30. This does not locate the unadmitted network request more precisely.

Static callers on the product base:

- `extended-http.ts:229-237` computes a successor bootstrap and repeats `reviewCycle.update` after the asset/auth await.
- `extended-review-cycle.ts:33-60` retains the primary review's before/after reads, issues/resolves each section source and calls Dashboard discovery once per supported section. It consumes only `.agenda`.
- `dashboard-services.ts:213-228` obtains both history ID lists, reopens every capture and reads every saved review. Its historical review reader at `:126` has no local-reader eligibility and uses the legacy producer/proof path.
- `extended-http.ts:247-252` and `review-agenda-services.ts:185-199,272-274` also consume only `.agenda`.
- The public Dashboard workbench at `dashboard-http.ts:68-71` returns the complete discovery result and continues to use the original full operation.

For a three-section successor and two saved reviews, one complete update can perform 3 × 2 × 2 = 12 legacy canonical reads; the HTML branch can run that update twice. This arithmetic identifies unnecessary work in a concrete caller. It is not a measured runtime saving or proof that the original nominal Reports budget will pass.

## Runtime delta

Four files change:

1. `apps/cli/src/sucafina-product/dashboard-services.ts`
   - A private registry binds the exact factory object and its original own data method to a separate agenda operation.
   - The public `discover` still executes the complete original body.
   - The internal return type contains period, agenda, records, record limit and permissions; it does not promise an empty historical catalog.
   - The shared core omits only the loops calling `history.reopen` and `historicalReviews.read` when invoked internally.
   - Both C08 `state.read` calls and their original callbacks/order, all record/source projectors, the human action lookup, final source digest comparison and final host revalidation remain.
   - Factory/method eligibility is checked at entry, before each omitted loop and after the final await. A changed method/accessor calls the current public method with the original receiver, request object and context. No observation, result, grant or authorization is memoized.
   - Unregistered wrappers, spread/prototype copies and proxies use the public call. Accessors and replaced methods on the registered object also use the public call. Unknown objects are not descriptor-inspected.
2. `apps/cli/src/sucafina-product/extended-review-cycle.ts`: one agenda-only callsite.
3. `apps/cli/src/sucafina-product/extended-http.ts`: one agenda-only callsite.
4. `apps/cli/src/sucafina-product/review-agenda-services.ts`: two agenda-only callsites.

Static reconstruction of the original discovery body after removing only the new private guards, optional-loop conditions and type annotations is byte-identical, modulo the two-space relocation indentation. The Dashboard service retains **54 await tokens**. Public JSON key order and history contents retain their previous construction order. This is source review, not execution evidence.

## New component test

`modules/sucafina/Sucafinav1/test/product/reports-draft-reconciliation/agenda-discovery.test.ts` contains 16 cases:

- One real fixture creates a C05 review and a record capture through existing producers/human admission. It proves public history still contains both; the narrow response exactly equals the full response without history, retains nonempty record/draft/permissions, has the same record callback prefix and exactly the two original C08 list reads. The real agenda consumer is exercised. A real source edit yields a new selector/current values.
- Six shapes retain full public semantics: custom wrapper, spread copy, inherited method, proxy, replaced method and accessor. Wrapper receiver/argument identity and proxy/accessor observation counts are checked.
- Three awaited replacement boundaries: preferences read, reviews read and final host reauthorization. Each invokes the current public method exactly once with the same receiver, request and context.
- Two namespace-failure cases preserve the actual C08 permission dependency. The original C08 call executes before an explicit negative boundary result; no successful authority is fabricated.
- Four public/internal × real source-change/real authority-loss cases retain the exact final stale/denied responses and expose no value.

The fixture reuses `financialCompositionFixture`, its unchanged grants, real SQLite/source persistence, Dashboard selectors/record projectors, C05 storage and real human admission. Ordinary Hot Topics data is fixture input. No review body, receipt, selection, source evidence or successful authorization is seeded. The new component cases use 120,000 ms each, consistent with existing Dashboard composition tests; all existing budgets remain untouched.

## Proposed review and gate matrix

No run is authorized by this document. After independent cold review:

- New `reports-draft-reconciliation/agenda-discovery.test.ts`.
- Original `review-first-agenda/discovery-filter.test.ts` in full: topic restrictions, dynamic custom wrappers, source scope and authority fences.
- Original `wp10/integration/dashboard-review-history.test.ts` in full: public C05 history and capture/receipt integrity.
- Original `reports-draft-reconciliation/installed-review-entry.test.ts` in full: actual Reports bootstrap/update/refresh consumers.
- Original `wp07/dashboard-agenda-consumer.test.ts` in full: record selection, order, exact sources and private-source denials.
- Real package typechecks for Sucafina and CLI, using the established Actions harness.

Only after those results and root approval should the unchanged nominal Reports request be considered. The installed diagnostic remains red and is not relabeled as a passing nominal gate.
