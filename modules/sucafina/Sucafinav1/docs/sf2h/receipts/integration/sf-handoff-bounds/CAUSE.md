# Cause: handoff lost-ack returns action-create-identity-unavailable

Status: unproven. No product change. No assertion change. No test run. No workflow run.

## Failure

Run [44329483839](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44329483839), job `sf/test-CI-SF-8` (`134890490924`), head `sf-red-clusters` at `f88dd671b3bedf4ffffa50eafaec78068fc33cb3`.

`modules/sucafina/Sucafinav1/test/product/wp08/handoff-real-boundaries.test.ts:40`

- expected: `{ status: "unavailable", reason: "action-outcome-unknown-retry-same-correlation" }`
- received: `{ status: "unavailable", reason: "action-create-identity-unavailable" }`

## Why the lost-ack reason never appears

The test injects response loss only after a durable hot-topic transaction returns `status: "ok"` (`handoff-real-boundaries.test.ts:21-23`). `createSfProductState` returns `ok` only when the callback commits (`product/host-binding/state-provider.ts:247` returns `preview` when `commit` is false; `:292` returns `ok` only after `commit: true`).

`createHotTopicPort().create` never reaches that commit. For a new correlation it returns immediately:

`product/dashboard/hot-topics.ts:38-42`

```
return { commit: false, value: { status: "unavailable", reason: "action-create-identity-unavailable" } }
```

Blob of that file at this base: `051be54adbf197a0f4b290ab6bc6aaa9f0f563d5`. No `DashboardPeople.domain.execute` on CREATE. No correlation write. No `targetIncarnation`.

`createCollaborationHotTopicHost` forwards that non-commit (`product/collaboration/hot-topic-host.ts:41-42`). `commit.requested` stays false, so the preview is not rewritten to `action-commit-unconfirmed` (`:49`). The host `.catch` at `:47` and the handoff `.catch` at `product/collaboration/handoff.ts:58` both map a thrown loss to `action-outcome-unknown-retry-same-correlation`, but CREATE resolves. Neither catch runs.

The caller therefore receives the identity refusal. Later assertions in the same test (one committed topic, same-correlation retry, conflict on changed content) are downstream of this refusal and were not reached as a separate cause.

## Why CREATE was not reactivated here

The published lifecycle finalizes source identities after the callback (`product/integration/source-lifecycle.ts` `guard` / `synchronizeSources`, and `SF_SOURCE_IDENTITY_MUTATION` if the callback writes `sfSources`). The CREATE callback cannot observe the incarnation that will be assigned to the row it would insert. A textual id or a later write cannot prove which physical action the correlation created (`hot-topics.ts:38-41`).

Receipt `docs/sf2h/receipts/ui-split/ui-source/README.md` records the same refusal as IR-EXT-CREATE-INCARNATION: CREATE stays `action-create-identity-unavailable` until lifecycle and the C08 host emit identity and correlation in the same commit. `test/product/ui-split/ui-source/source-identity.test.ts` asserts that refusal. Removing it here would be an unproven happy-path claim and would contradict that receipt. Assertions were not weakened. `product/portfolio/campaign.ts` was not edited.

## Not done

- no `bun test`
- no `bun run test:ci`
- no `gh workflow run`
- no pull request
