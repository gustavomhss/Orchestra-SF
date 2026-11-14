# Current-choice S14: localized exception diagnostic

## Observed evidence

Actions run `43589528126`, main job `132431103700`, W `cfbf7c824d4351431d35533dbe2572de11084b9d`, S `ee53236037e82ab79227b5ed43874f68dc539e19` fails the lifecycle case after 66,357.82 ms with `choice-preview-unavailable`. Its W22 coverage diagnostic says `coverage-callback-not-reached`. This differs from S12's `choice-preview-coverage-unavailable`. The 180,000 ms budget was not reached by this case.

The original `createCurrentChoicePreview.prepare` guards before coverage return specific denial/stale/conflict reasons. The generic observed reason can result from a thrown exception caught by `prepare`, including one thrown by the initial diagnostic callback before it assigns its observation. The log therefore does not establish a noop-promotion, source-version, or reassessment defect.

## Candidate

Only `test/product/wp11/current-choice-lifecycle.test.ts` changes from blob `a8b72e8c30d6e365c77169e53d499dc163530318` to `2ad002beca9b3c6dab4e1d8841345c9250a6826d`. The transparent trace records the actual resimulation and baseline coverage calls, preserving their returned value or rethrowing the original exception. The initial entries callback records its phase before its existing clones. No new source read, authorization request, Planner replay, financial formula, or product implementation was added.

All 40 existing `expect` calls, the 180,000 ms timeout, operation inputs, source facts, persisted human choice, promotion authorization, case-race checks, reopen checks and no-application checks are unchanged. This candidate is diagnostic only and does not close the current-choice finding.

## Required next evidence

One change-scoped Actions selection of this file on a product commit containing the candidate must record the phase and exception or demonstrate the original flow. The run is dispatched only by the parent using CI.md. No local product execution, Bun command, typecheck or remote mutation occurred in this review.
