# UI44 isolated attempt 02 — upstream fixes do not complete the installed journey

The unchanged installed UI44 journey **still fails at the original 120-second evaluation-response wait** on candidate `0de8e697838f9083ceaadbc2b16abee14640d230`. Original fixture preparation, native A04 units, editor, review and cancellation checks completed. One native sensitivity evaluation POST was observed; no response or persisted result was reached.

The four unchanged composition regressions for the literal upstream #641/#643 changes passed separately. That result qualifies their tested classification and publication behavior in this composition; it does not complete UI44. See [regression evidence](../../analytics/sensitivity-upstream/README.md).

## Exact execution and preserved inputs

- Candidate: [`0de8e697838f9083ceaadbc2b16abee14640d230`](https://github.com/gustavomhss/Orchestra-SF/commit/0de8e697838f9083ceaadbc2b16abee14640d230), based on `9341bc3d25f5771009258b58c91c0fe85cb093ae`. Its five changed files are literal upstream blobs from #641 and #643; their paths and SHAs are in the receipt.
- Snapshot: [`3cf5b86be21254a4fe4c0eaddb7929588accf363`](https://github.com/gustavomhss/Orchestra-SF/commit/3cf5b86be21254a4fe4c0eaddb7929588accf363), tree `7ab9e2c33d8bfe42c8ce76bef99c37d267201988`.
- Snapshot delta: only the original standalone spec (`0df7e844d4f0419dc13249e87c2ad5766403b1c3`) and original CI request (`03c8f5c84391add25fdd11165eb1af6549c2e301`) copied literally from `cde5333d2c988b069633e2de0b677a477b2f9d5e`.
- [Run 45025502692](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45025502692), test job `137217522587`: **1 failed**, reported test-file duration 6.3 minutes. Cleanup `137220332644` succeeded.
- Existing `test-ci`, Linux `ubuntu-24.04`, production Playwright configuration and `prod` + `strict`. Source helper `581ac6c`, seed `32b3993`, capture helper `ebbab2a` and config `9724c94` are unchanged. No assertion, source, gate or timeout was changed.
- [Canonical Actions artifact](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45025502692/artifacts/14754999279): original PNG attachments, failure context and report, 9,052,703 bytes, expires November 29, 2026. Digest: `sha256:f12c7ea63895ca74aacbe898c36894e8a96f7c0a1bda0e1d144ebcd9a033ea2b`.

## Observed boundary

The unchanged fixture promoted the original source parameter, registered the sensitivity rule at version 2, read back issued units and registered the original human portfolio selection. It preserved three alternatives, one choice, conditioned comparisons and absent complete totals. The native A04 GET returned HTTP 200; its exact origin, mount, query, absence of request body, case/scenario/baseline/parameter binding, units, evidence references and rule version were asserted.

The native `decision-sensitivity-evaluate` POST was observed at `13:12:11.6353865Z` with `sequence: 1` and `ownerBinding: exact`. The existing `page.waitForResponse` timed out after 120,000 ms at `design-wave-five-sensitivity.spec.ts:115:34`. No response status or body was emitted. Persistence is unknown because the result stage and authenticated sensitivity readback were never reached.

The failure screenshot at approximately `13:14:11.7Z` shows **“Lost connection to the server. Retrying...”**, review content still visible and confirmation disabled. This is a visual observation, not a diagnosis of the backend cause. The original failure hook reported discovery/provider/view as `ready` and empty page/console error arrays. Final page assertions and the operation-count footer were not reached.

The recorded events contain one native sensitivity evaluation request and no native portfolio evaluation request. This is an observed event count; no final count assertion or successful evaluation is inferred.

[receipt.json](receipt.json) separates completed checks from unreached checks. [source-events.json](source-events.json) preserves 21 source events, eight normal capture events, 46 stage events and three diagnostics. The final scope event was never emitted. The quoted source-code line in Playwright's timeout excerpt is excluded from emitted events. Raw job logs are not committed.

## Actual visual review

All nine JPEGs were assembled from **37 complete original preview chunks**, totaling **608,004 bytes**, and uploaded without conversion, cropping, resizing or recompression. Each image was displayed and visually inspected by `dev_delta`. Remote file contents were compared against the original joined base64 bytes before updating the QA branch. Root independently read the seven QA text files, checked the original event/chunk evidence, and visually inspected exactly the dark desktop editor, the 320-pixel review and the failure screenshot; those three remote image contents matched the original chunks. [root-review.json](root-review.json) records that review and its limits. No peer visual review is claimed.

[capture-manifest.json](capture-manifest.json) contains original names, paths, Git blob SHAs, byte counts, chunk counts and timestamps. The failure image retains the original helper's `FAILED-native-wave-three` name.

| Capture | Actual visual evidence and limits |
| --- | --- |
| [No source units](gallery/UI44-no-source-scenarios-test-data.jpg) | The empty case honestly reports that authorized sensitivity units have not been issued. |
| [Original source selection](gallery/UI44-original-source-selection-test-data.jpg) | Original scenario, baseline and parameter are selected. Long labels truncate within the closed native selects. |
| [Issued editor — dark desktop](gallery/UI44-issued-units-editor-dark-desktop-test-data.jpg) | USD / USD, two evidence references, criterion value 2000 and 200–2200 / 2 bounds are visible; the steps input has a visible focus outline. |
| [Issued editor — light desktop](gallery/UI44-issued-units-editor-light-desktop-test-data.jpg) | The same source-issued values are legible in the light native theme. |
| [Issued editor — dark 390](gallery/UI44-issued-units-editor-dark-390-test-data.jpg) | The heading wraps and the upper form fits. Lower criterion and numeric bounds are below the captured fold. |
| [Issued editor — light 320](gallery/UI44-issued-units-editor-light-320-test-data.jpg) | The upper form fits at 320 pixels. This is not evidence of the complete lower editor. |
| [Review — dark desktop](gallery/UI44-dark-desktop-review-test-data.jpg) | Source references, criterion, basis and both actions are visible. |
| [Review actions — dark 320](gallery/UI44-dark-320-review-actions-test-data.jpg) | Wrapped references, basis and both confirmation/cancel actions are visible before submission. |
| [Failure — evaluation pending](gallery/FAILED-native-wave-three-test-data.jpg) | Connection warning, disabled confirmation and no result. The banner shifts the bottom of cancel to the viewport edge. |

## Qualification limit

UI44 remains pending. No recorded sensitivity result, persisted bounds, sample table, threshold readback, result-table keyboard assertion, pt-BR result view or browser zoom behavior is qualified by this run. The block remains at 12/15 qualified surfaces; the 41 accepted/merged total is unchanged. These QA additions do not change runtime files, fixtures, existing qualified galleries, or `sf-design-next`. No extra CI ref, replay or follow-up execution was created.
