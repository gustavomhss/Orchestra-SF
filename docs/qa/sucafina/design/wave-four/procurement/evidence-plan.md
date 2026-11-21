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
