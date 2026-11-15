# 130 — VIS112-001 DOCX continuation: source and proof handoff

**State:** source correction and regression specs committed; hosted validation and independent visual review **NOT_RUN**. Mission lease `docx-e2-browser130`; the S0 fence revokes dormant 124 but does not prove its runtime terminated.

## Candidate and scope
- Branch `docx-continuation-fix`, implementation W `f47b278b9667dedb106e53a75b8ab9f3d5c475d7`, source tree `22632ae2c3b000612b511ae7bc29623fa6859f1c`.
- Only original DOCX table flow in `modules/sucafina/Sucafinav1/product/reviews/render.ts` changed from blob `7010c9e5ec1f5300388408573b5ace1273662070` to `2a42b20133651bcff54f0a4f1ed2eb3590c06cc9`.
- Three regression cases are in `modules/sucafina/Sucafinav1/test/product/docx-continuation130/table-flow.test.ts` (blob `9ef0efd8772bcf4546bf5ef340d041ff3252bd8f`). Existing title fix `w:lineRule="atLeast"`, chart data, PPTX output, period/source mapping and artifact digests remain untouched by the source patch.
- Tables use complete column text fragments; bound each physical row to 12 logical lines before setting `cantSplit`, thereby avoiding a page-crossing table row with blank first cell. Every overflow physical row receives a bounded record identifier and association to period/source; the original text for all three columns continues in its original column, with no suppression.

## Genuine historical before
- C51 run [43682455278](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43682455278), artifact #14148499941; ZIP SHA256 `ac15e48914aef2e5d496f48c6136901432cda499caa82f8954851d1c748461e1`, original inspection manifest `e562aeb561e48e5dd205227b44b29e3e35fbba52f8e14bdb001d9bc4cbf46fb6`.
- Composed-DOCX PDF 15 pages (`c3d3907d...`), after-drift-DOCX PDF 15 pages (`6c77c963...`). Inspected original composed page2 `9d14c933...`, page3 `75e2bbfb...`, page4 `4d65e6c6...`: the `license:1:currency-declared: USD` line crosses p2→p3 and its page3 first cell is blank, corroborating <https://github.com/gustavomhss/Orchestra-SF/pull/108>.
- These pre-patch artifacts are **baseline only**; they are not output from W and cannot clear VIS112-001 or re-certify VIS88-001.

## Required hosted validation
The proposed exact selection is in [CI-REQUEST-130.json](CI-REQUEST-130.json). Only 129 may dispatch the existing `test:ci/request` snapshots, on a coherent 125-composed candidate/tree, with run S, job, artifact, source hashes and Omni. Include the existing reader88 **real** export of composed-docx and after-drift-docx with all affected pages before/after. 128 owns compiler/guards. 131 independently reviews all changed pages (not just page1), content/cell associations and the previous title. No tests, typecheck, renderer or visual review are claimed PASS by 130.

## Integration and closeout
125 must consume the two exact source/test blobs with preimage and epoch checks; **do not merge the entire divergent branch or its old envelopes**. The original DOCX renderer in `sf2-stack` was observed to have the identical preimage blob, but 125 must re-read at intake. Capture W/S/run/job, all original hashes, postimages/page hashes, negative cases, independent 131 verdict and consumer ACK. Without them keep `VIS112-001 OPEN`; native Goal remains paused and global release is false.
