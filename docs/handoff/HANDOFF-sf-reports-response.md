# Handoff — sf-reports-response

SHA: edb8ec2c9aeab49440a1110bd08549fa233ecd93 (code; this handoff is a later documentation commit)
Data: 2026-11-20 (UTC)
Estado: partial — response-retention fix requires the lead's composed Actions gate

Branch: sf-reports-response.
Exact parent: 042fe208f907c779bc4b65aa5544a4ffb4762dc6 (sf-reports-composed).
Owner: Session 5 Reports response observation only; native product availability is being handled separately.
All CI, PR and merge decisions belong to the lead.

## Observed failure

Run 44653389217, job 136013553891, snapshot 0d7e3ec545def9b247253b5215a5d1ed93b94ae9, parent code/composition 042fe208f907c779bc4b65aa5544a4ffb4762dc6, concluded failure.

- RPT02 and RPT04 failed at packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:40:47:
  response.json: Protocol error (Network.getResponseBody): No data found for resource with given identifier
- The preceding exact HTTP 200 assertion at :39 had passed.
- The logs prove that Playwright could no longer obtain that matching response's body. They do not distinguish eviction, request cancellation or another resource-lifecycle cause. No stronger root-cause claim is made.
- RPT01 and RPT03 reached the original Review selected sections assertion and failed because the button was disabled at review-flow.ts:127:25. That distinct product availability defect is not repaired by this branch.

Run: https://github.com/gustavomhss/Orchestra-SF/actions/runs/44653389217
Job: https://github.com/gustavomhss/Orchestra-SF/actions/runs/44653389217/job/136013553891

## Fix and preserved evidence

Only packages/app-shell/e2e/sucafina/reports-support/review-flow.ts changes.

The response listener was already registered before the click, but the code waited for locator.click() to finish before asking Playwright to obtain discovery.json(). The matching response therefore had no body read in progress while the click's internal waits completed.

The fix attaches the original HTTP 200 assertion and discovery.json() directly to the original waitForResponse promise. Promise.all waits for this original response consumption and the original click together. This begins the body read as soon as the matching response is observed, without waiting for the click to settle, and retains the parsed body in the test process before any later DOM action or navigation in this helper.

- Same waitForResponse predicate, original GET, original Response object, status assertion, JSON decoding and object validation.
- No second GET, replay, request interception, substitute response, mock, body fabrication, page evaluation or invented context.
- No CDP buffer reconfiguration or other CDP workaround.
- Discovery status ok, item array/count, exact topic/title/period, opaque record references, complete 25-project catalog and all subsequent 25-to-24/source-immutability/preservation assertions remain unchanged.
- No skipped test, weaker assertion, retry, changed deadline or baseline.
- No runtime/application.ts, UI, schema, workflow, config, suite manifest, credential or protected branch edit.

The repository pins Playwright 1.59.1. Its original client Response.json() reads the original response body and parses it; the server Response.body() registers/caches one content promise and waits for request completion before invoking the original response-body callback. Moving this call earlier is an observation-lifetime change, not a replay:

- https://github.com/microsoft/playwright/blob/v1.59.1/packages/playwright-core/src/client/network.ts (body/text/json at 715-726)
- https://github.com/microsoft/playwright/blob/v1.59.1/packages/playwright-core/src/server/network.ts (body at 606-618)

## Ownership and merge state

Immediately before writing, sf-ui-c02 was re-read at f1e8aa1c8b622cb99e6ee5e49bb049fe77264de4. Its discovery block had not acquired this fix. This branch was created at the requested immutable Reports parent; no write was made to sf-ui-c02, sf-reports-composed or sf-decisions-ingress.

No PR or merge was performed. The lead should compose this isolated fix with the independently reviewed native availability fix before running Reports again; the known disabled-button defect remains on this branch's parent.

## Verification, artifacts and pending work

- GitHub code compare confirmed only the intended discovery scheduling block changed. Published source and this handoff were read back.
- No shell, local test, typecheck, build or guards executed.
- No gate or sf-ci dispatched by this owner.
- Runtime acceptance of this new code is pending. Early body consumption is the smallest concrete fix for the observed retention window; a successful composed run is still required to establish that it resolves the failure.
- Guards: not run by this owner.
- sf-ci job results: not run by this owner.
- Baseline/artifact: no new artifact from this branch; suites.json untouched.
- Package/sha256: not produced by this owner.
- No GO, deploy or SF_ORCHESTRA_WEB_PACKAGE_VERIFIED.

## Como retomar

1. Freeze this branch's final head (code SHA above plus this documentation commit).
2. Compose it with the separate native Review selected sections availability fix. Retain the original Reports ingress/config and complete UI assertions.
3. Lead runs the entire original Reports spec once for that changed candidate. Record exact code/snapshot SHA, run/job IDs, first failure file:line or all success and artifact.
4. If the original response body still fails, inspect the exact request lifecycle before proposing any further browser instrumentation. Do not fetch a fresh representation in place of the original observed response.
5. Keep one gate per concrete cause corrected, at most two simultaneous, and stop/record unbound for the same unchanged point as required. This handoff becomes complete only with the matching successful evidence.

```json
{
  "package": "app",
  "runner": "playwright",
  "config": "e2e/playwright.production.config.ts",
  "args": ["e2e/sucafina/reports.spec.ts"]
}
```
