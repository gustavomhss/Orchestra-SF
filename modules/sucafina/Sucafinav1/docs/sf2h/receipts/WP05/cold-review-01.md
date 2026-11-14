# WP05 independent cold review — pass 01

## Result

Initial static inspection found one actionable P1 at the renderer-to-consumer boundary. The subsequent correction was independently re-read and is now **CORRECTED_STATIC_AWAITING_CI**. No product test, typecheck, browser execution, or other local runtime validation was performed. No product file was edited by the reviewer. This report does not assert CI PASS.

Reviewed the proposed changes in analytics/capabilities.ts, consumer.ts, contextual.ts, factory.ts, filter-controls.ts, projection.ts, decision-view.ts, geometry.ts, milestones.ts, semantics.ts, tickets.ts, view.ts and waterfall.ts, together with the new consumer, producer-selection, projection-validation and rendering tests. Baseline is the parent's exact originals/ snapshot. Engine tests owned by the CI agent were not part of this cold pass.

## R1 — P1, corrected statically: brushed mark and exact destination context

- **Producer of the selection:** view.ts emits `context: { ...row.selection.context, period }` for general marks, unavailable-age links and table links. Its timeline and waterfall rendering calls likewise replace projection.context.period with the brush range before emitting a selection.
- **Consumer:** consumer.ts `readBiDestination` immediately requires selection.context.period to equal the original `request.period`, and then compares the current producer context with the complete selection context.
- **Concrete effect:** a chart authorized for 2027-01-01 through 2027-12-31 is brushed to January. Clicking a valid January mark emits a January selection context. Passing the original authorized request returns `stale / selection-context-changed` before C17 resolution. Reissuing a narrower query is not equivalent: it may produce a distinct projection/reference/authorized selection, and does not prove that the original mark was reopened.
- **Existing test gap:** render-completion-browser.test.ts intentionally asserts the narrowed `context.period` on an undated milestone click, while consumer.test.ts only supplies a selection from the full projection. No test currently joins these two behaviors.
- **Recommended change:** retain immutable producer/authorization context in BiSelection and carry the visible brush separately, for example an optional `visualPeriod`, validated as a legitimate subset of the authorized period. Re-read the original request, require identical value/reference/version/engine/context, and return the display period so the host can preserve the filter and focus. Alternatively route period changes through real reauthorization and replace both projection and original request; do not fabricate a narrowed producer context locally.
- **Required discriminant:** take the selection emitted by a genuinely brushed renderer and pass it to readBiDestination with the original request and a fresh admitted lease; the valid selection resolves. Out-of-range display periods and changed value/ref/version/context must fail. Execute only in authorized surgical CI.
- **Related criteria:** WP05.INV.01; WP05.T01.CHK.05; WP05.T02.CHK.04/.CHK.05; WP05.T03.CHK.05; WP05.T04.CHK.04.


### Correction independently re-read

The current proposed code adds optional BiSelection.visualPeriod without changing ProductContext. `view.ts` now routes marks, table links, unavailable-age links, waterfall and timeline through `openSelected`, which appends visualPeriod while retaining the producer context. `milestones.ts` takes a separate geometry horizon. `readBiDestination` accepts only a valid visual-period subset of the original request, then still verifies the full producer context, version, engine and C17 ref.

The prepared `consumer-dashboard.test.ts` now obtains a projection from actual Dashboard C02 plus local source persistence, uses Chromium to brush and select its table row, and sends that emitted selection through readBiDestination plus the real Dashboard C17 source-access reader. It checks the original full period/ref are preserved and rejects replacing the original context with the brush. `consumer.test.ts` also prepares before/after/out-of-order period negatives. This closes the identified logic mismatch in static review; acceptance awaits surgical CI on the published implementation commit.

This is still a scoped integration harness: browser rendering occurs in about:blank, admission authenticates a fixture principal, and the test exercises BI01 with a page-level Dashboard C17 source. It is not evidence of the installed full eight-chart detail host, the resident native runtime, or UI/native/MCP parity.

## Positive static observations, without runtime credit

The proposed reader clones admitted inputs and checked output before asynchronous host callbacks. The factory rejects producer changes inside a single trusted call. Absent evidence is excluded from numeric geometry, and the new waterfall totals preserve producer-provided values. The new filters forward authorized choices to the host instead of recalculating or filtering domain rows locally. None of these observations replaces CI execution or native/host composition evidence.

## Evidence boundaries

consumer.test.ts uses the actual UI authority and dispatcher, which is stronger than a callback-only receipt test, but still injects its source and BusinessContext service. render-completion-browser.test.ts mounts a bundle in about:blank. These are component/adapter proofs; they cannot establish actual native/MCP execution, persisted ContextualBI consumption, or the installed shared host's exact chart-to-detail navigation.

The immutable dependency inventory and per-criterion blocker map are in external-dependencies.json and blocker-map.json. Five concrete outside-owner groups touch 39 of the 108 criteria. This is not a claim that the remaining 69 pass. No criterion receives PASS from the dependency map. Some blocked criteria can receive partial component evidence while their required production consumer remains absent.

## Outside-owner facts requiring an honest receipt

1. WP00 current 72342f0efbbe099231aa2e30a964769b14e4fbb2 supplies the previously missing BI types, SfBiArtifact/state namespace and sensitivityResultRef output schema. Those owner paths are not integrated in the WP05 seed. The canonical typecheck/schema gate must be measured after the appropriate owner/S0 integration.
2. WP10 preserved dc6bf9e4e8f3d2fa01d01c76d5575892a8ced82f still has the same bi-http.ts as the seed: only BI01/BI07/BI08 are described and the bi-source target is a Dashboard overview. Exported WP05 seams alone do not close the real consumer requirements.
3. WP10 owns native/provider-bound authority, shared entrypoint composition, artifact storage/choice readers/reload and C17 exact navigation. New tests must not be represented as native parity or durable consumption when they use injected callbacks or an isolated renderer.
4. WP02 current 38d340a8857b96904f7246320091c14c051f1929 preserves undated milestones and their status. The seed producer discards milestones without a string date, so a local undated renderer fixture does not prove the real upstream case.
5. WP11/WP13 producer APIs are available in preserved owner snapshots. Missing foreign test fixtures are repairable with WP05-owned fixtures invoking the real engine. Numeric/coverage evidence must not be labeled inevitably blocked solely because a fixture was absent.

## Runtime proofs that cannot be replaced by literal fixtures

- UI/native/MCP sf_bi_view must run through real admission, descriptor, producer, policy/access revision and provider generation, with equal handler/result/version and actual ungranted/revoked/swap negatives.
- Each of the eight original and three decision questions must consume identifiable actual domain projections; only renderer callback objects are insufficient.
- Real mark-to-detail transitions must preserve exact C17 ref, version, currency, authorized scope, visible filter and return focus; overview fallback fails explicitly.
- ContextualBI must consume a persisted human-approved choice and actual projection/table artifacts, including reload and changed/revoked evidence; in-memory object equality is not the final durable witness.
- The 55,000 implementation boundary must originate in the canonical producer, while omitted training remains absent from both component and coverage-entry inputs and is detected by the nine-category inventory. Training 40,000 must cause 210,000→250,000 and 30,000→−10,000 in the actual engine result, while the prior choice/result snapshot remains unchanged. BI must display the producer's actual qualification and reference, including a sampled interval if no exact proof is admitted.


## Final observed resolution

**R1: VERIFIED_SCOPED in S2**, product `fe75fd8b5daa25647bc4938025c82dbfc287a0a1`, snapshot `988877105aff091ee9881a812282d677c63be5bb`, [run 43519544728](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43519544728). The consumer-dashboard test passed with the Chromium-emitted brushed selection, production C02/persistence/source issuer and C17 page resolver, plus fresh UI admission. Invalid crops, altered contexts and references remain refused in the passing consumer tests. Scope: BI01 harness, about:blank, fixture principal, authorized Dashboard page. No native runtime or eight destination journeys are claimed. The original finding and static-review narrative above are retained as history.
