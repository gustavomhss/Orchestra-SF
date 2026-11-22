# Canonical clones — installed attempt 01

**Result: FAILED at the first original preview-response waiter (60,000 ms), with no UI42–44 qualification.**

Run [45049647711](https://github.com/gustavomhss/Orchestra-SF/actions/runs/45049647711) tested product `9bb7eeff9ba5a5ed501514144b4fd629b46f5ee0` through snapshot `cd68b7226780d58cca96e6a821071df3feb8517a`. The test job `137291725271` completed with failure at 2026-11-22 17:38:59 UTC. Cleanup job `137294725575` completed successfully at 17:39:05 UTC.

## Exact source and failure

The snapshot changes only `.ci-run.json` (blob `a11922821a47594d76397582be38f9b7940177ca`) and the selected analytics spec (blob `db1d7f4f0d770e5eed811070b0814c0363083c62`). That spec is the literal first 30,401 characters of permanent blob `f4eb9a534b7a22fcf79e7ccb20bbfd9f8251ae74`: the complete original first declaration and its helpers remain intact. The original 60,000 ms waiter at spec line 72 was not increased. The request uses the production Playwright config with `prod` and strict Omni.

The first `decision-portfolio-preview` POST is sequence 3, emitted at **2026-11-22T17:37:53.7420045Z**, final-log line **1249**. No matching preview response was recorded. Playwright reported the original `page.waitForResponse` timeout at log line **1275**, with the source location `design-wave-five-analytics.spec.ts:72:32` at line **1284**. The final test result is **1 failed**. Later preview, recorded-results and sensitivity stages were not completed.

The emitted stage sequence includes `build`, `installation` and `native-ready`, then ends at `decisions-ready`. The browser reached the captured UI42 list and configuration states. Those observations do not qualify the complete journey.

## History readbacks remain distinct

| Read | Captured evidence | Interpretation |
| --- | --- | --- |
| History sequence 1 | Request line 1211; `native-request-failed` line 1213 (633 ms); HTTP 200 response line 1215 (631 ms) with `response-body-unavailable` | The body was not acquired. There is no `status: ok` or confirmed body shape for this read. |
| History sequence 2 | Request line 1233; HTTP 200 response line 1251, `status: ok`, `valueShape: array`, 1,131 ms | A successful body acquisition and array shape were reported. The event does not preserve array cardinality. |

The rendered empty History in the screenshots does not turn History sequence 1 into a successful readback. The archive retains the original source order, timestamps and payloads, including the sequence-2 response emission after the preview request emission.

## Evidence retained

- [receipt.json](receipt.json): tested product/snapshot, request, jobs, artifact metadata, exact failure, History distinction and qualification limits.
- [source-events.json](source-events.json): all **115 original payloads** with 1-based final-log line locators and timestamps. The 33 preview payloads retain their original base64 data.
- [manifest.json](manifest.json): chunk audit, byte identities and per-image visual inspection notes.
- `gallery/`: seven original JPEG previews, **537,102 bytes** in total, reconstructed from **33 complete 1-based chunks**.

The 115 emissions comprise **46 stage**, **25 source**, **2 context**, **6 capture**, **3 diagnostics** and **33 preview-chunk** records. There are **no profiler records**. Both console/page-error reports have empty arrays; the native-view diagnostic reports ready discovery/provider/view and the pending preview text. This does not establish a successful operation response.

No log file, control nonce, runtime overlay or new test execution is included. PNG attachments and traces inside the Actions ZIP were not downloaded. The recorded artifact is `14764509379`, size **8,821,842 bytes**, with metadata digest `sha256:74fe0e59a95cc3f067f11a3b48891c1c18214d9f07a4bc9d72e028b9a27e8895`, expiring **2026-11-29T17:38:57Z**. Its ZIP digest was not independently recomputed.

## Visual inspection

All seven JPEGs were displayed and inspected individually by `root_cost`; no root visual review is attributed here.

| Original JPEG name | Dimensions | Bytes | Chunks | Observed state |
| --- | --- | ---: | ---: | --- |
| UI42-list-dark-desktop-test-data | 1440×1100 | 80620 | 5 | Dark desktop list shows two authorized cases with Open case links and versions 2 and 6. Both titles remain inside their cards; the longer operating-plans title wraps onto a second line. Portfolio scenarios is selected in the left navigation. |
| UI42-list-light-desktop-test-data | 1440×1100 | 85910 | 5 | Light desktop list shows the same two authorized cases and versions 2 and 6. Titles, version labels and Open case links remain within their respective cards. |
| UI42-list-dark-390-test-data | 390×844 | 28701 | 2 | At 390 px in dark mode, the two case cards stack vertically. Both long titles wrap within the card boundaries; version labels and Open case links are visible. The capture shows the complete authorized-case list without visible horizontal clipping. |
| UI42-list-light-320-test-data | 320×800 | 27445 | 2 | At 320 px in light mode, both authorized cases remain visible in vertically stacked cards. The instruction and long titles wrap within the viewport; version labels and Open case links remain visible. |
| UI42-empty-authorized-case-test-data | 1440×1100 | 97973 | 6 | The sourcing case is shown at version 2 with no eligible candidate scenarios. Preview combinations appears disabled; the constraint and priority criterion are unchecked and the displayed exploration limit is 32. History displays No recorded results for this case. |
| UI42-configure-focused-candidate-test-data | 1440×1100 | 106320 | 6 | The operating-plans case is shown at version 6. Decision candidate plan v1 and the constraint v2 are selected; baseline and monthly-amount hypothesis are unchecked. Exploration limit is 4 with a visible focus outline, and Preview combinations appears enabled. History displays No recorded results for this case. |
| FAILED-native-wave-three-test-data | 1440×1100 | 110133 | 7 | The failure frame retains the selected candidate v1, constraint v2 and exploration limit 4. Preview combinations is disabled and labelled Running; the form controls appear disabled. A skeleton panel states Preview is not yet available. History displays No recorded results for this case. |

The failure frame keeps candidate v1, constraint v2 and limit 4 selected, with disabled controls, **Running**, a skeleton stating **Preview is not yet available**, and empty rendered History. It does not show later unwind, cancellation, completion or persistence.

## Preservation and limits

The JPEG bytes were not resized, recompressed, cropped or annotated. Base64 round-trips, JPEG boundaries, chunk cardinalities, SHA-256 values and Git blob SHA-1 identities were checked. All seven independently computed Git blob IDs match the IDs returned by GitHub on creation.

The initial text-only Git Data blob fetch could not read the JPEGs. After creating the evidence commit `1edd09262363a50625d0ed128c506b2970bafa3f`, `/root` used the GitHub file connector's explicit base64 mode and independently reread **all seven JPEGs**. Their blob IDs and complete base64 payloads match the original completed-log chunks exactly. This confirms byte preservation; the Actions ZIP was not downloaded.

The prior [eight-gate technical PASS](../technical-01/receipt.json) belongs to run `45048665481`, product `d6bce5d81d0fd578a190b9bacac2a1a4250109a1` and snapshot `c18b97d8a316992b95abcbb57ef9b6c6754b1518`. It is separately scoped and was not rerun by this installed attempt.

This archive establishes a failed installed journey and the captured prefix only. **UI42, UI43 and UI44 remain pending.** No global acceptance count changes, causal speedup, CPU attribution or complete original-journey qualification is asserted. The archive is prepared over QA base `924a4acb63390e58f978676b4b22478e6c384808` / tree `d950a8429aea8feb33ce9a2b6a60d824b661781b`; the coordinator's [integration review](root-review.json) records the later parent-document update and independent checks.
