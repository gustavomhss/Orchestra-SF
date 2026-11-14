# Dashboard record capture: preserve the authorized page scope

Status: own WP02 implementation prepared for W12; no local product execution and no W12 Actions result yet. This finding concerns a single-record capture. The separate positive WholeReview C05 reopening failure remains open in `c05-current-closure.md`.

## Executed evidence

GitHub Actions [43587790889](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43587790889), job [132425925541](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43587790889/job/132425925541), exercised product commit `0c3d98dd1263a305ce294c78ad5939cdda110a78`, tree `5c236ef687871149e9150630a16c4ce0ac70c2a7`, through snapshot `fbd7e6ae4831436e8faad88d66954d3207f943d0`, snapshot tree `0a2402ebc38f19d04429816bd8a3090633d567d4`.

The request SHA256 is `49a393cc9c45e60b378a9299b5480edb47e932bac961ae47be3cdcf61e545a3a`; request blob is `db3c51ec4021372686faaa5714f08fd7ce9f4ac6`. The frozen receipt is `analysis/product-43587790889.receipt.json`. The decoded log SHA256 is `d24319ed9234b8132d645476c47628d9bb1957b0e686cf9cb7415b49b7487c54`.

`meeting-number.test.ts` first test reached the browser journey, loaded actual Budget Overview options, selected **Meeting Operations**, and clicked **Preservar retrato**. At line 51, HTTP 200 was expected and HTTP 503 was received. The assertion failed before the body was read. Log lines 1122–1135 therefore establish the HTTP failure, without an observed envelope reason. Subsequent capture history, stable agenda and background refresh assertions did not execute in that test.

The second test independently reached WholeReview history after the canonical budget edit and still received HTTP 403 (`denied`, `access-unavailable`) instead of 200. That is the previously documented C05 failure. The two failures cannot be merged into one producer explanation.

## Reconciled source and causal inference

Published Compose reference inspected by GitHub MCP: [`35b9fd4f532abeb1058f00281d4ad8885ca9966f`](https://github.com/gustavomhss/Orchestra-SF/tree/35b9fd4f532abeb1058f00281d4ad8885ca9966f). The following table distinguishes the executed W10 input from the published integration input; different hashes are not treated as interchangeable implementations.

| Source | W10 blob | Published Compose 35b9 blob |
|---|---|---|
| `product/dashboard/confirmation.ts` | `fefdb4b7814be4953e1a5e7f12e2385e0a6a03c4` | same |
| `product/dashboard/confirmation-issuer.ts` | `2493b4d16cdec9a0798fc6627a02b07f9859ad4d` | same |
| `product/dashboard/historical-bindings.ts` | `01ab380bd9a2b0b4c8db0d62984492e12598c034` | same |
| `product/integration/dashboard-sources.ts` | `4ddee38662690ce5284cc46ef04d315cb3fb4f6c` | same |
| `product/integration/source-lifecycle.ts` | `d0cab7f33b08806a6bb01a869fa789dc77e087ee` | `65867a3e6aa9b5b85266bb637fb22cf1c6c6d539` |
| `apps/cli/src/sucafina-product/dashboard-services.ts` | `24c76c54e314c0c0579bf4beaaca8f492a7038b5` | `0891d178833165fff098e3c05f3a64c5f5b35043` |
| `apps/cli/src/sucafina-product/dashboard-http.ts` | `c6c24f4a66315c75dd8b0903ddd70c89b9b9e19c` | same |
| `test/product/wp01/meeting-number.test.ts` | `53834c8c0802bf90a2336527460e2ecbf9aa8c97` | not imported |
| `test/product/wp02/workbench-recovery-fixture.ts` | `593a46dad67e490dcfdd4fdc1878353088138dc7` | not imported |

`product/` and `test/` paths above are relative to `modules/sucafina/Sucafinav1/`. Both Dashboard service variants issue discovery records using `page: request.page`. Both source lifecycle variants include the whole selector in the scope key and give distinct scoped identities to distinct page selectors.

The source chain supports this concrete static inference:

1. The real Budget Overview discovery issues the selected OPEX owner record with `scope.selector.page = "Budget Overview"`. The browser sends that exact opaque source reference back to the capture route.
2. `dashboard.capture` resolves that reference through the actual record producer. `createDashboardHistoricalBindings.prepare` reads its exact projection and calls `prepareReissueScope(source, source, context)` before preparing the immutable capture receipt.
3. Before W12, `observe` reissued every record through `createDashboardConfirmationIssuer`. That public issuer chooses a canonical page for a record type: `opexOwners` maps to **OPEX Detail**.
4. The page is part of the source scope, alongside principal, access revision, policy, fields and period. A Budget Overview selector and an OPEX Detail selector have different scoped incarnations even when they refer to the same physical owner and identical material fields.
5. `prepareReissueScope` correctly requires the observed reference digest and target to equal the selected current reference. The canonical-page reissue cannot satisfy that equality for this capture. The function returns an unavailable result; the real HTTP route maps unavailable to 503.

This explains a code path that necessarily blocks the selected capture. It is not a claim that the missing response body was observed to contain `material-scope-unavailable`, nor a claim that no earlier failure could have occurred in that run. The existing Hot Topic capture can succeed because both its page of origin and canonical page are **Hot Topics & Actions**.

## Ownership and implementation

The WP02 pack assigns the complete `product/dashboard/` prefix to Astra. Consequently, this is an own Dashboard producer defect that can be fixed without changing the shared host, an authorization contract, or a foreign input. The initial triage that treated all confirmation implementation as foreign was corrected against the ownership pack before implementation.

W12 changes only the Dashboard observer:

- Extract the private page lookup already used by `prepareHistoricalReissue`. It resolves the persisted scope by its original incarnation and record type/id, and requires exactly one matching scope with a nonempty page.
- `observe` reissues each record through the real `RecordSourceIssuer` using that persisted page and the current authorized context. It does not accept a page from browser input or fall back to a different canonical page.
- Dashboard-page references also require the stored page to equal their record id. Historical reissue uses the same private lookup and the same invariant.
- Preserve the complete reference digest/target comparison, current principal/access/policy checks, actor-derived projection, physical incarnation continuity, dependency observation and final transaction fence.

The public confirmation issuer is unchanged. Reissuing the Budget reference as an OPEX Detail reference remains invalid for `prepareReissueScope`, even when both scopes name the same physical record. New read access is always established by the producer; knowing a historical selector does not grant access.

No shared host, Protocol, Server HttpApi, identity, financial engine, policy, contract or generated file changes. No new foreign input needs hydration. The original `meeting-number` test and all its assertions remain unchanged. Its `2026-11-13` display assertion is consistent with the fixture's explicit clock; the runner's calendar date alone is not evidence of a test defect.

## New regression and retained negatives

`test/product/wp02/record-capture-scope.test.ts` adds one real producer/HTTP regression using the existing `createRecoveryFixture`: actual encrypted operator identity, local store, C08 authority, source lifecycle, Business Services, Dashboard capture and history routes. Only initial business records are fixture data; no authorization callback or consumer response is replaced.

The test requires:

1. Discovery emits the real Budget Overview record. Issuing the same fields/period through OPEX Detail yields a different scoped incarnation and digest while both persisted scopes prove the same physical source.
2. Budget/Budget preparation succeeds with an exact fence, which is false outside the transaction and true under the real all-surface lock. Budget/OPEX and a forged digest are rejected.
3. The real HTTP capture returns 200, retrying the same request/key returns the same capture id, and C08 contains exactly one capture receipt.
4. Authorized history returns the original projection, exact selected evidence references, principal and captured timestamp. Revocation returns 403 without projection. Delete/recreate with the same id and values does not reopen the old capture.

The new test reads response envelopes before positive HTTP assertions and emits only mode/status/reason on failure. It provides a more useful diagnosis if the next run exposes a later producer failure. Existing confirmation, historical binding, historical reissue and C03/C06 thread tests retain their assertions. The actual meeting browser journey remains required to validate the complete consumer after the fix.

The delete/recreate negative uses the actual source persistence to create a distinct physical incarnation with identical id and values. It proves the capture fence's identity handling, not the public deletion command's consumer. Read-only peer review found no additional blocker in the scoped reissue or regression; it did not execute any product code.

Suggested surgical Actions selection, owned and dispatched by the parent/CI agent: startup harness; W11 `work-review-context-render.test.ts` (eight previously unexecuted rendering cases); WP02 confirmation, historical bindings, historical reissue and the new capture scope regression; WP01 thread recovery, meeting number and final lifecycle. The selection is not an epic run and grants no native/global approval.

## Acceptance limits

The fix supports the record-capture prerequisite for WP01.T03.CHK.03 and the relevant authorized evidence/history behavior in WP02.DOD.02, WP02.INV.02, WP02.CMP.02, WP02.SUC.02 and WP02.T03.INV.02. These are partial mappings, not complete criterion claims.

Until W12 Actions executes, the change is implemented and pending validation. A successful record capture still does not establish WholeReview C05 reopening, source continuity after write-scope changes, C12 recovery after reload, native parity, full host mounting, S0 integration or the final epic. The known positive WholeReview 403 must remain visible until its actual producer closure is integrated and the original positive assertion passes.
