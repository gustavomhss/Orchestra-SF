# Canonical readonly composition — limited integration review

## Decision and results

**Recommend the exact five-file integration, followed by one clean original journey with unchanged budgets. Installed and latency qualification remain PENDING.** Root integrated these exact blobs in `2d3abae061c9d4be188540433b9d34c4bfaf2b24`, tree `63b9ed2901def792362a7aa8678f895d0cbac791`; final GitHub readback confirmed all five identities.

The [combined gate 45006460499](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45006460499/job/137159049164) remains **FAILED**: 53 passed, 2 skipped, 1 failed, 974 assertions. All ten new groups, original LocalStore, Finance, CLI types and E2E types passed. C17 reached its original 105000ms cooperative deadline during reopened ancestry resolution, without a value/source assertion failing first. Its later cycle/revocation phases were not reached. The initial guard also rejected a previously integrated raw QA log.

The [pre-correction C17 control](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45007654887/job/137162737147) on the unchanged audited base reproduced that deadline in the same phase, with identical completed inner/outer canonical read counts (14/1952). This establishes a pre-existing limit, **not** a C17 pass or performance equivalence. Separate hosted jobs and differing surrounding test selections are not a benchmark. [Control receipt](https://github.com/gustavomhss/Orchestra-SF/blob/223b41a7472ab199cdc6987d05562d8d33ac7431/docs/qa/sucafina/design/wave-five/collab/c17-precorrection-control-01/receipt.json), blob `9a8b81874c93de309cd2145180c5fff4bd008705`.

The [guard-only gate 45007665762](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45007665762/job/137162771489) passed after the raw-log cleanup: 78 rules, 669 files, 36 warnings, zero gates/errors/approvals, `touchesGuards:false`. Original guard rules remained intact. Both control and guard cleanup jobs passed. This does not change the combined gate's failed conclusion.

## Exact provenance

| Identifier | Value |
| --- | --- |
| Audited base | `5882179a3fea2bbbec465821ffd5a13c06deda4b` |
| Private-query candidate | `74364b8f1313270e96d0d5e7e517e1e1a966f6c0` |
| Child-scope candidate | `5bf37fc96c0d42cff073eee754bdc9a5543d85fa` |
| Joint source with tests | `a5dbf5f712136d73bb752f3fb84aa812d4332dff` |
| Combined CI snapshot | `37417cdeda06111bec608e4839d458e49b39ae25` |
| C17 control snapshot | `ef04ad162e2d8802c62c8f46298b5c737eb9d4c5` |
| Guard-only snapshot | `ffb12c38b322b0936b9d589976f37abac0ebd331` |

## Correction and preserved boundaries

Source lifecycle reached CurrentChoice's wrapper, while LocalStore's private readonly registry recognized only its original store object. That lost capability retained full-copy/full-hash fallback inside genuine readonly roots.

A query-only private WeakMap now recognizes only the exact factory-emitted persistence object and delegates to the original LocalStore reader. Unknown spreads, proxies and opaque drivers cannot register a reader. It pins plain objects, `input.persistence`, `fence.persistence`, driver/wrapper identities and seven original own data-function methods on both objects: `currentSnapshots`, `currentSnapshot`, `hasCurrentSnapshots`, `transaction`, `transactionAll`, `readSnapshotRoot`, `currentSnapshotScope`. Observations also pin their CurrentChoice ALS scope and validate its parents; invalidity is sticky.

LocalStore alone decides readonly eligibility. Writer/preimage authority is not promoted through the broader `observeAuthority`. Original closed/aborted errors, scope tokens and `unpoisoned` requirements remain intact.

Legal nested transactions create child lexical scopes sharing a physical root. The calculation consumer obtains a fresh canonical proof in that child, requiring the original root identity, identical bytes identity and fresh `current()`. False/exception is sticky; admitted sealed paths cannot fall back to `live`. Initially opaque providers keep their original path. Raw scope equality remains strict and checks ancestral closure/abort.

Original transactions, CurrentChoice publication/guards, both source-fence revalidations, Planner preparation/two authorizations/projector/egress, and C08 reader provenance remain. The source transaction sealed branch at base line 614 is unchanged. This reactivates existing pure digest reuse under immutable-root proof; it adds no authorization, result or projection cache.

## Coverage limits

Six LocalStore groups and four composition groups cover original SQLite/C08/Planner, child reads, guards, opaque fallback, drift after awaits, poison, abort and escaped continuations. The integration projector counter differs from `installedDashboardProjector`, leaving that Dashboard identity optimization ineligible. Nested `Choice.run` was reviewed statically, not explicitly exercised. The second-root negative uses an already closed owner; it proves non-revival despite equal defined bytes identity, not an isolated token-comparator test. No installed preview budget or latency improvement is claimed.

## Five-path boundary

The [source-to-base comparison](https://github.com/gustavomhss/Orchestra-SF/compare/5882179a3fea2bbbec465821ffd5a13c06deda4b...a5dbf5f712136d73bb752f3fb84aa812d4332dff) contains exactly these paths; no workflow, script, schema or admission-descriptor path changed.

| Path | Blob |
| --- | --- |
| `apps/cli/src/sucafina-product/planner-calculation-root.ts` | `a76473e700d62774d8e068cf69fa1d2123812024` |
| `modules/sucafina/Sucafinav1/product/decisions/current-choice-preview.ts` | `c3715380830df6bad1b320e1f1bb00b15959654f` |
| `modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts` | `e292f539b03bf6d0aa5268cca33a0a5fdf004479` |
| `modules/sucafina/Sucafinav1/test/local-store.test.ts` | `b67a3fd90eefc5ebf880528d22be2afcdc25c3c8` |
| `modules/sucafina/Sucafinav1/test/product/wp10/integration/current-choice-readonly.test.ts` | `6c836317f08ea0f36b734bcd26c7ab0c4e5350bb` |
