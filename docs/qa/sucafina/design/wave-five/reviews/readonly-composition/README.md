# Canonical readonly composition — candidate review

## Status and provenance

**Qualification: PENDING. Not an installed UI or latency qualification.**

The joint workflow completed with **failure**; its Linux test job failed and cleanup succeeded. The regression result is **53 passed, 2 skipped, 1 failed, 974 assertions**. All ten new groups passed; the existing C17 ancestry case reached its original cooperative 105-second deadline during reopened ancestry resolution. No value/source assertion failed before that deadline. CLI and E2E typechecks passed. The guard also rejected the previously integrated raw `portfolio-metric-batch/attempt-01.log`; root owns its removal and the Actions-provenance replacement, without a guard exception or rename. This is not an all-green gate. The pre-correction C17 control remains separate; no causal latency claim follows.

| Identifier | Exact value |
| --- | --- |
| Audited base | `5882179a3fea2bbbec465821ffd5a13c06deda4b` |
| Private provenance candidate | `74364b8f1313270e96d0d5e7e517e1e1a966f6c0` |
| Child-scope consumer candidate | `5bf37fc96c0d42cff073eee754bdc9a5543d85fa` |
| Joint source with tests | `a5dbf5f712136d73bb752f3fb84aa812d4332dff` |
| CI snapshot | `37417cdeda06111bec608e4839d458e49b39ae25` |
| Workflow | [45006460499](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45006460499) |
| Linux test job | `137159049164` — failure |
| Cleanup job | `137160221040` — success |

Workflow metadata was read directly through GitHub MCP. Detailed runtime logs and the final result interpretation are owned by the root/analytics receipt.

## Why the capability was lost

The installed source lifecycle uses the exact persistence object emitted by CurrentChoice, while LocalStore registers readonly readers against its own original store object. The generic source reader reached the CurrentChoice object, missed that private registration, and retained the full-copy/full-hash fallback even inside a genuine readonly root. The earlier presence recognizer proves lexical presence through function provenance; it does not supply equivalent readonly authority data.

The correction adds a **query-only private WeakMap**, registered solely inside the CurrentChoice factory and keyed by its exact persistence object. It delegates to the original LocalStore readonly reader. Unknown spreads, proxies and opaque drivers cannot register a reader.

It pins plain-object/proxy checks, `input.persistence`, `fence.persistence`, the driver/wrapper identities, and seven original own data-function properties on both objects: `currentSnapshots`, `currentSnapshot`, `hasCurrentSnapshots`, `transaction`, `transactionAll`, `readSnapshotRoot`, and `currentSnapshotScope`. Each observation also pins its CurrentChoice ALS scope and validates that scope and its parents. Invalidity remains sticky; original LocalStore closed/aborted errors propagate.

## Readonly, child scopes and preserved checks

LocalStore alone decides readonly eligibility. Its strict reader requires a real readonly root; the broader `observeAuthority` path can also admit an active writer preimage and is deliberately not substituted. Original scope tokens and the `unpoisoned` requirement pass through unchanged.

A legal nested transaction creates a child lexical scope sharing the physical root. The calculation consumer therefore reobserves a **fresh canonical proof in the active child**, requiring the original root identity, identical bytes identity and fresh `current()`. Failure or exception is sticky; an admitted sealed path never falls back to `live`. Initially opaque providers keep their original path. Raw LocalStore scope equality remains strict, and `requireScope` checks parent closure and abort.

No original transaction, CurrentChoice publication/guard, source authorization, projector, selector, request validation or fence is replaced. Source-fence reads retain both revalidations. Prepared Planner reads retain preparation, both authorization callbacks, projection and egress checks. The original transaction sealed branch at base line 614 is unchanged.

The C08 read-scope consumer retains original reader provenance and all namespace/authentication/environment/fence observations. This reactivates existing pure digest reuse under a proven immutable root; it adds no authorization, result or projection cache.

## Tests and limits

Ten new groups comprise six LocalStore groups and four composition groups. They exercise original SQLite, C08 admission, Planner sources, legal child reads, active guards, full-copy fallback, method/owner drift after awaits, poison, abort and escaped continuations.

The integration projector counter intentionally differs from `installedDashboardProjector`; Dashboard projector identity optimization is therefore ineligible. These fixtures do not qualify every installed Dashboard path. Nested CurrentChoice execution was reviewed statically; an explicit nested `Choice.run` is not asserted. The second-root negative proves that an owner-closed descendant cannot revive despite equal defined bytes identity; it does not isolate root-token comparison from owner closure. No installed result, preview budget or latency improvement is claimed.

## Exact changed-path boundary

[Source-to-base comparison](https://github.com/gustavomhss/Orchestra-SF/compare/5882179a3fea2bbbec465821ffd5a13c06deda4b...a5dbf5f712136d73bb752f3fb84aa812d4332dff) reports exactly these five paths. No workflow, script, schema or admission-descriptor path changed.

| Path | Blob |
| --- | --- |
| `apps/cli/src/sucafina-product/planner-calculation-root.ts` | `a76473e700d62774d8e068cf69fa1d2123812024` |
| `modules/sucafina/Sucafinav1/product/decisions/current-choice-preview.ts` | `c3715380830df6bad1b320e1f1bb00b15959654f` |
| `modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts` | `e292f539b03bf6d0aa5268cca33a0a5fdf004479` |
| `modules/sucafina/Sucafinav1/test/local-store.test.ts` | `b67a3fd90eefc5ebf880528d22be2afcdc25c3c8` |
| `modules/sucafina/Sucafinav1/test/product/wp10/integration/current-choice-readonly.test.ts` | `6c836317f08ea0f36b734bcd26c7ab0c4e5350bb` |
