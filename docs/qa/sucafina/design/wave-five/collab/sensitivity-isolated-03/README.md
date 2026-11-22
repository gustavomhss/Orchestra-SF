# UI44 isolated attempt 03 — evaluation response budget exceeded

This is a clean partial journey, **not a completed UI44 qualification**. The original fixture, source-issued units, editor, review and cancel assertions completed. One native sensitivity evaluation POST was observed. No response arrived within the existing 120-second wait, so the declaration ended before the result, authenticated sensitivity readback, samples, threshold, result keyboard-focus checks and pt-BR result view.

## Exact execution

- Product: `e4cc03bb3fa6deaed5c66f0050ffebf878dfef5d`.
- Snapshot: [`79a3e22f5d2b44533a55b2cb66a253443016a4f8`](https://github.com/gustavomhss/Orchestra-SF/commit/79a3e22f5d2b44533a55b2cb66a253443016a4f8).
- [Run 45029259117](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45029259117), test job `137228983031`: **1 failed**, reported test duration **6.4 minutes**. Cleanup job `137231749847` succeeded.
- The existing production Playwright configuration, strict/prod environment and original budgets were preserved. The snapshot adds only the standalone spec and CI request; product, combined spec, original source fixture and helpers are unchanged.
- [Canonical Actions artifact](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45029259117/artifacts/14757775207): original PNGs, failure context and report; expires November 29, 2026. Its ID, digest and metadata are preserved in [receipt.json](receipt.json).
- No mutation was replayed and no new execution was opened during acquisition or QA. This archive changes neither runtime/tests nor the global qualification count.

## Observed source and UI boundaries

The original fixture promoted a February parameter, registered the original sensitivity rule at version 2, read its units back, registered the original human portfolio selection and checked that the original comparisons remained unchanged. The native A04 GET returned HTTP 200 with the exact requested case/scenario/baseline/parameter, USD units, two original Planner evidence references and the original rule version. Those assertions remain in the unchanged standalone declaration.

The native `decision-sensitivity-evaluate` POST was observed at **13:54:57.8314329 UTC** with exact owner binding. No response status or body was observed. The test failed at `design-wave-five-sensitivity.spec.ts:115:34` when the original **120000 ms** wait expired.

The failure JPEG, emitted at approximately **13:56:57.91 UTC**, visibly shows **“Lost connection to the server. Retrying...”**, a retained review and a disabled confirmation action. This visual state does not establish the backend cause or whether a mutation persisted. There is no sensitivity result or sample table in the captured failure state.

The failure hook reports discovery/provider/view as `ready` and empty page/console error arrays. These are the emitted failure diagnostics; the declaration's final assertions and scope footer were not reached. The log contains one native sensitivity evaluation request and no native portfolio evaluation request. The final operation-count assertions were also not reached.

[Source events and diagnostics](source-events.json) preserve all **21 source events, 8 capture events with their original configure/review stages, and 3 diagnostics**. No result-stage event, evaluation response, authenticated result readback, sampled threshold, sample table or pt-BR result capture was emitted. The complete raw job log is not archived here.

## Actual images

All **nine original JPEGs** were reconstructed from **37 complete, 1-based `SF_DESIGN_PREVIEW` chunks**, totaling **608216 bytes**. There were no missing parts, duplicate parts or JSON parse errors. Each JPEG was emitted and visually inspected by **root_cost**. No independent image review is claimed in this archive.

Every remote JPEG was read back with GitHub's base64 file reader and compared byte-for-byte with its original chunk assembly. [capture-manifest.json](capture-manifest.json) records Git blob SHAs, byte counts, dimensions, chunk counts, timestamps and matching capture/stage events. [visual-review.json](visual-review.json) records image-specific findings and limits.

| Capture | Actual visual evidence |
| --- | --- |
| [No authorized units](gallery/UI44-no-source-scenarios-test-data.jpg) | Empty-case configure state visibly reports source absence. |
| [Original source selection](gallery/UI44-original-source-selection-test-data.jpg) | Original scenario, baseline and February parameter selected before requesting units. |
| [Issued editor — dark desktop](gallery/UI44-issued-units-editor-dark-desktop-test-data.jpg) | USD/USD, two refs, ≤2000 criterion and 200–2200/2 bounds are visible. |
| [Issued editor — light desktop](gallery/UI44-issued-units-editor-light-desktop-test-data.jpg) | The same editor values are visible in the native light theme. |
| [Issued editor — dark 390](gallery/UI44-issued-units-editor-dark-390-test-data.jpg) | Upper source form fits; lower editor is below the captured fold. |
| [Issued editor — light 320](gallery/UI44-issued-units-editor-light-320-test-data.jpg) | Upper source form fits; only the Parameter label reaches the lower edge. |
| [Review — dark desktop](gallery/UI44-dark-desktop-review-test-data.jpg) | References, criterion, basis and both review actions are legible. |
| [Review actions — dark 320](gallery/UI44-dark-320-review-actions-test-data.jpg) | Wrapped references and both stacked confirmation/cancel actions are visible. |
| [Failure — pending evaluation](gallery/FAILED-native-wave-three-test-data.jpg) | Connection warning, retained review and disabled confirmation; no result. |

The narrow editor captures show only their visible upper form. They do not establish the complete lower mobile editor. Viewport captures are not browser-zoom evidence. The missing result, table, threshold and pt-BR states remain unqualified.
