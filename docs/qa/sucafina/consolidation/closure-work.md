# Closure work

Run `44329483839`, job `sf/test-CI-SF-2` (`134890490763`), head `2e5839eebb`. Same blobs on `sf-red-clusters` @ `f88dd671b3`. Not fixed.

`test/product/wp07/closure-work.test.ts:70` throws `unavailable: action-create-identity-unavailable` from `available(closures.confirm(...))`.

Cause is not the closure handler. `createReviewClosurePort.confirm` calls the injected handoff and returns a non-ok result unchanged (`product/reviews/closure-action.ts`). The fixture handoff is `port.handoff.create`, which calls `createHotTopicPort.create`. A correlation with no producer receipt returns `unavailable` / `action-create-identity-unavailable` unconditionally (`product/dashboard/hot-topics.ts`, blob `051be54adbf197a0f4b290ab6bc6aaa9f0f563d5`). The published host finalizes source identities after the callback and exposes no atomic creation/binding hook. A textual id or a later write cannot name the physical action. `createCollaborationHotTopicHost` returns that value when `commit` is false and has no alternate creator.

`sf-hot-topics` owns that identity path. This lane owns only the test and the closure handler. No assertion was weakened. No receipt, grant, or closure was seeded.

The producer must record an incarnation returned inside the same transaction as the domain create. Do not seed a receipt or invert the positive assertion.

No `bun test`, no `bun run test:ci`, no `gh workflow run`.
