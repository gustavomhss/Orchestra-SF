# Source observation denial: revalidate not counted

CI `44329483839` job `sf/test-CI-SF-7`, head `2e5839eebb859969851b81aaa29f4f71b4c49d71`.
Failing assertion: `modules/sucafina/Sucafinav1/test/product/diagnostics/calculation/source-observation.test.ts:86`.
Expected `revalidate: 1`. Received `revalidate: 0`, with the unused timing fields still at zero (`beforeCallbackMs: 0` is the first extra field in the diff, not a substituted key).

## Observed

Phase `candidate-next-invocation-denied` logged `status: "denied"`, every counter `0`, `elapsedMs` about `0.015`. No source transaction was admitted, so `beforeCallbackMs` stayed `0`.

## Cause

1. Phase `candidate-egress-revoked` sets `fixture.active.value = false` inside wrapped `host.revalidate` count 4, then delegates to the real host.
2. `createSfUiAuthority.revalidate` (`product/integration/ui-authority.ts`) authorizes the retained Request. `createSfProductAuthority` resolves the actor through `input.authenticate`. The fixture authenticator returns null while inactive, so authorize returns undefined, the admission is deleted, and revalidate returns false. The resolver returns `stale`. That phase still counts `revalidate: 4` because the wrapper incremented before the real call.
3. The next invocation's `requestFor` requires a current consumed admission and returns undefined.
4. `createSfPlannerSourceHost` (`product/integration/planner-sources.ts`) denies with `if (!request || !await input.host.revalidate(context))`. The missing Request short-circuits, so the wrapped `revalidate` is never called. The observation therefore records `revalidate: 0` and returns `denied` without opening a source.

## Not patched

Calling `host.revalidate` once when the Request is already gone would make this assertion match and would not open a source. It is not applied.

The sibling owner-intake gate `test/product/wp10/integration/calculation-source-observation.test.ts` asserts the same scenario as `revalidate: 0` and states that a later invocation has no Request and must stop before another source or authority await. The published patch `proposed/0001-wp10-source-observation.patch.txt` keeps the short-circuit. `OWNER_HANDOFF.md` item 6 only requires `denied` before a source is opened, which already holds.

A product change that satisfies the diagnostics count falsifies that sibling gate. The assertion was not weakened. No `bun test`, `bun run test:ci`, or workflow dispatch was run.
