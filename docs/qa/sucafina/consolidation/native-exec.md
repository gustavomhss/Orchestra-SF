# Native execution cluster

Evidence: `sf-ci` run `44329483839` on `2e5839eebb`, jobs `sf/test-CI-SF-2` (`134890490763`) and `sf/test-CI-SF-7` (`134890490891`). Base `707ce445dc` contains `f88dd671b3`. Commits after the failing SHA do not touch these tests except the typecheck amount guard in `native-scenario-preparation.ts`. Both scenario-preparation logs on this run completed, so that guard is not the cause and was not reverted. No `bun test`, `bun run test:ci`, or `gh workflow run`.

These seven files do not share one producer. The log already separates them. No product patch is applied: a pass cannot be proved without a new run, and two of the refusals are intentional.

## Split

| File | Log | Producer | Proven |
| --- | --- | --- | --- |
| `wp12/native-execution-collaboration-recall.test.ts` | `question input derives a real pending training condition…` timed out after `120000ms` | none; the initial phase finished | yes |
| `wp12/native-execution-scenarios-review.test.ts` | `analysis-authority-changed` | `createSfAnalysisHttp` post-prepare authorize | timing only |
| `wp12/native-execution-dashboard-answer.test.ts` | missing `scenario-is-hypothetical` | `scenario-port` empty-operation observation | yes |
| `wp12/native-execution-question-handoff.test.ts` | `action-create-identity-unavailable` | `createHotTopicPort` create | yes |
| `wp12/native-execution-executive.test.ts` | review-read `200` then `503` | review-read catch | exception hidden |
| `wp12/native-execution-dependencies.test.ts` | issuers did not authorize | four issuer results collapsed | which call hidden |
| `wp12/native-execution-questions.test.ts` | no bound answer observation | `sf_answer_read` | status hidden |

## collaboration-recall

`SF_WP12_REAL_QUESTION_PENDING_INPUT` printed, then the `120_000` budget fired before `harness.open("reopened")`. The question producer and `sf_question_prepare` had already returned. Sibling WP12 tests use `300_000`. Raising this budget is not applied: reopen was not observed.

## scenarios-review

`SF_WP12_NATIVE_SCENARIO_PREPARATION` succeeded, including hypothetical components. The next `prepare` on `/sucafina/planner?sf=workbench-analysis` failed five minutes later. `createSfAnalysisHttp` awaits `inputs.prepare`, then `human.authorize`, and maps any authorize miss to `analysis-authority-changed` (`apps/cli/src/sucafina-product/analysis-http.ts`). UI admission expires at five minutes (`product/integration/ui-authority.ts`). The wall clock matches that lease, but authorize also fails on revalidation, so expiry is not proven exclusive. Do not lengthen the lease to force a 200.

## dashboard-answer

Promotion uses `operations: []` and `assumptions: []`. `scenario-port.ts` treats that as a current-source observation and returns exactly the received set: forecast gaps plus `coverage:${categoryId}:${reason}`. `scenario-is-hypothetical` and `preview-not-applied` are added only when the request has operations or assumptions. Do not add the hypothetical flag to the empty-operation branch; that would contradict the observation comment. Do not drop the assertion.

## question-handoff

`handoff-create` reaches `createHotTopicPort`. New creates return `action-create-identity-unavailable` before any write because the host finalizes source identity after the callback (`product/dashboard/hot-topics.ts`). `ui-split/ui-source/source-identity.test.ts` requires that refusal and zero durable effects. Do not seed a receipt or flip the positive assertion. An atomic identity seam is a separate change and would have to replace that negative test, not bypass it.

## Not proved

- Executive sequence 17 `review-read` returned. Sequence 21, after meeting prepare, got 503. The handler catch maps a thrown read to `review-read-unavailable` (`apps/cli/src/sucafina-product/extended-http.ts`). The exception text is not in the log.
- Dependencies throws one error if any of page, project, other, or CAPEX issue is not `ok`. The log does not name which call or reason. The same job later issued question sources, so issuance is not globally dead.
- Questions hides the `sf_answer_read` status. The same job's dashboard-answer read was `ok` with a UI receipt, so the reader is not globally dead. Possible exits in `collaboration/dispatch.ts` include `answer-unavailable`, `review-answer-output-contract-unavailable`, and `answer-changed`. The log does not say which.
