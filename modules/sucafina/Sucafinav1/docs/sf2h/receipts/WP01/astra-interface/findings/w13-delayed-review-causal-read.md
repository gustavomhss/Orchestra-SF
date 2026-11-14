# W13 delayed-review counterproof: observed failure and causal limits

This is a read-only investigation. No product/check execution, GitHub run polling, fixture mutation or assertion relaxation occurred. Frozen W13 receipts are unchanged.

## Executed evidence

- W13 product `4bd1f807e449d040e3db61c4d2b1e177b205ac69`, tree `2459923b94c080688a31a1138e73ddf30c5be744`, run [43590725536](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43590725536), job132434657511.
- The named case **a delayed review preparation cannot start or restore data after analysis access is revoked** failed in5371.24ms. Raw log939–951 identifies `edit-recovery.test.ts:592:27`: a5000ms `page.waitForResponse` looking for `x-fixture-review-released: yes` timed out.
- Earlier source statements had completed: delayed preparation entered its handler; the test set `state.denied=true`, dispatched an analysis refresh, and observed the revoked-access status. The log does not expose handler release, HTTP socket completion, `requestfailed`, response delivery or body consumption.
- The downstream assertions at594–599 did not run: completed response, zero starts, no review form/private comparison and removed `data-case`. This named test remains FAIL/incomplete, with no partial PASS.
- W9 run [43586466170](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43586466170) passed this same named case in420.07ms, raw log964. W10 has the same source but **did not select this file**, so there is no W10 execution to borrow.

## Exact source/config comparison

| Source | W9 | W10 | W13 |
|---|---|---|---|
| `product/ui/forecast-analysis.ts` | `973a2f09b394426364c514b923ecdc8e10ffb184` | identical | identical |
| `test/product/wp01/browser-fixture.ts` | `b0d1c6311bf62c9e40e2446922da11fa66d0ea4e` | identical | identical |
| `test/product/wp02/browser-driver-fixture.ts` | `174a976308f00e604310b66fadf5fbf202808802` | identical | identical |
| `test/product/wp01/edit-recovery.test.ts` | `1c53ed4a7edaccad09e781fa3509d6cdb6e222f5` | identical | `98b235b93451f5449625b65fbd4fbb369dc47f1a` |

The entire edit-recovery difference is three recipient-route alias strings in other test cases. The failed case, its `browserCase` helper and imported forecast script are unchanged. W9 and W13 physical driver receipts both report Bun1.3.14, Node24.22.2, Playwright1.59.1 and Chrome157.0.8103.50. PIDs and preceding selection differ; no code/config/platform change in this test path is established as the cause.

## Static causal chain

The preparation handler installs `delayed.release` before resolving `started`, then awaits that gate before even constructing its JSON Response (test580–582). After the test observes revocation it installs the header waiter and invokes the gate release (592–593). The ordering prevents the straightforward “response was released before the listener existed” explanation in this source path. No second preparation or overwritten gate is recorded; neither can be asserted from the log.

In `forecast-analysis.ts:78–86`, revocation marks `accessRevoked`, removes the result/form and clears polling. It does **not** call an AbortController. `send` uses `AbortSignal.timeout(15000)`. When headers arrive after revocation, the guard throws before `response.json()`; the old body is deliberately not consumed. A second guard after body parsing and the review `active()` check also protect late completions. The existing test's entire duration is about5.37s, so the configured15s fetch deadline or30s Bun idle deadline is not supported as the observed cause. Browser/network cancellation could still occur, but there is no per-request evidence for it in this run.

This leaves a concrete observability weakness: the counterproof waits until after revocation to begin delivery of headers/body, even though the shipped consumer legitimately abandons that response before reading its body. The W13 log cannot distinguish a handler/transport delivery problem from an abandoned browser response. It does not establish that the UI restored private data or started a review.

## Proposed material repair to the counterproof

Retain the shipped consumer and every business assertion. Keep the five-second phase bounds and30-second named-test bound. Use the response-stream pattern already present in the preserved `unavailable-views.test.ts:85–110,216–239`:

1. Materialize the exact authorized preparation JSON and record its bytes/status before the artificial delivery delay. Reserve the single gate before any await and count preparation requests.
2. Return its actual headers and a nonempty incomplete JSON prefix while access is still authorized. Register the response waiter before the request, observe HTTP200/header and allow the old consumer to await the remaining body.
3. Perform the existing denied refresh and wait for the existing revoked status. Assert the protected form/context are already removed.
4. Release the rest of the **same** captured payload. Observe exact body completion under a five-second bound; retain the existing bounded `finished()===null` assertion where applicable, plus all original zero-start and purge assertions after two rendering frames.
5. Record bounded phases and `incoming.signal`/stream cancellation if failure occurs. Release any pending stream from cleanup without hiding the primary assertion.

This is a change to the controlled delivery path of an already declared transport fixture. It does not replace a real producer with a mock, change the application response, weaken revocation checks or increase timeouts. It makes the intended late-payload witness observable and exercises the post-body guard. It should not be described as a proven fix before Actions executes it. If retaining late-*header* timing as a separate requirement, preserve that case with request/handler/abort diagnostics; do not force an unused body to be consumed by changing production UI solely for a test.

## Next action

Root should assign the test edit separately from the WP01 author's current W14 lease, then publish a material increment with the unchanged business assertions. The new run must include the affected test and lifecycle wrappers. Earlier W9 PASS, W13 FAIL and physical cleanup remain attached to their original SHAs. The failure is not labeled flaky, and no unique browser or Bun root cause is claimed.
