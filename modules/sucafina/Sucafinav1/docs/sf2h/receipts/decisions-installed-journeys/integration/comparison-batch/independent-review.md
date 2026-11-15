# Mission52 — independent static review of P5 batch forwarding

Reviewed exact proposal `/workspace/scratch/fec39c0682b3/m52-work/p5-batch-material.json` and complete patch `/workspace/scratch/fec39c0682b3/m52-work/p5-batch-complete.patch`. No product execution, test, compiler, dispatch, remote mutation or timeout edit was performed.

## Conclusion

No new blocking mismatch was found in this addition. It restores the actual producer's optional phase-local batch capability that the existing comparison wrapper discarded. It does not invent a batch result, reuse a cached observation across phases, skip source checks or alter the numerical calculation.

This is static qualification only. The earlier J1 artifact did not locate the ten-second delay inside a specific call. The proposed change has a concrete lost-capability mechanism, but its runtime benefit still requires the original journey. Root's next nominal06 also moves to C27 with the separately integrated runtime56 copying fix. Any combined improvement must be attributed to that exact composition, not solely to this batch proposal.

## Exact bytes

| Item | Identity |
| --- | --- |
| Path | `apps/cli/src/sucafina-product/portfolio-comparison-scope.ts` |
| Preimage blob | `7d43f60fdb1a6400cdec1b89c1717e6a2b8a2f11` |
| Postimage blob | `feae4846feb657924d9229193eeeded58b378851` |
| Postimage SHA256 | `a52cd613e8f9b6fbb572a8f6f6df04ad14da36b58d1dbbafaab2115e6716939a` |
| Complete patch SHA256 | `fa7a31097a1e71777942a0b5c916103ee7f9b7e43d93933143c0dffc7987e491` |
| Material JSON SHA256 | `cf350d668b3a7178a3b8d380b5e1d8e87de9f2332b6575d04a9804fec4ac77a5` |

Static parsing of the two unified-diff hunks reconstructs the complete postimage exactly from the supplied preimage. The preimage blob matches the actual W5 file retrieved by GitHub MCP. No source interpreter or product import was used for that check.

## Real producer wiring

`portfolio-authority.ts`, blob `138238ca9273e84f39f8e1db484378a3e62d41d4`, obtains `business.plannerProduct.scenarios` and constructs the real comparison scope. Lines83–90 pass the scope's scenario facade to `compareScenarios`. The preimage facade returns only `resolve`, even when its original producer has `resolveMany`.

`product/planner/product.ts`, blob `d3d616e972a73748e6ccac95e3aa7aafdfd204c8`, line32 builds `createStoredPlannerScenarioHost` and line39 exposes that scenario host. `stored-scenarios.ts`, blob `529e29806b3faf15f88eec009c198e783f4248a3`, line95 exposes both `resolveMany` and scalar `resolve`; the scalar already delegates to a one-element batch. Therefore forwarding the existing batch uses the producer's own supported API.

## Phase and result checks preserved

`scenario-comparison-port.ts`, blob `1782c2094239c3712d3a895a6a25f4160fb429c7`, defines resolveMany as one fresh sibling observation whose later phases require a new call (lines12–15). The comparator invokes its resolver initially, after the comparison, and after criterion checks (lines27–28,48,64). Source/coverage checks at lines33–49 and63–65, required authority revalidation and the actual comparison formula remain unchanged.

The canonical `resolvePlannerScenarioBatch` helper clones inputs/results and rejects wrong result cardinality (lines74–84). The new adapter adds no alternative decoder or fabricated successful entry.

The real stored producer still performs:

- Fresh historical-result observation for each call, including facade identity checks.
- Initial authorized case observations grouped only inside that call and by exact stored case ref.
- Per-occurrence stored-kind, case continuity, alternative digest and coverage-basis checks.
- Real external producer replay or real Planner compareForecast for each applicable alternative.
- A new result reread after the projections.
- Separate final complete-case observations, with full case digest equality.

These are `stored-scenarios.ts` lines25–95. Initial and final case maps are newly allocated inside every invocation; the wrapper does not export or reuse them.

## Added wrapper guards

Postimage lines137–162 capture a cloned reference list, its digest, exact producer object and resolveMany method, the current scope, Request and binding digest before the asynchronous boundary. The call is refused if those identities are absent or change.

For an active scope, `current` requires the WeakMap entry, AsyncLocalStorage scope, exact retained Request, non-aborted signal and unchanged binding. An overlapping caller outside that lexical scope cannot borrow it. Without an active scope, the wrapper requires that one has not appeared during the call.

The adapter retains actual selected-case admission before constructing recursion keys. Keys use the same reference/case/binding format as scalar resolution. A collision with an in-flight scalar or batch read denies the batch rather than waiting on itself or returning unfinished data. Keys are deduplicated only for the recursion set; the producer receives the full original reference sequence with duplicates preserved, so this does not remove per-occurrence checks.

`batch.call(producer, ...)` preserves the real receiver. Input and output clones prevent a later producer/caller mutation from rewriting the retained observation. The post-await guard checks all captured identities again. A rejection or exception still executes the finally and removes only the keys added by this invocation.

No observation is inserted into either `scope.proofs` or `scope.scenarios`. Those existing scalar/proof paths are otherwise unchanged. Each subsequent comparator phase calls the actual batch again; there is no new cross-phase or cross-request cache.

## Scope and remaining qualification

The patch changes only the shared `portfolio-comparison-scope.ts` proposal. It changes no UI, test identity, assertion, timeout, criterion rule, cost/coverage formula, financial approval, CurrentChoice, C12 or workflow. An absent producer batch retains the original scalar facade.

No source finding here is evidence that numeric-rule, choice/history or post-source-change assertions have passed. Nominal06 must retain those assertions and report its exact C27+overlay SHAs. C27 compatibility/preimage reconciliation is owned by root/composition audit and is separate from this W5 contract comparison.
