# WP10 lifecycle lane

Unproven. No production edit. No test, Playwright, `test:ci`, or `gh workflow run`.

Evidence is run [44329483839](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44329483839), shard artifact `sf-shard-failure-CI-SF-2` `run.log`, tested SHA `2e5839eebb859969851b81aaa29f4f71b4c49d71`. Map: `origin/sf-failure-map` `2f30a186fb`. Committed on `origin/sf-red-clusters` `f88dd671b3`. The files below are unchanged from `2e5839eebb` through that head, so the cause is not already fixed.

## Admission

`analysis-lifecycle-admission.test.ts`, all 3 cases, one assertion each. `createSfAnalysisRunContext` (`apps/cli/src/sucafina-product/analysis-run-context.ts`) and `withCase` / `selectedCase` / `resolveCase` (`apps/cli/src/sucafina-product/business-services.ts`).

### Rollback revives the selector

Log line 67: `selectedCase` expected `"unavailable"`, received `"ok"`. Stack continues at `business-services.ts:281`, the line after `await action()` inside `withCase`. The printed source matches this tree.

`context()` binds selector version 1 with `allowHistoricalRetry: true` while C08 holds version 2. `withCase` admits because historical retry only rejects `live < selector`, and stores the selector, not the version it observed. The test then writes version 1. `selectedCase` (`business-services.ts:252`) and `resolveCase` (`:266`) treat stored version `===` selector as fresh, so equality after rollback returns `"ok"`. The comment at the assertion forbids that revival.

Proposed, not landed: on `CaseScope`, record `observedVersion` from the `cases.read` that admitted the scope. `selectedCase` and `resolveCase` must require the stored version to still equal `observedVersion`, not only the selector. A rollback to the selector then stays `"unavailable"`. An unchanged exact admission (selector `===` live) still returns `"ok"`. Nested `withCase` already denies while `caseBindings.has(call)`.

The log frame `analysis-run-context.ts:82` is `readLockedMembership`'s snapshot check in `createSfAnalysisLifecycleContext`. The test imports `createSfAnalysisRunContext`, whose `withCase` call is line 33. Do not treat line 82 as the caller.

### Egress ignores membership revoked inside authorize

Log line 122: context result expected `"denied"`, received `"ok"`.

The test replaces `human.authorize`. After the action returns, `createSfAnalysisRunContext` (`:34-36`) returns the action result when authorize returns true. The hook clears `participants` and sets version 3 during that authorize, then returns true. Binding and `requestFor` are unchanged. Egress never re-reads C08, so membership revocation escapes.

Proposed, not landed: after authorize, and before returning the action result, read the case and deny unless the actor is still a participant and the stored version is still the version observed at admission. The hook runs after `withCase` has released the scope, so the check cannot live only inside `withCase`.

### Snapshot fault never becomes `fired`

Log line 187: `fired` expected `true`, received `false`. Line 186 (`status === "denied"`) had already passed.

`cases.read` calls `state.read("cases")` (`product/decisions/case-port.ts:88`). `state.read` opens one `persistence.transaction("dashboard")` (`product/host-binding/state-provider.ts:163`). The test's wrapper counts those frames and the fault's first statement is `expect(snapshots.length).toBe(2)` before `fired = true`. Depth is 1, so that expect throws inside the projection. `case-port.read` catches it (`:115`) and returns unavailable. `withCase` (`:275`) maps any non-ok read to `"denied"`. `fired` stays false. The same `context()` enters its action in the first test, which does not wrap `state.read`, so the denial is the swallowed fault, not a missing case.

Proposed, not landed: the admission/egress projection must run with an outer `persistence.transaction` still on the stack, so the callback sees depth 2, can mutate `snapshots[0]` or finish the lease, and post-callback authorization denies. Do not edit `state-provider.ts` (typecheck lane) or `analysis-http.ts`. Which outer surface stays nested, rather than joining the dashboard transaction, is not proven. Do not guess it.

## Revocation tail

`revocation-tail.test.ts`, all 3 cases, on the authorized positive path. `access.allowed = false` is never reached.

- Line 87: `producer.prepare` expected `{ status: "ok", value }`, received `{ status: "unavailable", reason: "analysis-source-unavailable" }`. Phase `tail.prepare-authorized` returned in 8693ms.
- Lines 104 and 124: `verifier.verify` expected `"ok"`, received `"unavailable"`.

`createSfMemoryInputProducer.prepare` (`input-producer-memory.ts:22`) and `createSfDecisionMemoryVerifier.verify` (`analysis-verifier-memory.ts:30`) return that reason when `observeSfMemorySelection` / `readSfMemorySelection` yields no proof. The log has no inner stack.

Same run, CI-SF-7, `historical-memory.test.ts:292` fails the same `prepare` expectation. Its `memory.prepare` counts are `atlasCanonicalReads: 1`, `atlasCanonicalCompleted: 1`, `evidenceContextReads: 2`, `caseReads: 7`, `caseFences: 9` (8208ms). That test expects 2 atlas canonical reads and 6 evidence context reads for two completed observations. The first observation does not return a proof. Not this lane's test, and not a named predicate: `readSfMemorySelection`, `caseRecall`, and `memory-case-read-scope` `observe` can all return undefined after that much work.

No patch. Instrument the undefined return before changing evidence or recall rules.
