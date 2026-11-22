# Wave four — Procurement evidence

## Qualified result

[Procurement run 44965165654](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44965165654) passed all **four installed browser journeys**: requests/sourcing/approvals, suppliers, settings and Portuguese entry views. The run completed **11 original producer POSTs and 11 explicit fresh canonical source readbacks**, with no page or console errors. All **43 capture previews** are complete and were manually inspected; no blocking visual defect was observed in those captured states.

- Browser snapshot: `7f3de0206fc25b2925d7c55947d9b5785bdfe7ba`.
- Tested product commit: `331cafc50bee2112f6366ff428658de938c6f58e`.
- Procurement code head included in that composition: `7c2ddfad2dddf00709c04a3f554e8050ba9ea773`.
- Main job: [137032420336](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44965165654/job/137032420336).
- Exact image identities, Git blob SHAs, byte sizes, dimensions, command outcomes and limits: [manifest.json](manifest.json).
- Implementation and qualification notes: [Procurement handoff](../../procurement/HANDOFF.md).

The files below are the separately captured Playwright **JPEG previews, quality 78**, reconstructed without editing from the bounded CI preview output. The original PNG attachments remain in the Actions evidence. The gallery contains 29 captures at 1440 × 1100 and 14 at 320 × 900; its 43 JPEGs total 3,384,360 bytes.

## Confirmation evidence

All 11 observed responses had HTTP 200 and passed the JSON content-type assertion. Six response bodies were available to the browser collector and contained `ok: true`. Five were unavailable to that collector and recorded only the error class `Error`; their cause was not established. They are not counted as readable acknowledgements.

An unavailable body does not become a fabricated positive response. The test still requires the original application's completed review, a ready provider and view with one native page frame, exactly one POST for the explicit confirmation, and the command-specific fresh source readback below. Readable negative or malformed acknowledgement bodies always fail. No response body, credentials, bank data or authentication header is copied into this documentation.

| Group / ordinal | Original command | Body available to collector | Explicit canonical source readback |
| --- | --- | --- | --- |
| requests-approvals / 1 | CAP25.save PR | Yes; `ok: true` | Reopened source record: estimate 16500 and revised description. |
| requests-approvals / 2 | CAP25.create | No; error class `Error` | Fresh source list: created title and draft status; discovered producer reference; reopened description. |
| requests-approvals / 3 | CAP25.submit_pr | Yes; `ok: true` | Fresh request source row: pr_pending. |
| requests-approvals / 4 | CAP25.save sourcing | No; error class `Error` | Reopened source sourcing: evaluator, quotation description, quotation notes and selected quotation ID. |
| requests-approvals / 5 | CAP26.approve PR | Yes; `ok: true` | Fresh created-request source row: sourcing. |
| requests-approvals / 6 | CAP26.approve sourcing | No; error class `Error` | Fresh source-approval request row: po_draft. |
| requests-approvals / 7 | CAP26.reject PO | Yes; `ok: true` | Fresh purchase-order request row: po_rejected. |
| requests-approvals / 8 | CAP25.save PO | No; error class `Error` | Fresh source order editor: revised delivery conditions and original line notes. Original unit price checked before the edit. |
| suppliers / 1 | CAP27.create | No; error class `Error` | Fresh source supplier list: producer-issued row with pending status; reopened detail contains the supplier note. |
| suppliers / 2 | CAP27.save | Yes; `ok: true` | Fresh supplier-list reopen: revised supplier note. |
| settings / 1 | CAP28.save | Yes; `ok: true` | Fresh settings page: reminderDays 9; minQuotes 3 and currency USD retained. |

The test counts are 8 + 2 + 1 + 0 POSTs across the four independent original installations. Authentication, grants, business values, source projections and receipts are not mocked. Fixture records are explicitly named design test data and created by the original producer.

## Visual review and coverage

The review inspected every listed image for hierarchy, native typography and tokens, source versus proposed values, field legibility, theme contrast, narrow wrapping and reachable confirmation controls. Review overviews and action views are separate captures after actual page scrolling. Portuguese coverage requires real source rows for CAP24–27 and the real seven-section settings form for CAP28.

| Area | Captures | Observed work |
| --- | ---: | --- |
| CAP24 | 5 | Source financial band, seven-row ledger, filter, missing estimate versus recorded zero, source coverage. |
| CAP25 | 14 | Request list, requisition edit/create and cancel/resume; recorded quotation comparison; sourcing metadata retention; order draft save and source reread. |
| CAP26 | 8 | PR queue and decision; sourcing submitted facts and approval; PO rejection; fresh source status after every decision. |
| CAP27 | 9 | Three-source-supplier ledger, four-group create editor, cancel/resume, create and edit with fresh source details. |
| CAP28 | 7 | Real seven-section policy form, changed-field review, cancellation retention, original save and fresh settings reread. |

The dense source/comparison tables retain internal horizontal scrolling. Their narrow captures show the visible columns rather than compressing every field into an illegible width. The original empty Actions column remains where required by the shared table contract, and the order editor retains its existing Purchase order heading/fieldset repetition. Neither prevented the observed tasks. Source status/unknown enums and the English fixture data remain source values within Portuguese UI.

This evidence is limited to Chromium, the listed viewport samples and the states below. Actual browser zoom was not measured; 320 px reflow is not a claim of a 200% zoom test. The 17 existing route patterns are an inventory, not a claim that every route/state/theme combination was tested. This run does not perform supplier bank writes, activation, policy reset, external notifications, external order delivery or injected network-failure recovery. Established regression coverage remains separate.

The earlier [gate run 44964454946](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44964454946) passed 12 gates and 84 regression cases, including all ten procurement browser-condition tests. The coordinator owns qualification of the complete, latest integrated product and its final merge.

## CAP24 — Procurement overview

### CAP24-dark-desktop-source-overview-test-data

en · dark · 1440 × 1100

![CAP24-dark-desktop-source-overview-test-data](CAP24-dark-desktop-source-overview-test-data.jpg)

### CAP24-light-desktop-source-overview-test-data

en · light · 1440 × 1100

![CAP24-light-desktop-source-overview-test-data](CAP24-light-desktop-source-overview-test-data.jpg)

### CAP24-light-320-source-overview-test-data

en · light · 320 × 900

![CAP24-light-320-source-overview-test-data](CAP24-light-320-source-overview-test-data.jpg)

### CAP24-pt-BR-dark-desktop-test-data

pt-BR · dark · 1440 × 1100

![CAP24-pt-BR-dark-desktop-test-data](CAP24-pt-BR-dark-desktop-test-data.jpg)

### CAP24-pt-BR-dark-320-test-data

pt-BR · dark · 320 × 900

![CAP24-pt-BR-dark-320-test-data](CAP24-pt-BR-dark-320-test-data.jpg)

## CAP25 — Requests, sourcing and purchase orders

### CAP25-dark-desktop-request-list-test-data

en · dark · 1440 × 1100

![CAP25-dark-desktop-request-list-test-data](CAP25-dark-desktop-request-list-test-data.jpg)

### CAP25-dark-desktop-requisition-review-overview-test-data

en · dark · 1440 × 1100

![CAP25-dark-desktop-requisition-review-overview-test-data](CAP25-dark-desktop-requisition-review-overview-test-data.jpg)

### CAP25-dark-desktop-requisition-review-actions-test-data

en · dark · 1440 × 1100

![CAP25-dark-desktop-requisition-review-actions-test-data](CAP25-dark-desktop-requisition-review-actions-test-data.jpg)

### CAP25-dark-desktop-create-request-test-data

en · dark · 1440 × 1100

![CAP25-dark-desktop-create-request-test-data](CAP25-dark-desktop-create-request-test-data.jpg)

### CAP25-dark-320-create-request-test-data

en · dark · 320 × 900

![CAP25-dark-320-create-request-test-data](CAP25-dark-320-create-request-test-data.jpg)

### CAP25-dark-320-create-review-actions-test-data

en · dark · 320 × 900

![CAP25-dark-320-create-review-actions-test-data](CAP25-dark-320-create-review-actions-test-data.jpg)

### CAP25-dark-desktop-recorded-quote-comparison-test-data

en · dark · 1440 × 1100

![CAP25-dark-desktop-recorded-quote-comparison-test-data](CAP25-dark-desktop-recorded-quote-comparison-test-data.jpg)

### CAP25-light-desktop-recorded-quote-comparison-test-data

en · light · 1440 × 1100

![CAP25-light-desktop-recorded-quote-comparison-test-data](CAP25-light-desktop-recorded-quote-comparison-test-data.jpg)

### CAP25-light-320-recorded-quote-comparison-test-data

en · light · 320 × 900

![CAP25-light-320-recorded-quote-comparison-test-data](CAP25-light-320-recorded-quote-comparison-test-data.jpg)

### CAP25-dark-desktop-sourcing-review-overview-test-data

en · dark · 1440 × 1100

![CAP25-dark-desktop-sourcing-review-overview-test-data](CAP25-dark-desktop-sourcing-review-overview-test-data.jpg)

### CAP25-dark-desktop-sourcing-review-actions-test-data

en · dark · 1440 × 1100

![CAP25-dark-desktop-sourcing-review-actions-test-data](CAP25-dark-desktop-sourcing-review-actions-test-data.jpg)

### CAP25-dark-desktop-confirmed-order-draft-test-data

en · dark · 1440 × 1100

![CAP25-dark-desktop-confirmed-order-draft-test-data](CAP25-dark-desktop-confirmed-order-draft-test-data.jpg)

### CAP25-pt-BR-dark-desktop-test-data

pt-BR · dark · 1440 × 1100

![CAP25-pt-BR-dark-desktop-test-data](CAP25-pt-BR-dark-desktop-test-data.jpg)

### CAP25-pt-BR-dark-320-test-data

pt-BR · dark · 320 × 900

![CAP25-pt-BR-dark-320-test-data](CAP25-pt-BR-dark-320-test-data.jpg)

## CAP26 — Approval decisions

### CAP26-dark-desktop-pr-approval-list-test-data

en · dark · 1440 × 1100

![CAP26-dark-desktop-pr-approval-list-test-data](CAP26-dark-desktop-pr-approval-list-test-data.jpg)

### CAP26-light-desktop-pr-approval-list-test-data

en · light · 1440 × 1100

![CAP26-light-desktop-pr-approval-list-test-data](CAP26-light-desktop-pr-approval-list-test-data.jpg)

### CAP26-dark-320-pr-review-actions-test-data

en · dark · 320 × 900

![CAP26-dark-320-pr-review-actions-test-data](CAP26-dark-320-pr-review-actions-test-data.jpg)

### CAP26-dark-desktop-sourcing-approval-detail-test-data

en · dark · 1440 × 1100

![CAP26-dark-desktop-sourcing-approval-detail-test-data](CAP26-dark-desktop-sourcing-approval-detail-test-data.jpg)

### CAP26-dark-desktop-po-decision-review-overview-test-data

en · dark · 1440 × 1100

![CAP26-dark-desktop-po-decision-review-overview-test-data](CAP26-dark-desktop-po-decision-review-overview-test-data.jpg)

### CAP26-dark-desktop-po-decision-review-actions-test-data

en · dark · 1440 × 1100

![CAP26-dark-desktop-po-decision-review-actions-test-data](CAP26-dark-desktop-po-decision-review-actions-test-data.jpg)

### CAP26-pt-BR-dark-desktop-test-data

pt-BR · dark · 1440 × 1100

![CAP26-pt-BR-dark-desktop-test-data](CAP26-pt-BR-dark-desktop-test-data.jpg)

### CAP26-pt-BR-dark-320-test-data

pt-BR · dark · 320 × 900

![CAP26-pt-BR-dark-320-test-data](CAP26-pt-BR-dark-320-test-data.jpg)

## CAP27 — Suppliers

### CAP27-dark-desktop-supplier-list-test-data

en · dark · 1440 × 1100

![CAP27-dark-desktop-supplier-list-test-data](CAP27-dark-desktop-supplier-list-test-data.jpg)

### CAP27-light-desktop-supplier-list-test-data

en · light · 1440 × 1100

![CAP27-light-desktop-supplier-list-test-data](CAP27-light-desktop-supplier-list-test-data.jpg)

### CAP27-light-320-supplier-list-test-data

en · light · 320 × 900

![CAP27-light-320-supplier-list-test-data](CAP27-light-320-supplier-list-test-data.jpg)

### CAP27-dark-desktop-create-supplier-test-data

en · dark · 1440 × 1100

![CAP27-dark-desktop-create-supplier-test-data](CAP27-dark-desktop-create-supplier-test-data.jpg)

### CAP27-dark-desktop-supplier-review-overview-test-data

en · dark · 1440 × 1100

![CAP27-dark-desktop-supplier-review-overview-test-data](CAP27-dark-desktop-supplier-review-overview-test-data.jpg)

### CAP27-dark-320-supplier-review-actions-test-data

en · dark · 320 × 900

![CAP27-dark-320-supplier-review-actions-test-data](CAP27-dark-320-supplier-review-actions-test-data.jpg)

### CAP27-dark-desktop-confirmed-supplier-detail-test-data

en · dark · 1440 × 1100

![CAP27-dark-desktop-confirmed-supplier-detail-test-data](CAP27-dark-desktop-confirmed-supplier-detail-test-data.jpg)

### CAP27-pt-BR-dark-desktop-test-data

pt-BR · dark · 1440 × 1100

![CAP27-pt-BR-dark-desktop-test-data](CAP27-pt-BR-dark-desktop-test-data.jpg)

### CAP27-pt-BR-dark-320-test-data

pt-BR · dark · 320 × 900

![CAP27-pt-BR-dark-320-test-data](CAP27-pt-BR-dark-320-test-data.jpg)

## CAP28 — Procurement settings

### CAP28-dark-desktop-settings-test-data

en · dark · 1440 × 1100

![CAP28-dark-desktop-settings-test-data](CAP28-dark-desktop-settings-test-data.jpg)

### CAP28-light-desktop-settings-test-data

en · light · 1440 × 1100

![CAP28-light-desktop-settings-test-data](CAP28-light-desktop-settings-test-data.jpg)

### CAP28-light-320-settings-test-data

en · light · 320 × 900

![CAP28-light-320-settings-test-data](CAP28-light-320-settings-test-data.jpg)

### CAP28-dark-desktop-settings-review-overview-test-data

en · dark · 1440 × 1100

![CAP28-dark-desktop-settings-review-overview-test-data](CAP28-dark-desktop-settings-review-overview-test-data.jpg)

### CAP28-dark-320-settings-review-actions-test-data

en · dark · 320 × 900

![CAP28-dark-320-settings-review-actions-test-data](CAP28-dark-320-settings-review-actions-test-data.jpg)

### CAP28-pt-BR-dark-desktop-test-data

pt-BR · dark · 1440 × 1100

![CAP28-pt-BR-dark-desktop-test-data](CAP28-pt-BR-dark-desktop-test-data.jpg)

### CAP28-pt-BR-dark-320-test-data

pt-BR · dark · 320 × 900

![CAP28-pt-BR-dark-320-test-data](CAP28-pt-BR-dark-320-test-data.jpg)
