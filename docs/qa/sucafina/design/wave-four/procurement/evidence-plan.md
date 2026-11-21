# Procurement evidence plan

## Execution contract

Use the existing Actions production browser runner and `waveFourTest` fixture. The root workflow selects `design-wave-four-procurement.spec.ts`. Enrollment is a genuine one-use local-operator handoff. Authentication cookies and credentials never enter trace/video or screenshot annotations. Tests only record producer POST paths and scrubbed diagnostics.

This document lists expected evidence. It is not an execution report. The first root-integrated procurement candidate is being exercised by the coordinator; final run URLs and screenshot judgments must be supplied from its observed output.

## Capture families

| Prefix | Expected evidence |
| --- | --- |
| `CAP24-*` | Dark/light desktop source totals and ledger; light 320 px filter/ledger; pt-BR desktop/320 |
| `CAP25-*` | Request list; requisition review; create form desktop/320; 320 px confirmation actions; recorded comparison dark/light/320; sourcing review; confirmed order draft; pt-BR desktop/320 |
| `CAP26-*` | PR queue dark/light; 320 px PR decision actions; sourcing submitted facts; PO decision review; pt-BR desktop/320 |
| `CAP27-*` | Supplier list dark/light/320; create editor; 320 px review actions; confirmed source detail; pt-BR desktop/320 |
| `CAP28-*` | Policy form dark/light/320; 320 px changed-field review/actions; pt-BR desktop/320 |

All capture filenames end with `test-data`. The harness attaches PNG files and emits bounded previews through the existing workflow. It resets the actual native `.mx-page` scroller before full-stage captures. Review-action captures deliberately scroll to the confirmation controls.

## Meaningful assertions

1. The original host reports discovery, provider and view readiness, with exactly one native page frame.
2. A source list supplies every request reference; create acknowledgements are followed by source-list discovery.
3. Review and cancellation send no POST; one explicit confirmation sends exactly one producer POST.
4. Cancelled reviews retain entered values, including quotation metadata and the PR decision comment.
5. Confirmed changes are reopened or reread from the original source rather than inferred from an input's remaining DOM value.
6. Missing estimate and numeric zero remain distinguishable.
7. All five areas use their expected pt-BR page titles, and no missing leaf translation key appears in the rendered frame.
8. The document and actual native page scroller have at most 1 px horizontal overflow at both widths.
9. Review controls fit inside the 320 px viewport after scrolling; status filtering remains keyboard reachable.
10. Captures record real page errors and console diagnostics without replacing them with mocked successful data.

## Visual review criteria

The coordinator should inspect the actual emitted images for hierarchy, one-ledger composition, readable labels, source-vs-edit distinction, quiet glass, token consistency, 44 px control targets, detail/review width, narrow wrapping, scroll reachability, Portuguese text and theme contrast. No numerical “premium” score is assigned before that inspection.

Actual browser zoom at 200% is not measured by this viewport exercise. The 320 px reflow assertion is reported separately. Source failures, denied-role variants, bank-secret operations and lost-response recovery remain covered by their established suites, not fabricated screenshots.

## Observed run: 44956710354

- Runner: [Procurement run 44956710354](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44956710354), snapshot `7dc9978ecc51cad8a544be558b0d79d3fef88c8b`.
- Canonical procurement seed completed. The native host reached readiness about 2.3 seconds later.
- CAP24 source assertions and dark desktop, light desktop and light 320 px captures completed. The images show the admitted source total of USD 14,800 and distinguish an unavailable estimate from a recorded zero. Ledger horizontal scrolling remains inside its own region at 320 px.
- Visual review found no page-wide horizontal overflow or illegible labels in those three captures. It did find the financial band and ledger touching: the 24 px gap was on the root, while `SfStatePanel` adds a content wrapper. The leaf stylesheet now applies the same grid gap to that actual content wrapper. That correction still requires the next browser capture.
- Navigation into CAP25 stopped at the host's “Sucafina route not admitted” state, with discovery and provider ready but view denied. The overview navigation also omitted Requests and Approvals. There were no page or console errors. No business write was reached, so this run does not verify any of the eleven confirmation/readback journeys.
- Admission and host composition are owned by the coordinator; leaf assertions have not been weakened or bypassed. Review of CAP25–CAP28 and pt-BR captures remains pending a complete run.

## Observed run: 44957614385

- Runner: [Procurement run 44957614385](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44957614385), snapshot `a77e2d5c64ff68bed9374be7ca20cf268403afbb`.
- The coordinator restored the original queue producer handoff in the local host. CAP25/26 were admitted and the navigation displayed Requests and My approvals.
- CAP24 repeated its three captures. CAP25 passed source-list count, text filtering, recorded zero versus absent estimate, review cancellation, and retention of the revised description. The request ledger and requisition review were captured.
- The first explicit save did not emit a POST: the draft mapper manufactured own properties with `undefined`, which the original strict JSON codec rejects. The UI entered its retained unknown-outcome state. No response, receipt or write has been inferred.
- The PR and PO draft mappers now omit absent fields, and sourcing no longer manufactures absent optional scalar or criteria fields. The command boundary also captures plain DTOs from the Solid review store before hashing and reuses those values for dispatch, keeping enumerable excess properties visible to the original decoder. Settings uses the same explicit DTO capture instead of cloning a reactive proxy. These changes keep null, zero, false, empty text, nested IDs and quotation/line metadata. The existing supplier command snapshot already omits absent properties.
- Seven browser-condition regressions in `test-browser/sucafina-procurement-command.test.ts` exercise real Solid stores and `SfNativeOperationBindings` with incomplete PRs, new requests, order lines, sourcing, policy values, stable captured bytes and rejected excess properties. They were written for Actions and were not executed locally.
- Review overview and confirmation-action captures are separate and reset or scroll the actual native page. Missing field values use the existing unknown-value key, rather than describing a failed whole-page read.
- The full eleven-write journey and the remaining screenshot families still require a successful subsequent run.

## Observed run: 44958556607 and gate 44958558854

- [Procurement run 44958556607](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44958556607), snapshot `8740caccc1ec0f07114655daf0a99868715d4b5e`, verified the first original `save-pr` POST and source readback of the revised amount and description. One of the eleven planned writes/readbacks completed.
- The new-request draft retained its values after Back/Resume and review cancellation. Its subsequent create POST returned HTTP 403 and the original transport invalidated the provider. The following Back action consequently timed out; this is a failed journey, not a successful create.
- Source inspection identified a reproducible input mismatch: numeric controls stored strings inside nested JSON, while the original producer normalizes dotted form fields only. The original creation gate rejects a string estimate with `action_invalid`. Leaf numeric controls now convert finite entries to numbers before review, preserve empty entries as null, and retain invalid text for validation. The same conversion covers PR/PO amounts, sourcing amounts/scores/weights and nested policy numbers; no producer, schema or role rule changes.
- The confirmation helper now requires the actual successful HTTP acknowledgement and a ready provider with one page frame. It logs only the ordinal, response status, acknowledgement flag and bounded lower-case error codes. It never logs command values, headers, owner/intent credentials or source records.
- The [gate run 44958558854](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44958558854) passed all eight gates, including the seven browser-condition procurement codec cases. Two new regressions cover numeric-input distinctions and the original creation transition gate; their execution is pending the next coordinated gate.
- Visual inspection confirmed the corrected CAP24 gap, readable CAP25 create forms at desktop and 320 px, and visible 320 px review actions. The review overview capture still began mid-content despite the generic page-scroll reset. Overview captures now also scroll the actual review element into view and assert its heading is in the viewport; the corrected image remains to be observed.
- CAP26–CAP28 and pt-BR captures remain pending the complete journey. No claim of eleven confirmed writes or complete visual acceptance is made from this partial run.
