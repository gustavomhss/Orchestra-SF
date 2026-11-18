# CI-SF shard failure map

Source: completed `sf-ci` run [44329483839](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44329483839) on `sf-red-clusters`, tested SHA `2e5839eebb859969851b81aaa29f4f71b4c49d71`. That head is older than current `origin/sf-red-clusters` (`a26a35f135`). This map does not claim the same failures on the newer head.

Only shards that uploaded `sf-shard-failure-CI-SF-*` are counted. Shards 1, 3, 4, 5 and 6 were cancelled and uploaded no failure artifact. Their failures are unknown and are not estimated.

## Artifacts

| Artifact | report.xml tests | failures | skipped | commit |
| --- | ---: | ---: | ---: | --- |
| `sf-shard-failure-CI-SF-2` (`run.log`, `report.xml`) | 513 | 55 | 1 | `2e5839eebb859969851b81aaa29f4f71b4c49d71` |
| `sf-shard-failure-CI-SF-7` (`run.log`, `report.xml`) | 513 | 43 | 0 | `2e5839eebb859969851b81aaa29f4f71b4c49d71` |
| `sf-shard-failure-CI-SF-8` (`run.log`, `report.xml`) | 621 | 22 | 0 | `2e5839eebb859969851b81aaa29f4f71b4c49d71` |

Failing testcases: **120** across **67** files. Counts are `<failure>` / `<error>` elements on `testcase` nodes in `report.xml`. Those elements are self-closing (`type` only, empty message). The first line below is the diagnostic line from the same artifact's `run.log`, taken from the `::group::` for that file and matched to the testcase name. The post-run `N tests failed:` reprint is ignored.

## Selection

`sf/ci/suites.json` `CI-SF.selection.harnessOwnedFiles` has 40 files. Overlap with these failing files: **0**. None of the failing files are harness-owned, so none of them are files the selector must exclude. All 67 are plain product tests under `Sucafinav1/test/`.

## Clusters

Same 120 cases, grouped by the log diagnostic, not by a separate guess.

| Cases | Cluster |
| ---: | --- |
| 51 | assertion mismatch |
| 22 | status/availability contract mismatch |
| 12 | campaign route did not return the expected stale/absent status |
| 8 | auth callback expected 303, received 403 |
| 8 | timeout / deadline |
| 7 | private browser enrollment HTTP failure |
| 7 | missing `@orchestra/ToolSafety` |
| 3 | TypeError |
| 2 | ENOENT missing fixture |

## Top 15 files

| # | Cases | Shard | File | Class | First failure line |
| ---: | ---: | --- | --- | --- | --- |
| 1 | 12 | CI-SF-7 | `Sucafinav1/test/product/wp13/campaign-request.test.ts` | plain product test | error: expect(received).toEqual(expected) \| diff - "reason": "campaign-source-changed", / + "status": "ok", (4/12 cases; 4 distinct lines) |
| 2 | 6 | CI-SF-2 | `Sucafinav1/test/product/http-body-limit-fix/workbench.test.ts` | plain product test | error: expect(received).toBeLessThan(expected) \| Expected: < 72159 \| Received: 72159 (1/6 cases; 6 distinct lines) |
| 3 | 6 | CI-SF-2 | `Sucafinav1/test/product/wp10/integration/bi-call-scope.test.ts` | plain product test | error: expect(received).toEqual(expected) \| diff - "refDigest": "9f68b6ee55bffca18d8fca1aeb81c9b14479072e39d2cab54612eded2e87d0fa", / + "refDigest": "3f52cf783… (1/6 cases; 6 distinct lines) |
| 4 | 5 | CI-SF-2 | `Sucafinav1/test/microsoft-routes.test.ts` | plain product test | error: expect(received).toBe(expected) \| Expected: 303 \| Received: 403 |
| 5 | 5 | CI-SF-2 | `Sucafinav1/test/product/auth-retention-fix/capacity.test.ts` | plain product test | error: expect(received).toEqual(expected) \| diff - 503, / + 303, (1/5 cases; 5 distinct lines) |
| 6 | 4 | CI-SF-2 | `Sucafinav1/test/product/native-phase-bridge/planning-runner.test.ts` | plain product test | error: Service not found: @orchestra/ToolSafety (defined at /home/runner/work/Orchestra-SF/Orchestra-SF/packages/core/src/tool-safety.ts:355:38) |
| 7 | 3 | CI-SF-8 | `Sucafinav1/test/planner-ws9-model.test.ts` | plain product test | error: expect(received).toMatchObject(expected) \| diff - "ok": true, / + "errors": [ (2/3 cases; 2 distinct lines) |
| 8 | 3 | CI-SF-2 | `Sucafinav1/test/product/docx-continuation130/table-flow.test.ts` | plain product test | error: expect(received).toMatch(expected) (1/3 cases; 3 distinct lines) |
| 9 | 3 | CI-SF-8 | `Sucafinav1/test/product/native-phase-bridge/native-context.test.ts` | plain product test | error: Service not found: @orchestra/ToolSafety (defined at /home/runner/work/Orchestra-SF/Orchestra-SF/packages/core/src/tool-safety.ts:355:38) |
| 10 | 3 | CI-SF-7 | `Sucafinav1/test/product/wp05/engine-coverage.test.ts` | plain product test | error: expect(received).toBeNull() (2/3 cases; 2 distinct lines) |
| 11 | 3 | CI-SF-7 | `Sucafinav1/test/product/wp09/request-dossier.test.ts` | plain product test | error: expect(received).toMatchObject(expected) \| diff - "status": "ok", / + "reason": "document-changed", |
| 12 | 3 | CI-SF-2 | `Sucafinav1/test/product/wp10/integration/analysis-lifecycle-admission.test.ts` | plain product test | error: expect(received).toBe(expected) \| Expected: "unavailable" \| Received: "ok" (1/3 cases; 3 distinct lines) |
| 13 | 3 | CI-SF-2 | `Sucafinav1/test/product/wp10/memory-integrity/revocation-tail.test.ts` | plain product test | error: expect(received).toBe(expected) \| Expected: "ok" \| Received: "unavailable" (2/3 cases; 2 distinct lines) |
| 14 | 2 | CI-SF-2 | `Sucafinav1/test/native-ui-contract/talent-files.test.ts` | plain product test | error: expect(received).toBeDefined() (1/2 cases; 2 distinct lines) |
| 15 | 2 | CI-SF-8 | `Sucafinav1/test/product/auth-retention-fix/readonly-composed.test.ts` | plain product test | error: expect(received).toBe(expected) \| Expected: 303 \| Received: 403 |

Distinct first lines inside the top 15, when a file has more than one:

- `Sucafinav1/test/product/wp13/campaign-request.test.ts`
  - 4× error: expect(received).toEqual(expected) | diff - "reason": "campaign-source-changed", / + "status": "ok",
  - 4× error: expect(received).toEqual(expected) | diff - "reason": "campaign-history-changed", / + "status": "ok",
  - 2× error: expect(received).toEqual(expected) | diff - "reason": "campaign-list-changed", / + "status": "ok",
  - 2× error: expect(received).toEqual(expected) | diff - "reason": "campaign-source-changed", / + "reason": "campaign-not-created",
- `Sucafinav1/test/product/http-body-limit-fix/workbench.test.ts`
  - 1× error: expect(received).toBeLessThan(expected) | Expected: < 72159 | Received: 72159
  - 1× error: expect(received).toBe(expected) | Expected: 413 | Received: 200
  - 1× error: expect(received).toBe(expected) | Expected: false | Received: true
  - 1× error: expect(received).toBe(expected) | Expected: 400 | Received: 200
  - 1× error: synthetic-token-74-must-not-escape
  - 1× error: Test "Workbench abort cancels a stalled reader, unlocks it and leaves no durable effect" timed out after 10000ms
- `Sucafinav1/test/product/wp10/integration/bi-call-scope.test.ts`
  - 1× error: expect(received).toEqual(expected) | diff - "refDigest": "9f68b6ee55bffca18d8fca1aeb81c9b14479072e39d2cab54612eded2e87d0fa", / + "refDigest": "3f52cf7835721c1ded13d2c1eb71c096bc20bff3d579096f4ec0f3ddd1c3f623",
  - 1× error: expect(received).toEqual(expected) | diff - "refDigest": "590fff9f9f7409a418ca7303cd259d561cf233ad46522ad5a9b5afdd4aa5572e", / + "refDigest": "8edbe49ae8c1d188dd105ff16f978a4654dbd2395e09c0153708cfd2ad6f1069",
  - 1× error: expect(received).toEqual(expected) | diff - "refDigest": "f47e953350c281bc05d51bec7fb03ab0fa45ce63bd3d84807184fb3b1564e7bb", / + "refDigest": "365d7b89e1ea669f7b32d66fe359f5bed3d390034d531c6c442a9141a69e4dae",
  - 1× error: expect(received).toEqual(expected) | diff - "refDigest": "1692fef515a19baa46dc078e64bb6ab48268687e99c08a03238d3d26fdc4e76c", / + "refDigest": "df2480742400aa0558465bafb227e14ec7e7140e31db8ee0b6d64b83a51d075e",
  - 1× error: expect(received).toEqual(expected) | diff - "refDigest": "338b113ba4679a45107048cdec5b8361c7269080306ba65e17603a4d47e649a3", / + "refDigest": "d8adac14485f39c3911e7969a876f9cd2cec6661e18dfee31ffd2dc52bc50840",
  - 1× error: expect(received).toEqual(expected) | diff - "refDigest": "f56a266783b0259528aab12beb2eda153a4c5093bd1c2050e8142be40707bfa0", / + "refDigest": "057d90c070ca19c7a3ba8306dd3d6eb772f29755c6d8861e1459fa96ef9634b1",
- `Sucafinav1/test/product/auth-retention-fix/capacity.test.ts`
  - 1× error: expect(received).toEqual(expected) | diff - 503, / + 303,
  - 1× error: expect(received).toBe(expected) | Expected: 2 | Received: 0
  - 1× TypeError: undefined is not an object (evaluating 'f.auth.inspect(f.storageKey("login", begun.state), f.provider.clock.value).state')
  - 1× error: expect(received).toBe(expected) | Expected: 303 | Received: 403
  - 1× error: expect(received).toBe(expected) | Expected: 503 | Received: 303
- `Sucafinav1/test/planner-ws9-model.test.ts`
  - 2× error: expect(received).toMatchObject(expected) | diff - "ok": true, / + "errors": [
  - 1× error: expect(received).toMatchObject(expected) | diff - "contractRef": "contract:2026/42", / + "desc": "",
- `Sucafinav1/test/product/docx-continuation130/table-flow.test.ts`
  - 1× error: expect(received).toMatch(expected)
  - 1× error: expect(received).toBeGreaterThan(expected) | Expected: > 4 | Received: 1
  - 1× error: expect(received).toBeGreaterThan(expected) | Expected: > 1 | Received: 1
- `Sucafinav1/test/product/wp05/engine-coverage.test.ts`
  - 2× error: expect(received).toBeNull()
  - 1× error: expect(received).toBe(expected) | Expected: 0 | Received: 1
- `Sucafinav1/test/product/wp10/integration/analysis-lifecycle-admission.test.ts`
  - 1× error: expect(received).toBe(expected) | Expected: "unavailable" | Received: "ok"
  - 1× error: expect(received).toBe(expected) | Expected: "denied" | Received: "ok"
  - 1× error: expect(received).toBe(expected) | Expected: true | Received: false
- `Sucafinav1/test/product/wp10/memory-integrity/revocation-tail.test.ts`
  - 2× error: expect(received).toBe(expected) | Expected: "ok" | Received: "unavailable"
  - 1× error: expect(received).toEqual(expected) | diff - "status": "ok", / + "reason": "analysis-source-unavailable",
- `Sucafinav1/test/native-ui-contract/talent-files.test.ts`
  - 1× error: expect(received).toBeDefined()
  - 1× error: expect(received).toBe(expected) | Expected: "ok" | Received: "contract-unavailable"

## Remaining files

The other 52 files account for the rest of the 120. Each is a plain product test, not in `harnessOwnedFiles`.

| Cases | Shard | File | First failure line |
| ---: | --- | --- | --- |
| 2 | CI-SF-7 | `Sucafinav1/test/product/bi-cost-waterfall/rendering.test.ts` | error: bi09-installed-browser exceeded its 105000ms cooperative deadline (2 distinct) |
| 2 | CI-SF-7 | `Sucafinav1/test/product/review-fixes/procurement-apply/real-apply.test.ts` | error: expect(received).toEqual(expected) \| diff + "confirmed": false, |
| 2 | CI-SF-7 | `Sucafinav1/test/product/wp02/hot-topics.test.ts` | error: expect(received).toMatchObject(expected) \| diff - "status": "ok", / + "reason": "action-create-identity-unavailable", |
| 2 | CI-SF-2 | `Sucafinav1/test/product/wp05/sensitivity-integration.test.ts` | error: Private test browser enrollment failed: goto: net::ERR_HTTP_RESPONSE_CODE_FAILURE at http://localhost:4110/sucafina/auth/local?code=… (2 distinct) |
| 2 | CI-SF-2 | `Sucafinav1/test/product/wp08/thread-period-continuity.test.ts` | error: denied: thread-source-unavailable |
| 1 | CI-SF-8 | `Sucafinav1/test/form-layout.test.ts` | error: Private test browser enrollment failed: goto: net::ERR_HTTP_RESPONSE_CODE_FAILURE at http://localhost:4110/sucafina/auth/local?code=… |
| 1 | CI-SF-2 | `Sucafinav1/test/local-controls-browser.test.ts` | error: Private test browser enrollment failed: goto: net::ERR_HTTP_RESPONSE_CODE_FAILURE at http://localhost:4110/sucafina/auth/local?code=… |
| 1 | CI-SF-8 | `Sucafinav1/test/local-entry.test.ts` | TypeError: undefined is not an object (evaluating '(await corporateIdentity.handle(new Request(`${origin}/sucafina/auth/callback?state=${st… |
| 1 | CI-SF-7 | `Sucafinav1/test/microsoft-composition.test.ts` | ENOENT: no such file or directory, open '/home/runner/work/Orchestra-SF/Orchestra-SF/modules/sucafina/Sucafinav1/docs/sf2h/receipts/microso… |
| 1 | CI-SF-8 | `Sucafinav1/test/microsoft-first-login.test.ts` | error: expect(received).toBe(expected) \| Expected: 303 \| Received: 401 |
| 1 | CI-SF-2 | `Sucafinav1/test/microsoft-node.test.ts` | ENOENT: no such file or directory, open '/home/runner/work/Orchestra-SF/Orchestra-SF/modules/sucafina/Sucafinav1/docs/sf2h/receipts/microso… |
| 1 | CI-SF-8 | `Sucafinav1/test/native-ui-contract/report-health.test.ts` | error: expect(received).toContain(expected) |
| 1 | CI-SF-2 | `Sucafinav1/test/native-ui-contract/routines.test.ts` | error: expect(received).toBe(expected) \| Expected: true \| Received: false |
| 1 | CI-SF-7 | `Sucafinav1/test/operator-browser.test.ts` | TimeoutError: forURL: Timeout 30000ms exceeded. |
| 1 | CI-SF-7 | `Sucafinav1/test/product/auth-retention-fix/maintenance.test.ts` | error: expect(received).toBeGreaterThanOrEqual(expected) \| Expected: >= 4 \| Received: 1 |
| 1 | CI-SF-8 | `Sucafinav1/test/product/c12-composed-compatibility/material-race.test.ts` | error: expect(received).toBe(expected) \| Expected: 409 \| Received: 503 |
| 1 | CI-SF-8 | `Sucafinav1/test/product/canonical-read-cost/diagnostic-cost.test.ts` | error: expect(received).toEqual(expected) \| diff - "product/host-binding/state-provider.ts": "c37501db964c254e99d4a204418c498204ef9e42ec9e3… |
| 1 | CI-SF-7 | `Sucafinav1/test/product/diagnostics/calculation/source-observation.test.ts` | error: expect(received).toMatchObject(expected) \| diff - "revalidate": 1, / + "beforeCallbackMs": 0, |
| 1 | CI-SF-2 | `Sucafinav1/test/product/http-body-limit-fix/listener.test.ts` | error: expect(received).toBe(expected) \| Expected: 400 \| Received: 200 |
| 1 | CI-SF-7 | `Sucafinav1/test/product/integrated-proofs/am02/performance-public-c16-reopen.test.ts` | error: expect(received).not.toBe(expected) |
| 1 | CI-SF-8 | `Sucafinav1/test/product/mixed-source-contracts/capture-prerequisite.test.ts` | error: expect(received).toEqual(expected) \| diff - "reason": "financial-approval-command-unavailable", / + "status": "ok", |
| 1 | CI-SF-2 | `Sucafinav1/test/product/mixed-source-contracts/recorded-fallback.test.ts` | error: mixed-recorded-fallback exceeded its 165000ms cooperative deadline |
| 1 | CI-SF-7 | `Sucafinav1/test/product/work-split/work-reuse/static-gates.test.ts` | error: Test "work-reuse package typecheck and repository guards use the canonical commands" timed out after 120000ms |
| 1 | CI-SF-8 | `Sucafinav1/test/product/wp00/corpus-consumer.test.ts` | TypeError: Expected received to be a number for 'expect'. |
| 1 | CI-SF-2 | `Sucafinav1/test/product/wp01/components.test.ts` | error: expect(received).toContain(expected) |
| 1 | CI-SF-7 | `Sucafinav1/test/product/wp02/dashboard-browser.test.ts` | error: expect(received).toBe(expected) \| Expected: true \| Received: false |
| 1 | CI-SF-7 | `Sucafinav1/test/product/wp02/import-report-consumer.test.ts` | error: expect(received).toBe(expected) \| Expected: "unspecified" \| Received: "USD" |
| 1 | CI-SF-8 | `Sucafinav1/test/product/wp03/scenario-bi.test.ts` | error: expect(received).toBe(expected) \| Expected: "ok" \| Received: "unavailable" |
| 1 | CI-SF-2 | `Sucafinav1/test/product/wp04/ui-queues.test.ts` | error: expect(received).toEqual(expected) \| diff - [ / + [] |
| 1 | CI-SF-8 | `Sucafinav1/test/product/wp05/choice-history-bi.test.ts` | error: Test "same-case BI preserves the human choice while the confirmed training revision changes its current source result and table" tim… |
| 1 | CI-SF-7 | `Sucafinav1/test/product/wp05/contributions-browser.test.ts` | error: Private test browser enrollment failed: goto: net::ERR_HTTP_RESPONSE_CODE_FAILURE at http://localhost:4110/sucafina/auth/local?code=… |
| 1 | CI-SF-8 | `Sucafinav1/test/product/wp05/planner-origins.test.ts` | error: Private test browser enrollment failed: goto: net::ERR_HTTP_RESPONSE_CODE_FAILURE at http://localhost:4110/sucafina/auth/local?code=… |
| 1 | CI-SF-2 | `Sucafinav1/test/product/wp05/procurement-stages.test.ts` | error: Private test browser enrollment failed: goto: net::ERR_HTTP_RESPONSE_CODE_FAILURE at http://localhost:4110/sucafina/auth/local?code=… |
| 1 | CI-SF-8 | `Sucafinav1/test/product/wp06/documents/scenario-consumer.test.ts` | error: expect(received).toBe(expected) \| Expected: 400 \| Received: 503 |
| 1 | CI-SF-2 | `Sucafinav1/test/product/wp07/closure-work.test.ts` | error: unavailable: action-create-identity-unavailable |
| 1 | CI-SF-8 | `Sucafinav1/test/product/wp08/handoff-real-boundaries.test.ts` | error: expect(received).toEqual(expected) \| diff - "reason": "action-outcome-unknown-retry-same-correlation", / + "reason": "action-create-… |
| 1 | CI-SF-7 | `Sucafinav1/test/product/wp10/analysis-composition/historical-memory.test.ts` | error: expect(received).toEqual(expected) \| diff - "status": "ok", / + "reason": "analysis-source-unavailable", |
| 1 | CI-SF-7 | `Sucafinav1/test/product/wp10/atlas-business/atlas-recovery.test.ts` | error: expect(received).toBe(expected) \| Expected: "already-committed" \| Received: "unavailable" |
| 1 | CI-SF-8 | `Sucafinav1/test/product/wp10/integration/bi-advantage-selection.test.ts` | error: expect(received).toBeGreaterThan(expected) \| Expected: > 1 \| Received: 0 |
| 1 | CI-SF-2 | `Sucafinav1/test/product/wp10/integration/personal-view-persistence.test.ts` | error: expect(received).toEqual(expected) \| diff - "availability": "unavailable", |
| 1 | CI-SF-2 | `Sucafinav1/test/product/wp12/native-execution-collaboration-recall.test.ts` | error: Test "question input derives a real pending training condition and the human preview preserves its actual source" timed out after 12… |
| 1 | CI-SF-7 | `Sucafinav1/test/product/wp12/native-execution-dashboard-answer.test.ts` | error: expect(received).toContain(expected) |
| 1 | CI-SF-7 | `Sucafinav1/test/product/wp12/native-execution-dependencies.test.ts` | error: The real dashboard issuers did not authorize the selected dependency sources |
| 1 | CI-SF-2 | `Sucafinav1/test/product/wp12/native-execution-executive.test.ts` | error: expect(received).toBe(expected) \| Expected: 200 \| Received: 503 |
| 1 | CI-SF-7 | `Sucafinav1/test/product/wp12/native-execution-question-handoff.test.ts` | error: Real collaboration handoff-create failed: action-create-identity-unavailable |
| 1 | CI-SF-7 | `Sucafinav1/test/product/wp12/native-execution-questions.test.ts` | error: The actual question has no bound answer observation |
| 1 | CI-SF-7 | `Sucafinav1/test/product/wp12/native-execution-scenarios-review.test.ts` | error: Real scenario input preparation failed: analysis-authority-changed |
| 1 | CI-SF-2 | `Sucafinav1/test/product/wp13/handoff-c08-integration.test.ts` | error: C08 scenario write: {"status":"denied","reason":"result-access-unavailable"} |
| 1 | CI-SF-7 | `Sucafinav1/test/product/wp13/handoff-integration.test.ts` | error: expect(received).toBe(expected) \| Expected: "ok" \| Received: "stale" |
| 1 | CI-SF-7 | `Sucafinav1/test/product/wp13/renewal-sensitivity.test.ts` | error: Command failed: /home/runner/.bun/bin/bun /home/runner/work/Orchestra-SF/Orchestra-SF/modules/sucafina/Sucafinav1/test/product/wp13/… |
| 1 | CI-SF-2 | `Sucafinav1/test/product/wp14/domain-outcome.test.ts` | error: expect(received).toBe(expected) \| Expected: "ok" \| Received: "unavailable" |
| 1 | CI-SF-7 | `Sucafinav1/test/s1.test.ts` | error: expect(received).toEqual(expected) \| diff - [ / + [] |

## Not in this map

The same run also failed `sf/static-and-contracts`, `sf/procurement-queue-integration`, `sf/test-CI-APP-BROWSER`, `sf/test-CI-UI-OPERATIONS`, `sf/test-CI-UI-REPORTS`, `sf/test-CI-UI-DECISIONS`, `sf/test-CI-CLI`, and `sf/verify`. Those jobs did not upload `sf-shard-failure-CI-SF-*`. They are not counted here.

