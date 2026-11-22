# UI44 isolated attempt 01 — failed evaluation response budget

This is a clean partial journey, **not a completed UI44 qualification**. The unchanged original fixture, A04 units selection, editor, review and cancel assertions passed. One native sensitivity evaluation POST was observed. No response arrived within the existing 120-second wait; the test ended before the result, authenticated sensitivity readback, samples, threshold, keyboard focus and pt-BR checks.

## Exact execution

- Product: `5882179a3fea2bbbec465821ffd5a13c06deda4b`.
- Snapshot: [`cde5333d2c988b069633e2de0b677a477b2f9d5e`](https://github.com/gustavomhss/Orchestra-SF/commit/cde5333d2c988b069633e2de0b677a477b2f9d5e).
- [Run 45003432183](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45003432183), test job `137149720488`: **1 failed**, reported test duration 6.7 minutes. Cleanup job `137152154372` succeeded.
- Existing production Playwright configuration, strict/prod environment and original budgets. The snapshot only adds the independent spec and CI request; combined spec, original source fixture and helpers are unchanged.
- [Canonical Actions artifact](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45003432183/artifacts/14746614969): original PNGs, failure context and report; expires November 29, 2026. Its ID and digest are in [receipt.json](receipt.json).
- The standalone declaration was reviewed independently by root and analytics before this single authorized execution. No mutation was replayed and no second run was opened.

## Observed source and UI boundaries

The original fixture promoted a February source parameter, registered the original sensitivity rule at version 2, read the units back, registered the original human portfolio selection and demonstrated unchanged comparisons before and after that selection. The native A04 request then returned HTTP 200 with the exact requested case/scenario/baseline/parameter, original USD units, two original Planner evidence references and the original rule version. The complete assertions are preserved in the snapshot.

The native POST `decision-sensitivity-evaluate` started at `08:42:44.7295549Z`. There is no observed response status or body. The failure screenshot at approximately `08:44:44.8Z` shows **“Lost connection to the server. Retrying...”**, a disabled confirmation button, and the review still visible. This is a visual observation; it does not establish a persisted result, an authority denial, or the cause of the connection warning.

The original failure hook reports discovery/provider/view as `ready` and both page/console error arrays as empty. The final assertions in the spec were not reached. The logs contain one observed sensitivity evaluation POST and no portfolio evaluation POST; the footer that asserts those counts was also not reached.

[Source events and diagnostics](source-events.json) preserve the original emitted values. [failure.log](failure.log) retains the timeout and its source location. [receipt.json](receipt.json) records passed and unreached boundaries separately.

## Actual images

All nine JPEGs were reconstructed from 37 complete original `SF_DESIGN_PREVIEW` chunks. They preserve the original screenshot bytes and were individually emitted and inspected by `design_collaboration`. Root independently reconstructed the same chunks and inspected exactly three images: the dark desktop issued editor, dark 320 review actions, and the failure state. No peer inspection or completed result qualification is claimed. All nine remote JPEG file contents were checked byte-for-byte against the original chunks. [capture-manifest.json](capture-manifest.json) contains paths, Git blob SHAs, byte counts, chunk counts and timestamps.

| Capture | Actual visual evidence |
| --- | --- |
| [No authorized units](gallery/UI44-no-source-scenarios-test-data.jpg) | Empty case honestly reports source absence. |
| [Original source selection](gallery/UI44-original-source-selection-test-data.jpg) | Original scenario, baseline and parameter selected before requesting units. |
| [Issued editor — dark desktop](gallery/UI44-issued-units-editor-dark-desktop-test-data.jpg) | USD units, two evidence references, original criterion and 200–2200 / 2 bounds are visible. |
| [Issued editor — light desktop](gallery/UI44-issued-units-editor-light-desktop-test-data.jpg) | Same original editor values in the light native theme. |
| [Issued editor — dark 390](gallery/UI44-issued-units-editor-dark-390-test-data.jpg) | Upper form fits the narrow viewport; criterion and numeric bounds are below the captured fold. |
| [Issued editor — light 320](gallery/UI44-issued-units-editor-light-320-test-data.jpg) | Upper form fits the narrow viewport; this is not evidence of the complete lower editor. |
| [Review — dark desktop](gallery/UI44-dark-desktop-review-test-data.jpg) | Original source references, criterion, basis and both actions are legible. |
| [Review actions — dark 320](gallery/UI44-dark-320-review-actions-test-data.jpg) | Wrapped references and both confirmation/cancel actions are visible. |
| [Failure — pending evaluation](gallery/FAILED-native-wave-three-test-data.jpg) | Connection warning and disabled confirmation; no result is displayed. |

These images are separate from the already qualified UI51–56 galleries. They do not establish a recorded sensitivity result, threshold, sample table, pt-BR result view or browser zoom behavior.
