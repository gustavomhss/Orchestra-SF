# Canonical clones — installed UI44 sensitivity attempt 01

**Outcome: failure at the original 120,000 ms evaluation response waiter. UI44 remains unqualified.**

This archive preserves the completed [run 45052940386](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45052940386), using product `9bb7eeff9ba5a5ed501514144b4fd629b46f5ee0` and clean snapshot `34612b8ee430bb9964f558883286ef40b36fe2b7`. The test job `137301845700` failed at 18:16:17 UTC on 2026-11-22; cleanup `137305441267` succeeded at 18:16:27 UTC.

## Exact source and outcome

The snapshot adds only the original request `03c8f5c84391add25fdd11165eb1af6549c2e301` and the complete 205-line standalone Sensitivity spec `0df7e844d4f0419dc13249e87c2ad5766403b1c3`. Both are byte-identical to the prior isolated UI44 source snapshot `9a89ca88b1971ed3397dfb03dfa8b7fa2d9804bb`. The full permanent analytics spec remains `f4eb9a534b7a22fcf79e7ccb20bbfd9f8251ae74`; no analytics truncation, helper, fixture, workflow or deadline overlay was introduced.

The original units GET completed first. At final-log line **1199**, 18:14:06.8644484Z, `decision-controls-sensitivity-units` reports HTTP 200, `native-original-get-body`, USD/USD units and **two source references**, with the original selections and units body preserved. The spec's exact URL/query, body, selection and rule assertions precede that emission.

The later evaluation POST is distinct: `decision-sensitivity-evaluate`, sequence **1**, appears at line **1263**, 18:14:10.6560195Z. The completed log contains no matching response. The original waiter fails at [spec line 115](https://github.com/gustavomhss/Orchestra-SF/blob/34612b8ee430bb9964f558883286ef40b36fe2b7/packages/app-shell/e2e/sucafina/design-wave-five-sensitivity.spec.ts#L115), column 34; the timeout is reported at log line **1277**. The final test footer reports **1 failed**.

Execution did not reach the sensitivity result stage, original stored-result readback, threshold and sample checks, recorded-result captures, table keyboard-focus check, pt-BR result checks or final `SF_ANALYTICS_SCOPE` assertion. Earlier source-fixture readbacks and the units GET are preserved as intermediate evidence.

## Preserved evidence

- [receipt.json](receipt.json): pinned source, completed jobs, original budgets, failure locators, units/evaluation distinction and artifact metadata.
- [source-events.json](source-events.json): all **115** SF emissions in original order, with original payloads, timestamps and 1-based source lines.
- [manifest.json](manifest.json): all chunk locators, image hashes, dimensions and individual visual observations.
- [gallery](gallery/): **9 original JPEGs**, **607,895 bytes**, reconstructed from **37 complete 1-based chunks**.

The 115 emissions comprise **46 stage + 21 source + 8 capture + 3 diagnostics + 37 preview chunks**. There are no parse errors. No context or profiler records were emitted. The ninth image is the fixture's failure capture and has no separate `SF_ANALYTICS_CAPTURE` event. The two failure/page-closed diagnostic records report empty console-error and page-error arrays.

## Individual visual review

All nine JPEGs below were individually viewed by **root_cost**. Root separately viewed the light desktop editor, 320 px review actions and final failure capture; those observations are recorded in [root-review.json](root-review.json).

| Original image | Dimensions | Bytes | Chunks | Observed state |
|---|---:|---:|---:|---|
| [UI44-no-source-scenarios-test-data](gallery/UI44-no-source-scenarios-test-data.jpg) | 1440×1100 | 86317 | 5 | No-units notice; Scenario, Baseline and Parameter show Choose a case. |
| [UI44-original-source-selection-test-data](gallery/UI44-original-source-selection-test-data.jpg) | 1440×1100 | 89416 | 5 | Original selections visible; the units editor is not displayed yet. |
| [UI44-issued-units-editor-dark-desktop-test-data](gallery/UI44-issued-units-editor-dark-desktop-test-data.jpg) | 1440×1100 | 106342 | 6 | USD/USD, 2 evidence refs, criterion ≤ 2000, bounds 200–2200, 2 steps. |
| [UI44-issued-units-editor-light-desktop-test-data](gallery/UI44-issued-units-editor-light-desktop-test-data.jpg) | 1440×1100 | 108528 | 7 | Same populated editor in the light theme. |
| [UI44-issued-units-editor-dark-390-test-data](gallery/UI44-issued-units-editor-dark-390-test-data.jpg) | 390×844 | 36779 | 3 | 390 px upper viewport; remaining editor is below the capture. |
| [UI44-issued-units-editor-light-320-test-data](gallery/UI44-issued-units-editor-light-320-test-data.jpg) | 320×800 | 31123 | 2 | 320 px upper viewport; Parameter label reaches the lower edge. |
| [UI44-dark-desktop-review-test-data](gallery/UI44-dark-desktop-review-test-data.jpg) | 1440×1100 | 89146 | 5 | Review summary and Confirm / Cancel actions. |
| [UI44-dark-320-review-actions-test-data](gallery/UI44-dark-320-review-actions-test-data.jpg) | 320×800 | 29344 | 2 | Wrapped references; stacked Confirm / Cancel actions in 320 px. |
| [FAILED-native-wave-three-test-data](gallery/FAILED-native-wave-three-test-data.jpg) | 320×800 | 30900 | 2 | Review remains visible; lost-connection/retrying banner and dimmed Confirm. |

The final 320 px image retains **Review sensitivity request**, criterion **lte 2000 USD** and basis **200 — 2200 (2) USD**. It shows **“Lost connection to the server. Retrying...”**, a **Retry now** action, a dimmed **Confirm sensitivity evaluation** button and **Cancel review** near the lower edge. It shows no evaluation result.

That banner is a visual observation at capture time. It does not identify the cause of the timeout or prove a server crash, later reconnection, unwind, cancellation or persistence outcome. The 390 px and 320 px editor images show only their upper viewports; they do not establish that the whole editor is visible simultaneously.

## Byte preservation and artifact

JPEGs were decoded from the original base64 chunks without resizing, cropping, annotation or recompression. Every sequence is complete and 1-based. Base64 roundtrips, JPEG start/end markers and dimensions were checked. SHA-256 and independently computed Git blob SHA-1 values are recorded; all nine GitHub-created blob SHAs match the original bytes.

Root independently fetched all nine JPEGs from commit `6df9d688432ffcd323a6adc97a7e3894f1ba8fb2` using explicit base64 encoding. Every file matched the original completed-log chunks exactly: **9 images, 607,895 bytes**, with matching Git blob identities. The receipt, manifest and [root-review.json](root-review.json) record this completed readback.

Artifact `14766805641` is `playwright-ubuntu-24.04-1`, **9,052,395 bytes**, SHA-256 `f837e16a83e98c05bfd8331f60fcd62e5ab1ac87edf1b60f3080eb1cfef6574f`, expiring **2026-11-29T18:16:13Z**. Its ZIP contents and original PNG attachments were not downloaded or verified here. Raw logs and the Omni control value are not archived.

## Scope boundaries

The agent prepared 13 QA-only files under `sensitivity-01/`, based on QA `eb1c438cbdbaead15a8cecbb8245cc4f020b5b1c` / tree `dfa36c5ef43bb1158debf64b45f86e65ef6a85fc`. Root composed that staging into commit `6df9d688432ffcd323a6adc97a7e3894f1ba8fb2`, completed the nine binary readbacks, added this directory's root review and updated the parent README/root review. This later integration changes no runtime, test, acceptance count or CI execution. The shared product branch is outside this archive.

The earlier eight technical PASS gates remain scoped to run **45048665481**, product `d6bce5d81d0fd578a190b9bacac2a1a4250109a1` and snapshot `c18b97d8a316992b95abcbb57ef9b6c6754b1518`. The passing original guard **45052663805** covers QA `2b8cf6e0783c28eb293176657a2433ad35164485` and its 17 prior QA files; it does not cover this later archive. This failed UI44 run establishes no causal performance gain or completed visual qualification.
